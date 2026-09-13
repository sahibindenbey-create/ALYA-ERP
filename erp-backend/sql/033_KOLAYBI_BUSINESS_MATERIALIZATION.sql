/* 033 V2 - Sipariş, proforma, kasa/banka ve finans hareketi operasyonel dönüşümü. */
SET NOCOUNT ON;SET XACT_ABORT ON;
IF OBJECT_ID(N'dbo.KolaybiOperationalRecords',N'U') IS NULL THROW 53301,N'Önce 032 migrationını çalıştırın.',1;
IF OBJECT_ID(N'dbo.KasaBanka',N'U') IS NULL THROW 53302,N'dbo.KasaBanka bulunamadı.',1;
IF OBJECT_ID(N'dbo.KolaybiBusinessMappings',N'U') IS NULL EXEC sys.sp_executesql N'CREATE TABLE dbo.KolaybiBusinessMappings(
 MappingId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_KolaybiBusinessMappings PRIMARY KEY,
 CompanyId INT NOT NULL,ResourceType NVARCHAR(80) NOT NULL,ExternalId NVARCHAR(255) NOT NULL,AlyaTable NVARCHAR(80) NOT NULL,AlyaId BIGINT NOT NULL,
 LastMirrorId BIGINT NULL,LastSyncedAt DATETIME2(3) NOT NULL CONSTRAINT DF_KolaybiBusinessMappings_Sync DEFAULT SYSUTCDATETIME(),
 CONSTRAINT UQ_KolaybiBusinessMappings UNIQUE(CompanyId,ResourceType,ExternalId),
 CONSTRAINT FK_KolaybiBusinessMappings_Company FOREIGN KEY(CompanyId) REFERENCES dbo.Sirketler(CompanyId));';
/* Bazı eski kurulumlarda yalnız KasaBankaHareketleri bulunuyor. KolayBi ve yeni finans modülü için kanonik tabloyu eksikse kur. */
IF OBJECT_ID(N'dbo.FinansHareket',N'U') IS NULL EXEC sys.sp_executesql N'CREATE TABLE dbo.FinansHareket(
 HareketId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_FinansHareket PRIMARY KEY,
 CompanyId INT NOT NULL,
 KasaBankaId INT NOT NULL,
 Tarih DATETIME2(3) NOT NULL,
 Tip NVARCHAR(20) NOT NULL,
 Tutar DECIMAL(18,2) NOT NULL,
 Aciklama NVARCHAR(500) NULL,
 Kaynak NVARCHAR(50) NOT NULL CONSTRAINT DF_FinansHareket_Kaynak DEFAULT N''Manuel'',
 CariKodu NVARCHAR(100) NULL,
 CariAdi NVARCHAR(250) NULL,
 CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_FinansHareket_CreatedAt DEFAULT SYSUTCDATETIME(),
 CONSTRAINT FK_FinansHareket_Company FOREIGN KEY(CompanyId) REFERENCES dbo.Sirketler(CompanyId));';
IF COL_LENGTH(N'dbo.FinansHareket',N'CompanyId') IS NULL EXEC sys.sp_executesql N'ALTER TABLE dbo.FinansHareket ADD CompanyId INT NOT NULL CONSTRAINT DF_FinansHareket_CompanyId DEFAULT(1) WITH VALUES;';
IF COL_LENGTH(N'dbo.FinansHareket',N'CariKodu') IS NULL EXEC sys.sp_executesql N'ALTER TABLE dbo.FinansHareket ADD CariKodu NVARCHAR(100) NULL;';
IF COL_LENGTH(N'dbo.FinansHareket',N'CariAdi') IS NULL EXEC sys.sp_executesql N'ALTER TABLE dbo.FinansHareket ADD CariAdi NVARCHAR(250) NULL;';
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.FinansHareket') AND name=N'IX_FinansHareket_Company') EXEC sys.sp_executesql N'CREATE INDEX IX_FinansHareket_Company ON dbo.FinansHareket(CompanyId,Tarih DESC,HareketId DESC);';
IF EXISTS(SELECT 1 FROM sys.security_policies WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')) AND OBJECT_ID(N'dbo.fn_CompanyIsolationPredicate',N'IF') IS NOT NULL BEGIN
 IF NOT EXISTS(SELECT 1 FROM sys.security_predicates WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation') AND target_object_id=OBJECT_ID(N'dbo.KolaybiBusinessMappings') AND predicate_type=0) EXEC sys.sp_executesql N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.KolaybiBusinessMappings;';
 IF NOT EXISTS(SELECT 1 FROM sys.security_predicates WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation') AND target_object_id=OBJECT_ID(N'dbo.KolaybiBusinessMappings') AND predicate_type=1 AND operation=1) EXEC sys.sp_executesql N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.KolaybiBusinessMappings AFTER INSERT;';
 IF NOT EXISTS(SELECT 1 FROM sys.security_predicates WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation') AND target_object_id=OBJECT_ID(N'dbo.KolaybiBusinessMappings') AND predicate_type=1 AND operation=2) EXEC sys.sp_executesql N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.KolaybiBusinessMappings AFTER UPDATE;';
 IF NOT EXISTS(SELECT 1 FROM sys.security_predicates WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation') AND target_object_id=OBJECT_ID(N'dbo.FinansHareket') AND predicate_type=0) EXEC sys.sp_executesql N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.FinansHareket;';
 IF NOT EXISTS(SELECT 1 FROM sys.security_predicates WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation') AND target_object_id=OBJECT_ID(N'dbo.FinansHareket') AND predicate_type=1 AND operation=1) EXEC sys.sp_executesql N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.FinansHareket AFTER INSERT;';
 IF NOT EXISTS(SELECT 1 FROM sys.security_predicates WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation') AND target_object_id=OBJECT_ID(N'dbo.FinansHareket') AND predicate_type=1 AND operation=2) EXEC sys.sp_executesql N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.FinansHareket AFTER UPDATE;';
END;
PRINT N'033 V2 KolayBi iş kayıtları dönüşüm altyapısı tamamlandı.';
GO
