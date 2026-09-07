/*
  ALYA ERP - Şirket izolasyonu
  Ön koşul: 001_multi_company_kolaybi.sql çalıştırılmış olmalı.

  Backend, her HTTP isteğinde SESSION_CONTEXT('CompanyId') ayarlar.
  Bu migration CompanyId taşıyan çekirdek tablolarda Row-Level Security uygular.
*/

IF OBJECT_ID('dbo.fn_AlyaCompanyPredicate', 'IF') IS NULL
BEGIN
  EXEC(N'
    CREATE FUNCTION dbo.fn_AlyaCompanyPredicate(@CompanyId INT)
    RETURNS TABLE
    WITH SCHEMABINDING
    AS
    RETURN SELECT 1 AS Allowed
    WHERE @CompanyId = ISNULL(TRY_CONVERT(INT, SESSION_CONTEXT(N''CompanyId'')), 1);
  ');
END;
GO

DECLARE @TableName SYSNAME, @sql NVARCHAR(MAX), @policyName SYSNAME, @defaultName SYSNAME;
DECLARE @Tables TABLE (TableName SYSNAME PRIMARY KEY);
INSERT INTO @Tables(TableName) VALUES
  ('CariListesi'), ('CariHareketleri'), ('CariEvrak'),
  ('Siparisler'), ('SiparisDetay'),
  ('Urunler'), ('UrunDosya'),
  ('Numuneler'),
  ('Teklifler'), ('TeklifKalemleri'),
  ('Faturalar'), ('FaturaDetay'),
  ('KasaBanka'), ('KasaBankaHareketleri'),
  ('Personel'),
  ('Receteler'), ('ReceteKalemleri'),
  ('FasonIsler'), ('FasonHareketleri'),
  ('Irsaliyeler'), ('IrsaliyeDetay');

DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT TableName FROM @Tables;
OPEN c;
FETCH NEXT FROM c INTO @TableName;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF OBJECT_ID('dbo.' + @TableName, 'U') IS NOT NULL
     AND COL_LENGTH('dbo.' + @TableName, 'CompanyId') IS NOT NULL
  BEGIN
    /* Yeni INSERT'lerde CompanyId request context'ten gelsin. */
    SET @defaultName = 'DF_' + @TableName + '_CompanyContext';
    IF NOT EXISTS (
      SELECT 1 FROM sys.default_constraints dc
      WHERE dc.parent_object_id = OBJECT_ID('dbo.' + @TableName)
        AND dc.name = @defaultName
    )
    BEGIN
      SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@TableName) +
                 N' ADD CONSTRAINT ' + QUOTENAME(@defaultName) +
                 N' DEFAULT (ISNULL(TRY_CONVERT(INT, SESSION_CONTEXT(N''CompanyId'')), 1)) FOR CompanyId;';
      EXEC sp_executesql @sql;
    END;

    SET @policyName = 'RLS_AlyaCompany_' + @TableName;
    IF NOT EXISTS (SELECT 1 FROM sys.security_policies WHERE name=@policyName)
    BEGIN
      SET @sql = N'CREATE SECURITY POLICY dbo.' + QUOTENAME(@policyName) +
                 N' ADD FILTER PREDICATE dbo.fn_AlyaCompanyPredicate(CompanyId) ON dbo.' + QUOTENAME(@TableName) +
                 N', ADD BLOCK PREDICATE dbo.fn_AlyaCompanyPredicate(CompanyId) ON dbo.' + QUOTENAME(@TableName) + N' AFTER INSERT, AFTER UPDATE WITH (STATE = ON);';
      EXEC sp_executesql @sql;
    END;
  END;
  FETCH NEXT FROM c INTO @TableName;
END;
CLOSE c;
DEALLOCATE c;
GO
