/* ALYA ERP - Firma bazlı çalışma profilleri
   Ortak ERP altyapısını bozmadan şirketlerin ekran ve iş kurallarını
   tanımlamak için kullanılır.

   Bu migration mevcut şirket kayıtlarını silmez/değiştirmez;
   yalnızca eksik profil alanlarını ekler ve mevcut 3 şirket için
   başlangıç profillerini oluşturur.
*/

IF OBJECT_ID(N'dbo.Sirketler', N'U') IS NULL
    THROW 54201, N'dbo.Sirketler bulunamadı. Önce çoklu şirket altyapısını çalıştırın.', 1;

IF COL_LENGTH(N'dbo.Sirketler', N'FirmaTipi') IS NULL
    ALTER TABLE dbo.Sirketler ADD FirmaTipi NVARCHAR(50) NULL;

IF COL_LENGTH(N'dbo.Sirketler', N'SiparisSablonu') IS NULL
    ALTER TABLE dbo.Sirketler ADD SiparisSablonu NVARCHAR(50) NULL;

IF COL_LENGTH(N'dbo.Sirketler', N'StokTakipTipi') IS NULL
    ALTER TABLE dbo.Sirketler ADD StokTakipTipi NVARCHAR(50) NULL;

IF COL_LENGTH(N'dbo.Sirketler', N'VarsayilanBirim') IS NULL
    ALTER TABLE dbo.Sirketler ADD VarsayilanBirim NVARCHAR(30) NULL;

IF COL_LENGTH(N'dbo.Sirketler', N'ProfilAktif') IS NULL
    ALTER TABLE dbo.Sirketler ADD ProfilAktif BIT NOT NULL CONSTRAINT DF_Sirketler_ProfilAktif DEFAULT 1;

/*
   Profil anlamları:
   TICARI_URUN       : ALYA tipi standart ticari ürün/satış operasyonu
   INSAAT            : proje/sevkiyat ağırlıklı inşaat operasyonu
   DIS_TICARET       : ticaret ve ileride genişletilecek özel akışlar

   SiparisSablonu:
   STANDART_TICARI
   INSAAT_SEVKIYAT
   STANDART_TICARI

   StokTakipTipi:
   KG_ADET_KOLI
   PALET_RULO_LOT
   KG_ADET_KOLI
*/

UPDATE dbo.Sirketler
SET
    FirmaTipi = COALESCE(NULLIF(FirmaTipi, N''), N'TICARI_URUN'),
    SiparisSablonu = COALESCE(NULLIF(SiparisSablonu, N''), N'STANDART_TICARI'),
    StokTakipTipi = COALESCE(NULLIF(StokTakipTipi, N''), N'KG_ADET_KOLI'),
    VarsayilanBirim = COALESCE(NULLIF(VarsayilanBirim, N''), N'ADET'),
    ProfilAktif = 1
WHERE CompanyId = 1;

UPDATE dbo.Sirketler
SET
    FirmaTipi = COALESCE(NULLIF(FirmaTipi, N''), N'INSAAT'),
    SiparisSablonu = COALESCE(NULLIF(SiparisSablonu, N''), N'INSAAT_SEVKIYAT'),
    StokTakipTipi = COALESCE(NULLIF(StokTakipTipi, N''), N'PALET_RULO_LOT'),
    VarsayilanBirim = COALESCE(NULLIF(VarsayilanBirim, N''), N'KG'),
    ProfilAktif = 1
WHERE CompanyId = 2;

UPDATE dbo.Sirketler
SET
    FirmaTipi = COALESCE(NULLIF(FirmaTipi, N''), N'DIS_TICARET'),
    SiparisSablonu = COALESCE(NULLIF(SiparisSablonu, N''), N'STANDART_TICARI'),
    StokTakipTipi = COALESCE(NULLIF(StokTakipTipi, N''), N'KG_ADET_KOLI'),
    VarsayilanBirim = COALESCE(NULLIF(VarsayilanBirim, N''), N'ADET'),
    ProfilAktif = 1
WHERE CompanyId = 3;

/* Profil değerlerinin geçerli olmasını sağlamak için kontrollü indexler. */
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_Sirketler_Profil'
      AND object_id = OBJECT_ID(N'dbo.Sirketler')
)
BEGIN
    CREATE INDEX IX_Sirketler_Profil
        ON dbo.Sirketler(CompanyId, FirmaTipi, SiparisSablonu, StokTakipTipi)
        INCLUDE (CompanyName, VarsayilanBirim, ProfilAktif);
END;

/* Hızlı kontrol: her şirketin profili görünür olmalı. */
SELECT
    CompanyId,
    CompanyName,
    FirmaTipi,
    SiparisSablonu,
    StokTakipTipi,
    VarsayilanBirim,
    ProfilAktif
FROM dbo.Sirketler
ORDER BY CompanyId;
