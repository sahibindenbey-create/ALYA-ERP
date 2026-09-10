const { AsyncLocalStorage } = require('node:async_hooks');
const express = require('express');
const sql = require('mssql');

const storage = new AsyncLocalStorage();
const COMPANY_IDS = new Set([1, 2, 3]);

function normalizeCompanyId(value) {
  const id = Number(value);
  return COMPANY_IDS.has(id) ? id : 1;
}

function getRequestedCompanyId(req) {
  const raw = req.headers['x-company-id'] ?? req.query?.companyId ?? null;
  if (raw === null || raw === undefined || raw === '') return 1;
  return Number(raw);
}

const originalUse = express.application.use;
if (!express.application.__alyaCompanyContextPatched) {
  express.application.use = function patchedUse(...args) {
    if (!this.__alyaCompanyContextInstalled) {
      const contextMiddleware = (req, res, next) => {
        const companyId = getRequestedCompanyId(req);
        if (!COMPANY_IDS.has(companyId)) {
          return res.status(400).json({ success: false, error: 'Geçersiz CompanyId', CompanyId: companyId });
        }
        storage.run({ companyId }, next);
      };
      this.__alyaCompanyContextInstalled = true;
      originalUse.call(this, contextMiddleware);
    }
    return originalUse.apply(this, args);
  };
  express.application.__alyaCompanyContextPatched = true;
}

const requestPrototype = sql.Request?.prototype;
if (requestPrototype && !requestPrototype.__alyaCompanyQueryPatched) {
  const originalQuery = requestPrototype.query;
  requestPrototype.query = function companyAwareQuery(command, callback) {
    const companyId = storage.getStore()?.companyId;
    if (!companyId || typeof command !== 'string') {
      return originalQuery.call(this, command, callback);
    }
    const prefix = `EXEC sys.sp_set_session_context @key=N'CompanyId', @value=${companyId};`;
    return originalQuery.call(this, `${prefix}\n${command}`, callback);
  };
  requestPrototype.__alyaCompanyQueryPatched = true;
}

const originalListen = express.application.listen;
if (!express.application.__alyaKolaybiRoutesPatched) {
  express.application.listen = function patchedListen(...args) {
    if (!this.__alyaKolaybiRoutesInstalled) {
      const { poolPromise, sql } = require('./db');
      const { install: installErp } = require('./kolaybi-erp-sync');
      const { install: installInvoice } = require('./kolaybi-fatura-sync');
      const { install: installWaybill } = require('./kolaybi-waybill-sync');
      const { install: installFull } = require('./kolaybi-full-sync');
      const { install: installFinans } = require('./kolaybi-finans');
      const deps = { app: this, poolPromise, sql };
      installErp(deps);
      installInvoice(deps);
      installWaybill(deps);
      installFull(deps);
      installFinans(deps);
      this.__alyaKolaybiRoutesInstalled = true;
    }
    return originalListen.apply(this, args);
  };
  express.application.__alyaKolaybiRoutesPatched = true;
}

module.exports = { storage, normalizeCompanyId };
