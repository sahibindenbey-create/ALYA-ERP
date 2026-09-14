const { storage } = require('./company-context-hook');

const COMPANY_IDS = new Set([1, 2, 3]);
const DEFAULT_BASE_URL = 'https://ofis-api.kolaybi.com';

const text = v => v === undefined || v === null ? null : String(v).trim() || null;

async function getApi(pool, sql, companyId) {
  const result = await pool.request()
    .input('CompanyId', sql.Int, companyId)
    .query(`SELECT TOP 1 ApiKey,Channel,BaseUrl,AccessToken,TokenGecerlilik FROM dbo.KolaybiAyarlar WHERE CompanyId=@CompanyId AND IsActive=1 ORDER BY Id DESC`);
  const row = result.recordset[0];
  if (!row?.ApiKey || !row?.Channel) throw new Error(`Şirket ${companyId} için KolayBi API ayarı eksik.`);
  const baseUrl = String(row.BaseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '').replace(/\/kolaybi\/v1$/i, '');
  if (row.AccessToken && row.TokenGecerlilik && new Date(row.TokenGecerlilik) > new Date()) {
    return { token: row.AccessToken, channel: String(row.Channel).trim(), baseUrl };
  }
  const response = await fetch(`${baseUrl}/kolaybi/v1/access_token`, {
    method: 'POST',
    headers: { Channel: String(row.Channel).trim(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: row.ApiKey })
  });
  const raw = await response.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch (_) {}
  if (!response.ok || !body?.data) throw new Error(`KolayBi token HTTP ${response.status}: ${body?.message || body?.error || raw || 'yanıt boş'}`);
  const token = body.data;
  await pool.request()
    .input('CompanyId', sql.Int, companyId)
    .input('AccessToken', sql.NVarChar, token)
    .input('TokenGecerlilik', sql.DateTime2, new Date(Date.now() + 23 * 60 * 60 * 1000))
    .query(`UPDATE dbo.KolaybiAyarlar SET AccessToken=@AccessToken,TokenGecerlilik=@TokenGecerlilik,UpdatedAt=SYSDATETIME() WHERE CompanyId=@CompanyId AND IsActive=1`);
  return { token, channel: String(row.Channel).trim(), baseUrl };
}

async function callApi(api, path, method = 'GET', body) {
  const options = {
    method,
    headers: { Authorization: `Bearer ${api.token}`, Channel: api.channel, Accept: 'application/json' }
  };
  if (body) {
    options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    options.body = body;
  }
  const response = await fetch(`${api.baseUrl}${path}`, options);
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch (_) {}
  if (!response.ok) throw new Error(`KolayBi API HTTP ${response.status}: ${data?.message || data?.error || raw || 'yanıt boş'}`);
  return data || {};
}

async function localInvoice(pool, sql, companyId, faturaId) {
  const result = await pool.request()
    .input('CompanyId', sql.Int, companyId)
    .input('FaturaId', sql.Int, faturaId)
    .query(`SELECT TOP 1 * FROM dbo.Faturalar WHERE CompanyId=@CompanyId AND FaturaId=@FaturaId AND IsActive=1`);
  const invoice = result.recordset[0];
  if (!invoice) throw new Error('Fatura bulunamadı.');
  if (!invoice.KolaybiExternalId) throw new Error('Faturanın KolayBi document_id eşlemesi yok.');
  return invoice;
}

async function syncStatus({ poolPromise, sql, companyId, faturaId }) {
  const pool = await poolPromise;
  const invoice = await localInvoice(pool, sql, companyId, faturaId);
  const api = await getApi(pool, sql, companyId);
  const result = await callApi(api, `/kolaybi/v1/invoices/${encodeURIComponent(invoice.KolaybiExternalId)}?include_draft=true`);
  const data = result?.data || result;
  await pool.request()
    .input('CompanyId', sql.Int, companyId)
    .input('FaturaId', sql.Int, faturaId)
    .input('KolaybiDurum', sql.NVarChar, text(data.status))
    .input('EtTN', sql.NVarChar, text(data.uuid))
    .input('KolaybiFaturaNo', sql.NVarChar, text(data.no))
    .input('EbelgeSenaryo', sql.NVarChar, text(data.scenario))
    .query(`UPDATE dbo.Faturalar SET KolaybiDurum=@KolaybiDurum,KolaybiEtTN=COALESCE(@EtTN,KolaybiEtTN),KolaybiFaturaNo=COALESCE(@KolaybiFaturaNo,KolaybiFaturaNo),EbelgeSenaryo=COALESCE(@EbelgeSenaryo,EbelgeSenaryo),UpdatedAt=SYSDATETIME() WHERE CompanyId=@CompanyId AND FaturaId=@FaturaId`);
  return { status: data.status || null, uuid: data.uuid || null, no: data.no || null, scenario: data.scenario || null };
}

async function remoteAction({ poolPromise, sql, companyId, faturaId, action, vaultId }) {
  const pool = await poolPromise;
  const invoice = await localInvoice(pool, sql, companyId, faturaId);
  const api = await getApi(pool, sql, companyId);
  let result;
  if (action === 'resend') {
    result = await callApi(api, `/kolaybi/v1/invoices/resend/${encodeURIComponent(invoice.KolaybiExternalId)}`, 'POST');
  } else if (action === 'cancel') {
    const form = new URLSearchParams();
    form.append('document_id', String(invoice.KolaybiExternalId));
    result = await callApi(api, '/kolaybi/v1/invoices/e-document/cancel', 'POST', form);
  } else if (action === 'delete') {
    result = await callApi(api, `/kolaybi/v1/invoices/${encodeURIComponent(invoice.KolaybiExternalId)}`, 'DELETE');
    await pool.request()
      .input('CompanyId', sql.Int, companyId)
      .input('FaturaId', sql.Int, faturaId)
      .query(`UPDATE dbo.Faturalar SET IsActive=0,UpdatedAt=SYSDATETIME() WHERE CompanyId=@CompanyId AND FaturaId=@FaturaId`);
  } else if (action === 'proceed') {
    if (!vaultId) throw new Error('Tahsilat için vault_id zorunludur.');
    const form = new URLSearchParams();
    form.append('document_id', String(invoice.KolaybiExternalId));
    form.append('vault_id', String(vaultId));
    result = await callApi(api, '/kolaybi/v1/invoices/proceed', 'POST', form);
  } else {
    throw new Error('Geçersiz KolayBi fatura işlemi.');
  }
  return result;
}

function install({ app, poolPromise, sql }) {
  if (app.__alyaKolaybiInvoiceActionsInstalled) return;
  app.__alyaKolaybiInvoiceActionsInstalled = true;

  const company = req => Number(storage.getStore()?.companyId || req.headers['x-company-id'] || 1);

  app.post('/api/kolaybi/faturalar/:id/sync-status', async (req, res) => {
    const companyId = company(req);
    if (!COMPANY_IDS.has(companyId)) return res.status(400).json({ success: false, error: 'Geçersiz CompanyId' });
    try {
      const result = await storage.run({ companyId }, () => syncStatus({ poolPromise, sql, companyId, faturaId: Number(req.params.id) }));
      res.json({ success: true, CompanyId: companyId, ...result });
    } catch (err) {
      res.status(400).json({ success: false, CompanyId: companyId, error: err.message });
    }
  });

  app.post('/api/kolaybi/faturalar/:id/islem', async (req, res) => {
    const companyId = company(req);
    if (!COMPANY_IDS.has(companyId)) return res.status(400).json({ success: false, error: 'Geçersiz CompanyId' });
    try {
      const result = await storage.run({ companyId }, () => remoteAction({ poolPromise, sql, companyId, faturaId: Number(req.params.id), action: String(req.body?.action || ''), vaultId: req.body?.vaultId }));
      res.json({ success: true, CompanyId: companyId, ...result });
    } catch (err) {
      console.error(`[KolayBi][Fatura işlem][Şirket ${companyId}]`, err.message);
      res.status(400).json({ success: false, CompanyId: companyId, error: err.message });
    }
  });
}

module.exports = { install, syncStatus, remoteAction };
