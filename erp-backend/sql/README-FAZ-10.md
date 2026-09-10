# Faz 10 — Sabit Kıymet ve Amortisman

## Kurulum sırası
1. Faz 0–9 migrationlarının kurulu olduğundan emin olun.
2. SSMS ile doğru veritabanını (`myERP`) seçin.
3. `022_FIXED_ASSET_CHAIN.sql` dosyasını çalıştırın.
4. `022 sabit kıymet ve amortisman zinciri tamamlandı.` mesajını doğrulayın.
5. Backend'i `npm start` ile yeniden başlatın.
6. Arayüzde `/dashboard/sabit-kimyet` adresini açın.

Migration veri silmez ve tekrar çalıştırılabilir. Yeni tablolar, hesap planı kayıtları, varsayılan kategoriler ve belge numara serileri yalnızca eksikse oluşturulur.

## İşlem sırası
1. Sabit kıymet kartını oluşturun.
2. Kıymeti açık bir mali dönem tarihinde aktifleştirin.
3. Gerekirse zimmet/lokasyon kaydı girin.
4. Amortisman planını üretin.
5. Yıl ve ay seçerek dönem amortismanını muhasebeleştirin.
6. Değer artışı/düşüklüğü hareketlerini kaydedin.
7. Satış veya hurda işleminde dengeli muhasebe fişi üretin.

## API
- `GET /api/fixed-assets/overview?year=2026`
- `POST /api/fixed-assets/categories`
- `POST /api/fixed-assets/assets`
- `POST /api/fixed-assets/assets/:id/activate`
- `POST /api/fixed-assets/assets/:id/assignments`
- `POST /api/fixed-assets/assets/:id/value-adjustments`
- `POST /api/fixed-assets/assets/:id/depreciation-plan`
- `POST /api/fixed-assets/depreciation/post`
- `POST /api/fixed-assets/assets/:id/disposals`
