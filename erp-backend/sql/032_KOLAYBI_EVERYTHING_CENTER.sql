/* 032 - KolayBi'den gelen her kaydı ALYA içinde erişilebilir operasyonel merkeze alır. */
SET NOCOUNT ON;SET XACT_ABORT ON;
IF OBJECT_ID(N'dbo.KolaybiRawMirror',N'U') IS NULL THROW 53201,N'Önce 030 migrationını çalıştırın.',1;
IF OBJECT_ID(N'dbo.KolaybiOperationalRecords',N'U') IS NULL EXEC sys.sp_executesql N'CREATE TABLE dbo.KolaybiOperationalRecords(
 RecordId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_KolaybiOperationalRecords PRIMARY KEY,CompanyId INT NOT NULL,ResourceType NVARCHAR(80) NOT NULL,
 ExternalId NVARCHAR(255) NOT NULL,ParentExternalId NVARCHAR(255) NOT NULL CONSTRAINT DF_KolaybiOperationalRecords_Parent DEFAULT N'''',RecordDate DATETIME2(3) NULL,
 DocumentNo NVARCHAR(150) NULL,DisplayName NVARCHAR(500) NULL,RelatedExternalId NVARCHAR(255) NULL,Amount DECIMAL(19,4) NULL,Currency NVARCHAR(20) NULL,
 RecordStatus NVARCHAR(150) NULL,SearchText NVARCHAR(1500) NULL,Payload NVARCHAR(MAX) NOT NULL,SourceMirrorId BIGINT NOT NULL,LastSyncedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
 CONSTRAINT UQ_KolaybiOperationalRecords UNIQUE(CompanyId,ResourceType,ExternalId,ParentExternalId),CONSTRAINT FK_KolaybiOperationalRecords_Company FOREIGN KEY(CompanyId) REFERENCES dbo.Sirketler(CompanyId));';
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.KolaybiOperationalRecords') AND name=N'IX_KolaybiOperationalRecords_Search') EXEC sys.sp_executesql N'CREATE INDEX IX_KolaybiOperationalRecords_Search ON dbo.KolaybiOperationalRecords(CompanyId,ResourceType,RecordDate DESC) INCLUDE(DocumentNo,DisplayName,Amount,Currency,RecordStatus);';
IF EXISTS(SELECT 1 FROM sys.security_policies WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')) AND OBJECT_ID(N'dbo.fn_CompanyIsolationPredicate',N'IF') IS NOT NULL BEGIN
 IF NOT EXISTS(SELECT 1 FROM sys.security_predicates WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation') AND target_object_id=OBJECT_ID(N'dbo.KolaybiOperationalRecords') AND predicate_type=0) EXEC sys.sp_executesql N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.KolaybiOperationalRecords;';
 IF NOT EXISTS(SELECT 1 FROM sys.security_predicates WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation') AND target_object_id=OBJECT_ID(N'dbo.KolaybiOperationalRecords') AND predicate_type=1 AND operation=1) EXEC sys.sp_executesql N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.KolaybiOperationalRecords AFTER INSERT;';
 IF NOT EXISTS(SELECT 1 FROM sys.security_predicates WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation') AND target_object_id=OBJECT_ID(N'dbo.KolaybiOperationalRecords') AND predicate_type=1 AND operation=2) EXEC sys.sp_executesql N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.KolaybiOperationalRecords AFTER UPDATE;';
END;
PRINT N'032 KolayBi tüm veri merkezi tamamlandı.';
GO
