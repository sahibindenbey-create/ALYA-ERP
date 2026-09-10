/* ALYA ERP 013 - stok transfer, sayım ve belge numaraları. Veri silmez. */
SET NOCOUNT ON; SET XACT_ABORT ON;
BEGIN TRY BEGIN TRAN;
IF OBJECT_ID(N'dbo.StokBakiyeleri',N'U') IS NULL THROW 51301,N'Önce 012_STOCK_WAREHOUSE_CORE çalıştırılmalıdır.',1;
IF OBJECT_ID(N'dbo.NumberSeries',N'U') IS NULL THROW 51302,N'Önce 011_ERP_CORE_PHASE0 çalıştırılmalıdır.',1;
IF OBJECT_ID(N'dbo.StokSayimFisleri',N'U') IS NULL BEGIN
 CREATE TABLE dbo.StokSayimFisleri(
  SayimId BIGINT IDENTITY PRIMARY KEY,CompanyId INT NOT NULL,SayimNo NVARCHAR(64) NOT NULL,
  DepoId INT NOT NULL,Durum NVARCHAR(20) NOT NULL DEFAULT N'Tamamlandı',SayimTarihi DATETIME2(3) NOT NULL,
  Aciklama NVARCHAR(500),CreatedBy INT,CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_StokSayimFisleri UNIQUE(CompanyId,SayimNo),
  CONSTRAINT CK_StokSayim_Durum CHECK(Durum IN(N'Taslak',N'Tamamlandı',N'İptal')),
  CONSTRAINT FK_StokSayim_Company FOREIGN KEY(CompanyId) REFERENCES dbo.Sirketler(CompanyId),
  CONSTRAINT FK_StokSayim_Depo FOREIGN KEY(DepoId) REFERENCES dbo.Depolar(DepoId));
 CREATE INDEX IX_StokSayim_CompanyDate ON dbo.StokSayimFisleri(CompanyId,SayimTarihi DESC);
END;
IF OBJECT_ID(N'dbo.StokSayimKalemleri',N'U') IS NULL BEGIN
 CREATE TABLE dbo.StokSayimKalemleri(
  SayimKalemId BIGINT IDENTITY PRIMARY KEY,SayimId BIGINT NOT NULL,UrunId INT NOT NULL,LokasyonId INT NOT NULL,
  SistemMiktari DECIMAL(18,4) NOT NULL,SayilanMiktar DECIMAL(18,4) NOT NULL,Fark AS(SayilanMiktar-SistemMiktari) PERSISTED,
  LotNo NVARCHAR(80) NOT NULL DEFAULT N'',SeriNo NVARCHAR(120) NOT NULL DEFAULT N'',
  CONSTRAINT CK_StokSayimKalem_Miktar CHECK(SistemMiktari>=0 AND SayilanMiktar>=0),
  CONSTRAINT FK_StokSayimKalem_Fis FOREIGN KEY(SayimId) REFERENCES dbo.StokSayimFisleri(SayimId),
  CONSTRAINT FK_StokSayimKalem_Urun FOREIGN KEY(UrunId) REFERENCES dbo.Urunler(UrunId),
  CONSTRAINT FK_StokSayimKalem_Lokasyon FOREIGN KEY(LokasyonId) REFERENCES dbo.DepoLokasyonlari(LokasyonId));
END;
INSERT dbo.NumberSeries(CompanyId,DocumentType,Prefix,Padding,ResetYearly)
SELECT s.CompanyId,x.DocumentType,x.Prefix,6,1 FROM dbo.Sirketler s
CROSS JOIN(VALUES(N'STOK_TRANSFER',N'TRF-'),(N'STOK_SAYIM',N'SYM-'))x(DocumentType,Prefix)
WHERE s.IsActive=1 AND NOT EXISTS(SELECT 1 FROM dbo.NumberSeries n WHERE n.CompanyId=s.CompanyId AND n.DocumentType=x.DocumentType);
COMMIT; END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK; THROW; END CATCH;
SELECT N'013 stok operasyonları tamamlandı.' Result;
