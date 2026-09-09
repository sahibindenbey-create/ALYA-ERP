const { storage } = require('./company-context-hook');

const COMPANY_IDS = new Set([1, 2, 3]);
const DEFAULT_BASE_URL = 'https://ofis-api.kolaybi.com';

const ENDPOINTS = [
  ['companies', '/kolaybi/v1/companies', {}],
  ['users', '/kolaybi/v1/users', {}],
  ['tags', '/kolaybi/v1/tags', {}],
  ['products', '/kolaybi/v1/products', {}],
  ['associates', '/kolaybi/v1/associates', {}],
  ['invoices_sale', '/kolaybi/v1/invoices', { type: 'sale_invoice', has_products: true }],
  ['invoices_sale_return', '/kolaybi/v1/invoices', { type: 'sale_return_invoice', has_products: true }],
  ['invoices_purchase', '/kolaybi/v1/invoices', { type: 'purchase_invoice', has_products: true }],
  ['invoices_purchase_return', '/kolaybi/v1/invoices', { type: 'purchase_return_invoice', has_products: true }],
  ['invoices_self_employment', '/kolaybi/v1/invoices', { type: 'self_employment_receipt', has_products: true }],
  ['cheques', '/kolaybi/v1/cheques', {}],
  ['bonds', '/kolaybi/v1/bonds', {}]
];

const idOf = (row, fallback) => String(
  row?.id ?? row?.document_id ?? row?.commercial_doc_id ?? row?.company_id ?? row?.associate_id ?? row?.product_id ?? row?.transaction_id ?? row?.code ?? fallback
);

async function getApi(pool, sql, companyId) {
  const r = await pool.request()
    .input('CompanyId', sql.Int, companyId)
    .query(`SELECT TOP 1 ApiKey, Channel, BaseUrl, AccessToken, TokenGecerlilik FROM dbo.KolaybiAyarlar WHERE CompanyId=@CompanyId AND IsActive=1 ORDER BY Id DESC`);
  const a = r.recordset[0];
  if (!a?.ApiKey || !a?.Channel) throw new Error(`Şirket ${companyId} için KolayBi API ayarı eksik.`);
  const baseUrl = a.BaseUrl || DEFAULT_BASE_URL;
  if (a.AccessToken && a.TokenGecerlilik && new Date(a.TokenGecerlilik) > new Date()) {
    return { token: a.AccessToken, channel: a.Channel, baseUrl };
  }
  const response = await fetch(`${baseUrl}/kolaybi/v1/access_token`, {
    method: 'POST',
    headers: { Channel: a.Channel, 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: a.ApiKey })
  });
  if (!response.ok) throw new Error(`KolayBi token HTTP ${response.status}`);
  const body = await response.json();
  const token = body?.data;
  if (!token) throw new Error('KolayBi token cevabı boş.');
  await pool.request()
    .input('CompanyId', sql.Int, companyId)
    .input('AccessToken', sql.NVarChar, token)
    .input('TokenGecerlilik', sql.DateTime2, new Date(Date.now() + 23 * 60 * 60 * 1000))
    .query(`UPDATE dbo.KolaybiAyarlar SET AccessToken=@AccessToken, TokenGecerlilik=@TokenGecerlilik, UpdatedAt=SYSDATETIME() WHERE CompanyId=@CompanyId AND IsActive=1`);
  return { token, channel: a.Channel, baseUrl };
}

async function getJson(api, path, params = {}) {
  const url = new URL(`${api.baseUrl}${path}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${api.token}`, Channel: api.channel, Accept: 'application/json' }
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`KolayBi API HTTP ${response.status}: ${body}`);
  }
  return response.json();
}

async function saveRaw(pool, sql, companyId, entityType, rows) {
  let count = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    const externalId = idOf(row, count);
    const payload = JSON.stringify(row);
    await pool.request()
      .input('CompanyId', sql.Int, companyId)
      .input('EntityType', sql.NVarChar(100), entityType)
      .input('ExternalId', sql.NVarChar(255), externalId)
      .input('Payload', sql.NVarChar(sql.MAX), payload)
      .query(`
        IF EXISTS (SELECT 1 FROM dbo.KolaybiRawData WHERE CompanyId=@CompanyId AND EntityType=@EntityType AND ExternalId=@ExternalId)
          UPDATE dbo.KolaybiRawData SET Payload=@Payload, SyncedAt=SYSDATETIME() WHERE CompanyId=@CompanyId AND EntityType=@EntityType AND ExternalId=@ExternalId;
        ELSE
          INSERT INTO dbo.KolaybiRawData (CompanyId,EntityType,ExternalId,Payload,SyncedAt) VALUES (@CompanyId,@EntityType,@ExternalId,@Payload,SYSDATETIME());
      `);
    count++;
  }
  return count;
}

async function syncAll({ poolPromise, sql, companyId }) {
  const pool = await poolPromise;
  const api = await getApi(pool, sql, companyId);
  const result = { CompanyId: companyId, sources: {}, errors: [] };

  for (const [name, path, params] of ENDPOINTS) {
    try {
      const response = await getJson(api, path, params);
      const rows = Array.isArray(response?.data) ? response.data : [];
      result.sources[name] = await saveRaw(pool, sql, companyId, name, rows);
    } catch (err) {
      result.sources[name] = 0;
      result.errors.push(`${name}: ${err.message}`);
      console.error(`[KolayBi][FULL][Şirket ${companyId}] ${name}:`, err.message);
    }
  }

  // Her carinin tüm cari hareketlerini ayrıca al.
  try {
    const associates = await getJson(api, '/kolaybi/v1/associates', {});
    for (const associate of Array.isArray(associates?.data) ? associates.data : []) {
      const associateId = associate?.id;
      if (associateId === undefined || associateId === null) continue;
      try {
        const response = await getJson(api, `/kolaybi/v1/associates/${associateId}/transactions`);
        const data = response?.data?.transactionables || response?.data || [];
        const rows = Array.isArray(data) ? data : [];
        const saved = await saveRaw(pool, sql, companyId, 'associate_transactions', rows.map(x => ({ ...x, associate_id: associateId })));
        result.sources.associate_transactions = (result.sources.associate_transactions || 0) + saved;
      } catch (err) {
        result.errors.push(`associate_transactions/${associateId}: ${err.message}`);
      }
    }
  } catch (err) {
    result.errors.push(`associate_transactions: ${err.message}`);
  }

  // e-Belge/e-Fatura kayıtlarını şirket bazında mümkün olan iki yönde al.
  for (const direction of ['inbound', 'outbound']) {
    try {
      const companyIdFromKolaybi = null;
      const response = await getJson(api, '/kolaybi/v1/e_document/invoices', {
        company_id: companyIdFromKolaybi || companyId,
        direction
      });
      const rows = Array.isArray(response?.data) ? response.data : [];
      result.sources[`e_document_${direction}`] = await saveRaw(pool, sql, companyId, `e_document_${direction}`, rows);
    } catch (err) {
      result.sources[`e_document_${direction}`] = 0;
      result.errors.push(`e_document_${direction}: ${err.message}`);
    }
  }

  return result;
}

function install() {
  if (global.__alyaKolaybiFullSyncInstalled) return;
  global.__alyaKolaybiFullSyncInstalled = true;
  const app = global.__alyaErpApp;
  const poolPromise = global.__alyaErpPoolPromise;
  const sql = global.__alyaErpSql;
  if (!app || !poolPromise || !sql) return;

  app.post('/api/kolaybi/full-senkronize', async (req, res) => {
    const companyId = Number(storage.getStore()?.companyId || req.headers['x-company-id'] || 1);
    if (!COMPANY_IDS.has(companyId)) return res.status(400).json({ success: false, error: 'Geçersiz CompanyId', CompanyId: companyId });
    try {
      const result = await storage.run({ companyId }, () => syncAll({ poolPromise, sql, companyId }));
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ success: false, CompanyId: companyId, error: err.message });
    }
  });
}

module.exports = { syncAll, install };
