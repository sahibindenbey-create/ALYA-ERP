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
  const baseUrl = String(a.BaseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  if (a.AccessToken && a.TokenGecerlilik && new Date(a.TokenGecerlilik) > new Date()) {
    return { token:a.AccessToken, channel:String(a.Channel).trim(), baseUrl, kolaybiCompanyId:text(a.KolaybiCompanyId) };
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
  return { token:body.data, channel:String(a.Channel).trim(), baseUrl, kolaybiCompanyId:text(a.KolaybiCompanyId) };
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
  if (Array.isArray(response?.data?.items)) return response.data.items;
  if (Array.isArray(response?.data?.results)) return response.data.results;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.results)) return response.results;
  return [];
}

function pick(row, keys, fallback = null) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return fallback;
}

function code(row) {
  const header = row?.header || {};
  return text(pick(header,['serial_no','waybill_number','document_number','number','code']))
    || text(pick(row,['document_number','waybill_number','serial_no','number','code']))
    || (pick(row,['commercial_doc_id','id','document_id','waybill_id']) ? `KB-IRS-${pick(row,['commercial_doc_id','id','document_id','waybill_id'])}` : null);
}

function date(row) {
  const header = row?.header || {};
  const d = new Date(pick(header,['shipment_date','issue_date','document_date','date'],pick(row,['shipment_date','issue_date','document_date','date','created_at'],new Date())));
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function direction(type,row) {
  const raw = String(pick(row?.commercial_doc_type || {},['value','key','description'],pick(row,['type','invoice_type'],type))).toLowerCase();
  return raw.includes('purchase') || raw.includes('alış') || raw.includes('alis') ? 'Alış' : 'Satış';
}

function associate(row) {
  const header = row?.header || {};
  const a = header.associate || row?.associate || row?.customer || row?.supplier || row?.client || {};
  return {
    code: text(typeof a==='string' ? a : pick(a,['code','associate_code','customer_code','supplier_code','id','identity_no'])),
    name: text(typeof a==='string' ? null : pick(a,['full_name','name','title','company_name','trade_name']))
  };
}

function items(row) {
  const x = row?.lines || row?.products || row?.items || row?.details || row?.invoice_items || [];
  return Array.isArray(x) ? x : [];
}

function itemCode(i) {
  const p=i?.product||i?.stock||{};
  return text(typeof p==='string'?p:pick(p,['code','sku','product_code','stock_code','id','product_id']))
    || text(pick(i,['product_code','stock_code','sku','code','product_id'])) || 'KB-URUN';
}

function itemName(i) {
  const p=i?.product||i?.stock||{};
  return text(typeof p==='string'?p:pick(p,['name','title','product_name','description']))
    || text(pick(i,['product_name','name','description','title'])) || 'KolayBi Ürün';
}

async function upsert(pool, sql, companyId, row, directionValue) {
  const externalId = text(row?.commercial_doc_id ?? row?.id ?? row?.document_id ?? row?.waybill_id ?? row?.uuid);
  const documentCode = code(row);
  if (!externalId || !documentCode) return {skipped:1};

  const car = associate(row);
  const totalBlock = row?.total || {};
  const total = num(pick(totalBlock,['grand_total','total_amount','amount'],pick(row,['grand_total','total','total_amount','amount'],0)));
  const note = text(pick(row?.header||{},['description','note','notes']) || pick(row,['description','note','notes']));
  const list = items(row);

  const existing = await pool.request().input('CompanyId',sql.Int,companyId).input('IrsaliyeKodu',sql.NVarChar,documentCode)
    .query(`SELECT TOP 1 IrsaliyeId FROM dbo.Irsaliyeler WHERE CompanyId=@CompanyId AND IrsaliyeKodu=@IrsaliyeKodu ORDER BY IrsaliyeId DESC`);

  let id;
  if (existing.recordset.length) {
    id = existing.recordset[0].IrsaliyeId;
    await pool.request().input('IrsaliyeId',sql.Int,id).input('Yon',sql.NVarChar,directionValue)
      .input('IrsaliyeTarihi',sql.DateTime2,date(row)).input('CariKodu',sql.NVarChar,car.code)
      .input('CariAdi',sql.NVarChar,car.name||car.code||'KolayBi Cari').input('Notlar',sql.NVarChar,note)
      .input('ToplamTutar',sql.Decimal(18,2),total)
      .query(`UPDATE dbo.Irsaliyeler SET Yon=@Yon,IrsaliyeTarihi=@IrsaliyeTarihi,CariKodu=@CariKodu,CariAdi=@CariAdi,Notlar=@Notlar,ToplamTutar=@ToplamTutar,UpdatedAt=SYSDATETIME() WHERE IrsaliyeId=@IrsaliyeId`);
    await pool.request().input('IrsaliyeId',sql.Int,id).query('DELETE FROM dbo.IrsaliyeDetay WHERE IrsaliyeId=@IrsaliyeId');
  } else {
    const r = await pool.request().input('CompanyId',sql.Int,companyId).input('IrsaliyeKodu',sql.NVarChar,documentCode).input('Yon',sql.NVarChar,directionValue)
      .input('IrsaliyeTarihi',sql.DateTime2,date(row)).input('CariKodu',sql.NVarChar,car.code).input('CariAdi',sql.NVarChar,car.name||car.code||'KolayBi Cari')
      .input('Notlar',sql.NVarChar,note).input('ToplamTutar',sql.Decimal(18,2),total)
      .query(`INSERT INTO dbo.Irsaliyeler (CompanyId,IrsaliyeKodu,Yon,IrsaliyeTarihi,CariKodu,CariAdi,Notlar,ToplamTutar,IsActive,CreatedAt,UpdatedAt) OUTPUT INSERTED.IrsaliyeId VALUES (@CompanyId,@IrsaliyeKodu,@Yon,@IrsaliyeTarihi,@CariKodu,@CariAdi,@Notlar,@ToplamTutar,1,SYSDATETIME(),SYSDATETIME())`);
    id = r.recordset[0].IrsaliyeId;
  }

  for (const i of list) {
    const qty=num(pick(i,['quantity','qty','amount','count'],1));
    const price=num(pick(i,['unit_price','price','unit_amount'],0));
    const line=num(pick(i,['grand_total','total','line_total','amount'],qty*price));
    await pool.request().input('CompanyId',sql.Int,companyId).input('IrsaliyeId',sql.Int,id).input('UrunKodu',sql.NVarChar,itemCode(i)).input('UrunAdi',sql.NVarChar,itemName(i))
      .input('Miktar',sql.Decimal(18,2),qty).input('Birim',sql.NVarChar,text(pick(i,['unit','unit_name','uom'],'Adet'))||'Adet').input('BirimFiyat',sql.Decimal(18,2),price).input('SatirToplam',sql.Decimal(18,2),line)
      .query(`INSERT INTO dbo.IrsaliyeDetay (CompanyId,IrsaliyeId,UrunKodu,UrunAdi,Miktar,Birim,BirimFiyat,SatirToplam,CreatedAt) VALUES (@CompanyId,@IrsaliyeId,@UrunKodu,@UrunAdi,@Miktar,@Birim,@BirimFiyat,@SatirToplam,SYSDATETIME())`);
  }
  return {created:existing.recordset.length?0:1,updated:existing.recordset.length?1:0,skipped:0};
}

async function syncEDocumentWaybills({poolPromise,sql,companyId}) {
  if (running.has(companyId)) return {CompanyId:companyId,skipped:true};
  running.add(companyId);
  try {
    const pool = await poolPromise;
    const api = await getApi(pool,sql,companyId);
    const result = {
      CompanyId:companyId,
      KolaybiCompanyId:api.kolaybiCompanyId,
      received:0, created:0, updated:0, skipped:0, errors:0,
      sourceCounts:{sale_waybill:0,purchase_waybill:0},
      diagnostics:{availableCompanies:[], companyIdMatch:null}
    };

    // İrsaliyeler için çalışan KolayBi endpoint'i kullanılır.
    // E-Document/waybills endpoint'i farklı bir şirket bağlamı beklediği için
    // genel KolayBi senkronizasyonundaki invoices endpoint'iyle aynı akış kullanılır.
    for (const type of ['sale_waybill','purchase_waybill']) {
      try {
        const response = await getJson(api,'/kolaybi/v1/invoices',{type,has_products:true});
        const rows = rowsOf(response);
        result.sourceCounts[type] = rows.length;
        result.received += rows.length;
        const directionValue = type === 'purchase_waybill' ? 'Alış' : 'Satış';
        for (const row of rows) {
          try {
            const r = await upsert(pool,sql,companyId,row,directionValue);
            result.created += r.created || 0;
            result.updated += r.updated || 0;
            result.skipped += r.skipped || 0;
          } catch (e) {
            result.errors++;
            console.error(`[KolayBi][İrsaliye][Şirket ${companyId}]`,e.message);
          }
        }
      } catch (e) {
        result.errors++;
        result.diagnostics[`${type}Error`] = e.message;
      }
    }

    // Teşhis bilgisi sadece bilgilendirme amaçlıdır; senkronizasyonu şirket ID'sine bağlamaz.
    try {
      const companiesResponse = await getJson(api,'/kolaybi/v1/companies');
      const companies = rowsOf(companiesResponse);
      result.diagnostics.availableCompanies = companies.map(c => ({
        id: c?.id ?? c?.company_id ?? c?.companyId ?? null,
        name: c?.name ?? c?.company_name ?? c?.title ?? null
      }));
      result.diagnostics.companyIdMatch = api.kolaybiCompanyId
        ? result.diagnostics.availableCompanies.some(c => String(c.id) === String(api.kolaybiCompanyId))
        : null;
    } catch (e) {
      result.diagnostics.companiesError = e.message;
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
      console.error(`[KolayBi][İrsaliye][Şirket ${companyId}]`,e);
      res.status(500).json({success:false,error:e.message,CompanyId:companyId});
    }
  });
}

module.exports = { install, syncEDocumentWaybills };
