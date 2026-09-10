/* ALYA ERP 014 V2 - Sipariş > rezervasyon > irsaliye > fatura zinciri. Veri silmez. */
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRAN;

  IF OBJECT_ID(N'dbo.Siparisler',N'U') IS NULL THROW 51401,N'Siparisler bulunamadı.',1;
  IF OBJECT_ID(N'dbo.SiparisDetay',N'U') IS NULL THROW 51402,N'SiparisDetay bulunamadı.',1;
  IF OBJECT_ID(N'dbo.StokRezervasyonlari',N'U') IS NULL THROW 51403,N'Faz 1 stok migrationları çalıştırılmalıdır.',1;
  IF OBJECT_ID(N'dbo.Irsaliyeler',N'U') IS NULL OR OBJECT_ID(N'dbo.Faturalar',N'U') IS NULL THROW 51404,N'Fatura/irsaliye tabloları kurulmalıdır.',1;
  IF OBJECT_ID(N'dbo.IrsaliyeDetay',N'U') IS NULL OR OBJECT_ID(N'dbo.FaturaDetay',N'U') IS NULL THROW 51405,N'Fatura/irsaliye detay tabloları kurulmalıdır.',1;
  IF OBJECT_ID(N'dbo.Urunler',N'U') IS NULL THROW 51406,N'Urunler bulunamadı.',1;

  IF COL_LENGTH(N'dbo.Siparisler',N'OnayDurumu') IS NULL
    ALTER TABLE dbo.Siparisler ADD OnayDurumu NVARCHAR(20) NOT NULL CONSTRAINT DF_Siparisler_OnayDurumu DEFAULT N'Bekliyor' WITH VALUES;
  IF COL_LENGTH(N'dbo.Siparisler',N'RezervasyonDurumu') IS NULL
    ALTER TABLE dbo.Siparisler ADD RezervasyonDurumu NVARCHAR(20) NOT NULL CONSTRAINT DF_Siparisler_RezervasyonDurumu DEFAULT N'Yok' WITH VALUES;
  IF COL_LENGTH(N'dbo.SiparisDetay',N'UrunId') IS NULL
    ALTER TABLE dbo.SiparisDetay ADD UrunId INT NULL;
  IF COL_LENGTH(N'dbo.SiparisDetay',N'RezerveMiktar') IS NULL
    ALTER TABLE dbo.SiparisDetay ADD RezerveMiktar DECIMAL(18,4) NOT NULL CONSTRAINT DF_SiparisDetay_Rezerve DEFAULT 0 WITH VALUES;
  IF COL_LENGTH(N'dbo.SiparisDetay',N'SevkEdilenMiktar') IS NULL
    ALTER TABLE dbo.SiparisDetay ADD SevkEdilenMiktar DECIMAL(18,4) NOT NULL CONSTRAINT DF_SiparisDetay_Sevk DEFAULT 0 WITH VALUES;
  IF COL_LENGTH(N'dbo.SiparisDetay',N'FaturalananMiktar') IS NULL
    ALTER TABLE dbo.SiparisDetay ADD FaturalananMiktar DECIMAL(18,4) NOT NULL CONSTRAINT DF_SiparisDetay_Fatura DEFAULT 0 WITH VALUES;
  IF COL_LENGTH(N'dbo.StokRezervasyonlari',N'ReferansSatirId') IS NULL
    ALTER TABLE dbo.StokRezervasyonlari ADD ReferansSatirId BIGINT NULL;
  IF COL_LENGTH(N'dbo.IrsaliyeDetay',N'SiparisDetayId') IS NULL
    ALTER TABLE dbo.IrsaliyeDetay ADD SiparisDetayId INT NULL;
  IF COL_LENGTH(N'dbo.IrsaliyeDetay',N'UrunId') IS NULL
    ALTER TABLE dbo.IrsaliyeDetay ADD UrunId INT NULL;
  IF COL_LENGTH(N'dbo.FaturaDetay',N'IrsaliyeDetayId') IS NULL
    ALTER TABLE dbo.FaturaDetay ADD IrsaliyeDetayId INT NULL;
  IF COL_LENGTH(N'dbo.FaturaDetay',N'UrunId') IS NULL
    ALTER TABLE dbo.FaturaDetay ADD UrunId INT NULL;

  /* Yeni eklenen sütun aynı batch içinde statik SQL ile derlenemez.
     Dinamik SQL, ALTER TABLE tamamlandıktan sonra derlenmesini sağlar. */
  EXEC sys.sp_executesql N'
    UPDATE d
       SET UrunId=u.UrunId
      FROM dbo.SiparisDetay d
      JOIN dbo.Siparisler s
        ON s.SiparisId=d.SiparisId AND s.CompanyId=d.CompanyId
      JOIN dbo.Urunler u
        ON u.CompanyId=d.CompanyId AND u.UrunKodu=d.UrunKodu
     WHERE d.UrunId IS NULL;
  ';

  IF OBJECT_ID(N'dbo.BelgeBaglantilari',N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.BelgeBaglantilari(
      BaglantiId BIGINT IDENTITY PRIMARY KEY,
      CompanyId INT NOT NULL,
      KaynakTip NVARCHAR(40) NOT NULL,
      KaynakId BIGINT NOT NULL,
      HedefTip NVARCHAR(40) NOT NULL,
      HedefId BIGINT NOT NULL,
      OlusturanId INT,
      CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT UQ_BelgeBaglantilari UNIQUE(CompanyId,KaynakTip,KaynakId,HedefTip,HedefId),
      CONSTRAINT FK_BelgeBaglantilari_Company FOREIGN KEY(CompanyId) REFERENCES dbo.Sirketler(CompanyId)
    );
    CREATE INDEX IX_BelgeBaglantilari_Kaynak
      ON dbo.BelgeBaglantilari(CompanyId,KaynakTip,KaynakId);
  END;

  /* İndeks de yeni sütunları kullandığı için ayrı derleme kapsamına alınır. */
  IF NOT EXISTS(
    SELECT 1 FROM sys.indexes
     WHERE object_id=OBJECT_ID(N'dbo.SiparisDetay')
       AND name=N'IX_SiparisDetay_Fulfillment'
  )
    EXEC sys.sp_executesql N'
      CREATE INDEX IX_SiparisDetay_Fulfillment
        ON dbo.SiparisDetay(CompanyId,SiparisId,UrunId)
        INCLUDE(Miktar,RezerveMiktar,SevkEdilenMiktar,FaturalananMiktar);
    ';

  COMMIT;
END TRY
BEGIN CATCH
  IF XACT_STATE()<>0 ROLLBACK;
  THROW;
END CATCH;

SELECT N'014 V2 satış karşılama zinciri tamamlandı.' Result;
