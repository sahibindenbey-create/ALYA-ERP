/* =========================================================
   010 - KOLAYBI TAM VERİ KOPYASI
   Amaç: KolayBi API'den alınan ve henüz ERP'de karşılığı
         olmayan hiçbir veriyi kaybetmemek.
   ========================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.Sirketler', N'U') IS NULL
    THROW 51010, N'dbo.Sirketler bulunamadi.', 1;

IF OBJECT_ID(N'dbo.KolaybiRawData', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.KolaybiRawData
    (
        RawId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        CompanyId INT NOT NULL,
        EntityType NVARCHAR(100) NOT NULL,
        ExternalId NVARCHAR(255) NOT NULL,
        Payload NVARCHAR(MAX) NOT NULL,
        SyncedAt DATETIME2 NOT NULL CONSTRAINT DF_KolaybiRawData_SyncedAt DEFAULT SYSDATETIME(),
        CONSTRAINT UQ_KolaybiRawData UNIQUE (CompanyId, EntityType, ExternalId),
        CONSTRAINT FK_KolaybiRawData_Sirket FOREIGN KEY (CompanyId) REFERENCES dbo.Sirketler(CompanyId)
    );
END;

IF NOT EXISTS
(
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.KolaybiRawData')
      AND name = N'IX_KolaybiRawData_Company_Entity'
)
BEGIN
    CREATE INDEX IX_KolaybiRawData_Company_Entity
        ON dbo.KolaybiRawData(CompanyId, EntityType, SyncedAt DESC);
END;

/* Mevcut final RLS policy varsa yeni tabloya da aynı şirket filtresini uygula. */
IF OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation', N'P') IS NOT NULL
   AND OBJECT_ID(N'dbo.fn_CompanyIsolationPredicate', N'IF') IS NOT NULL
BEGIN
    BEGIN TRY
        ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
        ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
            ON dbo.KolaybiRawData;

        ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
        ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
            ON dbo.KolaybiRawData AFTER INSERT;

        ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
        ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
            ON dbo.KolaybiRawData AFTER UPDATE;
    END TRY
    BEGIN CATCH
        /* Migration tekrar çalıştırılırsa predicate zaten mevcut olabilir. */
        IF ERROR_NUMBER() NOT IN (33276, 33277)
            THROW;
    END CATCH;
END;

PRINT N'010_KOLAYBI_FULL_RAW_SYNC tamamlandi.';
GO
