DECLARE @PolicyWasOn BIT = 0;
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name=N'SecurityPolicy_CompanyIsolation' AND is_enabled=1) SET @PolicyWasOn=1;

BEGIN TRY
    IF @PolicyWasOn=1 ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation WITH (STATE=OFF);

    SELECT
        k.KullaniciId,
        k.KullaniciAdi,
        s.CompanyId,
        s.CompanyName,
        uc.IsActive AS UserCompanies_Aktif,
        uc.IsDefault,
        r.RoleCode,
        r.RoleName,
        ur.RoleId AS UserRoles_RoleId
    FROM dbo.Kullanicilar k
    CROSS JOIN dbo.Sirketler s
    LEFT JOIN dbo.UserCompanies uc ON uc.KullaniciId=k.KullaniciId AND uc.CompanyId=s.CompanyId
    LEFT JOIN dbo.UserRoles ur ON ur.KullaniciId=k.KullaniciId AND ur.CompanyId=s.CompanyId
    LEFT JOIN dbo.Roles r ON r.RoleId=ur.RoleId
    WHERE k.IsActive=1
    ORDER BY k.KullaniciAdi, s.CompanyId;

    SELECT RoleId, RoleCode, RoleName, IsActive FROM dbo.Roles ORDER BY RoleId;

    IF @PolicyWasOn=1 ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation WITH (STATE=ON);
END TRY
BEGIN CATCH
    IF @PolicyWasOn=1 AND EXISTS(SELECT 1 FROM sys.security_policies WHERE name=N'SecurityPolicy_CompanyIsolation' AND is_enabled=0)
        ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation WITH (STATE=ON);
    THROW;
END CATCH
