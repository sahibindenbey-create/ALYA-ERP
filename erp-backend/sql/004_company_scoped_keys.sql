/* ALYA ERP - Şirket bazlı kodlar */

IF OBJECT_ID('dbo.CariListesi','U') IS NOT NULL
   AND COL_LENGTH('dbo.CariListesi','CompanyId') IS NOT NULL
   AND COL_LENGTH('dbo.CariListesi','CariKodu') IS NOT NULL
BEGIN
    DECLARE @IndexName SYSNAME;
    DECLARE @DropSql NVARCHAR(MAX);

    SELECT TOP 1 @IndexName = i.name
    FROM sys.indexes i
    INNER JOIN sys.index_columns ic
        ON ic.object_id = i.object_id
       AND ic.index_id = i.index_id
    INNER JOIN sys.columns c
        ON c.object_id = ic.object_id
       AND c.column_id = ic.column_id
    WHERE i.object_id = OBJECT_ID('dbo.CariListesi')
      AND i.is_unique = 1
      AND i.is_primary_key = 0
      AND i.is_unique_constraint = 0
      AND c.name = 'CariKodu'
      AND (
          SELECT COUNT(*)
          FROM sys.index_columns ic2
          WHERE ic2.object_id = i.object_id
            AND ic2.index_id = i.index_id
      ) = 1;

    IF @IndexName IS NOT NULL
    BEGIN
        SET @DropSql = N'DROP INDEX ' + QUOTENAME(@IndexName) + N' ON dbo.CariListesi;';
        EXEC sp_executesql @DropSql;
    END;

    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.CariListesi')
          AND name = 'UQ_CariListesi_Company_CariKodu'
    )
    BEGIN
        CREATE UNIQUE INDEX UQ_CariListesi_Company_CariKodu
        ON dbo.CariListesi(CompanyId, CariKodu);
    END;
END;
