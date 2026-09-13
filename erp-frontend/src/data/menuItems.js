const item=(name,path,icon)=>({name,path,icon,status:"ready"});
const group=(group,icon,items,adminOnly=false)=>({group,icon,items,adminOnly});
const menuItems=[
group("Ana Panel","🏠",[item("Dashboard","","🏠")]),
group("Cari","👥",[item("Cari Listesi","cari-listesi","👥"),item("Yeni Cari","cari-giris","➕")]),
group("Ürün","📦",[item("Ürün Listesi","urun-listesi","📦"),item("Yeni Ürün","urun-giris","➕")]),
group("Stok","🏬",[item("Stok Durumu","urun-stoklar","📊"),item("Depo Yönetimi","depo-alan-planlama","🏬")]),
group("Satış","🛍️",[item("Teklifler","teklif/liste","📝"),item("Teklif Talepleri","teklif-talepleri","📨"),item("Siparişler","siparis-listesi","🛍️"),item("Yeni Sipariş","siparis-giris","➕"),item("Satış Operasyonu","satis-operasyon","⚡"),item("Numuneler","numuneler","🧪")]),
group("Satın Alma","🛒",[item("Satın Alma Operasyonu","satinalma-operasyon","🛒")]),
group("İrsaliye","🚚",[item("İrsaliye İşlemleri","irsaliye","🚚")]),
group("Fatura","🧾",[item("Fatura Listesi","faturalar/liste","🧾"),item("Yeni Satış Faturası","faturalar/satis","➕"),item("Yeni Alış Faturası","faturalar/alis","➕")]),
group("Finans","💰",[item("Finans Hareketleri","finans","💰"),item("Kasa ve Banka Hesapları","finans/hesaplar","🏦"),item("Yaşlandırılmış Nakit Akışı","finans/nakit-akisi","📅"),item("Finans Operasyonu","finans-operasyon","⚡")]),
group("Üretim","🏭",[item("Reçeteler","receteler","🧩"),item("MRP","uretim-mrp","📐"),item("Üretim Yürütme","uretim-yurutme","🏭"),item("Kalite Kontrol","kalite-kontrol","✅"),item("Üretim Maliyeti","uretim-maliyeti","₺")]),
group("Fason","🤝",[item("Fason İşleri","fason","🤝")]),
group("CRM","🎯",[item("CRM Merkezi","satis-firsatlari","🎯")]),
group("Pazaryerleri","🌐",[item("Platformlar","platform-tumu","🌐"),item("Veri Aktarımı","platform-import","⬇️"),item("Platform Siparişleri","platform-siparisleri","🛍️")]),
group("İnsan Kaynakları","🧑‍💼",[item("Personel","personel","🧑‍💼")]),
group("Raporlama","📊",[item("Finansal Raporlar","raporlar","📊")]),
group("KolayBi","🔗",[item("Entegrasyon Merkezi","kolaybi","🔗"),item("Faturalar","kolaybi/faturalar","🧾"),item("İrsaliyeler","kolaybi/irsaliyeler","🚚"),item("Banka Hesapları","kolaybi/banka-hesaplari","🏦"),item("Kasalar","kolaybi/kasalar","💵")]),
group("Sistem","⚙️",[item("Şirket Yönetimi","sirket-yonetimi","🏢"),item("Şirket Seçimi","sirket-secimi","🔄"),item("Kullanıcılar","kullanicilar","👤"),item("İşlem Logları","kayitlar","📋")],true)];
export const STATUS_META={ready:{label:"Aktif",symbol:""},partial:{label:"Geliştiriliyor",symbol:""},planned:{label:"Planlandı",symbol:""}};export const flattenMenuItems=(groups=menuItems)=>groups.flatMap(section=>section.items.map(entry=>({...entry,group:section.group,groupIcon:section.icon})));export default menuItems;
