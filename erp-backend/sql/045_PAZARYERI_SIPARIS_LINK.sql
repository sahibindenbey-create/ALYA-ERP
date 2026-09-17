/* ============================================================================
   ALYA ERP - 045 / PAZARYERI SIPARISLERINI SATIS SIPARISINE BAGLA
   ============================================================================
   AMAC: PazaryeriSiparisleriV2 (yeni, cok-kanalli pazaryeri sistemi) su ana
   kadar Siparisler/StokBakiyeleri ile HIC baglanti kurmuyordu - pazaryeri
   satislari stogu hic dusurmuyordu (bkz. ALYA-ERP-VERI-AKISI-HARITASI.md,
   bulgu #1). Bu migration, marketplaceFlowRoutes.js'in artik yazacagi
   SiparisId iliskisini tutacak kolonu ekliyor.

   Idempotent - defalarca calistirilabilir.
   ============================================================================ */
SET NOCOUNT ON;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.PazaryeriSiparisleriV2') AND name = N'SiparisId'
)
BEGIN
    ALTER TABLE dbo.PazaryeriSiparisleriV2 ADD SiparisId INT NULL;
    PRINT N'PazaryeriSiparisleriV2.SiparisId eklendi.';
END
ELSE
    PRINT N'PazaryeriSiparisleriV2.SiparisId zaten mevcut.';
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_PazaryeriSiparisleriV2_Siparis'
)
BEGIN
    ALTER TABLE dbo.PazaryeriSiparisleriV2
        ADD CONSTRAINT FK_PazaryeriSiparisleriV2_Siparis
        FOREIGN KEY (SiparisId) REFERENCES dbo.Siparisler(SiparisId);
    PRINT N'FK_PazaryeriSiparisleriV2_Siparis eklendi.';
END
ELSE
    PRINT N'FK_PazaryeriSiparisleriV2_Siparis zaten mevcut.';
GO

-- Hangi siparişlerin hâlâ Satış Siparişi'ne dönüştürülmediğini görmek için
-- hızlı bir kontrol sorgusu (elle çalıştırıp inceleyebilirsiniz):
-- SELECT * FROM dbo.PazaryeriSiparisleriV2 WHERE SiparisId IS NULL AND ErpDurumu = N'Hazır';
