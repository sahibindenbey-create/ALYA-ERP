// kolaybi.js
// KolayBi (https://developer.kolaybi.com) API entegrasyonu.
// Ayarlar (API Key, Channel, Base URL) veritabanındaki KolaybiAyarlar
// tablosunda tutulur; kod değiştirmeden / restart etmeden panelden güncellenebilir.

const registerKolaybi = ({ app, poolPromise, sql }) => {

  async function getAyarlar(pool) {
    const result = await pool.request().query('SELECT * FROM KolaybiAyarlar WHERE Id = 1');
    return result.recordset[0] || null;
  }

  // Access token'ı gerekirse yeniler (24 saat geçerli), DB'de cache'ler
  async function getValidToken(pool) {
    const ayar = await getAyarlar(pool);
    if (!ayar || !ayar.ApiKey || !ayar.Channel) {
      throw Object.assign(new Error('KolayBi API Key / Channel tanımlı değil. Önce ayarları girin.'), { status: 503 });
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

    const gecerlilik = new Date(now.getTime() + 23 * 60 * 60 * 1000); // 23 saat (güvenlik payı)
    await pool.request()
      .input('AccessToken', sql.NVarChar, token)
      .input('TokenGecerlilik', sql.DateTime, gecerlilik)
      .query('UPDATE KolaybiAyarlar SET AccessToken = @AccessToken, TokenGecerlilik = @TokenGecerlilik WHERE Id = 1');

    return { token, channel: ayar.Channel, baseUrl: ayar.BaseUrl };
  }

  async function kolaybiRequest(pool, path, params = {}) {
    const { token, channel, baseUrl } = await getValidToken(pool);
    const url = new URL(`${baseUrl}${path}`);
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v); });

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

  // --- Ayarlar ---
  app.get('/api/kolaybi/ayarlar', async (req, res) => {
    try {
      const pool = await poolPromise;
      const ayar = await getAyarlar(pool);
      res.json({
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

      let query = 'UPDATE KolaybiAyarlar SET Channel=@Channel, BaseUrl=@BaseUrl, AccessToken=NULL, TokenGecerlilik=NULL';
      if (ApiKey) {
        request.input('ApiKey', sql.NVarChar, ApiKey);
        query += ', ApiKey=@ApiKey';
      }
      query += ' WHERE Id=1';

      await request.query(query);
      res.json({ success: true, message: 'Ayarlar güncellendi' });
    } catch (err) {
      res.status(500).json({ error: 'Ayarlar güncellenirken hata oluştu', detail: err.message });
    }
  });

  app.post('/api/kolaybi/test-baglanti', async (req, res) => {
    try {
      const pool = await poolPromise;
      await getValidToken(pool);
      res.json({ success: true, message: 'Bağlantı başarılı, access token alındı.' });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // --- Önizleme: KolayBi'deki faturaları göster (bizim DB'ye dokunmaz) ---
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

  // --- Senkronizasyon: KolayBi faturalarını çekip Faturalar/FaturaDetay'a aktar ---
  app.post('/api/kolaybi/senkronize-et', async (req, res) => {
    try {
      const pool = await poolPromise;
      const sonuc = { eklenen: 0, atlanan: 0, hatali: 0, detaylar: [] };

      for (const kolaybiType of ['sale_invoice', 'purchase_invoice']) {
        const listeYaniti = await kolaybiRequest(pool, '/kolaybi/v1/invoices', { type: kolaybiType });
        const faturalar = listeYaniti.data || [];

        for (const f of faturalar) {
          try {
            const existing = await pool.request().input('KolaybiInvoiceId', sql.Int, f.id)
              .query('SELECT FaturaId FROM Faturalar WHERE KolaybiInvoiceId = @KolaybiInvoiceId');
            if (existing.recordset.length > 0) { sonuc.atlanan++; continue; }

            const yon = kolaybiType === 'sale_invoice' ? 'Satış' : 'Alış';
            const cariAdi = f.contact ? `${f.contact.name || ''} ${f.contact.surname || ''}`.trim() : 'Bilinmeyen Cari';

            let cariResult = await pool.request().input('CariAdi', sql.NVarChar, cariAdi)
              .query('SELECT TOP 1 CariId, CariKodu FROM CariListesi WHERE CariAdi = @CariAdi');
            let cariId, cariKodu;
            if (cariResult.recordset.length > 0) {
              cariId = cariResult.recordset[0].CariId;
              cariKodu = cariResult.recordset[0].CariKodu;
            } else {
              cariKodu = `KLB-${f.contact?.id || Date.now()}`;
              const yeniCari = await pool.request()
                .input('CompanyId', sql.Int, 1)
                .input('CariKodu', sql.NVarChar, cariKodu)
                .input('CariAdi', sql.NVarChar, cariAdi)
                .input('CariTipi', sql.Int, yon === 'Satış' ? 1 : 2)
                .input('MusteriTuru', sql.NVarChar, yon === 'Satış' ? 'Müşteri' : 'Tedarikçi')
                .query(`
                  INSERT INTO CariListesi (CompanyId, CariKodu, CariAdi, CariTipi, MusteriTuru)
                  OUTPUT INSERTED.CariId
                  VALUES (@CompanyId, @CariKodu, @CariAdi, @CariTipi, @MusteriTuru)
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
                INSERT INTO Faturalar (FaturaKodu, Yon, CariId, CariKodu, CariAdi, FaturaTarihi, VadeTarihi, GenelToplam, ParaBirimi, Durum, KolaybiInvoiceId)
                OUTPUT INSERTED.FaturaId
                VALUES (@FaturaKodu, @Yon, @CariId, @CariKodu, @CariAdi, @FaturaTarihi, @VadeTarihi, @GenelToplam, @ParaBirimi, @Durum, @KolaybiInvoiceId)
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

      await pool.request().query('UPDATE KolaybiAyarlar SET SonSenkronTarihi = GETDATE() WHERE Id = 1');
      res.json({ success: true, ...sonuc });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });
};

module.exports = registerKolaybi;
