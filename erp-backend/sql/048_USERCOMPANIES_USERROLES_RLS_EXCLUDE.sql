/* ============================================================================
   ALYA ERP - 048 / USERCOMPANIES VE USERROLES RLS KAPSAMINDAN CIKARILIYOR
   ============================================================================
   AMAC: 044_COMPANY_ISOLATION_RECONCILIATION.sql, UserCompanies ve
   UserRoles'a RLS ekledi (RLS_Reconciled_044_UserCompanies/UserRoles).
   Niyet iyiydi ama YANLIS bir karardi:

   Bu iki tablo "kullanici hangi sirketlere/rollere sahip" bilgisini tutar.
   /api/core/companies endpoint'i "bu kullaniciya atanmis TUM sirketleri
   listele" sorusu sorar - ama company-context-hook.js HER sorguya otomatik
   olarak O AN SECILI OLAN X-Company-Id'yi enjekte eder. RLS aktifken bu,
   "tum sirketlerini listele" sorgusunu bile SADECE su an secili olan tek
   sirkete filtreliyordu - kullanici baska sirkete hic gecemiyordu (kisir
   dongu: sadece zaten secili olan sirketi görebiliyordu).

   core/security.js'teki loadSecurityContext() ve core/coreRoutes.js'teki
   /companies sorgusu zaten KullaniciId (ve gerekliyse CompanyId) ile
   ACIKCA filtreleniyor - tablo seviyesinde RLS burada hicbir ek guvenlik
   saglamiyor, sadece bu zararli yan etkiyi yaratiyordu.

   Bu iki tablo artik Sirketler ile ayni mantikla RLS disinda tutuluyor.

   Idempotent - defalarca calistirilabilir.
   ============================================================================ */
SET NOCOUNT ON;

IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = N'RLS_Reconciled_044_UserCompanies')
BEGIN
    DROP SECURITY POLICY dbo.RLS_Reconciled_044_UserCompanies;
    PRINT N'RLS_Reconciled_044_UserCompanies kaldırıldı.';
END
ELSE
    PRINT N'RLS_Reconciled_044_UserCompanies zaten yok.';

IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = N'RLS_Reconciled_044_UserRoles')
BEGIN
    DROP SECURITY POLICY dbo.RLS_Reconciled_044_UserRoles;
    PRINT N'RLS_Reconciled_044_UserRoles kaldırıldı.';
END
ELSE
    PRINT N'RLS_Reconciled_044_UserRoles zaten yok.';
GO

-- Doğrulama: UserCompanies ve UserRoles artık hiçbir filter predicate'e
-- sahip olmamalı (aşağıdaki sorgu 0 satır dönmeli).
SELECT OBJECT_NAME(p.target_object_id) AS Tablo, sp.name AS Policy
FROM sys.security_predicates p
INNER JOIN sys.security_policies sp ON sp.object_id = p.object_id
WHERE p.target_object_id IN (OBJECT_ID(N'dbo.UserCompanies'), OBJECT_ID(N'dbo.UserRoles'));

PRINT N'048 tamamlandı.';
