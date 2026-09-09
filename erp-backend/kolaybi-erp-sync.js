/*
 * ALYA ERP - KolayBi -> ERP gerçek veri aktarım katmanı
 *
 * Bu dosya preload edilen company-context-hook tarafından yüklenir.
 * KolayBi modülünü değiştirmeden gerçek CariListesi / Urunler kayıtlarını
 * seçili CompanyId altında UPSERT eder.
 */

const Module = require('module');
const { storage } = require('./company-context-hook');

const COMPANY_IDS = new Set([1, 2, 3]);
const DEFAULT_BASE_URL = 'https://ofis-api.kolaybi.com';
const originalLoad = Module._load;

function value(row, keys, fallback = null) {
  for (const key of keys) {
    const v = row?.[key];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return fallback;
}

function asText(v) {
  return v === undefined || v === null ? null : String(v).trim() || null;
}

function associateCode(row) {
  return asText(value(row, ['code', 'associate_code', 'customer_code', 'supplier_code', 'id', 'associate_id']));
}

function associateName(row) {
  return asText(value(row, ['name', 'title', 'company_name', 'trade_name', 'full_name'], 'KolayBi Cari'));
}

function productCode(row) {
  return asText(value(row, ['code', 'sku', 'product_code', 'stock_code', 'id', 'product_id']));
}

function productName(row) {
  return asText(value(row, ['name', 'title', 'product_name', 'description'], 'KolayBi Ürün'));
}

function associateType(row) {
  const raw = String(value(row, ['type', 'associate_type', 'kind'], '')).toLowerCase();
  if (raw.includes('supplier') || raw.includes('tedarik')) return 2;
  if (raw.includes('both') || raw.includes('her')) return 3;
  return 1;
}

async function apiJson(baseUrl, token, channel, path, params = {}) {
  const url = new URL(`${baseUrl}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Channel: channel,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`KolayBi API HTTP ${response.status}: ${text}`);
  }

  return response.json();
}

async function getToken(pool, sql, companyId) {
  const settings = await pool.request()
    .input('CompanyId', sql.Int, companyId)
    .query(`
      SELECT TOP 1 ApiKey, Channel, BaseUrl, AccessToken, TokenGecerlilik
      FROM dbo.KolaybiAyarlar
      WHERE CompanyId=@CompanyId AND IsActive=1
      ORDER BY Id DESC
    `);

  const ayar = settings.recordset[0];
  if (!ayar?.ApiKey || !ayar?.Channel) {
    throw new Error(`Şirket ${companyId} için KolayBi ayarı eksik.`);
  }

  const baseUrl = ayar.BaseUrl || DEFAULT_BASE_URL;
  if (ayar.AccessToken && ayar.TokenGecerlilik && new Date(ayar.TokenGecerlilik) > new Date()) {
    return { token: ayar.AccessToken, channel: ayar.Channel, baseUrl };
  }

  const response = await fetch(`${baseUrl}/kolaybi/v1/access_token`, {
    method: 'POST',
    headers: { Channel: ayar.Channel, 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: ayar.ApiKey })
  });
  if (!response.ok) throw new Error(`KolayBi token HTTP ${response.status}`);

  const body = await response.json();
  const token = body?.data;
  if (!token) throw new Error('KolayBi token cevabı boş.');

  const validUntil = new Date(Date.now() + 23 * 60 * 60 * 1000);
  await pool.request()
    .input('CompanyId', sql.Int, companyId)
    .input('AccessToken', sql.NVarChar, token)
    .input('TokenGecerlilik', sql.DateTime2, validUntil)
    .query(`
      UPDATE dbo.KolaybiAyarlar
      SET AccessToken=@AccessToken, TokenGecerlilik=@TokenGecerlilik, UpdatedAt=SYSDATETIME()
      WHERE CompanyId=@CompanyId AND IsActive=1
    `);

  return { token, channel: ayar.Channel, baseUrl };
}

async function upsertAssociate(pool, sql, companyId, row) {
  const code = associateCode(row);
  const name = associateName(row);
  if (!code || !name) return false;

  const email = asText(value(row, ['email', 'mail', 'email_address']));
  const phone = asText(value(row, ['phone', 'telephone', 'mobile_phone', 'gsm']));
  const taxOffice = asText(value(row, ['tax_office', 'tax_office_name', 'vergi_dairesi']));
  const taxNo = asText(value(row, ['tax_number', 'tax_no', 'tax_id', 'vergi_no']));
  const tcNo = asText(value(row, ['identity_number', 'national_id', 'tc_no', 'tc']));
  const address = asText(value(row, ['address', 'address_detail', 'full_address']));
  const city = asText(value(row, ['city', 'province', 'il']));
  const district = asText(value(row, ['district', 'county', 'ilce']));

  await pool.request()
    .input('CompanyId', sql.Int, companyId)
    .input('CariKodu', sql.NVarChar, code)
    .input('CariAdi', sql.NVarChar, name)
    .input('CariTipi', sql.Int, associateType(row))
    .input('VergiDairesi', sql.NVarChar, taxOffice)
    .input('VergiNo', sql.NVarChar, taxNo)
    .input('TCNo', sql.NVarChar, tcNo)
    .input('FaturaIl', sql.NVarChar, city)
    .input('FaturaIlce', sql.NVarChar, district)
    .input('FaturaAdresDetay', sql.NVarChar, address)
    .input('Iletisim', sql.NVarChar, phone || email)
    .input('Yetkili1Cep', sql.NVarChar, phone)
    .input('Yetkili1Mail', sql.NVarChar, email)
    .query(`
      IF EXISTS (
        SELECT 1 FROM dbo.CariListesi
        WHERE CompanyId=@CompanyId AND CariKodu=@CariKodu
      )
      BEGIN
        UPDATE dbo.CariListesi SET
          CariAdi=@CariAdi,
          CariTipi=@CariTipi,
          VergiDairesi=@VergiDairesi,
          VergiNo=@VergiNo,
          TCNo=@TCNo,
          FaturaIl=@FaturaIl,
          FaturaIlce=@FaturaIlce,
          FaturaAdresDetay=@FaturaAdresDetay,
          Iletisim=@Iletisim,
          Yetkili1Cep=@Yetkili1Cep,
          Yetkili1Mail=@Yetkili1Mail,
          IsActive=1
        WHERE CompanyId=@CompanyId AND CariKodu=@CariKodu;
      END
      ELSE
      BEGIN
        INSERT INTO dbo.CariListesi
        (
          CompanyId,CariKodu,CariAdi,CariTipi,VergiDairesi,VergiNo,TCNo,
          FaturaIl,FaturaIlce,FaturaAdresDetay,Iletisim,Yetkili1Cep,Yetkili1Mail,IsActive
        )
        VALUES
        (
          @CompanyId,@CariKodu,@CariAdi,@CariTipi,@VergiDairesi,@VergiNo,@TCNo,
          @FaturaIl,@FaturaIlce,@FaturaAdresDetay,@Iletisim,@Yetkili1Cep,@Yetkili1Mail,1
        );
      END
    `);
  return true;
}

async function upsertProduct(pool, sql, companyId, row) {
  const code = productCode(row);
  const name = productName(row);
  if (!code || !name) return false;

  const unit = asText(value(row, ['unit', 'unit_name', 'uom', 'measure_unit'], 'Adet')) || 'Adet';
  const category = asText(value(row, ['category', 'category_name', 'product_category']));
  const stock = Number(value(row, ['stock', 'stock_quantity', 'quantity', 'available_quantity'], 0));
  const purchase = Number(value(row, ['purchase_price', 'buy_price', 'cost'], 0));
  const sale = Number(value(row, ['sale_price', 'selling_price', 'price'], 0));
  const vat = Number(value(row, ['vat_rate', 'tax_rate', 'kdv_rate'], 20));
  const barcode = asText(value(row, ['barcode', 'ean', 'gtin']));
  const description = asText(value(row, ['description', 'note', 'notes']));

  await pool.request()
    .input('CompanyId', sql.Int, companyId)
    .input('UrunKodu', sql.NVarChar, code)
    .input('UrunAdi', sql.NVarChar, name)
    .input('Birim', sql.NVarChar, unit)
    .input('Kategori', sql.NVarChar, category)
    .input('StokMiktari', sql.Decimal(18, 4), Number.isFinite(stock) ? stock : 0)
    .input('AlisFiyati', sql.Decimal(18, 4), Number.isFinite(purchase) ? purchase : 0)
    .input('ListeFiyati', sql.Decimal(18, 4), Number.isFinite(sale) ? sale : 0)
    .input('KdvOrani', sql.Decimal(5, 2), Number.isFinite(vat) ? vat : 20)
    .input('Barkod', sql.NVarChar, barcode)
    .input('Aciklama', sql.NVarChar, description)
    .query(`
      IF EXISTS (
        SELECT 1 FROM dbo.Urunler
        WHERE CompanyId=@CompanyId AND UrunKodu=@UrunKodu
      )
      BEGIN
        UPDATE dbo.Urunler SET
          UrunAdi=@UrunAdi,
          Birim=@Birim,
          Kategori=@Kategori,
          StokMiktari=@StokMiktari,
          AlisFiyati=@AlisFiyati,
          ListeFiyati=@ListeFiyati,
          KdvOrani=@KdvOrani,
          Barkod=@Barkod,
          Aciklama=@Aciklama,
          IsActive=1,
          UpdatedAt=SYSDATETIME()
        WHERE CompanyId=@CompanyId AND UrunKodu=@UrunKodu;
      END
      ELSE
      BEGIN
        INSERT INTO dbo.Urunler
        (
          CompanyId,UrunKodu,UrunAdi,Birim,Kategori,StokMiktari,
          AlisFiyati,ListeFiyati,KdvOrani,Barkod,Aciklama,Tur,IsActive
        )
        VALUES
        (
          @CompanyId,@UrunKodu,@UrunAdi,@Birim,@Kategori,@StokMiktari,
          @AlisFiyati,@ListeFiyati,@KdvOrani,@Barkod,@Aciklama,N'Ürün',1
        );
      END
    `);
  return true;
}

async function syncRealData({ app, poolPromise, sql, companyId }) {
  const pool = await poolPromise;
  const api = await getToken(pool, sql, companyId);

  const [associateResponse, productResponse] = await Promise.all([
    apiJson(api.baseUrl, api.token, api.channel, '/kolaybi/v1/associates'),
    apiJson(api.baseUrl, api.token, api.channel, '/kolaybi/v1/products')
  ]);

  const associates = Array.isArray(associateResponse?.data) ? associateResponse.data : [];
  const products = Array.isArray(productResponse?.data) ? productResponse.data : [];

  let cariler = 0;
  let urunler = 0;

  for (const row of associates) {
    if (await upsertAssociate(pool, sql, companyId, row)) cariler++;
  }
  for (const row of products) {
    if (await upsertProduct(pool, sql, companyId, row)) urunler++;
  }

  return { CompanyId: companyId, cariler, urunler };
}

function install({ app, poolPromise, sql }) {
  if (app.__alyaKolaybiRealSyncInstalled) return;
  app.__alyaKolaybiRealSyncInstalled = true;

  app.post('/api/kolaybi/erp-senkronize', async (req, res) => {
    const companyId = Number(storage.getStore()?.companyId || req.headers['x-company-id'] || 1);
    if (!COMPANY_IDS.has(companyId)) {
      return res.status(400).json({ success: false, error: 'Geçersiz CompanyId', CompanyId: companyId });
    }

    try {
      const result = await storage.run({ companyId }, () =>
        syncRealData({ app, poolPromise, sql, companyId })
      );
      res.json({ success: true, ...result });
    } catch (err) {
      console.error(`[KolayBi][ERP aktarım][Şirket ${companyId}]`, err);
      res.status(500).json({ success: false, CompanyId: companyId, error: err.message });
    }
  });

  const autoSync = async () => {
    try {
      const pool = await poolPromise;
      const result = await pool.request().query(`
        SELECT CompanyId FROM dbo.Sirketler WHERE IsActive=1 ORDER BY CompanyId
      `);
      for (const row of result.recordset) {
        const companyId = Number(row.CompanyId);
        if (!COMPANY_IDS.has(companyId)) continue;
        storage.run({ companyId }, () => {
          syncRealData({ app, poolPromise, sql, companyId })
            .then(x => console.log(`[KolayBi][ERP aktarım][Şirket ${companyId}] Cari: ${x.cariler}, Ürün: ${x.urunler}`))
            .catch(err => console.error(`[KolayBi][ERP aktarım][Şirket ${companyId}]`, err.message));
        });
      }
    } catch (err) {
      console.error('[KolayBi][ERP aktarım] otomatik senkronizasyon', err.message);
    }
  };

  setTimeout(autoSync, 15000);
  setInterval(autoSync, 60 * 1000);
}

// server.js require('./kolaybi') çağrısını yakalayıp gerçek aktarım katmanını
// aynı app/pool üzerinde kuruyoruz. Böylece büyük kolaybi.js dosyasını
// yeniden yazmak zorunda kalmadan mevcut entegrasyon korunur.
Module._load = function patchedLoad(request, parent, isMain) {
  const loaded = originalLoad.apply(this, arguments);

  if (
    request === './kolaybi' &&
    parent?.filename &&
    parent.filename.endsWith('server.js')
  ) {
    return function wrappedRegisterKolaybi(args) {
      const result = loaded(args);
      install(args);
      return result;
    };
  }

  return loaded;
};

module.exports = { syncRealData };
