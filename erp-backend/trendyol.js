const registerTrendyol = ({ app, poolPromise, sql }) => {
  const marketplaceBridge = require('./core/marketplaceFlowRoutes');
  const sellerId = process.env.TRENDYOL_SELLER_ID;
  const apiKey = process.env.TRENDYOL_API_KEY;
  const apiSecret = process.env.TRENDYOL_API_SECRET;

  const baseUrl = (
    process.env.TRENDYOL_BASE_URL ||
    'https://apigw.trendyol.com'
  ).replace(/\/$/, '');

  const configured = () => {
    return Boolean(sellerId && apiKey && apiSecret);
  };

  const auth = () => {
    const credentials = `${apiKey}:${apiSecret}`;
    return `Basic ${Buffer.from(credentials).toString('base64')}`;
  };

  // ---------------------------------------------------------
  // TRENDYOL API İSTEK FONKSİYONU
  // ---------------------------------------------------------

  async function request(path, query = {}) {
    if (!configured()) {
      throw Object.assign(
        new Error(
          'Trendyol API bilgileri .env içinde tanımlı değil.'
        ),
        { status: 503 }
      );
    }

    const url = new URL(`${baseUrl}${path}`);

    Object.entries(query).forEach(([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        value !== ''
      ) {
        url.searchParams.set(key, String(value));
      }
    });

    console.log('Trendyol API:', url.toString());

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: auth(),
        Accept: 'application/json',
        'User-Agent': 'ALYA-ERP'
      }
    });

    const text = await response.text();

    let body;

    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {
        raw: text
      };
    }

    if (!response.ok) {
      throw Object.assign(
        new Error(
          body?.message ||
          `Trendyol HTTP ${response.status}`
        ),
        {
          status: response.status,
          body
        }
      );
    }

    return body;
  }

  // ---------------------------------------------------------
  // TRENDYOL BAĞLANTI DURUMU
  // ---------------------------------------------------------

  app.get(
    '/api/platformlar/trendyol/durum',
    (req, res) => {
      res.json({
        platform: 'Trendyol',
        configured: configured(),
        sellerId: sellerId || null
      });
    }
  );

  // ---------------------------------------------------------
  // TRENDYOL SİPARİŞLERİ
  // ---------------------------------------------------------

  app.get(
    '/api/platformlar/trendyol/siparisler',
    async (req, res) => {
      try {
        const now = Date.now();

        const startDate = Number(
          req.query.startDate ||
          (now - 7 * 24 * 60 * 60 * 1000)
        );

        const endDate = Number(
          req.query.endDate || now
        );

        const page = Number(
          req.query.page || 0
        );

        const size = Math.min(
          Number(req.query.size || 50),
          200
        );

        const query = {
          startDate,
          endDate,
          page,
          size,
          orderByField:
            req.query.orderByField ||
            'PackageLastModifiedDate',
          orderByDirection:
            req.query.orderByDirection ||
            'DESC'
        };

        if (req.query.status) {
          query.status = req.query.status;
        }

        const data = await request(
          `/integration/order/sellers/${encodeURIComponent(
            sellerId
          )}/v2/orders`,
          query
        );

        res.json(data);

      } catch (error) {
        console.error(
          'Trendyol sipariş hatası:',
          error
        );

        res.status(
          error.status || 500
        ).json({
          error:
            'Trendyol siparişleri alınamadı',
          detail: error.message,
          trendyol:
            error.body || null
        });
      }
    }
  );

  // ---------------------------------------------------------
  // TRENDYOL ORDER STREAM
  // ---------------------------------------------------------

  app.get(
    '/api/platformlar/trendyol/siparisler/stream',
    async (req, res) => {
      try {
        const query = {
          size: Math.min(
            Number(req.query.size || 50),
            200
          )
        };

        if (req.query.nextCursor) {
          query.nextCursor =
            req.query.nextCursor;
        }

        if (req.query.packageItemStatuses) {
          query.packageItemStatuses =
            req.query.packageItemStatuses;
        }

        if (req.query.lastModifiedStartDate) {
          query.lastModifiedStartDate =
            Number(
              req.query.lastModifiedStartDate
            );
        }

        if (req.query.lastModifiedEndDate) {
          query.lastModifiedEndDate =
            Number(
              req.query.lastModifiedEndDate
            );
        }

        const data = await request(
          `/integration/order/sellers/${encodeURIComponent(
            sellerId
          )}/orders/stream`,
          query
        );

        res.json(data);

      } catch (error) {
        console.error(
          'Trendyol stream hatası:',
          error
        );

        res.status(
          error.status || 500
        ).json({
          error:
            'Trendyol sipariş stream alınamadı',
          detail: error.message,
          trendyol:
            error.body || null
        });
      }
    }
  );

  // ---------------------------------------------------------
  // TRENDYOL SİPARİŞLERİNİ SQL'E AKTAR
  // ---------------------------------------------------------

  app.post(
    '/api/platformlar/trendyol/senkronize',
    async (req, res) => {
      const packages =
        Array.isArray(req.body?.packages)
          ? req.body.packages
          : [];

      if (!packages.length) {
        return res.status(400).json({
          error:
            'İçe aktarılacak Trendyol paketi yok.'
        });
      }

      let pool;
      let transaction;

      try {
        pool = await poolPromise;

        transaction =
          new sql.Transaction(pool);

        await transaction.begin();

        let inserted = 0;
        let skipped = 0;

        for (const p of packages) {

          const packageId =
            p.shipmentPackageId ??
            p.id ??
            null;

          const orderNumber =
            p.orderNumber ||
            null;

          // -------------------------------------------------
          // DAHA ÖNCE AKTARILMIŞ MI?
          // -------------------------------------------------

          const exists =
            await new sql.Request(transaction)
              .input(
                'Platform',
                sql.NVarChar(50),
                'Trendyol'
              )
              .input(
                'ShipmentPackageId',
                sql.NVarChar(100),
                packageId
                  ? String(packageId)
                  : null
              )
              .input(
                'OrderNumber',
                sql.NVarChar(100),
                orderNumber
              )
              .query(`
                SELECT TOP 1
                  IntegrationId
                FROM PlatformSiparisler
                WHERE Platform = @Platform
                  AND
                  (
                    (
                      ShipmentPackageId =
                      @ShipmentPackageId
                      AND
                      @ShipmentPackageId IS NOT NULL
                    )
                    OR
                    (
                      OrderNumber =
                      @OrderNumber
                      AND
                      @OrderNumber IS NOT NULL
                    )
                  )
              `);

          if (exists.recordset.length) {
            skipped++;
            continue;
          }

          // -------------------------------------------------
          // SQL'E KAYDET
          // -------------------------------------------------

          await new sql.Request(transaction)
            .input(
              'Platform',
              sql.NVarChar(50),
              'Trendyol'
            )
            .input(
              'ShipmentPackageId',
              sql.NVarChar(100),
              packageId
                ? String(packageId)
                : null
            )
            .input(
              'OrderNumber',
              sql.NVarChar(100),
              orderNumber
            )
            .input(
              'Status',
              sql.NVarChar(50),
              p.status ||
              p.shipmentPackageStatus ||
              p.packageStatus ||
              null
            )
            .input(
              'RawJson',
              sql.NVarChar(sql.MAX),
              JSON.stringify(p)
            )
            .input(
              'PackageLastModifiedDate',
              sql.BigInt,
              Number(
                p.packageLastModifiedDate ||
                p.lastModifiedDate ||
                0
              )
            )
            .query(`
              INSERT INTO PlatformSiparisler
              (
                Platform,
                ShipmentPackageId,
                OrderNumber,
                Status,
                RawJson,
                PackageLastModifiedDate
              )
              VALUES
              (
                @Platform,
                @ShipmentPackageId,
                @OrderNumber,
                @Status,
                @RawJson,
                @PackageLastModifiedDate
              )
            `);

          inserted++;

          // ---------------------------------------------------------
          // BİRLEŞİK PAZARYERİ SİSTEMİNE KÖPRÜ (additive, best-effort)
          // -----------------------------------------------------------
          // Trendyol siparişini PazaryeriSiparisleriV2'ye de yazar, ürün
          // eşleşmesi tamsa otomatik Satış Siparişi'ne çevirip stoğu
          // düşürür (bkz. ALYA-ERP-VERI-AKISI-HARITASI.md, bulgu #1 ve #2).
          // Bu blok kasıtlı olarak KENDİ try/catch'i içinde: burada bir
          // sorun olursa yukarıdaki asıl PlatformSiparisler kaydı ve genel
          // senkronizasyon ETKİLENMEZ, sadece bu paket için yeni sistem
          // güncellemesi atlanır.
          try {
            const kanalId = await marketplaceBridge.ensureMarketplaceChannel(transaction, sql, req.companyId, 'TRENDYOL', 'Trendyol');
            const rawLines = Array.isArray(p.lines) ? p.lines : [];
            if (kanalId && rawLines.length) {
              const genelToplam = Number(p.packageTotalPrice ?? p.grossAmount ?? p.totalPrice ?? 0);
              const already = await new sql.Request(transaction).input('C', sql.Int, req.companyId).input('K', sql.BigInt, kanalId).input('N', sql.NVarChar(120), String(orderNumber || packageId))
                .query(`SELECT PazaryeriSiparisId FROM dbo.PazaryeriSiparisleriV2 WHERE CompanyId=@C AND KanalId=@K AND HariciSiparisNo=@N;`);
              let pazaryeriSiparisId = already.recordset[0]?.PazaryeriSiparisId;
              if (!pazaryeriSiparisId) {
                const insHeader = await new sql.Request(transaction).input('C', sql.Int, req.companyId).input('K', sql.BigInt, kanalId)
                  .input('N', sql.NVarChar(120), String(orderNumber || packageId)).input('M', sql.NVarChar(250), p.shipmentAddress?.fullName || null)
                  .input('D', sql.DateTime2, p.orderDate ? new Date(Number(p.orderDate)) : new Date()).input('T', sql.Decimal(18, 2), genelToplam)
                  .input('HD', sql.NVarChar(60), p.status || p.shipmentPackageStatus || p.packageStatus || null).input('J', sql.NVarChar(sql.MAX), JSON.stringify(p))
                  .query(`INSERT dbo.PazaryeriSiparisleriV2(CompanyId,KanalId,HariciSiparisNo,MusteriAdi,SiparisTarihi,ParaBirimi,GenelToplam,HariciDurum,RawJson)
                          OUTPUT INSERTED.PazaryeriSiparisId VALUES(@C,@K,@N,@M,@D,N'TRY',@T,@HD,@J);`);
                pazaryeriSiparisId = insHeader.recordset[0].PazaryeriSiparisId;
                for (const line of rawLines) {
                  const sku = String(line.stockCode || line.merchantSku || line.barcode || '').trim();
                  const qty = Number(line.quantity || 0);
                  const price = Number(line.lineUnitPrice ?? line.price ?? 0);
                  if (!sku || !(qty > 0)) continue;
                  await new sql.Request(transaction).input('C', sql.Int, req.companyId).input('H', sql.BigInt, pazaryeriSiparisId).input('K', sql.BigInt, kanalId)
                    .input('S', sql.NVarChar(120), sku).input('A', sql.NVarChar(250), line.productName || null).input('Q', sql.Decimal(18, 4), qty)
                    .input('F', sql.Decimal(18, 4), price).input('T', sql.Decimal(18, 2), qty * price)
                    .query(`DECLARE @P INT=(SELECT UrunId FROM dbo.PazaryeriUrunEslemeleriV2 WHERE CompanyId=@C AND KanalId=@K AND HariciSku=@S AND IsActive=1);
                            IF @P IS NULL SET @P=(SELECT TOP(1)UrunId FROM dbo.Urunler WHERE CompanyId=@C AND (UrunKodu=@S OR Barkod=@S));
                            INSERT dbo.PazaryeriSiparisKalemleriV2(CompanyId,PazaryeriSiparisId,HariciSku,UrunId,UrunAdi,Miktar,BirimFiyat,SatirToplam,EslemeDurumu)
                            VALUES(@C,@H,@S,@P,@A,@Q,@F,@T,CASE WHEN @P IS NULL THEN N'Bekliyor' ELSE N'Eşleşti' END);`);
                }
                await new sql.Request(transaction).input('C', sql.Int, req.companyId).input('H', sql.BigInt, pazaryeriSiparisId)
                  .query(`UPDATE dbo.PazaryeriSiparisleriV2 SET ErpDurumu=CASE WHEN EXISTS(SELECT 1 FROM dbo.PazaryeriSiparisKalemleriV2 WHERE CompanyId=@C AND PazaryeriSiparisId=@H AND UrunId IS NULL)THEN N'Eşleme Bekliyor' ELSE N'Hazır' END WHERE CompanyId=@C AND PazaryeriSiparisId=@H;`);
              }
              if (req.auth?.userId) {
                await marketplaceBridge.convertMarketplaceOrderToSalesOrder(transaction, req, pazaryeriSiparisId, sql);
              }
            }
          } catch (bridgeErr) {
            console.warn('Trendyol -> birleşik pazaryeri köprüsü atlandı (paket:', packageId, '):', bridgeErr.message);
          }
        }

        await transaction.commit();

        res.json({
          success: true,
          inserted,
          skipped,
          total:
            inserted + skipped
        });

      } catch (error) {

        console.error(
          'Trendyol SQL senkronizasyon hatası:',
          error
        );

        if (transaction) {
          try {
            await transaction.rollback();
          } catch (rollbackError) {
            console.error(
              'Rollback hatası:',
              rollbackError
            );
          }
        }

        res.status(500).json({
          error:
            'Trendyol kayıtları kaydedilemedi',
          detail: error.message
        });
      }
    }
  );

  // ---------------------------------------------------------
  // TRENDYOL TEK SİPARİŞ DETAYI
  // ---------------------------------------------------------

  app.get(
    '/api/platformlar/trendyol/siparis/:orderNumber',
    async (req, res) => {
      try {

        const orderNumber =
          req.params.orderNumber;

        const now = Date.now();

        const data = await request(
          `/integration/order/sellers/${encodeURIComponent(
            sellerId
          )}/v2/orders`,
          {
            startDate:
              now -
              30 *
                24 *
                60 *
                60 *
                1000,

            endDate: now,

            page: 0,

            size: 200,

            orderByField:
              'PackageLastModifiedDate',

            orderByDirection:
              'DESC'
          }
        );

        const orders =
          Array.isArray(data.content)
            ? data.content
            : [];

        const order =
          orders.find(
            x =>
              String(x.orderNumber) ===
              String(orderNumber)
          );

        if (!order) {
          return res.status(404).json({
            error:
              'Trendyol siparişi bulunamadı'
          });
        }

        res.json(order);

      } catch (error) {

        console.error(
          'Trendyol sipariş detay hatası:',
          error
        );

        res.status(
          error.status || 500
        ).json({
          error:
            'Trendyol sipariş detayı alınamadı',
          detail: error.message,
          trendyol:
            error.body || null
        });
      }
    }
  );

  console.log(
    'Trendyol entegrasyonu yüklendi.',
    configured()
      ? `Seller ID: ${sellerId}`
      : 'API bilgileri eksik'
  );
};

module.exports = registerTrendyol;