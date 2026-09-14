/* ALYA ERP - KolayBi outbound e-document gateway */
const { storage } = require('./company-context-hook');

const COMPANY_IDS = new Set([1, 2, 3]);
const DEFAULT_BASE_URL = 'https://ofis-api.kolaybi.com';

function text(v) { return v === undefined || v === null ? null : String(v).trim() || null; }
function num(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function dateOnly(v) {
  const d = new Date(v || new Date());
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

async function getToken(pool, sql, companyId) {
  const result = await pool.request()
    .input('CompanyId', sql.Int, companyId)
    .query(`SELECT TOP 1 ApiKey,Channel,BaseUrl,AccessToken,TokenGecerlilik FROM dbo.KolaybiAyarlar WHERE CompanyId=@CompanyId AND IsActive=1 ORDER BY Id DESC`);
  const ayar = result.recordset[0];
  if (!ayar?.ApiKey || !ayar?.Channel) throw new Error(`Şirket ${companyId} için KolayBi API ayarı eksik.`);
  const baseUrl = String(ayar.BaseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '').replace(/\/kolaybi\/v1$/i, '');
  if (ayar.AccessToken && ayar.TokenGecerlilik && new Date(ayar.TokenGecerlilik) > new Date()) {
    return { token: ayar.AccessToken, channel: String(ayar.Channel).trim(), baseUrl };
  }
  const response = await fetch(`${baseUrl}/kolaybi/v1/access_token`, {
    method: 'POST',
    headers: { Channel: String(ayar.Channel).trim(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: ayar.ApiKey })
  });
  const raw = await response.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch (_) {}
  if (!response.ok || !body?.data) {
    throw new Error(`KolayBi token HTTP ${response.status}: ${body?.message || body?.error || raw || 'yanıt boş'}`);
  }
  const token = body.data;
  await pool.request()
    .input('CompanyId', sql.Int, companyId)
    .input('AccessToken', sql.NVarChar, token)
    .input('TokenGecerlilik', sql.DateTime2, new Date(Date.now() + 23 * 60 * 60 * 1000))
    .query(`UPDATE dbo.KolaybiAyarlar SET AccessToken=@AccessToken,TokenGecerlilik=@TokenGecerlilik,UpdatedAt=SYSDATETIME() WHERE CompanyId=@CompanyId AND IsActive=1`);
  return { token, channel: String(ayar.Channel).trim(), baseUrl };
}

async function callApi(api, path, options = {}) {
  const response = await fetch(`${api.baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${api.token}`,
      Channel: api.channel,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {})
    },
    body: options.body || undefined
  });
  const raw = await response.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch (_) {}
  if (!response.ok) throw new Error(`KolayBi API HTTP ${response.status}: ${body?.message || body?.error || raw || 'yanıt boş'}`);
  return body || {};
}

async function mapping(pool, sql, companyId, resourceTypes, alyaTable, alyaId) {
  const typeList = resourceTypes.map((_, i) => `@rt${i}`).join(',');
  const request = pool.request().input('CompanyId', sql.Int, companyId).input('AlyaTable', sql.NVarChar, alyaTable).input('AlyaId', sql.BigInt, alyaId);
  resourceTypes.forEach((v, i) => request.input(`rt${i}`, sql.NVarChar, v));
  const result = await request.query(`SELECT TOP 1 ExternalId FROM dbo.KolaybiBusinessMappings WHERE CompanyId=@CompanyId AND AlyaTable=@AlyaTable AND AlyaId=@AlyaId AND ResourceType IN (${typeList}) ORDER BY MappingId DESC`);
  return text(result.recordset[0]?.ExternalId);
}

async function resolveContact(pool, sql, companyId, fatura) {
  const cariId = fatura.CariId;
  if (!cariId) throw new Error('Fatura için CariId bulunamadı. Güncel cari/fatura ilişki migrationları gerekli.');
  const externalId = await mapping(pool, sql, companyId, ['associate', 'associates', 'contact', 'customer'], 'CariListesi', cariId);
  if (!externalId) throw new Error(`Cari ${fatura.CariKodu || cariId} için KolayBi associate/contact eşlemesi yok.`);
  const addressId = await mapping(pool, sql, companyId, ['associate_address', 'address', 'contact_address', 'customer_address'], 'CariListesi', cariId);
  if (!addressId) throw new Error(`Cari ${fatura.CariKodu || cariId} için KolayBi fatura adresi eşlemesi yok.`);
  return { contactId: Number(externalId), addressId: Number(addressId) };
}

async function resolveProduct(pool, sql, companyId, item) {
  const result = await pool.request()
    .input('CompanyId', sql.Int, companyId)
    .input('UrunKodu', sql.NVarChar, item.UrunKodu)
    .query(`SELECT TOP 1 UrunId,UrunKodu,UrunAdi,Birim FROM dbo.Urunler WHERE CompanyId=@CompanyId AND UrunKodu=@UrunKodu ORDER BY UrunId DESC`);
  const urun = result.recordset[0];
  if (!urun) throw new Error(`Ürün bulunamadı: ${item.UrunKodu}`);
  const externalId = await mapping(pool, sql, companyId, ['product', 'products'], 'Urunler', urun.UrunId);
  if (!externalId) throw new Error(`Ürün ${urun.UrunKodu} için KolayBi product eşlemesi yok.`);
  return Number(externalId);
}

async function getInvoice(pool, sql, companyId, faturaId) {
  const header = await pool.request()
    .input('CompanyId', sql.Int, companyId)
    .input('FaturaId', sql.Int, faturaId)
    .query(`SELECT TOP 1 * FROM dbo.Faturalar WHERE CompanyId=@CompanyId AND FaturaId=@FaturaId AND IsActive=1`);
  const fatura = header.recordset[0];
  if (!fatura) throw new Error('Fatura bulunamadı.');
  const detail = await pool.request()
    .input('CompanyId', sql.Int, companyId)
    .input('FaturaId', sql.Int, faturaId)
    .query(`SELECT * FROM dbo.FaturaDetay WHERE CompanyId=@CompanyId AND FaturaId=@FaturaId ORDER BY FaturaDetayId`);
  if (!detail.recordset.length) throw new Error('Faturada gönderilecek ürün satırı yok.');
  return { fatura, items: detail.recordset };
}

async function sendEDocument({ poolPromise, sql, companyId, faturaId, scenario, prefix }) {
  const pool = await poolPromise;
  const { fatura, items } = await getInvoice(pool, sql, companyId, faturaId);
  if (fatura.Yon !== 'Satış') throw new Error('İlk KolayBi e-belge bağlantısı satış faturaları için açıldı.');
  if (text(fatura.KolaybiExternalId)) {
    return { alreadySent: true, faturaId, kolaybiExternalId: fatura.KolaybiExternalId };
  }

  const api = await getToken(pool, sql, companyId);
  const contact = await resolveContact(pool, sql, companyId, fatura);
  const productItems = [];
  for (const item of items) {
    productItems.push({
      productId: await resolveProduct(pool, sql, companyId, item),
      quantity: num(item.Miktar, 1),
      unitPrice: num(item.BirimFiyat, 0),
      vatRate: num(item.KdvOrani, 20),
      description: text(item.UrunAdi)
    });
  }

  const form = new URLSearchParams();
  form.append('contact_id', String(contact.contactId));
  form.append('address_id', String(contact.addressId));
  form.append('order_date', dateOnly(fatura.FaturaTarihi));
  form.append('currency', String(fatura.ParaBirimi || 'TRY').toLowerCase());
  form.append('type', 'sale_invoice');
  form.append('document_scenario', scenario || 'TICARIFATURA');
  form.append('document_type', 'SATIS');
  if (fatura.FaturaKodu) form.append('serial_no', String(fatura.FaturaKodu));
  if (fatura.VadeTarihi) form.append('due_date', dateOnly(fatura.VadeTarihi));
  for (let i = 0; i < productItems.length; i += 1) {
    const item = productItems[i];
    form.append(`items[${i}][product_id]`, String(item.productId));
    form.append(`items[${i}][quantity]`, item.quantity.toFixed(2));
    form.append(`items[${i}][unit_price]`, item.unitPrice.toFixed(2));
    form.append(`items[${i}][vat_rate]`, String(item.vatRate));
    if (item.description) form.append(`items[${i}][description]`, item.description);
  }

  const created = await callApi(api, '/kolaybi/v1/invoices', { method: 'POST', body: form });
  const documentId = created?.data?.id ?? created?.data?.document_id ?? created?.id;
  if (!documentId) throw new Error('KolayBi fatura oluşturdu fakat document_id dönmedi.');

  const eform = new URLSearchParams();
  eform.append('document_id', String(documentId));
  if (prefix) eform.append('prefix', prefix);
  const eDocument = await callApi(api, '/kolaybi/v1/invoices/e-document/create', { method: 'POST', body: eform });
  const data = eDocument?.data || {};
  const externalId = text(data.document_id || documentId);

  if (!externalId) throw new Error('KolayBi e-belge yanıtında document_id yok.');
  await pool.request()
    .input('CompanyId', sql.Int, companyId)
    .input('FaturaId', sql.Int, faturaId)
    .input('KolaybiExternalId', sql.NVarChar, externalId)
    .input('EtTN', sql.NVarChar, text(data.uuid))
    .input('KolaybiFaturaNo', sql.NVarChar, text(data.no))
    .input('KolaybiDurum', sql.NVarChar, text(data.status))
    .input('EbelgeSenaryo', sql.NVarChar, text(data.scenario || scenario))
    .query(`UPDATE dbo.Faturalar SET KolaybiExternalId=@KolaybiExternalId,KolaybiEtTN=@EtTN,KolaybiFaturaNo=@KolaybiFaturaNo,KolaybiDurum=@KolaybiDurum,EbelgeSenaryo=@EbelgeSenaryo,UpdatedAt=SYSDATETIME() WHERE CompanyId=@CompanyId AND FaturaId=@FaturaId`);

  return { sent: true, faturaId, kolaybiExternalId: externalId, uuid: data.uuid || null, no: data.no || null, status: data.status || null, scenario: data.scenario || scenario };
}

function install({ app, poolPromise, sql }) {
  if (app.__alyaKolaybiEDocumentInstalled) return;
  app.__alyaKolaybiEDocumentInstalled = true;
  app.post('/api/kolaybi/faturalar/:id/e-belge-gonder', async (req, res) => {
    const companyId = Number(storage.getStore()?.companyId || req.headers['x-company-id'] || 1);
    if (!COMPANY_IDS.has(companyId)) return res.status(400).json({ success: false, error: 'Geçersiz CompanyId' });
    try {
      const result = await storage.run({ companyId }, () => sendEDocument({ poolPromise, sql, companyId, faturaId: Number(req.params.id), scenario: req.body?.scenario, prefix: req.body?.prefix }));
      res.json({ success: true, CompanyId: companyId, ...result });
    } catch (err) {
      console.error(`[KolayBi][E-Belge][Şirket ${companyId}]`, err.message);
      res.status(400).json({ success: false, CompanyId: companyId, error: err.message });
    }
  });
}

module.exports = { install, sendEDocument };
