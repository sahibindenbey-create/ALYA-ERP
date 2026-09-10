const STATUS={"🟢":"ready","🟡":"partial","🔴":"planned"};
const ROUTES={Dashboard:"","Şirket Seçimi":"sirket-secimi","3 Şirket Yönetimi":"sirket-yonetimi",Kullanıcı:"kullanicilar","Cari Kart":"cari-giris","Cari Form":"cari-giris","Cari Listesi":"cari-listesi","Ürün Kartı":"urun-giris","Ürün Formu":"urun-giris","Ürün Dosyaları":"urun-giris","Ürün Kodu":"urun-giris",Birim:"urun-giris",KDV:"urun-giris","Stok Paneli":"urun-stoklar","Stok Hareketleri":"urun-stoklar",Depo:"depo-alan-planlama",Teklif:"teklif/liste","Teklif Talepleri":"teklif-talepleri",Sipariş:"siparis-listesi","Yeni Sipariş":"siparis-giris",Numune:"numuneler","Satış Operasyon Merkezi":"satis-operasyon","Sipariş Rezervasyonu":"satis-operasyon","Sipariş → Üretim":"uretim-mrp","Sipariş → Satın Alma":"satinalma-operasyon","Sipariş → Sevkiyat":"satis-operasyon","Sipariş → İrsaliye":"satis-operasyon","Sipariş → Fatura":"satis-operasyon","Satın Alma Operasyon Merkezi":"satinalma-operasyon","Mal Kabul":"satinalma-operasyon","İrsaliye Formu":"irsaliye","Satış İrsaliyesi":"irsaliye","Alış İrsaliyesi":"irsaliye","Fatura Formu":"faturalar/satis","Fatura Listesi":"faturalar/liste","KolayBi Faturaları":"kolaybi/faturalar","Satış Faturası":"faturalar/satis","Alış Faturası":"faturalar/alis","Finans":"finans","Finansal Raporlar":"raporlar","Finans Operasyon Merkezi":"finans-operasyon","Bütçe ve Nakit Tahmini":"butce","Sabit Kıymet":"sabit-kimyet",Amortisman:"sabit-kimyet","Banka Hesapları":"finans/hesaplar",Kasalar:"kolaybi/kasalar",Çekler:"kolaybi/cekler",Senetler:"kolaybi/senetler","Kredi Kartları":"kolaybi/kredi-kartlari","Ürün Reçetesi":"receteler","Reçete Yönetimi":"receteler","Alt Reçete":"receteler","Reçete Ağacı":"receteler",BOM:"receteler","BOM Excel Import":"receteler",Üretim:"uretim-yurutme","Gerçek Üretim":"uretim-yurutme","Üretim Maliyeti":"uretim-maliyeti","Maliyet ve Stok Değerleme":"maliyet-degerleme","Kalite Kontrol":"kalite-kontrol","Üretim Emri":"uretim-yurutme","İş Emri":"uretim-yurutme","Malzeme İhtiyaç":"uretim-mrp",MRP:"uretim-mrp","Hammadde Rezervasyonu":"uretim-mrp","Üretim Sarfı":"uretim-yurutme",Fire:"uretim-yurutme","Yarı Mamul":"uretim-yurutme",Fason:"fason","Fason İş":"fason","Potansiyel Müşteri":"pazarlama",Fırsatlar:"satis-firsatlari",Görüşmeler:"call-center",Ziyaretler:"iletisim",Aktiviteler:"iletisim",Görevler:"iletisim",Kampanyalar:"pazarlama","Satış Pipeline":"satis-gucu-planlama",Trendyol:"platform-tumu","Platform Import":"platform-import","Tüm Platformlar":"platform-tumu","Platform Siparişleri":"platform-siparisleri","Personel Kartı":"personel","Personel Formu":"personel",İzin:"personel",Puantaj:"personel","Bordro Hesaplama":"personel","Üretim Maliyet":"uretim-maliyeti",Şirketler:"kolaybi","Şirket Ayarları":"kolaybi",Cari:"kolaybi",Ürün:"kolaybi",Fatura:"kolaybi/faturalar",İrsaliye:"kolaybi/irsaliyeler",Banka:"kolaybi/banka-hesaplari",Kasa:"kolaybi/kasalar",Çek:"kolaybi/cekler",Senet:"kolaybi/senetler","Online Senkronizasyon":"kolaybi/online-banka-hesaplari","Kullanıcı Yönetimi":"kullanicilar","İşlem Logları":"kayitlar",Audit:"kayitlar"};
const slug=s=>s.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ı/g,"i").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
const G=(group,icon,rows,adminOnly=false)=>({group,icon,adminOnly,items:rows.trim().split("\n").map(row=>{const mark=row.slice(0,2),name=row.slice(2).trim();return{name,path:Object.prototype.hasOwnProperty.call(ROUTES,name)?ROUTES[name]:slug(name),icon,status:STATUS[mark]||"planned"}})});
const menuItems=[
G("Ana Panel","🏠",`🟢 Dashboard
🟢 Şirket Seçimi
🟢 3 Şirket Yönetimi
🟢 Kullanıcı
🟡 Genel KPI'lar
🟡 Satış Özeti
🟡 Stok Özeti
🟡 Finans Özeti
🟡 Cari Bakiye
🟡 Bekleyen Siparişler
🟡 Kritik Stoklar
🔴 Yönetici Dashboard`),
G("Cari","👥",`🟢 Cari Kart
🟢 Cari Form
🟢 Cari Evrak Yönetimi
🟢 Cari Listesi
🟡 Cari Hareketleri
🟡 Cari Ekstre
🟡 Borç / Alacak
🟡 Bakiye
🟡 Risk Limiti
🟡 Vade Takibi
🟡 Cari Mutabakat
🟡 Cari Belgeler
🔴 Cari Raporları`),
G("Ürün","📦",`🟢 Ürün Kartı
🟢 Ürün Formu
🟢 Ürün Dosyaları
🟢 Ürün Kodu
🟢 Birim
🟢 KDV
🟡 Ürün Grupları
🟡 Kategoriler
🟡 Marka
🟡 Barkod
🟡 Ürün Resmi
🟡 Alış Fiyatı
🟡 Satış Fiyatı
🟡 Fiyat Listeleri
🔴 Ürün Analizleri`),
G("Stok","🏬",`🟢 Stok Paneli
🟢 Stok Hareketleri
🟢 Depo
🟡 Stok Giriş
🟡 Stok Çıkış
🟡 Depolar Arası Transfer
🟡 Sayım
🟡 Sayım Fişi
🟡 Rezervasyon
🟡 Kritik Stok
🟡 Minimum Stok
🟡 Maksimum Stok
🟡 Satılabilir Stok
🟡 Rezerve Stok
🟡 Üretim Bekleyen
🟡 Stok Raporları`),
G("Satış","🛍️",`🟢 Teklif
🟢 Teklif Talepleri
🟢 Sipariş
🟢 Yeni Sipariş
🟢 Numune
🟢 Satış Operasyon Merkezi
🟡 Sipariş Onayı
🟡 Sipariş Rezervasyonu
🟡 Sipariş → Üretim
🟡 Sipariş → Satın Alma
🟡 Sipariş → Sevkiyat
🟡 Sipariş → İrsaliye
🟡 Sipariş → Fatura
🟡 İade
🟡 Değişim
🟡 Satış Kanalı
🟢 Trendyol
🟢 Pazaryeri Altyapısı
🟡 Satış Raporları`),
G("Satın Alma","🛒",`🟡 Satın Alma Operasyon Merkezi
🔴 Satın Alma Talebi
🔴 İç Talep
🔴 Tedarikçi Teklifi
🔴 Teklif Karşılaştırma
🔴 Satın Alma Siparişi
🟡 Mal Kabul
🟡 Alış İrsaliyesi
🟡 Alış Faturası
🟡 Alış İadesi
🔴 Tedarikçi Fiyatları
🔴 Satın Alma Raporları`),
G("İrsaliye","🚚",`🟢 İrsaliye Formu
🟢 Satış İrsaliyesi
🟡 Alış İrsaliyesi
🟡 İade İrsaliyesi
🟡 Siparişten İrsaliye
🟡 İrsaliyeden Fatura
🟡 Stok Hareketi
🟡 e-İrsaliye`),
G("Fatura","🧾",`🟢 Fatura Formu
🟢 Fatura Listesi
🟢 KolayBi Faturaları
🟡 Satış Faturası
🟡 Alış Faturası
🟡 İade Faturası
🟡 Sipariş → Fatura
🟡 İrsaliye → Fatura
🟡 Cari Hareketi
🟡 Stok Hareketi
🟡 Muhasebe Hareketi
🟡 e-Fatura / e-Arşiv`),
G("Finans","💰",`🟢 Finans
🟢 Finansal Raporlar
🟢 Finans Operasyon Merkezi
🟢 Bütçe ve Nakit Tahmini
🟢 Sabit Kıymet
🟢 Amortisman
🟢 Banka Hesapları
🟢 Kasalar
🟢 Çekler
🟢 Senetler
🟢 Kredi Kartları
🟡 Tahsilat
🟡 Ödeme
🟡 Havale
🟡 EFT
🟡 Banka Hareketleri
🟡 Kasa Hareketleri
🟡 Çek Portföyü
🟡 Senet Portföyü
🔴 Finansal Planlama`),
G("Üretim","🏭",`🟢 Ürün Reçetesi
🟢 Reçete Yönetimi
🟢 Alt Reçete
🟢 Reçete Ağacı
🟢 BOM
🟢 BOM Excel Import
🟢 Üretim
🟢 Gerçek Üretim
🟢 Üretim Maliyeti
🟢 Maliyet ve Stok Değerleme
🟢 Kalite Kontrol
🟡 Üretim Emri
🟡 İş Emri
🟡 Üretim Planlama
🟡 Malzeme İhtiyaç
🟡 MRP
🟡 Hammadde Rezervasyonu
🟡 Üretim Sarfı
🟡 Fire
🟡 Yarı Mamul
🟡 Fason
🔴 Kapasite Planlama`),
G("Fason","🤝",`🟢 Fason İş
🟡 Fason Tedarikçi
🟡 Fason Sipariş
🟡 Fasona Gönderilen
🟡 Fason Sarf
🟡 Fason Üretim
🟡 Fason Gelen
🔴 Fason Maliyet`),
G("CRM","🎯",`🟢 Potansiyel Müşteri
🟢 Fırsatlar
🟡 Teklifler
🟢 Görüşmeler
🟡 Ziyaretler
🟢 Aktiviteler
🟢 Görevler
🟢 Kampanyalar
🟢 Satış Pipeline
🔴 CRM Raporları`),
G("Pazaryerleri","🌐",`🟢 Trendyol
🟢 Platform Import
🟢 Tüm Platformlar
🟢 Platform Siparişleri
🟡 Hepsiburada
🟡 N11
🟡 Amazon
🟡 Pazarama
🟡 ÇiçekSepeti`),
G("Personel / İK","🧑‍💼",`🟢 Personel Kartı
🟢 Personel Formu
🟡 Departman
🟡 Görev
🟡 İzin
🟡 Puantaj
🟡 Avans
🟢 Bordro Hesaplama
🟡 Mesai
🔴 Performans
🔴 Eğitim`),
G("Raporlama","📊",`🟢 Finansal Raporlar
🟡 Cari Raporları
🟡 Satış Raporları
🟡 Sipariş Raporları
🟡 Stok Raporları
🟡 Üretim Raporları
🟢 Üretim Maliyet
🟡 Satın Alma Raporları
🟡 Kârlılık
🟡 Ürün Kârlılığı
🟡 Müşteri Kârlılığı
🟡 Yönetici Dashboard`),
G("KolayBi Entegrasyonu","🔗",`🟢 Şirketler
🟢 Şirket Ayarları
🟢 Cari
🟢 Ürün
🟢 Fatura
🟢 İrsaliye
🟢 Finans
🟢 Banka
🟢 Kasa
🟢 Çek
🟢 Senet
🟡 Online Senkronizasyon
🟡 Çift Kayıt Engelleme
🟡 Hata Logları
🟡 Tam Çift Yönlü Entegrasyon`),
G("Sistem Yönetimi","⚙️",`🟢 Şirketler
🟢 Şirket Seçimi
🟢 CompanyId
🟢 Company Isolation
🟢 RLS
🟢 Kullanıcı Yönetimi
🟡 Rol
🟡 Yetki
🟡 Departman
🟡 İşlem Logları
🟡 Audit
🟡 Numara Serileri
🟡 Parametreler
🟡 Entegrasyon Ayarları`,true)
];
export const STATUS_META={ready:{label:"Aktif",symbol:"🟢"},partial:{label:"Geliştiriliyor",symbol:"🟡"},planned:{label:"Planlandı",symbol:"🔴"}};
export const flattenMenuItems=(groups=menuItems)=>groups.flatMap(group=>group.items.map(entry=>({...entry,group:group.group,groupIcon:group.icon})));
export default menuItems;
