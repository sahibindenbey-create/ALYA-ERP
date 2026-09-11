# Faz 18 — Yamankaya KolayBi canlı pilotu

## Sıra
1. `028_KOLAYBI_YAMANKAYA_LIVE.sql`
2. `029_KOLAYBI_YAMANKAYA_CARI_SYNC.sql`
3. `030_KOLAYBI_FULL_MIRROR.sql`

API bilgileri yalnız `erp-backend/.env` dosyasında tutulur. Canlı pilot sadece CompanyId 2 Yamankaya için çalışır.

## Veri akışı
- Cari planı ve cari aktarımı `CariListesi` ile kontrollü eşleme yapar.
- Tam veri aynası; şirket, kullanıcı, cari, ürün, proforma, sipariş, dört fatura türü, kasa/banka ve erişilebilen hareket yanıtlarını `KolaybiRawMirror` tablosunda tam JSON olarak saklar.
- Desteklenmeyen veya yetki verilmeyen API kaynakları tüm çalışmayı bozmaz; çalışma `PARTIAL` olur ve kaynak hataları özetlenir.
- Ham ayna doğrulandıktan sonra ürün ve belge verileri ALYA iş tablolarına ayrı idempotent dönüşüm adımlarıyla alınır.
- Gerçek API anahtarı, Channel ve access token hiçbir migration veya GitHub dosyasında bulunmaz.
