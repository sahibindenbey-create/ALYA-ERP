/* 036 - Belge bağlantılarında aynı ilişki yeniden geldiğinde işlemi durdurma. Veri silmez. */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.BelgeBaglantilari',N'U') IS NULL
    THROW 53601,N'dbo.BelgeBaglantilari bulunamadı. Önce 014 migrationını çalıştırın.',1;

BEGIN TRY
    BEGIN TRAN;

    IF EXISTS
    (
        SELECT 1
        FROM sys.key_constraints
        WHERE parent_object_id=OBJECT_ID(N'dbo.BelgeBaglantilari')
          AND name=N'UQ_BelgeBaglantilari'
    )
    BEGIN
        IF EXISTS
        (
            SELECT 1
            FROM sys.key_constraints kc
            INNER JOIN sys.indexes i
                ON i.object_id=kc.parent_object_id
               AND i.index_id=kc.unique_index_id
            WHERE kc.parent_object_id=OBJECT_ID(N'dbo.BelgeBaglantilari')
              AND kc.name=N'UQ_BelgeBaglantilari'
              AND i.ignore_dup_key=0
        )
        BEGIN
            ALTER TABLE dbo.BelgeBaglantilari
                DROP CONSTRAINT UQ_BelgeBaglantilari;

            ALTER TABLE dbo.BelgeBaglantilari
                ADD CONSTRAINT UQ_BelgeBaglantilari
                UNIQUE NONCLUSTERED
                (CompanyId,KaynakTip,KaynakId,HedefTip,HedefId)
                WITH (IGNORE_DUP_KEY=ON);
        END;
    END
    ELSE IF EXISTS
    (
        SELECT 1
        FROM sys.indexes
        WHERE object_id=OBJECT_ID(N'dbo.BelgeBaglantilari')
          AND name=N'UQ_BelgeBaglantilari'
    )
    BEGIN
        DROP INDEX UQ_BelgeBaglantilari ON dbo.BelgeBaglantilari;

        CREATE UNIQUE NONCLUSTERED INDEX UQ_BelgeBaglantilari
            ON dbo.BelgeBaglantilari
            (CompanyId,KaynakTip,KaynakId,HedefTip,HedefId)
            WITH (IGNORE_DUP_KEY=ON);
    END
    ELSE
    BEGIN
        ALTER TABLE dbo.BelgeBaglantilari
            ADD CONSTRAINT UQ_BelgeBaglantilari
            UNIQUE NONCLUSTERED
            (CompanyId,KaynakTip,KaynakId,HedefTip,HedefId)
            WITH (IGNORE_DUP_KEY=ON);
    END;

    COMMIT;
END TRY
BEGIN CATCH
    IF XACT_STATE()<>0 ROLLBACK;
    THROW;
END CATCH;

SELECT
    i.name AS IndexName,
    i.is_unique AS IsUnique,
    i.ignore_dup_key AS IgnoreDuplicateKey
FROM sys.indexes i
WHERE i.object_id=OBJECT_ID(N'dbo.BelgeBaglantilari')
  AND i.name=N'UQ_BelgeBaglantilari';

PRINT N'036 KolayBi belge bağlantısı tekrar koruması tamamlandı.';
GO
