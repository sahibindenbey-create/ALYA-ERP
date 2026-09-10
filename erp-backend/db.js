const sql = require('mssql');
const express = require('express');
const { AsyncLocalStorage } = require('async_hooks');
require('dotenv').config();

const companyContext = new AsyncLocalStorage();

function resolveCompanyId(req) {
  const value = req.headers['x-company-id'] ?? req.body?.CompanyId ?? req.query?.CompanyId ?? 1;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : 1;
}

function isProtectedLegacyAdminRequest(req) {
  if (req.method === 'OPTIONS') return false;
  const path = String(req.url || '').split('?')[0];
  return path === '/api/auth/register' || path.startsWith('/api/auth/kullanicilar');
}

async function authorizeLegacyAdmin(req, res, companyId) {
  const { verifySessionToken, loadSecurityContext } = require('./core/security');
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const payload = verifySessionToken(token);
  const context = await loadSecurityContext(poolPromise, sql, payload.sub, companyId);
  if (!context) {
    res.statusCode = 403; res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ success:false, error:'Bu şirkete erişim yetkiniz yok.' })); return false;
  }
  if (!context.permissions.has('core.user.manage') && !context.permissions.has('core.admin')) {
    res.statusCode = 403; res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ success:false, error:'Kullanıcı yönetimi yetkisi gerekli.' })); return false;
  }
  req.auth = context; return true;
}

const originalHandle = express.application.handle;
express.application.handle = function patchedHandle(req, res, callback) {
  const companyId = resolveCompanyId(req);
  return companyContext.run({ companyId }, () => {
    if (!isProtectedLegacyAdminRequest(req)) return originalHandle.call(this, req, res, callback);
    authorizeLegacyAdmin(req, res, companyId)
      .then((allowed) => { if (allowed) originalHandle.call(this, req, res, callback); })
      .catch((error) => {
        res.statusCode=401; res.setHeader('Content-Type','application/json; charset=utf-8');
        res.end(JSON.stringify({success:false,error:error.message||'Oturum doğrulanamadı.'}));
      });
    return undefined;
  });
};

const originalListen = express.application.listen;
express.application.listen = function patchedListen(...args) {
  if (!Object.prototype.hasOwnProperty.call(this, '__alyaCompanyRouteRegistered')) {
    Object.defineProperty(this, '__alyaCompanyRouteRegistered', { value:true,writable:true,configurable:true });
    this.get('/api/sirketler', async (req,res) => {
      try { const pool=await poolPromise; const result=await pool.request().query('SELECT CompanyId,CompanyCode,CompanyName,IsActive FROM dbo.Sirketler WHERE IsActive=1 ORDER BY CompanyId'); res.json(result.recordset); }
      catch(err){ console.error('Şirketler alınamadı:',err); res.status(500).json({success:false,error:'Şirketler alınamadı',detail:err.message}); }
    });
    this.get('/api/recete-agaci/urun-kartlari', async (req,res) => {
      try { const pool=await poolPromise; const companyId=resolveCompanyId(req); const result=await pool.request().input('SessionCompanyId',sql.Int,companyId).query('SELECT UrunId,UrunKodu,UrunAdi,Birim,Tur,Kategori,IsActive FROM dbo.Urunler WHERE CompanyId=@SessionCompanyId AND IsActive=1 ORDER BY UrunAdi,UrunId'); res.json({success:true,CompanyId:companyId,count:result.recordset.length,products:result.recordset}); }
      catch(err){ console.error('[Reçete Ağacı] Ürün kartları alınamadı:',err); res.status(500).json({success:false,error:'Ürün kartları alınamadı',detail:err.message}); }
    });
    try { require('./stokRoutes')(this); console.log('[Stok] Stok API rotaları yüklendi.'); } catch(err){ console.error('[Stok] Rotalar yüklenemedi:',err.message); }
    try { require('./receteRoutesV2')(this,poolPromise,sql); console.log('[Reçete] Gelişmiş reçete API rotaları yüklendi.'); } catch(err){ console.error('[Reçete] Rotalar yüklenemedi:',err.message); }
    try { require('./receteUretimRoutes')(this,poolPromise,sql); console.log('[Reçete Üretim] Üretim API rotaları yüklendi.'); } catch(err){ console.error('[Reçete Üretim] Rotalar yüklenemedi:',err.message); }
    try { require('./receteAgacRoutes')(this,poolPromise,sql); } catch(err){ console.error('[Reçete Ağacı] Rotalar yüklenemedi:',err.message); }
    try { require('./core/coreRoutes')(this,poolPromise,sql); console.log('[Core] Faz 0 API rotaları yüklendi.'); } catch(err){ console.error('[Core] Faz 0 rotaları yüklenemedi:',err.message); }
  }
  return originalListen.apply(this,args);
};

const originalInput = sql.Request.prototype.input;
sql.Request.prototype.input = function patchedInput(name,type,value) {
  const store=companyContext.getStore();
  if (store && store.companyId && String(name).toLowerCase()==='companyid') return originalInput.call(this,name,type,store.companyId);
  return originalInput.call(this,name,type,value);
};

const config={server:process.env.DB_SERVER,database:process.env.DB_DATABASE,user:process.env.DB_USER,password:process.env.DB_PASSWORD,options:{encrypt:process.env.DB_OPTIONS_ENCRYPT==='true',trustServerCertificate:process.env.DB_OPTIONS_TRUST_SERVER_CERTIFICATE==='true',enableArithAbort:true}};
const poolPromise=new sql.ConnectionPool(config).connect().then(pool=>{console.log('SQL Server bağlantısı başarılı!');return pool;}).catch(err=>{console.error('SQL Server bağlantı hatası:',err.message);throw err;});
module.exports={sql,poolPromise,companyContext};
