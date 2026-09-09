/* ALYA ERP - Çoklu Şirket + KolayBi altyapısı
   Güvenli, tekrar çalıştırılabilir migration.

   Not: 003/005 gibi RLS migration'ları daha önce çalıştırılmışsa
   KolaybiAyarlar üzerindeki BLOCK predicate, bu migration'ın şirket
   başlangıç kayıtlarını oluşturmasını engelleyebilir. Veri taşıma/seed
   adımında ilgili policy geçici olarak kapatılır ve hata durumunda da
   tekrar açılır.
*/

IF OBJECT_ID('dbo.Sirketler','U') IS NULL
BEGIN
  CREATE TABLE dbo.Sirketler (
    CompanyId INT NOT NULL PRIMARY KEY,
    CompanyName NVARCHAR(200) NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_Sirketler_IsActive DEFAULT 1,
    CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_Sirketler_CreatedDate DEFAULT SYSDATETIME()
  );
END;

MERGE dbo.Sirketler AS hedef
USING (VALUES
  (1, N'ALYA HOMES DAYANIKLI TÜKETİM MALLARI SAN. VE TİC. LTD. ŞTİ.'),
  (2, N'YAMANKAYA GRUP YAPI İNŞAAT SANAYİ VE TİCARET LİMİTED ŞİRKETİ'),
  (3, N'MONO İÇ VE DIŞ TİCARET LİMİTED ŞİRKETİ')
) AS kaynak(CompanyId, CompanyName)
ON hedef.CompanyId = kaynak.CompanyId
WHEN MATCHED THEN UPDATE SET CompanyName = kaynak.CompanyName, IsActive = 1
WHEN NOT MATCHED THEN INSERT (CompanyId, CompanyName) VALUES (kaynak.CompanyId, kaynak.CompanyName);

IF OBJECT_ID('dbo.KolaybiAyarlar','U') IS NULL
BEGIN
  CREATE TABLE dbo.KolaybiAyarlar (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CompanyId INT NOT NULL,
    ApiKey NVARCHAR(500) NULL,
    Channel NVARCHAR(200) NULL,
    BaseUrl NVARCHAR(500) NOT NULL CONSTRAINT DF_KolaybiAyarlar_BaseUrl DEFAULT 'https://ofis-api.kolaybi.com',
    AccessToken NVARCHAR(MAX) NULL,
    TokenGecerlilik DATETIME2 NULL,
    KolaybiCompanyId NVARCHAR(100) NULL,
    SonSenkronTarihi DATETIME2 NULL,
    SonSenkronDurumu NVARCHAR(30) NULL,
    SonSenkronMesaji NVARCHAR(1000) NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_KolaybiAyarlar_IsActive DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_KolaybiAyarlar_CreatedAt DEFAULT SYSDATETIME(),
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_KolaybiAyarlar_UpdatedAt DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_KolaybiAyarlar_Company UNIQUE (CompanyId),
    CONSTRAINT FK_KolaybiAyarlar_Sirket FOREIGN KEY (CompanyId) REFERENCES dbo.Sirketler(CompanyId)
  );
END
ELSE
BEGIN
  IF COL_LENGTH('dbo.KolaybiAyarlar','CompanyId') IS NULL
    ALTER TABLE dbo.KolaybiAyarlar ADD CompanyId INT NULL;
  IF COL_LENGTH('dbo.KolaybiAyarlar','KolaybiCompanyId') IS NULL
    ALTER TABLE dbo.KolaybiAyarlar ADD KolaybiCompanyId NVARCHAR(100) NULL;
  IF COL_LENGTH('dbo.KolaybiAyarlar','SonSenkronDurumu') IS NULL
    ALTER TABLE dbo.KolaybiAyarlar ADD SonSenkronDurumu NVARCHAR(30) NULL;
  IF COL_LENGTH('dbo.KolaybiAyarlar','SonSenkronMesaji') IS NULL
    ALTER TABLE dbo.KolaybiAyarlar ADD SonSenkronMesaji NVARCHAR(1000) NULL;
  IF COL_LENGTH('dbo.KolaybiAyarlar','IsActive') IS NULL
    ALTER TABLE dbo.KolaybiAyarlar ADD IsActive BIT NOT NULL CONSTRAINT DF_KolaybiAyarlar_IsActive DEFAULT 1;
  IF COL_LENGTH('dbo.KolaybiAyarlar','CreatedAt') IS NULL
    ALTER TABLE dbo.KolaybiAyarlar ADD CreatedAt DATETIME2 NULL;
  IF COL_LENGTH('dbo.KolaybiAyarlar','UpdatedAt') IS NULL
    ALTER TABLE dbo.KolaybiAyarlar ADD UpdatedAt DATETIME2 NULL;
END;

/*
   RLS daha önce aktif edilmişse KolaybiAyarlar'a şirket 2/3 seed kayıtları
   eklenirken BLOCK predicate devreye girer. Migration bir admin/schema
   değişikliği olduğundan ilgili policy'leri yalnızca bu seed bölümü boyunca
   kapatıyoruz. Hata olursa CATCH bloğu policy'leri yeniden açar.
*/
IF OBJECT_ID('dbo.KolaybiAyarlar','U') IS NOT NULL
BEGIN
  IF OBJECT_ID('tempdb..#KolaybiPolicies') IS NOT NULL DROP TABLE #KolaybiPolicies;
  CREATE TABLE #KolaybiPolicies (PolicyName SYSNAME NOT NULL PRIMARY KEY);

  INSERT INTO #KolaybiPolicies(PolicyName)
  SELECT DISTINCT sp.name
  FROM sys.security_policies sp
  INNER JOIN sys.security_predicates p ON p.object_id = sp.object_id
  WHERE p.target_object_id = OBJECT_ID('dbo.KolaybiAyarlar');

  DECLARE @PolicyName SYSNAME, @PolicySql NVARCHAR(MAX);
  DECLARE policy_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT PolicyName FROM #KolaybiPolicies;
  OPEN policy_cursor;
  FETCH NEXT FROM policy_cursor INTO @PolicyName;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    SET @PolicySql = N'ALTER SECURITY POLICY dbo.' + QUOTENAME(@PolicyName) + N' WITH (STATE = OFF);';
    EXEC sys.sp_executesql @PolicySql;
    FETCH NEXT FROM policy_cursor INTO @PolicyName;
  END;
  CLOSE policy_cursor;
  DEALLOCATE policy_cursor;
END;

BEGIN TRY
  /* Eski tek hesaplı kaydı Şirket 1'e taşı. */
  IF EXISTS (SELECT 1 FROM dbo.KolaybiAyarlar WHERE CompanyId IS NULL)
  BEGIN
    UPDATE dbo.KolaybiAyarlar SET CompanyId = 1, UpdatedAt = SYSDATETIME() WHERE CompanyId IS NULL;
  END;

  /* Eksik şirket bağlantı kayıtlarını oluştur. API anahtarları boş bırakılır. */
  INSERT INTO dbo.KolaybiAyarlar (CompanyId, BaseUrl)
  SELECT s.CompanyId, 'https://ofis-api.kolaybi.com'
  FROM dbo.Sirketler s
  WHERE NOT EXISTS (SELECT 1 FROM dbo.KolaybiAyarlar k WHERE k.CompanyId = s.CompanyId);

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_KolaybiAyarlar_Company' AND object_id = OBJECT_ID('dbo.KolaybiAyarlar'))
  BEGIN
    CREATE UNIQUE INDEX UQ_KolaybiAyarlar_Company ON dbo.KolaybiAyarlar(CompanyId) WHERE CompanyId IS NOT NULL;
  END;

  /* RLS policy'lerini eski durumuna getir. */
  IF OBJECT_ID('tempdb..#KolaybiPolicies') IS NOT NULL
  BEGIN
    DECLARE policy_cursor_restore CURSOR LOCAL FAST_FORWARD FOR SELECT PolicyName FROM #KolaybiPolicies;
    OPEN policy_cursor_restore;
    FETCH NEXT FROM policy_cursor_restore INTO @PolicyName;
    WHILE @@FETCH_STATUS = 0
    BEGIN
      SET @PolicySql = N'ALTER SECURITY POLICY dbo.' + QUOTENAME(@PolicyName) + N' WITH (STATE = ON);';
      EXEC sys.sp_executesql @PolicySql;
      FETCH NEXT FROM policy_cursor_restore INTO @PolicyName;
    END;
    CLOSE policy_cursor_restore;
    DEALLOCATE policy_cursor_restore;
  END;
END TRY
BEGIN CATCH
  IF OBJECT_ID('tempdb..#KolaybiPolicies') IS NOT NULL
  BEGIN
    IF CURSOR_STATUS('local','policy_cursor_restore') >= -1
    BEGIN
      IF CURSOR_STATUS('local','policy_cursor_restore') >= 0 CLOSE policy_cursor_restore;
      IF CURSOR_STATUS('local','policy_cursor_restore') >= -1 DEALLOCATE policy_cursor_restore;
    END;

    DECLARE policy_cursor_error CURSOR LOCAL FAST_FORWARD FOR SELECT PolicyName FROM #KolaybiPolicies;
    OPEN policy_cursor_error;
    FETCH NEXT FROM policy_cursor_error INTO @PolicyName;
    WHILE @@FETCH_STATUS = 0
    BEGIN
      BEGIN TRY
        SET @PolicySql = N'ALTER SECURITY POLICY dbo.' + QUOTENAME(@PolicyName) + N' WITH (STATE = ON);';
        EXEC sys.sp_executesql @PolicySql;
      END TRY
      BEGIN CATCH
        PRINT N'RLS policy yeniden etkinleştirilemedi: ' + @PolicyName + N' - ' + ERROR_MESSAGE();
      END CATCH;
      FETCH NEXT FROM policy_cursor_error INTO @PolicyName;
    END;
    CLOSE policy_cursor_error;
    DEALLOCATE policy_cursor_error;
  END;
  THROW;
END CATCH;

IF OBJECT_ID('tempdb..#KolaybiPolicies') IS NOT NULL DROP TABLE #KolaybiPolicies;

IF OBJECT_ID('dbo.KolaybiSyncKayitlari','U') IS NULL
BEGIN
  CREATE TABLE dbo.KolaybiSyncKayitlari (
    SyncId BIGINT IDENTITY(1,1) PRIMARY KEY,
    CompanyId INT NOT NULL,
    EntityType NVARCHAR(50) NOT NULL,
    ExternalId NVARCHAR(100) NOT NULL,
    ExternalUpdatedAt DATETIME2 NULL,
    Payload NVARCHAR(MAX) NOT NULL,
    SyncedAt DATETIME2 NOT NULL CONSTRAINT DF_KolaybiSyncKayitlari_SyncedAt DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_KolaybiSyncKayitlari UNIQUE (CompanyId, EntityType, ExternalId),
    CONSTRAINT FK_KolaybiSyncKayitlari_Sirket FOREIGN KEY (CompanyId) REFERENCES dbo.Sirketler(CompanyId)
  );
END;

IF OBJECT_ID('dbo.KolaybiSyncLog','U') IS NULL
BEGIN
  CREATE TABLE dbo.KolaybiSyncLog (
    SyncLogId BIGINT IDENTITY(1,1) PRIMARY KEY,
    CompanyId INT NOT NULL,
    StartedAt DATETIME2 NOT NULL,
    FinishedAt DATETIME2 NULL,
    Status NVARCHAR(30) NOT NULL,
    CreatedCount INT NOT NULL DEFAULT 0,
    UpdatedCount INT NOT NULL DEFAULT 0,
    ErrorCount INT NOT NULL DEFAULT 0,
    Message NVARCHAR(2000) NULL,
    CONSTRAINT FK_KolaybiSyncLog_Sirket FOREIGN KEY (CompanyId) REFERENCES dbo.Sirketler(CompanyId)
  );
END;

/*
   Çekirdek ERP tabloları.
   Mevcut veriler Şirket 1'e atanır. Yeni kayıtların CompanyId alanı daha sonra
   backend request context'i tarafından doldurulacaktır.
*/
DECLARE @CoreTables TABLE (TableName SYSNAME PRIMARY KEY);
INSERT INTO @CoreTables(TableName) VALUES
  ('CariEvrak'),
  ('Siparisler'),
  ('SiparisDetay'),
  ('Urunler'),
  ('UrunDosya'),
  ('Numuneler'),
  ('Teklifler'),
  ('TeklifKalemleri'),
  ('Faturalar'),
  ('FaturaDetay'),
  ('KasaBanka'),
  ('KasaBankaHareketleri'),
  ('Personel'),
  ('Receteler'),
  ('ReceteKalemleri'),
  ('FasonIsler'),
  ('FasonHareketleri'),
  ('Irsaliyeler'),
  ('IrsaliyeDetay');

DECLARE @TableName SYSNAME, @sql NVARCHAR(MAX), @constraintName SYSNAME;
DECLARE table_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT TableName FROM @CoreTables;
OPEN table_cursor;
FETCH NEXT FROM table_cursor INTO @TableName;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF OBJECT_ID('dbo.' + @TableName, 'U') IS NOT NULL
     AND COL_LENGTH('dbo.' + @TableName, 'CompanyId') IS NULL
  BEGIN
    SET @constraintName = 'DF_' + @TableName + '_CompanyId';
    SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@TableName) +
               N' ADD CompanyId INT NOT NULL CONSTRAINT ' + QUOTENAME(@constraintName) + N' DEFAULT (1) WITH VALUES;';
    EXEC sp_executesql @sql;
  END;

  IF OBJECT_ID('dbo.' + @TableName, 'U') IS NOT NULL
     AND COL_LENGTH('dbo.' + @TableName, 'CompanyId') IS NOT NULL
  BEGIN
    SET @sql = N'IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_' + @TableName + '_CompanyId'' AND object_id = OBJECT_ID(N''dbo.' + @TableName + N''')) ' +
               N'CREATE INDEX ' + QUOTENAME('IX_' + @TableName + '_CompanyId') + N' ON dbo.' + QUOTENAME(@TableName) + N'(CompanyId);';
    EXEC sp_executesql @sql;
  END;

  FETCH NEXT FROM table_cursor INTO @TableName;
END;
CLOSE table_cursor;
DEALLOCATE table_cursor;

/* ŞirketId bulunan mevcut tablolarda gelecekteki izolasyon için indeksler. */
IF COL_LENGTH('dbo.CariListesi','CompanyId') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_CariListesi_CompanyId' AND object_id=OBJECT_ID('dbo.CariListesi'))
  CREATE INDEX IX_CariListesi_CompanyId ON dbo.CariListesi(CompanyId, IsActive);

IF COL_LENGTH('dbo.CariHareketleri','CompanyId') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_CariHareketleri_CompanyId' AND object_id=OBJECT_ID('dbo.CariHareketleri'))
  CREATE INDEX IX_CariHareketleri_CompanyId ON dbo.CariHareketleri(CompanyId, HareketTarihi);
