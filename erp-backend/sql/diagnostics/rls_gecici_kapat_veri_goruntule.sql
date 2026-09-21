-- ADIM 1: TÜM aktif security policy'leri kapat (isim hardcode etmeden)
DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql = @sql + N'ALTER SECURITY POLICY ' + QUOTENAME(SCHEMA_NAME(schema_id)) + N'.' + QUOTENAME(name) + N' WITH (STATE=OFF);' + CHAR(13)
FROM sys.security_policies WHERE is_enabled = 1;
PRINT @sql;
EXEC sys.sp_executesql @sql;
GO

-- ADIM 2: Gerçek veriyi gör (artık hiçbir RLS filtresi yok)
SELECT
    'UserCompanies' AS Kaynak, uc.KullaniciId, uc.CompanyId, s.CompanyName, uc.IsActive, uc.IsDefault
FROM dbo.UserCompanies uc
LEFT JOIN dbo.Sirketler s ON s.CompanyId=uc.CompanyId
WHERE uc.KullaniciId=1
UNION ALL
SELECT
    'UserRoles', ur.KullaniciId, ur.CompanyId, s.CompanyName, NULL, NULL
FROM dbo.UserRoles ur
LEFT JOIN dbo.Sirketler s ON s.CompanyId=ur.CompanyId
WHERE ur.KullaniciId=1
ORDER BY Kaynak, CompanyId;
GO

-- ADIM 3: TÜM policy'leri tekrar aç (koşulsuz, ayrı batch)
DECLARE @sql2 NVARCHAR(MAX) = N'';
SELECT @sql2 = @sql2 + N'ALTER SECURITY POLICY ' + QUOTENAME(SCHEMA_NAME(schema_id)) + N'.' + QUOTENAME(name) + N' WITH (STATE=ON);' + CHAR(13)
FROM sys.security_policies WHERE is_enabled = 0;
PRINT @sql2;
EXEC sys.sp_executesql @sql2;
GO

-- ADIM 4: Doğrulama - kaç policy var, hepsi açık mı?
SELECT name, is_enabled FROM sys.security_policies ORDER BY name;
GO
