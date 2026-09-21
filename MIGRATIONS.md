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

## ⚠️ ÖNEMLİ DERS: Kullanıcı-şirket eşleme tablolarına RLS eklenmemeli

`044`, `UserCompanies` ve `UserRoles`'a da RLS ekledi (`RLS_Reconciled_044_*`).
Bu **yanlış bir karardı** ve `048` ile geri alındı: bu tablolar "kullanıcı
hangi şirketlere/rollere sahip" bilgisini tutar; `/api/core/companies`
("bana atanmış TÜM şirketleri listele") gibi sorgular, `company-context-hook.js`
her isteğe o an seçili olan `X-Company-Id`'yi otomatik enjekte ettiği için,
RLS aktifken **sadece zaten seçili olan tek şirkete** filtreleniyordu — bu da
kullanıcının hiçbir zaman başka bir şirkete geçememesine yol açan bir kısır
döngü yarattı (bkz. gerçek bir kullanıcı testinde tespit edilen "sadece bir
şirket görünüyor" hatası).

`core/security.js`'teki `loadSecurityContext()` ve `core/coreRoutes.js`'teki
`/companies` sorgusu zaten `KullaniciId`/`CompanyId` ile **açıkça** filtreleniyor
— tablo seviyesinde RLS burada hiçbir ek güvenlik sağlamıyor. **Genel kural**:
bir tablo "hangi kullanıcı hangi şirkete erişebilir" bilgisinin KENDİSİni
tutuyorsa (yani CompanyId bir *veri* değil, bir *yetki tanımı* ise), o tabloya
RLS eklenmemeli — `Sirketler`, `UserCompanies`, `UserRoles` bu kategoridedir.

## ⚠️ ÖNEMLİ DERS: Kod ile gerçek şema arasındaki farklar

2026-09 tarihli bir hata ayıklama oturumunda, kod tabanının bazı
bölümlerinin **hiç test edilmemiş** olduğu ve gerçek veritabanı şemasından
önemli ölçüde saptığı ortaya çıktı. Özetle bulunanlar:

- **`Siparisler.SiparisYonu` kolonu hiç yoktu.** `server.js`'teki ana "Yeni
  Sipariş" formu (`POST /api/siparisler`), teklif→sipariş dönüşümü, platform
  toplu içe aktarma, `salesFlowRoutes.js`'in tamamı (`/orders`, `/reserve`,
  `/dispatch`), ve KolayBi materializasyonu — hepsi bu kolona yazıyor/okuyordu.
  Muhtemelen satın alma `SatinAlmaSiparisleriV2`'ye taşındığından beri
  `Siparisler` zaten sadece satış siparişi tutuyor, "yön" kolonuna hiç gerek
  kalmamıştı ama kolon kaldırılırken onu kullanan kod hiç güncellenmemişti.
  **Tümü temizlendi** (bkz. commit `c0b4710`).
- **Ana sipariş formu ayrıca `TeslimatSekli`, `PaketlemeSekli`,
  `LojistikDetay`, `SiparisVerenDepartman` gibi var olmayan kolonlara da
  yazıyordu**, üstelik `NOT NULL` olan `Durum`/`OnayDurumu`'nu hiç
  sağlamıyordu. Yani bu form muhtemelen bu veritabanında **hiçbir zaman
  başarıyla çalışmamıştı**.
- `MuhasebeFisleri.FisId` `BIGINT`, ama İK avansı entegrasyon kodu `INT`
  varsaymıştı (bkz. `046`).
- `PlatformSiparisler.CompanyId` `NOT NULL` ama `DEFAULT` kısıtı yoktu
  (bkz. `047`).

**Genel kural**: Var olan bir tabloya yeni bir `INSERT`/`UPDATE` eklerken
ya da değiştirirken, **önce gerçek şemayı sorgulayın** — kod içindeki başka
bir yerde aynı tabloya yazan kodun doğru olduğunu varsaymayın, o da yanlış
olabilir. Bunun için `sql/diagnostics/tablo_zorunlu_kolonlar_sablonu.sql`
kullanılabilir.

## Tanı ve Bakım Script'leri

`erp-backend/sql/diagnostics/` klasöründe, bu tür sorunları hızlıca teşhis
etmek için tekrar kullanılabilir, salt-okunur script'ler var — bkz.
[`sql/diagnostics/README.md`](./erp-backend/sql/diagnostics/README.md).

## `erp-backend/sql/` (001–048)

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

## ⚠️ ÖNEMLİ KURAL: 041'den sonraki migration'larda çok-şirketli seed INSERT

`041` ile `SecurityPolicy_CompanyIsolation` aktif hale geldikten (STATE=ON)
sonra yazılan migration'larda, birden fazla şirkete aynı anda veri ekleyen
(`INSERT ... SELECT ... FROM dbo.Sirketler`) bir adım varsa, bu SSMS'te
normal şekilde çalıştırıldığında **başarısız olur** — çünkü SSMS oturumunda
`SESSION_CONTEXT('CompanyId')` hiç ayarlanmamıştır ve block predicate tüm
şirketler için `NULL = CompanyId` karşılaştırması yapıp isteği reddeder
(bkz. `046_IK_AVANS_MUHASEBE.sql`'in ilk sürümünde yaşanan hata).

**Çözüm deseni** (046 v2'de uygulanan, gelecekte de kullanılmalı):
```sql
DECLARE @PolicyWasOn BIT = 0;
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name=N'SecurityPolicy_CompanyIsolation' AND is_enabled=1) SET @PolicyWasOn=1;
BEGIN TRY
    IF @PolicyWasOn=1 ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation WITH (STATE=OFF);
    -- ... çok şirketli INSERT'ler burada ...
    IF @PolicyWasOn=1 ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation WITH (STATE=ON);
END TRY
BEGIN CATCH
    IF @PolicyWasOn=1 AND EXISTS(SELECT 1 FROM sys.security_policies WHERE name=N'SecurityPolicy_CompanyIsolation' AND is_enabled=0)
        ALTER SECURITY POLICY dbo.SecurityPolicy_CompanyIsolation WITH (STATE=ON);
    THROW;
END CATCH
```
RLS'in kapalı kaldığı pencere en aza indirilmeli (sadece o INSERT'ler) ve
CATCH bloğu RLS'i her durumda tekrar açtığından emin olmalı.

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
