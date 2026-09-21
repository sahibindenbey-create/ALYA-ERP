DECLARE @PolicyWasOn BIT = 0;
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name=N'SecurityPolicy_CompanyIsolation' AND is_enabled=1) SET @PolicyWasOn=1;

BEGIN TRY
    IF @PolicyWasOn=1 ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation WITH (STATE=OFF);

    PRINT N'--- 1) Eski sistem: PlatformSiparisler ---';
    SELECT CompanyId, Platform, ShipmentPackageId, OrderNumber, Status, PackageLastModifiedDate
    FROM dbo.PlatformSiparisler
    WHERE OrderNumber = N'11620676184' OR ShipmentPackageId = N'11620676184';

    PRINT N'--- 2) Yeni sistem: PazaryeriSiparisleriV2 ---';
    SELECT PazaryeriSiparisId, CompanyId, KanalId, HariciSiparisNo, MusteriAdi, GenelToplam, ErpDurumu, SiparisId, CreatedAt
    FROM dbo.PazaryeriSiparisleriV2
    WHERE HariciSiparisNo = N'11620676184';

    PRINT N'--- 3) Yeni sistem kalemleri: PazaryeriSiparisKalemleriV2 ---';
    SELECT x.CompanyId, x.PazaryeriSiparisId, x.HariciSku, x.UrunId, x.UrunAdi, x.Miktar, x.EslemeDurumu
    FROM dbo.PazaryeriSiparisKalemleriV2 x
    INNER JOIN dbo.PazaryeriSiparisleriV2 h ON h.CompanyId=x.CompanyId AND h.PazaryeriSiparisId=x.PazaryeriSiparisId
    WHERE h.HariciSiparisNo = N'11620676184';

    PRINT N'--- 4) Gerçek Satış Siparişi (eğer dönüştüyse): Siparisler ---';
    SELECT SiparisId, CompanyId, SiparisKodu, SiparisTipi, SiparisVeren, CariKodu, CariAdi, ToplamTutar, Durum
    FROM dbo.Siparisler
    WHERE SiparisKodu LIKE N'%11620676184%' OR SiparisVeren IN (N'Trendyol', N'TRENDYOL');

    IF @PolicyWasOn=1 ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation WITH (STATE=ON);
END TRY
BEGIN CATCH
    IF @PolicyWasOn=1 AND EXISTS(SELECT 1 FROM sys.security_policies WHERE name=N'SecurityPolicy_CompanyIsolation' AND is_enabled=0)
        ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation WITH (STATE=ON);
    THROW;
END CATCH
