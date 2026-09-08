// ============================================================
// KOLAYBI ENTEGRASYONU
// Çoklu şirket + otomatik senkronizasyon
// ============================================================

const { storage } = require('./company-context-hook');

const registerKolaybi = ({ app, poolPromise, sql }) => {

  // Aynı şirketin aynı anda iki senkronizasyon çalıştırmasını engeller
  const running = new Set();

  const DEFAULT_BASE_URL = 'https://ofis-api.kolaybi.com';

  const API_TIMEOUT_MS = 30000;

  // ------------------------------------------------------------
  // FATURA DURUM HARİTASI
  // ------------------------------------------------------------

  const STATUS_MAP = {
    draft: 'Bekliyor',
    ready_to_send: 'Bekliyor',
    sent: 'Bekliyor',
    approved: 'Bekliyor',
    rejected: 'İptal',
    cancelled: 'İptal'
  };

  // ------------------------------------------------------------
  // ŞİRKET ID
  // ------------------------------------------------------------

  const companyIdFromRequest = (req) => {

    const id = Number(
      req.headers['x-company-id'] ||
      req.query.companyId ||
      req.body?.CompanyId ||
      1
    );

    return [1, 2, 3].includes(id) ? id : 1;
  };

  // ------------------------------------------------------------
  // HTTP TIMEOUT
  // ------------------------------------------------------------

  const fetchWithTimeout = async (
    url,
    options = {},
    timeout = API_TIMEOUT_MS
  ) => {

    const controller = new AbortController();

    const timer = setTimeout(() => {
      controller.abort();
    }, timeout);

    try {

      return await fetch(url, {
        ...options,
        signal: controller.signal
      });

    } catch (err) {

      if (err.name === 'AbortError') {

        throw Object.assign(
          new Error(
            `KolayBi API zaman aşımına uğradı (${timeout / 1000} saniye).`
          ),
          { status: 504 }
        );

      }

      throw err;

    } finally {

      clearTimeout(timer);

    }

  };

  // ------------------------------------------------------------
  // KOLAYBI AYARLARI
  //
  // GERÇEK TABLO:
  //
  // Id
  // ApiKey
  // Channel
  // BaseUrl
  // AccessToken
  // TokenGecerlilik
  // SonSenkronTarihi
  // CompanyId
  // KolaybiCompanyId
  // IsActive
  // CreatedAt
  // UpdatedAt
  // ------------------------------------------------------------

  async function getAyarlar(pool, companyId = 1) {

    const result = await pool.request()

      .input(
        'CompanyId',
        sql.Int,
        companyId
      )

      .query(`
        SELECT TOP 1
          Id,
          ApiKey,
          Channel,
          BaseUrl,
          AccessToken,
          TokenGecerlilik,
          SonSenkronTarihi,
          CompanyId,
          KolaybiCompanyId,
          IsActive,
          CreatedAt,
          UpdatedAt
        FROM dbo.KolaybiAyarlar
        WHERE CompanyId = @CompanyId
          AND IsActive = 1
        ORDER BY Id DESC
      `);

    return result.recordset[0] || null;
  }

  // ------------------------------------------------------------
  // ACCESS TOKEN
  // ------------------------------------------------------------

  async function getValidToken(pool, companyId = 1) {

    const ayar =
      await getAyarlar(
        pool,
        companyId
      );

    if (
      !ayar ||
      !ayar.ApiKey ||
      !ayar.Channel
    ) {

      throw Object.assign(

        new Error(
          `Şirket ${companyId} için KolayBi API Key / Channel tanımlı değil.`
        ),

        { status: 503 }

      );

    }

    const now = new Date();

    // ----------------------------------------------------------
    // MEVCUT TOKEN GEÇERLİYSE ONU KULLAN
    // ----------------------------------------------------------

    if (
      ayar.AccessToken &&
      ayar.TokenGecerlilik &&
      new Date(ayar.TokenGecerlilik) > now
    ) {

      return {

        token:
          ayar.AccessToken,

        channel:
          ayar.Channel,

        baseUrl:
          ayar.BaseUrl || DEFAULT_BASE_URL,

        ayar

      };

    }

    const baseUrl =
      ayar.BaseUrl || DEFAULT_BASE_URL;

    console.log(
      `[KolayBi][Şirket ${companyId}] Yeni access token alınıyor...`
    );

    // ----------------------------------------------------------
    // YENİ TOKEN AL
    // ----------------------------------------------------------

    const response =
      await fetchWithTimeout(

        `${baseUrl}/kolaybi/v1/access_token`,

        {
          method: 'POST',

          headers: {

            Channel:
              ayar.Channel,

            'Content-Type':
              'application/json'

          },

          body:
            JSON.stringify({
              api_key:
                ayar.ApiKey
            })

        }

      );

    if (!response.ok) {

      const text =
        await response.text()
          .catch(() => '');

      throw Object.assign(

        new Error(
          `KolayBi access token alınamadı. HTTP ${response.status}. ${text}`
        ),

        { status: 502 }

      );

    }

    const body =
      await response.json();

    const token =
      body?.data;

    if (!token) {

      throw Object.assign(

        new Error(
          'KolayBi access token cevabında token bulunamadı.'
        ),

        { status: 502 }

      );

    }

    // Token yaklaşık 23 saat geçerli kabul ediliyor
    const gecerlilik =
      new Date(
        now.getTime() +
        23 * 60 * 60 * 1000
      );

    // ----------------------------------------------------------
    // TOKEN'I KAYDET
    // ----------------------------------------------------------

    await pool.request()

      .input(
        'CompanyId',
        sql.Int,
        companyId
      )

      .input(
        'AccessToken',
        sql.NVarChar,
        token
      )

      .input(
        'TokenGecerlilik',
        sql.DateTime2,
        gecerlilik
      )

      .query(`
        UPDATE dbo.KolaybiAyarlar
        SET
          AccessToken = @AccessToken,
          TokenGecerlilik = @TokenGecerlilik,
          UpdatedAt = SYSDATETIME()
        WHERE CompanyId = @CompanyId
          AND IsActive = 1
      `);

    console.log(
      `[KolayBi][Şirket ${companyId}] Access token alındı.`
    );

    return {

      token,

      channel:
        ayar.Channel,

      baseUrl,

      ayar

    };

  }

  // ------------------------------------------------------------
  // KOLAYBI API REQUEST
  // ------------------------------------------------------------

  async function kolaybiRequest(
    pool,
    companyId,
    path,
    params = {}
  ) {

    const {
      token,
      channel,
      baseUrl
    } =
      await getValidToken(
        pool,
        companyId
      );

    const url =
      new URL(
        `${baseUrl}${path}`
      );

    Object.entries(params)
      .forEach(([key, value]) => {

        if (
          value !== undefined &&
          value !== null &&
          value !== ''
        ) {

          url.searchParams.set(
            key,
            value
          );

        }

      });

    console.log(
      `[KolayBi][Şirket ${companyId}] GET ${url.pathname}${url.search}`
    );

    const response =
      await fetchWithTimeout(

        url.toString(),

        {

          method: 'GET',

          headers: {

            Authorization:
              `Bearer ${token}`,

            Channel:
              channel,

            Accept:
              'application/json'

          }

        }

      );

    if (!response.ok) {

      const text =
        await response.text()
          .catch(() => '');

      throw Object.assign(

        new Error(
          `KolayBi API hatası. HTTP ${response.status}. ${text}`
        ),

        { status: 502 }

      );

    }

    return response.json();

  }

  // ------------------------------------------------------------
  // EXTERNAL ID
  // ------------------------------------------------------------

  const getExternalId = (row) => {

    const value =
      row?.id ??
      row?.document_id ??
      row?.commercial_doc_id ??
      row?.company_id ??
      row?.associate_id ??
      row?.product_id ??
      row?.code;

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ''
    ) {

      return String(value);

    }

    return null;

  };

  // ------------------------------------------------------------
  // ENTITY ID
  // ------------------------------------------------------------

  const getEntityId = (row) => {

    const value =
      row?.id ??
      row?.document_id ??
      row?.commercial_doc_id ??
      row?.company_id ??
      row?.associate_id ??
      row?.product_id ??
      row?.code;

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ''
    ) {

      return String(value);

    }

    return null;

  };

  // ------------------------------------------------------------
  // SYNC KAYDI
  //
  // GERÇEK TABLO:
  //
  // SyncId
  // CompanyId
  // EntityType
  // EntityId
  // Direction
  // Status
  // ExternalId
  // ErrorMessage
  // SyncDate
  // ------------------------------------------------------------

  async function saveSyncRecord(
    pool,
    companyId,
    entityType,
    row
  ) {

    const externalId =
      getExternalId(row);

    const entityId =
      getEntityId(row);

    if (
      !externalId ||
      !entityId
    ) {

      return {

        created: 0,
        updated: 0,
        skipped: 1

      };

    }

    const direction =
      'KOLAYBI_TO_ERP';

    const status =
      'BAŞARILI';

    // ----------------------------------------------------------
    // KAYIT VAR MI?
    // ----------------------------------------------------------

    const existing =
      await pool.request()

        .input(
          'CompanyId',
          sql.Int,
          companyId
        )

        .input(
          'EntityType',
          sql.NVarChar(100),
          entityType
        )

        .input(
          'ExternalId',
          sql.NVarChar(255),
          externalId
        )

        .query(`
          SELECT TOP 1
            SyncId,
            EntityId,
            Status
          FROM dbo.KolaybiSyncKayitlari
          WHERE CompanyId = @CompanyId
            AND EntityType = @EntityType
            AND ExternalId = @ExternalId
          ORDER BY SyncId DESC
        `);

    // ----------------------------------------------------------
    // VARSA GÜNCELLE
    // ----------------------------------------------------------

    if (
      existing.recordset.length > 0
    ) {

      await pool.request()

        .input(
          'SyncId',
          sql.BigInt,
          existing.recordset[0].SyncId
        )

        .input(
          'EntityId',
          sql.NVarChar(255),
          entityId
        )

        .input(
          'Direction',
          sql.NVarChar(100),
          direction
        )

        .input(
          'Status',
          sql.NVarChar(100),
          status
        )

        .input(
          'ErrorMessage',
          sql.NVarChar(2000),
          null
        )

        .query(`
          UPDATE dbo.KolaybiSyncKayitlari
          SET
            EntityId = @EntityId,
            Direction = @Direction,
            Status = @Status,
            ErrorMessage = @ErrorMessage,
            SyncDate = SYSDATETIME()
          WHERE SyncId = @SyncId
        `);

      return {

        created: 0,
        updated: 1,
        skipped: 0

      };

    }

    // ----------------------------------------------------------
    // YENİ KAYIT
    // ----------------------------------------------------------

    await pool.request()

      .input(
        'CompanyId',
        sql.Int,
        companyId
      )

      .input(
        'EntityType',
        sql.NVarChar(100),
        entityType
      )

      .input(
        'EntityId',
        sql.NVarChar(255),
        entityId
      )

      .input(
        'Direction',
        sql.NVarChar(100),
        direction
      )

      .input(
        'Status',
        sql.NVarChar(100),
        status
      )

      .input(
        'ExternalId',
        sql.NVarChar(255),
        externalId
      )

      .input(
        'ErrorMessage',
        sql.NVarChar(2000),
        null
      )

      .query(`
        INSERT INTO dbo.KolaybiSyncKayitlari
        (
          CompanyId,
          EntityType,
          EntityId,
          Direction,
          Status,
          ExternalId,
          ErrorMessage,
          SyncDate
        )
        VALUES
        (
          @CompanyId,
          @EntityType,
          @EntityId,
          @Direction,
          @Status,
          @ExternalId,
          @ErrorMessage,
          SYSDATETIME()
        )
      `);

    return {

      created: 1,
      updated: 0,
      skipped: 0

    };

  }

  // ------------------------------------------------------------
  // RAW VERİLERİ KAYDET
  // ------------------------------------------------------------

  async function saveRaw(
    pool,
    companyId,
    entityType,
    rows
  ) {

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    const list =
      Array.isArray(rows)
        ? rows
        : [];

    console.log(
      `[KolayBi][Şirket ${companyId}] ${entityType}: ${list.length} kayıt işlenecek.`
    );

    for (
      const row of list
    ) {

      try {

        const result =
          await saveSyncRecord(
            pool,
            companyId,
            entityType,
            row
          );

        created +=
          result.created;

        updated +=
          result.updated;

        skipped +=
          result.skipped;

      } catch (err) {

        errors++;

        console.error(
          `[KolayBi][Şirket ${companyId}] ${entityType} kayıt hatası:`,
          err.message
        );

      }

    }

    return {

      created,
      updated,
      skipped,
      errors

    };

  }

  // ------------------------------------------------------------
  // ŞİRKET SENKRONİZASYONU
  // ------------------------------------------------------------

  async function syncCompany(companyId) {

    if (
      running.has(companyId)
    ) {

      console.log(
        `[KolayBi][Şirket ${companyId}] Senkronizasyon zaten çalışıyor, atlandı.`
      );

      return {

        companyId,
        skipped: true

      };

    }

    running.add(companyId);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    const messages = [];

    const started =
      new Date();

    console.log('');

    console.log(
      '======================================================'
    );

    console.log(
      `[KolayBi] ŞİRKET ${companyId} SENKRONİZASYON BAŞLADI`
    );

    console.log(
      '======================================================'
    );

    try {

      const pool =
        await poolPromise;

      // --------------------------------------------------------
      // SENKRONİZASYON JOB'LARI
      // --------------------------------------------------------

      const jobs = [

        [
          'company',
          '/kolaybi/v1/companies',
          {}
        ],

        [
          'associate',
          '/kolaybi/v1/associates',
          {}
        ],

        [
          'product',
          '/kolaybi/v1/products',
          {}
        ],

        [
          'sale_invoice',
          '/kolaybi/v1/invoices',
          {
            type: 'sale_invoice',
            has_products: true
          }
        ],

        [
          'sale_return_invoice',
          '/kolaybi/v1/invoices',
          {
            type: 'sale_return_invoice',
            has_products: true
          }
        ],

        [
          'purchase_invoice',
          '/kolaybi/v1/invoices',
          {
            type: 'purchase_invoice',
            has_products: true
          }
        ],

        [
          'purchase_return_invoice',
          '/kolaybi/v1/invoices',
          {
            type: 'purchase_return_invoice',
            has_products: true
          }
        ]

      ];

      // --------------------------------------------------------
      // JOB'LARI ÇALIŞTIR
      // --------------------------------------------------------

      for (
        const [
          type,
          endpoint,
          params
        ] of jobs
      ) {

        console.log(
          `[KolayBi][Şirket ${companyId}] ${type} senkronizasyonu başlıyor...`
        );

        try {

          const response =
            await kolaybiRequest(
              pool,
              companyId,
              endpoint,
              params
            );

          const rows =
            Array.isArray(
              response?.data
            )
              ? response.data
              : [];

          const result =
            await saveRaw(
              pool,
              companyId,
              type,
              rows
            );

          created +=
            result.created;

          updated +=
            result.updated;

          skipped +=
            result.skipped;

          errors +=
            result.errors;

          console.log(

            `[KolayBi][Şirket ${companyId}] ${type} tamamlandı. ` +

            `Yeni: ${result.created}, ` +

            `Güncellenen: ${result.updated}, ` +

            `Atlanan: ${result.skipped}, ` +

            `Hata: ${result.errors}`

          );

        } catch (err) {

          errors++;

          const message =
            `${type}: ${err.message}`;

          messages.push(
            message
          );

          console.error(
            `[KolayBi][Şirket ${companyId}] ${message}`
          );

        }

      }

      // --------------------------------------------------------
      // SON DURUM
      // --------------------------------------------------------

      const finalStatus =
        errors > 0
          ? 'KISMI_HATA'
          : 'BAŞARILI';

      const finalMessage =
        messages.length > 0
          ? messages
              .join(' | ')
              .slice(0, 1000)
          : null;

      // --------------------------------------------------------
      // SADECE GERÇEK KOLAYBI AYAR KOLONLARINI GÜNCELLE
      //
      // Gerçek tabloda:
      // SonSenkronTarihi
      // UpdatedAt
      //
      // SonSenkronDurumu ve SonSenkronMesaji YOK.
      // --------------------------------------------------------

      await pool.request()

        .input(
          'CompanyId',
          sql.Int,
          companyId
        )

        .query(`
          UPDATE dbo.KolaybiAyarlar
          SET
            SonSenkronTarihi = SYSDATETIME(),
            UpdatedAt = SYSDATETIME()
          WHERE CompanyId = @CompanyId
            AND IsActive = 1
        `);

      const finished =
        new Date();

      // --------------------------------------------------------
      // LOG
      // --------------------------------------------------------

      console.log('');

      console.log(
        `[KolayBi][Şirket ${companyId}] SENKRONİZASYON TAMAMLANDI`
      );

      console.log(
        `Başlangıç  : ${started.toLocaleString('tr-TR')}`
      );

      console.log(
        `Bitiş      : ${finished.toLocaleString('tr-TR')}`
      );

      console.log(
        `Yeni       : ${created}`
      );

      console.log(
        `Güncellenen: ${updated}`
      );

      console.log(
        `Atlanan    : ${skipped}`
      );

      console.log(
        `Hata       : ${errors}`
      );

      console.log(
        `Durum      : ${finalStatus}`
      );

      if (finalMessage) {

        console.log(
          `Mesaj      : ${finalMessage}`
        );

      }

      console.log(
        '------------------------------------------------------'
      );

      return {

        companyId,

        created,

        updated,

        skipped,

        errors,

        status:
          finalStatus,

        messages

      };

    } finally {

      running.delete(
        companyId
      );

    }

  }

  // ============================================================
  // ŞİRKETLER
  // ============================================================

  app.get(
    '/api/sirketler',
    async (req, res) => {

      try {

        const pool =
          await poolPromise;

        // Şirket tablosunda RLS YOK.
        // Bu nedenle tüm aktif şirketler görünür.

        const result =
          await pool.request()
            .query(`
              SELECT
                CompanyId,
                CompanyCode,
                CompanyName,
                IsActive
              FROM dbo.Sirketler
              WHERE IsActive = 1
              ORDER BY CompanyId
            `);

        res.json(
          result.recordset
        );

      } catch (err) {

        console.error(
          'Şirketler alınamadı:',
          err.message
        );

        res.status(500).json({

          error:
            'Şirketler alınamadı',

          detail:
            err.message

        });

      }

    }
  );

  // ============================================================
  // KOLAYBI AYARLARI GETİR
  // ============================================================

  app.get(
    '/api/kolaybi/ayarlar',
    async (req, res) => {

      try {

        const pool =
          await poolPromise;

        const companyId =
          companyIdFromRequest(req);

        const ayar =
          await getAyarlar(
            pool,
            companyId
          );

        res.json({

          CompanyId:
            companyId,

          KolaybiCompanyId:
            ayar?.KolaybiCompanyId || null,

          Channel:
            ayar?.Channel || '',

          BaseUrl:
            ayar?.BaseUrl ||
            DEFAULT_BASE_URL,

          ApiKeyTanimli:
            Boolean(
              ayar?.ApiKey
            ),

          SonSenkronTarihi:
            ayar?.SonSenkronTarihi ||
            null

        });

      } catch (err) {

        console.error(
          'KolayBi ayarları alınamadı:',
          err.message
        );

        res.status(500).json({

          error:
            'Ayarlar alınamadı',

          detail:
            err.message

        });

      }

    }
  );

  // ============================================================
  // KOLAYBI AYARLARI GÜNCELLE
  // ============================================================

  app.put(
    '/api/kolaybi/ayarlar',
    async (req, res) => {

      try {

        const pool =
          await poolPromise;

        const companyId =
          companyIdFromRequest(req);

        const {
          ApiKey,
          Channel,
          BaseUrl,
          KolaybiCompanyId
        } = req.body;

        const request =
          pool.request()

            .input(
              'CompanyId',
              sql.Int,
              companyId
            )

            .input(
              'Channel',
              sql.NVarChar,
              Channel || null
            )

            .input(
              'BaseUrl',
              sql.NVarChar,
              BaseUrl ||
              DEFAULT_BASE_URL
            )

            .input(
              'KolaybiCompanyId',
              sql.NVarChar,
              KolaybiCompanyId
                ? String(KolaybiCompanyId)
                : null
            );

        let query = `
          UPDATE dbo.KolaybiAyarlar
          SET
            Channel = @Channel,
            BaseUrl = @BaseUrl,
            KolaybiCompanyId = @KolaybiCompanyId,
            AccessToken = NULL,
            TokenGecerlilik = NULL,
            UpdatedAt = SYSDATETIME()
        `;

        // API Key boş bırakılırsa
        // mevcut API Key korunur.

        if (ApiKey) {

          request.input(
            'ApiKey',
            sql.NVarChar,
            ApiKey
          );

          query += `
            ,
            ApiKey = @ApiKey
          `;

        }

        query += `
          WHERE CompanyId = @CompanyId
            AND IsActive = 1
        `;

        const result =
          await request.query(
            query
          );

        if (
          !result.rowsAffected ||
          result.rowsAffected[0] === 0
        ) {

          return res.status(404).json({

            error:
              `Şirket ${companyId} için KolayBi ayar kaydı bulunamadı.`

          });

        }

        res.json({

          success:
            true,

          message:
            `Şirket ${companyId} KolayBi ayarları güncellendi.`

        });

      } catch (err) {

        console.error(
          'KolayBi ayar güncelleme hatası:',
          err.message
        );

        res.status(500).json({

          error:
            'Ayarlar güncellenirken hata oluştu',

          detail:
            err.message

        });

      }

    }
  );

  // ============================================================
  // BAĞLANTI TESTİ
  // ============================================================

  app.post(
    '/api/kolaybi/test-baglanti',
    async (req, res) => {

      try {

        const pool =
          await poolPromise;

        const companyId =
          companyIdFromRequest(req);

        await getValidToken(
          pool,
          companyId
        );

        const companies =
          await kolaybiRequest(
            pool,
            companyId,
            '/kolaybi/v1/companies'
          );

        res.json({

          success:
            true,

          message:
            'Bağlantı başarılı, access token alındı.',

          CompanyId:
            companyId,

          KolaybiSirketleri:
            companies?.data || []

        });

      } catch (err) {

        console.error(
          `[KolayBi][Şirket ${companyIdFromRequest(req)}] Bağlantı testi hatası:`,
          err.message
        );

        res.status(
          err.status || 500
        ).json({

          error:
            err.message

        });

      }

    }
  );

  // ============================================================
  // KOLAYBI ŞİRKETLERİ
  // ============================================================

  app.get(
    '/api/kolaybi/sirketler',
    async (req, res) => {

      try {

        const pool =
          await poolPromise;

        const companyId =
          companyIdFromRequest(req);

        const result =
          await kolaybiRequest(
            pool,
            companyId,
            '/kolaybi/v1/companies'
          );

        res.json(
          result
        );

      } catch (err) {

        res.status(
          err.status || 500
        ).json({

          error:
            err.message

        });

      }

    }
  );

  // ============================================================
  // FATURA ÖNİZLEME
  // ============================================================

  app.get(
    '/api/kolaybi/faturalar-onizleme',
    async (req, res) => {

      try {

        const pool =
          await poolPromise;

        const companyId =
          companyIdFromRequest(req);

        const {
          type
        } = req.query;

        const params =
          type

            ? {
                type,
                has_products: true
              }

            : {
                has_products: true
              };

        const result =
          await kolaybiRequest(
            pool,
            companyId,
            '/kolaybi/v1/invoices',
            params
          );

        res.json(
          result
        );

      } catch (err) {

        res.status(
          err.status || 500
        ).json({

          error:
            err.message

        });

      }

    }
  );

  // ============================================================
  // MANUEL SENKRONİZASYON
  // ============================================================

  app.post(
    '/api/kolaybi/senkronize-et',
    async (req, res) => {

      try {

        const companyId =
          companyIdFromRequest(req);

        const result =
          await storage.run(

            {
              companyId
            },

            () =>
              syncCompany(
                companyId
              )

          );

        res.json({

          success:
            true,

          ...result

        });

      } catch (err) {

        const companyId =
          companyIdFromRequest(req);

        console.error(

          `[KolayBi][Şirket ${companyId}] Manuel senkronizasyon hatası:`,

          err.message

        );

        res.status(
          err.status || 500
        ).json({

          error:
            err.message

        });

      }

    }
  );

  // ============================================================
  // SENKRONİZASYON DURUMU
  // ============================================================

  app.get(
    '/api/kolaybi/senkronizasyon-durumu',
    async (req, res) => {

      try {

        const pool =
          await poolPromise;

        const companyId =
          companyIdFromRequest(req);

        const ayar =
          await getAyarlar(
            pool,
            companyId
          );

        // ------------------------------------------------------
        // SON SYNC KAYDI
        // ------------------------------------------------------

        const log =
          await pool.request()

            .input(
              'CompanyId',
              sql.Int,
              companyId
            )

            .query(`
              SELECT TOP 1
                SyncId,
                CompanyId,
                EntityType,
                EntityId,
                Direction,
                Status,
                ExternalId,
                ErrorMessage,
                SyncDate
              FROM dbo.KolaybiSyncKayitlari
              WHERE CompanyId = @CompanyId
              ORDER BY SyncId DESC
            `);

        res.json({

          companyId,

          running:
            running.has(
              companyId
            ),

          ayar:
            ayar
              ? {

                  SonSenkronTarihi:
                    ayar.SonSenkronTarihi

                }
              : null,

          sonLog:
            log.recordset[0] ||
            null

        });

      } catch (err) {

        console.error(
          'KolayBi senkronizasyon durumu hatası:',
          err.message
        );

        res.status(500).json({

          error:
            err.message

        });

      }

    }
  );

  // ============================================================
  // TÜM ŞİRKETLERİ OTOMATİK SENKRONİZE ET
  // ============================================================

  const runAllCompanies =
    async () => {

      try {

        const pool =
          await poolPromise;

        const companies =
          await pool.request()
            .query(`
              SELECT
                CompanyId
              FROM dbo.Sirketler
              WHERE IsActive = 1
              ORDER BY CompanyId
            `);

        console.log(
          `[KolayBi] Otomatik senkronizasyon kontrolü: ${companies.recordset.length} şirket`
        );

        // ------------------------------------------------------
        // HER ŞİRKET AYRI CONTEXT İLE ÇALIŞIR
        // ------------------------------------------------------

        for (
          const row of companies.recordset
        ) {

          const companyId =
            row.CompanyId;

          storage.run(

            {
              companyId
            },

            () => {

              syncCompany(
                companyId
              )
                .catch(err => {

                  console.error(

                    `[KolayBi] Otomatik senkronizasyon Şirket ${companyId} hatası:`,

                    err.message

                  );

                });

            }

          );

        }

      } catch (err) {

        console.error(

          'KolayBi otomatik senkronizasyon başlatılamadı:',

          err.message

        );

      }

    };

  // ============================================================
  // OTOMATİK SENKRONİZASYON
  // Her 60 saniyede bir
  // ============================================================

  setInterval(
    runAllCompanies,
    60 * 1000
  );

  // İlk çalıştırma 5 saniye sonra
  setTimeout(
    runAllCompanies,
    5000
  );

  console.log(
    'KolayBi çoklu şirket entegrasyonu yüklendi.'
  );

};

// ============================================================
// EXPORT
// ============================================================

module.exports =
  registerKolaybi;