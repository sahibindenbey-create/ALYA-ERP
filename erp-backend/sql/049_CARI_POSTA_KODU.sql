/* ============================================================================
   ALYA ERP - 049 / CARI ADRESLERINE POSTA KODU EKLENIYOR
   ============================================================================
   AMAC: Cari kart adres bilgilerinde (fatura ve sevkiyat) posta kodu
   tutulmuyordu. Diger adres alanlariyla ayni isimlendirme desenini
   izleyerek (FaturaIl/SevkiyatIl gibi) iki yeni kolon ekleniyor.

   Idempotent - defalarca calistirilabilir.
   ============================================================================ */
SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.CariListesi') AND name=N'FaturaPostaKodu')
BEGIN
    ALTER TABLE dbo.CariListesi ADD FaturaPostaKodu NVARCHAR(10) NULL;
    PRINT N'FaturaPostaKodu eklendi.';
END
ELSE
    PRINT N'FaturaPostaKodu zaten mevcut.';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.CariListesi') AND name=N'SevkiyatPostaKodu')
BEGIN
    ALTER TABLE dbo.CariListesi ADD SevkiyatPostaKodu NVARCHAR(10) NULL;
    PRINT N'SevkiyatPostaKodu eklendi.';
END
ELSE
    PRINT N'SevkiyatPostaKodu zaten mevcut.';

PRINT N'049 tamamlandı.';
