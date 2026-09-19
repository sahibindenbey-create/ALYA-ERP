SET NOCOUNT ON;
SET XACT_ABORT ON;

------------------------------------------------------------
-- 041 - COMPANY ISOLATION / RLS
------------------------------------------------------------

------------------------------------------------------------
-- 1. COMPANY ISOLATION PREDICATE
------------------------------------------------------------

IF OBJECT_ID(N'dbo.fn_CompanyIsolationPredicate', N'IF') IS NULL
BEGIN
    EXEC(N'
    CREATE FUNCTION dbo.fn_CompanyIsolationPredicate
    (
        @CompanyId INT
    )
    RETURNS TABLE
    WITH SCHEMABINDING
    AS
    RETURN
    (
        SELECT 1 AS Allowed
        WHERE @CompanyId =
              TRY_CONVERT(INT, SESSION_CONTEXT(N''CompanyId''))
    );
    ');
END;
GO


------------------------------------------------------------
-- 2. TABLO LİSTESİ
------------------------------------------------------------

DECLARE @Tables TABLE
(
    TableName SYSNAME PRIMARY KEY
);

INSERT INTO @Tables (TableName)
VALUES
(N'CariListesi'),
(N'CariHareketleri'),
(N'CariHareket'),
(N'CariEvrak'),
(N'Siparisler'),
(N'SiparisDetay'),
(N'Urunler'),
(N'UrunDosya'),
(N'Numuneler'),
(N'Teklifler'),
(N'TeklifKalemleri'),
(N'Faturalar'),
(N'FaturaDetay'),
(N'KasaBanka'),
(N'KasaBankaHareketleri'),
(N'FinansHareket'),
(N'Personel'),
(N'PersonelCariAtamalari'),
(N'Receteler'),
(N'ReceteDetay'),
(N'ReceteKalemleri'),
(N'ReceteIstasyon'),
(N'UretimEmirleri'),
(N'FasonIsler'),
(N'FasonHareketleri'),
(N'Irsaliyeler'),
(N'IrsaliyeDetay'),
(N'PlatformSiparisler'),
(N'TekrarlayanNakitAkisi'),
(N'KolaybiCariEslemeleri'),
(N'KolaybiFullSyncRuns'),
(N'KolaybiLinkRuns'),
(N'KolaybiOperationalRecords'),
(N'KolaybiBusinessMappings'),
(N'KolaybiRawData'),
(N'KolaybiRawMirror');


------------------------------------------------------------
-- 3. UYGUN TABLOLARI BUL
------------------------------------------------------------

DECLARE @TableName SYSNAME;
DECLARE @SQL NVARCHAR(MAX);
DECLARE @FirstTable SYSNAME = NULL;

DECLARE TableCursor CURSOR LOCAL FAST_FORWARD
FOR
SELECT t.TableName
FROM @Tables t
WHERE OBJECT_ID(N'dbo.' + t.TableName, N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.' + t.TableName, N'CompanyId') IS NOT NULL
ORDER BY t.TableName;

OPEN TableCursor;

FETCH NEXT FROM TableCursor INTO @TableName;

WHILE @@FETCH_STATUS = 0
BEGIN

    --------------------------------------------------------
    -- CompanyId DEFAULT
    --------------------------------------------------------

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.default_constraints
        WHERE parent_object_id =
              OBJECT_ID(N'dbo.' + @TableName)
          AND name =
              N'DF_' + @TableName + N'_CompanyContext'
    )
    BEGIN

        SET @SQL =
            N'ALTER TABLE dbo.' + QUOTENAME(@TableName) +
            N' ADD CONSTRAINT ' +
            QUOTENAME(N'DF_' + @TableName + N'_CompanyContext') +
            N' DEFAULT
            (
                TRY_CONVERT(INT, SESSION_CONTEXT(N''CompanyId''))
            )
            FOR CompanyId;';

        EXEC sys.sp_executesql @SQL;

    END;


    --------------------------------------------------------
    -- İlk uygun tabloyu bul
    --------------------------------------------------------

    IF @FirstTable IS NULL
    BEGIN
        SET @FirstTable = @TableName;
    END;


    FETCH NEXT FROM TableCursor INTO @TableName;

END;

CLOSE TableCursor;
DEALLOCATE TableCursor;


------------------------------------------------------------
-- 4. HİÇ UYGUN TABLO YOKSA DUR
------------------------------------------------------------

IF @FirstTable IS NULL
BEGIN
    PRINT N'041: CompanyId kolonuna sahip uygun tablo bulunamadı.';
    RETURN;
END;


------------------------------------------------------------
-- 5. SECURITY POLICY YOKSA İLK TABLOYLA OLUŞTUR
------------------------------------------------------------

IF NOT EXISTS
(
    SELECT 1
    FROM sys.security_policies
    WHERE name = N'SecurityPolicy_CompanyIsolation'
)
BEGIN

    SET @SQL =
        N'CREATE SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
          ADD FILTER PREDICATE
              dbo.fn_CompanyIsolationPredicate(CompanyId)
              ON dbo.' + QUOTENAME(@FirstTable) + N',
          ADD BLOCK PREDICATE
              dbo.fn_CompanyIsolationPredicate(CompanyId)
              ON dbo.' + QUOTENAME(@FirstTable) + N' AFTER INSERT,
          ADD BLOCK PREDICATE
              dbo.fn_CompanyIsolationPredicate(CompanyId)
              ON dbo.' + QUOTENAME(@FirstTable) + N' AFTER UPDATE
          WITH (STATE = OFF);';

    EXEC sys.sp_executesql @SQL;

END;


------------------------------------------------------------
-- 6. DİĞER TABLOLARI POLICY'YE EKLE
------------------------------------------------------------

DECLARE AddCursor CURSOR LOCAL FAST_FORWARD
FOR
SELECT t.TableName
FROM @Tables t
WHERE OBJECT_ID(N'dbo.' + t.TableName, N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.' + t.TableName, N'CompanyId') IS NOT NULL
ORDER BY t.TableName;

OPEN AddCursor;

FETCH NEXT FROM AddCursor INTO @TableName;

WHILE @@FETCH_STATUS = 0
BEGIN

    --------------------------------------------------------
    -- FILTER PREDICATE
    --------------------------------------------------------

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.security_predicates p
        INNER JOIN sys.security_policies sp
            ON sp.object_id = p.object_id
        WHERE sp.name = N'SecurityPolicy_CompanyIsolation'
          AND p.target_object_id =
              OBJECT_ID(N'dbo.' + @TableName)
          AND p.predicate_type = 0
    )
    BEGIN

        SET @SQL =
            N'ALTER SECURITY POLICY
              dbo.SecurityPolicy_CompanyIsolation
              ADD FILTER PREDICATE
                  dbo.fn_CompanyIsolationPredicate(CompanyId)
                  ON dbo.' + QUOTENAME(@TableName) + N';';

        EXEC sys.sp_executesql @SQL;

    END;


    --------------------------------------------------------
    -- BLOCK AFTER INSERT
    --------------------------------------------------------

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.security_predicates p
        INNER JOIN sys.security_policies sp
            ON sp.object_id = p.object_id
        WHERE sp.name = N'SecurityPolicy_CompanyIsolation'
          AND p.target_object_id =
              OBJECT_ID(N'dbo.' + @TableName)
          AND p.predicate_type = 1
          AND p.operation_desc = N'INSERT'
    )
    BEGIN

        SET @SQL =
            N'ALTER SECURITY POLICY
              dbo.SecurityPolicy_CompanyIsolation
              ADD BLOCK PREDICATE
                  dbo.fn_CompanyIsolationPredicate(CompanyId)
                  ON dbo.' + QUOTENAME(@TableName) +
              N' AFTER INSERT;';

        EXEC sys.sp_executesql @SQL;

    END;


    --------------------------------------------------------
    -- BLOCK AFTER UPDATE
    --------------------------------------------------------

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.security_predicates p
        INNER JOIN sys.security_policies sp
            ON sp.object_id = p.object_id
        WHERE sp.name = N'SecurityPolicy_CompanyIsolation'
          AND p.target_object_id =
              OBJECT_ID(N'dbo.' + @TableName)
          AND p.predicate_type = 1
          AND p.operation_desc = N'UPDATE'
    )
    BEGIN

        SET @SQL =
            N'ALTER SECURITY POLICY
              dbo.SecurityPolicy_CompanyIsolation
              ADD BLOCK PREDICATE
                  dbo.fn_CompanyIsolationPredicate(CompanyId)
                  ON dbo.' + QUOTENAME(@TableName) +
              N' AFTER UPDATE;';

        EXEC sys.sp_executesql @SQL;

    END;


    FETCH NEXT FROM AddCursor INTO @TableName;

END;

CLOSE AddCursor;
DEALLOCATE AddCursor;


------------------------------------------------------------
-- 7. POLICY'Yİ AKTİF ET
------------------------------------------------------------

ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
WITH (STATE = ON);
GO


------------------------------------------------------------
-- 8. SONUÇ KONTROLÜ
------------------------------------------------------------

SELECT
    sp.name AS SecurityPolicy,
    OBJECT_SCHEMA_NAME(p.target_object_id) AS SchemaName,
    OBJECT_NAME(p.target_object_id) AS TableName,
    p.predicate_type_desc AS PredicateType,
    p.operation_desc AS Operation
FROM sys.security_predicates p
INNER JOIN sys.security_policies sp
    ON sp.object_id = p.object_id
WHERE sp.name = N'SecurityPolicy_CompanyIsolation'
ORDER BY
    TableName,
    PredicateType,
    Operation;


------------------------------------------------------------
-- 9. POLICY DURUMU
------------------------------------------------------------

SELECT
    name AS SecurityPolicy,
    is_enabled AS IsEnabled
FROM sys.security_policies
WHERE name = N'SecurityPolicy_CompanyIsolation';


------------------------------------------------------------
-- 10. FONKSİYON KONTROLÜ
------------------------------------------------------------

SELECT
    OBJECT_SCHEMA_NAME(object_id) AS SchemaName,
    name AS FunctionName,
    type_desc
FROM sys.objects
WHERE object_id =
      OBJECT_ID(N'dbo.fn_CompanyIsolationPredicate');


PRINT N'041 tamamlandı.';
PRINT N'Company Isolation Security Policy aktif edildi.';
