/* ALYA ERP - Çoklu Şirket + KolayBi altyapısı
   Güvenli, tekrar çalıştırılabilir migration.
*/

IF OBJECT_ID('dbo.Sirketler','U') IS NULL
BEGIN
  CREATE TABLE dbo.Sirketler (
    CompanyId INT NOT NULL PRIMARY KEY,
    CompanyName NVARCHAR(200) NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_Sirketler_IsActive DEFAULT 1,
    CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_Sirketler_CreatedDate DEFAULT SYSDATETIME()
  );
END;

MERGE dbo.Sirketler AS hedef
USING (VALUES
  (1, N'ALYA HOMES DAYANIKLI TÜKETİM MALLARI SAN. VE TİC. LTD. ŞTİ.'),
  (2, N'YAMANKAYA GRUP YAPI İNŞAAT SANAYİ VE TİCARET LİMİTED ŞİRKETİ'),
  (3, N'MONO İÇ VE DIŞ TİCARET LİMİTED ŞİRKETİ')
) AS kaynak(CompanyId, CompanyName)
ON hedef.CompanyId = kaynak.CompanyId
WHEN MATCHED THEN UPDATE SET CompanyName = kaynak.CompanyName, IsActive = 1
WHEN NOT MATCHED THEN INSERT (CompanyId, CompanyName) VALUES (kaynak.CompanyId, kaynak.CompanyName);

IF OBJECT_ID('dbo.KolaybiAyarlar','U') IS NULL
BEGIN
  CREATE TABLE dbo.KolaybiAyarlar (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CompanyId INT NOT NULL,
    ApiKey NVARCHAR(500) NULL,
    Channel NVARCHAR(200) NULL,
    BaseUrl NVARCHAR(500) NOT NULL CONSTRAINT DF_KolaybiAyarlar_BaseUrl DEFAULT 'https://ofis-api.kolaybi.com',
    AccessToken NVARCHAR(MAX) NULL,
    TokenGecerlilik DATETIME2 NULL,
    KolaybiCompanyId INT NULL,
    SonSenkronTarihi DATETIME2 NULL,
    SonSenkronDurumu NVARCHAR(30) NULL,
    SonSenkronMesaji NVARCHAR(1000) NULL,
    CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_KolaybiAyarlar_CreatedDate DEFAULT SYSDATETIME(),
    UpdatedDate DATETIME2 NOT NULL CONSTRAINT DF_KolaybiAyarlar_UpdatedDate DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_KolaybiAyarlar_Company UNIQUE (CompanyId),
    CONSTRAINT FK_KolaybiAyarlar_Sirket FOREIGN KEY (CompanyId) REFERENCES dbo.Sirketler(CompanyId)
  );
END
ELSE
BEGIN
  IF COL_LENGTH('dbo.KolaybiAyarlar','CompanyId') IS NULL
    ALTER TABLE dbo.KolaybiAyarlar ADD CompanyId INT NULL;
  IF COL_LENGTH('dbo.KolaybiAyarlar','KolaybiCompanyId') IS NULL
    ALTER TABLE dbo.KolaybiAyarlar ADD KolaybiCompanyId INT NULL;
  IF COL_LENGTH('dbo.KolaybiAyarlar','SonSenkronDurumu') IS NULL
    ALTER TABLE dbo.KolaybiAyarlar ADD SonSenkronDurumu NVARCHAR(30) NULL;
  IF COL_LENGTH('dbo.KolaybiAyarlar','SonSenkronMesaji') IS NULL
    ALTER TABLE dbo.KolaybiAyarlar ADD SonSenkronMesaji NVARCHAR(1000) NULL;
  IF COL_LENGTH('dbo.KolaybiAyarlar','UpdatedDate') IS NULL
    ALTER TABLE dbo.KolaybiAyarlar ADD UpdatedDate DATETIME2 NULL;
END;

/* Eski tek hesaplı kaydı Şirket 1'e taşı. */
IF EXISTS (SELECT 1 FROM dbo.KolaybiAyarlar WHERE CompanyId IS NULL)
BEGIN
  UPDATE dbo.KolaybiAyarlar SET CompanyId = 1, UpdatedDate = SYSDATETIME() WHERE CompanyId IS NULL;
END;

/* Eksik şirket bağlantı kayıtlarını oluştur. API anahtarları boş bırakılır. */
INSERT INTO dbo.KolaybiAyarlar (CompanyId, BaseUrl)
SELECT s.CompanyId, 'https://ofis-api.kolaybi.com'
FROM dbo.Sirketler s
WHERE NOT EXISTS (SELECT 1 FROM dbo.KolaybiAyarlar k WHERE k.CompanyId = s.CompanyId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_KolaybiAyarlar_Company' AND object_id = OBJECT_ID('dbo.KolaybiAyarlar'))
BEGIN
  CREATE UNIQUE INDEX UQ_KolaybiAyarlar_Company ON dbo.KolaybiAyarlar(CompanyId) WHERE CompanyId IS NOT NULL;
END;

IF OBJECT_ID('dbo.KolaybiSyncKayitlari','U') IS NULL
BEGIN
  CREATE TABLE dbo.KolaybiSyncKayitlari (
    SyncId BIGINT IDENTITY(1,1) PRIMARY KEY,
    CompanyId INT NOT NULL,
    EntityType NVARCHAR(50) NOT NULL,
    ExternalId NVARCHAR(100) NOT NULL,
    ExternalUpdatedAt DATETIME2 NULL,
    Payload NVARCHAR(MAX) NOT NULL,
    SyncedAt DATETIME2 NOT NULL CONSTRAINT DF_KolaybiSyncKayitlari_SyncedAt DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_KolaybiSyncKayitlari UNIQUE (CompanyId, EntityType, ExternalId),
    CONSTRAINT FK_KolaybiSyncKayitlari_Sirket FOREIGN KEY (CompanyId) REFERENCES dbo.Sirketler(CompanyId)
  );
END;

IF OBJECT_ID('dbo.KolaybiSyncLog','U') IS NULL
BEGIN
  CREATE TABLE dbo.KolaybiSyncLog (
    SyncLogId BIGINT IDENTITY(1,1) PRIMARY KEY,
    CompanyId INT NOT NULL,
    StartedAt DATETIME2 NOT NULL,
    FinishedAt DATETIME2 NULL,
    Status NVARCHAR(30) NOT NULL,
    CreatedCount INT NOT NULL DEFAULT 0,
    UpdatedCount INT NOT NULL DEFAULT 0,
    ErrorCount INT NOT NULL DEFAULT 0,
    Message NVARCHAR(2000) NULL,
    CONSTRAINT FK_KolaybiSyncLog_Sirket FOREIGN KEY (CompanyId) REFERENCES dbo.Sirketler(CompanyId)
  );
END;

/* ŞirketId bulunan mevcut tablolarda gelecekteki izolasyon için indeksler. */
IF COL_LENGTH('dbo.CariListesi','CompanyId') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_CariListesi_CompanyId' AND object_id=OBJECT_ID('dbo.CariListesi'))
  CREATE INDEX IX_CariListesi_CompanyId ON dbo.CariListesi(CompanyId, IsActive);

IF COL_LENGTH('dbo.CariHareketleri','CompanyId') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_CariHareketleri_CompanyId' AND object_id=OBJECT_ID('dbo.CariHareketleri'))
  CREATE INDEX IX_CariHareketleri_CompanyId ON dbo.CariHareketleri(CompanyId, HareketTarihi);
