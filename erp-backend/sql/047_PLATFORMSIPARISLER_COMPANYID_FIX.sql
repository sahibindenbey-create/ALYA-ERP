/* Sadece eksik olan DEFAULT kısıtını ekler. Tek başına, basit, net. */
IF NOT EXISTS (
    SELECT 1 FROM sys.default_constraints dc
    INNER JOIN sys.columns col ON col.object_id=dc.parent_object_id AND col.column_id=dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID(N'dbo.PlatformSiparisler') AND col.name = N'CompanyId'
)
BEGIN
    ALTER TABLE dbo.PlatformSiparisler
        ADD CONSTRAINT DF_PlatformSiparisler_CompanyContext
        DEFAULT (TRY_CONVERT(INT, SESSION_CONTEXT(N'CompanyId'))) FOR CompanyId;
    PRINT N'DEFAULT kısıtı eklendi.';
END
ELSE
    PRINT N'DEFAULT kısıtı zaten vardı.';
GO

-- Doğrulama - bu sorgu en az 1 satır döndürmeli:
SELECT
    OBJECT_NAME(dc.parent_object_id) AS Tablo,
    col.name AS Kolon,
    dc.definition AS DefaultTanimi
FROM sys.default_constraints dc
INNER JOIN sys.columns col ON col.object_id=dc.parent_object_id AND col.column_id=dc.parent_column_id
WHERE dc.parent_object_id = OBJECT_ID(N'dbo.PlatformSiparisler') AND col.name = N'CompanyId';
GO

-- BLOCK predicate'leri de ekleyelim (FILTER zaten vardı, INSERT/UPDATE
-- koruması eksikti). Bu adım ayrı: hata verirse yukarıdaki DEFAULT
-- düzeltmesini etkilemez.
BEGIN TRY
    IF NOT EXISTS (
        SELECT 1 FROM sys.security_predicates p
        INNER JOIN sys.security_policies sp ON sp.object_id=p.object_id
        WHERE sp.name=N'SecurityPolicy_CompanyIsolation'
          AND p.target_object_id=OBJECT_ID(N'dbo.PlatformSiparisler')
          AND p.predicate_type=1 AND p.operation_desc=N'INSERT'
    )
        ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
            ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.PlatformSiparisler AFTER INSERT;

    IF NOT EXISTS (
        SELECT 1 FROM sys.security_predicates p
        INNER JOIN sys.security_policies sp ON sp.object_id=p.object_id
        WHERE sp.name=N'SecurityPolicy_CompanyIsolation'
          AND p.target_object_id=OBJECT_ID(N'dbo.PlatformSiparisler')
          AND p.predicate_type=1 AND p.operation_desc=N'UPDATE'
    )
        ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
            ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.PlatformSiparisler AFTER UPDATE;

    PRINT N'BLOCK predicate kontrolü tamamlandı.';
END TRY
BEGIN CATCH
    PRINT N'UYARI (önemli değil, DEFAULT kısıtı zaten eklendi): ' + ERROR_MESSAGE();
END CATCH
GO
