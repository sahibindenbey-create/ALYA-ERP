/* ALYA ERP - 005 / COMPANY ISOLATION HARDENING */
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @Tables TABLE (TableName SYSNAME PRIMARY KEY);
INSERT INTO @Tables(TableName) VALUES
(N'CariListesi'),(N'CariHareketleri'),(N'CariEvrak'),(N'Siparisler'),(N'SiparisDetay'),
(N'Urunler'),(N'UrunDosya'),(N'Numuneler'),(N'Teklifler'),(N'TeklifKalemleri'),
(N'Faturalar'),(N'FaturaDetay'),(N'KasaBanka'),(N'KasaBankaHareketleri'),(N'Personel'),
(N'Receteler'),(N'ReceteDetay'),(N'ReceteKalemleri'),(N'ReceteIstasyon'),(N'UretimEmirleri'),
(N'FasonIsler'),(N'FasonHareketleri'),(N'Irsaliyeler'),(N'IrsaliyeDetay'),(N'PlatformSiparisler');

DECLARE @TableName SYSNAME, @sql NVARCHAR(MAX), @policyName SYSNAME, @defaultName SYSNAME;
IF OBJECT_ID(N'dbo.fn_CompanyIsolationPredicate',N'IF') IS NULL
    THROW 52001,N'fn_CompanyIsolationPredicate bulunamadı. Önce 003 migration çalıştırılmalı.',1;

DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT TableName FROM @Tables ORDER BY TableName;
OPEN c; FETCH NEXT FROM c INTO @TableName;
WHILE @@FETCH_STATUS=0
BEGIN
    IF OBJECT_ID(N'dbo.'+@TableName,N'U') IS NOT NULL AND COL_LENGTH(N'dbo.'+@TableName,N'CompanyId') IS NOT NULL
    BEGIN
        SET @defaultName=N'DF_'+@TableName+N'_CompanyContext';
        IF NOT EXISTS(SELECT 1 FROM sys.default_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.'+@TableName) AND name=@defaultName)
        BEGIN
            SET @sql=N'ALTER TABLE dbo.'+QUOTENAME(@TableName)+N' ADD CONSTRAINT '+QUOTENAME(@defaultName)+N' DEFAULT (ISNULL(TRY_CONVERT(INT,SESSION_CONTEXT(N''CompanyId'')),1)) FOR CompanyId;';
            EXEC sys.sp_executesql @sql;
        END;

        IF NOT EXISTS(SELECT 1 FROM sys.security_predicates WHERE target_object_id=OBJECT_ID(N'dbo.'+@TableName) AND predicate_type=0)
        BEGIN
            SET @policyName=N'RLS_AlyaCompany_Hardening_'+@TableName;
            IF NOT EXISTS(SELECT 1 FROM sys.security_policies WHERE name=@policyName)
            BEGIN
                SET @sql=N'CREATE SECURITY POLICY dbo.'+QUOTENAME(@policyName)+N'
                    ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.'+QUOTENAME(@TableName)+N',
                    ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.'+QUOTENAME(@TableName)+N' AFTER INSERT,
                    ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId) ON dbo.'+QUOTENAME(@TableName)+N' AFTER UPDATE WITH (STATE=ON);';
                EXEC sys.sp_executesql @sql;
            END;
        END;
    END;
    FETCH NEXT FROM c INTO @TableName;
END;
CLOSE c; DEALLOCATE c;

SELECT OBJECT_NAME(p.target_object_id) AS TableName,p.predicate_type_desc AS PredicateType,p.operation_desc AS Operation
FROM sys.security_predicates p
INNER JOIN sys.security_policies sp ON sp.object_id=p.object_id
WHERE sp.is_enabled=1 AND OBJECT_NAME(p.target_object_id) IN (SELECT TableName FROM @Tables)
ORDER BY TableName,PredicateType,Operation;
