/* ALYA ERP - 012 / Eksik Fatura + Irsaliye tablolari
   Amaç: Mevcut ERP backend'inin kullandığı ancak bazı veritabanlarında
   bulunmayan dbo.Faturalar / FaturaDetay / Irsaliyeler / IrsaliyeDetay
   tablolarını idempotent olarak oluşturmak.

   Not: Mevcut tablolar varsa hiçbir şekilde değiştirilmez.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRAN;

    IF OBJECT_ID(N'dbo.Sirketler', N'U') IS NULL
        THROW 51201, N'dbo.Sirketler bulunamadı. Önce çoklu şirket migration''ını çalıştırın.', 1;

    /* ---------------------------------------------------------
       FATURALAR
       --------------------------------------------------------- */
    IF OBJECT_ID(N'dbo.Faturalar', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.Faturalar
        (
            FaturaId       INT IDENTITY(1,1) NOT NULL
                CONSTRAINT PK_Faturalar PRIMARY KEY,
            CompanyId      INT NOT NULL
                CONSTRAINT DF_Faturalar_CompanyId DEFAULT (ISNULL(TRY_CONVERT(INT, SESSION_CONTEXT(N'CompanyId')), 1)),
            FaturaKodu     NVARCHAR(100) NOT NULL,
            Yon            NVARCHAR(50) NOT NULL,
            FaturaTarihi   DATETIME2 NULL,
            VadeTarihi     DATETIME2 NULL,
            CariKodu       NVARCHAR(100) NULL,
            CariAdi        NVARCHAR(250) NULL,
            SiparisId      INT NULL,
            IrsaliyeId     INT NULL,
            OdemeSekli     NVARCHAR(100) NULL,
            AraToplam      DECIMAL(18,2) NOT NULL CONSTRAINT DF_Faturalar_AraToplam DEFAULT (0),
            KdvToplam      DECIMAL(18,2) NOT NULL CONSTRAINT DF_Faturalar_KdvToplam DEFAULT (0),
            GenelToplam    DECIMAL(18,2) NOT NULL CONSTRAINT DF_Faturalar_GenelToplam DEFAULT (0),
            Durum          NVARCHAR(50) NOT NULL CONSTRAINT DF_Faturalar_Durum DEFAULT (N'Bekliyor'),
            IsActive       BIT NOT NULL CONSTRAINT DF_Faturalar_IsActive DEFAULT (1),
            CreatedAt      DATETIME2 NOT NULL CONSTRAINT DF_Faturalar_CreatedAt DEFAULT (SYSDATETIME()),
            UpdatedAt      DATETIME2 NOT NULL CONSTRAINT DF_Faturalar_UpdatedAt DEFAULT (SYSDATETIME()),
            CONSTRAINT FK_Faturalar_Sirket FOREIGN KEY (CompanyId) REFERENCES dbo.Sirketler(CompanyId)
        );

        CREATE INDEX IX_Faturalar_CompanyId
            ON dbo.Faturalar(CompanyId, IsActive, FaturaId DESC);

        CREATE INDEX IX_Faturalar_Company_Kodu
            ON dbo.Faturalar(CompanyId, FaturaKodu);

        PRINT N'dbo.Faturalar oluşturuldu.';
    END;

    /* ---------------------------------------------------------
       FATURA DETAY
       --------------------------------------------------------- */
    IF OBJECT_ID(N'dbo.FaturaDetay', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.FaturaDetay
        (
            FaturaDetayId INT IDENTITY(1,1) NOT NULL
                CONSTRAINT PK_FaturaDetay PRIMARY KEY,
            CompanyId     INT NOT NULL
                CONSTRAINT DF_FaturaDetay_CompanyId DEFAULT (ISNULL(TRY_CONVERT(INT, SESSION_CONTEXT(N'CompanyId')), 1)),
            FaturaId      INT NOT NULL,
            UrunKodu      NVARCHAR(100) NULL,
            UrunAdi       NVARCHAR(250) NULL,
            Miktar        DECIMAL(18,2) NOT NULL CONSTRAINT DF_FaturaDetay_Miktar DEFAULT (0),
            Birim         NVARCHAR(50) NULL,
            BirimFiyat    DECIMAL(18,2) NOT NULL CONSTRAINT DF_FaturaDetay_BirimFiyat DEFAULT (0),
            KdvOrani      DECIMAL(9,2) NOT NULL CONSTRAINT DF_FaturaDetay_KdvOrani DEFAULT (0),
            KdvTutari     DECIMAL(18,2) NOT NULL CONSTRAINT DF_FaturaDetay_KdvTutari DEFAULT (0),
            SatirToplam   DECIMAL(18,2) NOT NULL CONSTRAINT DF_FaturaDetay_SatirToplam DEFAULT (0),
            CreatedAt     DATETIME2 NOT NULL CONSTRAINT DF_FaturaDetay_CreatedAt DEFAULT (SYSDATETIME()),
            CONSTRAINT FK_FaturaDetay_Sirket FOREIGN KEY (CompanyId) REFERENCES dbo.Sirketler(CompanyId),
            CONSTRAINT FK_FaturaDetay_Fatura FOREIGN KEY (FaturaId) REFERENCES dbo.Faturalar(FaturaId) ON DELETE CASCADE
        );

        CREATE INDEX IX_FaturaDetay_CompanyId
            ON dbo.FaturaDetay(CompanyId, FaturaId);

        PRINT N'dbo.FaturaDetay oluşturuldu.';
    END;

    /* ---------------------------------------------------------
       IRSALIYELER
       --------------------------------------------------------- */
    IF OBJECT_ID(N'dbo.Irsaliyeler', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.Irsaliyeler
        (
            IrsaliyeId       INT IDENTITY(1,1) NOT NULL
                CONSTRAINT PK_Irsaliyeler PRIMARY KEY,
            CompanyId        INT NOT NULL
                CONSTRAINT DF_Irsaliyeler_CompanyId DEFAULT (ISNULL(TRY_CONVERT(INT, SESSION_CONTEXT(N'CompanyId')), 1)),
            IrsaliyeKodu     NVARCHAR(100) NOT NULL,
            Yon              NVARCHAR(50) NOT NULL,
            IrsaliyeTarihi   DATETIME2 NULL,
            CariKodu         NVARCHAR(100) NULL,
            CariAdi          NVARCHAR(250) NULL,
            SiparisId        INT NULL,
            TeslimatAdresi   NVARCHAR(1000) NULL,
            Notlar           NVARCHAR(2000) NULL,
            ToplamTutar      DECIMAL(18,2) NOT NULL CONSTRAINT DF_Irsaliyeler_ToplamTutar DEFAULT (0),
            IsActive         BIT NOT NULL CONSTRAINT DF_Irsaliyeler_IsActive DEFAULT (1),
            CreatedAt        DATETIME2 NOT NULL CONSTRAINT DF_Irsaliyeler_CreatedAt DEFAULT (SYSDATETIME()),
            UpdatedAt        DATETIME2 NOT NULL CONSTRAINT DF_Irsaliyeler_UpdatedAt DEFAULT (SYSDATETIME()),
            CONSTRAINT FK_Irsaliyeler_Sirket FOREIGN KEY (CompanyId) REFERENCES dbo.Sirketler(CompanyId)
        );

        CREATE INDEX IX_Irsaliyeler_CompanyId
            ON dbo.Irsaliyeler(CompanyId, IsActive, IrsaliyeId DESC);

        CREATE INDEX IX_Irsaliyeler_Company_Kodu
            ON dbo.Irsaliyeler(CompanyId, IrsaliyeKodu);

        PRINT N'dbo.Irsaliyeler oluşturuldu.';
    END;

    /* ---------------------------------------------------------
       IRSALIYE DETAY
       --------------------------------------------------------- */
    IF OBJECT_ID(N'dbo.IrsaliyeDetay', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.IrsaliyeDetay
        (
            IrsaliyeDetayId INT IDENTITY(1,1) NOT NULL
                CONSTRAINT PK_IrsaliyeDetay PRIMARY KEY,
            CompanyId       INT NOT NULL
                CONSTRAINT DF_IrsaliyeDetay_CompanyId DEFAULT (ISNULL(TRY_CONVERT(INT, SESSION_CONTEXT(N'CompanyId')), 1)),
            IrsaliyeId      INT NOT NULL,
            UrunKodu        NVARCHAR(100) NULL,
            UrunAdi         NVARCHAR(250) NULL,
            Miktar          DECIMAL(18,2) NOT NULL CONSTRAINT DF_IrsaliyeDetay_Miktar DEFAULT (0),
            Birim           NVARCHAR(50) NULL,
            BirimFiyat      DECIMAL(18,2) NOT NULL CONSTRAINT DF_IrsaliyeDetay_BirimFiyat DEFAULT (0),
            SatirToplam     DECIMAL(18,2) NOT NULL CONSTRAINT DF_IrsaliyeDetay_SatirToplam DEFAULT (0),
            CreatedAt       DATETIME2 NOT NULL CONSTRAINT DF_IrsaliyeDetay_CreatedAt DEFAULT (SYSDATETIME()),
            CONSTRAINT FK_IrsaliyeDetay_Sirket FOREIGN KEY (CompanyId) REFERENCES dbo.Sirketler(CompanyId),
            CONSTRAINT FK_IrsaliyeDetay_Irsaliye FOREIGN KEY (IrsaliyeId) REFERENCES dbo.Irsaliyeler(IrsaliyeId) ON DELETE CASCADE
        );

        CREATE INDEX IX_IrsaliyeDetay_CompanyId
            ON dbo.IrsaliyeDetay(CompanyId, IrsaliyeId);

        PRINT N'dbo.IrsaliyeDetay oluşturuldu.';
    END;

    /* ---------------------------------------------------------
       Mevcut CompanyIsolation policy varsa yeni tabloları da ekle.
       Policy yoksa 003 migration'ı oluşturmalıdır; burada varsayım
       yapıp ikinci bir policy oluşturmuyoruz.
       --------------------------------------------------------- */
    IF EXISTS
    (
        SELECT 1
        FROM sys.security_policies
        WHERE object_id = OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
    )
    BEGIN
        IF NOT EXISTS
        (
            SELECT 1 FROM sys.security_predicates p
            WHERE p.object_id = OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
              AND p.target_object_id = OBJECT_ID(N'dbo.Faturalar')
        )
        BEGIN
            ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
                ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
                ON dbo.Faturalar;
            ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
                ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
                ON dbo.Faturalar AFTER INSERT;
            ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
                ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
                ON dbo.Faturalar AFTER UPDATE;
        END;

        IF NOT EXISTS
        (
            SELECT 1 FROM sys.security_predicates p
            WHERE p.object_id = OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
              AND p.target_object_id = OBJECT_ID(N'dbo.FaturaDetay')
        )
        BEGIN
            ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
                ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
                ON dbo.FaturaDetay;
            ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
                ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
                ON dbo.FaturaDetay AFTER INSERT;
            ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
                ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
                ON dbo.FaturaDetay AFTER UPDATE;
        END;

        IF NOT EXISTS
        (
            SELECT 1 FROM sys.security_predicates p
            WHERE p.object_id = OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
              AND p.target_object_id = OBJECT_ID(N'dbo.Irsaliyeler')
        )
        BEGIN
            ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
                ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
                ON dbo.Irsaliyeler;
            ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
                ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
                ON dbo.Irsaliyeler AFTER INSERT;
            ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
                ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
                ON dbo.Irsaliyeler AFTER UPDATE;
        END;

        IF NOT EXISTS
        (
            SELECT 1 FROM sys.security_predicates p
            WHERE p.object_id = OBJECT_ID(N'dbo.SecurityPolicy_CompanyIsolation')
              AND p.target_object_id = OBJECT_ID(N'dbo.IrsaliyeDetay')
        )
        BEGIN
            ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
                ADD FILTER PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
                ON dbo.IrsaliyeDetay;
            ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
                ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
                ON dbo.IrsaliyeDetay AFTER INSERT;
            ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation
                ADD BLOCK PREDICATE dbo.fn_CompanyIsolationPredicate(CompanyId)
                ON dbo.IrsaliyeDetay AFTER UPDATE;
        END;

        ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation WITH (STATE = ON);
    END;

    COMMIT;

    SELECT
        t.name AS TableName,
        CASE WHEN t.name IN (N'Faturalar',N'FaturaDetay',N'Irsaliyeler',N'IrsaliyeDetay') THEN 1 ELSE 0 END AS Ready
    FROM sys.tables t
    WHERE t.name IN (N'Faturalar',N'FaturaDetay',N'Irsaliyeler',N'IrsaliyeDetay')
    ORDER BY t.name;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH;
