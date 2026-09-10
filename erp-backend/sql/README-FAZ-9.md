# ALYA ERP — Faz 9 Bütçe ve Nakit Akış Tahmini

Bu paket muhasebe gerçekleşmelerini yıllık/aylık bütçeye bağlar ve açık satış faturaları, satın alma siparişleri ile manuel kalemlerden olasılık ağırlıklı nakit tahmini üretir. Mevcut iş kayıtlarını silmez.

## Ön koşullar
- Faz 0 çekirdek
- Faz 3 finans/muhasebe
- Faz 5 satın alma

## Kurulum
1. `sql/021_BUDGET_CASH_FORECAST_CHAIN.sql` dosyasını önce kopya veritabanında çalıştırın.
2. `erp-backend/core/budget*Routes.js` dosyalarını projeye kopyalayın.
3. `costingFlowRoutes.js`, Faz 9 rotalarını `/api/budget-flow` altında kaydeder.
4. `BudgetControlPanel.js/.css`, `BudgetSummary.js` ve `BudgetDetailGrid.js` dosyalarını frontend sayfalarına kopyalayın.
5. `ModulePlaceholder.js`, menüdeki `butce` modülünü gerçek bütçe ekranına yönlendirir.
6. `/dashboard/butce` adresini açın.

## Tamamlanan süreç
- Baz, iyimser ve kötümser yıllık bütçe senaryoları
- 12 aylık gelir, gider, nakit giriş ve nakit çıkış şablonu
- Hesap kodu öneki bazında gerçekleşen muhasebe tutarı
- Aylık ve toplam plan/gerçekleşen/sapma analizi
- Taslak bütçe düzenleme ve onaylama
- Açık satış faturalarından olasılık ağırlıklı nakit girişi
- Açık satın alma siparişlerinden olasılık ağırlıklı nakit çıkışı
- Manuel ileri tarihli nakit giriş/çıkış kalemleri
- 7–365 günlük nakit tahmin ufku
- Tekrarlanan tahmin isteğine karşı işlem anahtarı
- Şirket, mali dönem, yetki, belge numarası ve audit kontrolleri

## Oluşan tablolar
- `ButceSenaryolari`
- `ButceKalemleri`
- `NakitTahminleri`
- `NakitTahminKalemleri`
- `NakitTahminManuelKalemleri`

## Doğrulama
`python3 verify-phase9.py`

Canlıya geçmeden önce hesap kodu önekleri şirketin gerçek hesap planıyla eşleştirilmelidir. Satın alma ödeme vadeleri için bu sürüm beklenen teslim tarihine 30 gün ekler; tedarikçi sözleşme vadeleri ileride kalem bazına indirilebilir.
