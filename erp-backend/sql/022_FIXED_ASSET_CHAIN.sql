/* ALYA ERP 022 - Sabit kıymet, zimmet, amortisman ve elden çıkarma. Veri silmez. */
SET NOCOUNT ON;SET XACT_ABORT ON;
BEGIN TRY BEGIN TRAN;
IF OBJECT_ID(N'dbo.MuhasebeFisleri',N'U') IS NULL OR OBJECT_ID(N'dbo.MuhasebeFisSatirlari',N'U') IS NULL THROW 52201,N'Önce Faz 3 finans ve muhasebe zinciri kurulmalıdır.',1;
IF OBJECT_ID(N'dbo.SabitKiymetKategorileri',N'U') IS NULL CREATE TABLE dbo.SabitKiymetKategorileri(
 KategoriId INT IDENTITY PRIMARY KEY,CompanyId INT NOT NULL,KategoriKodu NVARCHAR(40) NOT NULL,KategoriAdi NVARCHAR(160) NOT NULL,
 FaydaliOmurAy INT NOT NULL,AmortismanYontemi NVARCHAR(30) NOT NULL DEFAULT N'Normal',VarlikHesabi NVARCHAR(30) NOT NULL DEFAULT N'255',
 BirikmisAmortismanHesabi NVARCHAR(30) NOT NULL DEFAULT N'257',GiderHesabi NVARCHAR(30) NOT NULL DEFAULT N'770',IsActive BIT NOT NULL DEFAULT 1,
 CONSTRAINT UQ_SabitKiymetKategorileri UNIQUE(CompanyId,KategoriKodu),CONSTRAINT UQ_SabitKiymetKategorileri_CompanyId UNIQUE(CompanyId,KategoriId),
 CONSTRAINT CK_SabitKiymetKategorileri_Omur CHECK(FaydaliOmurAy BETWEEN 1 AND 600),CONSTRAINT CK_SabitKiymetKategorileri_Yontem CHECK(AmortismanYontemi IN(N'Normal',N'Azalan Bakiyeler')),
 CONSTRAINT FK_SabitKiymetKategorileri_Company FOREIGN KEY(CompanyId) REFERENCES dbo.Sirketler(CompanyId));
IF OBJECT_ID(N'dbo.SabitKiymetler',N'U') IS NULL CREATE TABLE dbo.SabitKiymetler(
 KiymetId BIGINT IDENTITY PRIMARY KEY,CompanyId INT NOT NULL,KiymetNo NVARCHAR(80) NOT NULL,KategoriId INT NOT NULL,KiymetAdi NVARCHAR(200) NOT NULL,
 SeriNo NVARCHAR(100),MarkaModel NVARCHAR(160),AlimTarihi DATE NOT NULL,AktiflestirmeTarihi DATE,MaliyetBedeli DECIMAL(18,2) NOT NULL,HurdaDegeri DECIMAL(18,2) NOT NULL DEFAULT 0,
 DegerArtisi DECIMAL(18,2) NOT NULL DEFAULT 0,DegerDusuklugu DECIMAL(18,2) NOT NULL DEFAULT 0,BirikmisAmortisman DECIMAL(18,2) NOT NULL DEFAULT 0,
 NetDefterDegeri AS CAST(MaliyetBedeli+DegerArtisi-DegerDusuklugu-BirikmisAmortisman AS DECIMAL(18,2)) PERSISTED,FaydaliOmurAy INT NOT NULL,
 AmortismanYontemi NVARCHAR(30) NOT NULL,Lokasyon NVARCHAR(160),SorumluKullaniciId INT,Durum NVARCHAR(20) NOT NULL DEFAULT N'Taslak',Aciklama NVARCHAR(500),
 CreatedBy INT,CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),UpdatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
 CONSTRAINT UQ_SabitKiymetler_No UNIQUE(CompanyId,KiymetNo),CONSTRAINT UQ_SabitKiymetler_CompanyId UNIQUE(CompanyId,KiymetId),
 CONSTRAINT CK_SabitKiymetler_Tutar CHECK(MaliyetBedeli>0 AND HurdaDegeri>=0 AND HurdaDegeri<MaliyetBedeli AND DegerArtisi>=0 AND DegerDusuklugu>=0 AND BirikmisAmortisman>=0),
 CONSTRAINT CK_SabitKiymetler_Omur CHECK(FaydaliOmurAy BETWEEN 1 AND 600),CONSTRAINT CK_SabitKiymetler_Yontem CHECK(AmortismanYontemi IN(N'Normal',N'Azalan Bakiyeler')),
 CONSTRAINT CK_SabitKiymetler_Durum CHECK(Durum IN(N'Taslak',N'Aktif',N'Satıldı',N'Hurda')),CONSTRAINT CK_SabitKiymetler_Tarih CHECK(AktiflestirmeTarihi IS NULL OR AktiflestirmeTarihi>=AlimTarihi),
 CONSTRAINT FK_SabitKiymetler_Kategori FOREIGN KEY(CompanyId,KategoriId) REFERENCES dbo.SabitKiymetKategorileri(CompanyId,KategoriId),CONSTRAINT FK_SabitKiymetler_Company FOREIGN KEY(CompanyId) REFERENCES dbo.Sirketler(CompanyId));
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.SabitKiymetler') AND name=N'IX_SabitKiymetler_Rapor') EXEC sys.sp_executesql N'CREATE INDEX IX_SabitKiymetler_Rapor ON dbo.SabitKiymetler(CompanyId,Durum,KategoriId) INCLUDE(MaliyetBedeli,BirikmisAmortisman,NetDefterDegeri);';
IF OBJECT_ID(N'dbo.SabitKiymetZimmetleri',N'U') IS NULL CREATE TABLE dbo.SabitKiymetZimmetleri(
 ZimmetId BIGINT IDENTITY PRIMARY KEY,CompanyId INT NOT NULL,KiymetId BIGINT NOT NULL,KullaniciId INT,PersonelAdi NVARCHAR(160),Lokasyon NVARCHAR(160) NOT NULL,
 BaslangicTarihi DATE NOT NULL,BitisTarihi DATE,IsActive BIT NOT NULL DEFAULT 1,Aciklama NVARCHAR(300),CreatedBy INT,CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
 CONSTRAINT CK_SabitKiymetZimmetleri_Tarih CHECK(BitisTarihi IS NULL OR BitisTarihi>=BaslangicTarihi),
 CONSTRAINT FK_SabitKiymetZimmetleri_Kiymet FOREIGN KEY(CompanyId,KiymetId) REFERENCES dbo.SabitKiymetler(CompanyId,KiymetId),CONSTRAINT FK_SabitKiymetZimmetleri_Company FOREIGN KEY(CompanyId) REFERENCES dbo.Sirketler(CompanyId));
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.SabitKiymetZimmetleri') AND name=N'UX_SabitKiymetZimmetleri_Aktif') EXEC sys.sp_executesql N'CREATE UNIQUE INDEX UX_SabitKiymetZimmetleri_Aktif ON dbo.SabitKiymetZimmetleri(CompanyId,KiymetId) WHERE IsActive=1;';
IF OBJECT_ID(N'dbo.SabitKiymetDegerHareketleri',N'U') IS NULL CREATE TABLE dbo.SabitKiymetDegerHareketleri(
 HareketId BIGINT IDENTITY PRIMARY KEY,CompanyId INT NOT NULL,KiymetId BIGINT NOT NULL,HareketTarihi DATE NOT NULL,HareketTipi NVARCHAR(30) NOT NULL,Tutar DECIMAL(18,2) NOT NULL,
 Aciklama NVARCHAR(400),MuhasebeFisId BIGINT,CreatedBy INT,CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
 CONSTRAINT CK_SabitKiymetDegerHareketleri CHECK(HareketTipi IN(N'Değer Artışı',N'Değer Düşüklüğü') AND Tutar>0),
 CONSTRAINT FK_SabitKiymetDegerHareketleri_Kiymet FOREIGN KEY(CompanyId,KiymetId) REFERENCES dbo.SabitKiymetler(CompanyId,KiymetId),CONSTRAINT FK_SabitKiymetDegerHareketleri_Fis FOREIGN KEY(MuhasebeFisId) REFERENCES dbo.MuhasebeFisleri(FisId),CONSTRAINT FK_SabitKiymetDegerHareketleri_Company FOREIGN KEY(CompanyId) REFERENCES dbo.Sirketler(CompanyId));
IF OBJECT_ID(N'dbo.AmortismanPlanlari',N'U') IS NULL CREATE TABLE dbo.AmortismanPlanlari(
 PlanId BIGINT IDENTITY PRIMARY KEY,CompanyId INT NOT NULL,KiymetId BIGINT NOT NULL,Yil INT NOT NULL,Ay TINYINT NOT NULL,DonemSonu DATE NOT NULL,AmortismanMatrahi DECIMAL(18,2) NOT NULL,
 Oran DECIMAL(9,6) NOT NULL,AmortismanTutari DECIMAL(18,2) NOT NULL,BirikmisAmortismanSonrasi DECIMAL(18,2) NOT NULL,NetDefterDegeriSonrasi DECIMAL(18,2) NOT NULL,
 Durum NVARCHAR(20) NOT NULL DEFAULT N'Planlandı',MuhasebeFisId BIGINT,MuhasebelesmeTarihi DATETIME2(3),CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
 CONSTRAINT UQ_AmortismanPlanlari UNIQUE(CompanyId,KiymetId,Yil,Ay),CONSTRAINT CK_AmortismanPlanlari_Donem CHECK(Yil BETWEEN 2000 AND 2200 AND Ay BETWEEN 1 AND 12),
 CONSTRAINT CK_AmortismanPlanlari_Tutar CHECK(AmortismanTutari>=0 AND BirikmisAmortismanSonrasi>=0 AND NetDefterDegeriSonrasi>=0),CONSTRAINT CK_AmortismanPlanlari_Durum CHECK(Durum IN(N'Planlandı',N'Muhasebeleşti',N'İptal')),
 CONSTRAINT FK_AmortismanPlanlari_Kiymet FOREIGN KEY(CompanyId,KiymetId) REFERENCES dbo.SabitKiymetler(CompanyId,KiymetId),CONSTRAINT FK_AmortismanPlanlari_Fis FOREIGN KEY(MuhasebeFisId) REFERENCES dbo.MuhasebeFisleri(FisId),CONSTRAINT FK_AmortismanPlanlari_Company FOREIGN KEY(CompanyId) REFERENCES dbo.Sirketler(CompanyId));
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.AmortismanPlanlari') AND name=N'IX_AmortismanPlanlari_Donem') EXEC sys.sp_executesql N'CREATE INDEX IX_AmortismanPlanlari_Donem ON dbo.AmortismanPlanlari(CompanyId,Yil,Ay,Durum) INCLUDE(KiymetId,AmortismanTutari,MuhasebeFisId);';
IF OBJECT_ID(N'dbo.SabitKiymetEldenCikarmalari',N'U') IS NULL CREATE TABLE dbo.SabitKiymetEldenCikarmalari(
 EldenCikarmaId BIGINT IDENTITY PRIMARY KEY,CompanyId INT NOT NULL,KiymetId BIGINT NOT NULL,BelgeNo NVARCHAR(80) NOT NULL,IslemTarihi DATE NOT NULL,IslemTipi NVARCHAR(20) NOT NULL,
 SatisTutari DECIMAL(18,2) NOT NULL DEFAULT 0,NetDefterDegeri DECIMAL(18,2) NOT NULL,KarZarar DECIMAL(18,2) NOT NULL,MuhasebeFisId BIGINT,Aciklama NVARCHAR(400),CreatedBy INT,CreatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
 CONSTRAINT UQ_SabitKiymetEldenCikarmalari UNIQUE(CompanyId,KiymetId),CONSTRAINT UQ_SabitKiymetEldenCikarmalari_No UNIQUE(CompanyId,BelgeNo),
 CONSTRAINT CK_SabitKiymetEldenCikarmalari CHECK(IslemTipi IN(N'Satış',N'Hurda') AND SatisTutari>=0 AND NetDefterDegeri>=0),
 CONSTRAINT FK_SabitKiymetEldenCikarmalari_Kiymet FOREIGN KEY(CompanyId,KiymetId) REFERENCES dbo.SabitKiymetler(CompanyId,KiymetId),CONSTRAINT FK_SabitKiymetEldenCikarmalari_Fis FOREIGN KEY(MuhasebeFisId) REFERENCES dbo.MuhasebeFisleri(FisId),CONSTRAINT FK_SabitKiymetEldenCikarmalari_Company FOREIGN KEY(CompanyId) REFERENCES dbo.Sirketler(CompanyId));
INSERT dbo.MuhasebeHesaplari(CompanyId,HesapKodu,HesapAdi,HesapTipi) SELECT s.CompanyId,x.Kod,x.Ad,x.Tip FROM dbo.Sirketler s CROSS JOIN(VALUES(N'255',N'Demirbaşlar',N'Varlık'),(N'257',N'Birikmiş Amortismanlar',N'Varlık'),(N'770',N'Genel Yönetim Giderleri',N'Gider'),(N'679',N'Diğer Olağandışı Gelirler',N'Gelir'),(N'689',N'Diğer Olağandışı Giderler',N'Gider'))x(Kod,Ad,Tip) WHERE NOT EXISTS(SELECT 1 FROM dbo.MuhasebeHesaplari h WHERE h.CompanyId=s.CompanyId AND h.HesapKodu=x.Kod);
INSERT dbo.SabitKiymetKategorileri(CompanyId,KategoriKodu,KategoriAdi,FaydaliOmurAy,AmortismanYontemi) SELECT s.CompanyId,x.Kod,x.Ad,x.Omur,N'Normal' FROM dbo.Sirketler s CROSS JOIN(VALUES(N'BILGI-ISLEM',N'Bilgi İşlem Ekipmanı',36),(N'MAKINE',N'Makine ve Teçhizat',60),(N'TASIT',N'Taşıtlar',60),(N'DEMIRBAS',N'Demirbaşlar',60))x(Kod,Ad,Omur) WHERE NOT EXISTS(SELECT 1 FROM dbo.SabitKiymetKategorileri k WHERE k.CompanyId=s.CompanyId AND k.KategoriKodu=x.Kod);
INSERT dbo.NumberSeries(CompanyId,DocumentType,Prefix,Padding) SELECT s.CompanyId,x.Tip,x.OnEk,6 FROM dbo.Sirketler s CROSS JOIN(VALUES(N'SABIT_KIYMET',N'SK-'),(N'SABIT_KIYMET_CIKIS',N'SKC-'))x(Tip,OnEk) WHERE NOT EXISTS(SELECT 1 FROM dbo.NumberSeries n WHERE n.CompanyId=s.CompanyId AND n.DocumentType=x.Tip);
COMMIT;END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK;THROW;END CATCH;
SELECT N'022 sabit kıymet ve amortisman zinciri tamamlandı.' Result;
