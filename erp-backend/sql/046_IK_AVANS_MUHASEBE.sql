/* ============================================================================
   ALYA ERP - 046 / IK AVANSI MUHASEBE ENTEGRASYONU
   ============================================================================
   AMAC: IkAvanslar (personel avansi) su ana kadar MuhasebeFisleri, KasaBanka
   veya CariDefterHareketleri ile HIC baglanti kurmuyordu - personele nakit
   avans verildiginde bu, sirketin kasa/banka hareketlerinde veya
   muhasebesinde hic gorunmuyordu (bkz. ALYA-ERP-VERI-AKISI-HARITASI.md,
   bulgu #3). Bu migration, kod tarafinda (hrFlowRoutes.js) eklenecek
   otomatik muhasebe fisi kesme islemi icin gereken alt yapiyi kuruyor.

   Idempotent - defalarca calistirilabilir.
   ============================================================================ */
SET NOCOUNT ON;

-- 1) Hesap plani: 195 - Personel Avanslari (standart Tekduzen Hesap Plani kodu)
INSERT dbo.MuhasebeHesaplari(CompanyId,HesapKodu,HesapAdi,HesapTipi)
SELECT s.CompanyId, N'195', N'Personel Avansları', N'Varlık'
FROM dbo.Sirketler s
WHERE NOT EXISTS (SELECT 1 FROM dbo.MuhasebeHesaplari h WHERE h.CompanyId=s.CompanyId AND h.HesapKodu=N'195');
GO

-- 2) Belge numara serisi: IK_AVANS
INSERT dbo.NumberSeries(CompanyId,DocumentType,Prefix,Padding)
SELECT s.CompanyId, N'IK_AVANS', N'AVN-', 6
FROM dbo.Sirketler s
WHERE NOT EXISTS (SELECT 1 FROM dbo.NumberSeries n WHERE n.CompanyId=s.CompanyId AND n.DocumentType=N'IK_AVANS');
GO

-- 3) IkAvanslar tablosuna muhasebe izleme kolonları (Tahsilatlar'daki
--    OdemeKanali/HesapKodu deseniyle tutarlı)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.IkAvanslar') AND name=N'MuhasebeFisId')
    ALTER TABLE dbo.IkAvanslar ADD MuhasebeFisId INT NULL;
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

PRINT N'046: İK avansı muhasebe entegrasyonu alt yapısı hazır.';
