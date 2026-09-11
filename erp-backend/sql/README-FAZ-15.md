# Faz 15 — Satılabilir Stok, ATP ve Yeniden Sipariş

`026_AVAILABLE_STOCK_ATP_CHAIN.sql` dosyasını `myERP` üzerinde çalıştırın.

Hesap: fiziksel stok − rezervasyon − bloke − açık satış + açık satın alma + açık üretim + beklenen giriş − beklenen çıkış.

- Stok politikası: minimum, maksimum, emniyet stoğu, yeniden sipariş noktası, tedarik tipi ve süresi.
- ATP: talep miktarının hemen, ileri tarihte veya yetersiz olarak değerlendirilmesi.
- Kritik stok: projeksiyon yeniden sipariş noktasının altındaysa önerilen tedarik miktarı üretir.

API:
- `GET /api/availability/overview`
- `PUT /api/availability/policies/:productId`
- `POST /api/availability/atp-check`
