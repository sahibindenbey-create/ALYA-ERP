/* ALYA ERP - KolayBi -> ERP irsaliye aktarımı */
const { storage } = require('./company-context-hook');

const COMPANY_IDS = new Set([1, 2, 3]);
const DEFAULT_BASE_URL = 'https://ofis-api.kolaybi.com';
const running = new Set();

const pick = (row, keys, fallback = null) => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return fallback;
};
const text = (v) => v === undefined || v === null ? null : String(v).trim() || null;
const num = (v, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };

async function getToken(pool, sql, companyId) {
  const r = await pool.request().input('CompanyId', sql.Int, companyId).query(`
    SELECT TOP 1 ApiKey, Channel, BaseUrl, AccessToken, TokenGecerlilik
    FROM dbo.KolaybiAyarlar WHERE CompanyId=@CompanyId AND IsActive=1 ORDER BY Id DESC
  `);
  const a = r.recordset[0];
  if (!a?.ApiKey || !a?.Channel) throw new Error(`Şirket ${companyId} için KolayBi ayarı eksik.`);
  const baseUrl = a.BaseUrl || DEFAULT_BASE_URL;
  if (a.AccessToken && a.TokenGecerlilik && new Date(a.TokenGecerlilik) > new Date()) return { token:a.AccessToken, channel:a.Channel, baseUrl };
  const response = await fetch(`${baseUrl}/kolaybi/v1/access_token`, {
    method:'POST', headers:{Channel:a.Channel,'Content-Type':'application/json'}, body:JSON.stringify({api_key:a.ApiKey})
  });
  if (!response.ok) throw new Error(`KolayBi token HTTP ${response.status}`);
  const body = await response.json();
  if (!body?.data) throw new Error('KolayBi token cevabı boş.');
  await pool.request().input('CompanyId',sql.Int,companyId).input('AccessToken',sql.NVarChar,body.data)
    .input('TokenGecerlilik',sql.DateTime2,new Date(Date.now()+23*60*60*1000))
    .query(`UPDATE dbo.KolaybiAyarlar SET AccessToken=@AccessToken,TokenGecerlilik=@TokenGecerlilik,UpdatedAt=SYSDATETIME() WHERE CompanyId=@CompanyId AND IsActive=1`);
  return { token:body.data, channel:a.Channel, baseUrl };
}

async function apiJson(api, path, params={}) {
  const url = new URL(`${api.baseUrl}${path}`);
  Object.entries(params).forEach(([k,v]) => { if(v!==undefined&&v!==null&&v!=='') url.searchParams.set(k,v); });
  const response = await fetch(url.toString(), { headers:{Authorization:`Bearer ${api.token}`,Channel:api.channel,Accept:'application/json'} });
  if(!response.ok) throw new Error(`KolayBi API HTTP ${response.status}: ${await response.text().catch(()=> '')}`);
  return response.json();
}

function code(row) { return text(pick(row,['document_number','waybill_number','serial_no','number','code'])) || (pick(row,['id','document_id']) ? `KB-IRS-${pick(row,['id','document_id'])}` : null); }
function date(row) { const d = new Date(pick(row,['shipment_date','issue_date','document_date','date','created_at'],new Date())); return Number.isNaN(d.getTime()) ? new Date() : d; }
function direction(type,row) { const raw=String(pick(row,['type','invoice_type'],type)).toLowerCase(); return raw.includes('purchase') || raw.includes('alış') ? 'Alış' : 'Satış'; }
function associate(row) { const a=row?.associate||row?.customer||row?.supplier||row?.client||{}; return {code:text(typeof a==='string'?a:pick(a,['code','associate_code','customer_code','supplier_code','id'])),name:text(typeof a==='string'?null:pick(a,['name','title','company_name','trade_name','full_name']))}; }
function items(row) { const x=row?.products||row?.items||row?.lines||row?.details||row?.invoice_items||[]; return Array.isArray(x)?x:[]; }
function itemCode(i) { const p=i?.product||i?.stock||{}; return text(typeof p==='string'?p:pick(p,['code','sku','product_code','stock_code','id','product_id'])) || text(pick(i,['product_code','stock_code','sku','code','product_id'])) || 'KB-URUN'; }
function itemName(i) { const p=i?.product||i?.stock||{}; return text(typeof p==='string'?p:pick(p,['name','title','product_name','description'])) || text(pick(i,['product_name','name','description','title'])) || 'KolayBi Ürün'; }

async function upsertWaybill(pool,sql,companyId,type,row) {
  const externalId=text(pick(row,['id','document_id','commercial_doc_id','waybill_id','uuid']));
  const documentCode=code(row); if(!externalId||!documentCode) return {skipped:1};
  const car=associate(row); const yon=direction(type,row); const list=items(row);
  const total=num(pick(row,['grand_total','total','total_amount','amount'],list.reduce((s,i)=>s+num(pick(i,['grand_total','total','line_total','amount'],num(pick(i,['quantity','qty'],1))*num(pick(i,['unit_price','price'],0)))),0)));

  const existing=await pool.request().input('CompanyId',sql.Int,companyId).input('IrsaliyeKodu',sql.NVarChar,documentCode)
    .query(`SELECT TOP 1 IrsaliyeId FROM dbo.Irsaliyeler WHERE CompanyId=@CompanyId AND IrsaliyeKodu=@IrsaliyeKodu ORDER BY IrsaliyeId DESC`);
  let id;
  if(existing.recordset.length){
    id=existing.recordset[0].IrsaliyeId;
    await pool.request().input('IrsaliyeId',sql.Int,id).input('Yon',sql.NVarChar,yon).input('IrsaliyeTarihi',sql.DateTime2,date(row))
      .input('CariKodu',sql.NVarChar,car.code).input('CariAdi',sql.NVarChar,car.name||car.code||'KolayBi Cari')
      .input('Notlar',sql.NVarChar,text(pick(row,['description','note','notes'])))
      .input('ToplamTutar',sql.Decimal(18,2),total)
      .query(`UPDATE dbo.Irsaliyeler SET Yon=@Yon,IrsaliyeTarihi=@IrsaliyeTarihi,CariKodu=@CariKodu,CariAdi=@CariAdi,Notlar=@Notlar,ToplamTutar=@ToplamTutar,UpdatedAt=SYSDATETIME() WHERE IrsaliyeId=@IrsaliyeId`);
    await pool.request().input('IrsaliyeId',sql.Int,id).query('DELETE FROM dbo.IrsaliyeDetay WHERE IrsaliyeId=@IrsaliyeId');
  } else {
    const r=await pool.request().input('CompanyId',sql.Int,companyId).input('IrsaliyeKodu',sql.NVarChar,documentCode).input('Yon',sql.NVarChar,yon)
      .input('IrsaliyeTarihi',sql.DateTime2,date(row)).input('CariKodu',sql.NVarChar,car.code).input('CariAdi',sql.NVarChar,car.name||car.code||'KolayBi Cari')
      .input('Notlar',sql.NVarChar,text(pick(row,['description','note','notes']))).input('ToplamTutar',sql.Decimal(18,2),total)
      .query(`INSERT INTO dbo.Irsaliyeler (CompanyId,IrsaliyeKodu,Yon,IrsaliyeTarihi,CariKodu,CariAdi,Notlar,ToplamTutar,IsActive,CreatedAt,UpdatedAt) OUTPUT INSERTED.IrsaliyeId VALUES (@CompanyId,@IrsaliyeKodu,@Yon,@IrsaliyeTarihi,@CariKodu,@CariAdi,@Notlar,@ToplamTutar,1,SYSDATETIME(),SYSDATETIME())`);
    id=r.recordset[0].IrsaliyeId;
  }
  for(const i of list){
    const qty=num(pick(i,['quantity','qty','amount','count'],1));
    const price=num(pick(i,['unit_price','price','unit_amount'],0));
    const line=num(pick(i,['grand_total','total','line_total','amount'],qty*price));
    await pool.request().input('CompanyId',sql.Int,companyId).input('IrsaliyeId',sql.Int,id).input('UrunKodu',sql.NVarChar,itemCode(i)).input('UrunAdi',sql.NVarChar,itemName(i))
      .input('Miktar',sql.Decimal(18,2),qty).input('Birim',sql.NVarChar,text(pick(i,['unit','unit_name','uom'],'Adet'))||'Adet').input('BirimFiyat',sql.Decimal(18,2),price).input('SatirToplam',sql.Decimal(18,2),line)
      .query(`INSERT INTO dbo.IrsaliyeDetay (CompanyId,IrsaliyeId,UrunKodu,UrunAdi,Miktar,Birim,BirimFiyat,SatirToplam,CreatedAt) VALUES (@CompanyId,@IrsaliyeId,@UrunKodu,@UrunAdi,@Miktar,@Birim,@BirimFiyat,@SatirToplam,SYSDATETIME())`);
  }
  return {created:existing.recordset.length?0:1,updated:existing.recordset.length?1:0,skipped:0};
}

async function syncWaybills({poolPromise,sql,companyId}) {
  if(running.has(companyId)) return {CompanyId:companyId,skipped:true}; running.add(companyId);
  try { const pool=await poolPromise; const api=await getToken(pool,sql,companyId); const totals={CompanyId:companyId,created:0,updated:0,skipped:0,errors:0};
    for(const type of ['sale_waybill','purchase_waybill']){
      const response=await apiJson(api,'/kolaybi/v1/invoices',{type,has_products:true}); const rows=Array.isArray(response?.data)?response.data:[];
      for(const row of rows){try{const r=await upsertWaybill(pool,sql,companyId,type,row); totals.created+=r.created||0; totals.updated+=r.updated||0; totals.skipped+=r.skipped||0;}catch(e){totals.errors++;console.error(`[KolayBi][İrsaliye][Şirket ${companyId}]`,e.message);}}
    }
    return totals;
  } finally { running.delete(companyId); }
}

function install({app,poolPromise,sql}){
  if(app.__alyaKolaybiWaybillSyncInstalled) return; app.__alyaKolaybiWaybillSyncInstalled=true;
  app.post('/api/kolaybi/irsaliye-senkronize',async(req,res)=>{const companyId=Number(storage.getStore()?.companyId||req.headers['x-company-id']||1);if(!COMPANY_IDS.has(companyId))return res.status(400).json({success:false,error:'Geçersiz CompanyId',CompanyId:companyId});try{const result=await storage.run({companyId},()=>syncWaybills({poolPromise,sql,companyId}));res.json({success:true,...result});}catch(e){console.error(`[KolayBi][İrsaliye][Şirket ${companyId}]`,e);res.status(500).json({success:false,error:e.message,CompanyId:companyId});}});
}
module.exports={install,syncWaybills};
