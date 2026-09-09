/* =========================================================
   ALYA-ERP - 010 KOLAYBI RAW DATA
   KolayBi'den gelen tüm okunabilir ham kayıtların güvenli arşivi.
   ========================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.KolaybiRawData', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.KolaybiRawData
    (
        RawDataId BIGINT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_KolaybiRawData PRIMARY KEY,
        CompanyId INT NOT NULL,
        EntityType NVARCHAR(100) NOT NULL,
        ExternalId NVARCHAR(255) NOT NULL,
        Payload NVARCHAR(MAX) NOT NULL,
        SyncedAt DATETIME2 NOT NULL
            CONSTRAINT DF_KolaybiRawData_SyncedAt DEFAULT SYSDATETIME(),
        CONSTRAINT FK_KolaybiRawData_Sirket
            FOREIGN KEY (CompanyId) REFERENCES dbo.Sirketler(CompanyId),
        CONSTRAINT UQ_KolaybiRawData_Company_Entity_External
            UNIQUE (CompanyId, EntityType, ExternalId)
    );
END;
GO

IF NOT EXISTS
(
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_KolaybiRawData_Company_Entity'
      AND object_id = OBJECT_ID(N'dbo.KolaybiRawData')
)
BEGIN
    CREATE INDEX IX_KolaybiRawData_Company_Entity
        ON dbo.KolaybiRawData(CompanyId, EntityType, SyncedAt DESC);
END;
GO

IF NOT EXISTS
(
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_KolaybiRawData_Company_SyncedAt'
      AND object_id = OBJECT_ID(N'dbo.KolaybiRawData')
)
BEGIN
    CREATE INDEX IX_KolaybiRawData_Company_SyncedAt
        ON dbo.KolaybiRawData(CompanyId, SyncedAt DESC);
END;
GO

/* Mevcut şirket RLS policy'sine ham veri tablosunu dahil et. */
IF OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation', N'SP') IS NOT NULL
   AND OBJECT_ID(N'dbo.fn_CompanyIsolationPredicate', N'IF') IS NOT NULL
BEGIN
    IF NOT EXISTS
    (
        SELECT 1 FROM sys.security_predicates
        WHERE object_id = OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
          AND target_object_id = OBJECT_ID(N'dbo.KolaybiRawData')
          AND predicate_type = 0
    )
    BEGIN
        ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
            ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
            ON dbo.KolaybiRawData;
    END;

    IF NOT EXISTS
    (
        SELECT 1 FROM sys.security_predicates
        WHERE object_id = OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
          AND target_object_id = OBJECT_ID(N'dbo.KolaybiRawData')
          AND predicate_type = 1
          AND operation = 1
    )
    BEGIN
        ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
            ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
            ON dbo.KolaybiRawData AFTER INSERT;
    END;

    IF NOT EXISTS
    (
        SELECT 1 FROM sys.security_predicates
        WHERE object_id = OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
          AND target_object_id = OBJECT_ID(N'dbo.KolaybiRawData')
          AND predicate_type = 1
          AND operation = 2
    )
    BEGIN
        ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
            ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
            ON dbo.KolaybiRawData AFTER UPDATE;
    END;

    ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
        WITH (STATE = ON);
END;
GO

PRINT N'010_kolaybi_rawdata tamamlandi.';
GO
