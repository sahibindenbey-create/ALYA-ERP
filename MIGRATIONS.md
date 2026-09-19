# Migration Klasörleri — Durum Notu

Bu repoda **iki ayrı** SQL migration klasörü var: kök dizindeki `sql/` ve
`erp-backend/sql/`. İkisi de duruyor çünkü canlı bir finansal veritabanının
migration geçmişini geriye dönük silmek/birleştirmek risklidir — başka bir
ortamda (staging, yedek, eski bir sunucu) bu dosyalardan biri gerçekten
çalıştırılmış olabilir ve biz bunu %100 bilemeyiz. Bu yüzden **hiçbir
migration dosyası silinmedi veya değiştirilmedi** — sadece durumları
aşağıda belgeleniyor.

## Kök `sql/` (001–008)

**Production'da gerçekten çalışan sistem bu.** `003_COMPANY_ISOLATION_BLOCK_AND_ENABLE.sql`,
`dbo.fn_CompanyIsolationPredicate` fonksiyonunu ve `dbo.SecurityPolicy_CompanyIsolation`
güvenlik politikasını oluşturuyor. 2026-09-17 tarihli bir prod kapsam
taramasında bu politikanın **125'ten fazla tabloyu** aktif olarak koruduğu
doğrulandı.

## Güncelleme (2026-09-19): Kayıp 041 dosyası bulundu

Bu dokümanın ilk sürümünde `041_FIX_MISSING_COMPANY_ISOLATION_PREDICATE.sql`
repoda **hiç yoktu** ve README bunu "prod'da doğrulanmalı" diye
işaretlemişti. Dosya artık burada — ama GitHub'a değil, bir geliştiricinin
**yerel makinesinde**, hiç commit edilmeden duruyormuş. İçeriği production'ın
gerçek durumuyla (`SecurityPolicy_CompanyIsolation`, `fn_CompanyIsolationPredicate`,
35 tabloluk kapsam) birebir örtüşüyor — yani bu dosya bir noktada SSMS'te elle
çalıştırılmış, işini yapmış, ama hiç versiyon kontrolüne girmemiş. Şimdi
girdi. `044_COMPANY_ISOLATION_RECONCILIATION.sql` bu dosyanın **üzerine**
inşa edildi (aynı fonksiyonu kullanır, kalan tabloları tamamlar) — aralarında
çakışma yok, ikisi de idempotent.

## `erp-backend/sql/` (001–046)

Projenin **o tarihten sonra devam eden, aktif geliştirilen** migration
klasörü — yeni migration'lar artık buraya ekleniyor (bkz. `044_...sql`).

⚠️ **Ancak 002–009 arası dosyalar dikkatli okunmalı:**
`002_company_isolation.sql`, kök `sql/`'den **farklı bir isimle**
(`dbo.fn_AlyaCompanyPredicate`, `RLS_AlyaCompany_*` politika adları) paralel
bir RLS sistemi kurmaya çalışıyor. 2026-09-17'de bu fonksiyonun production
veritabanında **hiç var olmadığı** doğrulandı — yani bu dosya hiçbir zaman
gerçek ortama karşı çalıştırılmamış, terk edilmiş bir denemeydi.

İyi haber: `010` ve sonrası (KolayBi migration'ları, `037_DETAIL_CASHFLOW...`
vb.) doğru şekilde kök `sql/`'in fonksiyonuna (`fn_CompanyIsolationPredicate`)
referans veriyor. Yani proje bir noktada kök `sql/`'deki yaklaşımı benimseyip
`erp-backend/sql/` altında bu isimle devam etmiş; sadece 002–009 arası hiç
temizlenmemiş kalıntılar.

## Yeni bir ortam kurarken (sıfırdan deploy)

1. Önce kök `sql/001` → `008` çalıştırılmalı.
2. `erp-backend/sql/002_company_isolation.sql` → `009_URETIM_IDEMPOTENCY.sql`
   arası **ATLANMALI** (kök `sql/` zaten aynı işi doğru isimle yapıyor;
   bunları da çalıştırmak `fn_AlyaCompanyPredicate` adında kullanılmayan
   ikinci bir fonksiyon + gereksiz `RLS_AlyaCompany_*` politikaları
   yaratır — zararsız ama kafa karıştırıcı ve bakımı gereksiz büyütür).
3. `erp-backend/sql/010` → `044` sırayla çalıştırılmalı.

## Kaldırılan tehlikeli/ölü dosyalar (bkz. commit geçmişi)

- **`SQLQuery1.sql`** (kök dizin) — `DROP TABLE CariHareketleri; DROP TABLE
  CariListesi;` içeren, veri taşıması ve RLS kurulumu olmayan bir prototip
  taslağıydı. Yanlışlıkla production'a karşı çalıştırılırsa tüm şirketlerin
  cari/hareket verisini geri dönüşsüz siler. Kaldırıldı.
- **`Node.js/`** — Node.js kurulumundan kalma Windows kısayolları (`.lnk`,
  `.url`). Kodla ilgisi yoktu. Kaldırıldı.
- **`ERP.Api/`, `MyERPWeb/`** — Gerçek sisteme (erp-backend) hiç bağlanmamış,
  `dotnet new webapi` varsayılan şablonundan öteye geçmemiş, terk edilmiş
  .NET denemeleriydi (sadece varsayılan `WeatherForecastController` +
  auth'suz, company-isolation'sız tek bir `CariListesiController`).
  Kaldırıldı. Gerekirse `git log` üzerinden geri getirilebilir.
