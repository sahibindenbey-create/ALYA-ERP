/*
  ALYA ERP - 003 / COMPANY ISOLATION SON AŞAMA
  Amaç:
    1) Mevcut CompanyId RLS FILTER predicate'lerini korumak.
    2) INSERT / UPDATE tarafında şirketler arası veri yazılmasını BLOCK predicate ile engellemek.
    3) Policy'yi yalnızca gerekli tablolar doğrulandıktan sonra ENABLE etmek.

  ÖNEMLİ:
    Bu script'i ERP backend güncel haliyle çalıştırdıktan sonra SSMS'te çalıştırın.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRAN;

    IF OBJECT_ID(N'dbo.Sirketler', N'U') IS NULL
        THROW 51001, N'dbo.Sirketler bulunamadı.', 1;

    IF OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation', N'SP') IS NULL
        THROW 51002, N'SecurityPolicy_CompanyIsolation bulunamadı. Önce 002 / Aşama 3 scriptini çalıştırın.', 1;

    IF OBJECT_ID(N'dbo.fn_CompanyIsolationPredicate', N'IF') IS NULL
        THROW 51003, N'fn_CompanyIsolationPredicate bulunamadı.', 1;

    DECLARE @Expected TABLE (TableName sysname PRIMARY KEY);
    INSERT INTO @Expected(TableName) VALUES
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

    IF EXISTS (
        SELECT 1 FROM @Expected e
        WHERE OBJECT_ID(N'dbo.' + e.TableName, N'U') IS NULL
    )
    BEGIN
        DECLARE @Missing nvarchar(max) = N'';
        SELECT @Missing = @Missing + CASE WHEN @Missing = N'' THEN N'' ELSE N', ' END + TableName
        FROM @Expected
        WHERE OBJECT_ID(N'dbo.' + TableName, N'U') IS NULL;
        THROW 51004, @Missing, 1;
    END;

    /* CompanyId taşıyan fakat RLS kapsamına alınmamış tablo varsa DUR. */
    DECLARE @Unexpected TABLE (TableName sysname);
    INSERT INTO @Unexpected(TableName)
    SELECT t.name
    FROM sys.tables t
    INNER JOIN sys.columns c ON c.object_id = t.object_id
    WHERE SCHEMA_NAME(t.schema_id) = N'dbo'
      AND c.name = N'CompanyId'
      AND t.name <> N'Sirketler'
      AND NOT EXISTS (SELECT 1 FROM @Expected e WHERE e.TableName = t.name)
      AND t.name NOT LIKE N'__EFMigrationsHistory%';

    IF EXISTS (SELECT 1 FROM @Unexpected)
    BEGIN
        DECLARE @UnexpectedText nvarchar(max) = N'';
        SELECT @UnexpectedText = @UnexpectedText + CASE WHEN @UnexpectedText = N'' THEN N'' ELSE N', ' END + TableName
        FROM @Unexpected;
        THROW 51005, @UnexpectedText, 1;
    END;

    /* INSERT / UPDATE BLOCK predicate ekle.
       Dinamik SQL ayrı değişkende oluşturuluyor; böylece eski SQL Server parser sürümlerindeki
       EXEC(...) + QUOTENAME ayrıştırma problemi oluşmuyor. */
    DECLARE @TableName sysname;
    DECLARE @Sql nvarchar(max);

    DECLARE table_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT TableName FROM @Expected ORDER BY TableName;

    OPEN table_cursor;
    FETCH NEXT FROM table_cursor INTO @TableName;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM sys.security_predicates sp
            INNER JOIN sys.objects o ON o.object_id = sp.target_object_id
            WHERE sp.security_policy_id = OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
              AND o.object_id = OBJECT_ID(N'dbo.' + @TableName)
              AND sp.predicate_type_desc = N'BLOCK'
              AND sp.predicate_operation_desc = N'AFTER INSERT'
        )
        BEGIN
            SET @Sql = N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.'
                     + QUOTENAME(@TableName) + N' AFTER INSERT;';
            EXEC sys.sp_executesql @Sql;
        END;

        IF NOT EXISTS (
            SELECT 1
            FROM sys.security_predicates sp
            INNER JOIN sys.objects o ON o.object_id = sp.target_object_id
            WHERE sp.security_policy_id = OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
              AND o.object_id = OBJECT_ID(N'dbo.' + @TableName)
              AND sp.predicate_type_desc = N'BLOCK'
              AND sp.predicate_operation_desc = N'AFTER UPDATE'
        )
        BEGIN
            SET @Sql = N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.'
                     + QUOTENAME(@TableName) + N' AFTER UPDATE;';
            EXEC sys.sp_executesql @Sql;
        END;

        FETCH NEXT FROM table_cursor INTO @TableName;
    END;

    CLOSE table_cursor;
    DEALLOCATE table_cursor;

    DECLARE @ExpectedCount int = (SELECT COUNT(*) FROM @Expected);
    DECLARE @InsertBlockCount int = (
        SELECT COUNT(*)
        FROM sys.security_predicates sp
        INNER JOIN sys.objects o ON o.object_id = sp.target_object_id
        WHERE sp.security_policy_id = OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
          AND sp.predicate_type_desc = N'BLOCK'
          AND sp.predicate_operation_desc = N'AFTER INSERT'
          AND EXISTS (SELECT 1 FROM @Expected e WHERE e.TableName = o.name)
    );
    DECLARE @UpdateBlockCount int = (
        SELECT COUNT(*)
        FROM sys.security_predicates sp
        INNER JOIN sys.objects o ON o.object_id = sp.target_object_id
        WHERE sp.security_policy_id = OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
          AND sp.predicate_type_desc = N'BLOCK'
          AND sp.predicate_operation_desc = N'AFTER UPDATE'
          AND EXISTS (SELECT 1 FROM @Expected e WHERE e.TableName = o.name)
    );

    IF @InsertBlockCount <> @ExpectedCount OR @UpdateBlockCount <> @ExpectedCount
        THROW 51006, N'RLS BLOCK predicate kontrolü başarısız. Policy ENABLE edilmedi.', 1;

    ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation WITH (STATE = ON);

    COMMIT;

    SELECT
      N'RLS AKTİF' AS Durum,
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

    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH;
