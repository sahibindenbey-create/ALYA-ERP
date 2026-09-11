/* ALYA ERP 028 - Yamankaya KolayBi canlı bağlantı durumu (kimlik bilgisi içermez) */
SET NOCOUNT ON;SET XACT_ABORT ON;
IF OBJECT_ID(N'dbo.KolaybiAyarlar',N'U') IS NULL THROW 52801,N'Önce 001_multi_company_kolaybi.sql çalıştırılmalıdır.',1;
IF NOT EXISTS(SELECT 1 FROM dbo.Sirketler WHERE CompanyId=2 AND UPPER(CompanyName) LIKE N'%YAMANKAYA%') THROW 52802,N'CompanyId 2 Yamankaya şirketi olarak bulunamadı.',1;
IF COL_LENGTH(N'dbo.KolaybiAyarlar',N'KolaybiCompanyName') IS NULL EXEC sys.sp_executesql N'ALTER TABLE dbo.KolaybiAyarlar ADD KolaybiCompanyName NVARCHAR(250) NULL;';
IF COL_LENGTH(N'dbo.KolaybiAyarlar',N'ConnectionStatus') IS NULL EXEC sys.sp_executesql N'ALTER TABLE dbo.KolaybiAyarlar ADD ConnectionStatus NVARCHAR(30) NULL;';
IF COL_LENGTH(N'dbo.KolaybiAyarlar',N'LastConnectionTestAt') IS NULL EXEC sys.sp_executesql N'ALTER TABLE dbo.KolaybiAyarlar ADD LastConnectionTestAt DATETIME2(3) NULL;';
IF COL_LENGTH(N'dbo.KolaybiAyarlar',N'ConnectionError') IS NULL EXEC sys.sp_executesql N'ALTER TABLE dbo.KolaybiAyarlar ADD ConnectionError NVARCHAR(1000) NULL;';
EXEC sys.sp_executesql N'UPDATE dbo.KolaybiAyarlar SET BaseUrl=N''https://ofis-api.kolaybi.com'',ConnectionStatus=COALESCE(ConnectionStatus,N''NOT_TESTED''),UpdatedAt=SYSUTCDATETIME() WHERE CompanyId=2 AND IsActive=1;';
SELECT N'028 Yamankaya KolayBi canlı bağlantı altyapısı tamamlandı.' Result;
