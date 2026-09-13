/* 035 V2 - KolayBi operasyonel kayıtları arasındaki ALYA ilişkilerini kurar. Veri silmez. */
SET NOCOUNT ON;SET XACT_ABORT ON;
IF OBJECT_ID(N'dbo.KolaybiBusinessMappings',N'U') IS NULL THROW 53501,N'Önce güncel 033 migrationını çalıştırın.',1;
IF OBJECT_ID(N'dbo.BelgeBaglantilari',N'U') IS NULL THROW 53502,N'Önce 014 migrationını çalıştırın.',1;
IF OBJECT_ID(N'dbo.CariDefterHareketleri',N'U') IS NULL THROW 53503,N'Önce 015 migrationını çalıştırın.',1;
IF OBJECT_ID(N'dbo.FinansHareket',N'U') IS NULL THROW 53504,N'dbo.FinansHareket eksik. Güncel 033 V2 migrationını çalıştırın.',1;
IF OBJECT_ID(N'dbo.CariHareket',N'U') IS NULL THROW 53505,N'dbo.CariHareket eksik. Güncel 034 migrationını çalıştırın.',1;
IF COL_LENGTH(N'dbo.Faturalar',N'CariId') IS NULL EXEC sys.sp_executesql N'ALTER TABLE dbo.Faturalar ADD CariId INT NULL;';
IF COL_LENGTH(N'dbo.Siparisler',N'CariId') IS NULL EXEC sys.sp_executesql N'ALTER TABLE dbo.Siparisler ADD CariId INT NULL;';
IF COL_LENGTH(N'dbo.FinansHareket',N'CariId') IS NULL EXEC sys.sp_executesql N'ALTER TABLE dbo.FinansHareket ADD CariId INT NULL;';
IF COL_LENGTH(N'dbo.CariHareket',N'CariId') IS NULL EXEC sys.sp_executesql N'ALTER TABLE dbo.CariHareket ADD CariId INT NULL;';
IF COL_LENGTH(N'dbo.SiparisDetay',N'UrunId') IS NULL EXEC sys.sp_executesql N'ALTER TABLE dbo.SiparisDetay ADD UrunId INT NULL;';
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.Faturalar') AND name=N'IX_Faturalar_CariId') EXEC sys.sp_executesql N'CREATE INDEX IX_Faturalar_CariId ON dbo.Faturalar(CompanyId,CariId,FaturaTarihi);';
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.Siparisler') AND name=N'IX_Siparisler_CariId') EXEC sys.sp_executesql N'CREATE INDEX IX_Siparisler_CariId ON dbo.Siparisler(CompanyId,CariId,SiparisTarihi);';
IF OBJECT_ID(N'dbo.KolaybiLinkRuns',N'U') IS NULL EXEC sys.sp_executesql N'CREATE TABLE dbo.KolaybiLinkRuns(LinkRunId BIGINT IDENTITY PRIMARY KEY,CompanyId INT NOT NULL,LinkedCount INT NOT NULL DEFAULT 0,UnmatchedCount INT NOT NULL DEFAULT 0,SummaryJson NVARCHAR(MAX),CreatedBy INT,CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),CONSTRAINT FK_KolaybiLinkRuns_Company FOREIGN KEY(CompanyId) REFERENCES dbo.Sirketler(CompanyId));';
IF EXISTS(SELECT 1 FROM sys.security_policies WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')) AND OBJECT_ID(N'dbo.fn_CompanyIsolationPredicate',N'IF') IS NOT NULL BEGIN
 IF NOT EXISTS(SELECT 1 FROM sys.security_predicates WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation') AND target_object_id=OBJECT_ID(N'dbo.KolaybiLinkRuns') AND predicate_type=0) EXEC sys.sp_executesql N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.KolaybiLinkRuns;';
 IF NOT EXISTS(SELECT 1 FROM sys.security_predicates WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation') AND target_object_id=OBJECT_ID(N'dbo.KolaybiLinkRuns') AND predicate_type=1 AND operation=1) EXEC sys.sp_executesql N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.KolaybiLinkRuns AFTER INSERT;';
END;
PRINT N'035 V2 KolayBi ilişki uzlaştırma altyapısı tamamlandı.';
GO
