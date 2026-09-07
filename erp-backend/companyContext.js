const { sql, poolPromise } = require('./db');

async function validateCompanyId(companyId) {
  const id = Number(companyId);
  if (!Number.isInteger(id) || id <= 0) return null;

  const pool = await poolPromise;
  const result = await pool.request()
    .input('CompanyId', sql.Int, id)
    .query(`
      SELECT CompanyId, CompanyCode, CompanyName, IsActive
      FROM dbo.Sirketler
      WHERE CompanyId = @CompanyId AND IsActive = 1
    `);

  return result.recordset[0] || null;
}

function getCompanyId(req) {
  const value = req.headers['x-company-id'] ?? req.body?.CompanyId ?? req.query?.CompanyId ?? 1;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : 1;
}

async function companyMiddleware(req, res, next) {
  try {
    const companyId = getCompanyId(req);
    const company = await validateCompanyId(companyId);
    if (!company) {
      return res.status(400).json({ success: false, error: 'Geçersiz veya pasif şirket', CompanyId: companyId });
    }
    req.companyId = company.CompanyId;
    req.company = company;
    next();
  } catch (err) {
    console.error('Company middleware hatası:', err);
    res.status(500).json({ success: false, error: 'Şirket bilgisi doğrulanamadı', detail: err.message });
  }
}

async function companyQuery(companyId, configureRequest, queryText) {
  const id = Number(companyId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Geçersiz CompanyId');

  const pool = await poolPromise;
  const request = pool.request();
  if (typeof configureRequest === 'function') configureRequest(request);
  request.input('CompanyContextId', sql.Int, id);

  return await request.query(`
    EXEC sys.sp_set_session_context @key = N'CompanyId', @value = @CompanyContextId;
    ${queryText}
  `);
}

module.exports = { getCompanyId, validateCompanyId, companyMiddleware, companyQuery };
