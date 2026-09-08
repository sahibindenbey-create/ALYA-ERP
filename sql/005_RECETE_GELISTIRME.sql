/* =========================================================
   005 - GELİŞMİŞ ÜRETİM REÇETESİ (BOM)
   Mevcut Receteler / ReceteDetay / ReceteIstasyon yapısını bozmaz.
   Eksik alanları güvenli şekilde ekler.
   ========================================================= */

IF COL_LENGTH('dbo.Receteler', 'ReceteAdi') IS NULL
    ALTER TABLE dbo.Receteler ADD ReceteAdi NVARCHAR(200) NULL;
GO
IF COL_LENGTH('dbo.Receteler', 'Versiyon') IS NULL
    ALTER TABLE dbo.Receteler ADD Versiyon INT NOT NULL CONSTRAINT DF_Receteler_Versiyon DEFAULT 1;
GO
IF COL_LENGTH('dbo.Receteler', 'UretimBirimi') IS NULL
    ALTER TABLE dbo.Receteler ADD UretimBirimi NVARCHAR(30) NOT NULL CONSTRAINT DF_Receteler_UretimBirimi DEFAULT N'Adet';
GO
IF COL_LENGTH('dbo.Receteler', 'Durum') IS NULL
    ALTER TABLE dbo.Receteler ADD Durum NVARCHAR(30) NOT NULL CONSTRAINT DF_Receteler_Durum DEFAULT N'Aktif';
GO

IF COL_LENGTH('dbo.ReceteDetay', 'FireOrani') IS NULL
    ALTER TABLE dbo.ReceteDetay ADD FireOrani DECIMAL(9,4) NOT NULL CONSTRAINT DF_ReceteDetay_FireOrani DEFAULT 0;
GO
IF COL_LENGTH('dbo.ReceteDetay', 'SiraNo') IS NULL
    ALTER TABLE dbo.ReceteDetay ADD SiraNo INT NOT NULL CONSTRAINT DF_ReceteDetay_SiraNo DEFAULT 1;
GO
IF COL_LENGTH('dbo.ReceteDetay', 'Aciklama') IS NULL
    ALTER TABLE dbo.ReceteDetay ADD Aciklama NVARCHAR(500) NULL;
GO

IF COL_LENGTH('dbo.ReceteIstasyon', 'IslemAdi') IS NULL
    ALTER TABLE dbo.ReceteIstasyon ADD IslemAdi NVARCHAR(200) NULL;
GO
IF COL_LENGTH('dbo.ReceteIstasyon', 'IscilikDakika') IS NULL
    ALTER TABLE dbo.ReceteIstasyon ADD IscilikDakika DECIMAL(18,4) NOT NULL CONSTRAINT DF_ReceteIstasyon_IscilikDakika DEFAULT 0;
GO
IF COL_LENGTH('dbo.ReceteIstasyon', 'MakineDakika') IS NULL
    ALTER TABLE dbo.ReceteIstasyon ADD MakineDakika DECIMAL(18,4) NOT NULL CONSTRAINT DF_ReceteIstasyon_MakineDakika DEFAULT 0;
GO
IF COL_LENGTH('dbo.ReceteIstasyon', 'FasonMu') IS NULL
    ALTER TABLE dbo.ReceteIstasyon ADD FasonMu BIT NOT NULL CONSTRAINT DF_ReceteIstasyon_FasonMu DEFAULT 0;
GO
IF COL_LENGTH('dbo.ReceteIstasyon', 'Aciklama') IS NULL
    ALTER TABLE dbo.ReceteIstasyon ADD Aciklama NVARCHAR(500) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Receteler_Company_Mamul_Aktif' AND object_id = OBJECT_ID('dbo.Receteler'))
    CREATE INDEX IX_Receteler_Company_Mamul_Aktif ON dbo.Receteler(CompanyId, MamulUrunId, IsActive, Versiyon DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReceteDetay_Company_Recete_Sira' AND object_id = OBJECT_ID('dbo.ReceteDetay'))
    CREATE INDEX IX_ReceteDetay_Company_Recete_Sira ON dbo.ReceteDetay(CompanyId, ReceteId, SiraNo);
GO

/* Maliyet için mevcut ürün alış fiyatı kullanılır. */
