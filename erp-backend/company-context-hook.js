/*
 * ALYA ERP - Çoklu şirket request context.
 *
 * Bu dosya server.js değiştirilmeden yüklenebilmesi için Node -r ile preload edilir.
 * Express request'indeki X-Company-Id değerini AsyncLocalStorage'a taşır ve
 * aynı SQL batch'i içinde SESSION_CONTEXT('CompanyId') ayarlar.
 */
const { AsyncLocalStorage } = require('node:async_hooks');
const express = require('express');
const sql = require('mssql');

const storage = new AsyncLocalStorage();
const COMPANY_IDS = new Set([1, 2, 3]);

function normalizeCompanyId(value) {
  const id = Number(value);
  return COMPANY_IDS.has(id) ? id : 1;
}

// Express'in ilk app.use() çağrısından önce şirket context middleware'ini otomatik ekle.
const originalUse = express.application.use;
if (!express.application.__alyaCompanyContextPatched) {
  express.application.use = function patchedUse(...args) {
    if (!this.__alyaCompanyContextInstalled) {
      const contextMiddleware = function alyaCompanyContext(req, res, next) {
        const companyId = normalizeCompanyId(req.headers['x-company-id'] || req.query?.companyId || 1);
        storage.run({ companyId }, next);
      };
      this.__alyaCompanyContextInstalled = true;
      originalUse.call(this, contextMiddleware);
    }
    return originalUse.apply(this, args);
  };
  express.application.__alyaCompanyContextPatched = true;
}

// Her SQL Request'i, kendi bağlantısında SESSION_CONTEXT ayarlayan bir batch'e dönüştür.
const originalRequest = sql.ConnectionPool.prototype.request;
if (!sql.ConnectionPool.prototype.__alyaCompanyRequestPatched) {
  sql.ConnectionPool.prototype.request = function patchedRequest(...args) {
    const request = originalRequest.apply(this, args);
    const originalQuery = request.query.bind(request);

    request.query = function companyAwareQuery(command, callback) {
      const context = storage.getStore();
      const companyId = context?.companyId;
      if (!companyId) return originalQuery(command, callback);

      const prefix = `EXEC sys.sp_set_session_context @key=N'CompanyId', @value=${companyId};`;
      return originalQuery(`${prefix}\n${command}`, callback);
    };

    return request;
  };
  sql.ConnectionPool.prototype.__alyaCompanyRequestPatched = true;
}

module.exports = { storage, normalizeCompanyId };
