/* ============================================================================
   ŞABLON: Bir tablonun tüm sütunlarını (özellikle NOT NULL, varsayılansız
   olanları) listeler. Bu ERP'de kod tabanı ile gerçek şema arasında sık sık
   fark bulundu (bkz. MIGRATIONS.md "Kod ile Şema Arasındaki Farklar" bölümü)
   — yeni bir INSERT yazmadan/değiştirmeden ÖNCE bu sorguyu çalıştırıp gerçek
   kolonları görmek, "Invalid column name" hatalarıyla vakit kaybetmeyi önler.

   KULLANIM: Aşağıdaki 'CariListesi' kısmını incelemek istediğiniz tablonun
   adıyla değiştirin.
   ============================================================================ */

-- 1) Tüm kolonlar (genel bakış)
SELECT
    c.column_id,
    c.name AS Kolon,
    TYPE_NAME(c.user_type_id) AS Tip,
    c.is_nullable,
    CASE WHEN dc.definition IS NOT NULL THEN dc.definition ELSE NULL END AS VarsayilanDeger
FROM sys.columns c
LEFT JOIN sys.default_constraints dc ON dc.parent_object_id=c.object_id AND dc.parent_column_id=c.column_id
WHERE c.object_id = OBJECT_ID(N'dbo.CariListesi')  -- <-- tablo adını buraya yazın
ORDER BY c.column_id;

-- 2) Sadece "INSERT'te mutlaka değer vermeniz gereken" kolonlar
--    (NOT NULL, varsayılanı yok, IDENTITY değil)
SELECT
    c.name AS ZorunluKolon,
    TYPE_NAME(c.user_type_id) AS Tip
FROM sys.columns c
LEFT JOIN sys.default_constraints dc ON dc.parent_object_id=c.object_id AND dc.parent_column_id=c.column_id
WHERE c.object_id = OBJECT_ID(N'dbo.CariListesi')  -- <-- tablo adını buraya yazın
  AND c.is_nullable = 0
  AND dc.definition IS NULL
  AND COLUMNPROPERTY(c.object_id, c.name, 'IsIdentity') = 0
ORDER BY c.column_id;
