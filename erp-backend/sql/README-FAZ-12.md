# Faz 12 — Personel / İnsan Kaynakları

## Kurulum

1. SSMS ile `myERP` veritabanını seçin.
2. `024_HR_WORKFORCE_CHAIN.sql` dosyasını çalıştırın.
3. Backend'i yeniden başlatın.

Beklenen mesaj: `024 İK organizasyon ve çalışan yönetimi zinciri tamamlandı.`

## Kapsam

- Mevcut Personel, izin, puantaj ve parametrik bordro altyapısı korunur.
- Şirket bazlı departman ve görev yönetimi
- Tarihçeli personel organizasyon ataması
- Mesai kaydı ve onayı
- Avans talebi ve onayı
- Performans değerlendirmesi
- Eğitim ve katılımcı yönetimi
- Yetki ve denetim altyapısıyla uyum

## API

- `GET /api/hr/overview`
- `POST /api/hr/departments`
- `POST /api/hr/positions`
- `POST /api/hr/assignments`
- `POST /api/hr/overtimes`
- `POST /api/hr/overtimes/:id/decision`
- `POST /api/hr/advances`
- `POST /api/hr/advances/:id/decision`
- `POST /api/hr/performance`
- `POST /api/hr/trainings`
- `POST /api/hr/trainings/:id/participants`
