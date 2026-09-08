/* =========================================================
   007 - ÜRETİM / ŞİRKET İZOLASYONU
   UretimEmirleri eski şemada CompanyId taşımıyorsa ekler.
   ========================================================= */

IF OBJECT_ID(N'dbo.UretimEmirleri', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'dbo.UretimEmirleri', N'CompanyId') IS NULL
    BEGIN
        ALTER TABLE dbo.UretimEmirleri ADD CompanyId INT NULL;

        UPDATE ue
        SET CompanyId = ISNULL(r.CompanyId, 1)
        FROM dbo.UretimEmirleri ue
        LEFT JOIN dbo.Receteler r ON r.ReceteId = ue.ReceteId
        WHERE ue.CompanyId IS NULL;

        ALTER TABLE dbo.UretimEmirleri
            ADD CONSTRAINT DF_UretimEmirleri_CompanyId DEFAULT (1) FOR CompanyId;
    END;

    UPDATE ue
    SET CompanyId = ISNULL(r.CompanyId, ue.CompanyId)
    FROM dbo.UretimEmirleri ue
    INNER JOIN dbo.Receteler r ON r.ReceteId = ue.ReceteId
    WHERE ue.CompanyId IS NULL;

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.UretimEmirleri')
          AND name = N'IX_UretimEmirleri_CompanyId'
    )
    BEGIN
        CREATE INDEX IX_UretimEmirleri_CompanyId
            ON dbo.UretimEmirleri(CompanyId, UretimId DESC);
    END;
END;
GO

/* CompanyId artık zorunlu hale getirilebilir; mevcut eski kayıtlar doldurulduktan sonra. */
IF OBJECT_ID(N'dbo.UretimEmirleri', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.UretimEmirleri', N'CompanyId') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM sys.default_constraints
       WHERE parent_object_id = OBJECT_ID(N'dbo.UretimEmirleri')
         AND name = N'DF_UretimEmirleri_CompanyId'
   )
BEGIN
    ALTER TABLE dbo.UretimEmirleri
      ADD CONSTRAINT DF_UretimEmirleri_CompanyId DEFAULT (1) FOR CompanyId;
END;
GO
