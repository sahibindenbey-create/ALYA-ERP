const express = require('express');
const crypto = require('crypto');
const { createSessionToken, createAuthMiddleware, requirePermission, loadSecurityContext } = require('./security');
const { assertPeriodOpen, nextDocumentNumber, writeAudit } = require('./coreService');

function verifyPassword(password, salt, storedHash) {
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  const left = Buffer.from(actual, 'hex');
  const right = Buffer.from(storedHash || '', 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

module.exports = function registerCoreRoutes(app, poolPromise, sql) {
  const router = express.Router();

  router.post('/auth/login', async (req, res) => {
    try {
      const { kullaniciAdi, sifre } = req.body || {};
      if (!kullaniciAdi || !sifre) return res.status(400).json({ success: false, error: 'Kullanıcı adı ve şifre gereklidir.' });
      const pool = await poolPromise;
      const userResult = await pool.request()
        .input('KullaniciAdi', sql.NVarChar(120), String(kullaniciAdi).trim())
        .query(`SELECT TOP (1) KullaniciId,KullaniciAdi,AdSoyad,SifreSalt,SifreHash,IsActive FROM dbo.Kullanicilar WHERE KullaniciAdi=@KullaniciAdi AND IsActive=1;`);
      const user = userResult.recordset[0];
      if (!user || !verifyPassword(String(sifre), user.SifreSalt, user.SifreHash)) {
        return res.status(401).json({ success: false, error: 'Kullanıcı adı veya şifre hatalı.' });
      }
      const companies = await pool.request().input('KullaniciId', sql.Int, user.KullaniciId).query(`
        SELECT s.CompanyId,s.CompanyName,uc.IsDefault,r.RoleCode,r.RoleName
        FROM dbo.UserCompanies uc
        INNER JOIN dbo.Sirketler s ON s.CompanyId=uc.CompanyId AND s.IsActive=1
        INNER JOIN dbo.UserRoles ur ON ur.KullaniciId=uc.KullaniciId AND ur.CompanyId=uc.CompanyId
        INNER JOIN dbo.Roles r ON r.RoleId=ur.RoleId AND r.IsActive=1
        WHERE uc.KullaniciId=@KullaniciId AND uc.IsActive=1
        ORDER BY uc.IsDefault DESC,s.CompanyId;
      `);
      if (!companies.recordset.length) return res.status(403).json({ success: false, error: 'Kullanıcıya aktif şirket erişimi tanımlanmamış.' });
      const defaultCompany = companies.recordset[0];
      const context = await loadSecurityContext(poolPromise, sql, user.KullaniciId, defaultCompany.CompanyId);
      const token = createSessionToken(user);
      res.json({
        success: true,
        token,
        expiresInSeconds: 28800,
        user: { id:user.KullaniciId, name:user.AdSoyad, kullaniciAdi:user.KullaniciAdi, role:defaultCompany.RoleName, roleCode:defaultCompany.RoleCode },
        defaultCompanyId: defaultCompany.CompanyId,
        companies: companies.recordset,
        permissions: [...context.permissions],
      });
    } catch (error) {
      console.error('[Core] Login:', error);
      res.status(500).json({ success:false, error:'Giriş sırasında hata oluştu.', detail:error.message });
    }
  });

  router.use(createAuthMiddleware({ poolPromise, sql }));

  router.get('/auth/me', (req, res) => res.json({
    success:true,
    user:{ id:req.auth.userId, name:req.auth.name, kullaniciAdi:req.auth.username, role:req.auth.roleName, roleCode:req.auth.roleCode },
    company:{ id:req.auth.companyId, name:req.auth.companyName },
    permissions:[...req.auth.permissions],
  }));

  router.get('/companies', async (req, res) => {
    const pool = await poolPromise;
    const result = await pool.request().input('KullaniciId', sql.Int, req.auth.userId).query(`
      SELECT s.CompanyId,s.CompanyName,s.IsActive,uc.IsDefault,r.RoleCode,r.RoleName
      FROM dbo.UserCompanies uc
      INNER JOIN dbo.Sirketler s ON s.CompanyId=uc.CompanyId AND s.IsActive=1
      INNER JOIN dbo.UserRoles ur ON ur.KullaniciId=uc.KullaniciId AND ur.CompanyId=uc.CompanyId
      INNER JOIN dbo.Roles r ON r.RoleId=ur.RoleId AND r.IsActive=1
      WHERE uc.KullaniciId=@KullaniciId AND uc.IsActive=1 ORDER BY uc.IsDefault DESC,s.CompanyId;
    `);
    res.json(result.recordset);
  });

  router.get('/admin/overview', requirePermission('core.admin'), async (req, res) => {
    try {
      const pool = await poolPromise;
      const result = await pool.request().input('CompanyId', sql.Int, req.companyId).query(`
        SELECT RoleId,RoleCode,RoleName,Description,IsSystem,IsActive FROM dbo.Roles ORDER BY IsSystem DESC,RoleName;
        SELECT PermissionId,PermissionCode,PermissionName,ModuleCode,OperationCode FROM dbo.Permissions WHERE IsActive=1 ORDER BY ModuleCode,PermissionCode;
        SELECT k.KullaniciId,k.KullaniciAdi,k.AdSoyad,k.IsActive,uc.IsActive AS CompanyAccess,uc.IsDefault,r.RoleId,r.RoleCode,r.RoleName
        FROM dbo.Kullanicilar k
        LEFT JOIN dbo.UserCompanies uc ON uc.KullaniciId=k.KullaniciId AND uc.CompanyId=@CompanyId
        LEFT JOIN dbo.UserRoles ur ON ur.KullaniciId=k.KullaniciId AND ur.CompanyId=@CompanyId
        LEFT JOIN dbo.Roles r ON r.RoleId=ur.RoleId ORDER BY k.KullaniciAdi;
        SELECT PeriodId,PeriodCode,PeriodName,StartDate,EndDate,Status,ClosedAt FROM dbo.FiscalPeriods WHERE CompanyId=@CompanyId ORDER BY StartDate DESC;
        SELECT NumberSeriesId,DocumentType,Prefix,Suffix,Padding,ResetYearly,CurrentYear,LastNumber,IsActive FROM dbo.NumberSeries WHERE CompanyId=@CompanyId ORDER BY DocumentType;
        SELECT TOP (100) a.AuditLogId,a.ActionCode,a.EntityType,a.EntityId,a.CreatedAt,k.KullaniciAdi
        FROM dbo.AuditLogs a LEFT JOIN dbo.Kullanicilar k ON k.KullaniciId=a.KullaniciId
        WHERE a.CompanyId=@CompanyId ORDER BY a.AuditLogId DESC;
      `);
      res.json({ success:true, roles:result.recordsets[0], permissions:result.recordsets[1], users:result.recordsets[2], periods:result.recordsets[3], numberSeries:result.recordsets[4], auditLogs:result.recordsets[5] });
    } catch (error) {
      res.status(500).json({ success:false, error:'Çekirdek yönetim verileri alınamadı.', detail:error.message });
    }
  });

  router.put('/admin/users/:id/access', requirePermission('core.user.manage'), async (req, res) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    try {
      const userId = Number(req.params.id);
      const roleId = Number(req.body?.roleId);
      const isActive = req.body?.isActive !== false;
      if (!Number.isInteger(userId) || !Number.isInteger(roleId)) return res.status(400).json({ success:false, error:'Kullanıcı ve rol zorunludur.' });
      await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      await new sql.Request(transaction).input('KullaniciId',sql.Int,userId).input('CompanyId',sql.Int,req.companyId).input('IsActive',sql.Bit,isActive).query(`
        MERGE dbo.UserCompanies AS t USING (SELECT @KullaniciId KullaniciId,@CompanyId CompanyId) s
        ON t.KullaniciId=s.KullaniciId AND t.CompanyId=s.CompanyId
        WHEN MATCHED THEN UPDATE SET IsActive=@IsActive,UpdatedAt=SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT(KullaniciId,CompanyId,IsActive,IsDefault) VALUES(@KullaniciId,@CompanyId,@IsActive,0);
      `);
      await new sql.Request(transaction).input('KullaniciId',sql.Int,userId).input('CompanyId',sql.Int,req.companyId).input('RoleId',sql.Int,roleId).query(`
        MERGE dbo.UserRoles AS t USING (SELECT @KullaniciId KullaniciId,@CompanyId CompanyId) s
        ON t.KullaniciId=s.KullaniciId AND t.CompanyId=s.CompanyId
        WHEN MATCHED THEN UPDATE SET RoleId=@RoleId
        WHEN NOT MATCHED THEN INSERT(KullaniciId,CompanyId,RoleId) VALUES(@KullaniciId,@CompanyId,@RoleId);
      `);
      await writeAudit({poolPromise,sql,companyId:req.companyId,userId:req.auth.userId,actionCode:'USER_ACCESS_UPDATE',entityType:'Kullanici',entityId:userId,after:{roleId,isActive},req,transaction});
      await transaction.commit();
      res.json({success:true});
    } catch (error) {
      try { await transaction.rollback(); } catch (_) {}
      res.status(error.number===547?400:500).json({success:false,error:'Kullanıcı erişimi güncellenemedi.',detail:error.message});
    }
  });

  router.post('/admin/fiscal-periods', requirePermission('core.period.manage'), async (req, res) => {
    try {
      const { periodCode,periodName,startDate,endDate,status='Open' }=req.body||{};
      if (!periodCode||!periodName||!startDate||!endDate) return res.status(400).json({success:false,error:'Dönem kodu, adı ve tarihleri zorunludur.'});
      const pool=await poolPromise;
      const result=await pool.request().input('CompanyId',sql.Int,req.companyId).input('PeriodCode',sql.NVarChar(32),periodCode).input('PeriodName',sql.NVarChar(120),periodName).input('StartDate',sql.Date,startDate).input('EndDate',sql.Date,endDate).input('Status',sql.NVarChar(16),status).input('UserId',sql.Int,req.auth.userId).query(`
        MERGE dbo.FiscalPeriods AS t USING(SELECT @CompanyId CompanyId,@PeriodCode PeriodCode) s ON t.CompanyId=s.CompanyId AND t.PeriodCode=s.PeriodCode
        WHEN MATCHED THEN UPDATE SET PeriodName=@PeriodName,StartDate=@StartDate,EndDate=@EndDate,Status=@Status,UpdatedAt=SYSUTCDATETIME(),ClosedAt=CASE WHEN @Status=N'Closed' THEN SYSUTCDATETIME() ELSE NULL END,ClosedBy=CASE WHEN @Status=N'Closed' THEN @UserId ELSE NULL END
        WHEN NOT MATCHED THEN INSERT(CompanyId,PeriodCode,PeriodName,StartDate,EndDate,Status) VALUES(@CompanyId,@PeriodCode,@PeriodName,@StartDate,@EndDate,@Status)
        OUTPUT INSERTED.*;
      `);
      await writeAudit({poolPromise,sql,companyId:req.companyId,userId:req.auth.userId,actionCode:'FISCAL_PERIOD_UPSERT',entityType:'FiscalPeriod',entityId:result.recordset[0].PeriodId,after:result.recordset[0],req});
      res.json({success:true,data:result.recordset[0]});
    } catch(error){res.status(500).json({success:false,error:'Mali dönem kaydedilemedi.',detail:error.message});}
  });

  router.post('/admin/number-series', requirePermission('core.numberSeries.manage'), async (req,res)=>{
    try{
      const {documentType,prefix='',suffix='',padding=6,resetYearly=true,isActive=true}=req.body||{};
      if(!documentType) return res.status(400).json({success:false,error:'Belge türü zorunludur.'});
      const pool=await poolPromise;
      const result=await pool.request().input('CompanyId',sql.Int,req.companyId).input('DocumentType',sql.NVarChar(64),String(documentType).toUpperCase()).input('Prefix',sql.NVarChar(24),prefix).input('Suffix',sql.NVarChar(24),suffix).input('Padding',sql.Int,Number(padding)).input('ResetYearly',sql.Bit,Boolean(resetYearly)).input('IsActive',sql.Bit,Boolean(isActive)).query(`
        MERGE dbo.NumberSeries AS t USING(SELECT @CompanyId CompanyId,@DocumentType DocumentType)s ON t.CompanyId=s.CompanyId AND t.DocumentType=s.DocumentType
        WHEN MATCHED THEN UPDATE SET Prefix=@Prefix,Suffix=@Suffix,Padding=@Padding,ResetYearly=@ResetYearly,IsActive=@IsActive,UpdatedAt=SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT(CompanyId,DocumentType,Prefix,Suffix,Padding,ResetYearly,IsActive) VALUES(@CompanyId,@DocumentType,@Prefix,@Suffix,@Padding,@ResetYearly,@IsActive)
        OUTPUT INSERTED.NumberSeriesId,INSERTED.DocumentType,INSERTED.Prefix,INSERTED.Suffix,INSERTED.Padding,INSERTED.ResetYearly,INSERTED.LastNumber,INSERTED.IsActive;
      `);
      await writeAudit({poolPromise,sql,companyId:req.companyId,userId:req.auth.userId,actionCode:'NUMBER_SERIES_UPSERT',entityType:'NumberSeries',entityId:result.recordset[0].NumberSeriesId,after:result.recordset[0],req});
      res.json({success:true,data:result.recordset[0]});
    }catch(error){res.status(500).json({success:false,error:'Numara serisi kaydedilemedi.',detail:error.message});}
  });

  router.post('/number-series/:documentType/next', requirePermission('core.numberSeries.next'), async(req,res)=>{
    try{const number=await nextDocumentNumber({poolPromise,sql,companyId:req.companyId,documentType:req.params.documentType});res.json({success:true,number});}
    catch(error){res.status(error.statusCode||500).json({success:false,error:error.message});}
  });

  router.post('/periods/check', async(req,res)=>{
    try{const period=await assertPeriodOpen({poolPromise,sql,companyId:req.companyId,operationDate:req.body?.operationDate,moduleCode:req.body?.moduleCode});res.json({success:true,period});}
    catch(error){res.status(error.statusCode||500).json({success:false,error:error.message});}
  });

  router.get('/audit-logs', requirePermission('core.audit.read'), async(req,res)=>{
    const limit=Math.min(Math.max(Number(req.query.limit)||100,1),500);
    const pool=await poolPromise;
    const result=await pool.request().input('CompanyId',sql.Int,req.companyId).input('Limit',sql.Int,limit).query(`SELECT TOP (@Limit) a.*,k.KullaniciAdi FROM dbo.AuditLogs a LEFT JOIN dbo.Kullanicilar k ON k.KullaniciId=a.KullaniciId WHERE a.CompanyId=@CompanyId ORDER BY a.AuditLogId DESC;`);
    res.json(result.recordset);
  });

  app.use('/api/core',router);
};
