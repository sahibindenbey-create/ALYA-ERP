/* =========================================================
   ALYA-ERP - 004 STOK HAREKETLERI
   Amaç: Şirket + ürün bazlı stok hareket altyapısı
   ========================================================= */

IF OBJECT_ID(N'dbo.StokHareketleri', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.StokHareketleri
    (
        StokHareketId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_StokHareketleri PRIMARY KEY,
        CompanyId INT NOT NULL,
        UrunId INT NOT NULL,
        Depo NVARCHAR(100) NOT NULL CONSTRAINT DF_StokHareketleri_Depo DEFAULT N'Merkez Depo',
        HareketTipi NVARCHAR(20) NOT NULL,
        Miktar DECIMAL(18,4) NOT NULL,
        OncekiStok DECIMAL(18,4) NOT NULL CONSTRAINT DF_StokHareketleri_OncekiStok DEFAULT 0,
        SonrakiStok DECIMAL(18,4) NOT NULL CONSTRAINT DF_StokHareketleri_SonrakiStok DEFAULT 0,
        ReferansTipi NVARCHAR(50) NULL,
        ReferansId INT NULL,
        Aciklama NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_StokHareketleri_CreatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT FK_StokHareketleri_Sirket FOREIGN KEY (CompanyId) REFERENCES dbo.Sirketler(CompanyId),
        CONSTRAINT FK_StokHareketleri_Urun FOREIGN KEY (UrunId) REFERENCES dbo.Urunler(UrunId),
        CONSTRAINT CK_StokHareketleri_Tip CHECK (HareketTipi IN (N'Giriş',N'Çıkış',N'Sayım',N'Düzeltme')),
        CONSTRAINT CK_StokHareketleri_Miktar CHECK (Miktar > 0)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_StokHareketleri_Company_Urun_Tarih' AND object_id = OBJECT_ID(N'dbo.StokHareketleri'))
    CREATE INDEX IX_StokHareketleri_Company_Urun_Tarih ON dbo.StokHareketleri(CompanyId, UrunId, CreatedAt DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_StokHareketleri_Company_Depo' AND object_id = OBJECT_ID(N'dbo.StokHareketleri'))
    CREATE INDEX IX_StokHareketleri_Company_Depo ON dbo.StokHareketleri(CompanyId, Depo);
GO

IF NOT EXISTS (SELECT 1 FROM sys.security_policies WHERE name = N'SecurityPolicy_CompanyIsolation')
BEGIN
    PRINT N'Company RLS policy bulunamadı. Önce 003 migration çalıştırılmalıdır.';
END
ELSE
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.security_predicates
        WHERE object_id = OBJECT_ID(N'dbo.StokHareketleri')
          AND security_policy_id = OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
          AND predicate_type = 1
    )
        ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
        ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.StokHareketleri;

    IF NOT EXISTS (
        SELECT 1 FROM sys.security_predicates
        WHERE object_id = OBJECT_ID(N'dbo.StokHareketleri')
          AND security_policy_id = OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
          AND predicate_type = 2
          AND operation = 1
    )
        ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
        ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.StokHareketleri AFTER INSERT;

    IF NOT EXISTS (
        SELECT 1 FROM sys.security_predicates
        WHERE object_id = OBJECT_ID(N'dbo.StokHareketleri')
          AND security_policy_id = OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
          AND predicate_type = 2
          AND operation = 2
    )
        ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
        ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.StokHareketleri AFTER UPDATE;
END;
GO

PRINT N'004_STOK_HAREKETLERI tamamlandı.';
GO
