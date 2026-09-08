/* ALYA ERP - Pazaryeri kayıtlarını şirket bazlı hale getirir. */

IF OBJECT_ID('dbo.PlatformSiparisler','U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.PlatformSiparisler','CompanyId') IS NULL
    BEGIN
        ALTER TABLE dbo.PlatformSiparisler
        ADD CompanyId INT NOT NULL
            CONSTRAINT DF_PlatformSiparisler_CompanyId DEFAULT (1) WITH VALUES;
    END;

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_PlatformSiparisler_CompanyId'
          AND object_id = OBJECT_ID('dbo.PlatformSiparisler')
    )
    BEGIN
        CREATE INDEX IX_PlatformSiparisler_CompanyId
        ON dbo.PlatformSiparisler(CompanyId, Platform, OrderNumber);
    END;
END;
