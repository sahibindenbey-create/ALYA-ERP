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

const originalHandle = express.application.handle;
express.application.handle = function patchedHandle(req, res, callback) {
  const companyId = resolveCompanyId(req);
  return companyContext.run({ companyId }, () => originalHandle.call(this, req, res, callback));
};

const originalListen = express.application.listen;
express.application.listen = function patchedListen(...args) {
  if (!this.__alyaCompanyRouteRegistered) {
    this.__alyaCompanyRouteRegistered = true;
    this.get('/api/sirketler', async (req, res) => {
      try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
          SELECT CompanyId, CompanyCode, CompanyName, IsActive
          FROM dbo.Sirketler
          WHERE IsActive = 1
          ORDER BY CompanyId
        `);
        res.json(result.recordset);
      } catch (err) {
        console.error('Şirketler alınamadı:', err);
        res.status(500).json({ success: false, error: 'Şirketler alınamadı', detail: err.message });
      }
    });

    try {
      require('./stokRoutes')(this);
      console.log('[Stok] Stok API rotaları yüklendi.');
    } catch (err) {
      console.error('[Stok] Rotalar yüklenemedi:', err.message);
    }

    try {
      require('./receteRoutesV2')(this, poolPromise, sql);
      console.log('[Reçete] Gelişmiş reçete API rotaları yüklendi.');
    } catch (err) {
      console.error('[Reçete] Rotalar yüklenemedi:', err.message);
    }
  }
  return originalListen.apply(this, args);
};

const originalQuery = sql.Request.prototype.query;
sql.Request.prototype.query = function patchedQuery(command, ...args) {
  const store = companyContext.getStore();
  if (!store || !store.companyId) {
    return originalQuery.call(this, command, ...args);
  }

  const contextSql = `
    EXEC sys.sp_set_session_context @key = N'CompanyId', @value = @CompanyContextId;
    ${command}
  `;

  this.input('CompanyContextId', sql.Int, store.companyId);
  return originalQuery.call(this, contextSql, ...args);
};

const originalInput = sql.Request.prototype.input;
sql.Request.prototype.input = function patchedInput(name, type, value) {
  const store = companyContext.getStore();
  if (store && store.companyId && String(name).toLowerCase() === 'companyid') {
    return originalInput.call(this, name, type, store.companyId);
  }
  return originalInput.call(this, name, type, value);
};

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_OPTIONS_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_OPTIONS_TRUST_SERVER_CERTIFICATE === 'true',
    enableArithAbort: true
  }
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('SQL Server bağlantısı başarılı!');
    return pool;
  })
  .catch(err => {
    console.error('SQL Server bağlantı hatası:', err.message);
    throw err;
  });

module.exports = {
  sql,
  poolPromise,
  companyContext
};
