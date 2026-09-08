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

/* ReceteIstasyon eski yapıda şirket alanı yoksa eklenir. */
IF OBJECT_ID('dbo.ReceteIstasyon','U') IS NOT NULL AND COL_LENGTH('dbo.ReceteIstasyon','CompanyId') IS NULL
BEGIN
    ALTER TABLE dbo.ReceteIstasyon ADD CompanyId INT NULL;
    UPDATE ri SET CompanyId = r.CompanyId FROM dbo.ReceteIstasyon ri JOIN dbo.Receteler r ON r.ReceteId = ri.ReceteId;
    ALTER TABLE dbo.ReceteIstasyon ADD CONSTRAINT FK_ReceteIstasyon_Sirketler FOREIGN KEY (CompanyId) REFERENCES dbo.Sirketler(CompanyId);
    ALTER TABLE dbo.ReceteIstasyon ADD CONSTRAINT DF_ReceteIstasyon_CompanyId DEFAULT 1 FOR CompanyId;
END;
GO

/* Operasyon tablosunu da aynı RLS politikasına bağla. */
IF OBJECT_ID('dbo.ReceteIstasyon','U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.security_predicates p
        WHERE p.object_id = OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
          AND p.target_object_id = OBJECT_ID(N'dbo.ReceteIstasyon')
          AND p.predicate_type = 0
    )
    BEGIN
        ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
            ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.ReceteIstasyon;
    END;
    IF NOT EXISTS (
        SELECT 1 FROM sys.security_predicates p
        WHERE p.object_id = OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
          AND p.target_object_id = OBJECT_ID(N'dbo.ReceteIstasyon')
          AND p.predicate_type = 1 AND p.operation = 1
    )
    BEGIN
        ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
            ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.ReceteIstasyon AFTER INSERT;
    END;
    IF NOT EXISTS (
        SELECT 1 FROM sys.security_predicates p
        WHERE p.object_id = OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
          AND p.target_object_id = OBJECT_ID(N'dbo.ReceteIstasyon')
          AND p.predicate_type = 1 AND p.operation = 2
    )
    BEGIN
        ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
            ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.ReceteIstasyon AFTER UPDATE;
    END;
END;
GO

/* Maliyet için mevcut ürün alış fiyatı kullanılır. */
