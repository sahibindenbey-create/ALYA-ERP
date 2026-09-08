/* =========================================================
   006 - GELİŞMİŞ ÜRETİM REÇETE AĞACI
   AHBRD 1301 ve benzeri çok seviyeli üretimler için
   ========================================================= */

/* ---------------------------------------------------------
   Receteler: reçete türü / çıktı dönüşümü
   --------------------------------------------------------- */
IF COL_LENGTH('dbo.Receteler', 'ReceteTipi') IS NULL
    ALTER TABLE dbo.Receteler ADD ReceteTipi NVARCHAR(30) NOT NULL CONSTRAINT DF_Receteler_ReceteTipi DEFAULT N'Mamul';
GO

IF COL_LENGTH('dbo.Receteler', 'CiktiMiktari') IS NULL
    ALTER TABLE dbo.Receteler ADD CiktiMiktari DECIMAL(18,4) NOT NULL CONSTRAINT DF_Receteler_CiktiMiktari DEFAULT 1;
GO

IF COL_LENGTH('dbo.Receteler', 'CiktiBirimi') IS NULL
    ALTER TABLE dbo.Receteler ADD CiktiBirimi NVARCHAR(30) NOT NULL CONSTRAINT DF_Receteler_CiktiBirimi DEFAULT N'Adet';
GO

IF COL_LENGTH('dbo.Receteler', 'StandartFireOrani') IS NULL
    ALTER TABLE dbo.Receteler ADD StandartFireOrani DECIMAL(9,4) NOT NULL CONSTRAINT DF_Receteler_StandartFireOrani DEFAULT 0;
GO

IF COL_LENGTH('dbo.Receteler', 'Aciklama') IS NULL
    ALTER TABLE dbo.Receteler ADD Aciklama NVARCHAR(1000) NULL;
GO

/* ---------------------------------------------------------
   ReceteDetay: malzeme + yarı mamul + hizmet + fason +
   nakliye + ambalaj + dönüşüm/yield bilgileri
   --------------------------------------------------------- */
IF COL_LENGTH('dbo.ReceteDetay', 'KalemTipi') IS NULL
    ALTER TABLE dbo.ReceteDetay ADD KalemTipi NVARCHAR(30) NOT NULL CONSTRAINT DF_ReceteDetay_KalemTipi DEFAULT N'Malzeme';
GO

IF COL_LENGTH('dbo.ReceteDetay', 'AltReceteId') IS NULL
    ALTER TABLE dbo.ReceteDetay ADD AltReceteId INT NULL;
GO

IF COL_LENGTH('dbo.ReceteDetay', 'GirdiMiktari') IS NULL
    ALTER TABLE dbo.ReceteDetay ADD GirdiMiktari DECIMAL(18,4) NULL;
GO

IF COL_LENGTH('dbo.ReceteDetay', 'GirdiBirimi') IS NULL
    ALTER TABLE dbo.ReceteDetay ADD GirdiBirimi NVARCHAR(30) NULL;
GO

IF COL_LENGTH('dbo.ReceteDetay', 'CiktiMiktari') IS NULL
    ALTER TABLE dbo.ReceteDetay ADD CiktiMiktari DECIMAL(18,4) NULL;
GO

IF COL_LENGTH('dbo.ReceteDetay', 'CiktiBirimi') IS NULL
    ALTER TABLE dbo.ReceteDetay ADD CiktiBirimi NVARCHAR(30) NULL;
GO

IF COL_LENGTH('dbo.ReceteDetay', 'VerimOrani') IS NULL
    ALTER TABLE dbo.ReceteDetay ADD VerimOrani DECIMAL(9,4) NOT NULL CONSTRAINT DF_ReceteDetay_VerimOrani DEFAULT 100;
GO

IF COL_LENGTH('dbo.ReceteDetay', 'DonusumAciklama') IS NULL
    ALTER TABLE dbo.ReceteDetay ADD DonusumAciklama NVARCHAR(500) NULL;
GO

IF COL_LENGTH('dbo.ReceteDetay', 'TedarikciCariId') IS NULL
    ALTER TABLE dbo.ReceteDetay ADD TedarikciCariId INT NULL;
GO

IF COL_LENGTH('dbo.ReceteDetay', 'FasonMu') IS NULL
    ALTER TABLE dbo.ReceteDetay ADD FasonMu BIT NOT NULL CONSTRAINT DF_ReceteDetay_FasonMu DEFAULT 0;
GO

IF COL_LENGTH('dbo.ReceteDetay', 'HizmetBirimFiyati') IS NULL
    ALTER TABLE dbo.ReceteDetay ADD HizmetBirimFiyati DECIMAL(18,4) NOT NULL CONSTRAINT DF_ReceteDetay_HizmetBirimFiyati DEFAULT 0;
GO

IF COL_LENGTH('dbo.ReceteDetay', 'NakliyeMaliyeti') IS NULL
    ALTER TABLE dbo.ReceteDetay ADD NakliyeMaliyeti DECIMAL(18,4) NOT NULL CONSTRAINT DF_ReceteDetay_NakliyeMaliyeti DEFAULT 0;
GO

IF COL_LENGTH('dbo.ReceteDetay', 'IscilikDakika') IS NULL
    ALTER TABLE dbo.ReceteDetay ADD IscilikDakika DECIMAL(18,4) NOT NULL CONSTRAINT DF_ReceteDetay_IscilikDakika DEFAULT 0;
GO

IF COL_LENGTH('dbo.ReceteDetay', 'MakineDakika') IS NULL
    ALTER TABLE dbo.ReceteDetay ADD MakineDakika DECIMAL(18,4) NOT NULL CONSTRAINT DF_ReceteDetay_MakineDakika DEFAULT 0;
GO

IF COL_LENGTH('dbo.ReceteDetay', 'IscilikBirimMaliyeti') IS NULL
    ALTER TABLE dbo.ReceteDetay ADD IscilikBirimMaliyeti DECIMAL(18,4) NOT NULL CONSTRAINT DF_ReceteDetay_IscilikBirimMaliyeti DEFAULT 0;
GO

IF COL_LENGTH('dbo.ReceteDetay', 'MakineBirimMaliyeti') IS NULL
    ALTER TABLE dbo.ReceteDetay ADD MakineBirimMaliyeti DECIMAL(18,4) NOT NULL CONSTRAINT DF_ReceteDetay_MakineBirimMaliyeti DEFAULT 0;
GO

IF COL_LENGTH('dbo.ReceteDetay', 'Depo') IS NULL
    ALTER TABLE dbo.ReceteDetay ADD Depo NVARCHAR(100) NULL;
GO

IF COL_LENGTH('dbo.ReceteDetay', 'OperasyonSira') IS NULL
    ALTER TABLE dbo.ReceteDetay ADD OperasyonSira INT NULL;
GO

IF COL_LENGTH('dbo.ReceteDetay', 'IstasyonAdi') IS NULL
    ALTER TABLE dbo.ReceteDetay ADD IstasyonAdi NVARCHAR(200) NULL;
GO

/* Eski miktar alanını yeni dönüşüm modeliyle uyumlu doldur */
UPDATE dbo.ReceteDetay
   SET GirdiMiktari = CASE WHEN GirdiMiktari IS NULL THEN Miktar ELSE GirdiMiktari END,
       GirdiBirimi = CASE WHEN GirdiBirimi IS NULL THEN Birim ELSE GirdiBirimi END
 WHERE GirdiMiktari IS NULL OR GirdiBirimi IS NULL;
GO

/* ---------------------------------------------------------
   Yarı mamul reçete ilişkisi
   --------------------------------------------------------- */
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'FK_ReceteDetay_AltRecete'
      AND parent_object_id = OBJECT_ID(N'dbo.ReceteDetay')
)
BEGIN
    ALTER TABLE dbo.ReceteDetay
        ADD CONSTRAINT FK_ReceteDetay_AltRecete
        FOREIGN KEY (AltReceteId) REFERENCES dbo.Receteler(ReceteId);
END;
GO

/* ---------------------------------------------------------
   ReceteIstasyon: fason cari + maliyet + depo/çıktı bilgileri
   --------------------------------------------------------- */
IF COL_LENGTH('dbo.ReceteIstasyon', 'TedarikciCariId') IS NULL
    ALTER TABLE dbo.ReceteIstasyon ADD TedarikciCariId INT NULL;
GO

IF COL_LENGTH('dbo.ReceteIstasyon', 'HizmetMaliyeti') IS NULL
    ALTER TABLE dbo.ReceteIstasyon ADD HizmetMaliyeti DECIMAL(18,4) NOT NULL CONSTRAINT DF_ReceteIstasyon_HizmetMaliyeti DEFAULT 0;
GO

IF COL_LENGTH('dbo.ReceteIstasyon', 'NakliyeMaliyeti') IS NULL
    ALTER TABLE dbo.ReceteIstasyon ADD NakliyeMaliyeti DECIMAL(18,4) NOT NULL CONSTRAINT DF_ReceteIstasyon_NakliyeMaliyeti DEFAULT 0;
GO

IF COL_LENGTH('dbo.ReceteIstasyon', 'GirdiMiktari') IS NULL
    ALTER TABLE dbo.ReceteIstasyon ADD GirdiMiktari DECIMAL(18,4) NULL;
GO

IF COL_LENGTH('dbo.ReceteIstasyon', 'CiktiMiktari') IS NULL
    ALTER TABLE dbo.ReceteIstasyon ADD CiktiMiktari DECIMAL(18,4) NULL;
GO

IF COL_LENGTH('dbo.ReceteIstasyon', 'CiktiBirimi') IS NULL
    ALTER TABLE dbo.ReceteIstasyon ADD CiktiBirimi NVARCHAR(30) NULL;
GO

IF COL_LENGTH('dbo.ReceteIstasyon', 'Depo') IS NULL
    ALTER TABLE dbo.ReceteIstasyon ADD Depo NVARCHAR(100) NULL;
GO

/* ---------------------------------------------------------
   Reçete ağacını hızlı okumak için indeksler
   --------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ReceteDetay_Recete_KalemTipi_Sira' AND object_id = OBJECT_ID(N'dbo.ReceteDetay'))
    CREATE INDEX IX_ReceteDetay_Recete_KalemTipi_Sira
        ON dbo.ReceteDetay(CompanyId, ReceteId, KalemTipi, SiraNo);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ReceteDetay_AltRecete' AND object_id = OBJECT_ID(N'dbo.ReceteDetay'))
    CREATE INDEX IX_ReceteDetay_AltRecete
        ON dbo.ReceteDetay(CompanyId, AltReceteId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ReceteIstasyon_Recete_Sira' AND object_id = OBJECT_ID(N'dbo.ReceteIstasyon'))
    CREATE INDEX IX_ReceteIstasyon_Recete_Sira
        ON dbo.ReceteIstasyon(CompanyId, ReceteId, Sira);
GO

/* ---------------------------------------------------------
   Kontroller
   --------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_ReceteDetay_VerimOrani')
    ALTER TABLE dbo.ReceteDetay ADD CONSTRAINT CK_ReceteDetay_VerimOrani CHECK (VerimOrani >= 0 AND VerimOrani <= 100);
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Receteler_CiktiMiktari')
    ALTER TABLE dbo.Receteler ADD CONSTRAINT CK_Receteler_CiktiMiktari CHECK (CiktiMiktari > 0);
GO

PRINT N'006 - Reçete üretim ağacı migration tamamlandı.';
GO
