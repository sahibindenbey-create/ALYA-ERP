# ALYA ERP — Faz 0 çekirdek altyapısı

Bu değişiklik seti şirket bazlı rol/yetki, kullanıcı-şirket erişimi, mali dönem kilidi, belge numara serileri, audit kayıtları ve onay akışı tablolarını ekler.

## Kurulum
1. Veritabanını yedekleyin.
2. `sql/011_ERP_CORE_PHASE0.sql` dosyasını çalıştırın.
3. Backend `.env` dosyasına en az 32 karakterlik rastgele `ERP_SESSION_SECRET` ekleyin.
4. `erp-backend` altında `npm test` çalıştırın.
5. Backend ve frontend'i yeniden başlatın.

## Uyumluluk ve güvenlik
- Migration mevcut iş verisini silmez ve tekrar çalıştırılabilir.
- Eski `/api/auth/*` uçları uyumluluk için korunur; kullanıcı yönetimi uçları Bearer oturumu ve `core.user.manage` yetkisi ister.
- Güvenli uçlar `/api/core/*` altındadır.
- Mevcut rol ve kullanıcılar yeni şirket erişim modeline taşınır.
- Şirket seçimi `X-Company-Id` ile devam eder.
- Her güvenli istekte kullanıcı, şirket ve izinler veritabanından yeniden doğrulanır.

## İlk API'ler
- `POST /api/core/auth/login`
- `GET /api/core/auth/me`
- `GET /api/core/companies`
- `GET /api/core/admin/overview`
- `PUT /api/core/admin/users/:id/access`
- `POST /api/core/admin/fiscal-periods`
- `POST /api/core/admin/number-series`
- `POST /api/core/number-series/:documentType/next`
- `POST /api/core/periods/check`
- `GET /api/core/audit-logs`

Mevcut iş modülleri sonraki commitlerde `assertPeriodOpen`, `nextDocumentNumber`, `writeAudit` ve permission middleware'ine bağlanacaktır.
