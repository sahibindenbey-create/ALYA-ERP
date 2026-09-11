SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRY
BEGIN TRAN;

IF OBJECT_ID(N'dbo.IkDepartmanlar',N'U') IS NULL
CREATE TABLE dbo.IkDepartmanlar(
  DepartmanId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_IkDepartmanlar PRIMARY KEY,
  CompanyId INT NOT NULL,
  DepartmanKodu NVARCHAR(40) NOT NULL,
  DepartmanAdi NVARCHAR(160) NOT NULL,
  YoneticiPersonelId INT NULL,
  IsActive BIT NOT NULL CONSTRAINT DF_IkDepartmanlar_IsActive DEFAULT(1),
  CreatedBy INT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_IkDepartmanlar_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NULL,
  CONSTRAINT UX_IkDepartmanlar_CompanyKod UNIQUE(CompanyId,DepartmanKodu)
);

IF OBJECT_ID(N'dbo.IkGorevler',N'U') IS NULL
CREATE TABLE dbo.IkGorevler(
  GorevId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_IkGorevler PRIMARY KEY,
  CompanyId INT NOT NULL,
  DepartmanId BIGINT NOT NULL,
  GorevKodu NVARCHAR(40) NOT NULL,
  GorevAdi NVARCHAR(160) NOT NULL,
  Aciklama NVARCHAR(600) NULL,
  IsActive BIT NOT NULL CONSTRAINT DF_IkGorevler_IsActive DEFAULT(1),
  CreatedBy INT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_IkGorevler_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_IkGorevler_Departman FOREIGN KEY(DepartmanId) REFERENCES dbo.IkDepartmanlar(DepartmanId),
  CONSTRAINT UX_IkGorevler_CompanyKod UNIQUE(CompanyId,GorevKodu)
);

IF OBJECT_ID(N'dbo.IkPersonelAtamalari',N'U') IS NULL
CREATE TABLE dbo.IkPersonelAtamalari(
  AtamaId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_IkPersonelAtamalari PRIMARY KEY,
  CompanyId INT NOT NULL,
  PersonelId INT NOT NULL,
  DepartmanId BIGINT NULL,
  GorevId BIGINT NULL,
  BaslangicTarihi DATE NOT NULL,
  BitisTarihi DATE NULL,
  IsActive BIT NOT NULL CONSTRAINT DF_IkPersonelAtamalari_IsActive DEFAULT(1),
  Aciklama NVARCHAR(500) NULL,
  CreatedBy INT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_IkPersonelAtamalari_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_IkAtama_Departman FOREIGN KEY(DepartmanId) REFERENCES dbo.IkDepartmanlar(DepartmanId),
  CONSTRAINT FK_IkAtama_Gorev FOREIGN KEY(GorevId) REFERENCES dbo.IkGorevler(GorevId),
  CONSTRAINT CK_IkAtama_Tarih CHECK(BitisTarihi IS NULL OR BitisTarihi>=BaslangicTarihi)
);

IF OBJECT_ID(N'dbo.IkMesailer',N'U') IS NULL
CREATE TABLE dbo.IkMesailer(
  MesaiId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_IkMesailer PRIMARY KEY,
  CompanyId INT NOT NULL,
  PersonelId INT NOT NULL,
  Tarih DATE NOT NULL,
  BaslangicSaati TIME(0) NULL,
  BitisSaati TIME(0) NULL,
  SureSaat DECIMAL(8,2) NOT NULL,
  MesaiTuru NVARCHAR(30) NOT NULL CONSTRAINT DF_IkMesailer_Tur DEFAULT N'Normal',
  SaatUcreti DECIMAL(18,2) NOT NULL CONSTRAINT DF_IkMesailer_Ucret DEFAULT(0),
  Tutar AS CONVERT(DECIMAL(18,2),SureSaat*SaatUcreti) PERSISTED,
  OnayDurumu NVARCHAR(24) NOT NULL CONSTRAINT DF_IkMesailer_Durum DEFAULT N'Bekliyor',
  Aciklama NVARCHAR(500) NULL,
  CreatedBy INT NULL,
  ApprovedBy INT NULL,
  ApprovedAt DATETIME2(0) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_IkMesailer_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_IkMesailer_Sure CHECK(SureSaat>0 AND SureSaat<=24),
  CONSTRAINT CK_IkMesailer_Durum CHECK(OnayDurumu IN(N'Bekliyor',N'Onaylandı',N'Reddedildi'))
);

IF OBJECT_ID(N'dbo.IkAvanslar',N'U') IS NULL
CREATE TABLE dbo.IkAvanslar(
  AvansId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_IkAvanslar PRIMARY KEY,
  CompanyId INT NOT NULL,
  PersonelId INT NOT NULL,
  TalepTarihi DATE NOT NULL,
  Tutar DECIMAL(18,2) NOT NULL,
  Durum NVARCHAR(24) NOT NULL CONSTRAINT DF_IkAvanslar_Durum DEFAULT N'Bekliyor',
  OdemeTarihi DATE NULL,
  Aciklama NVARCHAR(500) NULL,
  CreatedBy INT NULL,
  ApprovedBy INT NULL,
  ApprovedAt DATETIME2(0) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_IkAvanslar_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_IkAvanslar_Tutar CHECK(Tutar>0),
  CONSTRAINT CK_IkAvanslar_Durum CHECK(Durum IN(N'Bekliyor',N'Onaylandı',N'Reddedildi',N'Ödendi'))
);

IF OBJECT_ID(N'dbo.IkPerformansDegerlendirmeleri',N'U') IS NULL
CREATE TABLE dbo.IkPerformansDegerlendirmeleri(
  DegerlendirmeId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_IkPerformans PRIMARY KEY,
  CompanyId INT NOT NULL,
  PersonelId INT NOT NULL,
  Donem NVARCHAR(30) NOT NULL,
  HedefPuani DECIMAL(5,2) NOT NULL,
  YetkinlikPuani DECIMAL(5,2) NOT NULL,
  DavranisPuani DECIMAL(5,2) NOT NULL,
  GenelPuan AS CONVERT(DECIMAL(5,2),(HedefPuani+YetkinlikPuani+DavranisPuani)/3.0) PERSISTED,
  DegerlendirenPersonelId INT NULL,
  Durum NVARCHAR(24) NOT NULL CONSTRAINT DF_IkPerformans_Durum DEFAULT N'Taslak',
  Notlar NVARCHAR(1000) NULL,
  CreatedBy INT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_IkPerformans_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_IkPerformans_Puan CHECK(HedefPuani BETWEEN 0 AND 100 AND YetkinlikPuani BETWEEN 0 AND 100 AND DavranisPuani BETWEEN 0 AND 100),
  CONSTRAINT UX_IkPerformans_Donem UNIQUE(CompanyId,PersonelId,Donem)
);

IF OBJECT_ID(N'dbo.IkEgitimler',N'U') IS NULL
CREATE TABLE dbo.IkEgitimler(
  EgitimId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_IkEgitimler PRIMARY KEY,
  CompanyId INT NOT NULL,
  EgitimAdi NVARCHAR(200) NOT NULL,
  EgitimTuru NVARCHAR(50) NULL,
  BaslangicTarihi DATE NOT NULL,
  BitisTarihi DATE NULL,
  Egitmen NVARCHAR(160) NULL,
  Maliyet DECIMAL(18,2) NOT NULL CONSTRAINT DF_IkEgitimler_Maliyet DEFAULT(0),
  Durum NVARCHAR(24) NOT NULL CONSTRAINT DF_IkEgitimler_Durum DEFAULT N'Planlandı',
  Aciklama NVARCHAR(800) NULL,
  CreatedBy INT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_IkEgitimler_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_IkEgitimler_Tarih CHECK(BitisTarihi IS NULL OR BitisTarihi>=BaslangicTarihi)
);

IF OBJECT_ID(N'dbo.IkEgitimKatilimlari',N'U') IS NULL
CREATE TABLE dbo.IkEgitimKatilimlari(
  KatilimId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_IkEgitimKatilimlari PRIMARY KEY,
  CompanyId INT NOT NULL,
  EgitimId BIGINT NOT NULL,
  PersonelId INT NOT NULL,
  KatilimDurumu NVARCHAR(24) NOT NULL CONSTRAINT DF_IkEgitimKatilim_Durum DEFAULT N'Planlandı',
  BasariPuani DECIMAL(5,2) NULL,
  SertifikaNo NVARCHAR(80) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_IkEgitimKatilim_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_IkEgitimKatilim_Egitim FOREIGN KEY(EgitimId) REFERENCES dbo.IkEgitimler(EgitimId),
  CONSTRAINT UX_IkEgitimKatilim UNIQUE(CompanyId,EgitimId,PersonelId),
  CONSTRAINT CK_IkEgitimKatilim_Puan CHECK(BasariPuani IS NULL OR BasariPuani BETWEEN 0 AND 100)
);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.IkPersonelAtamalari') AND name=N'UX_IkPersonelAtamalari_Aktif')
EXEC sys.sp_executesql N'CREATE UNIQUE INDEX UX_IkPersonelAtamalari_Aktif ON dbo.IkPersonelAtamalari(CompanyId,PersonelId) WHERE IsActive=1';
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.IkMesailer') AND name=N'IX_IkMesailer_Ajanda')
CREATE INDEX IX_IkMesailer_Ajanda ON dbo.IkMesailer(CompanyId,OnayDurumu,Tarih) INCLUDE(PersonelId,SureSaat,Tutar);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.IkAvanslar') AND name=N'IX_IkAvanslar_Durum')
CREATE INDEX IX_IkAvanslar_Durum ON dbo.IkAvanslar(CompanyId,Durum,TalepTarihi) INCLUDE(PersonelId,Tutar);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.IkEgitimler') AND name=N'IX_IkEgitimler_Tarih')
CREATE INDEX IX_IkEgitimler_Tarih ON dbo.IkEgitimler(CompanyId,BaslangicTarihi,Durum);

COMMIT;
PRINT N'024 İK organizasyon ve çalışan yönetimi zinciri tamamlandı.';
END TRY
BEGIN CATCH
IF @@TRANCOUNT>0 ROLLBACK;
THROW;
END CATCH;
