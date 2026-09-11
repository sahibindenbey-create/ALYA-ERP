# Faz 14 — Fason Üretim Yönetimi

## Kurulum

`025_SUBCONTRACTING_CHAIN.sql` dosyasını `myERP` üzerinde bir kez çalıştırın. Migration tekrar çalıştırılabilir ve mevcut veriyi silmez.

## Süreç

1. Fason iş emri açılır.
2. İş emrine gönderilecek malzemeler eklenir.
3. Emir onaylanarak serbest bırakılır.
4. Malzemeler FIFO stok tahsisiyle fason tedarikçiye sevk edilir; merkezi stok azalır ve fason sevk hareketi yazılır.
5. Kısmi veya tam fason kabul yapılır.
6. Onaylı mamul kullanılabilir, kalite bekleyen mamul bloke stok olarak hedef depoya girer.
7. Fason hizmet maliyeti kabul miktarı × birim fiyat olarak kaydedilir.

## API

- `GET /api/subcontracting/overview`
- `POST /api/subcontracting/orders`
- `POST /api/subcontracting/orders/:id/materials`
- `POST /api/subcontracting/orders/:id/release`
- `POST /api/subcontracting/orders/:id/shipments`
- `POST /api/subcontracting/orders/:id/receipts`
