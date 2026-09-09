/*
 * ALYA ERP - Çoklu şirket request context.
 *
 * Node -r ile preload edilir. Express request'indeki X-Company-Id değerini
 * AsyncLocalStorage'a taşır ve her SQL batch'inin aynı bağlantısında
 * SESSION_CONTEXT('CompanyId') ayarlar.
 */
const { AsyncLocalStorage } = require('node:async_hooks');
const express = require('express');
const sql = require('mssql');
const Module = require('module');

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
      const contextMiddleware = function alyaCompanyContext(req, res, next) {
        const requestedId = getRequestedCompanyId(req);
        if (!COMPANY_IDS.has(requestedId)) {
          return res.status(400).json({ success:false, error:'Geçersiz CompanyId', CompanyId:requestedId });
        }
        storage.run({ companyId: requestedId }, next);
      };
      this.__alyaCompanyContextInstalled = true;
      originalUse.call(this, contextMiddleware);
    }
    return originalUse.apply(this, args);
  };
  express.application.__alyaCompanyContextPatched = true;
}

const requestPrototype = sql.Request && sql.Request.prototype;
if (requestPrototype && !requestPrototype.__alyaCompanyQueryPatched) {
  const originalQuery = requestPrototype.query;
  requestPrototype.query = function companyAwareQuery(command, callback) {
    const context = storage.getStore();
    const companyId = context?.companyId;
    if (!companyId || typeof command !== 'string') return originalQuery.call(this, command, callback);
    const prefix = `EXEC sys.sp_set_session_context @key=N'CompanyId', @value=${companyId};`;
    return originalQuery.call(this, `${prefix}\n${command}`, callback);
  };
  requestPrototype.__alyaCompanyQueryPatched = true;
}

function withoutTimers(fn) {
  const originalSetTimeout = global.setTimeout;
  const originalSetInterval = global.setInterval;
  const noopTimer = () => ({ unref(){}, ref(){}, hasRef(){return false;} });
  global.setTimeout = noopTimer;
  global.setInterval = noopTimer;
  try { return fn(); } finally { global.setTimeout = originalSetTimeout; global.setInterval = originalSetInterval; }
}

withoutTimers(() => {
  try { require('./kolaybi-erp-sync'); } catch (err) { console.error('[ALYA] KolayBi ERP aktarım katmanı yüklenemedi:', err.message); }
  try { require('./kolaybi-fatura-sync'); } catch (err) { console.error('[ALYA] KolayBi fatura aktarım katmanı yüklenemedi:', err.message); }
  try { require('./kolaybi-waybill-sync'); } catch (err) { console.error('[ALYA] KolayBi irsaliye aktarım katmanı yüklenemedi:', err.message); }
  try { require('./kolaybi-full-sync'); } catch (err) { console.error('[ALYA] KolayBi tam senkronizasyon katmanı yüklenemedi:', err.message); }
});

if (!Module.__alyaKolaybiAutoSyncTimerGuard) {
  const originalLoad = Module._load;
  Module._load = function guardedKolaybiLoad(request,parent,isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request === './kolaybi' && parent?.filename && parent.filename.endsWith('server.js') && typeof loaded === 'function') {
      return function guardedRegisterKolaybi(args) { return withoutTimers(() => loaded(args)); };
    }
    return loaded;
  };
  Module.__alyaKolaybiAutoSyncTimerGuard = true;
}

module.exports = { storage, normalizeCompanyId };
