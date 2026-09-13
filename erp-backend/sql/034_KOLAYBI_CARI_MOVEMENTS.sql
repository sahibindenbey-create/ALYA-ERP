/* 034 - KolayBi cari hareketlerini ALYA cari ekstrelerine bağlar. */
SET NOCOUNT ON;SET XACT_ABORT ON;
IF OBJECT_ID(N'dbo.KolaybiBusinessMappings',N'U') IS NULL THROW 53401,N'Önce 033 migrationını çalıştırın.',1;
IF OBJECT_ID(N'dbo.CariHareket',N'U') IS NULL THROW 53402,N'dbo.CariHareket tablosu bulunamadı.',1;
IF COL_LENGTH(N'dbo.CariHareket',N'CompanyId') IS NULL EXEC sys.sp_executesql N'ALTER TABLE dbo.CariHareket ADD CompanyId INT NOT NULL CONSTRAINT DF_CariHareket_CompanyId DEFAULT(1) WITH VALUES;';
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.CariHareket') AND name=N'IX_CariHareket_Company') EXEC sys.sp_executesql N'CREATE INDEX IX_CariHareket_Company ON dbo.CariHareket(CompanyId,CariKodu,Tarih DESC,HareketId DESC);';
IF EXISTS(SELECT 1 FROM sys.security_policies WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')) AND OBJECT_ID(N'dbo.fn_CompanyIsolationPredicate',N'IF') IS NOT NULL BEGIN
 IF NOT EXISTS(SELECT 1 FROM sys.security_predicates WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation') AND target_object_id=OBJECT_ID(N'dbo.CariHareket') AND predicate_type=0) EXEC sys.sp_executesql N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.CariHareket;';
 IF NOT EXISTS(SELECT 1 FROM sys.security_predicates WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation') AND target_object_id=OBJECT_ID(N'dbo.CariHareket') AND predicate_type=1 AND operation=1) EXEC sys.sp_executesql N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.CariHareket AFTER INSERT;';
 IF NOT EXISTS(SELECT 1 FROM sys.security_predicates WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation') AND target_object_id=OBJECT_ID(N'dbo.CariHareket') AND predicate_type=1 AND operation=2) EXEC sys.sp_executesql N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.CariHareket AFTER UPDATE;';
END;
PRINT N'034 KolayBi cari hareketleri altyapısı tamamlandı.';
GO
