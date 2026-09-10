/* ALYA ERP - 011 / Faz 0: yetki, mali dönem, numara, audit ve workflow çekirdeği
   Güvenli ve tekrar çalıştırılabilir migration. Mevcut iş verisini silmez.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRAN;

  IF OBJECT_ID(N'dbo.Sirketler', N'U') IS NULL
    THROW 51101, N'dbo.Sirketler bulunamadı. Önce çoklu şirket migration''ını çalıştırın.', 1;
  IF OBJECT_ID(N'dbo.Kullanicilar', N'U') IS NULL
    THROW 51102, N'dbo.Kullanicilar bulunamadı.', 1;

  IF OBJECT_ID(N'dbo.Roles', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.Roles (
      RoleId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Roles PRIMARY KEY,
      RoleCode NVARCHAR(64) NOT NULL,
      RoleName NVARCHAR(120) NOT NULL,
      Description NVARCHAR(500) NULL,
      IsSystem BIT NOT NULL CONSTRAINT DF_Roles_IsSystem DEFAULT (0),
      IsActive BIT NOT NULL CONSTRAINT DF_Roles_IsActive DEFAULT (1),
      CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Roles_CreatedAt DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Roles_UpdatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT UQ_Roles_RoleCode UNIQUE (RoleCode)
    );
  END;

  IF OBJECT_ID(N'dbo.Permissions', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.Permissions (
      PermissionId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Permissions PRIMARY KEY,
      PermissionCode NVARCHAR(120) NOT NULL,
      PermissionName NVARCHAR(180) NOT NULL,
      ModuleCode NVARCHAR(64) NOT NULL,
      OperationCode NVARCHAR(32) NOT NULL,
      Description NVARCHAR(500) NULL,
      IsActive BIT NOT NULL CONSTRAINT DF_Permissions_IsActive DEFAULT (1),
      CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Permissions_CreatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT UQ_Permissions_PermissionCode UNIQUE (PermissionCode)
    );
  END;

  IF OBJECT_ID(N'dbo.RolePermissions', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.RolePermissions (
      RoleId INT NOT NULL,
      PermissionId INT NOT NULL,
      GrantedAt DATETIME2(3) NOT NULL CONSTRAINT DF_RolePermissions_GrantedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT PK_RolePermissions PRIMARY KEY (RoleId, PermissionId),
      CONSTRAINT FK_RolePermissions_Roles FOREIGN KEY (RoleId) REFERENCES dbo.Roles(RoleId),
      CONSTRAINT FK_RolePermissions_Permissions FOREIGN KEY (PermissionId) REFERENCES dbo.Permissions(PermissionId)
    );
  END;

  IF OBJECT_ID(N'dbo.UserCompanies', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.UserCompanies (
      UserCompanyId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_UserCompanies PRIMARY KEY,
      KullaniciId INT NOT NULL,
      CompanyId INT NOT NULL,
      IsDefault BIT NOT NULL CONSTRAINT DF_UserCompanies_IsDefault DEFAULT (0),
      IsActive BIT NOT NULL CONSTRAINT DF_UserCompanies_IsActive DEFAULT (1),
      CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UserCompanies_CreatedAt DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UserCompanies_UpdatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT UQ_UserCompanies_User_Company UNIQUE (KullaniciId, CompanyId),
      CONSTRAINT FK_UserCompanies_User FOREIGN KEY (KullaniciId) REFERENCES dbo.Kullanicilar(KullaniciId),
      CONSTRAINT FK_UserCompanies_Company FOREIGN KEY (CompanyId) REFERENCES dbo.Sirketler(CompanyId)
    );
    CREATE INDEX IX_UserCompanies_Company_User ON dbo.UserCompanies(CompanyId, KullaniciId) INCLUDE (IsActive, IsDefault);
  END;

  IF OBJECT_ID(N'dbo.UserRoles', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.UserRoles (
      UserRoleId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_UserRoles PRIMARY KEY,
      KullaniciId INT NOT NULL,
      CompanyId INT NOT NULL,
      RoleId INT NOT NULL,
      CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_UserRoles_CreatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT UQ_UserRoles_User_Company UNIQUE (KullaniciId, CompanyId),
      CONSTRAINT FK_UserRoles_User FOREIGN KEY (KullaniciId) REFERENCES dbo.Kullanicilar(KullaniciId),
      CONSTRAINT FK_UserRoles_Company FOREIGN KEY (CompanyId) REFERENCES dbo.Sirketler(CompanyId),
      CONSTRAINT FK_UserRoles_Role FOREIGN KEY (RoleId) REFERENCES dbo.Roles(RoleId)
    );
    CREATE INDEX IX_UserRoles_Company_Role ON dbo.UserRoles(CompanyId, RoleId, KullaniciId);
  END;

  IF OBJECT_ID(N'dbo.FiscalPeriods', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.FiscalPeriods (
      PeriodId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_FiscalPeriods PRIMARY KEY,
      CompanyId INT NOT NULL,
      PeriodCode NVARCHAR(32) NOT NULL,
      PeriodName NVARCHAR(120) NOT NULL,
      StartDate DATE NOT NULL,
      EndDate DATE NOT NULL,
      Status NVARCHAR(16) NOT NULL CONSTRAINT DF_FiscalPeriods_Status DEFAULT (N'Open'),
      ClosedAt DATETIME2(3) NULL,
      ClosedBy INT NULL,
      CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_FiscalPeriods_CreatedAt DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_FiscalPeriods_UpdatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT UQ_FiscalPeriods_Company_Code UNIQUE (CompanyId, PeriodCode),
      CONSTRAINT CK_FiscalPeriods_Dates CHECK (StartDate <= EndDate),
      CONSTRAINT CK_FiscalPeriods_Status CHECK (Status IN (N'Open', N'Locked', N'Closed')),
      CONSTRAINT FK_FiscalPeriods_Company FOREIGN KEY (CompanyId) REFERENCES dbo.Sirketler(CompanyId),
      CONSTRAINT FK_FiscalPeriods_ClosedBy FOREIGN KEY (ClosedBy) REFERENCES dbo.Kullanicilar(KullaniciId)
    );
    CREATE INDEX IX_FiscalPeriods_Company_Dates ON dbo.FiscalPeriods(CompanyId, StartDate, EndDate, Status);
  END;

  IF OBJECT_ID(N'dbo.PeriodLocks', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.PeriodLocks (
      PeriodLockId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PeriodLocks PRIMARY KEY,
      CompanyId INT NOT NULL,
      PeriodId INT NULL,
      ModuleCode NVARCHAR(64) NULL,
      LockStartDate DATE NOT NULL,
      LockEndDate DATE NOT NULL,
      Reason NVARCHAR(500) NULL,
      IsActive BIT NOT NULL CONSTRAINT DF_PeriodLocks_IsActive DEFAULT (1),
      LockedBy INT NULL,
      LockedAt DATETIME2(3) NOT NULL CONSTRAINT DF_PeriodLocks_LockedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT CK_PeriodLocks_Dates CHECK (LockStartDate <= LockEndDate),
      CONSTRAINT FK_PeriodLocks_Company FOREIGN KEY (CompanyId) REFERENCES dbo.Sirketler(CompanyId),
      CONSTRAINT FK_PeriodLocks_Period FOREIGN KEY (PeriodId) REFERENCES dbo.FiscalPeriods(PeriodId),
      CONSTRAINT FK_PeriodLocks_User FOREIGN KEY (LockedBy) REFERENCES dbo.Kullanicilar(KullaniciId)
    );
    CREATE INDEX IX_PeriodLocks_Check ON dbo.PeriodLocks(CompanyId, LockStartDate, LockEndDate, IsActive, ModuleCode);
  END;

  IF OBJECT_ID(N'dbo.NumberSeries', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.NumberSeries (
      NumberSeriesId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_NumberSeries PRIMARY KEY,
      CompanyId INT NOT NULL,
      DocumentType NVARCHAR(64) NOT NULL,
      Prefix NVARCHAR(24) NOT NULL CONSTRAINT DF_NumberSeries_Prefix DEFAULT (N''),
      Suffix NVARCHAR(24) NOT NULL CONSTRAINT DF_NumberSeries_Suffix DEFAULT (N''),
      Padding INT NOT NULL CONSTRAINT DF_NumberSeries_Padding DEFAULT (6),
      ResetYearly BIT NOT NULL CONSTRAINT DF_NumberSeries_ResetYearly DEFAULT (1),
      CurrentYear INT NOT NULL CONSTRAINT DF_NumberSeries_CurrentYear DEFAULT (YEAR(GETDATE())),
      LastNumber BIGINT NOT NULL CONSTRAINT DF_NumberSeries_LastNumber DEFAULT (0),
      IsActive BIT NOT NULL CONSTRAINT DF_NumberSeries_IsActive DEFAULT (1),
      UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_NumberSeries_UpdatedAt DEFAULT SYSUTCDATETIME(),
      RowVersion ROWVERSION NOT NULL,
      CONSTRAINT UQ_NumberSeries_Company_Document UNIQUE (CompanyId, DocumentType),
      CONSTRAINT CK_NumberSeries_Padding CHECK (Padding BETWEEN 1 AND 18),
      CONSTRAINT CK_NumberSeries_LastNumber CHECK (LastNumber >= 0),
      CONSTRAINT FK_NumberSeries_Company FOREIGN KEY (CompanyId) REFERENCES dbo.Sirketler(CompanyId)
    );
  END;

  IF OBJECT_ID(N'dbo.AuditLogs', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.AuditLogs (
      AuditLogId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AuditLogs PRIMARY KEY,
      CompanyId INT NOT NULL,
      KullaniciId INT NULL,
      ActionCode NVARCHAR(64) NOT NULL,
      EntityType NVARCHAR(120) NOT NULL,
      EntityId NVARCHAR(120) NULL,
      BeforeJson NVARCHAR(MAX) NULL,
      AfterJson NVARCHAR(MAX) NULL,
      CorrelationId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_AuditLogs_Correlation DEFAULT NEWID(),
      IpAddress NVARCHAR(64) NULL,
      UserAgent NVARCHAR(500) NULL,
      CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_AuditLogs_CreatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_AuditLogs_Company FOREIGN KEY (CompanyId) REFERENCES dbo.Sirketler(CompanyId),
      CONSTRAINT FK_AuditLogs_User FOREIGN KEY (KullaniciId) REFERENCES dbo.Kullanicilar(KullaniciId),
      CONSTRAINT CK_AuditLogs_BeforeJson CHECK (BeforeJson IS NULL OR ISJSON(BeforeJson) = 1),
      CONSTRAINT CK_AuditLogs_AfterJson CHECK (AfterJson IS NULL OR ISJSON(AfterJson) = 1)
    );
    CREATE INDEX IX_AuditLogs_Company_Date ON dbo.AuditLogs(CompanyId, CreatedAt DESC) INCLUDE (KullaniciId, ActionCode, EntityType, EntityId);
  END;

  IF OBJECT_ID(N'dbo.Workflows', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.Workflows (
      WorkflowId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Workflows PRIMARY KEY,
      CompanyId INT NOT NULL,
      WorkflowCode NVARCHAR(64) NOT NULL,
      WorkflowName NVARCHAR(160) NOT NULL,
      EntityType NVARCHAR(120) NOT NULL,
      IsActive BIT NOT NULL CONSTRAINT DF_Workflows_IsActive DEFAULT (1),
      CreatedBy INT NULL,
      CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Workflows_CreatedAt DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_Workflows_UpdatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT UQ_Workflows_Company_Code UNIQUE (CompanyId, WorkflowCode),
      CONSTRAINT FK_Workflows_Company FOREIGN KEY (CompanyId) REFERENCES dbo.Sirketler(CompanyId),
      CONSTRAINT FK_Workflows_User FOREIGN KEY (CreatedBy) REFERENCES dbo.Kullanicilar(KullaniciId)
    );
  END;

  IF OBJECT_ID(N'dbo.WorkflowSteps', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.WorkflowSteps (
      WorkflowStepId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_WorkflowSteps PRIMARY KEY,
      WorkflowId INT NOT NULL,
      StepOrder INT NOT NULL,
      StepName NVARCHAR(160) NOT NULL,
      ApproverRoleId INT NULL,
      ApproverUserId INT NULL,
      MinimumApprovals INT NOT NULL CONSTRAINT DF_WorkflowSteps_Minimum DEFAULT (1),
      IsFinal BIT NOT NULL CONSTRAINT DF_WorkflowSteps_IsFinal DEFAULT (0),
      CONSTRAINT UQ_WorkflowSteps_Order UNIQUE (WorkflowId, StepOrder),
      CONSTRAINT CK_WorkflowSteps_Order CHECK (StepOrder > 0),
      CONSTRAINT CK_WorkflowSteps_Approver CHECK (ApproverRoleId IS NOT NULL OR ApproverUserId IS NOT NULL),
      CONSTRAINT FK_WorkflowSteps_Workflow FOREIGN KEY (WorkflowId) REFERENCES dbo.Workflows(WorkflowId),
      CONSTRAINT FK_WorkflowSteps_Role FOREIGN KEY (ApproverRoleId) REFERENCES dbo.Roles(RoleId),
      CONSTRAINT FK_WorkflowSteps_User FOREIGN KEY (ApproverUserId) REFERENCES dbo.Kullanicilar(KullaniciId)
    );
  END;

  IF OBJECT_ID(N'dbo.WorkflowInstances', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.WorkflowInstances (
      WorkflowInstanceId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_WorkflowInstances PRIMARY KEY,
      CompanyId INT NOT NULL,
      WorkflowId INT NOT NULL,
      EntityType NVARCHAR(120) NOT NULL,
      EntityId NVARCHAR(120) NOT NULL,
      Status NVARCHAR(20) NOT NULL CONSTRAINT DF_WorkflowInstances_Status DEFAULT (N'Pending'),
      CurrentStepOrder INT NOT NULL CONSTRAINT DF_WorkflowInstances_Step DEFAULT (1),
      RequestedBy INT NOT NULL,
      RequestedAt DATETIME2(3) NOT NULL CONSTRAINT DF_WorkflowInstances_RequestedAt DEFAULT SYSUTCDATETIME(),
      CompletedAt DATETIME2(3) NULL,
      CONSTRAINT CK_WorkflowInstances_Status CHECK (Status IN (N'Pending', N'Approved', N'Rejected', N'Cancelled')),
      CONSTRAINT UQ_WorkflowInstances_Entity UNIQUE (CompanyId, WorkflowId, EntityType, EntityId),
      CONSTRAINT FK_WorkflowInstances_Company FOREIGN KEY (CompanyId) REFERENCES dbo.Sirketler(CompanyId),
      CONSTRAINT FK_WorkflowInstances_Workflow FOREIGN KEY (WorkflowId) REFERENCES dbo.Workflows(WorkflowId),
      CONSTRAINT FK_WorkflowInstances_User FOREIGN KEY (RequestedBy) REFERENCES dbo.Kullanicilar(KullaniciId)
    );
    CREATE INDEX IX_WorkflowInstances_Inbox ON dbo.WorkflowInstances(CompanyId, Status, CurrentStepOrder, RequestedAt);
  END;

  IF OBJECT_ID(N'dbo.WorkflowApprovals', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.WorkflowApprovals (
      WorkflowApprovalId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_WorkflowApprovals PRIMARY KEY,
      CompanyId INT NOT NULL,
      WorkflowInstanceId BIGINT NOT NULL,
      WorkflowStepId INT NOT NULL,
      ApproverUserId INT NOT NULL,
      Decision NVARCHAR(16) NOT NULL,
      Comment NVARCHAR(1000) NULL,
      DecidedAt DATETIME2(3) NOT NULL CONSTRAINT DF_WorkflowApprovals_DecidedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT UQ_WorkflowApprovals_User UNIQUE (WorkflowInstanceId, WorkflowStepId, ApproverUserId),
      CONSTRAINT CK_WorkflowApprovals_Decision CHECK (Decision IN (N'Approved', N'Rejected')),
      CONSTRAINT FK_WorkflowApprovals_Company FOREIGN KEY (CompanyId) REFERENCES dbo.Sirketler(CompanyId),
      CONSTRAINT FK_WorkflowApprovals_Instance FOREIGN KEY (WorkflowInstanceId) REFERENCES dbo.WorkflowInstances(WorkflowInstanceId),
      CONSTRAINT FK_WorkflowApprovals_Step FOREIGN KEY (WorkflowStepId) REFERENCES dbo.WorkflowSteps(WorkflowStepId),
      CONSTRAINT FK_WorkflowApprovals_User FOREIGN KEY (ApproverUserId) REFERENCES dbo.Kullanicilar(KullaniciId)
    );
  END;

  MERGE dbo.Roles AS target
  USING (VALUES
    (N'ADMIN', N'Yönetici', N'Tüm çekirdek yönetim yetkileri', 1),
    (N'USER', N'Kullanıcı', N'Standart işlem kullanıcısı', 1),
    (N'VIEWER', N'Sadece Görüntüleme', N'Salt okunur kullanıcı', 1)
  ) AS source(RoleCode, RoleName, Description, IsSystem)
  ON target.RoleCode = source.RoleCode
  WHEN MATCHED THEN UPDATE SET RoleName=source.RoleName, Description=source.Description, IsActive=1, UpdatedAt=SYSUTCDATETIME()
  WHEN NOT MATCHED THEN INSERT(RoleCode, RoleName, Description, IsSystem) VALUES(source.RoleCode, source.RoleName, source.Description, source.IsSystem);

  MERGE dbo.Permissions AS target
  USING (VALUES
    (N'core.admin', N'Çekirdek yönetimi', N'CORE', N'ADMIN'),
    (N'core.audit.read', N'Denetim kayıtlarını görüntüleme', N'AUDIT', N'READ'),
    (N'core.period.manage', N'Mali dönem yönetimi', N'FISCAL_PERIOD', N'MANAGE'),
    (N'core.numberSeries.manage', N'Belge numara serisi yönetimi', N'NUMBER_SERIES', N'MANAGE'),
    (N'core.numberSeries.next', N'Belge numarası üretme', N'NUMBER_SERIES', N'EXECUTE'),
    (N'core.workflow.manage', N'Onay akışı yönetimi', N'WORKFLOW', N'MANAGE'),
    (N'core.workflow.approve', N'İşlem onaylama', N'WORKFLOW', N'APPROVE'),
    (N'core.user.manage', N'Kullanıcı ve şirket erişimi yönetimi', N'USER', N'MANAGE'),
    (N'erp.read', N'ERP kayıtlarını görüntüleme', N'ERP', N'READ'),
    (N'erp.write', N'ERP kayıtlarını değiştirme', N'ERP', N'WRITE')
  ) AS source(PermissionCode, PermissionName, ModuleCode, OperationCode)
  ON target.PermissionCode = source.PermissionCode
  WHEN MATCHED THEN UPDATE SET PermissionName=source.PermissionName, ModuleCode=source.ModuleCode, OperationCode=source.OperationCode, IsActive=1
  WHEN NOT MATCHED THEN INSERT(PermissionCode, PermissionName, ModuleCode, OperationCode) VALUES(source.PermissionCode, source.PermissionName, source.ModuleCode, source.OperationCode);

  INSERT INTO dbo.RolePermissions(RoleId, PermissionId)
  SELECT r.RoleId, p.PermissionId
  FROM dbo.Roles r CROSS JOIN dbo.Permissions p
  WHERE r.RoleCode = N'ADMIN'
    AND NOT EXISTS (SELECT 1 FROM dbo.RolePermissions rp WHERE rp.RoleId=r.RoleId AND rp.PermissionId=p.PermissionId);

  INSERT INTO dbo.RolePermissions(RoleId, PermissionId)
  SELECT r.RoleId, p.PermissionId
  FROM dbo.Roles r JOIN dbo.Permissions p ON p.PermissionCode IN (N'erp.read', N'erp.write', N'core.numberSeries.next', N'core.workflow.approve')
  WHERE r.RoleCode = N'USER'
    AND NOT EXISTS (SELECT 1 FROM dbo.RolePermissions rp WHERE rp.RoleId=r.RoleId AND rp.PermissionId=p.PermissionId);

  INSERT INTO dbo.RolePermissions(RoleId, PermissionId)
  SELECT r.RoleId, p.PermissionId
  FROM dbo.Roles r JOIN dbo.Permissions p ON p.PermissionCode = N'erp.read'
  WHERE r.RoleCode = N'VIEWER'
    AND NOT EXISTS (SELECT 1 FROM dbo.RolePermissions rp WHERE rp.RoleId=r.RoleId AND rp.PermissionId=p.PermissionId);

  INSERT INTO dbo.UserCompanies(KullaniciId, CompanyId, IsDefault, IsActive)
  SELECT k.KullaniciId, s.CompanyId,
         CASE WHEN s.CompanyId = (SELECT MIN(s2.CompanyId) FROM dbo.Sirketler s2 WHERE s2.IsActive=1) THEN 1 ELSE 0 END,
         1
  FROM dbo.Kullanicilar k CROSS JOIN dbo.Sirketler s
  WHERE s.IsActive=1
    AND NOT EXISTS (SELECT 1 FROM dbo.UserCompanies uc WHERE uc.KullaniciId=k.KullaniciId AND uc.CompanyId=s.CompanyId);

  INSERT INTO dbo.UserRoles(KullaniciId, CompanyId, RoleId)
  SELECT k.KullaniciId, s.CompanyId,
         CASE WHEN k.Rol=N'Yönetici' THEN ra.RoleId
              WHEN k.Rol=N'Sadece Görüntüleme' THEN rv.RoleId
              ELSE ru.RoleId END
  FROM dbo.Kullanicilar k CROSS JOIN dbo.Sirketler s
  CROSS JOIN (SELECT RoleId FROM dbo.Roles WHERE RoleCode=N'ADMIN') ra
  CROSS JOIN (SELECT RoleId FROM dbo.Roles WHERE RoleCode=N'USER') ru
  CROSS JOIN (SELECT RoleId FROM dbo.Roles WHERE RoleCode=N'VIEWER') rv
  WHERE s.IsActive=1
    AND NOT EXISTS (SELECT 1 FROM dbo.UserRoles ur WHERE ur.KullaniciId=k.KullaniciId AND ur.CompanyId=s.CompanyId);

  INSERT INTO dbo.FiscalPeriods(CompanyId, PeriodCode, PeriodName, StartDate, EndDate, Status)
  SELECT s.CompanyId, CONVERT(NVARCHAR(4), YEAR(GETDATE())), CONVERT(NVARCHAR(4), YEAR(GETDATE())) + N' Mali Yılı',
         DATEFROMPARTS(YEAR(GETDATE()),1,1), DATEFROMPARTS(YEAR(GETDATE()),12,31), N'Open'
  FROM dbo.Sirketler s
  WHERE s.IsActive=1
    AND NOT EXISTS (SELECT 1 FROM dbo.FiscalPeriods fp WHERE fp.CompanyId=s.CompanyId AND fp.PeriodCode=CONVERT(NVARCHAR(4), YEAR(GETDATE())));

  INSERT INTO dbo.NumberSeries(CompanyId, DocumentType, Prefix, Padding, ResetYearly)
  SELECT s.CompanyId, d.DocumentType, d.Prefix, 6, 1
  FROM dbo.Sirketler s
  CROSS JOIN (VALUES (N'SIPARIS',N'SPR-'),(N'FATURA',N'FTR-'),(N'IRSALIYE',N'IRS-'),(N'URETIM_EMRI',N'URT-')) d(DocumentType,Prefix)
  WHERE s.IsActive=1
    AND NOT EXISTS (SELECT 1 FROM dbo.NumberSeries ns WHERE ns.CompanyId=s.CompanyId AND ns.DocumentType=d.DocumentType);

  COMMIT;
END TRY
BEGIN CATCH
  IF XACT_STATE() <> 0 ROLLBACK;
  THROW;
END CATCH;

SELECT N'ALYA ERP Faz 0 migration tamamlandı.' AS Result;
