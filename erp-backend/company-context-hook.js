const { AsyncLocalStorage } = require('node:async_hooks');
const express = require('express');
const sql = require('mssql');

const storage = new AsyncLocalStorage();

function parseCompanyId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeCompanyId(value) {
  return parseCompanyId(value) ?? 1;
}

function getRequestedCompanyId(req) {
  const raw = req.headers['x-company-id'] ?? req.query?.companyId ?? null;
  if (raw === null || raw === undefined || raw === '') return 1;
  return parseCompanyId(raw);
}

const originalUse = express.application.use;
if (!express.application.__alyaCompanyContextPatched) {
  express.application.use = function patchedUse(...args) {
    if (!this.__alyaCompanyContextInstalled) {
      const contextMiddleware = (req, res, next) => {
        const companyId = getRequestedCompanyId(req);
        if (companyId === null) return res.status(400).json({ success: false, error: 'Geçersiz CompanyId' });
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
    if (!companyId || typeof command !== 'string') return originalQuery.call(this, command, callback);
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
      const { install: installEDocument } = require('./kolaybi-e-document');
      const { install: installEDocumentWaybill } = require('./kolaybi-waybill-edocument-sync');
      const { install: installInvoiceActions } = require('./kolaybi-invoice-actions');
      const { install: installStockV2 } = require('./stokV2Routes');
      const { install: installUrunStok } = require('./urunStokRoutes');
      const { install: installSalesFlow } = require('./salesFlowRoutesV2');
      const { install: installSalesInvoice } = require('./salesInvoiceRoutesV2');
      const { install: installCompanyProfile } = require('./companyProfileRoutes');
      const deps = { app: this, poolPromise, sql };
      installErp(deps);
      installInvoice(deps);
      installWaybill(deps);
      installFull(deps);
      installFinans(deps);
      installEDocument(deps);
      installEDocumentWaybill(deps);
      installInvoiceActions(deps);
      installStockV2(deps);
      installUrunStok(deps);
      installSalesFlow(deps);
      installSalesInvoice(deps);
      installCompanyProfile(deps);
      this.__alyaKolaybiRoutesInstalled = true;
    }
    return originalListen.apply(this, args);
  };
  express.application.__alyaKolaybiRoutesPatched = true;
}

module.exports = { storage, normalizeCompanyId, parseCompanyId };
