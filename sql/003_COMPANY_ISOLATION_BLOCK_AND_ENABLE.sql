/* ALYA ERP - 003 / COMPANY ISOLATION SON ASAMA */
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRAN;

    IF OBJECT_ID(N'dbo.Sirketler', N'U') IS NULL THROW 51001, N'dbo.Sirketler bulunamadi.', 1;
    IF OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation', N'SP') IS NULL THROW 51002, N'SecurityPolicy_CompanyIsolation bulunamadi. Once 002 / Asama 3 scriptini calistirin.', 1;
    IF OBJECT_ID(N'dbo.fn_CompanyIsolationPredicate', N'IF') IS NULL THROW 51003, N'fn_CompanyIsolationPredicate bulunamadi.', 1;

    DECLARE @Expected TABLE (TableName sysname PRIMARY KEY);
    INSERT INTO @Expected(TableName) VALUES
    (N'BordroParametreleri'),(N'CariEvrak'),(N'CariHareket'),(N'CariHareketleri'),(N'CariListesi'),
    (N'DovizBozum'),(N'Hizmetler'),(N'IhracatIslemleri'),(N'IhracatEvrak'),(N'Numuneler'),
    (N'Personeller'),(N'PersonelIzin'),(N'PersonelMaas'),(N'PersonelPuantaj'),(N'PlatformSiparisler'),
    (N'ReceteDetay'),(N'Receteler'),(N'SabitGiderler'),(N'SiparisDetay'),(N'Siparisler'),
    (N'TeklifKalemleri'),(N'Teklifler'),(N'UrunDosya'),(N'Urunler'),(N'MaliyetParametreleri');

    IF EXISTS (SELECT 1 FROM @Expected WHERE OBJECT_ID(N'dbo.' + TableName, N'U') IS NULL)
        THROW 51004, N'Beklenen sirket tablosu eksik.', 1;

    DECLARE @Unexpected TABLE (TableName sysname);
    INSERT INTO @Unexpected(TableName)
    SELECT t.name FROM sys.tables t
    INNER JOIN sys.columns c ON c.object_id=t.object_id
    WHERE SCHEMA_NAME(t.schema_id)=N'dbo' AND c.name=N'CompanyId'
      AND t.name<>N'Sirketler'
      AND NOT EXISTS (SELECT 1 FROM @Expected e WHERE e.TableName=t.name)
      AND t.name NOT LIKE N'__EFMigrationsHistory%';

    IF EXISTS (SELECT 1 FROM @Unexpected)
        THROW 51005, N'RLS kapsaminda olmayan CompanyId tablosu bulundu. Once bu tabloyu izolasyona dahil edin.', 1;

    DECLARE @TableName sysname;
    DECLARE @Sql nvarchar(max);
    DECLARE table_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT TableName FROM @Expected ORDER BY TableName;
    OPEN table_cursor;
    FETCH NEXT FROM table_cursor INTO @TableName;

    WHILE @@FETCH_STATUS=0
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM sys.security_predicates sp
            INNER JOIN sys.objects o ON o.object_id=sp.target_object_id
            WHERE sp.security_policy_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
              AND o.object_id=OBJECT_ID(N'dbo.'+@TableName)
              AND sp.predicate_type_desc=N'BLOCK'
              AND sp.predicate_operation_desc=N'AFTER INSERT')
        BEGIN
            SET @Sql=N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.['
                + REPLACE(@TableName,N']',N']]') + N'] AFTER INSERT;';
            EXEC sys.sp_executesql @Sql;
        END;

        IF NOT EXISTS (
            SELECT 1 FROM sys.security_predicates sp
            INNER JOIN sys.objects o ON o.object_id=sp.target_object_id
            WHERE sp.security_policy_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
              AND o.object_id=OBJECT_ID(N'dbo.'+@TableName)
              AND sp.predicate_type_desc=N'BLOCK'
              AND sp.predicate_operation_desc=N'AFTER UPDATE')
        BEGIN
            SET @Sql=N'ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.['
                + REPLACE(@TableName,N']',N']]') + N'] AFTER UPDATE;';
            EXEC sys.sp_executesql @Sql;
        END;

        FETCH NEXT FROM table_cursor INTO @TableName;
    END;
    CLOSE table_cursor;
    DEALLOCATE table_cursor;

    DECLARE @ExpectedCount int=(SELECT COUNT(*) FROM @Expected);
    DECLARE @InsertBlockCount int=(SELECT COUNT(*) FROM sys.security_predicates sp
        INNER JOIN sys.objects o ON o.object_id=sp.target_object_id
        WHERE sp.security_policy_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
          AND sp.predicate_type_desc=N'BLOCK' AND sp.predicate_operation_desc=N'AFTER INSERT'
          AND EXISTS(SELECT 1 FROM @Expected e WHERE e.TableName=o.name));
    DECLARE @UpdateBlockCount int=(SELECT COUNT(*) FROM sys.security_predicates sp
        INNER JOIN sys.objects o ON o.object_id=sp.target_object_id
        WHERE sp.security_policy_id=OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
          AND sp.predicate_type_desc=N'BLOCK' AND sp.predicate_operation_desc=N'AFTER UPDATE'
          AND EXISTS(SELECT 1 FROM @Expected e WHERE e.TableName=o.name));

    IF @InsertBlockCount<>@ExpectedCount OR @UpdateBlockCount<>@ExpectedCount
        THROW 51006, N'RLS BLOCK predicate kontrolu basarisiz. Policy ENABLE edilmedi.', 1;

    ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation WITH (STATE=ON);
    COMMIT;

    SELECT N'RLS AKTIF' AS Durum,@ExpectedCount AS CompanyScopedTableCount,
           @InsertBlockCount AS InsertBlockPredicateCount,@UpdateBlockCount AS UpdateBlockPredicateCount;
END TRY
BEGIN CATCH
    IF CURSOR_STATUS('local','table_cursor')>=0 BEGIN CLOSE table_cursor; DEALLOCATE table_cursor; END;
    IF XACT_STATE()<>0 ROLLBACK;
    THROW;
END CATCH;