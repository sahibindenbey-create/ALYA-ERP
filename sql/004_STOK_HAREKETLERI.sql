/* =========================================================
   ALYA-ERP - 004 STOK HAREKETLERI
   Amaç: Şirket + ürün bazlı stok hareket altyapısı
   ========================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;

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

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_StokHareketleri_Company_Urun_Tarih'
      AND object_id = OBJECT_ID(N'dbo.StokHareketleri')
)
    CREATE INDEX IX_StokHareketleri_Company_Urun_Tarih
        ON dbo.StokHareketleri(CompanyId, UrunId, CreatedAt DESC);
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_StokHareketleri_Company_Depo'
      AND object_id = OBJECT_ID(N'dbo.StokHareketleri')
)
    CREATE INDEX IX_StokHareketleri_Company_Depo
        ON dbo.StokHareketleri(CompanyId, Depo);
GO

/*
   RLS policy mevcutsa StokHareketleri de ayni company izolasyonuna dahil edilir.
   NOT: sys.security_predicates icinde security_policy_id diye bir kolon yoktur.
   Policy object_id = sys.security_predicates.object_id
   Hedef tablo = sys.security_predicates.target_object_id
   predicate_type: 0=FILTER, 1=BLOCK
*/
IF OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation', N'SP') IS NULL
BEGIN
    PRINT N'Company RLS policy bulunamadi. Once 003 migration calistirilmalidir.';
END
ELSE
BEGIN
    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.security_predicates p
        WHERE p.object_id = OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
          AND p.target_object_id = OBJECT_ID(N'dbo.StokHareketleri')
          AND p.predicate_type = 0
    )
    BEGIN
        ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
            ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
            ON dbo.StokHareketleri;
    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.security_predicates p
        WHERE p.object_id = OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
          AND p.target_object_id = OBJECT_ID(N'dbo.StokHareketleri')
          AND p.predicate_type = 1
          AND p.operation = 1
    )
    BEGIN
        ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
            ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
            ON dbo.StokHareketleri AFTER INSERT;
    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.security_predicates p
        WHERE p.object_id = OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
          AND p.target_object_id = OBJECT_ID(N'dbo.StokHareketleri')
          AND p.predicate_type = 1
          AND p.operation = 2
    )
    BEGIN
        ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
            ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
            ON dbo.StokHareketleri AFTER UPDATE;
    END;

    ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
        WITH (STATE = ON);
END;
GO

PRINT N'004_STOK_HAREKETLERI tamamlandi.';
GO
