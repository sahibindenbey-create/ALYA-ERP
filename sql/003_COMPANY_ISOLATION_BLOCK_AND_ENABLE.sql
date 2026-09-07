/* ALYA ERP - 003 / COMPANY ISOLATION - FINAL RLS */
/*
   Gercek myERP semasina gore 9 sirket-bazli tablo:
   CariListesi, Hizmetler, KolaybiAyarlar, KolaybiSyncKayitlari,
   ReceteDetay, Receteler, SiparisDetay, Siparisler, Urunler.

   Sirketler bilerek RLS disindadir; sirket secicinin 3 sirketi gorebilmesi gerekir.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRAN;

    IF OBJECT_ID(N'dbo.Sirketler', N'U') IS NULL
        THROW 51001, N'dbo.Sirketler bulunamadi.', 1;

    IF OBJECT_ID(N'dbo.fn_CompanyIsolationPredicate', N'IF') IS NULL
        THROW 51002, N'fn_CompanyIsolationPredicate bulunamadi.', 1;

    DECLARE @Expected TABLE (TableName sysname PRIMARY KEY);

    INSERT INTO @Expected(TableName)
    VALUES
        (N'CariListesi'),
        (N'Hizmetler'),
        (N'KolaybiAyarlar'),
        (N'KolaybiSyncKayitlari'),
        (N'ReceteDetay'),
        (N'Receteler'),
        (N'SiparisDetay'),
        (N'Siparisler'),
        (N'Urunler');

    IF EXISTS
    (
        SELECT 1
        FROM @Expected E
        WHERE OBJECT_ID(N'dbo.' + E.TableName, N'U') IS NULL
    )
        THROW 51003, N'RLS hedef tablolarindan biri bulunamadi.', 1;

    IF EXISTS
    (
        SELECT 1
        FROM @Expected E
        WHERE NOT EXISTS
        (
            SELECT 1
            FROM sys.columns C
            WHERE C.object_id = OBJECT_ID(N'dbo.' + E.TableName)
              AND C.name = N'CompanyId'
              AND C.is_nullable = 0
        )
    )
        THROW 51004, N'RLS hedef tablolarindan birinde NOT NULL CompanyId bulunamadi.', 1;

    /* Eski policy varsa tamamen temizle. */
    IF EXISTS
    (
        SELECT 1
        FROM sys.security_policies
        WHERE object_id = OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
    )
    BEGIN
        DROP SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation;
        PRINT N'Eski policy silindi.';
    END;

    /* Policy once FILTER predicate ile olusturulur. */
    CREATE SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
    ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.CariListesi,
    ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.Hizmetler,
    ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.KolaybiAyarlar,
    ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.KolaybiSyncKayitlari,
    ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.ReceteDetay,
    ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.Receteler,
    ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.SiparisDetay,
    ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.Siparisler,
    ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.Urunler;

    /* INSERT / UPDATE ile baska sirket verisi yazilmasini engelle. */
    ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
    ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.CariListesi AFTER INSERT;
    ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
    ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.CariListesi AFTER UPDATE;

    ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
    ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.Hizmetler AFTER INSERT;
    ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
    ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.Hizmetler AFTER UPDATE;

    ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
    ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.KolaybiAyarlar AFTER INSERT;
    ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
    ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.KolaybiAyarlar AFTER UPDATE;

    ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
    ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.KolaybiSyncKayitlari AFTER INSERT;
    ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
    ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.KolaybiSyncKayitlari AFTER UPDATE;

    ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
    ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.ReceteDetay AFTER INSERT;
    ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
    ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.ReceteDetay AFTER UPDATE;

    ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
    ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.Receteler AFTER INSERT;
    ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
    ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.Receteler AFTER UPDATE;

    ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
    ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.SiparisDetay AFTER INSERT;
    ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
    ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.SiparisDetay AFTER UPDATE;

    ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
    ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.Siparisler AFTER INSERT;
    ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
    ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.Siparisler AFTER UPDATE;

    ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
    ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.Urunler AFTER INSERT;
    ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
    ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
        ON dbo.Urunler AFTER UPDATE;

    ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
        WITH (STATE = ON);

    COMMIT;

    SELECT
        sp.name AS PolicyName,
        sp.is_enabled AS IsEnabled,
        OBJECT_SCHEMA_NAME(p.target_object_id) AS SchemaName,
        OBJECT_NAME(p.target_object_id) AS TableName,
        p.predicate_type_desc AS PredicateType,
        p.operation_desc AS Operation
    FROM sys.security_predicates p
    INNER JOIN sys.security_policies sp
        ON sp.object_id = p.object_id
    WHERE sp.name = N'SecurityPolicy_CompanyIsolation'
    ORDER BY TableName, PredicateType, Operation;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK;
    THROW;
END CATCH;
