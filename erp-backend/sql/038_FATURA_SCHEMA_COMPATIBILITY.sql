/* 038 - Eski kurulumlarda eksik fatura kolonlarını güvenle tamamlar */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> N'myERP'
 PRINT N'UYARI: Aktif veritabanı '+QUOTENAME(DB_NAME())+N'. Beklenen veritabanı [myERP].';

IF OBJECT_ID(N'dbo.Faturalar',N'U') IS NULL
 THROW 53801,N'dbo.Faturalar bulunamadı. Önce ERP çekirdek migrationları çalıştırılmalıdır.',1;
IF OBJECT_ID(N'dbo.FaturaDetay',N'U') IS NULL
 THROW 53802,N'dbo.FaturaDetay bulunamadı. Önce fatura migrationları çalıştırılmalıdır.',1;

BEGIN TRY
 BEGIN TRAN;
 IF COL_LENGTH(N'dbo.Faturalar',N'ParaBirimi') IS NULL
  ALTER TABLE dbo.Faturalar ADD ParaBirimi NVARCHAR(10) NOT NULL CONSTRAINT DF_Faturalar_ParaBirimi_038 DEFAULT N'TRY' WITH VALUES;
 IF COL_LENGTH(N'dbo.Faturalar',N'OdenenTutar') IS NULL
  ALTER TABLE dbo.Faturalar ADD OdenenTutar DECIMAL(18,2) NOT NULL CONSTRAINT DF_Faturalar_OdenenTutar_038 DEFAULT(0) WITH VALUES;
 IF COL_LENGTH(N'dbo.Faturalar',N'KolaybiExternalId') IS NULL
  ALTER TABLE dbo.Faturalar ADD KolaybiExternalId NVARCHAR(255) NULL;
 IF COL_LENGTH(N'dbo.Faturalar',N'KdvDahilMi') IS NULL
  ALTER TABLE dbo.Faturalar ADD KdvDahilMi BIT NULL;
 IF COL_LENGTH(N'dbo.FaturaDetay',N'IskontoOrani') IS NULL
  ALTER TABLE dbo.FaturaDetay ADD IskontoOrani DECIMAL(9,4) NOT NULL CONSTRAINT DF_FaturaDetay_Iskonto_038 DEFAULT(0) WITH VALUES;
 IF COL_LENGTH(N'dbo.FaturaDetay',N'NetTutar') IS NULL
  ALTER TABLE dbo.FaturaDetay ADD NetTutar DECIMAL(18,2) NULL;
 IF COL_LENGTH(N'dbo.FaturaDetay',N'BrutTutar') IS NULL
  ALTER TABLE dbo.FaturaDetay ADD BrutTutar DECIMAL(18,2) NULL;
 COMMIT;
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK;
 THROW;
END CATCH;

SELECT DB_NAME() AS AktifVeritabani,
 COL_LENGTH(N'dbo.Faturalar',N'ParaBirimi') AS ParaBirimiKolonUzunlugu,
 COL_LENGTH(N'dbo.Faturalar',N'OdenenTutar') AS OdenenTutarKolonUzunlugu,
 COL_LENGTH(N'dbo.FaturaDetay',N'NetTutar') AS NetTutarKolonUzunlugu;
PRINT N'038 fatura şema uyumluluğu tamamlandı.';
GO
