const crypto = require('crypto');

const DEVELOPMENT_SECRET = crypto.randomBytes(48).toString('hex');

function getSecret() {
  const configured = process.env.ERP_SESSION_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ERP_SESSION_SECRET production ortamında en az 32 karakter olmalıdır.');
  }
  return DEVELOPMENT_SECRET;
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(value) {
  return crypto.createHmac('sha256', getSecret()).update(value).digest('base64url');
}

function createSessionToken(user, lifetimeSeconds = 8 * 60 * 60) {
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({
    sub: Number(user.KullaniciId),
    username: user.KullaniciAdi,
    iat: now,
    exp: now + lifetimeSeconds,
    nonce: crypto.randomBytes(12).toString('hex'),
  }));
  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') throw new Error('Oturum belirteci bulunamadı.');
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) throw new Error('Oturum belirteci geçersiz.');
  const expected = sign(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    throw new Error('Oturum imzası geçersiz.');
  }
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!parsed.sub || !parsed.exp || parsed.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('Oturum süresi dolmuş.');
  }
  return parsed;
}

async function loadSecurityContext(poolPromise, sql, userId, selectedCompanyId) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('KullaniciId', sql.Int, Number(userId))
    .input('CompanyId', sql.Int, Number(selectedCompanyId))
    .query(`
      SELECT TOP (1)
        k.KullaniciId, k.KullaniciAdi, k.AdSoyad, k.IsActive,
        s.CompanyId, s.CompanyName,
        r.RoleId, r.RoleCode, r.RoleName
      FROM dbo.Kullanicilar k
      INNER JOIN dbo.UserCompanies uc ON uc.KullaniciId=k.KullaniciId AND uc.CompanyId=@CompanyId AND uc.IsActive=1
      INNER JOIN dbo.Sirketler s ON s.CompanyId=uc.CompanyId AND s.IsActive=1
      INNER JOIN dbo.UserRoles ur ON ur.KullaniciId=k.KullaniciId AND ur.CompanyId=uc.CompanyId
      INNER JOIN dbo.Roles r ON r.RoleId=ur.RoleId AND r.IsActive=1
      WHERE k.KullaniciId=@KullaniciId AND k.IsActive=1;

      SELECT DISTINCT p.PermissionCode
      FROM dbo.UserRoles ur
      INNER JOIN dbo.Roles r ON r.RoleId=ur.RoleId AND r.IsActive=1
      INNER JOIN dbo.RolePermissions rp ON rp.RoleId=r.RoleId
      INNER JOIN dbo.Permissions p ON p.PermissionId=rp.PermissionId AND p.IsActive=1
      WHERE ur.KullaniciId=@KullaniciId AND ur.CompanyId=@CompanyId;
    `);
  if (!result.recordsets[0]?.length) return null;
  const user = result.recordsets[0][0];
  return {
    userId: user.KullaniciId,
    username: user.KullaniciAdi,
    name: user.AdSoyad,
    companyId: user.CompanyId,
    companyName: user.CompanyName,
    roleId: user.RoleId,
    roleCode: user.RoleCode,
    roleName: user.RoleName,
    permissions: new Set((result.recordsets[1] || []).map((row) => row.PermissionCode)),
  };
}

function createAuthMiddleware({ poolPromise, sql }) {
  return async function authMiddleware(req, res, next) {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
      const payload = verifySessionToken(token);
      const companyId = Number(req.headers['x-company-id']);
      if (!Number.isInteger(companyId) || companyId <= 0) {
        return res.status(400).json({ success: false, error: 'Geçerli X-Company-Id başlığı zorunludur.' });
      }
      const context = await loadSecurityContext(poolPromise, sql, payload.sub, companyId);
      if (!context) {
        return res.status(403).json({ success: false, error: 'Bu şirkete erişim yetkiniz yok.' });
      }
      req.auth = context;
      req.companyId = context.companyId;
      next();
    } catch (error) {
      return res.status(401).json({ success: false, error: error.message || 'Oturum doğrulanamadı.' });
    }
  };
}

function requirePermission(permissionCode) {
  return function permissionMiddleware(req, res, next) {
    if (!req.auth?.permissions?.has(permissionCode) && !req.auth?.permissions?.has('core.admin')) {
      return res.status(403).json({ success: false, error: `Yetki gerekli: ${permissionCode}` });
    }
    next();
  };
}

module.exports = {
  createSessionToken,
  verifySessionToken,
  loadSecurityContext,
  createAuthMiddleware,
  requirePermission,
};
