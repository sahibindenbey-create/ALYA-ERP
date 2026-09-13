/* 037 - Ayrıntı ekranları, KolayBi fatura alanları ve tekrarlayan nakit akışı */
SET NOCOUNT ON;SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.Faturalar',N'U') IS NULL THROW 53701,N'dbo.Faturalar bulunamadı.',1;
IF COL_LENGTH(N'dbo.Faturalar',N'ParaBirimi') IS NULL ALTER TABLE dbo.Faturalar ADD ParaBirimi NVARCHAR(10) NOT NULL CONSTRAINT DF_Faturalar_ParaBirimi_037 DEFAULT N'TRY' WITH VALUES;
IF COL_LENGTH(N'dbo.Faturalar',N'OdenenTutar') IS NULL ALTER TABLE dbo.Faturalar ADD OdenenTutar DECIMAL(18,2) NOT NULL CONSTRAINT DF_Faturalar_OdenenTutar_037 DEFAULT(0) WITH VALUES;
IF COL_LENGTH(N'dbo.Faturalar',N'KolaybiExternalId') IS NULL ALTER TABLE dbo.Faturalar ADD KolaybiExternalId NVARCHAR(255) NULL;
IF COL_LENGTH(N'dbo.Faturalar',N'KdvDahilMi') IS NULL ALTER TABLE dbo.Faturalar ADD KdvDahilMi BIT NULL;
IF COL_LENGTH(N'dbo.FaturaDetay',N'IskontoOrani') IS NULL ALTER TABLE dbo.FaturaDetay ADD IskontoOrani DECIMAL(9,4) NOT NULL CONSTRAINT DF_FaturaDetay_Iskonto_037 DEFAULT(0) WITH VALUES;
IF COL_LENGTH(N'dbo.FaturaDetay',N'NetTutar') IS NULL ALTER TABLE dbo.FaturaDetay ADD NetTutar DECIMAL(18,2) NULL;
IF COL_LENGTH(N'dbo.FaturaDetay',N'BrutTutar') IS NULL ALTER TABLE dbo.FaturaDetay ADD BrutTutar DECIMAL(18,2) NULL;

IF OBJECT_ID(N'dbo.TekrarlayanNakitAkisi',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.TekrarlayanNakitAkisi(
  TekrarlayanId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TekrarlayanNakitAkisi PRIMARY KEY,
  CompanyId INT NOT NULL,
  Baslik NVARCHAR(250) NOT NULL,
  Tip NVARCHAR(20) NOT NULL,
  CariKodu NVARCHAR(100) NULL,
  CariAdi NVARCHAR(250) NULL,
  Tutar DECIMAL(18,2) NOT NULL,
  ParaBirimi NVARCHAR(10) NOT NULL CONSTRAINT DF_TekrarlayanNakit_ParaBirimi DEFAULT N'TRY',
  BaslangicTarihi DATE NOT NULL,
  BitisTarihi DATE NULL,
  TekrarTipi NVARCHAR(20) NOT NULL CONSTRAINT DF_TekrarlayanNakit_Tekrar DEFAULT N'Aylık',
  TekrarAraligi INT NOT NULL CONSTRAINT DF_TekrarlayanNakit_Aralik DEFAULT(1),
  AyinGunu TINYINT NULL,
  Aciklama NVARCHAR(500) NULL,
  IsActive BIT NOT NULL CONSTRAINT DF_TekrarlayanNakit_IsActive DEFAULT(1),
  CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_TekrarlayanNakit_Created DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(3) NULL,
  CONSTRAINT CK_TekrarlayanNakit_Tip CHECK(Tip IN(N'Alacak',N'Ödeme')),
  CONSTRAINT CK_TekrarlayanNakit_Aralik CHECK(TekrarAraligi BETWEEN 1 AND 120),
  CONSTRAINT FK_TekrarlayanNakit_Company FOREIGN KEY(CompanyId) REFERENCES dbo.Sirketler(CompanyId)
 );
END;
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.TekrarlayanNakitAkisi') AND name=N'IX_TekrarlayanNakit_CompanyDate') CREATE INDEX IX_TekrarlayanNakit_CompanyDate ON dbo.TekrarlayanNakitAkisi(CompanyId,IsActive,BaslangicTarihi,BitisTarihi);

IF OBJECT_ID(N'dbo.PersonelCariAtamalari',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.PersonelCariAtamalari(
  AtamaId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PersonelCariAtamalari PRIMARY KEY,
  CompanyId INT NOT NULL,PersonelId INT NOT NULL,CariId INT NOT NULL,
  Rol NVARCHAR(80) NULL,Notlar NVARCHAR(500) NULL,IsActive BIT NOT NULL CONSTRAINT DF_PersonelCariAtama_IsActive DEFAULT(1),
  CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_PersonelCariAtama_Created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_PersonelCariAtamalari UNIQUE(CompanyId,PersonelId,CariId),
  CONSTRAINT FK_PersonelCariAtama_Company FOREIGN KEY(CompanyId) REFERENCES dbo.Sirketler(CompanyId)
 );
END;

IF EXISTS(SELECT 1 FROM sys.security_policies WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')) AND OBJECT_ID(N'dbo.fn_CompanyIsolationPredicate',N'IF') IS NOT NULL
BEGIN
 DECLARE @T TABLE(N SYSNAME);INSERT @T VALUES(N'TekrarlayanNakitAkisi'),(N'PersonelCariAtamalari');DECLARE @N SYSNAME,@Q NVARCHAR(MAX);DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT N FROM @T;OPEN c;FETCH NEXT FROM c INTO @N;WHILE @@FETCH_STATUS=0 BEGIN
  IF NOT EXISTS(SELECT 1 FROM sys.security_predicates WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation') AND target_object_id=OBJECT_ID(N'dbo.'+@N) AND predicate_type=0) BEGIN SET @Q=N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.'+QUOTENAME(@N)+N';';EXEC sys.sp_executesql @Q;END;
  IF NOT EXISTS(SELECT 1 FROM sys.security_predicates WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation') AND target_object_id=OBJECT_ID(N'dbo.'+@N) AND predicate_type=1 AND operation=1) BEGIN SET @Q=N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.'+QUOTENAME(@N)+N' AFTER INSERT;';EXEC sys.sp_executesql @Q;END;
  IF NOT EXISTS(SELECT 1 FROM sys.security_predicates WHERE object_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation') AND target_object_id=OBJECT_ID(N'dbo.'+@N) AND predicate_type=1 AND operation=2) BEGIN SET @Q=N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.'+QUOTENAME(@N)+N' AFTER UPDATE;';EXEC sys.sp_executesql @Q;END;
  FETCH NEXT FROM c INTO @N;END;CLOSE c;DEALLOCATE c;
END;
PRINT N'037 ayrıntı, fatura ve nakit akışı geliştirmeleri tamamlandı.';
GO
