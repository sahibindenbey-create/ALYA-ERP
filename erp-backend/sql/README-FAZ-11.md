# Faz 11 — CRM Satış Hunisi

## Kurulum
1. Faz 0–10 migrationlarının kurulu olduğundan emin olun.
2. SSMS'de `myERP` veritabanını seçin.
3. `023_CRM_SALES_PIPELINE.sql` dosyasını çalıştırın.
4. `023 CRM satış hunisi zinciri tamamlandı.` sonucunu doğrulayın.
5. Backend'i `npm start` ile yeniden başlatın.
6. `/dashboard/satis-firsatlari` ekranını açın.

Migration veri silmez ve tekrar çalıştırılabilir.

## Zincir
Aday müşteri → Niteliklendirme → Fırsat → Aktivite → Aşama → Kazanım/Kayıp → Satış siparişi bağlantısı

## API
- `GET /api/crm/overview`
- `POST /api/crm/leads`
- `POST /api/crm/leads/:id/status`
- `POST /api/crm/leads/:id/opportunities`
- `POST /api/crm/opportunities/:id/stage`
- `POST /api/crm/opportunities/:id/win`
- `POST /api/crm/activities`
- `POST /api/crm/activities/:id/complete`
- `POST /api/crm/campaigns`
- `POST /api/crm/campaigns/:id/leads`
