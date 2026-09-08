/*
  ALYA ERP - 007 / BOM STAGING -> GERCEK RECETE IMPORT

  Amaç:
    006_BOM_IMPORT staging kayıtlarını gerçek dbo.Receteler + dbo.ReceteDetay
    kayıtlarına güvenli şekilde aktarmak.

  Güvenlik kuralları:
    - CompanyId yalnızca SESSION_CONTEXT('CompanyId') üzerinden alınır.
    - Mamul ürünü şirket içinde koduyla eşleşmeyen kayıtlar import edilmez.
    - Hammadde ürünü bulunmayan / birden fazla eşleşen kayıtlar import edilmez.
    - '?' içeren REVIEW satırları import edilmez.
    - Bir mamulün staging satırlarının tamamı güvenli eşleşmeden geçmeden reçete
      oluşturulmaz. Böylece eksik BOM yanlışlıkla "tam reçete" haline gelmez.
    - Aynı CompanyId + MamulUrunId + ReceteKodu + Versiyon için mevcut aktif
      reçete varsa yeni reçete açılmaz.
    - RAW satırlarında "ALT REÇETE: AHDRYxxxx" özel olarak AltReceteId'ye bağlanır.

  Önce aşağıdaki RAPOR sorgusunu çalıştırmak önerilir. APPLY = 1 ile gerçek import
  yapılır. Varsayılan APPLY = 0'dır.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @CompanyId INT = TRY_CONVERT(INT, SESSION_CONTEXT(N'CompanyId'));
IF @CompanyId IS NULL OR @CompanyId <= 0
    THROW 51001, 'CompanyId context bulunamadı.', 1;

DECLARE @APPLY BIT = 0;

IF OBJECT_ID(N'dbo.BomImportStaging', N'U') IS NULL
    THROW 51002, 'dbo.BomImportStaging bulunamadı. Önce 006_BOM_IMPORT çalıştırılmalı.', 1;

/* Mamul kodu bazında güvenli ürün eşleşmesi */
;WITH Mamuller AS
(
    SELECT
        s.MamulKodu,
        COUNT(*) AS StagingSatiri,
        COUNT(DISTINCT u.UrunId) AS MamulEslesme,
        MIN(u.UrunId) AS MamulUrunId
    FROM dbo.BomImportStaging s
    LEFT JOIN dbo.Urunler u
      ON u.CompanyId = @CompanyId
     AND UPPER(LTRIM(RTRIM(u.UrunKodu))) = UPPER(LTRIM(RTRIM(s.MamulKodu)))
    WHERE s.CompanyId = @CompanyId
    GROUP BY s.MamulKodu
),
Kontrol AS
(
    SELECT
        s.MamulKodu,
        COUNT(*) AS SatirSayisi,
        SUM(CASE WHEN s.Durum = N'REVIEW' OR s.HammaddeAdi LIKE N'%?%' THEN 1 ELSE 0 END) AS ReviewSayisi,
        SUM(CASE WHEN UPPER(LTRIM(RTRIM(s.HammaddeAdi))) LIKE N'ALT REÇETE:%'
                 THEN CASE WHEN ar.ReceteId IS NULL THEN 1 ELSE 0 END
                 ELSE CASE WHEN COUNT(DISTINCT hu.UrunId) OVER (PARTITION BY s.ImportId) <> 1 THEN 1 ELSE 0 END
            END) AS EslesmeyenSatir
    FROM dbo.BomImportStaging s
    LEFT JOIN dbo.Receteler ar
      ON ar.CompanyId = @CompanyId
     AND ar.IsActive = 1
     AND UPPER(LTRIM(RTRIM(ar.ReceteKodu))) = UPPER(LTRIM(RTRIM(REPLACE(s.HammaddeAdi,N'ALT REÇETE:',N''))))
    LEFT JOIN dbo.Urunler hu
      ON hu.CompanyId = @CompanyId
     AND (UPPER(LTRIM(RTRIM(hu.UrunKodu))) = UPPER(LTRIM(RTRIM(s.HammaddeAdi)))
       OR UPPER(LTRIM(RTRIM(hu.UrunAdi))) = UPPER(LTRIM(RTRIM(s.HammaddeAdi))))
    WHERE s.CompanyId = @CompanyId
    GROUP BY s.MamulKodu
)
SELECT
    m.MamulKodu,
    m.MamulUrunId,
    m.StagingSatiri,
    m.MamulEslesme,
    ISNULL(k.ReviewSayisi,0) AS ReviewSayisi,
    ISNULL(k.EslesmeyenSatir,0) AS EslesmeyenSatir,
    CASE
      WHEN m.MamulEslesme <> 1 THEN N'REVIEW_MAMUL'
      WHEN ISNULL(k.ReviewSayisi,0) > 0 THEN N'REVIEW_KAYNAK'
      WHEN ISNULL(k.EslesmeyenSatir,0) > 0 THEN N'REVIEW_HAMMADDE'
      ELSE N'HAZIR'
    END AS ImportDurumu
FROM Mamuller m
LEFT JOIN Kontrol k ON k.MamulKodu = m.MamulKodu
ORDER BY m.MamulKodu;

IF @APPLY = 0
    RETURN;

BEGIN TRANSACTION;

/*
  Sadece tam ve güvenli BOM'ları gerçek reçeteye dönüştür.
  Reçete kodu mamul kodudur; versiyon 1 kullanılır.
*/
DECLARE @MamulKodu NVARCHAR(100), @MamulUrunId INT, @MamulAdi NVARCHAR(250), @ReceteId INT;

DECLARE mamul_cursor CURSOR LOCAL FAST_FORWARD FOR
SELECT s.MamulKodu, MIN(u.UrunId), MAX(COALESCE(NULLIF(s.MamulAdi,N''),u.UrunAdi))
FROM dbo.BomImportStaging s
JOIN dbo.Urunler u
  ON u.CompanyId=@CompanyId
 AND UPPER(LTRIM(RTRIM(u.UrunKodu)))=UPPER(LTRIM(RTRIM(s.MamulKodu)))
WHERE s.CompanyId=@CompanyId
GROUP BY s.MamulKodu
HAVING COUNT(DISTINCT u.UrunId)=1
   AND SUM(CASE WHEN s.Durum=N'REVIEW' OR s.HammaddeAdi LIKE N'%?%' THEN 1 ELSE 0 END)=0
   AND SUM(CASE
             WHEN UPPER(LTRIM(RTRIM(s.HammaddeAdi))) LIKE N'ALT REÇETE:%'
             THEN CASE WHEN EXISTS
                  (SELECT 1 FROM dbo.Receteler ar
                   WHERE ar.CompanyId=@CompanyId AND ar.IsActive=1
                     AND UPPER(LTRIM(RTRIM(ar.ReceteKodu))) = UPPER(LTRIM(RTRIM(REPLACE(s.HammaddeAdi,N'ALT REÇETE:',N'')))))\                  THEN 0 ELSE 1 END
             ELSE CASE WHEN EXISTS
                  (SELECT 1 FROM dbo.Urunler hu
                   WHERE hu.CompanyId=@CompanyId
                     AND (UPPER(LTRIM(RTRIM(hu.UrunKodu)))=UPPER(LTRIM(RTRIM(s.HammaddeAdi)))
                       OR UPPER(LTRIM(RTRIM(hu.UrunAdi)))=UPPER(LTRIM(RTRIM(s.HammaddeAdi)))))\                  THEN 0 ELSE 1 END
           END)=0;

OPEN mamul_cursor;
FETCH NEXT FROM mamul_cursor INTO @MamulKodu,@MamulUrunId,@MamulAdi;

WHILE @@FETCH_STATUS=0
BEGIN
    SELECT @ReceteId = NULL;

    SELECT TOP (1) @ReceteId = ReceteId
    FROM dbo.Receteler
    WHERE CompanyId=@CompanyId
      AND IsActive=1
      AND MamulUrunId=@MamulUrunId
      AND UPPER(LTRIM(RTRIM(ReceteKodu)))=UPPER(LTRIM(RTRIM(@MamulKodu)))
      AND Versiyon=1;

    IF @ReceteId IS NULL
    BEGIN
        INSERT INTO dbo.Receteler
        (
          CompanyId,ReceteKodu,ReceteAdi,MamulUrunId,MamulAdi,Versiyon,
          UretimBirimi,Durum,ReceteTipi,CiktiMiktari,CiktiBirimi,StandartFireOrani,IsActive
        )
        VALUES
        (
          @CompanyId,@MamulKodu,@MamulAdi,@MamulUrunId,@MamulAdi,1,
          N'Adet',N'Aktif',N'Mamul',1,N'Adet',0,1
        );
        SET @ReceteId=SCOPE_IDENTITY();
    END;

    /* Mevcut reçetenin BOM'u boşsa staging'i aktar; dolu reçeteye dokunma. */
    IF NOT EXISTS (SELECT 1 FROM dbo.ReceteDetay WHERE CompanyId=@CompanyId AND ReceteId=@ReceteId)
    BEGIN
        INSERT INTO dbo.ReceteDetay
        (
          CompanyId,ReceteId,HammaddeUrunId,HammaddeAdi,Miktar,Birim,
          SiraNo,KalemTipi,AltReceteId,GirdiMiktari,GirdiBirimi,
          CiktiMiktari,CiktiBirimi,VerimOrani,FasonMu
        )
        SELECT
          @CompanyId,
          @ReceteId,
          hu.UrunId,
          s.HammaddeAdi,
          s.Miktar,
          s.Birim,
          ROW_NUMBER() OVER (ORDER BY s.ImportId),
          CASE WHEN UPPER(LTRIM(RTRIM(s.HammaddeAdi))) LIKE N'ALT REÇETE:%' THEN N'Mamul' ELSE N'Malzeme' END,
          ar.ReceteId,
          s.Miktar,
          s.Birim,
          NULL,
          NULL,
          100,
          0
        FROM dbo.BomImportStaging s
        OUTER APPLY
        (
          SELECT TOP (1) u.UrunId
          FROM dbo.Urunler u
          WHERE u.CompanyId=@CompanyId
            AND (UPPER(LTRIM(RTRIM(u.UrunKodu)))=UPPER(LTRIM(RTRIM(s.HammaddeAdi)))
              OR UPPER(LTRIM(RTRIM(u.UrunAdi)))=UPPER(LTRIM(RTRIM(s.HammaddeAdi))))
          ORDER BY CASE WHEN UPPER(LTRIM(RTRIM(u.UrunKodu)))=UPPER(LTRIM(RTRIM(s.HammaddeAdi))) THEN 0 ELSE 1 END,u.UrunId
        ) hu
        OUTER APPLY
        (
          SELECT TOP (1) r.ReceteId
          FROM dbo.Receteler r
          WHERE r.CompanyId=@CompanyId AND r.IsActive=1
            AND UPPER(LTRIM(RTRIM(r.ReceteKodu)))=UPPER(LTRIM(RTRIM(REPLACE(s.HammaddeAdi,N'ALT REÇETE:',N''))))
          ORDER BY r.Versiyon DESC,r.ReceteId DESC
        ) ar
        WHERE s.CompanyId=@CompanyId AND s.MamulKodu=@MamulKodu;
    END;

    UPDATE s
       SET Durum=N'IMPORTED', Notlar=CONCAT(ISNULL(Notlar,N''),CASE WHEN ISNULL(Notlar,N'')=N'' THEN N'' ELSE N' | ' END,N'Reçeteye aktarıldı: ',CONVERT(NVARCHAR(20),@ReceteId))
    FROM dbo.BomImportStaging s
    WHERE s.CompanyId=@CompanyId AND s.MamulKodu=@MamulKodu;

    FETCH NEXT FROM mamul_cursor INTO @MamulKodu,@MamulUrunId,@MamulAdi;
END;

CLOSE mamul_cursor;
DEALLOCATE mamul_cursor;

COMMIT TRANSACTION;

SELECT
    MamulKodu,
    COUNT(*) AS SatirSayisi,
    MIN(Durum) AS Durum
FROM dbo.BomImportStaging
WHERE CompanyId=@CompanyId
GROUP BY MamulKodu
ORDER BY MamulKodu;
