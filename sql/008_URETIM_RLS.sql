/* =========================================================
   008 - ÜRETİM EMİRLERİ ŞİRKET İZOLASYONU
   UretimEmirleri kayıtlarının seçili şirket dışına sızmasını engeller.
   Ön koşul: 002/003 migration'ları ile dbo.SecurityPolicy_CompanyIsolation
   ve dbo.fn_CompanyIsolationPredicate mevcut olmalıdır.
   ========================================================= */

IF OBJECT_ID(N'dbo.UretimEmirleri', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.UretimEmirleri', N'CompanyId') IS NOT NULL
   AND OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation', N'SP') IS NOT NULL
   AND OBJECT_ID(N'dbo.fn_CompanyIsolationPredicate', N'IF') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM sys.security_predicates sp
        WHERE sp.target_object_id = OBJECT_ID(N'dbo.UretimEmirleri')
          AND sp.predicate_type = 1
    )
    BEGIN
        ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
            ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
            ON dbo.UretimEmirleri;
    END;

    IF NOT EXISTS (
        SELECT 1
        FROM sys.security_predicates sp
        WHERE sp.target_object_id = OBJECT_ID(N'dbo.UretimEmirleri')
          AND sp.predicate_type = 2
          AND sp.operation = 4
    )
    BEGIN
        ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
            ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
            ON dbo.UretimEmirleri AFTER INSERT;
    END;

    IF NOT EXISTS (
        SELECT 1
        FROM sys.security_predicates sp
        WHERE sp.target_object_id = OBJECT_ID(N'dbo.UretimEmirleri')
          AND sp.predicate_type = 2
          AND sp.operation = 1
    )
    BEGIN
        ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
            ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
            ON dbo.UretimEmirleri AFTER UPDATE;
    END;
END;
GO
