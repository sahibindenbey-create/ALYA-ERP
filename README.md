# ALYA ERP

Sahibinden Bey's Space için geliştirilen, çok şirketli (multi-tenant) kurumsal
kaynak planlama (ERP) sistemi. React tabanlı bir arayüz ve Node.js/Express +
MSSQL tabanlı bir backend'den oluşur; KolayBi muhasebe/e-fatura platformu ve
GİB mükellef sorgu servisleriyle entegre çalışır.

## İçindekiler

- [Mimari](#mimari)
- [Klasör Yapısı](#klasör-yapısı)
- [Modüller](#modüller)
- [Entegrasyonlar](#entegrasyonlar)
- [Çok Şirketli Yapı ve Güvenlik](#çok-şirketli-yapı-ve-güvenlik)
- [Kurulum](#kurulum)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [Veritabanı Migration'ları](#veritabanı-migrationları)
- [Bilinen Kısıtlar / Yapılacaklar](#bilinen-kısıtlar--yapılacaklar)

## Mimari

```
┌─────────────────┐        REST/JSON        ┌──────────────────┐        ┌───────────────┐
│  erp-frontend    │  ───────────────────►   │   erp-backend     │  ───►  │  MSSQL         │
│  React 18 (CRA)  │  ◄───────────────────   │  Node.js/Express  │        │  (mssql /      │
│  react-router-dom│      X-Company-Id       │  ~55 route modülü │        │   msnodesqlv8) │
└─────────────────┘      + Bearer token      └──────────────────┘        └───────────────┘
                                                       │
                                                       ▼
                                            ┌──────────────────────┐
                                            │ Dış entegrasyonlar    │
                                            │ • KolayBi (muhasebe)  │
                                            │ • GİB / QNB eSolutions│
                                            │   (mükellef sorgu)    │
                                            └──────────────────────┘
```

- **Frontend**: `create-react-app`, Material UI, `axios` ile backend'e bağlanır.
  Her istekte aktif şirketi belirten `X-Company-Id` header'ı ve oturum
  token'ı (`Authorization: Bearer ...`) otomatik eklenir (`src/index.js`
  içindeki axios interceptor). Login akışı `POST /api/core/auth/login`
  (`core/coreRoutes.js`) üzerinden token alır; bu token olmadan hiçbir
  `/api/*` uç noktasına erişilemez.
- **Backend**: `server.js` ana giriş noktası; çoğu modül `core/` altında ayrı
  route dosyaları olarak organize edilmiştir. `company-context-hook.js`,
  Express ve `mssql` kütüphanelerini "monkey-patch" ederek her isteğin şirket
  bağlamını (`SESSION_CONTEXT('CompanyId')`) otomatik SQL oturumuna taşır.
  `server.js`'te doğrudan tanımlı legacy route'lar (Cariler, İrsaliyeler,
  Faturalar vb.) merkezi bir auth kapısından (`legacyAuthGate`) geçer;
  `core/` altındaki modüller kendi router'larında ayrıca
  `createAuthMiddleware` + (çoğunda) `requirePermission` kullanır.
- **Veritabanı**: MSSQL. Şema değişiklikleri numaralı migration dosyaları
  olarak tutulur. **İki ayrı migration klasörü** (kök `sql/` ve
  `erp-backend/sql/`) ve aralarındaki ilişki için bkz. [`MIGRATIONS.md`](./MIGRATIONS.md)
  — yeni bir ortam kurarken önce o dosyayı okuyun.

## Klasör Yapısı

```
ALYA-ERP/
├── erp-backend/
│   ├── server.js              # Ana Express uygulaması, çoğu temel CRUD route burada
│   ├── company-context-hook.js# Şirket bağlamını SQL oturumuna otomatik enjekte eder
│   ├── db.js                  # DB bağlantısı + core router'ların otomatik yüklenmesi
│   ├── core/                  # Modül bazlı route dosyaları (bütçe, CRM, maliyet, security, ...)
│   ├── kolaybi*.js             # KolayBi entegrasyon modülleri (kökte, core/ dışında)
│   ├── sql/                   # Aktif migration klasörü (bkz. MIGRATIONS.md)
│   ├── uploads/                # Yüklenen dosyalar (auth arkasında sunulur)
│   └── .env                   # Ortam değişkenleri (repoya girmez)
├── erp-frontend/
│   ├── src/pages/              # ~105 sayfa/ekran bileşeni
│   ├── src/components/         # Paylaşılan bileşenler (CariForm, KolaybiLinkPanel, ...)
│   ├── src/theme.css           # Ortak tasarım dili (renk/boşluk/tipografi token'ları)
│   └── src/data/               # Statik referans verisi (il/ilçe, vergi daireleri, ...)
├── sql/                        # İlk kurulum migration'ları — bkz. MIGRATIONS.md
└── MIGRATIONS.md               # İki sql/ klasörünün ilişkisi ve doğru çalıştırma sırası
```

## Modüller

`erp-backend/core/` altındaki route dosyalarına göre sistemde aktif olan
başlıca iş alanları:

| Alan | Örnek dosyalar |
|---|---|
| Bütçe & Finans | `budgetFlowRoutes`, `budgetApprovalRoutes`, `budgetForecastRoutes`, `budgetScenarioCreateRoutes`, `financeFlowRoutes`, `detailCashflowRoutes` |
| Cari & Satış | `cariDetailRoutes`, `cariDetailRefreshRoutes`, `salesFlowRoutes`, `invoiceDetailRoutes` |
| Satın Alma & Maliyetlendirme | `procurementFlowRoutes`, `costingFlowRoutes`, `costingPurchaseRoutes`, `costingValuationRoutes`, `costingCompletionRoutes` |
| CRM | `crmLeadRoutes`, `crmOpportunityRoutes`, `crmCampaignRoutes`, `crmActivityRoutes`, `crmFlowRoutes` |
| Üretim & Kalite | `productionExecutionRoutes`, `mrpFlowRoutes`, `qualityFlowRoutes`, `subcontractingFlowRoutes` |
| Stok | `stockCoreRoutes`, `stockOperationsRoutes` |
| Sabit Kıymet | `fixedAssetRegisterRoutes`, `fixedAssetDepreciationRoutes`, `fixedAssetLifecycleRoutes` |
| İK | `hrFlowRoutes` |
| Pazaryeri | `marketplaceFlowRoutes` |
| GİB Sorgu | `gibTaxpayerRoutes` (VKN/TCKN ile otomatik mükellef bilgisi) |
| Kimlik & Yetki | `security.js` (token/izin altyapısı), `coreRoutes.js` (login, kullanıcı, denetim kaydı) |

Cari kart, irsaliye (satış/alış) ve bazı diğer temel CRUD ekranları ise
`erp-backend/server.js` içinde doğrudan tanımlıdır (henüz `core/` altına
taşınmamış legacy route'lar) — bunlar artık merkezi `legacyAuthGate`
middleware'i ile korunuyor, ayrıca bkz. [Çok Şirketli Yapı ve Güvenlik](#çok-şirketli-yapı-ve-güvenlik).

## Entegrasyonlar

### KolayBi

`kolaybi*.js` dosyaları (repo kökünde) KolayBi'nin `ofis-api.kolaybi.com`
REST API'siyle konuşur:

- `kolaybi-fatura-sync.js`, `kolaybi-waybill-sync.js` — fatura ve irsaliye
  senkronizasyonu
- `kolaybi-e-document.js`, `kolaybi-waybill-edocument-sync.js` — e-belge
  gönderimi/takibi
- `kolaybi-full-sync.js`, `kolaybi-erp-sync.js` — genel/toplu senkronizasyon
- `kolaybi-invoice-actions.js` — fatura üzerinde aksiyon (onay/iptal vb.)
- `kolaybi-credentials.js` — **tek kimlik bilgisi kaynağı**: `.env`'deki
  `KOLAYBI_YAMANKAYA_API_KEY` / `_CHANNEL` / `_BASE_URL` değerleri, veritabanı
  (`dbo.KolaybiAyarlar`) üzerindeki değerlerin önüne geçer. Tüm senkronizasyon
  dosyaları kimlik bilgisini bu tek yardımcıdan alır.

### GİB Mükellef Sorgusu

`core/gibTaxpayerRoutes.js`, cari kart ekranında Vergi No/TC No girildiğinde
otomatik ünvan/vergi dairesi/adres doldurmak için `GET /api/gib-taxpayer/:number`
uç noktasını sağlar. Aşağıdaki sağlayıcılardan **yapılandırılmış olan ilkini**
kullanır:

1. **QNB eSolutions** (Özel Entegratör, SOAP) — `QNB_ESOLUTIONS_*`
2. **Genel REST şablonu** — `GIB_LOOKUP_URL_TEMPLATE`
3. **mukellef.info** — `MUKELLEF_INFO_API_KEY`

Hiçbiri tanımlı değilse uç nokta `503 GIB_NOT_CONFIGURED` döner.

## Çok Şirketli Yapı ve Güvenlik

Sistem tek veritabanı üzerinde birden fazla şirketi (ör. ALYA, Mono) izole
şekilde barındırır. Bu izolasyon **iki katmanda** sağlanır — ikisi de şart:

### 1) Uygulama katmanı — "kim, hangi şirkete erişebilir?"

- Login (`POST /api/core/auth/login`) başarılı olursa `core/security.js`
  imzalı bir oturum token'ı (`createSessionToken`) üretir; frontend bunu
  `Authorization: Bearer ...` olarak her istekte gönderir.
- `core/` altındaki route'lar kendi router'larında `createAuthMiddleware`
  (token + kullanıcının o `X-Company-Id`'ye gerçekten yetkili olup olmadığını
  `loadSecurityContext` ile doğrular) kullanır; çoğu ayrıca `requirePermission('...')`
  ile ince taneli yetki kontrolü yapar.
- `server.js`'teki legacy route'lar (Cariler, İrsaliyeler, Faturalar,
  Siparişler, Stok, Üretim, Fason, Kasa/Banka, Personel, Reçeteler vb.) aynı
  `createAuthMiddleware`'i merkezi bir `legacyAuthGate` olarak kullanır —
  bu olmadan **hiçbir** `/api/*` isteği (ve `/uploads/*` dosya indirmeleri)
  kabul edilmez.
- Login'e brute-force koruması var: IP + kullanıcı adı başına 15 dakikada
  en fazla 5 başarısız deneme (bkz. `core/coreRoutes.js`).

### 2) Veritabanı katmanı — Row-Level Security (RLS)

- `company-context-hook.js`, doğrulanmış `X-Company-Id` değerini her SQL
  sorgusundan önce `EXEC sys.sp_set_session_context @key=N'CompanyId', ...`
  ile oturuma yazar.
- **`dbo.SecurityPolicy_CompanyIsolation`** (bkz. [`MIGRATIONS.md`](./MIGRATIONS.md))
  bu bağlama göre tabloları otomatik filtreler — uygulama kodu ayrıca
  `WHERE CompanyId=...` yazmayı unutsa bile veri sızıntısı önlenir. 2026-09-17
  itibarıyla 125'ten fazla tablo bu politika altında.
- `Sirketler` tablosu **bilinçli olarak** bu politikanın dışında tutulur —
  şirket seçicinin tüm şirketleri listeleyebilmesi gerekir.

**Neden ikisi birden gerekli?** RLS tek başına yalnızca "oturumdaki
CompanyId doğru mu" sorusuna güvenir. Uygulama katmanındaki doğrulama
olmadan, herhangi biri `X-Company-Id` header'ını değiştirerek RLS'in
"doğru" kabul ettiği şirketi kendisi seçebilirdi.

Yeni bir CRUD route yazarken:

```sql
-- Doğru:
SELECT * FROM Tablo WHERE CompanyId = CAST(SESSION_CONTEXT(N'CompanyId') AS INT)

-- Yanlış (RLS aktif değilse şirketler arası veri sızdırır):
SELECT * FROM Tablo
```

## Kurulum

### Gereksinimler

- Node.js 18+ (backend native `fetch` kullanır)
- MSSQL Server erişimi (SQL auth veya Windows auth — `msnodesqlv8`/`mssql`)
- KolayBi hesabı (isteğe bağlı, entegrasyon için)
- QNB eSolutions veya mukellef.info hesabı (isteğe bağlı, GİB sorgusu için)

### Backend

```bash
cd erp-backend
npm install
cp .env.gib.example .env   # ve gerekli diğer değişkenleri doldurun
npm start
```

Production'da `ERP_SESSION_SECRET` ortam değişkeni **en az 32 karakter**
olmalı — aksi halde uygulama başlarken hata verir (`core/security.js`).

### Frontend

```bash
cd erp-frontend
npm install
npm start
```

Frontend varsayılan olarak `http://localhost:5000/api` adresine (ya da
`REACT_APP_API_URL` ortam değişkenine) istek atar.

## Ortam Değişkenleri

`erp-backend/.env` dosyasında tutulması gereken başlıca değişkenler:

```ini
# Veritabanı
DB_SERVER=
DB_DATABASE=
DB_USER=
DB_PASSWORD=

# Oturum / token imzalama (production'da ZORUNLU, en az 32 karakter)
ERP_SESSION_SECRET=

# KolayBi (Yamankaya / canlı hesap)
KOLAYBI_YAMANKAYA_API_KEY=
KOLAYBI_YAMANKAYA_CHANNEL=
KOLAYBI_YAMANKAYA_BASE_URL=

# GİB mükellef sorgusu — bkz. erp-backend/.env.gib.example
QNB_ESOLUTIONS_SOAP_URL=
QNB_ESOLUTIONS_USERNAME=
QNB_ESOLUTIONS_PASSWORD=
QNB_ESOLUTIONS_SOAP_ACTION=
# veya
GIB_LOOKUP_URL_TEMPLATE=
GIB_LOOKUP_API_KEY=
# veya
MUKELLEF_INFO_API_KEY=
```

> `.env` dosyasını **asla** repoya eklemeyin / commit etmeyin. API anahtarları
> yalnızca kendi sunucunuzdaki bu dosyada tutulmalıdır. (2026-09-17 itibarıyla
> repo'nun 380 commit'lik tam geçmişi tarandı; `.env` hiçbir zaman commit
> edilmemiş ve bilinen anahtar imzalarına rastlanmadı.)

## Veritabanı Migration'ları

**Önce [`MIGRATIONS.md`](./MIGRATIONS.md) dosyasını okuyun** — iki ayrı
migration klasörü (kök `sql/` ve `erp-backend/sql/`) var ve aralarındaki
ilişki, doğru çalıştırma sırası orada anlatılıyor.

Yeni bir migration eklerken:

1. `erp-backend/sql/` altında bir sonraki sıra numarasını kullanın.
2. Idempotent yazın (`IF NOT EXISTS` / `IF OBJECT_ID(...) IS NULL` kontrolleri).
3. Şirket bazlı bir tablo ekliyorsanız `CompanyId` kolonunu ve
   `dbo.fn_CompanyIsolationPredicate` tabanlı RLS predicate'lerini de ekleyin
   (bkz. `erp-backend/sql/044_COMPANY_ISOLATION_RECONCILIATION.sql`).
4. `Sirketler` gibi "referans/lookup" tablolarını (CompanyId kendi kimliği
   olan tablolar) RLS kapsamına almayın.

## Bilinen Kısıtlar / Yapılacaklar

- `/uploads/*` altındaki dosyalar artık geçerli bir oturum gerektiriyor,
  ama "bu dosya gerçekten bu kullanıcının şirketine mi ait" doğrulaması
  henüz yok (yalnızca "oturum açık mı" kontrol ediliyor). Dosya yolunun
  hangi `CariEvrak`/`UrunDosya`/`IhracatEvrak` kaydına ait olduğu ve o
  kaydın `CompanyId`'sinin istek sahibiyle eşleştiği ayrıca doğrulanmalı.
- `kolaybiBusinessMaterializationRoutes.js`'deki (yalnızca Şirket 2/
  Yamankaya'ya özel) KolayBi sipariş materializasyonu, `Siparisler.SiparisYonu`
  kolonu kaldırılınca "Alış" yönlü KolayBi kayıtlarını da `Siparisler`'e
  (artık yalnızca-satış tablosu) yazar hale geldi — semantik olarak yanlış,
  ayrı bir düzeltme gerektiriyor (muhtemelen `SatinAlmaSiparisleriV2`'ye
  yönlendirilmeli).
- Kod tabanı ile gerçek veritabanı şeması arasında zaman zaman farklar
  bulunuyor (bkz. [`MIGRATIONS.md`](./MIGRATIONS.md) — "Kod ile gerçek şema
  arasındaki farklar"). Yeni bir tabloya yazan kod eklerken/değiştirirken
  önce `erp-backend/sql/diagnostics/tablo_zorunlu_kolonlar_sablonu.sql` ile
  gerçek şemayı doğrulayın.
- İrsaliye detay görünümü ve şirket izolasyonu düzeltmeleri uygulandıktan
  sonra Faturalar, Siparişler gibi diğer modüllerde de benzer eksik
  `CompanyId` filtrelerinin olup olmadığı taranmalı.

---

*Bu doküman, proje üzerinde yapılan inceleme ve düzeltmeler sırasında
derlenmiştir; kod tabanındaki değişikliklere göre güncel tutulmalıdır.*
