// KolayBi entegrasyonu - çoklu şirket + sunucu tarafı otomatik senkronizasyon.
// Resmi API modülleri: companies, associates, products, invoices, e-document ve finansal belgeler.
const registerKolaybi = ({ app, poolPromise, sql }) => {
  const running = new Set();
  const DEFAULT_BASE_URL = 'https://ofis-api.kolaybi.com';
  const STATUS_MAP = {
    draft: 'Bekliyor', ready_to_send: 'Bekliyor', sent: 'Bekliyor',
    approved: 'Bekliyor', rejected: 'İptal', cancelled: 'İptal'
  };

  const companyIdFromRequest = (req) => {
    const id = Number(req.headers['x-company-id'] || req.query.companyId || req.body?.CompanyId || 1);
    return [1, 2, 3].includes(id) ? id : 1;
  };

  async function getAyarlar(pool, companyId = 1) {
    const result = await pool.request()
      .input('CompanyId', sql.Int, companyId)
      .query(`
        SELECT TOP 1 * FROM KolaybiAyarlar
        WHERE CompanyId = @CompanyId
        ORDER BY Id DESC
      `);
    return result.recordset[0] || null;
  }

  async function getValidToken(pool, companyId = 1) {
    const ayar = await getAyarlar(pool, companyId);
    if (!ayar || !ayar.ApiKey || !ayar.Channel) {
      throw Object.assign(new Error(`Şirket ${companyId} için KolayBi API Key / Channel tanımlı değil.`), { status: 503 });
    }

    const now = new Date();
    if (ayar.AccessToken && ayar.TokenGecerlilik && new Date(ayar.TokenGecerlilik) > now) {
      return { token: ayar.AccessToken, channel: ayar.Channel, baseUrl: ayar.BaseUrl || DEFAULT_BASE_URL, ayar };
    }

    const baseUrl = ayar.BaseUrl || DEFAULT_BASE_URL;
    const res = await fetch(`${baseUrl}/kolaybi/v1/access_token`, {
      method: 'POST',
      headers: { Channel: ayar.Channel, 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: ayar.ApiKey })
    });
    if (!res.ok) throw Object.assign(new Error(`KolayBi access token alınamadı (HTTP ${res.status})`), { status: 502 });
    const body = await res.json();
    const token = body.data;
    const gecerlilik = new Date(now.getTime() + 23 * 60 * 60 * 1000);

    await pool.request()
      .input('CompanyId', sql.Int, companyId)
      .input('AccessToken', sql.NVarChar, token)
      .input('TokenGecerlilik', sql.DateTime2, gecerlilik)
      .query(`UPDATE KolaybiAyarlar SET AccessToken=@AccessToken, TokenGecerlilik=@TokenGecerlilik, UpdatedDate=SYSDATETIME() WHERE CompanyId=@CompanyId`);

    return { token, channel: ayar.Channel, baseUrl, ayar };
  }

  async function kolaybiRequest(pool, companyId, path, params = {}) {
    const { token, channel, baseUrl } = await getValidToken(pool, companyId);
    const url = new URL(`${baseUrl}${path}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, Channel: channel }
    });
    if (!res.ok) throw Object.assign(new Error(`KolayBi API hatası (HTTP ${res.status})`), { status: 502 });
    return res.json();
  }

  async function saveRaw(pool, companyId, entityType, rows) {
    let created = 0;
    let updated = 0;
    for (const row of (Array.isArray(rows) ? rows : [])) {
      const externalId = String(row.id ?? row.document_id ?? row.commercial_doc_id ?? row.company_id ?? row.code ?? `${Date.now()}-${Math.random()}`);
      const payload = JSON.stringify(row);
      const existing = await pool.request()
        .input('CompanyId', sql.Int, companyId)
        .input('EntityType', sql.NVarChar, entityType)
        .input('ExternalId', sql.NVarChar, externalId)
        .query(`SELECT TOP 1 SyncId, Payload FROM KolaybiSyncKayitlari WHERE CompanyId=@CompanyId AND EntityType=@EntityType AND ExternalId=@ExternalId`);

      if (!existing.recordset.length) {
        await pool.request()
          .input('CompanyId', sql.Int, companyId)
          .input('EntityType', sql.NVarChar, entityType)
          .input('ExternalId', sql.NVarChar, externalId)
          .input('Payload', sql.NVarChar(sql.MAX), payload)
          .query(`INSERT INTO KolaybiSyncKayitlari(CompanyId,EntityType,ExternalId,Payload) VALUES(@CompanyId,@EntityType,@ExternalId,@Payload)`);
        created++;
      } else if (existing.recordset[0].Payload !== payload) {
        await pool.request()
          .input('SyncId', sql.BigInt, existing.recordset[0].SyncId)
          .input('Payload', sql.NVarChar(sql.MAX), payload)
          .query(`UPDATE KolaybiSyncKayitlari SET Payload=@Payload, SyncedAt=SYSDATETIME() WHERE SyncId=@SyncId`);
        updated++;
      }
    }
    return { created, updated };
  }

  async function syncCompany(companyId) {
    if (running.has(companyId)) return { skipped: true };
    running.add(companyId);
    const started = new Date();
    let created = 0, updated = 0, errors = 0;
    const messages = [];
    try {
      const pool = await poolPromise;
      const jobs = [
        ['company', '/kolaybi/v1/companies', {}],
        ['associate', '/kolaybi/v1/associates', {}],
        ['product', '/kolaybi/v1/products', {}],
        ['sale_invoice', '/kolaybi/v1/invoices', { type: 'sale_invoice', has_products: true }],
        ['sale_return_invoice', '/kolaybi/v1/invoices', { type: 'sale_return_invoice', has_products: true }],
        ['purchase_invoice', '/kolaybi/v1/invoices', { type: 'purchase_invoice', has_products: true }],
        ['purchase_return_invoice', '/kolaybi/v1/invoices', { type: 'purchase_return_invoice', has_products: true }]
      ];

      for (const [type, endpoint, params] of jobs) {
        try {
          const response = await kolaybiRequest(pool, companyId, endpoint, params);
          const rows = response?.data || [];
          const result = await saveRaw(pool, companyId, type, rows);
          created += result.created;
          updated += result.updated;
        } catch (err) {
          errors++;
          messages.push(`${type}: ${err.message}`);
        }
      }

      await pool.request()
        .input('CompanyId', sql.Int, companyId)
        .input('FinishedAt', sql.DateTime2, new Date())
        .input('Status', sql.NVarChar, errors ? 'KISMI_HATA' : 'BAŞARILI')
        .input('CreatedCount', sql.Int, created)
        .input('UpdatedCount', sql.Int, updated)
        .input('ErrorCount', sql.Int, errors)
        .input('Message', sql.NVarChar, messages.join(' | ').slice(0, 2000) || null)
        .query(`
          INSERT INTO KolaybiSyncLog(CompanyId,StartedAt,FinishedAt,Status,CreatedCount,UpdatedCount,ErrorCount,Message)
          VALUES(@CompanyId,@StartedAt,@FinishedAt,@Status,@CreatedCount,@UpdatedCount,@ErrorCount,@Message)
        `.replace('@StartedAt', `'${started.toISOString().slice(0,19).replace('T',' ')}'`));

      await pool.request()
        .input('CompanyId', sql.Int, companyId)
        .input('SonSenkronDurumu', sql.NVarChar, errors ? 'KISMI_HATA' : 'BAŞARILI')
        .input('SonSenkronMesaji', sql.NVarChar, messages.join(' | ').slice(0, 1000) || null)
        .query(`UPDATE KolaybiAyarlar SET SonSenkronTarihi=SYSDATETIME(), SonSenkronDurumu=@SonSenkronDurumu, SonSenkronMesaji=@SonSenkronMesaji, UpdatedDate=SYSDATETIME() WHERE CompanyId=@CompanyId`);

      return { companyId, created, updated, errors, messages };
    } finally {
      running.delete(companyId);
    }
  }

  // ERP şirketleri
  app.get('/api/sirketler', async (req, res) => {
    try {
      const pool = await poolPromise;
      const result = await pool.request().query(`SELECT CompanyId, CompanyName, IsActive FROM Sirketler WHERE IsActive=1 ORDER BY CompanyId`);
      res.json(result.recordset);
    } catch (err) {
      res.status(500).json({ error: 'Şirketler alınamadı', detail: err.message });
    }
  });

  // Aktif şirket için KolayBi ayarları
  app.get('/api/kolaybi/ayarlar', async (req, res) => {
    try {
      const pool = await poolPromise;
      const companyId = companyIdFromRequest(req);
      const ayar = await getAyarlar(pool, companyId);
      res.json({
        CompanyId: companyId,
        KolaybiCompanyId: ayar?.KolaybiCompanyId || null,
        Channel: ayar?.Channel || '',
        BaseUrl: ayar?.BaseUrl || DEFAULT_BASE_URL,
        ApiKeyTanimli: Boolean(ayar?.ApiKey),
        SonSenkronTarihi: ayar?.SonSenkronTarihi || null,
        SonSenkronDurumu: ayar?.SonSenkronDurumu || null,
        SonSenkronMesaji: ayar?.SonSenkronMesaji || null
      });
    } catch (err) {
      res.status(500).json({ error: 'Ayarlar alınamadı', detail: err.message });
    }
  });

  app.put('/api/kolaybi/ayarlar', async (req, res) => {
    try {
      const pool = await poolPromise;
      const companyId = companyIdFromRequest(req);
      const { ApiKey, Channel, BaseUrl, KolaybiCompanyId } = req.body;
      const request = pool.request()
        .input('CompanyId', sql.Int, companyId)
        .input('Channel', sql.NVarChar, Channel || null)
        .input('BaseUrl', sql.NVarChar, BaseUrl || DEFAULT_BASE_URL)
        .input('KolaybiCompanyId', sql.Int, KolaybiCompanyId || null);
      let query = `UPDATE KolaybiAyarlar SET Channel=@Channel, BaseUrl=@BaseUrl, KolaybiCompanyId=@KolaybiCompanyId, AccessToken=NULL, TokenGecerlilik=NULL, UpdatedDate=SYSDATETIME()`;
      if (ApiKey) {
        request.input('ApiKey', sql.NVarChar, ApiKey);
        query += ', ApiKey=@ApiKey';
      }
      query += ' WHERE CompanyId=@CompanyId';
      await request.query(query);
      res.json({ success: true, message: `Şirket ${companyId} KolayBi ayarları güncellendi.` });
    } catch (err) {
      res.status(500).json({ error: 'Ayarlar güncellenirken hata oluştu', detail: err.message });
    }
  });

  app.post('/api/kolaybi/test-baglanti', async (req, res) => {
    try {
      const pool = await poolPromise;
      const companyId = companyIdFromRequest(req);
      const auth = await getValidToken(pool, companyId);
      const companies = await kolaybiRequest(pool, companyId, '/kolaybi/v1/companies');
      res.json({ success: true, message: 'Bağlantı başarılı, access token alındı.', CompanyId: companyId, KolaybiSirketleri: companies?.data || [] });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.get('/api/kolaybi/sirketler', async (req, res) => {
    try {
      const pool = await poolPromise;
      const companyId = companyIdFromRequest(req);
      res.json(await kolaybiRequest(pool, companyId, '/kolaybi/v1/companies'));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.get('/api/kolaybi/faturalar-onizleme', async (req, res) => {
    try {
      const pool = await poolPromise;
      const companyId = companyIdFromRequest(req);
      const { type } = req.query;
      res.json(await kolaybiRequest(pool, companyId, '/kolaybi/v1/invoices', type ? { type, has_products: true } : { has_products: true }));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/kolaybi/senkronize-et', async (req, res) => {
    try {
      const result = await syncCompany(companyIdFromRequest(req));
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.get('/api/kolaybi/senkronizasyon-durumu', async (req, res) => {
    try {
      const pool = await poolPromise;
      const companyId = companyIdFromRequest(req);
      const ayar = await getAyarlar(pool, companyId);
      const log = await pool.request().input('CompanyId', sql.Int, companyId).query(`SELECT TOP 1 * FROM KolaybiSyncLog WHERE CompanyId=@CompanyId ORDER BY SyncLogId DESC`);
      res.json({ companyId, running: running.has(companyId), ayar: ayar ? { SonSenkronTarihi: ayar.SonSenkronTarihi, SonSenkronDurumu: ayar.SonSenkronDurumu, SonSenkronMesaji: ayar.SonSenkronMesaji } : null, sonLog: log.recordset[0] || null });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Sunucu tarafı 1 dakika. Tarayıcı açık olmasa da çalışır.
  const runAllCompanies = async () => {
    try {
      const pool = await poolPromise;
      const companies = await pool.request().query(`SELECT CompanyId FROM Sirketler WHERE IsActive=1 ORDER BY CompanyId`);
      for (const row of companies.recordset) {
        syncCompany(row.CompanyId).catch(err => console.error(`KolayBi otomatik senkronizasyon Şirket ${row.CompanyId}:`, err.message));
      }
    } catch (err) {
      console.error('KolayBi otomatik senkronizasyon başlatılamadı:', err.message);
    }
  };

  setInterval(runAllCompanies, 60 * 1000);
};

module.exports = registerKolaybi;
