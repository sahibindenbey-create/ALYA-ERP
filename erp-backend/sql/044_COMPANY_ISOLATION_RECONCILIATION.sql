/* ============================================================================
   ALYA ERP - 044 / COMPANY ISOLATION RECONCILIATION (v2 - DÜZELTİLMİŞ)
   ============================================================================
   v1'den FARKLARI:
   - ADIM 0'daki "fn_AlyaCompanyPredicate bulunamadı" ön koşulu KALDIRILDI.
     Gerçek production veritabanında sadece dbo.fn_CompanyIsolationPredicate
     mevcuttu (muhtemelen daha önce manuel oluşturulmuş); fn_AlyaCompanyPredicate
     hiç yoktu. Script artık hangisi varsa onu kullanıyor, hiçbirini şart
     koşmuyor.
   - dbo.Sirketler tablosu taramadan HARİÇ TUTULDU. Bu tablo şirketlerin
     kendisini listeler; oradaki CompanyId o tablonun kendi IDENTITY/PK
     kolonu olabilir ("hangi şirkete ait" değil, "bu hangi şirket" anlamında).
     Kök sql/003_COMPANY_ISOLATION_BLOCK_AND_ENABLE.sql'in yorumu da bunu
     doğruluyor: "Sirketler bilerek RLS dışındadır; şirket seçicinin tüm
     şirketleri görebilmesi gerekir." RLS uygulanırsa şirket seçici ekranı
     kullanıcının erişimi olmayan şirketleri gösteremez hale gelir.

   Bu script v1'i çalıştırmış olsanız bile GÜVENLE TEKRAR ÇALIŞTIRILABİLİR:
   zaten eklenmiş RLS politikalarına dokunmaz, sadece eksik kalanları tamamlar.
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;

------------------------------------------------------------------------------
-- ADIM 1: Kanonik fonksiyonu belirle / yoksa oluştur.
--         Öncelik: fn_CompanyIsolationPredicate zaten varsa onu kullan.
--         O da yoksa fn_AlyaCompanyPredicate'i kullan.
--         İkisi de yoksa fn_CompanyIsolationPredicate'i sıfırdan oluştur.
------------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.fn_CompanyIsolationPredicate', N'IF') IS NOT NULL
    PRINT N'dbo.fn_CompanyIsolationPredicate zaten mevcut, kullanılacak.';
ELSE IF OBJECT_ID(N'dbo.fn_AlyaCompanyPredicate', N'IF') IS NOT NULL
BEGIN
    EXEC(N'
        CREATE FUNCTION dbo.fn_CompanyIsolationPredicate(@CompanyId INT)
        RETURNS TABLE
        WITH SCHEMABINDING
        AS
        RETURN SELECT 1 AS Allowed
        WHERE @CompanyId = ISNULL(TRY_CONVERT(INT, SESSION_CONTEXT(N''CompanyId'')), 1);
    ');
    PRINT N'dbo.fn_CompanyIsolationPredicate oluşturuldu (fn_AlyaCompanyPredicate ile aynı mantık).';
END
ELSE
BEGIN
    EXEC(N'
        CREATE FUNCTION dbo.fn_CompanyIsolationPredicate(@CompanyId INT)
        RETURNS TABLE
        WITH SCHEMABINDING
        AS
        RETURN SELECT 1 AS Allowed
        WHERE @CompanyId = ISNULL(TRY_CONVERT(INT, SESSION_CONTEXT(N''CompanyId'')), 1);
    ');
    PRINT N'dbo.fn_CompanyIsolationPredicate sıfırdan oluşturuldu (ikisi de yoktu).';
END;
GO

------------------------------------------------------------------------------
-- ADIM 2: CompanyId taşıyan ama HİÇBİR filter predicate'i olmayan
--         tüm tabloları tara (Sirketler HARİÇ) ve kanonik fonksiyonla
--         kapsama al. Zaten korunanlara dokunmaz.
------------------------------------------------------------------------------
DECLARE @TableName SYSNAME, @sql NVARCHAR(MAX), @policyName SYSNAME, @defaultName SYSNAME;

-- Bilinçli olarak RLS dışında tutulan referans/lookup tabloları:
DECLARE @Excluded TABLE (TableName SYSNAME PRIMARY KEY);
INSERT INTO @Excluded(TableName) VALUES (N'Sirketler');

DECLARE candidate_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT t.name
    FROM sys.tables t
    INNER JOIN sys.columns c
        ON c.object_id = t.object_id AND c.name = N'CompanyId'
    WHERE t.schema_id = SCHEMA_ID(N'dbo')
      AND t.name NOT IN (SELECT TableName FROM @Excluded)
      AND c.is_identity = 0   -- CompanyId kendisi IDENTITY ise bu tablo bir "referans" tablosudur, atla
      AND NOT EXISTS (
          SELECT 1
          FROM sys.security_predicates p
          WHERE p.target_object_id = t.object_id
            AND p.predicate_type = 0 /* FILTER */
      )
    ORDER BY t.name;

OPEN candidate_cursor;
FETCH NEXT FROM candidate_cursor INTO @TableName;

WHILE @@FETCH_STATUS = 0
BEGIN
    BEGIN TRY
        SET @defaultName = N'DF_' + @TableName + N'_CompanyContext_044';
        IF NOT EXISTS (
            SELECT 1 FROM sys.default_constraints dc
            INNER JOIN sys.columns col
                ON col.object_id = dc.parent_object_id AND col.column_id = dc.parent_column_id
            WHERE dc.parent_object_id = OBJECT_ID(N'dbo.' + @TableName)
              AND col.name = N'CompanyId'
        )
        BEGIN
            SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@TableName) +
                       N' ADD CONSTRAINT ' + QUOTENAME(@defaultName) +
                       N' DEFAULT (ISNULL(TRY_CONVERT(INT, SESSION_CONTEXT(N''CompanyId'')), 1)) FOR CompanyId;';
            EXEC sys.sp_executesql @sql;
        END;

        SET @policyName = N'RLS_Reconciled_044_' + @TableName;
        IF NOT EXISTS (SELECT 1 FROM sys.security_policies WHERE name = @policyName)
        BEGIN
            SET @sql = N'CREATE SECURITY POLICY dbo.' + QUOTENAME(@policyName) + N'
                ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.' + QUOTENAME(@TableName) + N',
                ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.' + QUOTENAME(@TableName) + N' AFTER INSERT,
                ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.' + QUOTENAME(@TableName) + N' AFTER UPDATE
                WITH (STATE = ON);';
            EXEC sys.sp_executesql @sql;
            PRINT N'RLS eklendi: ' + @TableName;
        END;
    END TRY
    BEGIN CATCH
        PRINT N'UYARI: ' + @TableName + N' için RLS eklenemedi -> ' + ERROR_MESSAGE();
    END CATCH

    FETCH NEXT FROM candidate_cursor INTO @TableName;
END;

CLOSE candidate_cursor;
DEALLOCATE candidate_cursor;
GO

------------------------------------------------------------------------------
-- ADIM 3: TAM KAPSAM RAPORU
------------------------------------------------------------------------------
SELECT
    t.name AS TableName,
    CASE WHEN t.name = N'Sirketler' THEN N'— bilinçli olarak hariç (referans tablosu)'
         WHEN EXISTS (
             SELECT 1 FROM sys.security_predicates p
             WHERE p.target_object_id = t.object_id AND p.predicate_type = 0
         ) THEN N'✔ RLS AKTİF'
         ELSE N'✘ RLS YOK — İNCELENMELİ' END AS RlsStatus,
    (
        SELECT STRING_AGG(sp.name, N', ')
        FROM sys.security_predicates p
        INNER JOIN sys.security_policies sp ON sp.object_id = p.object_id
        WHERE p.target_object_id = t.object_id AND p.predicate_type = 0
    ) AS PolicyNames
FROM sys.tables t
INNER JOIN sys.columns c
    ON c.object_id = t.object_id AND c.name = N'CompanyId'
WHERE t.schema_id = SCHEMA_ID(N'dbo')
ORDER BY RlsStatus DESC, TableName;
GO
