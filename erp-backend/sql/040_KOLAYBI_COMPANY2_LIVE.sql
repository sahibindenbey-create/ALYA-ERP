/*
  040 - Şirket 2 KolayBi canlı şirket eşleşmesi
  ALYA CompanyId 2 -> KolayBi CompanyId 18558

  ÖNEMLİ:
  - AccessToken temizlenir; sonraki bağlantı testinde yeni token alınır.
  - API Key / Channel değiştirilmez. Token yine 16203 dönerse kullanılan
    API Key veya Channel test hesabına aittir ve KolayBi canlı bilgileriyle
    değiştirilmelidir.
  - KolaybiAyarlar.Id bazı eski kurulumlarda IDENTITY değildir. Bu nedenle
    eksik kayıt eklenirken Id kolonu şemaya göre otomatik ele alınır.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.KolaybiAyarlar', N'U') IS NULL
    THROW 54001, N'KolaybiAyarlar tablosu bulunamadı. Önce 001_multi_company_kolaybi.sql çalıştırılmalı.', 1;

IF NOT EXISTS (
    SELECT 1 FROM dbo.Sirketler WHERE CompanyId = 2 AND IsActive = 1
)
    THROW 54002, N'ALYA CompanyId 2 aktif değil veya bulunamadı.', 1;

IF NOT EXISTS (
    SELECT 1 FROM dbo.KolaybiAyarlar WHERE CompanyId = 2 AND IsActive = 1
)
BEGIN
    /*
      Eski KolaybiAyarlar tablolarında Id NOT NULL olup IDENTITY olmayan
      kurulumlar bulunabiliyor. IDENTITY durumuna göre uygun INSERT çalıştırılır.
    */
    DECLARE @IdIsIdentity BIT = 0;
    DECLARE @NewId INT;
    DECLARE @InsertSql NVARCHAR(MAX);

    SELECT @IdIsIdentity = CONVERT(BIT, COLUMNPROPERTY(OBJECT_ID(N'dbo.KolaybiAyarlar'), N'Id', 'IsIdentity'));

    IF @IdIsIdentity = 1
    BEGIN
        INSERT INTO dbo.KolaybiAyarlar
            (CompanyId, BaseUrl, KolaybiCompanyId, IsActive)
        VALUES
            (2, N'https://ofis-api.kolaybi.com', N'18558', 1);
    END
    ELSE
    BEGIN
        SELECT @NewId = ISNULL(MAX(Id), 0) + 1
        FROM dbo.KolaybiAyarlar WITH (UPDLOCK, HOLDLOCK);

        INSERT INTO dbo.KolaybiAyarlar
            (Id, CompanyId, BaseUrl, KolaybiCompanyId, IsActive)
        VALUES
            (@NewId, 2, N'https://ofis-api.kolaybi.com', N'18558', 1);
    END;
END
ELSE
BEGIN
    UPDATE dbo.KolaybiAyarlar
    SET KolaybiCompanyId = N'18558',
        AccessToken = NULL,
        TokenGecerlilik = NULL,
        SonSenkronDurumu = N'BEKLIYOR',
        SonSenkronMesaji = N'KolayBi CompanyId 18558 için token yenilenecek.',
        UpdatedAt = SYSDATETIME()
    WHERE CompanyId = 2 AND IsActive = 1;
END;

SELECT
    CompanyId,
    KolaybiCompanyId,
    CASE WHEN AccessToken IS NULL THEN 'TOKEN YOK - YENİ TOKEN ALINACAK' ELSE 'TOKEN MEVCUT' END AS TokenDurumu,
    Channel,
    BaseUrl
FROM dbo.KolaybiAyarlar
WHERE CompanyId = 2 AND IsActive = 1;
