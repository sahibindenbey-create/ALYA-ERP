// kolaybi.js
// KolayBi API entegrasyonu. Ayarlar ve senkronizasyon seçili şirkete göre çalışır.

const registerKolaybi = ({ app, poolPromise, sql }) => {

  // db.js her HTTP isteğinde SESSION_CONTEXT('CompanyId') ayarladığı için
  // KolayBi tarafındaki tüm DB işlemleri seçili şirkete göre izole edilir.
  async function getAyarlar(pool) {
    const result = await pool.request().query(`
      SELECT TOP 1 *
      FROM KolaybiAyarlar
      WHERE CompanyId = TRY_CONVERT(INT, SESSION_CONTEXT(N'CompanyId'))
        AND IsActive = 1
      ORDER BY Id
    `);
    return result.recordset[0] || null;
  }

  async function getValidToken(pool) {
    const ayar = await getAyarlar(pool);
    if (!ayar || !ayar.ApiKey || !ayar.Channel) {
      throw Object.assign(
        new Error('Seçili şirket için KolayBi API Key / Channel tanımlı değil. Önce ayarları girin.'),
        { status: 503 }
      );
    }

    const now = new Date();
    if (ayar.AccessToken && ayar.TokenGecerlilik && new Date(ayar.TokenGecerlilik) > now) {
      return { token: ayar.AccessToken, channel: ayar.Channel, baseUrl: ayar.BaseUrl };
    }

    const res = await fetch(`${ayar.BaseUrl}/kolaybi/v1/access_token`, {
      method: 'POST',
      headers: { Channel: ayar.Channel, 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: ayar.ApiKey }),
    });
    if (!res.ok) {
      throw Object.assign(new Error(`KolayBi access token alınamadı (HTTP ${res.status})`), { status: 502 });
    }

    const body = await res.json();
    const token = body.data;
    const gecerlilik = new Date(now.getTime() + 23 * 60 * 60 * 1000);

    await pool.request()
      .input('AccessToken', sql.NVarChar, token)
      .input('TokenGecerlilik', sql.DateTime, gecerlilik)
      .query(`
        UPDATE KolaybiAyarlar
        SET AccessToken = @AccessToken,
            TokenGecerlilik = @TokenGecerlilik,
            UpdatedAt = SYSDATETIME()
        WHERE CompanyId = TRY_CONVERT(INT, SESSION_CONTEXT(N'CompanyId'))
          AND IsActive = 1
      `);

    return { token, channel: ayar.Channel, baseUrl: ayar.BaseUrl };
  }

  async function kolaybiRequest(pool, path, params = {}) {
    const { token, channel, baseUrl } = await getValidToken(pool);
    const url = new URL(`${baseUrl}${path}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, Channel: channel },
    });
    if (!res.ok) {
      throw Object.assign(new Error(`KolayBi API hatası (HTTP ${res.status})`), { status: 502 });
    }
    return res.json();
  }

  const STATUS_MAP = {
    draft: 'Bekliyor', ready_to_send: 'Bekliyor', sent: 'Bekliyor',
    approved: 'Bekliyor', rejected: 'İptal', cancelled: 'İptal',
  };

  app.get('/api/kolaybi/ayarlar', async (req, res) => {
    try {
      const pool = await poolPromise;
      const ayar = await getAyarlar(pool);
      res.json({
        CompanyId: ayar?.CompanyId || null,
        CompanyCode: ayar?.CompanyCode || null,
        Channel: ayar?.Channel || '',
        BaseUrl: ayar?.BaseUrl || 'https://ofis-sandbox-api.kolaybi.com',
        ApiKeyTanimli: Boolean(ayar?.ApiKey),
        SonSenkronTarihi: ayar?.SonSenkronTarihi || null,
      });
    } catch (err) {
      res.status(500).json({ error: 'Ayarlar alınamadı', detail: err.message });
    }
  });

  app.put('/api/kolaybi/ayarlar', async (req, res) => {
    try {
      const pool = await poolPromise;
      const { ApiKey, Channel, BaseUrl } = req.body;
      const request = pool.request()
        .input('Channel', sql.NVarChar, Channel || null)
        .input('BaseUrl', sql.NVarChar, BaseUrl || 'https://ofis-sandbox-api.kolaybi.com');

      let query = `
        UPDATE KolaybiAyarlar
        SET Channel=@Channel,
            BaseUrl=@BaseUrl,
            AccessToken=NULL,
            TokenGecerlilik=NULL,
            UpdatedAt=SYSDATETIME()
        WHERE CompanyId = TRY_CONVERT(INT, SESSION_CONTEXT(N'CompanyId'))
          AND IsActive = 1
      `;
      if (ApiKey) {
        request.input('ApiKey', sql.NVarChar, ApiKey);
        query = query.replace('AccessToken=NULL,', 'ApiKey=@ApiKey, AccessToken=NULL,');
      }

      const result = await request.query(query);
      if (result.rowsAffected[0] === 0) {
        return res.status(404).json({ error: 'Seçili şirket için KolayBi ayar kaydı bulunamadı.' });
      }
      res.json({ success: true, message: 'Seçili şirketin KolayBi ayarları güncellendi.' });
    } catch (err) {
      res.status(500).json({ error: 'Ayarlar güncellenirken hata oluştu', detail: err.message });
    }
  });

  app.post('/api/kolaybi/test-baglanti', async (req, res) => {
    try {
      const pool = await poolPromise;
      await getValidToken(pool);
      res.json({ success: true, message: 'Seçili şirket için KolayBi bağlantısı başarılı, access token alındı.' });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.get('/api/kolaybi/faturalar-onizleme', async (req, res) => {
    try {
      const pool = await poolPromise;
      const { type } = req.query;
      const data = await kolaybiRequest(pool, '/kolaybi/v1/invoices', type ? { type } : {});
      res.json(data);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/kolaybi/senkronize-et', async (req, res) => {
    try {
      const pool = await poolPromise;
      const sonuc = { eklenen: 0, atlanan: 0, hatali: 0, detaylar: [] };

      for (const kolaybiType of ['sale_invoice', 'purchase_invoice']) {
        const listeYaniti = await kolaybiRequest(pool, '/kolaybi/v1/invoices', { type: kolaybiType });
        const faturalar = listeYaniti.data || [];

        for (const f of faturalar) {
          try {
            const existing = await pool.request()
              .input('KolaybiInvoiceId', sql.Int, f.id)
              .query(`
                SELECT FaturaId
                FROM Faturalar
                WHERE KolaybiInvoiceId = @KolaybiInvoiceId
              `);
            if (existing.recordset.length > 0) { sonuc.atlanan++; continue; }

            const yon = kolaybiType === 'sale_invoice' ? 'Satış' : 'Alış';
            const cariAdi = f.contact
              ? `${f.contact.name || ''} ${f.contact.surname || ''}`.trim()
              : 'Bilinmeyen Cari';

            let cariResult = await pool.request()
              .input('CariAdi', sql.NVarChar, cariAdi)
              .query(`
                SELECT TOP 1 CariId, CariKodu
                FROM CariListesi
                WHERE CariAdi = @CariAdi
                  AND CompanyId = TRY_CONVERT(INT, SESSION_CONTEXT(N'CompanyId'))
                  AND IsActive = 1
              `);

            let cariId, cariKodu;
            if (cariResult.recordset.length > 0) {
              cariId = cariResult.recordset[0].CariId;
              cariKodu = cariResult.recordset[0].CariKodu;
            } else {
              cariKodu = `KLB-${f.contact?.id || Date.now()}`;
              const yeniCari = await pool.request()
                .input('CompanyId', sql.Int, sql.Int)
                .input('CariKodu', sql.NVarChar, cariKodu)
                .input('CariAdi', sql.NVarChar, cariAdi)
                .input('CariTipi', sql.Int, yon === 'Satış' ? 1 : 2)
                .input('MusteriTuru', sql.NVarChar, yon === 'Satış' ? 'Müşteri' : 'Tedarikçi')
                .query(`
                  INSERT INTO CariListesi (CompanyId, CariKodu, CariAdi, CariTipi, MusteriTuru)
                  OUTPUT INSERTED.CariId
                  VALUES (
                    TRY_CONVERT(INT, SESSION_CONTEXT(N'CompanyId')),
                    @CariKodu, @CariAdi, @CariTipi, @MusteriTuru
                  )
                `);
              cariId = yeniCari.recordset[0].CariId;
            }

            const durum = STATUS_MAP[f.status] || 'Bekliyor';
            const faturaResult = await pool.request()
              .input('FaturaKodu', sql.NVarChar, f.serial_no || `KLB-${f.id}`)
              .input('Yon', sql.NVarChar, yon)
              .input('CariId', sql.Int, cariId)
              .input('CariKodu', sql.NVarChar, cariKodu)
              .input('CariAdi', sql.NVarChar, cariAdi)
              .input('FaturaTarihi', sql.Date, f.order_date)
              .input('VadeTarihi', sql.Date, f.due_date || null)
              .input('GenelToplam', sql.Decimal(18, 2), f.total_amount || 0)
              .input('ParaBirimi', sql.NVarChar, (f.currency || 'TRY').toUpperCase())
              .input('Durum', sql.NVarChar, durum)
              .input('KolaybiInvoiceId', sql.Int, f.id)
              .query(`
                INSERT INTO Faturalar (
                  FaturaKodu, Yon, CariId, CariKodu, CariAdi, FaturaTarihi,
                  VadeTarihi, GenelToplam, ParaBirimi, Durum, KolaybiInvoiceId
                )
                OUTPUT INSERTED.FaturaId
                VALUES (
                  @FaturaKodu, @Yon, @CariId, @CariKodu, @CariAdi, @FaturaTarihi,
                  @VadeTarihi, @GenelToplam, @ParaBirimi, @Durum, @KolaybiInvoiceId
                )
              `);

            try {
              const detay = await kolaybiRequest(pool, `/kolaybi/v1/invoices/${f.id}`);
              const kalemler = detay?.data?.items || [];
              for (const k of kalemler) {
                await pool.request()
                  .input('FaturaId', sql.Int, faturaResult.recordset[0].FaturaId)
                  .input('UrunKodu', sql.NVarChar, k.product_code || k.code || null)
                  .input('UrunAdi', sql.NVarChar, k.product_name || k.name || k.description || 'Ürün')
                  .input('Miktar', sql.Decimal(18, 2), k.quantity || 1)
                  .input('Birim', sql.NVarChar, k.unit || 'Adet')
                  .input('BirimFiyat', sql.Decimal(18, 2), k.unit_price || 0)
                  .input('KdvOrani', sql.Int, k.vat_rate || 20)
                  .query(`
                    INSERT INTO FaturaDetay (FaturaId, UrunKodu, UrunAdi, Miktar, Birim, BirimFiyat, KdvOrani)
                    VALUES (@FaturaId, @UrunKodu, @UrunAdi, @Miktar, @Birim, @BirimFiyat, @KdvOrani)
                  `);
              }
            } catch (detayErr) {
              console.warn('KolayBi fatura satırları alınamadı:', f.id, detayErr.message);
            }

            sonuc.eklenen++;
          } catch (itemErr) {
            sonuc.hatali++;
            sonuc.detaylar.push(`Fatura ${f.id}: ${itemErr.message}`);
          }
        }
      }

      await pool.request().query(`
        UPDATE KolaybiAyarlar
        SET SonSenkronTarihi = GETDATE(), UpdatedAt = SYSDATETIME()
        WHERE CompanyId = TRY_CONVERT(INT, SESSION_CONTEXT(N'CompanyId'))
          AND IsActive = 1
      `);
      res.json({ success: true, ...sonuc });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });
};

module.exports = registerKolaybi;
