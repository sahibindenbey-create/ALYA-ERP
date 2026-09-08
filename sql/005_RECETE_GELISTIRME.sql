/* =========================================================
   005 - GELİŞMİŞ ÜRETİM REÇETESİ (BOM)
   ========================================================= */

/* Ana reçete alanları */
IF COL_LENGTH('dbo.Receteler', 'ReceteAdi') IS NULL ALTER TABLE dbo.Receteler ADD ReceteAdi NVARCHAR(200) NULL;
GO
IF COL_LENGTH('dbo.Receteler', 'Versiyon') IS NULL ALTER TABLE dbo.Receteler ADD Versiyon INT NOT NULL CONSTRAINT DF_Receteler_Versiyon DEFAULT 1;
GO
IF COL_LENGTH('dbo.Receteler', 'UretimBirimi') IS NULL ALTER TABLE dbo.Receteler ADD UretimBirimi NVARCHAR(30) NOT NULL CONSTRAINT DF_Receteler_UretimBirimi DEFAULT N'Adet';
GO
IF COL_LENGTH('dbo.Receteler', 'Durum') IS NULL ALTER TABLE dbo.Receteler ADD Durum NVARCHAR(30) NOT NULL CONSTRAINT DF_Receteler_Durum DEFAULT N'Aktif';
GO

/* Reçete detay alanları */
IF COL_LENGTH('dbo.ReceteDetay', 'FireOrani') IS NULL ALTER TABLE dbo.ReceteDetay ADD FireOrani DECIMAL(9,4) NOT NULL CONSTRAINT DF_ReceteDetay_FireOrani DEFAULT 0;
GO
IF COL_LENGTH('dbo.ReceteDetay', 'SiraNo') IS NULL ALTER TABLE dbo.ReceteDetay ADD SiraNo INT NOT NULL CONSTRAINT DF_ReceteDetay_SiraNo DEFAULT 1;
GO
IF COL_LENGTH('dbo.ReceteDetay', 'Aciklama') IS NULL ALTER TABLE dbo.ReceteDetay ADD Aciklama NVARCHAR(500) NULL;
GO

/*
   ReceteIstasyon bazı kurulumlarda hiç oluşturulmamış.
   Önce tabloyu oluşturuyoruz; sonra geliştirme alanlarını ekliyoruz.
   Böylece migration 4902 hatası vermeden hem eski hem yeni kurulumlarda çalışır.
*/
IF OBJECT_ID('dbo.ReceteIstasyon','U') IS NULL
BEGIN
    CREATE TABLE dbo.ReceteIstasyon
    (
        ReceteIstasyonId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ReceteIstasyon PRIMARY KEY,
        ReceteId INT NOT NULL,
        CompanyId INT NOT NULL,
        Sira INT NOT NULL CONSTRAINT DF_ReceteIstasyon_Sira DEFAULT 1,
        IstasyonAdi NVARCHAR(200) NOT NULL,
        TahminiSureDk DECIMAL(18,4) NOT NULL CONSTRAINT DF_ReceteIstasyon_TahminiSureDk DEFAULT 0,
        IslemAdi NVARCHAR(200) NULL,
        IscilikDakika DECIMAL(18,4) NOT NULL CONSTRAINT DF_ReceteIstasyon_IscilikDakika DEFAULT 0,
        MakineDakika DECIMAL(18,4) NOT NULL CONSTRAINT DF_ReceteIstasyon_MakineDakika DEFAULT 0,
        FasonMu BIT NOT NULL CONSTRAINT DF_ReceteIstasyon_FasonMu DEFAULT 0,
        Aciklama NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ReceteIstasyon_CreatedAt DEFAULT SYSDATETIME()
    );

    ALTER TABLE dbo.ReceteIstasyon
        ADD CONSTRAINT FK_ReceteIstasyon_Receteler
        FOREIGN KEY (ReceteId) REFERENCES dbo.Receteler(ReceteId);

    ALTER TABLE dbo.ReceteIstasyon
        ADD CONSTRAINT FK_ReceteIstasyon_Sirketler
        FOREIGN KEY (CompanyId) REFERENCES dbo.Sirketler(CompanyId);
END;
GO

/* Mevcut ReceteIstasyon tablolarında eksik alanları tamamla */
IF COL_LENGTH('dbo.ReceteIstasyon', 'IslemAdi') IS NULL ALTER TABLE dbo.ReceteIstasyon ADD IslemAdi NVARCHAR(200) NULL;
GO
IF COL_LENGTH('dbo.ReceteIstasyon', 'IscilikDakika') IS NULL ALTER TABLE dbo.ReceteIstasyon ADD IscilikDakika DECIMAL(18,4) NOT NULL CONSTRAINT DF_ReceteIstasyon_IscilikDakika DEFAULT 0;
GO
IF COL_LENGTH('dbo.ReceteIstasyon', 'MakineDakika') IS NULL ALTER TABLE dbo.ReceteIstasyon ADD MakineDakika DECIMAL(18,4) NOT NULL CONSTRAINT DF_ReceteIstasyon_MakineDakika DEFAULT 0;
GO
IF COL_LENGTH('dbo.ReceteIstasyon', 'FasonMu') IS NULL ALTER TABLE dbo.ReceteIstasyon ADD FasonMu BIT NOT NULL CONSTRAINT DF_ReceteIstasyon_FasonMu DEFAULT 0;
GO
IF COL_LENGTH('dbo.ReceteIstasyon', 'Aciklama') IS NULL ALTER TABLE dbo.ReceteIstasyon ADD Aciklama NVARCHAR(500) NULL;
GO

/* CompanyId yoksa ekle ve ana reçeteden doldur */
IF COL_LENGTH('dbo.ReceteIstasyon','CompanyId') IS NULL
BEGIN
    ALTER TABLE dbo.ReceteIstasyon ADD CompanyId INT NULL;
    UPDATE ri
       SET CompanyId = r.CompanyId
      FROM dbo.ReceteIstasyon ri
      INNER JOIN dbo.Receteler r ON r.ReceteId = ri.ReceteId
     WHERE ri.CompanyId IS NULL;

    UPDATE dbo.ReceteIstasyon
       SET CompanyId = 1
     WHERE CompanyId IS NULL;

    ALTER TABLE dbo.ReceteIstasyon ALTER COLUMN CompanyId INT NOT NULL;
    ALTER TABLE dbo.ReceteIstasyon ADD CONSTRAINT FK_ReceteIstasyon_Sirketler_CompanyId FOREIGN KEY (CompanyId) REFERENCES dbo.Sirketler(CompanyId);
END;
GO

/* Her durumda parent reçeteden eksik CompanyId değerlerini düzelt */
UPDATE ri
   SET CompanyId = r.CompanyId
  FROM dbo.ReceteIstasyon ri
  INNER JOIN dbo.Receteler r ON r.ReceteId = ri.ReceteId
 WHERE ri.CompanyId IS NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Receteler_Company_Mamul_Aktif' AND object_id=OBJECT_ID('dbo.Receteler'))
    CREATE INDEX IX_Receteler_Company_Mamul_Aktif ON dbo.Receteler(CompanyId,MamulUrunId,IsActive,Versiyon DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ReceteDetay_Company_Recete_Sira' AND object_id=OBJECT_ID('dbo.ReceteDetay'))
    CREATE INDEX IX_ReceteDetay_Company_Recete_Sira ON dbo.ReceteDetay(CompanyId,ReceteId,SiraNo);
GO

/* ReceteIstasyon için şirket bazlı RLS */
IF NOT EXISTS (
    SELECT 1
    FROM sys.security_predicates p
    WHERE p.object_id = OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
      AND p.target_object_id = OBJECT_ID(N'dbo.ReceteIstasyon')
      AND p.predicate_type = 0
)
    ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
        ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.ReceteIstasyon;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.security_predicates p
    WHERE p.object_id = OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
      AND p.target_object_id = OBJECT_ID(N'dbo.ReceteIstasyon')
      AND p.predicate_type = 1
      AND p.operation = 1
)
    ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
        ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.ReceteIstasyon AFTER INSERT;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.security_predicates p
    WHERE p.object_id = OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
      AND p.target_object_id = OBJECT_ID(N'dbo.ReceteIstasyon')
      AND p.predicate_type = 1
      AND p.operation = 2
)
    ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
        ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.ReceteIstasyon AFTER UPDATE;
GO

PRINT N'005 - Gelişmiş reçete migration tamamlandı.';
GO
