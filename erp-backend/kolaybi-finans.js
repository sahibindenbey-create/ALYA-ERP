/* ============================================================
   ALYA ERP - KolayBi Finans (Banka/Kasa/Kredi Kartı/Çek/Senet) okuma uçları
   Veri kaynağı: dbo.KolaybiRawData (kolaybi-full-sync.js tarafından
   her 5 dakikada bir ve "Tümünü Çek" ile güncelleniyor).
   Bu dosya sadece OKUR, kendi senkronizasyonunu yapmaz.
   ============================================================ */
const { storage } = require('./company-context-hook');

const COMPANY_IDS = new Set([1, 2, 3]);

const text = (v) => (v === undefined || v === null ? null : String(v).trim() || null);
const pick = (row, keys, fallback = null) => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return fallback;
};
const number = (v, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };

// KolayBi 'vaults' uç noktası banka hesabı / kasa / kredi kartı / online banka
// hesabını tek listede, bir "type" alanıyla ayırarak döndürür.
const vaultType = (row) => String(pick(row, ['type', 'vault_type', 'kind'], '') || '').toLowerCase();

function mapVaultRow(row) {
  return {
    id: pick(row, ['id', 'vault_id']),
    ad: text(pick(row, ['name', 'title', 'vault_name'])) || 'İsimsiz',
    bakiye: number(pick(row, ['balance', 'current_balance', 'amount'], 0)),
    paraBirimi: text(pick(row, ['currency', 'currency_code'], 'TRY')) || 'TRY',
    banka: text(pick(row, ['bank_name', 'bank'])),
    iban: text(pick(row, ['iban'])),
    hesapNo: text(pick(row, ['account_number', 'account_no'])),
    kartNo: text(pick(row, ['card_number', 'masked_card_number'])),
    tip: vaultType(row),
    ham: row
  };
}

function mapChequeOrBond(row) {
  return {
    id: pick(row, ['id', 'document_id']),
    seriNo: text(pick(row, ['serial_number', 'number', 'code'])),
    tutar: number(pick(row, ['amount', 'total_amount'], 0)),
    paraBirimi: text(pick(row, ['currency', 'currency_code'], 'TRY')) || 'TRY',
    vadeTarihi: text(pick(row, ['due_date', 'maturity_date'])),
    durum: text(pick(row, ['status', 'state'])),
    yon: text(pick(row, ['direction', 'type'])),
    cari: text(pick(row?.associate ?? {}, ['name', 'title'])) || text(pick(row, ['associate_name'])),
    ham: row
  };
}

async function readRaw(pool, sql, companyId, entityType) {
  const result = await pool.request()
    .input('CompanyId', sql.Int, companyId)
    .input('EntityType', sql.NVarChar(100), entityType)
    .query(`
      SELECT Payload, SyncedAt
      FROM dbo.KolaybiRawData
      WHERE CompanyId = @CompanyId AND EntityType = @EntityType
      ORDER BY RawDataId DESC
    `);
  const rows = [];
  let sonSenkron = null;
  for (const r of result.recordset) {
    try {
      rows.push(JSON.parse(r.Payload));
      if (!sonSenkron || r.SyncedAt > sonSenkron) sonSenkron = r.SyncedAt;
    } catch (_) { /* bozuk payload atlanır */ }
  }
  return { rows, sonSenkron };
}

function install({ app, poolPromise, sql }) {
  if (app.__alyaKolaybiFinansInstalled) return;
  app.__alyaKolaybiFinansInstalled = true;

  const companyIdOf = (req) =>
    Number(storage.getStore()?.companyId || req.headers['x-company-id'] || 1);

  const vaultEndpoint = (matches) => async (req, res) => {
    const companyId = companyIdOf(req);
    if (!COMPANY_IDS.has(companyId)) return res.status(400).json({ success: false, error: 'Geçersiz CompanyId' });
    try {
      const pool = await poolPromise;
      const { rows, sonSenkron } = await readRaw(pool, sql, companyId, 'vaults');
      const filtered = rows
        .map(mapVaultRow)
        .filter((v) => (matches ? matches(v.tip) : true));
      res.json({ success: true, CompanyId: companyId, sonSenkronizasyon: sonSenkron, kayitlar: filtered });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  const listEndpoint = (entityType) => async (req, res) => {
    const companyId = companyIdOf(req);
    if (!COMPANY_IDS.has(companyId)) return res.status(400).json({ success: false, error: 'Geçersiz CompanyId' });
    try {
      const pool = await poolPromise;
      const { rows, sonSenkron } = await readRaw(pool, sql, companyId, entityType);
      res.json({ success: true, CompanyId: companyId, sonSenkronizasyon: sonSenkron, kayitlar: rows.map(mapChequeOrBond) });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  // "type" alanının gerçek değerini bilmediğimiz için (KolayBi dokümantasyonunda
  // net şema paylaşılmamış), esnek alt-dizge eşleşmesi kullanıyoruz. Gerçek API
  // yanıtı geldiğinde (örn. tip 'bank_account' değil de farklı bir kelime
  // kullanıyorsa) burada tek satırlık bir güncelleme yeterli olur.
  const isBank = (t) => t.includes('bank_account') || (t.includes('bank') && !t.includes('online'));
  const isSafe = (t) => t.includes('safe') || t.includes('kasa') || t.includes('cash');
  const isCreditCard = (t) => t.includes('credit') || t.includes('card');
  const isOnlineBank = (t) => t.includes('online');

  app.get('/api/kolaybi/finans/banka-hesaplari', vaultEndpoint(isBank));
  app.get('/api/kolaybi/finans/kasalar', vaultEndpoint(isSafe));
  app.get('/api/kolaybi/finans/kredi-kartlari', vaultEndpoint(isCreditCard));
  app.get('/api/kolaybi/finans/online-banka-hesaplari', vaultEndpoint(isOnlineBank));
  app.get('/api/kolaybi/finans/cekler', listEndpoint('cheques'));
  app.get('/api/kolaybi/finans/senetler', listEndpoint('bonds'));
  // Ham veri: type alanı beklenenden farklı çıkarsa teşhis için kullanılır.
  app.get('/api/kolaybi/finans/vault-ham', vaultEndpoint(null));
}

module.exports = { install };
