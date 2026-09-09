// ============================================================
// KOLAYBI ENTEGRASYONU
// Çoklu şirket + otomatik senkronizasyon
// ============================================================

const { storage } = require('./company-context-hook');

const registerKolaybi = ({ app, poolPromise, sql }) => {
  const running = new Set();
  const DEFAULT_BASE_URL = 'https://ofis-api.kolaybi.com';
  const API_TIMEOUT_MS = 30000;

  const normalizeChannel = value => String(value ?? '').trim();
  const normalizeBaseUrl = value =>
    String(value || DEFAULT_BASE_URL)
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/kolaybi\/v1$/i, '');

  const companyIdFromRequest = req => {
    const contextCompanyId = Number(storage.getStore()?.companyId);
    if ([1, 2, 3].includes(contextCompanyId)) return contextCompanyId;

    const rawCompanyId =
      req.headers['x-company-id'] ??
      req.query.companyId ??
      req.body?.CompanyId;

    if (rawCompanyId === undefined || rawCompanyId === null || rawCompanyId === '') return 1;

    const id = Number(rawCompanyId);
    if (![1, 2, 3].includes(id)) {
      throw Object.assign(new Error('Geçersiz CompanyId'), { status: 400 });
    }
    return id;
  };

  const fetchWithTimeout = async (url, options = {}, timeout = API_TIMEOUT_MS) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw Object.assign(
          new Error(`KolayBi API zaman aşımına uğradı (${timeout / 1000} saniye).`),
          { status: 504 }
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  async function getAyarlar(pool, companyId = 1) {
    const result = await pool.request()
      .input('CompanyId', sql.Int, companyId)
      .query(`
        SELECT TOP 1
          Id, ApiKey, Channel, BaseUrl, AccessToken, TokenGecerlilik,
          SonSenkronTarihi, CompanyId, KolaybiCompanyId, IsActive, CreatedAt, UpdatedAt
        FROM dbo.KolaybiAyarlar
        WHERE CompanyId = @CompanyId AND IsActive = 1
        ORDER BY Id DESC
      `);
    return result.recordset[0] || null;
  }

  async function getValidToken(pool, companyId = 1) {
    const ayar = await getAyarlar(pool, companyId);
    const channel = normalizeChannel(ayar?.Channel);
    const baseUrl = normalizeBaseUrl(ayar?.BaseUrl);

    if (!ayar || !ayar.ApiKey || !channel) {
      throw Object.assign(
        new Error(`Şirket ${companyId} için KolayBi API Key / Channel tanımlı değil.`),
        { status: 503 }
      );
    }

    const now = new Date();
    if (
      ayar.AccessToken &&
      ayar.TokenGecerlilik &&
      new Date(ayar.TokenGecerlilik) > now
    ) {
      return { token: ayar.AccessToken, channel, baseUrl, ayar };
    }

    console.log(`[KolayBi][Şirket ${companyId}] Access token alınıyor...`);
    console.log(`[KolayBi][Şirket ${companyId}] BaseUrl: ${baseUrl}`);
    console.log(`[KolayBi][Şirket ${companyId}] Channel tanımlı: ${Boolean(channel)}`);

    const response = await fetchWithTimeout(
      `${baseUrl}/kolaybi/v1/access_token`,
      {
        method: 'POST',
        headers: {
          Channel: channel,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ api_key: ayar.ApiKey })
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      if (response.status === 404 && /10404|kanal bulunamadı/i.test(text)) {
        throw Object.assign(
          new Error(`KolayBi kanalı bulunamadı. Şirket ${companyId} için kayıtlı Channel KolayBi hesabıyla eşleşmiyor.`),
          { status: 502, code: 'KOLAYBI_CHANNEL_NOT_FOUND' }
        );
      }
      throw Object.assign(
        new Error(`KolayBi access token alınamadı. HTTP ${response.status}. ${text}`),
        { status: 502 }
      );
    }

    const body = await response.json();
    const token = body?.data;
    if (!token) {
      throw Object.assign(
        new Error('KolayBi access token cevabında token bulunamadı.'),
        { status: 502 }
      );
    }

    const gecerlilik = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    await pool.request()
      .input('CompanyId', sql.Int, companyId)
      .input('AccessToken', sql.NVarChar, token)
      .input('TokenGecerlilik', sql.DateTime2, gecerlilik)
      .query(`
        UPDATE dbo.KolaybiAyarlar
        SET AccessToken = @AccessToken, TokenGecerlilik = @TokenGecerlilik, UpdatedAt = SYSDATETIME()
        WHERE CompanyId = @CompanyId AND IsActive = 1
      `);

    console.log(`[KolayBi][Şirket ${companyId}] Access token alındı.`);
    return { token, channel, baseUrl, ayar };
  }

  async function kolaybiRequest(pool, companyId, path, params = {}) {
    const { token, channel, baseUrl } = await getValidToken(pool, companyId);
    const url = new URL(`${baseUrl}${path}`);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    });

    console.log(`[KolayBi][Şirket ${companyId}] GET ${url.pathname}${url.search}`);

    const response = await fetchWithTimeout(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Channel: channel,
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw Object.assign(
        new Error(`KolayBi API hatası. HTTP ${response.status}. ${text}`),
        { status: 502 }
      );
    }
    return response.json();
  }

  const getExternalId = row => {
    const value = row?.id ?? row?.document_id ?? row?.commercial_doc_id ?? row?.company_id ?? row?.associate_id ?? row?.product_id ?? row?.code;
    return value !== undefined && value !== null && String(value).trim() !== '' ? String(value) : null;
  };

  const getEntityId = getExternalId;

  async function saveSyncRecord(pool, companyId, entityType, row) {
    const externalId = getExternalId(row);
    const entityId = getEntityId(row);
    if (!externalId || !entityId) return { created: 0, updated: 0, skipped: 1 };

    const existing = await pool.request()
      .input('CompanyId', sql.Int, companyId)
      .input('EntityType', sql.NVarChar(100), entityType)
      .input('ExternalId', sql.NVarChar(255), externalId)
      .query(`
        SELECT TOP 1 SyncId, EntityId, Status
        FROM dbo.KolaybiSyncKayitlari
        WHERE CompanyId = @CompanyId AND EntityType = @EntityType AND ExternalId = @ExternalId
        ORDER BY SyncId DESC
      `);

    if (existing.recordset.length > 0) {
      await pool.request()
        .input('SyncId', sql.BigInt, existing.recordset[0].SyncId)
        .input('EntityId', sql.NVarChar(255), entityId)
        .query(`
          UPDATE dbo.KolaybiSyncKayitlari
          SET EntityId = @EntityId, Direction = 'KOLAYBI_TO_ERP', Status = 'BAŞARILI',
              ErrorMessage = NULL, SyncDate = SYSDATETIME()
          WHERE SyncId = @SyncId
        `);
      return { created: 0, updated: 1, skipped: 0 };
    }

    await pool.request()
      .input('CompanyId', sql.Int, companyId)
      .input('EntityType', sql.NVarChar(100), entityType)
      .input('EntityId', sql.NVarChar(255), entityId)
      .input('ExternalId', sql.NVarChar(255), externalId)
      .query(`
        INSERT INTO dbo.KolaybiSyncKayitlari
        (CompanyId, EntityType, EntityId, Direction, Status, ExternalId, ErrorMessage, SyncDate)
        VALUES (@CompanyId, @EntityType, @EntityId, 'KOLAYBI_TO_ERP', 'BAŞARILI', @ExternalId, NULL, SYSDATETIME())
      `);
    return { created: 1, updated: 0, skipped: 0 };
  }

  async function saveRaw(pool, companyId, entityType, rows) {
    let created = 0, updated = 0, skipped = 0, errors = 0;
    const list = Array.isArray(rows) ? rows : [];
    for (const row of list) {
      try {
        const result = await saveSyncRecord(pool, companyId, entityType, row);
        created += result.created; updated += result.updated; skipped += result.skipped;
      } catch (err) {
        errors++;
        console.error(`[KolayBi][Şirket ${companyId}] ${entityType} kayıt hatası:`, err.message);
      }
    }
    return { created, updated, skipped, errors };
  }

  async function syncCompany(companyId) {
    if (running.has(companyId)) return { companyId, skipped: true };
    running.add(companyId);
    let created = 0, updated = 0, skipped = 0, errors = 0;
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
          const result = await saveRaw(pool, companyId, type, response?.data);
          created += result.created; updated += result.updated; skipped += result.skipped; errors += result.errors;
        } catch (err) {
          errors++;
          messages.push(`${type}: ${err.message}`);
          console.error(`[KolayBi][Şirket ${companyId}] ${type}: ${err.message}`);
        }
      }

      await pool.request()
        .input('CompanyId', sql.Int, companyId)
        .query(`UPDATE dbo.KolaybiAyarlar SET SonSenkronTarihi = SYSDATETIME(), UpdatedAt = SYSDATETIME() WHERE CompanyId = @CompanyId AND IsActive = 1`);

      return {
        companyId, created, updated, skipped, errors,
        status: errors > 0 ? 'KISMI_HATA' : 'BAŞARILI',
        messages
      };
    } finally {
      running.delete(companyId);
    }
  }

  app.get('/api/sirketler', async (req, res) => {
    try {
      const pool = await poolPromise;
      const result = await pool.request().query(`SELECT CompanyId, CompanyCode, CompanyName, IsActive FROM dbo.Sirketler WHERE IsActive = 1 ORDER BY CompanyId`);
      res.json(result.recordset);
    } catch (err) {
      res.status(500).json({ error: 'Şirketler alınamadı', detail: err.message });
    }
  });

  app.get('/api/kolaybi/ayarlar', async (req, res) => {
    try {
      const pool = await poolPromise;
      const companyId = companyIdFromRequest(req);
      const ayar = await getAyarlar(pool, companyId);
      res.json({
        CompanyId: companyId,
        KolaybiCompanyId: ayar?.KolaybiCompanyId || null,
        Channel: normalizeChannel(ayar?.Channel),
        BaseUrl: normalizeBaseUrl(ayar?.BaseUrl),
        ApiKeyTanimli: Boolean(ayar?.ApiKey),
        SonSenkronTarihi: ayar?.SonSenkronTarihi || null
      });
    } catch (err) {
      res.status(err.status || 500).json({ error: 'Ayarlar alınamadı', detail: err.message });
    }
  });

  app.put('/api/kolaybi/ayarlar', async (req, res) => {
    try {
      const pool = await poolPromise;
      const companyId = companyIdFromRequest(req);
      const { ApiKey, Channel, BaseUrl, KolaybiCompanyId } = req.body;
      const request = pool.request()
        .input('CompanyId', sql.Int, companyId)
        .input('Channel', sql.NVarChar, normalizeChannel(Channel) || null)
        .input('BaseUrl', sql.NVarChar, normalizeBaseUrl(BaseUrl))
        .input('KolaybiCompanyId', sql.NVarChar, KolaybiCompanyId ? String(KolaybiCompanyId).trim() : null);

      let query = `UPDATE dbo.KolaybiAyarlar SET Channel = @Channel, BaseUrl = @BaseUrl, KolaybiCompanyId = @KolaybiCompanyId, AccessToken = NULL, TokenGecerlilik = NULL, UpdatedAt = SYSDATETIME()`;
      if (ApiKey) {
        request.input('ApiKey', sql.NVarChar, ApiKey);
        query += `, ApiKey = @ApiKey`;
      }
      query += ` WHERE CompanyId = @CompanyId AND IsActive = 1`;
      const result = await request.query(query);

      if (!result.rowsAffected || result.rowsAffected[0] === 0) {
        return res.status(404).json({ error: `Şirket ${companyId} için KolayBi ayar kaydı bulunamadı.` });
      }
      res.json({ success: true, message: `Şirket ${companyId} KolayBi ayarları güncellendi.` });
    } catch (err) {
      res.status(err.status || 500).json({ error: 'Ayarlar güncellenirken hata oluştu', detail: err.message });
    }
  });

  app.post('/api/kolaybi/test-baglanti', async (req, res) => {
    let companyId = null;
    try {
      const pool = await poolPromise;
      companyId = companyIdFromRequest(req);
      await getValidToken(pool, companyId);
      const companies = await kolaybiRequest(pool, companyId, '/kolaybi/v1/companies');
      res.json({ success: true, message: 'Bağlantı başarılı, access token alındı.', CompanyId: companyId, KolaybiSirketleri: companies?.data || [] });
    } catch (err) {
      console.error(`[KolayBi][Şirket ${companyId ?? 'bilinmiyor'}] Bağlantı testi hatası:`, err.message);
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
      const params = req.query.type ? { type: req.query.type, has_products: true } : { has_products: true };
      res.json(await kolaybiRequest(pool, companyId, '/kolaybi/v1/invoices', params));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/kolaybi/senkronize-et', async (req, res) => {
    let companyId = null;
    try {
      companyId = companyIdFromRequest(req);
      const result = await storage.run({ companyId }, () => syncCompany(companyId));
      res.json({ success: true, ...result });
    } catch (err) {
      console.error(`[KolayBi][Şirket ${companyId ?? 'bilinmiyor'}] Manuel senkronizasyon hatası:`, err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.get('/api/kolaybi/senkronizasyon-durumu', async (req, res) => {
    try {
      const pool = await poolPromise;
      const companyId = companyIdFromRequest(req);
      const ayar = await getAyarlar(pool, companyId);
      const log = await pool.request()
        .input('CompanyId', sql.Int, companyId)
        .query(`SELECT TOP 1 SyncId, CompanyId, EntityType, EntityId, Direction, Status, ExternalId, ErrorMessage, SyncDate FROM dbo.KolaybiSyncKayitlari WHERE CompanyId = @CompanyId ORDER BY SyncId DESC`);
      res.json({ companyId, running: running.has(companyId), ayar: ayar ? { SonSenkronTarihi: ayar.SonSenkronTarihi } : null, sonLog: log.recordset[0] || null });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  const runAllCompanies = async () => {
    try {
      const pool = await poolPromise;
      const companies = await pool.request().query(`SELECT CompanyId FROM dbo.Sirketler WHERE IsActive = 1 ORDER BY CompanyId`);
      for (const row of companies.recordset) {
        const companyId = row.CompanyId;
        storage.run({ companyId }, () => {
          syncCompany(companyId).catch(err => console.error(`[KolayBi] Otomatik senkronizasyon Şirket ${companyId} hatası:`, err.message));
        });
      }
    } catch (err) {
      console.error('KolayBi otomatik senkronizasyon başlatılamadı:', err.message);
    }
  };

  setInterval(runAllCompanies, 60 * 1000);
  setTimeout(runAllCompanies, 5000);
  console.log('KolayBi çoklu şirket entegrasyonu yüklendi.');
};

module.exports = registerKolaybi;
