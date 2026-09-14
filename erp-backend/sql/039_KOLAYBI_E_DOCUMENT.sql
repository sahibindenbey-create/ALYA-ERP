/* 039 - KolayBi e-belge sonuç alanları */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.Faturalar',N'U') IS NULL
 THROW 53901,N'dbo.Faturalar bulunamadı. Önce fatura migrationlarını çalıştırın.',1;

BEGIN TRY
 BEGIN TRAN;
 IF COL_LENGTH(N'dbo.Faturalar',N'KolaybiEtTN') IS NULL
  ALTER TABLE dbo.Faturalar ADD KolaybiEtTN NVARCHAR(100) NULL;
 IF COL_LENGTH(N'dbo.Faturalar',N'KolaybiFaturaNo') IS NULL
  ALTER TABLE dbo.Faturalar ADD KolaybiFaturaNo NVARCHAR(100) NULL;
 IF COL_LENGTH(N'dbo.Faturalar',N'KolaybiDurum') IS NULL
  ALTER TABLE dbo.Faturalar ADD KolaybiDurum NVARCHAR(100) NULL;
 IF COL_LENGTH(N'dbo.Faturalar',N'EbelgeSenaryo') IS NULL
  ALTER TABLE dbo.Faturalar ADD EbelgeSenaryo NVARCHAR(80) NULL;
 IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.Faturalar') AND name=N'UX_Faturalar_Company_KolaybiExternal')
  CREATE UNIQUE INDEX UX_Faturalar_Company_KolaybiExternal ON dbo.Faturalar(CompanyId,KolaybiExternalId) WHERE KolaybiExternalId IS NOT NULL;
 COMMIT;
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK;
 THROW;
END CATCH;

PRINT N'039 KolayBi e-belge alanları hazır.';
GO
