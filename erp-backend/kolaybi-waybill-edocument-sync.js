const { storage } = require('./company-context-hook');

const COMPANY_IDS = new Set([1, 2, 3]);
const DEFAULT_BASE_URL = 'https://ofis-api.kolaybi.com';
const running = new Set();

const text = (v) => v === undefined || v === null ? null : String(v).trim() || null;
const num = (v, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };

async function getApi(pool, sql, companyId) {
  const r = await pool.request().input('CompanyId', sql.Int, companyId).query(`
    SELECT TOP 1 ApiKey,Channel,BaseUrl,AccessToken,TokenGecerlilik,KolaybiCompanyId
    FROM dbo.KolaybiAyarlar WHERE CompanyId=@CompanyId AND IsActive=1 ORDER BY Id DESC
  `);
  const a = r.recordset[0];
  if (!a?.ApiKey || !a?.Channel) throw new Error(`Şirket ${companyId} için KolayBi API ayarı eksik.`);
  if (!a?.KolaybiCompanyId) throw new Error(`Şirket ${companyId} için KolaybiCompanyId tanımlı değil.`);
  const baseUrl = String(a.BaseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  if (a.AccessToken && a.TokenGecerlilik && new Date(a.TokenGecerlilik) > new Date()) {
    return { token:a.AccessToken, channel:String(a.Channel).trim(), baseUrl, kolaybiCompanyId:String(a.KolaybiCompanyId) };
  }
  const response = await fetch(`${baseUrl}/kolaybi/v1/access_token`, {
    method:'POST', headers:{Channel:String(a.Channel).trim(),'Content-Type':'application/json'}, body:JSON.stringify({api_key:a.ApiKey})
  });
  const raw = await response.text();
  let body = null; try { body = raw ? JSON.parse(raw) : null; } catch (_) {}
  if (!response.ok || !body?.data) throw new Error(`KolayBi token HTTP ${response.status}: ${body?.message || body?.error || raw}`);
  await pool.request().input('CompanyId',sql.Int,companyId).input('AccessToken',sql.NVarChar,body.data)
    .input('TokenGecerlilik',sql.DateTime2,new Date(Date.now()+23*60*60*1000))
    .query(`UPDATE dbo.KolaybiAyarlar SET AccessToken=@AccessToken,TokenGecerlilik=@TokenGecerlilik,UpdatedAt=SYSDATETIME() WHERE CompanyId=@CompanyId AND IsActive=1`);
  return { token:body.data, channel:String(a.Channel).trim(), baseUrl, kolaybiCompanyId:String(a.KolaybiCompanyId) };
}

async function getJson(api, path, params={}) {
  const url = new URL(`${api.baseUrl}${path}`);
  for (const [k,v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k,v);
  const response = await fetch(url.toString(), { headers:{Authorization:`Bearer ${api.token}`,Channel:api.channel,Accept:'application/json'} });
  const raw = await response.text();
  let body = null; try { body = raw ? JSON.parse(raw) : null; } catch (_) {}
  if (!response.ok) throw new Error(`KolayBi API HTTP ${response.status}: ${body?.message || body?.error || raw}`);
  return body || {};
}

function rowsOf(response) {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
}

async function upsert(pool, sql, companyId, row, direction) {
  const externalId = text(row?.document_id ?? row?.id ?? row?.uuid);
  const code = text(row?.no) || (externalId ? `KB-IRS-${externalId}` : null);
  if (!externalId || !code) return { skipped:1 };
  const yon = direction === 'inbound' ? 'Alış' : 'Satış';
  const date = row?.issue_date ? new Date(row.issue_date) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const total = num(row?.grand_total ?? row?.exchange_grand_total, 0);
  const note = text([row?.status, row?.scenario, row?.uuid].filter(Boolean).join(' | '));

  const existing = await pool.request().input('CompanyId',sql.Int,companyId).input('IrsaliyeKodu',sql.NVarChar,code)
    .query(`SELECT TOP 1 IrsaliyeId FROM dbo.Irsaliyeler WHERE CompanyId=@CompanyId AND IrsaliyeKodu=@IrsaliyeKodu ORDER BY IrsaliyeId DESC`);

  if (existing.recordset.length) {
    await pool.request().input('IrsaliyeId',sql.Int,existing.recordset[0].IrsaliyeId).input('Yon',sql.NVarChar,yon)
      .input('IrsaliyeTarihi',sql.DateTime2,safeDate).input('Notlar',sql.NVarChar,note).input('ToplamTutar',sql.Decimal(18,2),total)
      .query(`UPDATE dbo.Irsaliyeler SET Yon=@Yon,IrsaliyeTarihi=@IrsaliyeTarihi,Notlar=@Notlar,ToplamTutar=@ToplamTutar,UpdatedAt=SYSDATETIME() WHERE IrsaliyeId=@IrsaliyeId`);
    return { updated:1 };
  }

  await pool.request().input('CompanyId',sql.Int,companyId).input('IrsaliyeKodu',sql.NVarChar,code).input('Yon',sql.NVarChar,yon)
    .input('IrsaliyeTarihi',sql.DateTime2,safeDate).input('CariKodu',sql.NVarChar,null).input('CariAdi',sql.NVarChar,'KolayBi E-İrsaliye')
    .input('Notlar',sql.NVarChar,note).input('ToplamTutar',sql.Decimal(18,2),total)
    .query(`INSERT INTO dbo.Irsaliyeler (CompanyId,IrsaliyeKodu,Yon,IrsaliyeTarihi,CariKodu,CariAdi,Notlar,ToplamTutar,IsActive,CreatedAt,UpdatedAt) VALUES (@CompanyId,@IrsaliyeKodu,@Yon,@IrsaliyeTarihi,@CariKodu,@CariAdi,@Notlar,@ToplamTutar,1,SYSDATETIME(),SYSDATETIME())`);
  return { created:1 };
}

async function syncEDocumentWaybills({poolPromise,sql,companyId}) {
  if (running.has(companyId)) return { CompanyId:companyId, skipped:true };
  running.add(companyId);
  try {
    const pool = await poolPromise;
    const api = await getApi(pool,sql,companyId);
    const result = {
      CompanyId:companyId,
      KolaybiCompanyId:api.kolaybiCompanyId,
      received:0, created:0, updated:0, skipped:0, errors:0,
      sourceCounts:{inbound:0,outbound:0},
      diagnostics:{availableCompanies:[], companyIdMatch:null}
    };

    // Önce tokenın erişebildiği gerçek KolayBi şirketlerini kontrol et.
    // ALYA CompanyId ile KolayBi company_id aynı olmak zorunda değildir.
    try {
      const companiesResponse = await getJson(api,'/kolaybi/v1/companies');
      const companies = rowsOf(companiesResponse);
      result.diagnostics.availableCompanies = companies.map(c => ({
        id: c?.id ?? c?.company_id ?? c?.companyId ?? null,
        name: c?.name ?? c?.company_name ?? c?.title ?? null
      }));
      result.diagnostics.companyIdMatch = result.diagnostics.availableCompanies.some(c => String(c.id) === String(api.kolaybiCompanyId));
    } catch (e) {
      result.diagnostics.companiesError = e.message;
    }

    for (const direction of ['outbound','inbound']) {
      try {
        const response = await getJson(api,'/kolaybi/v1/e_document/waybills',{company_id:api.kolaybiCompanyId,direction});
        const rows = rowsOf(response);
        result.sourceCounts[direction] = rows.length;
        result.received += rows.length;
        for (const row of rows) {
          try {
            const r = await upsert(pool,sql,companyId,row,direction);
            result.created += r.created || 0;
            result.updated += r.updated || 0;
            result.skipped += r.skipped || 0;
          } catch (e) {
            result.errors++;
            console.error(`[KolayBi][E-İrsaliye][Şirket ${companyId}]`,e.message);
          }
        }
      } catch (e) {
        result.errors++;
        result.diagnostics[`${direction}Error`] = e.message;
      }
    }
    return result;
  } finally { running.delete(companyId); }
}

function install({app,poolPromise,sql}) {
  if (app.__alyaKolaybiEDocumentWaybillInstalled) return;
  app.__alyaKolaybiEDocumentWaybillInstalled = true;
  app.post('/api/kolaybi/e-irsaliye-senkronize', async (req,res) => {
    const companyId = Number(storage.getStore()?.companyId || req.headers['x-company-id'] || 1);
    if (!COMPANY_IDS.has(companyId)) return res.status(400).json({success:false,error:'Geçersiz CompanyId',CompanyId:companyId});
    try {
      const result = await storage.run({companyId}, () => syncEDocumentWaybills({poolPromise,sql,companyId}));
      res.json({success:true,...result});
    } catch (e) {
      console.error(`[KolayBi][E-İrsaliye][Şirket ${companyId}]`,e);
      res.status(500).json({success:false,error:e.message,CompanyId:companyId});
    }
  });
}

module.exports = { install, syncEDocumentWaybills };
