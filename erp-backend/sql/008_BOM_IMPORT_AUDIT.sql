/*
  ALYA ERP - 008 / BOM IMPORT AUDIT

  Amaç:
    006 BOM staging verisinin gerçek reçeteye aktarılmadan önce eksiksizliğini
    kontrol etmek.

  ÖNEMLİ:
    - Bu script veri değiştirmez.
    - Eksik BOM satırlarını uydurmaz.
    - CompanyId SESSION_CONTEXT('CompanyId') üzerinden çalışır.
    - Beklenen 21 mamul kodunun tamamını raporlar.
    - Bir mamul staging'de yoksa veya satır sayısı 0 ise EKSİK olarak işaretler.
    - REVIEW satırlarını ayrıca gösterir.
    - Hammadde eşleşmelerini benzersiz ürün kodu/adı üzerinden raporlar.
*/

SET NOCOUNT ON;

DECLARE @CompanyId INT = TRY_CONVERT(INT, SESSION_CONTEXT(N'CompanyId'));
IF @CompanyId IS NULL OR @CompanyId <= 0
    THROW 51001, 'CompanyId context bulunamadı.', 1;

IF OBJECT_ID(N'dbo.BomImportStaging', N'U') IS NULL
    THROW 51002, 'dbo.BomImportStaging bulunamadı. Önce 006_BOM_IMPORT çalıştırılmalı.', 1;

DECLARE @Expected TABLE
(
    MamulKodu NVARCHAR(100) NOT NULL PRIMARY KEY,
    MamulAdi NVARCHAR(250) NOT NULL,
    Grup NVARCHAR(20) NOT NULL
);

INSERT INTO @Expected(MamulKodu,MamulAdi,Grup) VALUES
(N'AHBRD1301',N'PROBOARD',N'BRD'),
(N'AHBRD1501',N'PROBOARD HYBRID',N'BRD'),
(N'AHBRD1601',N'PROBOARD STEEL',N'BRD'),
(N'AHDRY1401',N'WINGS CLOTHES DRYING RACK MATT',N'MATT'),
(N'AHDRY1402',N'BUTTERFLY CLOTHES DRYING RACK MATT',N'MATT'),
(N'AHDRY1403',N'BASIC DRYING RACK MATT',N'MATT'),
(N'AHDRY1404',N'SMALL BALCONY DRYING RACK MATT',N'MATT'),
(N'AHDRY1405',N'MEDIUM BALCONY DRYING RACK MATT',N'MATT'),
(N'AHDRY1406',N'LARGE BALCONY DRYING RACK MATT',N'MATT'),
(N'AHDRY1407',N'DOUBLE FLY DRYING RACK MATT',N'MATT'),
(N'AHDRY1408',N'BASIC BUTTERFLY DRYING RACK MATT',N'MATT'),
(N'AHDRY1409',N'SIDE WING DRYING RACK MATT',N'MATT'),
(N'AHDRY1451',N'WING DRYING RACK RAW',N'RAW'),
(N'AHDRY1452',N'BUTTERFLY DRYING RACK RAW',N'RAW'),
(N'AHDRY1453',N'BASIC DRYING RACK RAW',N'RAW'),
(N'AHDRY1454',N'SMALL BALCONY DRYING RACK RAW',N'RAW'),
(N'AHDRY1455',N'MEDIUM BALCONY DRYING RACK RAW',N'RAW'),
(N'AHDRY1456',N'LARGE BALCONY DRYING RACK RAW',N'RAW'),
(N'AHDRY1457',N'DOUBLE FLY DRYING RACK RAW',N'RAW'),
(N'AHDRY1458',N'BASIC BUTTERFLY DRYING RACK RAW',N'RAW'),
(N'AHDRY1459',N'SIDE WING DRYING RACK RAW',N'RAW');

/* =========================================================
   1) MAMUL BAZINDA BOM DURUMU
   ========================================================= */
SELECT
    e.MamulKodu,
    e.MamulAdi,
    e.Grup,
    COUNT(s.ImportId) AS StagingSatirSayisi,
    SUM(CASE WHEN s.Durum = N'REVIEW' OR s.HammaddeAdi LIKE N'%?%' THEN 1 ELSE 0 END) AS ReviewSatirSayisi,
    CASE
        WHEN COUNT(s.ImportId) = 0 THEN N'EKSİK BOM'
        WHEN SUM(CASE WHEN s.Durum = N'REVIEW' OR s.HammaddeAdi LIKE N'%?%' THEN 1 ELSE 0 END) > 0 THEN N'REVIEW GEREKLİ'
        ELSE N'STAGING VAR'
    END AS Durum
FROM @Expected e
LEFT JOIN dbo.BomImportStaging s
  ON s.CompanyId = @CompanyId
 AND UPPER(LTRIM(RTRIM(s.MamulKodu))) = UPPER(LTRIM(RTRIM(e.MamulKodu)))
GROUP BY e.MamulKodu,e.MamulAdi,e.Grup
ORDER BY e.MamulKodu;

/* =========================================================
   2) STAGING'DEKİ AMA BEKLENEN LİSTEDE OLMAYAN MAMULLER
   ========================================================= */
SELECT DISTINCT
    s.MamulKodu,
    s.MamulAdi,
    N'BEKLENMEYEN MAMUL KODU' AS Durum
FROM dbo.BomImportStaging s
WHERE s.CompanyId = @CompanyId
  AND NOT EXISTS
  (
      SELECT 1
      FROM @Expected e
      WHERE UPPER(LTRIM(RTRIM(e.MamulKodu))) = UPPER(LTRIM(RTRIM(s.MamulKodu)))
  )
ORDER BY s.MamulKodu;

/* =========================================================
   3) REVIEW SATIRLARI
   ========================================================= */
SELECT
    s.ImportId,
    s.MamulKodu,
    s.MamulAdi,
    s.HammaddeAdi,
    s.Miktar,
    s.Birim,
    s.Durum,
    s.Notlar
FROM dbo.BomImportStaging s
WHERE s.CompanyId = @CompanyId
  AND (s.Durum = N'REVIEW' OR s.HammaddeAdi LIKE N'%?%')
ORDER BY s.MamulKodu,s.ImportId;

/* =========================================================
   4) HAMMADDE EŞLEŞME DURUMU
      Kod veya ad üzerinden tam bir ürün eşleşmesi yoksa/çoksa REVIEW.
   ========================================================= */
SELECT
    s.MamulKodu,
    s.ImportId,
    s.HammaddeAdi,
    s.Miktar,
    s.Birim,
    COUNT(DISTINCT u.UrunId) AS EslesmeSayisi,
    CASE
        WHEN s.HammaddeAdi LIKE N'ALT REÇETE:%' THEN N'ALT REÇETE'
        WHEN s.HammaddeAdi LIKE N'%?%' OR s.Durum = N'REVIEW' THEN N'REVIEW'
        WHEN COUNT(DISTINCT u.UrunId) = 1 THEN N'HAZIR'
        WHEN COUNT(DISTINCT u.UrunId) = 0 THEN N'ÜRÜN BULUNAMADI'
        ELSE N'ÇOKLU EŞLEŞME'
    END AS EslesmeDurumu
FROM dbo.BomImportStaging s
LEFT JOIN dbo.Urunler u
  ON u.CompanyId = @CompanyId
 AND
 (
      UPPER(LTRIM(RTRIM(u.UrunKodu))) = UPPER(LTRIM(RTRIM(s.HammaddeAdi)))
      OR UPPER(LTRIM(RTRIM(u.UrunAdi))) = UPPER(LTRIM(RTRIM(s.HammaddeAdi)))
 )
WHERE s.CompanyId = @CompanyId
GROUP BY s.MamulKodu,s.ImportId,s.HammaddeAdi,s.Miktar,s.Birim,s.Durum
ORDER BY s.MamulKodu,s.ImportId;

/* =========================================================
   5) ÖZET: GERÇEK REÇETE IMPORTUNA HAZIRLIK
   ========================================================= */
;WITH Durum AS
(
    SELECT
        e.MamulKodu,
        COUNT(s.ImportId) AS SatirSayisi,
        SUM(CASE WHEN s.Durum = N'REVIEW' OR s.HammaddeAdi LIKE N'%?%' THEN 1 ELSE 0 END) AS ReviewSayisi
    FROM @Expected e
    LEFT JOIN dbo.BomImportStaging s
      ON s.CompanyId = @CompanyId
     AND s.MamulKodu = e.MamulKodu
    GROUP BY e.MamulKodu
)
SELECT
    COUNT(*) AS BeklenenMamulSayisi,
    SUM(CASE WHEN SatirSayisi > 0 THEN 1 ELSE 0 END) AS StagingiOlanMamulSayisi,
    SUM(CASE WHEN SatirSayisi = 0 THEN 1 ELSE 0 END) AS EksikMamulSayisi,
    SUM(CASE WHEN ReviewSayisi > 0 THEN 1 ELSE 0 END) AS ReviewGerekenMamulSayisi,
    CASE
        WHEN SUM(CASE WHEN SatirSayisi = 0 THEN 1 ELSE 0 END) > 0 THEN N'IMPORTA HAZIR DEĞİL - EKSİK BOM VAR'
        WHEN SUM(CASE WHEN ReviewSayisi > 0 THEN 1 ELSE 0 END) > 0 THEN N'IMPORTA HAZIR DEĞİL - REVIEW VAR'
        ELSE N'IMPORTA HAZIRLIK TAMAM'
    END AS GenelDurum
FROM Durum;
