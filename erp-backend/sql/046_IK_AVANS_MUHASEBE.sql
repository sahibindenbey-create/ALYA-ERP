/* ============================================================================
   ALYA ERP - 046 / IK AVANSI MUHASEBE ENTEGRASYONU (v2 - DUZELTILMIS)
   ============================================================================
   v1'den FARKLARI:
   - MuhasebeHesaplari ve NumberSeries'e TUM sirketler icin tek seferde
     coklu-sirket INSERT...SELECT yapan adimlar, SecurityPolicy_CompanyIsolation
     aktif oldugu icin (SSMS oturumunda SESSION_CONTEXT('CompanyId') hic
     ayarlanmadigindan) block predicate tarafindan reddediliyordu. Bu iki
     adim artik RLS'i GECICI OLARAK kapatip (yalnizca bu iki INSERT icin),
     hemen ardindan TRY/CATCH ile garanti sekilde tekrar acacak sekilde
     yeniden yazildi (041'in kendi ic mantigiyla ayni desen).
   - IkAvanslar.MuhasebeFisId INT degil BIGINT olmali - MuhasebeFisleri.FisId
     BIGINT IDENTITY (bkz. sql/015_FINANCE_ACCOUNTING_CHAIN.sql). Tip
     uyusmazligi FK olusturmayi engelliyordu.

   Idempotent - defalarca calistirilabilir. v1'i calistirdiysaniz (hesap
   plani/numara serisi eklenemeden hata verdiyse) bu script kaldigi yerden
   guvenle devam eder.
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @PolicyWasOn BIT = 0;
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = N'SecurityPolicy_CompanyIsolation' AND is_enabled = 1)
    SET @PolicyWasOn = 1;

BEGIN TRY
    -- 1) RLS'i sadece coklu-sirket seed islemi icin gecici kapat
    IF @PolicyWasOn = 1
        ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation WITH (STATE = OFF);

    -- 2) Hesap plani: 195 - Personel Avanslari (standart Tekduzen Hesap Plani kodu)
    INSERT dbo.MuhasebeHesaplari(CompanyId,HesapKodu,HesapAdi,HesapTipi)
    SELECT s.CompanyId, N'195', N'Personel Avansları', N'Varlık'
    FROM dbo.Sirketler s
    WHERE NOT EXISTS (SELECT 1 FROM dbo.MuhasebeHesaplari h WHERE h.CompanyId=s.CompanyId AND h.HesapKodu=N'195');

    -- 3) Belge numara serisi: IK_AVANS
    INSERT dbo.NumberSeries(CompanyId,DocumentType,Prefix,Padding)
    SELECT s.CompanyId, N'IK_AVANS', N'AVN-', 6
    FROM dbo.Sirketler s
    WHERE NOT EXISTS (SELECT 1 FROM dbo.NumberSeries n WHERE n.CompanyId=s.CompanyId AND n.DocumentType=N'IK_AVANS');

    -- 4) RLS'i hemen geri ac
    IF @PolicyWasOn = 1
        ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation WITH (STATE = ON);
END TRY
BEGIN CATCH
    -- Herhangi bir hata olursa RLS'i MUTLAKA tekrar acik birak, sonra hatayi yeniden firlat
    IF @PolicyWasOn = 1 AND EXISTS (SELECT 1 FROM sys.security_policies WHERE name = N'SecurityPolicy_CompanyIsolation' AND is_enabled = 0)
        ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation WITH (STATE = ON);
    THROW;
END CATCH
GO

-- 5) IkAvanslar tablosuna muhasebe izleme kolonları
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.IkAvanslar') AND name=N'MuhasebeFisId')
    ALTER TABLE dbo.IkAvanslar ADD MuhasebeFisId BIGINT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.IkAvanslar') AND name=N'OdemeKanali')
    ALTER TABLE dbo.IkAvanslar ADD OdemeKanali NVARCHAR(30) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.IkAvanslar') AND name=N'AvansNo')
    ALTER TABLE dbo.IkAvanslar ADD AvansNo NVARCHAR(80) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_IkAvanslar_MuhasebeFisleri')
    ALTER TABLE dbo.IkAvanslar ADD CONSTRAINT FK_IkAvanslar_MuhasebeFisleri FOREIGN KEY (MuhasebeFisId) REFERENCES dbo.MuhasebeFisleri(FisId);
GO

-- Eğer v1'den kalma yanlış tipli bir MuhasebeFisId (INT) sütunu varsa
-- (v1'i kısmen çalıştırdıysanız), burada tipi düzeltin - normalde bu
-- migration ilk kez çalışıyorsa bu blok hiç devreye girmez:
IF EXISTS (
    SELECT 1 FROM sys.columns c
    WHERE c.object_id=OBJECT_ID(N'dbo.IkAvanslar') AND c.name=N'MuhasebeFisId'
      AND TYPE_NAME(c.user_type_id) <> N'bigint'
)
BEGIN
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_IkAvanslar_MuhasebeFisleri')
        ALTER TABLE dbo.IkAvanslar DROP CONSTRAINT FK_IkAvanslar_MuhasebeFisleri;
    ALTER TABLE dbo.IkAvanslar ALTER COLUMN MuhasebeFisId BIGINT NULL;
    ALTER TABLE dbo.IkAvanslar ADD CONSTRAINT FK_IkAvanslar_MuhasebeFisleri FOREIGN KEY (MuhasebeFisId) REFERENCES dbo.MuhasebeFisleri(FisId);
    PRINT N'MuhasebeFisId tipi BIGINT olarak düzeltildi.';
END;
GO

PRINT N'046: İK avansı muhasebe entegrasyonu alt yapısı hazır (v2).';
