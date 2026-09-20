/* ============================================================================
   ALYA ERP - 047 / PLATFORMSIPARISLER COMPANYID DEFAULT DUZELTMESI
   ============================================================================
   AMAC: PlatformSiparisler.CompanyId NOT NULL ama DEFAULT kisiti yoktu -
   trendyol.js'in INSERT'i (CompanyId'yi listede tutmaz, DEFAULT'a guvenir)
   "Cannot insert the value NULL into column 'CompanyId'" hatasi verdi.
   041, bu tabloyu listesine almisti ama calistigi anda tablo/kolon henuz
   yoktu ya da baska bir sebeple atlanmis - tam sebep onemli degil, bu
   migration durumu duzeltiyor.

   Idempotent - defalarca calistirilabilir.
   ============================================================================ */
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.PlatformSiparisler', N'U') IS NULL
BEGIN
    PRINT N'047: dbo.PlatformSiparisler tablosu bulunamadı, atlanıyor.';
END
ELSE IF COL_LENGTH(N'dbo.PlatformSiparisler', N'CompanyId') IS NULL
BEGIN
    PRINT N'047: dbo.PlatformSiparisler.CompanyId kolonu bulunamadı, atlanıyor.';
END
ELSE
BEGIN
    -- 1) DEFAULT kısıtı ekle
    IF NOT EXISTS (
        SELECT 1 FROM sys.default_constraints dc
        INNER JOIN sys.columns col ON col.object_id=dc.parent_object_id AND col.column_id=dc.parent_column_id
        WHERE dc.parent_object_id=OBJECT_ID(N'dbo.PlatformSiparisler') AND col.name=N'CompanyId'
    )
    BEGIN
        ALTER TABLE dbo.PlatformSiparisler
            ADD CONSTRAINT DF_PlatformSiparisler_CompanyContext
            DEFAULT (TRY_CONVERT(INT, SESSION_CONTEXT(N'CompanyId'))) FOR CompanyId;
        PRINT N'047: DF_PlatformSiparisler_CompanyContext eklendi.';
    END
    ELSE
        PRINT N'047: PlatformSiparisler.CompanyId zaten bir DEFAULT''a sahip.';

    -- 2) RLS kapsamda mı, değilse fn_CompanyIsolationPredicate ile ekle
    IF NOT EXISTS (
        SELECT 1 FROM sys.security_predicates p
        WHERE p.target_object_id = OBJECT_ID(N'dbo.PlatformSiparisler') AND p.predicate_type = 0
    )
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name=N'SecurityPolicy_CompanyIsolation')
        BEGIN
            ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
                ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.PlatformSiparisler,
                ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.PlatformSiparisler AFTER INSERT,
                ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.PlatformSiparisler AFTER UPDATE;
            PRINT N'047: PlatformSiparisler, SecurityPolicy_CompanyIsolation kapsamına eklendi.';
        END
    END
    ELSE
        PRINT N'047: PlatformSiparisler zaten RLS kapsamında.';
END;

PRINT N'047 tamamlandı.';
