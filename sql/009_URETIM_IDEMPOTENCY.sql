/* =========================================================
   009 - ÜRETİM İŞLEM GÜVENLİĞİ
   Amaç: Aynı üretim isteğinin çift tıklama / retry nedeniyle
         ikinci kez stok hareketi oluşturmasını engellemek.
   ========================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.UretimEmirleri', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'dbo.UretimEmirleri', N'IslemAnahtari') IS NULL
    BEGIN
        ALTER TABLE dbo.UretimEmirleri
            ADD IslemAnahtari NVARCHAR(100) NULL;
    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.UretimEmirleri')
          AND name = N'UX_UretimEmirleri_Company_IslemAnahtari'
    )
    BEGIN
        CREATE UNIQUE INDEX UX_UretimEmirleri_Company_IslemAnahtari
            ON dbo.UretimEmirleri(CompanyId, IslemAnahtari)
            WHERE IslemAnahtari IS NOT NULL;
    END;
END;
GO

PRINT N'009_URETIM_IDEMPOTENCY tamamlandi.';
GO
