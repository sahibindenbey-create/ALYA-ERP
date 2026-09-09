/* ALYA ERP - KolaybiAyarlar.IsActive eksik sütun düzeltmesi
   kolaybi.js içindeki getAyarlar() ve PUT /api/kolaybi/ayarlar
   sorguları IsActive sütununu kullanıyor, ancak 001 migration'ında
   bu sütun tabloya eklenmemişti. Eksikse ekle ve mevcut kayıtları
   aktif (1) olarak işaretle. */

IF OBJECT_ID('dbo.KolaybiAyarlar','U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.KolaybiAyarlar','IsActive') IS NULL
  BEGIN
    ALTER TABLE dbo.KolaybiAyarlar
      ADD IsActive BIT NOT NULL CONSTRAINT DF_KolaybiAyarlar_IsActive DEFAULT 1;
  END

  UPDATE dbo.KolaybiAyarlar
  SET IsActive = 1
  WHERE IsActive IS NULL;
END
