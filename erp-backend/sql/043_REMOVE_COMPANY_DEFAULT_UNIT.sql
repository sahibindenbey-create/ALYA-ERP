/* ALYA ERP - Şirket profilinden varsayılan birim kaldırılır.
   Birim şirketten değil, ürün kartından gelir.
*/

IF OBJECT_ID(N'dbo.Sirketler', N'U') IS NULL
    THROW 54301, N'dbo.Sirketler bulunamadı.', 1;

IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_Sirketler_Profil'
      AND object_id = OBJECT_ID(N'dbo.Sirketler')
)
BEGIN
    DROP INDEX IX_Sirketler_Profil ON dbo.Sirketler;
END;

IF COL_LENGTH(N'dbo.Sirketler', N'VarsayilanBirim') IS NOT NULL
    ALTER TABLE dbo.Sirketler DROP COLUMN VarsayilanBirim;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_Sirketler_Profil'
      AND object_id = OBJECT_ID(N'dbo.Sirketler')
)
BEGIN
    CREATE INDEX IX_Sirketler_Profil
        ON dbo.Sirketler(CompanyId, FirmaTipi, SiparisSablonu, StokTakipTipi)
        INCLUDE (CompanyName, ProfilAktif);
END;

SELECT
    CompanyId,
    CompanyName,
    FirmaTipi,
    SiparisSablonu,
    StokTakipTipi,
    ProfilAktif
FROM dbo.Sirketler
ORDER BY CompanyId;
