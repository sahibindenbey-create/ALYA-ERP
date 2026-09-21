/* ============================================================================
   ALYA ERP - MIGRATION TEŞHİS RAPORU (salt okunur, hiçbir şey değiştirmez)
   ============================================================================
   AMAÇ: erp-backend/sql/ altındaki 001-046 migration dosyalarının her biri
   için, o dosyanın oluşturduğu "imza" tablo/fonksiyonları veritabanınızda
   arar. Böylece hangi migration'ların gerçekten çalıştığını, hangilerinin
   hiç çalışmadığını (027'de olduğu gibi) TEK SEFERDE görürsünüz.

   NOT: Sadece CREATE TABLE / CREATE FUNCTION içeren dosyalar teşhis
   edilebilir. Yalnızca ALTER TABLE, veri (seed) veya RLS-politika
   güncellemesi içeren dosyalar (003,004,005,009,028,034,036,038,039,040,
   042,043) bu yöntemle doğrulanamaz - bunlar "Kontrol edilemedi" olarak
   işaretlenir, ayrıca elle bakılmalı.
   ============================================================================ */
SET NOCOUNT ON;

DECLARE @Markers TABLE (Migration NVARCHAR(80), MarkerType CHAR(1), MarkerName SYSNAME);
-- MarkerType: 'T' = tablo, 'F' = fonksiyon

INSERT INTO @Markers VALUES
('001_multi_company_kolaybi','T','KolaybiAyarlar'),('001_multi_company_kolaybi','T','KolaybiSyncKayitlari'),('001_multi_company_kolaybi','T','KolaybiSyncLog'),('001_multi_company_kolaybi','T','Sirketler'),
('002_company_isolation','F','fn_AlyaCompanyPredicate'),
('006_URUN_RECETE_BOM_IMPORT','T','BomImportStaging'),
('010_kolaybi_rawdata','T','KolaybiRawData'),
('011_ERP_CORE_PHASE0','T','AuditLogs'),('011_ERP_CORE_PHASE0','T','FiscalPeriods'),('011_ERP_CORE_PHASE0','T','NumberSeries'),('011_ERP_CORE_PHASE0','T','PeriodLocks'),('011_ERP_CORE_PHASE0','T','Permissions'),('011_ERP_CORE_PHASE0','T','RolePermissions'),('011_ERP_CORE_PHASE0','T','Roles'),('011_ERP_CORE_PHASE0','T','UserCompanies'),('011_ERP_CORE_PHASE0','T','UserRoles'),('011_ERP_CORE_PHASE0','T','WorkflowApprovals'),('011_ERP_CORE_PHASE0','T','WorkflowInstances'),('011_ERP_CORE_PHASE0','T','WorkflowSteps'),('011_ERP_CORE_PHASE0','T','Workflows'),
('012_STOCK_WAREHOUSE_CORE','T','DepoLokasyonlari'),('012_STOCK_WAREHOUSE_CORE','T','Depolar'),('012_STOCK_WAREHOUSE_CORE','T','StokBakiyeleri'),('012_STOCK_WAREHOUSE_CORE','T','StokRezervasyonlari'),('012_STOCK_WAREHOUSE_CORE','T','StokTransferKalemleri'),('012_STOCK_WAREHOUSE_CORE','T','StokTransferleri'),
('012_erp_fatura_irsaliye_tables','T','FaturaDetay'),('012_erp_fatura_irsaliye_tables','T','Faturalar'),('012_erp_fatura_irsaliye_tables','T','IrsaliyeDetay'),('012_erp_fatura_irsaliye_tables','T','Irsaliyeler'),
('013_STOCK_OPERATIONS','T','StokSayimFisleri'),('013_STOCK_OPERATIONS','T','StokSayimKalemleri'),
('014_SALES_FULFILLMENT_CHAIN','T','BelgeBaglantilari'),
('015_FINANCE_ACCOUNTING_CHAIN','T','CariDefterHareketleri'),('015_FINANCE_ACCOUNTING_CHAIN','T','MuhasebeFisSatirlari'),('015_FINANCE_ACCOUNTING_CHAIN','T','MuhasebeFisleri'),('015_FINANCE_ACCOUNTING_CHAIN','T','MuhasebeHesaplari'),('015_FINANCE_ACCOUNTING_CHAIN','T','Tahsilatlar'),
('016_MRP_PURCHASE_DEMAND_CHAIN','T','MRPMalzemeIhtiyaclari'),('016_MRP_PURCHASE_DEMAND_CHAIN','T','MRPPlanlari'),('016_MRP_PURCHASE_DEMAND_CHAIN','T','SatinAlmaTalepKalemleri'),('016_MRP_PURCHASE_DEMAND_CHAIN','T','SatinAlmaTalepleri'),('016_MRP_PURCHASE_DEMAND_CHAIN','T','UretimTalepleri'),
('017_PROCUREMENT_RECEIPT_CHAIN','T','MalKabulFisleri'),('017_PROCUREMENT_RECEIPT_CHAIN','T','MalKabulKalemleri'),('017_PROCUREMENT_RECEIPT_CHAIN','T','SatinAlmaSiparisKalemleriV2'),('017_PROCUREMENT_RECEIPT_CHAIN','T','SatinAlmaSiparisleriV2'),('017_PROCUREMENT_RECEIPT_CHAIN','T','TedarikciTeklifKalemleri'),('017_PROCUREMENT_RECEIPT_CHAIN','T','TedarikciTeklifleri'),
('018_QUALITY_RETURN_CHAIN','T','KaliteKontrolFisleri'),('018_QUALITY_RETURN_CHAIN','T','KaliteKontrolKalemleri'),('018_QUALITY_RETURN_CHAIN','T','TedarikciIadeFisleri'),('018_QUALITY_RETURN_CHAIN','T','TedarikciIadeKalemleri'),
('019_PRODUCTION_EXECUTION_CHAIN','T','UretimEmirleriV2'),('019_PRODUCTION_EXECUTION_CHAIN','T','UretimEmriMalzemeleri'),('019_PRODUCTION_EXECUTION_CHAIN','T','UretimGerceklesmeleriV2'),('019_PRODUCTION_EXECUTION_CHAIN','T','UretimMalzemeRezervasyonlari'),
('020_COSTING_VALUATION_CHAIN','T','StokDegerlemeFisleri'),('020_COSTING_VALUATION_CHAIN','T','StokDegerlemeKalemleri'),('020_COSTING_VALUATION_CHAIN','T','UretimMaliyetFisleri'),('020_COSTING_VALUATION_CHAIN','T','UretimMaliyetKalemleri'),('020_COSTING_VALUATION_CHAIN','T','UrunMaliyetleri'),
('021_BUDGET_CASH_FORECAST_CHAIN','T','ButceKalemleri'),('021_BUDGET_CASH_FORECAST_CHAIN','T','ButceSenaryolari'),('021_BUDGET_CASH_FORECAST_CHAIN','T','NakitTahminKalemleri'),('021_BUDGET_CASH_FORECAST_CHAIN','T','NakitTahminManuelKalemleri'),('021_BUDGET_CASH_FORECAST_CHAIN','T','NakitTahminleri'),
('022_FIXED_ASSET_CHAIN','T','AmortismanPlanlari'),('022_FIXED_ASSET_CHAIN','T','SabitKiymetDegerHareketleri'),('022_FIXED_ASSET_CHAIN','T','SabitKiymetEldenCikarmalari'),('022_FIXED_ASSET_CHAIN','T','SabitKiymetKategorileri'),('022_FIXED_ASSET_CHAIN','T','SabitKiymetZimmetleri'),('022_FIXED_ASSET_CHAIN','T','SabitKiymetler'),
('023_CRM_SALES_PIPELINE','T','CrmAdayMusteriler'),('023_CRM_SALES_PIPELINE','T','CrmAktiviteler'),('023_CRM_SALES_PIPELINE','T','CrmAsamaGecmisi'),('023_CRM_SALES_PIPELINE','T','CrmAsamalar'),('023_CRM_SALES_PIPELINE','T','CrmFirsatlar'),('023_CRM_SALES_PIPELINE','T','CrmKampanyaAdaylari'),('023_CRM_SALES_PIPELINE','T','CrmKampanyalar'),
('024_HR_WORKFORCE_CHAIN','T','IkAvanslar'),('024_HR_WORKFORCE_CHAIN','T','IkDepartmanlar'),('024_HR_WORKFORCE_CHAIN','T','IkEgitimKatilimlari'),('024_HR_WORKFORCE_CHAIN','T','IkEgitimler'),('024_HR_WORKFORCE_CHAIN','T','IkGorevler'),('024_HR_WORKFORCE_CHAIN','T','IkMesailer'),('024_HR_WORKFORCE_CHAIN','T','IkPerformansDegerlendirmeleri'),('024_HR_WORKFORCE_CHAIN','T','IkPersonelAtamalari'),
('025_SUBCONTRACTING_CHAIN','T','FasonIsEmirleriV2'),('025_SUBCONTRACTING_CHAIN','T','FasonKabulleriV2'),('025_SUBCONTRACTING_CHAIN','T','FasonMalzemeleriV2'),('025_SUBCONTRACTING_CHAIN','T','FasonSevkKalemleriV2'),('025_SUBCONTRACTING_CHAIN','T','FasonSevkleriV2'),
('026_AVAILABLE_STOCK_ATP_CHAIN','T','AtpKontrolleriV2'),('026_AVAILABLE_STOCK_ATP_CHAIN','T','StokPolitikalariV2'),
('027_MARKETPLACE_OMNICHANNEL_CHAIN','T','PazaryeriKanallariV2'),('027_MARKETPLACE_OMNICHANNEL_CHAIN','T','PazaryeriSenkronizasyonlariV2'),('027_MARKETPLACE_OMNICHANNEL_CHAIN','T','PazaryeriSiparisKalemleriV2'),('027_MARKETPLACE_OMNICHANNEL_CHAIN','T','PazaryeriSiparisleriV2'),('027_MARKETPLACE_OMNICHANNEL_CHAIN','T','PazaryeriUrunEslemeleriV2'),
('029_KOLAYBI_YAMANKAYA_CARI_SYNC','T','KolaybiCariEslemeleri'),
('030_KOLAYBI_FULL_MIRROR','T','KolaybiFullSyncRuns'),('030_KOLAYBI_FULL_MIRROR','T','KolaybiRawMirror'),
('031_KOLAYBI_OPERATIONAL_MATERIALIZATION','T','KolaybiFaturaEslemeleri'),('031_KOLAYBI_OPERATIONAL_MATERIALIZATION','T','KolaybiUrunEslemeleri'),
('032_KOLAYBI_EVERYTHING_CENTER','T','KolaybiOperationalRecords'),
('033_KOLAYBI_BUSINESS_MATERIALIZATION','T','FinansHareket'),('033_KOLAYBI_BUSINESS_MATERIALIZATION','T','KasaBanka'),('033_KOLAYBI_BUSINESS_MATERIALIZATION','T','KolaybiBusinessMappings'),
('035_KOLAYBI_RELATION_RECONCILIATION','T','KolaybiLinkRuns'),
('037_DETAIL_CASHFLOW_ENHANCEMENT','T','PersonelCariAtamalari'),('037_DETAIL_CASHFLOW_ENHANCEMENT','T','TekrarlayanNakitAkisi'),
('041_FIX_MISSING_COMPANY_ISOLATION_PREDICATE','F','fn_CompanyIsolationPredicate'),
('044_COMPANY_ISOLATION_RECONCILIATION','F','fn_CompanyIsolationPredicate');

SELECT
    m.Migration,
    COUNT(*) AS ToplamImza,
    SUM(CASE WHEN m.MarkerType='T' AND OBJECT_ID(N'dbo.'+m.MarkerName,N'U') IS NOT NULL THEN 1
             WHEN m.MarkerType='F' AND OBJECT_ID(N'dbo.'+m.MarkerName,N'IF') IS NOT NULL THEN 1
             ELSE 0 END) AS BulunanImza,
    CASE
        WHEN SUM(CASE WHEN m.MarkerType='T' AND OBJECT_ID(N'dbo.'+m.MarkerName,N'U') IS NOT NULL THEN 1
                      WHEN m.MarkerType='F' AND OBJECT_ID(N'dbo.'+m.MarkerName,N'IF') IS NOT NULL THEN 1
                      ELSE 0 END) = COUNT(*) THEN N'✔ ÇALIŞMIŞ'
        WHEN SUM(CASE WHEN m.MarkerType='T' AND OBJECT_ID(N'dbo.'+m.MarkerName,N'U') IS NOT NULL THEN 1
                      WHEN m.MarkerType='F' AND OBJECT_ID(N'dbo.'+m.MarkerName,N'IF') IS NOT NULL THEN 1
                      ELSE 0 END) = 0 THEN N'✘ HİÇ ÇALIŞMAMIŞ'
        ELSE N'⚠ KISMEN ÇALIŞMIŞ (bazı nesneler eksik)'
    END AS Durum,
    STRING_AGG(CASE WHEN (m.MarkerType='T' AND OBJECT_ID(N'dbo.'+m.MarkerName,N'U') IS NULL)
                      OR (m.MarkerType='F' AND OBJECT_ID(N'dbo.'+m.MarkerName,N'IF') IS NULL)
                    THEN m.MarkerName END, N', ') AS EksikNesneler
FROM @Markers m
GROUP BY m.Migration
ORDER BY
    CASE WHEN SUM(CASE WHEN m.MarkerType='T' AND OBJECT_ID(N'dbo.'+m.MarkerName,N'U') IS NOT NULL THEN 1
                       WHEN m.MarkerType='F' AND OBJECT_ID(N'dbo.'+m.MarkerName,N'IF') IS NOT NULL THEN 1
                       ELSE 0 END) = COUNT(*) THEN 1 ELSE 0 END,
    m.Migration;

-- Bu yöntemle doğrulanamayan (yalnızca ALTER/veri/RLS-politika içeren) dosyalar:
SELECT N'003_platform_company, 004_company_scoped_keys, 005_company_isolation_hardening, 007_BOM_STAGING_TO_RECETES, 008_BOM_IMPORT_AUDIT, 009_kolaybi_ayarlar_isactive, 028_KOLAYBI_YAMANKAYA_LIVE, 034_KOLAYBI_CARI_MOVEMENTS, 036_KOLAYBI_LINK_UNIQUE_HARDENING, 038_FATURA_SCHEMA_COMPATIBILITY, 039_KOLAYBI_E_DOCUMENT, 040_KOLAYBI_COMPANY2_LIVE, 042_COMPANY_PROFILES, 043_REMOVE_COMPANY_DEFAULT_UNIT, 045_PAZARYERI_SIPARIS_LINK, 046_IK_AVANS_MUHASEBE' AS KontrolEdilemeyenDosyalar_ElleBakilmali;
