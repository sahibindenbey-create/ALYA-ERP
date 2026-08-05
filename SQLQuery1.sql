-- ------------------------------
-- 1?? CariListesi Tablosu
-- ------------------------------
IF OBJECT_ID('dbo.CariHareketleri', 'U') IS NOT NULL DROP TABLE dbo.CariHareketleri;
IF OBJECT_ID('dbo.CariListesi', 'U') IS NOT NULL DROP TABLE dbo.CariListesi;

CREATE TABLE CariListesi (
    CariId INT IDENTITY(1,1) PRIMARY KEY,
    CompanyId INT NOT NULL,
    CariKodu NVARCHAR(20) NOT NULL UNIQUE,
    CariAdi NVARCHAR(100) NOT NULL,
    CariTipi TINYINT NOT NULL, -- 1=Müþteri,2=Tedarikçi,3=Her ikisi
    VergiDairesi NVARCHAR(50),
    VergiNo NVARCHAR(10) UNIQUE,
    TCNo NVARCHAR(11) UNIQUE,
    FaturaUlke NVARCHAR(50),
    FaturaIl NVARCHAR(50),
    FaturaIlce NVARCHAR(50),
    FaturaAdres NVARCHAR(200),
    SevkiyatUlke NVARCHAR(50),
    SevkiyatIl NVARCHAR(50),
    SevkiyatIlce NVARCHAR(50),
    SevkiyatAdres NVARCHAR(200),
    Segment NVARCHAR(50),
    IsActive BIT DEFAULT 1,
    CreatedDate DATETIME DEFAULT GETDATE()
);

-- ------------------------------
-- 2?? CariHareketleri Tablosu
-- ------------------------------
CREATE TABLE CariHareketleri (
    HareketId INT IDENTITY(1,1) PRIMARY KEY,
    CariId INT NOT NULL,
    CompanyId INT NOT NULL,
    HareketTarihi DATETIME DEFAULT GETDATE(),
    HareketTipi TINYINT NOT NULL, -- 1: Borç, 2: Alacak
    Tutar DECIMAL(18,2) NOT NULL,
    Aciklama NVARCHAR(200),
    CreatedDate DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_CariHareketleri_Cari FOREIGN KEY (CariId) REFERENCES CariListesi(CariId)
);
