/* ALYA ERP - 003 / COMPANY ISOLATION SON ASAMA */
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRAN;

    /* 1 - Temel kontroller */
    IF OBJECT_ID(N'dbo.Sirketler', N'U') IS NULL
        THROW 51001, N'dbo.Sirketler bulunamadi.', 1;

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.security_policies
        WHERE object_id = OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
    )
        THROW 51002, N'SecurityPolicy_CompanyIsolation bulunamadi. Once 002 / Asama 3 scriptini calistirin.', 1;

    IF OBJECT_ID(N'dbo.fn_CompanyIsolationPredicate', N'IF') IS NULL
        THROW 51003, N'fn_CompanyIsolationPredicate bulunamadi.', 1;

    /* 2 - RLS kapsamindaki tablolar */
    DECLARE @Expected TABLE
    (
        TableName sysname PRIMARY KEY
    );

    INSERT INTO @Expected(TableName)
    VALUES
        (N'BordroParametreleri'),
        (N'CariEvrak'),
        (N'CariHareket'),
        (N'CariHareketleri'),
        (N'CariListesi'),
        (N'DovizBozum'),
        (N'Hizmetler'),
        (N'IhracatIslemleri'),
        (N'IhracatEvrak'),
        (N'Numuneler'),
        (N'Personeller'),
        (N'PersonelIzin'),
        (N'PersonelMaas'),
        (N'PersonelPuantaj'),
        (N'PlatformSiparisler'),
        (N'ReceteDetay'),
        (N'Receteler'),
        (N'SabitGiderler'),
        (N'SiparisDetay'),
        (N'Siparisler'),
        (N'TeklifKalemleri'),
        (N'Teklifler'),
        (N'UrunDosya'),
        (N'Urunler'),
        (N'MaliyetParametreleri');

    /* 3 - Beklenen tablolarin varligini kontrol et */
    IF EXISTS
    (
        SELECT 1
        FROM @Expected E
        WHERE OBJECT_ID(N'dbo.' + E.TableName, N'U') IS NULL
    )
        THROW 51004, N'Beklenen sirket tablosu eksik.', 1;

    /* 4 - CompanyId olup RLS listesinde olmayan tablo kontrolu */
    DECLARE @Unexpected TABLE
    (
        TableName sysname
    );

    INSERT INTO @Unexpected(TableName)
    SELECT DISTINCT T.name
    FROM sys.tables T
    INNER JOIN sys.columns C
        ON C.object_id = T.object_id
    WHERE SCHEMA_NAME(T.schema_id) = N'dbo'
      AND C.name = N'CompanyId'
      AND T.name <> N'Sirketler'
      AND NOT EXISTS
      (
          SELECT 1
          FROM @Expected E
          WHERE E.TableName = T.name
      )
      AND T.name NOT LIKE N'__EFMigrationsHistory%';

    IF EXISTS (SELECT 1 FROM @Unexpected)
    BEGIN
        PRINT N'RLS kapsaminda olmayan CompanyId tablolari:';
        SELECT TableName FROM @Unexpected ORDER BY TableName;
        THROW 51005, N'RLS kapsaminda olmayan CompanyId tablosu bulundu. Once bu tabloyu izolasyona dahil edin.', 1;
    END;

    /* 5 - BLOCK predicate'leri ekle */
    DECLARE @PolicyObjectId int;
    DECLARE @TableName sysname;
    DECLARE @Sql nvarchar(max);

    SELECT @PolicyObjectId = object_id
    FROM sys.security_policies
    WHERE object_id = OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation');

    DECLARE table_cursor CURSOR LOCAL FAST_FORWARD
    FOR
        SELECT TableName
        FROM @Expected
        ORDER BY TableName;

    OPEN table_cursor;
    FETCH NEXT FROM table_cursor INTO @TableName;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        /* AFTER INSERT */
        IF NOT EXISTS
        (
            SELECT 1
            FROM sys.security_predicates SP
            WHERE SP.object_id = @PolicyObjectId
              AND SP.target_object_id = OBJECT_ID(N'dbo.' + @TableName)
              AND SP.predicate_type_desc = N'BLOCK'
              AND SP.operation_desc = N'AFTER INSERT'
        )
        BEGIN
            SET @Sql =
                N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation '
                + N'ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) '
                + N'ON dbo.' + @TableName + N' AFTER INSERT;';

            EXEC sys.sp_executesql @Sql;
        END;

        /* AFTER UPDATE */
        IF NOT EXISTS
        (
            SELECT 1
            FROM sys.security_predicates SP
            WHERE SP.object_id = @PolicyObjectId
              AND SP.target_object_id = OBJECT_ID(N'dbo.' + @TableName)
              AND SP.predicate_type_desc = N'BLOCK'
              AND SP.operation_desc = N'AFTER UPDATE'
        )
        BEGIN
            SET @Sql =
                N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation '
                + N'ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) '
                + N'ON dbo.' + @TableName + N' AFTER UPDATE;';

            EXEC sys.sp_executesql @Sql;
        END;

        FETCH NEXT FROM table_cursor INTO @TableName;
    END;

    CLOSE table_cursor;
    DEALLOCATE table_cursor;

    /* 6 - BLOCK predicate sayilarini kontrol et */
    DECLARE @ExpectedCount int;
    DECLARE @InsertBlockCount int;
    DECLARE @UpdateBlockCount int;

    SELECT @ExpectedCount = COUNT(*)
    FROM @Expected;

    SELECT @InsertBlockCount = COUNT(*)
    FROM sys.security_predicates SP
    WHERE SP.object_id = @PolicyObjectId
      AND SP.predicate_type_desc = N'BLOCK'
      AND SP.operation_desc = N'AFTER INSERT'
      AND EXISTS
      (
          SELECT 1
          FROM @Expected E
          WHERE E.TableName = OBJECT_NAME(SP.target_object_id)
      );

    SELECT @UpdateBlockCount = COUNT(*)
    FROM sys.security_predicates SP
    WHERE SP.object_id = @PolicyObjectId
      AND SP.predicate_type_desc = N'BLOCK'
      AND SP.operation_desc = N'AFTER UPDATE'
      AND EXISTS
      (
          SELECT 1
          FROM @Expected E
          WHERE E.TableName = OBJECT_NAME(SP.target_object_id)
      );

    IF @InsertBlockCount <> @ExpectedCount
       OR @UpdateBlockCount <> @ExpectedCount
    BEGIN
        PRINT N'Beklenen tablo sayisi: ' + CAST(@ExpectedCount AS nvarchar(20));
        PRINT N'AFTER INSERT BLOCK sayisi: ' + CAST(@InsertBlockCount AS nvarchar(20));
        PRINT N'AFTER UPDATE BLOCK sayisi: ' + CAST(@UpdateBlockCount AS nvarchar(20));
        THROW 51006, N'RLS BLOCK predicate kontrolu basarisiz. Policy ENABLE edilmedi.', 1;
    END;

    /* 7 - RLS aktif et */
    ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
        WITH (STATE = ON);

    COMMIT;

    /* 8 - Sonuc */
    SELECT
        N'RLS AKTIF' AS Durum,
        @ExpectedCount AS CompanyScopedTableCount,
        @InsertBlockCount AS InsertBlockPredicateCount,
        @UpdateBlockCount AS UpdateBlockPredicateCount;

END TRY
BEGIN CATCH

    IF CURSOR_STATUS('local', 'table_cursor') >= 0
    BEGIN
        CLOSE table_cursor;
        DEALLOCATE table_cursor;
    END;

    IF XACT_STATE() <> 0
        ROLLBACK;

    THROW;
END CATCH;