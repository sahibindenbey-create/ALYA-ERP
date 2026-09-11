/* ALYA ERP 028 - Yamankaya KolayBi canlı bağlantı durumu (kimlik bilgisi içermez) */
SET NOCOUNT ON;SET XACT_ABORT ON;BEGIN TRY BEGIN TRAN;
IF OBJECT_ID(N'dbo.KolaybiAyarlar',N'U') IS NULL THROW 52801,N'Önce 001_multi_company_kolaybi.sql çalıştırılmalıdır.',1;
IF NOT EXISTS(SELECT 1 FROM dbo.Sirketler WHERE CompanyId=2 AND UPPER(CompanyName) LIKE N'%YAMANKAYA%') THROW 52802,N'CompanyId 2 Yamankaya şirketi olarak bulunamadı.',1;
IF COL_LENGTH(N'dbo.KolaybiAyarlar',N'KolaybiCompanyName') IS NULL ALTER TABLE dbo.KolaybiAyarlar ADD KolaybiCompanyName NVARCHAR(250) NULL;
IF COL_LENGTH(N'dbo.KolaybiAyarlar',N'ConnectionStatus') IS NULL ALTER TABLE dbo.KolaybiAyarlar ADD ConnectionStatus NVARCHAR(30) NULL;
IF COL_LENGTH(N'dbo.KolaybiAyarlar',N'LastConnectionTestAt') IS NULL ALTER TABLE dbo.KolaybiAyarlar ADD LastConnectionTestAt DATETIME2(3) NULL;
IF COL_LENGTH(N'dbo.KolaybiAyarlar',N'ConnectionError') IS NULL ALTER TABLE dbo.KolaybiAyarlar ADD ConnectionError NVARCHAR(1000) NULL;
IF NOT EXISTS(SELECT 1 FROM dbo.KolaybiAyarlar WHERE CompanyId=2)INSERT dbo.KolaybiAyarlar(CompanyId,BaseUrl,IsActive,ConnectionStatus)VALUES(2,N'https://ofis-api.kolaybi.com',1,N'NOT_TESTED');
ELSE UPDATE dbo.KolaybiAyarlar SET BaseUrl=N'https://ofis-api.kolaybi.com',IsActive=1,ConnectionStatus=COALESCE(ConnectionStatus,N'NOT_TESTED'),UpdatedAt=SYSUTCDATETIME() WHERE CompanyId=2;
COMMIT;END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK;THROW;END CATCH;SELECT N'028 Yamankaya KolayBi canlı bağlantı altyapısı tamamlandı.' Result;
