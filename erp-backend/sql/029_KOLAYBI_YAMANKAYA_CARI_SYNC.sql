/* 029 - Yamankaya KolayBi cari aktarım eşlemeleri */
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>N'myERP' PRINT N'Uyarı: Migration myERP dışında çalıştırılıyor: '+DB_NAME();
IF OBJECT_ID(N'dbo.Sirketler',N'U') IS NULL THROW 52901,N'Önce şirket altyapısını kurun.',1;
IF OBJECT_ID(N'dbo.CariListesi',N'U') IS NULL THROW 52902,N'dbo.CariListesi bulunamadı.',1;
IF OBJECT_ID(N'dbo.KolaybiAyarlar',N'U') IS NULL OR COL_LENGTH(N'dbo.KolaybiAyarlar',N'LastConnectionTestAt') IS NULL THROW 52903,N'Önce 028_KOLAYBI_YAMANKAYA_LIVE.sql migrationını çalıştırın.',1;
IF COL_LENGTH(N'dbo.CariListesi',N'Notlar') IS NULL EXEC sys.sp_executesql N'ALTER TABLE dbo.CariListesi ADD Notlar NVARCHAR(1000) NULL;';
IF OBJECT_ID(N'dbo.KolaybiCariEslemeleri',N'U') IS NULL
EXEC sys.sp_executesql N'CREATE TABLE dbo.KolaybiCariEslemeleri(
 MappingId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_KolaybiCariEslemeleri PRIMARY KEY,
 CompanyId INT NOT NULL, KolaybiAssociateId NVARCHAR(100) NOT NULL, CariId INT NULL,
 KolaybiCode NVARCHAR(100) NULL, KolaybiName NVARCHAR(250) NOT NULL, Payload NVARCHAR(MAX) NOT NULL,
 SyncStatus NVARCHAR(30) NOT NULL, LastError NVARCHAR(1000) NULL,
 LastSyncedAt DATETIME2(3) NOT NULL CONSTRAINT DF_KolaybiCariEslemeleri_LastSync DEFAULT SYSUTCDATETIME(),
 CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_KolaybiCariEslemeleri_Created DEFAULT SYSUTCDATETIME(),
 UpdatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_KolaybiCariEslemeleri_Updated DEFAULT SYSUTCDATETIME(),
 CONSTRAINT UQ_KolaybiCariEslemeleri UNIQUE(CompanyId,KolaybiAssociateId),
 CONSTRAINT FK_KolaybiCariEslemeleri_Company FOREIGN KEY(CompanyId) REFERENCES dbo.Sirketler(CompanyId));';
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.KolaybiCariEslemeleri') AND name=N'IX_KolaybiCariEslemeleri_Cari') EXEC sys.sp_executesql N'CREATE INDEX IX_KolaybiCariEslemeleri_Cari ON dbo.KolaybiCariEslemeleri(CompanyId,CariId) INCLUDE(KolaybiAssociateId,SyncStatus,LastSyncedAt);';
IF EXISTS(SELECT 1 FROM sys.security_policies WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')) AND OBJECT_ID(N'dbo.fn_CompanyIsolationPredicate',N'IF') IS NOT NULL
BEGIN
 IF NOT EXISTS(SELECT 1 FROM sys.security_predicates WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation') AND target_object_id=OBJECT_ID(N'dbo.KolaybiCariEslemeleri') AND predicate_type=0)
  EXEC sys.sp_executesql N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.KolaybiCariEslemeleri;';
 /* sys.security_predicates.operation: 1=AFTER INSERT, 2=AFTER UPDATE */
 IF NOT EXISTS(SELECT 1 FROM sys.security_predicates WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation') AND target_object_id=OBJECT_ID(N'dbo.KolaybiCariEslemeleri') AND predicate_type=1 AND operation=1)
  EXEC sys.sp_executesql N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.KolaybiCariEslemeleri AFTER INSERT;';
 IF NOT EXISTS(SELECT 1 FROM sys.security_predicates WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation') AND target_object_id=OBJECT_ID(N'dbo.KolaybiCariEslemeleri') AND predicate_type=1 AND operation=2)
  EXEC sys.sp_executesql N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.KolaybiCariEslemeleri AFTER UPDATE;';
END;
PRINT N'029 Yamankaya KolayBi cari aktarım altyapısı tamamlandı.';
GO
