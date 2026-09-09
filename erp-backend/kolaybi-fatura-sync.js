/*
 * ALYA ERP - KolayBi -> ERP fatura aktarımı
 *
 * Mevcut kolaybi.js entegrasyonuna dokunmadan çalışır.
 * Şirket context'i AsyncLocalStorage üzerinden korunur.
 */
const Module = require('module');
const { storage } = require('./company-context-hook');

const COMPANY_IDS = new Set([1, 2, 3]);
const DEFAULT_BASE_URL = 'https://ofis-api.kolaybi.com';
const originalLoad = Module._load;
const running = new Set();

const pick = (row, keys, fallback = null) => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return fallback;
};

const text = (value) => value === undefined || value === null ? null : String(value).trim() || null;
const number = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

function invoiceId(row) {
  return text(pick(row, ['id', 'document_id', 'commercial_doc_id', 'invoice_id', 'uuid']));
}

function invoiceCode(row) {
  return text(pick(row, ['document_number', 'invoice_number', 'number', 'code', 'serial_number'])) ||
    (invoiceId(row) ? `KB-${invoiceId(row)}` : null);
}

function invoiceDate(row) {
  const value = pick(row, ['issue_date', 'invoice_date', 'date', 'document_date', 'created_at']);
  const d = value ? new Date(value) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function dueDate(row) {
  const value = pick(row, ['due_date', 'maturity_date', 'payment_due_date']);
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function associate(row) {
  const a = row?.associate || row?.customer || row?.supplier || row?.client || {};
  return {
    code: text(typeof a === 'string' ? a : pick(a, ['code', 'associate_code', 'customer_code', 'supplier_code', 'id'])),
    name: text(typeof a === 'string' ? null : pick(a, ['name', 'title', 'company_name', 'trade_name', 'full_name']))
  };
}

function direction(type, row) {
  const raw = String(pick(row, ['type', 'invoice_type'], type) || '').toLowerCase();
  return raw.includes('purchase') || raw.includes('alış') ? 'Alış' : 'Satış';
}

function status(row) {
  const raw = String(pick(row, ['status', 'state', 'invoice_status'], '') || '').toLowerCase();
  if (['rejected', 'cancelled', 'canceled'].includes(raw)) return 'İptal';
  if (['paid', 'completed', 'approved'].includes(raw)) return 'Ödendi';
  return 'Bekliyor';
}

function items(row) {
  const list = row?.products || row?.items || row?.invoice_items || row?.lines || row?.details || [];
  return Array.isArray(list) ? list : [];
}

function itemProductCode(item) {
  const product = item?.product || item?.stock || {};
  return text(typeof product === 'string' ? product : pick(product, ['code', 'sku', 'product_code', 'stock_code', 'id', 'product_id'])) ||
    text(pick(item, ['product_code', 'stock_code', 'code', 'sku', 'product_id'])) || 'KB-URUN';
}

function itemProductName(item) {
  const product = item?.product || item?.stock || {};
  return text(typeof product === 'string' ? product : pick(product, ['name', 'title', 'product_name', 'description'])) ||
    text(pick(item, ['product_name', 'name', 'description', 'title'])) || 'KolayBi Ürün';
}

function itemQuantity(item) {
  return number(pick(item, ['quantity', 'qty', 'amount', 'count', 'units'], 1), 1);
}

function itemUnit(item) {
  return text(pick(item, ['unit', 'unit_name', 'uom', 'measure_unit'], 'Adet')) || 'Adet';
}

function itemPrice(item) {
  return number(pick(item, ['unit_price', 'price', 'unit_amount', 'amount'], 0));
}

function itemVat(item, row) {
  return number(pick(item, ['vat_rate', 'tax_rate', 'kdv_rate'], pick(row, ['vat_rate', 'tax_rate', 'kdv_rate'], 20)), 20);
}

function itemTotals(item, row) {
  const qty = itemQuantity(item);
  const price = itemPrice(item);
  const vat = itemVat(item, row);
  const line = number(pick(item, ['total', 'line_total', 'gross_total', 'net_total', 'amount'], qty * price));
  const vatAmount = number(pick(item, ['vat_amount', 'tax_amount', 'kdv_tutari'], line * vat / 100));
  return { qty, price, vat, line, vatAmount };
}

async function getToken(pool, sql, companyId) {
  const result = await pool.request()
    .input('CompanyId', sql.Int, companyId)
    .query(`
      SELECT TOP 1 ApiKey, Channel, BaseUrl, AccessToken, TokenGecerlilik
      FROM dbo.KolaybiAyarlar
      WHERE CompanyId=@CompanyId AND IsActive=1
      ORDER BY Id DESC
    `);
  const ayar = result.recordset[0];
  if (!ayar?.ApiKey || !ayar?.Channel) throw new Error(`Şirket ${companyId} için KolayBi ayarı eksik.`);
  const baseUrl = ayar.BaseUrl || DEFAULT_BASE_URL;
  if (ayar.AccessToken && ayar.TokenGecerlilik && new Date(ayar.TokenGecerlilik) > new Date()) {
    return { token: ayar.AccessToken, channel: ayar.Channel, baseUrl };
  }
  const response = await fetch(`${baseUrl}/kolaybi/v1/access_token`, {
    method: 'POST',
    headers: { Channel: ayar.Channel, 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: ayar.ApiKey })
  });
  if (!response.ok) throw new Error(`KolayBi token HTTP ${response.status}`);
  const body = await response.json();
  const token = body?.data;
  if (!token) throw new Error('KolayBi token cevabı boş.');
  await pool.request()
    .input('CompanyId', sql.Int, companyId)
    .input('AccessToken', sql.NVarChar, token)
    .input('TokenGecerlilik', sql.DateTime2, new Date(Date.now() + 23 * 60 * 60 * 1000))
    .query(`
      UPDATE dbo.KolaybiAyarlar
      SET AccessToken=@AccessToken, TokenGecerlilik=@TokenGecerlilik, UpdatedAt=SYSDATETIME()
      WHERE CompanyId=@CompanyId AND IsActive=1
    `);
  return { token, channel: ayar.Channel, baseUrl };
}

async function apiJson(api, path, params = {}) {
  const url = new URL(`${api.baseUrl}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  }
  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${api.token}`, Channel: api.channel, Accept: 'application/json' }
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`KolayBi API HTTP ${response.status}: ${body}`);
  }
  return response.json();
}

async function upsertInvoice(pool, sql, companyId, type, row) {
  const externalId = invoiceId(row);
  const code = invoiceCode(row);
  if (!externalId || !code) return { skipped: 1 };

  const car = associate(row);
  const yon = direction(type, row);
  const invoiceItems = items(row);
  const araToplam = number(pick(row, ['subtotal', 'sub_total', 'net_total', 'amount_without_tax'],
    invoiceItems.reduce((sum, item) => sum + itemTotals(item, row).line, 0)));
  const kdvToplam = number(pick(row, ['vat_total', 'tax_total', 'kdv_total', 'tax_amount'],
    invoiceItems.reduce((sum, item) => sum + itemTotals(item, row).vatAmount, 0)));
  const genelToplam = number(pick(row, ['grand_total', 'total', 'total_amount', 'amount'], araToplam + kdvToplam));
  const faturaDurumu = status(row);
  const vade = dueDate(row);

  const existing = await pool.request()
    .input('CompanyId', sql.Int, companyId)
    .input('FaturaKodu', sql.NVarChar, code)
    .query(`SELECT TOP 1 FaturaId FROM dbo.Faturalar WHERE CompanyId=@CompanyId AND FaturaKodu=@FaturaKodu ORDER BY FaturaId DESC`);

  let faturaIdValue;
  if (existing.recordset.length) {
    faturaIdValue = existing.recordset[0].FaturaId;
    await pool.request()
      .input('FaturaId', sql.Int, faturaIdValue)
      .input('Yon', sql.NVarChar, yon)
      .input('FaturaTarihi', sql.Date, invoiceDate(row))
      .input('VadeTarihi', sql.Date, vade)
      .input('CariKodu', sql.NVarChar, car.code)
      .input('CariAdi', sql.NVarChar, car.name || car.code || 'KolayBi Cari')
      .input('OdemeSekli', sql.NVarChar, text(pick(row, ['payment_method', 'payment_type', 'payment_method_name'])))
      .input('AraToplam', sql.Decimal(18, 2), araToplam)
      .input('KdvToplam', sql.Decimal(18, 2), kdvToplam)
      .input('GenelToplam', sql.Decimal(18, 2), genelToplam)
      .input('Durum', sql.NVarChar, faturaDurumu)
      .query(`
        UPDATE dbo.Faturalar SET
          Yon=@Yon,FaturaTarihi=@FaturaTarihi,VadeTarihi=@VadeTarihi,
          CariKodu=@CariKodu,CariAdi=@CariAdi,OdemeSekli=@OdemeSekli,
          AraToplam=@AraToplam,KdvToplam=@KdvToplam,GenelToplam=@GenelToplam,Durum=@Durum
        WHERE FaturaId=@FaturaId
      `);
    await pool.request().input('FaturaId', sql.Int, faturaIdValue).query('DELETE FROM dbo.FaturaDetay WHERE FaturaId=@FaturaId');
  } else {
    const result = await pool.request()
      .input('CompanyId', sql.Int, companyId)
      .input('FaturaKodu', sql.NVarChar, code)
      .input('Yon', sql.NVarChar, yon)
      .input('FaturaTarihi', sql.Date, invoiceDate(row))
      .input('VadeTarihi', sql.Date, vade)
      .input('CariKodu', sql.NVarChar, car.code)
      .input('CariAdi', sql.NVarChar, car.name || car.code || 'KolayBi Cari')
      .input('OdemeSekli', sql.NVarChar, text(pick(row, ['payment_method', 'payment_type', 'payment_method_name'])))
      .input('AraToplam', sql.Decimal(18, 2), araToplam)
      .input('KdvToplam', sql.Decimal(18, 2), kdvToplam)
      .input('GenelToplam', sql.Decimal(18, 2), genelToplam)
      .input('Durum', sql.NVarChar, faturaDurumu)
      .query(`
        INSERT INTO dbo.Faturalar
        (CompanyId,FaturaKodu,Yon,FaturaTarihi,VadeTarihi,CariKodu,CariAdi,OdemeSekli,AraToplam,KdvToplam,GenelToplam,Durum)
        OUTPUT INSERTED.FaturaId
        VALUES (@CompanyId,@FaturaKodu,@Yon,@FaturaTarihi,@VadeTarihi,@CariKodu,@CariAdi,@OdemeSekli,@AraToplam,@KdvToplam,@GenelToplam,@Durum)
      `);
    faturaIdValue = result.recordset[0].FaturaId;
  }

  for (const item of invoiceItems) {
    const totals = itemTotals(item, row);
    await pool.request()
      .input('FaturaId', sql.Int, faturaIdValue)
      .input('UrunKodu', sql.NVarChar, itemProductCode(item))
      .input('UrunAdi', sql.NVarChar, itemProductName(item))
      .input('Miktar', sql.Decimal(18, 2), totals.qty)
      .input('Birim', sql.NVarChar, itemUnit(item))
      .input('BirimFiyat', sql.Decimal(18, 2), totals.price)
      .input('KdvOrani', sql.Decimal(9, 2), totals.vat)
      .input('KdvTutari', sql.Decimal(18, 2), totals.vatAmount)
      .input('SatirToplam', sql.Decimal(18, 2), totals.line)
      .query(`
        INSERT INTO dbo.FaturaDetay
        (FaturaId,UrunKodu,UrunAdi,Miktar,Birim,BirimFiyat,KdvOrani,KdvTutari,SatirToplam)
        VALUES (@FaturaId,@UrunKodu,@UrunAdi,@Miktar,@Birim,@BirimFiyat,@KdvOrani,@KdvTutari,@SatirToplam)
      `);
  }

  return { created: existing.recordset.length ? 0 : 1, updated: existing.recordset.length ? 1 : 0, skipped: 0 };
}

async function syncInvoices({ poolPromise, sql, companyId }) {
  if (running.has(companyId)) return { CompanyId: companyId, skipped: true };
  running.add(companyId);
  try {
    const pool = await poolPromise;
    const api = await getToken(pool, sql, companyId);
    const types = ['sale_invoice', 'sale_return_invoice', 'purchase_invoice', 'purchase_return_invoice'];
    const totals = { CompanyId: companyId, created: 0, updated: 0, skipped: 0, errors: 0 };
    for (const type of types) {
      const response = await apiJson(api, '/kolaybi/v1/invoices', { type, has_products: true });
      const rows = Array.isArray(response?.data) ? response.data : [];
      for (const row of rows) {
        try {
          const result = await upsertInvoice(pool, sql, companyId, type, row);
          totals.created += result.created || 0;
          totals.updated += result.updated || 0;
          totals.skipped += result.skipped || 0;
        } catch (err) {
          totals.errors++;
          console.error(`[KolayBi][Fatura][Şirket ${companyId}]`, err.message);
        }
      }
    }
    return totals;
  } finally {
    running.delete(companyId);
  }
}

function install(args) {
  const { app, poolPromise, sql } = args;
  if (app.__alyaKolaybiInvoiceSyncInstalled) return;
  app.__alyaKolaybiInvoiceSyncInstalled = true;
  app.post('/api/kolaybi/fatura-senkronize', async (req, res) => {
    const companyId = Number(storage.getStore()?.companyId || req.headers['x-company-id'] || 1);
    if (!COMPANY_IDS.has(companyId)) return res.status(400).json({ success: false, error: 'Geçersiz CompanyId', CompanyId: companyId });
    try {
      const result = await storage.run({ companyId }, () => syncInvoices({ poolPromise, sql, companyId }));
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ success: false, CompanyId: companyId, error: err.message });
    }
  });

  const autoSync = async () => {
    try {
      const pool = await poolPromise;
      const result = await pool.request().query('SELECT CompanyId FROM dbo.Sirketler WHERE IsActive=1 ORDER BY CompanyId');
      for (const row of result.recordset) {
        const companyId = Number(row.CompanyId);
        if (COMPANY_IDS.has(companyId)) {
          storage.run({ companyId }, () => syncInvoices({ poolPromise, sql, companyId }).catch(err => console.error(`[KolayBi][Fatura][Şirket ${companyId}]`, err.message)));
        }
      }
    } catch (err) {
      console.error('[KolayBi][Fatura] otomatik senkronizasyon', err.message);
    }
  };
  setTimeout(autoSync, 20000);
  setInterval(autoSync, 60 * 1000);
}

Module._load = function patchedLoad(request, parent, isMain) {
  const loaded = originalLoad.apply(this, arguments);
  if (request === './kolaybi' && parent?.filename && parent.filename.endsWith('server.js')) {
    return function wrappedRegisterKolaybi(args) {
      const result = loaded(args);
      install(args);
      return result;
    };
  }
  return loaded;
};

module.exports = { syncInvoices };
