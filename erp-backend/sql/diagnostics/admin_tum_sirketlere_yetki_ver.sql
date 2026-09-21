-- ADIM 1: RLS'i kapat (kendi batch'i)
ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation WITH (STATE=OFF);
GO

-- ADIM 2: Asıl işi yap (ayrı, temiz batch)
DECLARE @AdminUserId INT = 1;
DECLARE @AdminRoleId INT = 1;
DECLARE @CompanyId INT, @IsFirst BIT;

DECLARE c CURSOR LOCAL FAST_FORWARD FOR
    SELECT CompanyId, CASE WHEN ROW_NUMBER() OVER (ORDER BY CompanyId)=1 THEN 1 ELSE 0 END
    FROM dbo.Sirketler;
OPEN c;
FETCH NEXT FROM c INTO @CompanyId, @IsFirst;
WHILE @@FETCH_STATUS = 0
BEGIN
    PRINT N'İşleniyor: CompanyId=' + CAST(@CompanyId AS NVARCHAR(10));

    IF EXISTS (SELECT 1 FROM dbo.UserCompanies WHERE KullaniciId=@AdminUserId AND CompanyId=@CompanyId)
    BEGIN
        PRINT N'  UserCompanies: mevcut satır bulundu, güncelleniyor.';
        UPDATE dbo.UserCompanies SET IsActive=1 WHERE KullaniciId=@AdminUserId AND CompanyId=@CompanyId;
    END
    ELSE
    BEGIN
        PRINT N'  UserCompanies: satır bulunamadı, ekleniyor.';
        INSERT INTO dbo.UserCompanies (KullaniciId, CompanyId, IsActive, IsDefault)
        VALUES (@AdminUserId, @CompanyId, 1, @IsFirst);
    END;

    IF EXISTS (SELECT 1 FROM dbo.UserRoles WHERE KullaniciId=@AdminUserId AND CompanyId=@CompanyId)
    BEGIN
        PRINT N'  UserRoles: mevcut satır bulundu, güncelleniyor.';
        UPDATE dbo.UserRoles SET RoleId=@AdminRoleId WHERE KullaniciId=@AdminUserId AND CompanyId=@CompanyId;
    END
    ELSE
    BEGIN
        PRINT N'  UserRoles: satır bulunamadı, ekleniyor.';
        INSERT INTO dbo.UserRoles (KullaniciId, CompanyId, RoleId)
        VALUES (@AdminUserId, @CompanyId, @AdminRoleId);
    END;

    FETCH NEXT FROM c INTO @CompanyId, @IsFirst;
END;
CLOSE c; DEALLOCATE c;

PRINT N'Tamamlandı.';
GO

-- ADIM 3: RLS'i mutlaka geri aç (kendi batch'i, koşulsuz)
ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation WITH (STATE=ON);
GO

-- ADIM 4: Doğrulama
SELECT
    sp.name AS SecurityPolicy, sp.is_enabled
FROM sys.security_policies sp WHERE sp.name=N'SecurityPolicy_CompanyIsolation';
GO

ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation WITH (STATE=OFF);
GO
SELECT s.CompanyId, s.CompanyName, uc.IsActive, uc.IsDefault, r.RoleCode
FROM dbo.Sirketler s
LEFT JOIN dbo.UserCompanies uc ON uc.CompanyId=s.CompanyId AND uc.KullaniciId=1
LEFT JOIN dbo.UserRoles ur ON ur.CompanyId=s.CompanyId AND ur.KullaniciId=1
LEFT JOIN dbo.Roles r ON r.RoleId=ur.RoleId
ORDER BY s.CompanyId;
GO
ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation WITH (STATE=ON);
GO
