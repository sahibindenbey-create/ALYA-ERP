# Tanı ve Bakım Script'leri

Bu klasördeki script'ler **numaralı migration değildir** — tek seferlik
şema değişikliği yapmazlar, tekrar tekrar çalıştırılabilecek **salt-okunur
tanı araçları** ya da nadiren gereken **bakım script'leridir**. 2026-09
tarihli kapsamlı bir hata ayıklama oturumunda üretildi, gelecekte benzer
sorunlarla karşılaşıldığında tekrar kullanılmak üzere burada saklanıyor.

| Script | Ne işe yarar | Ne zaman kullanılır |
|---|---|---|
| `migration_durum_raporu.sql` | `erp-backend/sql/` altındaki her migration'ın veritabanında gerçekten çalışıp çalışmadığını (oluşturduğu tablo/fonksiyonları arayarak) tek seferde raporlar. | Yeni bir ortamda ya da "bu migration çalıştı mı emin değilim" durumunda. |
| `rls_gecici_kapat_veri_goruntule.sql` | Tüm aktif RLS güvenlik politikalarını (isim varsaymadan, dinamik olarak) geçici kapatıp bir SELECT çalıştırır, sonra hepsini garanti şekilde geri açar. | RLS korumalı bir tabloda (`UserCompanies`, `MuhasebeHesaplari` vb.) şirketler arası gerçek veriyi görmek gerektiğinde. **Şablon olarak kullanın** — ADIM 2'deki SELECT'i ihtiyacınıza göre değiştirin. |
| `kullanici_sirket_rol_matrisi.sql` | Her kullanıcının hangi şirketlere/rollere atanmış olduğunu bir matris halinde gösterir (RLS'i güvenli şekilde geçici kapatır). | "Kullanıcı X neden Y şirketini göremiyor" tarzı sorunlarda ilk bakılacak yer. |
| `admin_tum_sirketlere_yetki_ver.sql` | Belirtilen bir kullanıcıya (`@AdminUserId`) tüm şirketlerde Yönetici rolü atar. | Yeni bir yönetici kullanıcı eklerken ya da eksik şirket/rol ataması sorununu düzeltirken. Script içindeki `@AdminUserId`/`@AdminRoleId` değerlerini kontrol edin. |
| `tablo_zorunlu_kolonlar_sablonu.sql` | Bir tablonun tüm kolonlarını ve özellikle "INSERT'te mutlaka değer vermeniz gereken" (NOT NULL, varsayılansız) kolonlarını listeler. | **Yeni bir INSERT yazmadan/değiştirmeden önce her zaman** — bu ERP'de kod ile gerçek şema arasında sık sık fark bulundu (bkz. kök `MIGRATIONS.md`). Script içindeki tablo adını değiştirerek kullanın. |
| `pazaryeri_siparis_izi_sur.sql` | Belirli bir pazaryeri siparişinin (harici sipariş no ile) sistemdeki tüm izini (eski `PlatformSiparisler` → yeni `PazaryeriSiparisleriV2` → kalemler → gerçek `Siparisler` kaydı) tek seferde gösterir. | Bir pazaryeri siparişi "kayboldu" / "aktarıldı ama bulamıyorum" durumlarında. Script içindeki sipariş numarasını değiştirin. |

## Neden ayrı bir klasör?

Bu script'ler `erp-backend/sql/`'in ana (numaralı) migration akışına
**karışmasın** diye ayrı tutuluyor — hiçbiri şema değiştirmez (ikisi hariç:
`admin_tum_sirketlere_yetki_ver.sql` veri değiştirir ama idempotent ve
tekrar çalıştırmak güvenlidir), tekrar tekrar, istediğiniz sırada
çalıştırılabilirler.
