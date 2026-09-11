/* 030 - Yamankaya KolayBi tam veri aynası. İş tablolarına doğrudan belge yazmaz. */
SET NOCOUNT ON;SET XACT_ABORT ON;
IF OBJECT_ID(N'dbo.Sirketler',N'U') IS NULL OR OBJECT_ID(N'dbo.KolaybiAyarlar',N'U') IS NULL THROW 53001,N'Önce KolayBi temel migrationlarını çalıştırın.',1;
IF OBJECT_ID(N'dbo.KolaybiFullSyncRuns',N'U') IS NULL EXEC sys.sp_executesql N'CREATE TABLE dbo.KolaybiFullSyncRuns(
 RunId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_KolaybiFullSyncRuns PRIMARY KEY,CompanyId INT NOT NULL,
 Status NVARCHAR(30) NOT NULL,StartedAt DATETIME2(3) NOT NULL CONSTRAINT DF_KolaybiFullSyncRuns_Started DEFAULT SYSUTCDATETIME(),FinishedAt DATETIME2(3) NULL,
 ResourceCount INT NOT NULL CONSTRAINT DF_KolaybiFullSyncRuns_Resource DEFAULT 0,RecordCount INT NOT NULL CONSTRAINT DF_KolaybiFullSyncRuns_Record DEFAULT 0,
 CreatedCount INT NOT NULL CONSTRAINT DF_KolaybiFullSyncRuns_Created DEFAULT 0,UpdatedCount INT NOT NULL CONSTRAINT DF_KolaybiFullSyncRuns_Updated DEFAULT 0,
 ErrorCount INT NOT NULL CONSTRAINT DF_KolaybiFullSyncRuns_Error DEFAULT 0,SummaryJson NVARCHAR(MAX) NULL,CreatedBy INT NULL,
 CONSTRAINT FK_KolaybiFullSyncRuns_Company FOREIGN KEY(CompanyId) REFERENCES dbo.Sirketler(CompanyId));';
IF OBJECT_ID(N'dbo.KolaybiRawMirror',N'U') IS NULL EXEC sys.sp_executesql N'CREATE TABLE dbo.KolaybiRawMirror(
 MirrorId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_KolaybiRawMirror PRIMARY KEY,CompanyId INT NOT NULL,ResourceType NVARCHAR(80) NOT NULL,
 ExternalId NVARCHAR(255) NOT NULL,ParentExternalId NVARCHAR(255) NOT NULL CONSTRAINT DF_KolaybiRawMirror_Parent DEFAULT N'''',Payload NVARCHAR(MAX) NOT NULL,
 ContentHash CHAR(64) NOT NULL,FirstSeenAt DATETIME2(3) NOT NULL CONSTRAINT DF_KolaybiRawMirror_First DEFAULT SYSUTCDATETIME(),
 LastSeenAt DATETIME2(3) NOT NULL CONSTRAINT DF_KolaybiRawMirror_Last DEFAULT SYSUTCDATETIME(),LastSeenRunId BIGINT NOT NULL,IsActive BIT NOT NULL CONSTRAINT DF_KolaybiRawMirror_Active DEFAULT 1,
 CONSTRAINT UQ_KolaybiRawMirror UNIQUE(CompanyId,ResourceType,ExternalId,ParentExternalId),
 CONSTRAINT FK_KolaybiRawMirror_Company FOREIGN KEY(CompanyId) REFERENCES dbo.Sirketler(CompanyId),
 CONSTRAINT FK_KolaybiRawMirror_Run FOREIGN KEY(LastSeenRunId) REFERENCES dbo.KolaybiFullSyncRuns(RunId));';
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.KolaybiRawMirror') AND name=N'IX_KolaybiRawMirror_Resource') EXEC sys.sp_executesql N'CREATE INDEX IX_KolaybiRawMirror_Resource ON dbo.KolaybiRawMirror(CompanyId,ResourceType,LastSeenAt DESC) INCLUDE(ExternalId,ParentExternalId,IsActive);';
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.KolaybiFullSyncRuns') AND name=N'IX_KolaybiFullSyncRuns_Status') EXEC sys.sp_executesql N'CREATE INDEX IX_KolaybiFullSyncRuns_Status ON dbo.KolaybiFullSyncRuns(CompanyId,StartedAt DESC) INCLUDE(Status,RecordCount,ErrorCount);';
IF EXISTS(SELECT 1 FROM sys.security_policies WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')) AND OBJECT_ID(N'dbo.fn_CompanyIsolationPredicate',N'IF') IS NOT NULL
BEGIN
 DECLARE @T TABLE(N SYSNAME);INSERT @T VALUES(N'KolaybiFullSyncRuns'),(N'KolaybiRawMirror');DECLARE @N SYSNAME,@S NVARCHAR(MAX);DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT N FROM @T;OPEN c;FETCH NEXT FROM c INTO @N;WHILE @@FETCH_STATUS=0 BEGIN
  IF NOT EXISTS(SELECT 1 FROM sys.security_predicates WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation') AND target_object_id=OBJECT_ID(N'dbo.'+@N) AND predicate_type=0) BEGIN SET @S=N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.'+QUOTENAME(@N)+N';';EXEC sys.sp_executesql @S;END;
  IF NOT EXISTS(SELECT 1 FROM sys.security_predicates WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation') AND target_object_id=OBJECT_ID(N'dbo.'+@N) AND predicate_type=1 AND operation=1) BEGIN SET @S=N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.'+QUOTENAME(@N)+N' AFTER INSERT;';EXEC sys.sp_executesql @S;END;
  IF NOT EXISTS(SELECT 1 FROM sys.security_predicates WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation') AND target_object_id=OBJECT_ID(N'dbo.'+@N) AND predicate_type=1 AND operation=2) BEGIN SET @S=N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.'+QUOTENAME(@N)+N' AFTER UPDATE;';EXEC sys.sp_executesql @S;END;
 FETCH NEXT FROM c INTO @N;END;CLOSE c;DEALLOCATE c;
END;
PRINT N'030 Yamankaya KolayBi tam veri aynası tamamlandı.';
GO
