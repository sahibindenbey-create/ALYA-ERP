require('dotenv').config();

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { poolPromise, sql } = require('./db');
const registerTrendyol = require('./trendyol');
const registerTrendyolExtra = require('./trendyol-extra');
const registerKolaybi = require('./kolaybi');
const bordro = require('./bordroHesapla');
const app = express();
const PORT = 5000;

// --- Dosya yükleme altyapısı (Cari evrakları, ürün resim/dosyaları) ---
const UPLOAD_ROOT = path.join(__dirname, 'uploads');
for (const sub of ['cari-evrak', 'urun-dosya', 'ihracat-evrak']) {
  const dir = path.join(UPLOAD_ROOT, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function makeUploader(subfolder) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(UPLOAD_ROOT, subfolder)),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const unique = crypto.randomBytes(8).toString('hex');
      cb(null, `${Date.now()}_${unique}${ext}`);
    }
  });
  return multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } }); // 25 MB
}
const uploadCariEvrak = makeUploader('cari-evrak');
const uploadUrunDosya = makeUploader('urun-dosya');
const uploadIhracatEvrak = makeUploader('ihracat-evrak');

// Middleware
// NOT: React dev server bazen 3000 doluysa otomatik 3001/3002'ye kayar,
// bu yüzden localhost'taki herhangi bir portu kabul ediyoruz (sadece geliştirme ortamı için).
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || /^http:\/\/localhost:\d+$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS engellendi: ' + origin));
    }
  },
  credentials: true
}));
app.use(express.json());

// Yüklenen dosyaları statik olarak sun (görüntüleme/indirme için)
app.use('/uploads', express.static(UPLOAD_ROOT));

// Test endpoint
app.get('/', (req, res) => {
  res.json({ message: 'ERP Backend API çalışıyor!' });
});

/* =========================================================
   CARİ MODÜLÜ
   ========================================================= */

// Tüm carileri getir
app.get('/api/cariler', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query('SELECT * FROM CariListesi WHERE IsActive = 1 ORDER BY CariId DESC');

    res.json(result.recordset);
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Veri getirme hatasi' });
  }
});

// Yeni cari ekle (formdaki tüm alanlarla)
app.post('/api/cariler', async (req, res) => {
  try {
    const pool = await poolPromise;
    const {
      CompanyId, CariKodu, CariAdi, CariTipi, MusteriTuru, Segment,
      VergiDairesi, VergiNo, TCNo,
      FaturaIl, FaturaIlce, FaturaAdresDetay,
      SevkiyatIl, SevkiyatIlce, SevkiyatAdresDetay,
      Yetkili1Ad, Yetkili1Gorev, Yetkili1Cep, Yetkili1Mail,
      Yetkili2Ad, Yetkili2Gorev, Yetkili2Cep, Yetkili2Mail,
      RiskLimiti, VadeGunu, ParaBirimi, Iletisim, Notlar
    } = req.body;

    const result = await pool.request()
      .input('CompanyId', sql.Int, CompanyId || 1)
      .input('CariKodu', sql.NVarChar, CariKodu)
      .input('CariAdi', sql.NVarChar, CariAdi)
      .input('CariTipi', sql.Int, CariTipi)
      .input('MusteriTuru', sql.NVarChar, MusteriTuru || null)
      .input('Segment', sql.NVarChar, Segment || null)
      .input('VergiDairesi', sql.NVarChar, VergiDairesi || null)
      .input('VergiNo', sql.NVarChar, VergiNo || null)
      .input('TCNo', sql.NVarChar, TCNo || null)
      .input('FaturaIl', sql.NVarChar, FaturaIl || null)
      .input('FaturaIlce', sql.NVarChar, FaturaIlce || null)
      .input('FaturaAdresDetay', sql.NVarChar, FaturaAdresDetay || null)
      .input('SevkiyatIl', sql.NVarChar, SevkiyatIl || null)
      .input('SevkiyatIlce', sql.NVarChar, SevkiyatIlce || null)
      .input('SevkiyatAdresDetay', sql.NVarChar, SevkiyatAdresDetay || null)
      .input('Yetkili1Ad', sql.NVarChar, Yetkili1Ad || null)
      .input('Yetkili1Gorev', sql.NVarChar, Yetkili1Gorev || null)
      .input('Yetkili1Cep', sql.NVarChar, Yetkili1Cep || null)
      .input('Yetkili1Mail', sql.NVarChar, Yetkili1Mail || null)
      .input('Yetkili2Ad', sql.NVarChar, Yetkili2Ad || null)
      .input('Yetkili2Gorev', sql.NVarChar, Yetkili2Gorev || null)
      .input('Yetkili2Cep', sql.NVarChar, Yetkili2Cep || null)
      .input('Yetkili2Mail', sql.NVarChar, Yetkili2Mail || null)
      .input('RiskLimiti', sql.Decimal(18, 2), RiskLimiti || 0)
      .input('VadeGunu', sql.Int, VadeGunu || 0)
      .input('ParaBirimi', sql.NVarChar, ParaBirimi || 'TL')
      .input('Iletisim', sql.NVarChar, Iletisim || null)
      .input('Notlar', sql.NVarChar, Notlar || null)
      .query(`
        INSERT INTO CariListesi (
          CompanyId, CariKodu, CariAdi, CariTipi, MusteriTuru, Segment,
          VergiDairesi, VergiNo, TCNo,
          FaturaIl, FaturaIlce, FaturaAdresDetay,
          SevkiyatIl, SevkiyatIlce, SevkiyatAdresDetay,
          Yetkili1Ad, Yetkili1Gorev, Yetkili1Cep, Yetkili1Mail,
          Yetkili2Ad, Yetkili2Gorev, Yetkili2Cep, Yetkili2Mail,
          RiskLimiti, VadeGunu, ParaBirimi, Iletisim, Notlar
        )
        OUTPUT INSERTED.*
        VALUES (
          @CompanyId, @CariKodu, @CariAdi, @CariTipi, @MusteriTuru, @Segment,
          @VergiDairesi, @VergiNo, @TCNo,
          @FaturaIl, @FaturaIlce, @FaturaAdresDetay,
          @SevkiyatIl, @SevkiyatIlce, @SevkiyatAdresDetay,
          @Yetkili1Ad, @Yetkili1Gorev, @Yetkili1Cep, @Yetkili1Mail,
          @Yetkili2Ad, @Yetkili2Gorev, @Yetkili2Cep, @Yetkili2Mail,
          @RiskLimiti, @VadeGunu, @ParaBirimi, @Iletisim, @Notlar
        )
      `);

    res.json({ success: true, message: 'Cari başarıyla eklendi', data: result.recordset[0] });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Cari eklenirken hata oluştu', detail: err.message });
  }
});

// Cari güncelle
app.put('/api/cariler/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    const {
      CariAdi, CariTipi, MusteriTuru, Segment,
      VergiDairesi, VergiNo, TCNo,
      FaturaIl, FaturaIlce, FaturaAdresDetay,
      SevkiyatIl, SevkiyatIlce, SevkiyatAdresDetay,
      Yetkili1Ad, Yetkili1Gorev, Yetkili1Cep, Yetkili1Mail,
      Yetkili2Ad, Yetkili2Gorev, Yetkili2Cep, Yetkili2Mail,
      RiskLimiti, VadeGunu, ParaBirimi, Iletisim, Notlar
    } = req.body;

    await pool.request()
      .input('CariId', sql.Int, id)
      .input('CariAdi', sql.NVarChar, CariAdi)
      .input('CariTipi', sql.Int, CariTipi)
      .input('MusteriTuru', sql.NVarChar, MusteriTuru || null)
      .input('Segment', sql.NVarChar, Segment || null)
      .input('VergiDairesi', sql.NVarChar, VergiDairesi || null)
      .input('VergiNo', sql.NVarChar, VergiNo || null)
      .input('TCNo', sql.NVarChar, TCNo || null)
      .input('FaturaIl', sql.NVarChar, FaturaIl || null)
      .input('FaturaIlce', sql.NVarChar, FaturaIlce || null)
      .input('FaturaAdresDetay', sql.NVarChar, FaturaAdresDetay || null)
      .input('SevkiyatIl', sql.NVarChar, SevkiyatIl || null)
      .input('SevkiyatIlce', sql.NVarChar, SevkiyatIlce || null)
      .input('SevkiyatAdresDetay', sql.NVarChar, SevkiyatAdresDetay || null)
      .input('Yetkili1Ad', sql.NVarChar, Yetkili1Ad || null)
      .input('Yetkili1Gorev', sql.NVarChar, Yetkili1Gorev || null)
      .input('Yetkili1Cep', sql.NVarChar, Yetkili1Cep || null)
      .input('Yetkili1Mail', sql.NVarChar, Yetkili1Mail || null)
      .input('Yetkili2Ad', sql.NVarChar, Yetkili2Ad || null)
      .input('Yetkili2Gorev', sql.NVarChar, Yetkili2Gorev || null)
      .input('Yetkili2Cep', sql.NVarChar, Yetkili2Cep || null)
      .input('Yetkili2Mail', sql.NVarChar, Yetkili2Mail || null)
      .input('RiskLimiti', sql.Decimal(18, 2), RiskLimiti || 0)
      .input('VadeGunu', sql.Int, VadeGunu || 0)
      .input('ParaBirimi', sql.NVarChar, ParaBirimi || 'TL')
      .input('Iletisim', sql.NVarChar, Iletisim || null)
      .input('Notlar', sql.NVarChar, Notlar || null)
      .query(`
        UPDATE CariListesi SET
          CariAdi=@CariAdi, CariTipi=@CariTipi, MusteriTuru=@MusteriTuru, Segment=@Segment,
          VergiDairesi=@VergiDairesi, VergiNo=@VergiNo, TCNo=@TCNo,
          FaturaIl=@FaturaIl, FaturaIlce=@FaturaIlce, FaturaAdresDetay=@FaturaAdresDetay,
          SevkiyatIl=@SevkiyatIl, SevkiyatIlce=@SevkiyatIlce, SevkiyatAdresDetay=@SevkiyatAdresDetay,
          Yetkili1Ad=@Yetkili1Ad, Yetkili1Gorev=@Yetkili1Gorev, Yetkili1Cep=@Yetkili1Cep, Yetkili1Mail=@Yetkili1Mail,
          Yetkili2Ad=@Yetkili2Ad, Yetkili2Gorev=@Yetkili2Gorev, Yetkili2Cep=@Yetkili2Cep, Yetkili2Mail=@Yetkili2Mail,
          RiskLimiti=@RiskLimiti, VadeGunu=@VadeGunu, ParaBirimi=@ParaBirimi, Iletisim=@Iletisim, Notlar=@Notlar
        WHERE CariId=@CariId
      `);

    res.json({ success: true, message: 'Cari güncellendi' });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Cari güncellenirken hata oluştu', detail: err.message });
  }
});

// Cari sil (soft delete)
app.delete('/api/cariler/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;

    await pool.request()
      .input('CariId', sql.Int, id)
      .query('UPDATE CariListesi SET IsActive = 0 WHERE CariId = @CariId');

    res.json({ success: true, message: 'Cari silindi' });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Cari silinirken hata oluştu' });
  }
});

/* --- Cari Evrak Yönetimi (Vergi Levhası, İmza Sirküleri, Tic. Sicil Gazetesi, Faaliyet Belgesi, Serbest) --- */
app.get('/api/cariler/:id/evrak', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().input('CariId', sql.Int, req.params.id)
      .query('SELECT * FROM CariEvrak WHERE CariId = @CariId ORDER BY YuklemeTarihi DESC');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Evraklar alınamadı', detail: err.message });
  }
});

app.post('/api/cariler/:id/evrak', uploadCariEvrak.single('dosya'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya bulunamadı' });
    const pool = await poolPromise;
    const { EvrakTipi, Baslik } = req.body;
    const dosyaYolu = `/uploads/cari-evrak/${req.file.filename}`;
    const result = await pool.request()
      .input('CariId', sql.Int, req.params.id)
      .input('EvrakTipi', sql.NVarChar, EvrakTipi || 'Serbest')
      .input('Baslik', sql.NVarChar, Baslik || null)
      .input('DosyaAdi', sql.NVarChar, req.file.originalname)
      .input('DosyaYolu', sql.NVarChar, dosyaYolu)
      .input('DosyaBoyutu', sql.Int, req.file.size)
      .query(`
        INSERT INTO CariEvrak (CariId, EvrakTipi, Baslik, DosyaAdi, DosyaYolu, DosyaBoyutu)
        OUTPUT INSERTED.*
        VALUES (@CariId, @EvrakTipi, @Baslik, @DosyaAdi, @DosyaYolu, @DosyaBoyutu)
      `);
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ error: 'Evrak yüklenirken hata oluştu', detail: err.message });
  }
});

app.delete('/api/cariler/evrak/:evrakId', async (req, res) => {
  try {
    const pool = await poolPromise;
    const findResult = await pool.request().input('EvrakId', sql.Int, req.params.evrakId)
      .query('SELECT DosyaYolu FROM CariEvrak WHERE EvrakId = @EvrakId');
    await pool.request().input('EvrakId', sql.Int, req.params.evrakId)
      .query('DELETE FROM CariEvrak WHERE EvrakId = @EvrakId');
    if (findResult.recordset[0]) {
      const filePath = path.join(UPLOAD_ROOT, findResult.recordset[0].DosyaYolu.replace('/uploads/', ''));
      fs.unlink(filePath, () => {}); // dosya silinemezse sessiz geç
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Evrak silinirken hata oluştu', detail: err.message });
  }
});

/* =========================================================
   SİPARİŞ MODÜLÜ
   ========================================================= */

// Tüm siparişleri getir (özet liste)
app.get('/api/siparisler', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query('SELECT * FROM Siparisler ORDER BY SiparisId DESC');
    res.json(result.recordset);
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Sipariş listesi alınamadı', detail: err.message });
  }
});

// Tek bir siparişin detayını (ürün satırları ile) getir
app.get('/api/siparisler/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;

    const header = await pool.request()
      .input('SiparisId', sql.Int, id)
      .query('SELECT * FROM Siparisler WHERE SiparisId = @SiparisId');

    const items = await pool.request()
      .input('SiparisId', sql.Int, id)
      .query('SELECT * FROM SiparisDetay WHERE SiparisId = @SiparisId');

    if (header.recordset.length === 0) {
      return res.status(404).json({ error: 'Sipariş bulunamadı' });
    }

    res.json({ ...header.recordset[0], items: items.recordset });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Sipariş detayı alınamadı', detail: err.message });
  }
});

// Yeni sipariş kaydet (başlık + ürün satırları, transaction ile)
app.post('/api/siparisler', async (req, res) => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);

  try {
    const { form, items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'En az bir ürün satırı eklemelisiniz.' });
    }

    const toplamTutar = items.reduce((acc, it) => acc + Number(it.satirToplam || 0), 0);

    await transaction.begin();

    const headerRequest = new sql.Request(transaction);
    const headerResult = await headerRequest
      .input('SiparisKodu', sql.NVarChar, form.siparisKodu)
      .input('SiparisYonu', sql.NVarChar, form.siparisYonu || 'Satış')
      .input('SiparisTarihi', sql.Date, form.siparisTarihi)
      .input('TeslimatTarihi', sql.Date, form.teslimatTarihi || null)
      .input('TahsilatTarihi', sql.Date, form.tahsilatTarihi || null)
      .input('SiparisTipi', sql.NVarChar, form.siparisTipi)
      .input('SiparisVeren', sql.NVarChar, form.siparisVeren)
      .input('MusteriTemsilcisi', sql.NVarChar, form.musteriTemsilcisi)
      .input('CariKodu', sql.NVarChar, form.cariKodu)
      .input('CariAdi', sql.NVarChar, form.cariAdi)
      .input('FaturaUlke', sql.NVarChar, form.faturaUlke)
      .input('FaturaIl', sql.NVarChar, form.faturaIl)
      .input('FaturaIlce', sql.NVarChar, form.faturaIlce)
      .input('FaturaAdres', sql.NVarChar, form.faturaAdres)
      .input('SevkiyatUlke', sql.NVarChar, form.sevkiyatUlke)
      .input('SevkiyatIl', sql.NVarChar, form.sevkiyatIl)
      .input('SevkiyatIlce', sql.NVarChar, form.sevkiyatIlce)
      .input('SevkiyatAdres', sql.NVarChar, form.sevkiyatAdres)
      .input('OdemeSekli', sql.NVarChar, form.odemeSekli)
      .input('Vade', sql.NVarChar, form.vade)
      .input('ToplamTutar', sql.Decimal(18, 2), toplamTutar)
      .input('TeslimatSekli', sql.NVarChar, form.teslimatSekli || null)
      .input('PaketlemeSekli', sql.NVarChar, form.paketlemeSekli || null)
      .input('LojistikDetay', sql.NVarChar, form.lojistikDetay || null)
      .input('SiparisVerenDepartman', sql.NVarChar, form.siparisVerenDepartman || null)
      .query(`
        INSERT INTO Siparisler (
          SiparisKodu, SiparisYonu, SiparisTarihi, TeslimatTarihi, TahsilatTarihi,
          SiparisTipi, SiparisVeren, MusteriTemsilcisi, CariKodu, CariAdi,
          FaturaUlke, FaturaIl, FaturaIlce, FaturaAdres,
          SevkiyatUlke, SevkiyatIl, SevkiyatIlce, SevkiyatAdres,
          OdemeSekli, Vade, ToplamTutar,
          TeslimatSekli, PaketlemeSekli, LojistikDetay, SiparisVerenDepartman
        )
        OUTPUT INSERTED.SiparisId
        VALUES (
          @SiparisKodu, @SiparisYonu, @SiparisTarihi, @TeslimatTarihi, @TahsilatTarihi,
          @SiparisTipi, @SiparisVeren, @MusteriTemsilcisi, @CariKodu, @CariAdi,
          @FaturaUlke, @FaturaIl, @FaturaIlce, @FaturaAdres,
          @SevkiyatUlke, @SevkiyatIl, @SevkiyatIlce, @SevkiyatAdres,
          @OdemeSekli, @Vade, @ToplamTutar,
          @TeslimatSekli, @PaketlemeSekli, @LojistikDetay, @SiparisVerenDepartman
        )
      `);

    const siparisId = headerResult.recordset[0].SiparisId;

    for (const it of items) {
      const itemRequest = new sql.Request(transaction);
      await itemRequest
        .input('SiparisId', sql.Int, siparisId)
        .input('UrunKodu', sql.NVarChar, it.urunKodu)
        .input('UrunAdi', sql.NVarChar, it.urunAdi)
        .input('Miktar', sql.Decimal(18, 2), it.miktar || 0)
        .input('Birim', sql.NVarChar, it.birim)
        .input('KoliIci', sql.Decimal(18, 2), it.koliIci || 0)
        .input('KoliAdedi', sql.Int, it.koliAdedi || 0)
        .input('ListeFiyati', sql.Decimal(18, 2), it.listeFiyati || 0)
        .input('Iskonto', sql.Decimal(9, 2), it.iskonto || 0)
        .input('IskBirimFiyat', sql.Decimal(18, 2), it.iskBirimFiyat || 0)
        .input('KdvTutari', sql.Decimal(18, 2), it.kdvTutari || 0)
        .input('BirimFiyatKdvDahil', sql.Decimal(18, 2), it.birimFiyatKdvDahil || 0)
        .input('SatirToplam', sql.Decimal(18, 2), it.satirToplam || 0)
        .query(`
          INSERT INTO SiparisDetay (
            SiparisId, UrunKodu, UrunAdi, Miktar, Birim, KoliIci, KoliAdedi,
            ListeFiyati, Iskonto, IskBirimFiyat, KdvTutari, BirimFiyatKdvDahil, SatirToplam
          )
          VALUES (
            @SiparisId, @UrunKodu, @UrunAdi, @Miktar, @Birim, @KoliIci, @KoliAdedi,
            @ListeFiyati, @Iskonto, @IskBirimFiyat, @KdvTutari, @BirimFiyatKdvDahil, @SatirToplam
          )
        `);
    }

    await transaction.commit();
    res.json({ success: true, message: 'Sipariş kaydedildi', siparisId });
  } catch (err) {
    console.error('Hata:', err);
    try { await transaction.rollback(); } catch (e) {}
    res.status(500).json({ error: 'Sipariş kaydedilirken hata oluştu', detail: err.message });
  }
});

// Sipariş sil
app.delete('/api/siparisler/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    await pool.request()
      .input('SiparisId', sql.Int, id)
      .query('DELETE FROM Siparisler WHERE SiparisId = @SiparisId');
    res.json({ success: true, message: 'Sipariş silindi' });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Sipariş silinirken hata oluştu' });
  }
});

/* =========================================================
   ÜRÜN / STOK MODÜLÜ
   ========================================================= */

// Tüm ürünleri getir
app.get('/api/urunler', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query('SELECT * FROM Urunler WHERE IsActive = 1 ORDER BY UrunId DESC');
    res.json(result.recordset);
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Ürün listesi alınamadı', detail: err.message });
  }
});

// Yeni ürün ekle
app.post('/api/urunler', async (req, res) => {
  try {
    const pool = await poolPromise;
    const {
      UrunKodu, UrunAdi, Kategori, Birim, StokMiktari, KritikStokSeviyesi,
      AlisFiyati, ListeFiyati, KdvOrani, Aciklama, Tur, Desi,
      ParaBirimi, AlisBirimi, CevrimOrani, Barkod, GtipNo, Mensei
    } = req.body;

    const result = await pool.request()
      .input('UrunKodu', sql.NVarChar, UrunKodu)
      .input('UrunAdi', sql.NVarChar, UrunAdi)
      .input('Kategori', sql.NVarChar, Kategori || null)
      .input('Birim', sql.NVarChar, Birim || 'Adet')
      .input('StokMiktari', sql.Decimal(18, 2), StokMiktari || 0)
      .input('KritikStokSeviyesi', sql.Decimal(18, 2), KritikStokSeviyesi || 0)
      .input('AlisFiyati', sql.Decimal(18, 2), AlisFiyati || 0)
      .input('ListeFiyati', sql.Decimal(18, 2), ListeFiyati || 0)
      .input('KdvOrani', sql.Int, KdvOrani || 20)
      .input('Aciklama', sql.NVarChar, Aciklama || null)
      .input('Tur', sql.NVarChar, Tur || 'Ürün')
      .input('Desi', sql.Decimal(18, 2), Desi || 0)
      .input('ParaBirimi', sql.NVarChar, ParaBirimi || 'TL')
      .input('AlisBirimi', sql.NVarChar, AlisBirimi || null)
      .input('CevrimOrani', sql.Decimal(18, 4), CevrimOrani || 1)
      .input('Barkod', sql.NVarChar, Barkod || null)
      .input('GtipNo', sql.NVarChar, GtipNo || null)
      .input('Mensei', sql.NVarChar, Mensei || null)
      .query(`
        INSERT INTO Urunler (
          UrunKodu, UrunAdi, Kategori, Birim, StokMiktari, KritikStokSeviyesi,
          AlisFiyati, ListeFiyati, KdvOrani, Aciklama, Tur, Desi, ParaBirimi, AlisBirimi, CevrimOrani,
          Barkod, GtipNo, Mensei
        )
        OUTPUT INSERTED.*
        VALUES (
          @UrunKodu, @UrunAdi, @Kategori, @Birim, @StokMiktari, @KritikStokSeviyesi,
          @AlisFiyati, @ListeFiyati, @KdvOrani, @Aciklama, @Tur, @Desi, @ParaBirimi, @AlisBirimi, @CevrimOrani,
          @Barkod, @GtipNo, @Mensei
        )
      `);

    res.json({ success: true, message: 'Ürün eklendi', data: result.recordset[0] });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Ürün eklenirken hata oluştu', detail: err.message });
  }
});

// Ürün güncelle
app.put('/api/urunler/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    const {
      UrunAdi, Kategori, Birim, StokMiktari, KritikStokSeviyesi,
      AlisFiyati, ListeFiyati, KdvOrani, Aciklama, Tur, Desi,
      ParaBirimi, AlisBirimi, CevrimOrani, Barkod, GtipNo, Mensei
    } = req.body;

    await pool.request()
      .input('UrunId', sql.Int, id)
      .input('UrunAdi', sql.NVarChar, UrunAdi)
      .input('Kategori', sql.NVarChar, Kategori || null)
      .input('Birim', sql.NVarChar, Birim || 'Adet')
      .input('StokMiktari', sql.Decimal(18, 2), StokMiktari || 0)
      .input('KritikStokSeviyesi', sql.Decimal(18, 2), KritikStokSeviyesi || 0)
      .input('AlisFiyati', sql.Decimal(18, 2), AlisFiyati || 0)
      .input('ListeFiyati', sql.Decimal(18, 2), ListeFiyati || 0)
      .input('KdvOrani', sql.Int, KdvOrani || 20)
      .input('Aciklama', sql.NVarChar, Aciklama || null)
      .input('Tur', sql.NVarChar, Tur || 'Ürün')
      .input('Desi', sql.Decimal(18, 2), Desi || 0)
      .input('ParaBirimi', sql.NVarChar, ParaBirimi || 'TL')
      .input('AlisBirimi', sql.NVarChar, AlisBirimi || null)
      .input('CevrimOrani', sql.Decimal(18, 4), CevrimOrani || 1)
      .input('Barkod', sql.NVarChar, Barkod || null)
      .input('GtipNo', sql.NVarChar, GtipNo || null)
      .input('Mensei', sql.NVarChar, Mensei || null)
      .query(`
        UPDATE Urunler SET
          UrunAdi=@UrunAdi, Kategori=@Kategori, Birim=@Birim,
          StokMiktari=@StokMiktari, KritikStokSeviyesi=@KritikStokSeviyesi,
          AlisFiyati=@AlisFiyati, ListeFiyati=@ListeFiyati, KdvOrani=@KdvOrani, Aciklama=@Aciklama,
          Tur=@Tur, Desi=@Desi, ParaBirimi=@ParaBirimi, AlisBirimi=@AlisBirimi, CevrimOrani=@CevrimOrani,
          Barkod=@Barkod, GtipNo=@GtipNo, Mensei=@Mensei
        WHERE UrunId=@UrunId
      `);

    res.json({ success: true, message: 'Ürün güncellendi' });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Ürün güncellenirken hata oluştu', detail: err.message });
  }
});

// Ürün sil (soft delete)
app.delete('/api/urunler/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    await pool.request()
      .input('UrunId', sql.Int, id)
      .query('UPDATE Urunler SET IsActive = 0 WHERE UrunId = @UrunId');
    res.json({ success: true, message: 'Ürün silindi' });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Ürün silinirken hata oluştu' });
  }
});

/* --- Ürün Resim / Dosya Yönetimi (Resim, Teknik Çizim, Diğer) --- */
app.get('/api/urunler/:id/dosya', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().input('UrunId', sql.Int, req.params.id)
      .query('SELECT * FROM UrunDosya WHERE UrunId = @UrunId ORDER BY KapakResmi DESC, YuklemeTarihi DESC');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Dosyalar alınamadı', detail: err.message });
  }
});

app.post('/api/urunler/:id/dosya', uploadUrunDosya.single('dosya'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya bulunamadı' });
    const pool = await poolPromise;
    const { Tip, Baslik, KapakResmi } = req.body;
    const dosyaYolu = `/uploads/urun-dosya/${req.file.filename}`;

    if (KapakResmi === 'true' || KapakResmi === true) {
      await pool.request().input('UrunId', sql.Int, req.params.id)
        .query('UPDATE UrunDosya SET KapakResmi = 0 WHERE UrunId = @UrunId');
    }

    const result = await pool.request()
      .input('UrunId', sql.Int, req.params.id)
      .input('Tip', sql.NVarChar, Tip || 'Diğer')
      .input('Baslik', sql.NVarChar, Baslik || null)
      .input('DosyaAdi', sql.NVarChar, req.file.originalname)
      .input('DosyaYolu', sql.NVarChar, dosyaYolu)
      .input('DosyaBoyutu', sql.Int, req.file.size)
      .input('KapakResmi', sql.Bit, KapakResmi === 'true' || KapakResmi === true ? 1 : 0)
      .query(`
        INSERT INTO UrunDosya (UrunId, Tip, Baslik, DosyaAdi, DosyaYolu, DosyaBoyutu, KapakResmi)
        OUTPUT INSERTED.*
        VALUES (@UrunId, @Tip, @Baslik, @DosyaAdi, @DosyaYolu, @DosyaBoyutu, @KapakResmi)
      `);
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ error: 'Dosya yüklenirken hata oluştu', detail: err.message });
  }
});

app.put('/api/urunler/dosya/:dosyaId/kapak-yap', async (req, res) => {
  try {
    const pool = await poolPromise;
    const findResult = await pool.request().input('DosyaId', sql.Int, req.params.dosyaId)
      .query('SELECT UrunId FROM UrunDosya WHERE DosyaId = @DosyaId');
    if (!findResult.recordset[0]) return res.status(404).json({ error: 'Dosya bulunamadı' });
    const urunId = findResult.recordset[0].UrunId;

    await pool.request().input('UrunId', sql.Int, urunId)
      .query('UPDATE UrunDosya SET KapakResmi = 0 WHERE UrunId = @UrunId');
    await pool.request().input('DosyaId', sql.Int, req.params.dosyaId)
      .query('UPDATE UrunDosya SET KapakResmi = 1 WHERE DosyaId = @DosyaId');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Kapak resmi ayarlanırken hata oluştu', detail: err.message });
  }
});

app.delete('/api/urunler/dosya/:dosyaId', async (req, res) => {
  try {
    const pool = await poolPromise;
    const findResult = await pool.request().input('DosyaId', sql.Int, req.params.dosyaId)
      .query('SELECT DosyaYolu FROM UrunDosya WHERE DosyaId = @DosyaId');
    await pool.request().input('DosyaId', sql.Int, req.params.dosyaId)
      .query('DELETE FROM UrunDosya WHERE DosyaId = @DosyaId');
    if (findResult.recordset[0]) {
      const filePath = path.join(UPLOAD_ROOT, findResult.recordset[0].DosyaYolu.replace('/uploads/', ''));
      fs.unlink(filePath, () => {});
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Dosya silinirken hata oluştu', detail: err.message });
  }
});

/* =========================================================
   NUMUNE TAKİP MODÜLÜ
   ========================================================= */

app.get('/api/numuneler', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT n.*, c.CariAdi, c.CariKodu, u.UrunAdi AS UrunAdiTablo
      FROM Numuneler n
      JOIN CariListesi c ON c.CariId = n.CariId
      LEFT JOIN Urunler u ON u.UrunId = n.UrunId
      ORDER BY n.VerilmeTarihi DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Numune listesi alınamadı', detail: err.message });
  }
});

app.post('/api/numuneler', async (req, res) => {
  try {
    const pool = await poolPromise;
    const b = req.body;
    const result = await pool.request()
      .input('CariId', sql.Int, b.CariId)
      .input('UrunId', sql.Int, b.UrunId || null)
      .input('UrunAdiSerbest', sql.NVarChar, b.UrunAdiSerbest || null)
      .input('Miktar', sql.Decimal(18, 2), b.Miktar || 1)
      .input('Birim', sql.NVarChar, b.Birim || 'Adet')
      .input('VerilmeTarihi', sql.Date, b.VerilmeTarihi)
      .input('DonusTarihi', sql.Date, b.DonusTarihi || null)
      .input('VerenKisi', sql.NVarChar, b.VerenKisi || null)
      .input('Durum', sql.NVarChar, b.Durum || 'Beklemede')
      .input('Aciklama', sql.NVarChar, b.Aciklama || null)
      .query(`
        INSERT INTO Numuneler (CariId, UrunId, UrunAdiSerbest, Miktar, Birim, VerilmeTarihi, DonusTarihi, VerenKisi, Durum, Aciklama)
        OUTPUT INSERTED.*
        VALUES (@CariId, @UrunId, @UrunAdiSerbest, @Miktar, @Birim, @VerilmeTarihi, @DonusTarihi, @VerenKisi, @Durum, @Aciklama)
      `);
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ error: 'Numune kaydedilirken hata oluştu', detail: err.message });
  }
});

app.put('/api/numuneler/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const b = req.body;
    await pool.request()
      .input('NumuneId', sql.Int, req.params.id)
      .input('Durum', sql.NVarChar, b.Durum)
      .input('DonusTarihi', sql.Date, b.DonusTarihi || null)
      .input('Aciklama', sql.NVarChar, b.Aciklama || null)
      .query('UPDATE Numuneler SET Durum=@Durum, DonusTarihi=@DonusTarihi, Aciklama=@Aciklama WHERE NumuneId=@NumuneId');
    res.json({ success: true, message: 'Numune güncellendi' });
  } catch (err) {
    res.status(500).json({ error: 'Numune güncellenirken hata oluştu', detail: err.message });
  }
});

app.delete('/api/numuneler/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().input('NumuneId', sql.Int, req.params.id)
      .query('DELETE FROM Numuneler WHERE NumuneId = @NumuneId');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Numune silinirken hata oluştu' });
  }
});

/* =========================================================
   TEKLİF MODÜLÜ (Alış Teklifleri / Satış Teklifleri)
   ========================================================= */

app.get('/api/teklifler', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM Teklifler ORDER BY TeklifId DESC');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Teklif listesi alınamadı', detail: err.message });
  }
});

app.get('/api/teklifler/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const header = await pool.request().input('TeklifId', sql.Int, req.params.id)
      .query('SELECT * FROM Teklifler WHERE TeklifId = @TeklifId');
    if (header.recordset.length === 0) return res.status(404).json({ error: 'Teklif bulunamadı' });
    const items = await pool.request().input('TeklifId', sql.Int, req.params.id)
      .query('SELECT * FROM TeklifKalemleri WHERE TeklifId = @TeklifId');
    res.json({ ...header.recordset[0], items: items.recordset });
  } catch (err) {
    res.status(500).json({ error: 'Teklif detayı alınamadı', detail: err.message });
  }
});

app.post('/api/teklifler', async (req, res) => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);
  try {
    const { form, items } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'En az bir ürün satırı eklemelisiniz.' });
    }

    const araToplam = items.reduce((acc, it) => {
      const brut = Number(it.miktar || 0) * Number(it.birimFiyat || 0);
      const iskontolu = brut * (1 - Number(it.iskonto || 0) / 100);
      return acc + iskontolu;
    }, 0);
    const kdvToplam = items.reduce((acc, it) => {
      const brut = Number(it.miktar || 0) * Number(it.birimFiyat || 0);
      const iskontolu = brut * (1 - Number(it.iskonto || 0) / 100);
      return acc + iskontolu * (Number(it.kdvOrani || 0) / 100);
    }, 0);
    const genelToplam = araToplam + kdvToplam;

    await transaction.begin();

    const headerRequest = new sql.Request(transaction);
    const headerResult = await headerRequest
      .input('TeklifKodu', sql.NVarChar, form.teklifKodu)
      .input('Yon', sql.NVarChar, form.yon)
      .input('CariId', sql.Int, form.cariId)
      .input('CariKodu', sql.NVarChar, form.cariKodu || null)
      .input('CariAdi', sql.NVarChar, form.cariAdi || null)
      .input('TeklifTarihi', sql.Date, form.teklifTarihi)
      .input('GecerlilikTarihi', sql.Date, form.gecerlilikTarihi || null)
      .input('Durum', sql.NVarChar, form.durum || 'Taslak')
      .input('AraToplam', sql.Decimal(18, 2), araToplam)
      .input('KdvToplam', sql.Decimal(18, 2), kdvToplam)
      .input('GenelToplam', sql.Decimal(18, 2), genelToplam)
      .input('ParaBirimi', sql.NVarChar, form.paraBirimi || 'TRY')
      .input('OdemeSekli', sql.NVarChar, form.odemeSekli || null)
      .input('TeslimatSuresi', sql.NVarChar, form.teslimatSuresi || null)
      .input('Notlar', sql.NVarChar, form.notlar || null)
      .query(`
        INSERT INTO Teklifler (
          TeklifKodu, Yon, CariId, CariKodu, CariAdi, TeklifTarihi, GecerlilikTarihi, Durum,
          AraToplam, KdvToplam, GenelToplam, ParaBirimi, OdemeSekli, TeslimatSuresi, Notlar
        )
        OUTPUT INSERTED.TeklifId
        VALUES (
          @TeklifKodu, @Yon, @CariId, @CariKodu, @CariAdi, @TeklifTarihi, @GecerlilikTarihi, @Durum,
          @AraToplam, @KdvToplam, @GenelToplam, @ParaBirimi, @OdemeSekli, @TeslimatSuresi, @Notlar
        )
      `);

    const teklifId = headerResult.recordset[0].TeklifId;

    for (const it of items) {
      const brut = Number(it.miktar || 0) * Number(it.birimFiyat || 0);
      const iskontolu = brut * (1 - Number(it.iskonto || 0) / 100);
      const satirToplam = iskontolu * (1 + Number(it.kdvOrani || 0) / 100);

      const itemRequest = new sql.Request(transaction);
      await itemRequest
        .input('TeklifId', sql.Int, teklifId)
        .input('UrunId', sql.Int, it.urunId || null)
        .input('UrunKodu', sql.NVarChar, it.urunKodu || null)
        .input('UrunAdi', sql.NVarChar, it.urunAdi)
        .input('Miktar', sql.Decimal(18, 2), it.miktar || 0)
        .input('Birim', sql.NVarChar, it.birim || 'Adet')
        .input('BirimFiyat', sql.Decimal(18, 2), it.birimFiyat || 0)
        .input('Iskonto', sql.Decimal(9, 2), it.iskonto || 0)
        .input('KdvOrani', sql.Int, it.kdvOrani || 20)
        .input('SatirToplam', sql.Decimal(18, 2), satirToplam)
        .query(`
          INSERT INTO TeklifKalemleri (TeklifId, UrunId, UrunKodu, UrunAdi, Miktar, Birim, BirimFiyat, Iskonto, KdvOrani, SatirToplam)
          VALUES (@TeklifId, @UrunId, @UrunKodu, @UrunAdi, @Miktar, @Birim, @BirimFiyat, @Iskonto, @KdvOrani, @SatirToplam)
        `);
    }

    await transaction.commit();
    res.json({ success: true, teklifId, message: 'Teklif kaydedildi' });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ error: 'Teklif kaydedilirken hata oluştu', detail: err.message });
  }
});

app.put('/api/teklifler/:id/durum', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { Durum } = req.body;
    await pool.request()
      .input('TeklifId', sql.Int, req.params.id)
      .input('Durum', sql.NVarChar, Durum)
      .query('UPDATE Teklifler SET Durum = @Durum WHERE TeklifId = @TeklifId');
    res.json({ success: true, message: 'Durum güncellendi' });
  } catch (err) {
    res.status(500).json({ error: 'Durum güncellenirken hata oluştu', detail: err.message });
  }
});

app.delete('/api/teklifler/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().input('TeklifId', sql.Int, req.params.id)
      .query('DELETE FROM Teklifler WHERE TeklifId = @TeklifId');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Teklif silinirken hata oluştu', detail: err.message });
  }
});

// Kabul edilen bir teklifi siparişe dönüştür
app.post('/api/teklifler/:id/siparise-donustur', async (req, res) => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);
  try {
    const teklifHeader = await pool.request().input('TeklifId', sql.Int, req.params.id)
      .query('SELECT * FROM Teklifler WHERE TeklifId = @TeklifId');
    if (teklifHeader.recordset.length === 0) return res.status(404).json({ error: 'Teklif bulunamadı' });
    const teklif = teklifHeader.recordset[0];

    const kalemler = await pool.request().input('TeklifId', sql.Int, req.params.id)
      .query('SELECT * FROM TeklifKalemleri WHERE TeklifId = @TeklifId');

    await transaction.begin();

    const siparisKodu = `SIP-${Date.now().toString().slice(-8)}`;
    const headerRequest = new sql.Request(transaction);
    const headerResult = await headerRequest
      .input('SiparisKodu', sql.NVarChar, siparisKodu)
      .input('SiparisYonu', sql.NVarChar, teklif.Yon)
      .input('SiparisTarihi', sql.Date, new Date())
      .input('SiparisTipi', sql.NVarChar, 'Tekliften Dönüştürüldü')
      .input('SiparisVeren', sql.NVarChar, teklif.CariAdi)
      .input('CariKodu', sql.NVarChar, teklif.CariKodu)
      .input('CariAdi', sql.NVarChar, teklif.CariAdi)
      .input('ToplamTutar', sql.Decimal(18, 2), teklif.GenelToplam)
      .query(`
        INSERT INTO Siparisler (SiparisKodu, SiparisYonu, SiparisTarihi, SiparisTipi, SiparisVeren, CariKodu, CariAdi, ToplamTutar)
        OUTPUT INSERTED.SiparisId
        VALUES (@SiparisKodu, @SiparisYonu, @SiparisTarihi, @SiparisTipi, @SiparisVeren, @CariKodu, @CariAdi, @ToplamTutar)
      `);
    const siparisId = headerResult.recordset[0].SiparisId;

    for (const k of kalemler.recordset) {
      const brut = Number(k.Miktar) * Number(k.BirimFiyat);
      const iskBirimFiyat = Number(k.BirimFiyat) * (1 - Number(k.Iskonto || 0) / 100);
      const iskontoluToplam = Number(k.Miktar) * iskBirimFiyat;
      const kdvTutari = iskontoluToplam * (Number(k.KdvOrani || 0) / 100);
      const birimFiyatKdvDahil = iskBirimFiyat * (1 + Number(k.KdvOrani || 0) / 100);

      const itemRequest = new sql.Request(transaction);
      await itemRequest
        .input('SiparisId', sql.Int, siparisId)
        .input('UrunKodu', sql.NVarChar, k.UrunKodu)
        .input('UrunAdi', sql.NVarChar, k.UrunAdi)
        .input('Miktar', sql.Decimal(18, 2), k.Miktar)
        .input('Birim', sql.NVarChar, k.Birim)
        .input('KoliIci', sql.Decimal(18, 2), 0)
        .input('KoliAdedi', sql.Int, 0)
        .input('ListeFiyati', sql.Decimal(18, 2), k.BirimFiyat)
        .input('Iskonto', sql.Decimal(9, 2), k.Iskonto)
        .input('IskBirimFiyat', sql.Decimal(18, 2), iskBirimFiyat)
        .input('KdvTutari', sql.Decimal(18, 2), kdvTutari)
        .input('BirimFiyatKdvDahil', sql.Decimal(18, 2), birimFiyatKdvDahil)
        .input('SatirToplam', sql.Decimal(18, 2), k.SatirToplam)
        .query(`
          INSERT INTO SiparisDetay (
            SiparisId, UrunKodu, UrunAdi, Miktar, Birim, KoliIci, KoliAdedi,
            ListeFiyati, Iskonto, IskBirimFiyat, KdvTutari, BirimFiyatKdvDahil, SatirToplam
          )
          VALUES (
            @SiparisId, @UrunKodu, @UrunAdi, @Miktar, @Birim, @KoliIci, @KoliAdedi,
            @ListeFiyati, @Iskonto, @IskBirimFiyat, @KdvTutari, @BirimFiyatKdvDahil, @SatirToplam
          )
        `);
    }

    const updateRequest = new sql.Request(transaction);
    await updateRequest
      .input('TeklifId', sql.Int, req.params.id)
      .input('SiparisId', sql.Int, siparisId)
      .query(`UPDATE Teklifler SET Durum = N'Siparişe Dönüştü', DonusturulenSiparisId = @SiparisId WHERE TeklifId = @TeklifId`);

    await transaction.commit();
    res.json({ success: true, siparisId, message: 'Teklif siparişe dönüştürüldü' });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ error: 'Siparişe dönüştürülürken hata oluştu', detail: err.message });
  }
});

/* =========================================================
   FİNANSAL RAPORLAR (Vadesi Geçmiş, Yaşlandırma, Ürün Karlılığı)
   ========================================================= */

// Vadesi geçmiş / bekleyen tüm faturalar (Borç ve Alacak ayrı ayrı)
app.get('/api/raporlar/vadesi-gecmis', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT
        FaturaId, FaturaKodu, Yon, CariKodu, CariAdi, FaturaTarihi, VadeTarihi, GenelToplam, Durum,
        DATEDIFF(DAY, VadeTarihi, GETDATE()) AS GecikmeGunSayisi
      FROM Faturalar
      WHERE IsActive = 1 AND Durum IN (N'Bekliyor', N'Gecikti') AND VadeTarihi IS NOT NULL
      ORDER BY VadeTarihi ASC
    `);
    const rows = result.recordset;
    const alacaklar = rows.filter(r => r.Yon === 'Satış'); // müşteri bize borçlu
    const borclar = rows.filter(r => r.Yon === 'Alış');     // biz tedarikçiye borçluyuz

    const vadesiGecenAlacak = alacaklar.filter(r => r.GecikmeGunSayisi > 0).reduce((a, r) => a + Number(r.GenelToplam), 0);
    const vadesiGecenBorc = borclar.filter(r => r.GecikmeGunSayisi > 0).reduce((a, r) => a + Number(r.GenelToplam), 0);

    res.json({
      alacaklar, borclar,
      ozet: {
        toplamAlacak: alacaklar.reduce((a, r) => a + Number(r.GenelToplam), 0),
        toplamBorc: borclar.reduce((a, r) => a + Number(r.GenelToplam), 0),
        vadesiGecenAlacak, vadesiGecenBorc,
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Vadesi geçmiş raporu alınamadı', detail: err.message });
  }
});

// Yaşlandırılmış nakit akışı: bekleyen faturaları vade gecikme aralıklarına (bucket) dağıt
app.get('/api/raporlar/yaslandirma', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT
        FaturaId, FaturaKodu, Yon, CariKodu, CariAdi, FaturaTarihi, VadeTarihi, GenelToplam,
        DATEDIFF(DAY, VadeTarihi, GETDATE()) AS GecikmeGunSayisi
      FROM Faturalar
      WHERE IsActive = 1 AND Durum IN (N'Bekliyor', N'Gecikti') AND VadeTarihi IS NOT NULL
    `);
    const rows = result.recordset;

    const bucketAdi = (gun) => {
      if (gun < 0) return 'Henüz Vadesi Gelmedi';
      if (gun <= 30) return '0-30 Gün';
      if (gun <= 60) return '31-60 Gün';
      if (gun <= 90) return '61-90 Gün';
      return '90+ Gün';
    };
    const BUCKETS = ['Henüz Vadesi Gelmedi', '0-30 Gün', '31-60 Gün', '61-90 Gün', '90+ Gün'];

    const yapiOlustur = (yonRows) => {
      const map = {};
      BUCKETS.forEach(b => { map[b] = { bucket: b, tutar: 0, adet: 0 }; });
      yonRows.forEach(r => {
        const b = bucketAdi(r.GecikmeGunSayisi);
        map[b].tutar += Number(r.GenelToplam);
        map[b].adet += 1;
      });
      return BUCKETS.map(b => map[b]);
    };

    res.json({
      alacakYaslandirma: yapiOlustur(rows.filter(r => r.Yon === 'Satış')),
      borcYaslandirma: yapiOlustur(rows.filter(r => r.Yon === 'Alış')),
      detay: rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Yaşlandırma raporu alınamadı', detail: err.message });
  }
});

// Ürün karlılık analizi: satış faturalarından ürün bazlı ciro/maliyet/kar
app.get('/api/raporlar/urun-karliligi', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT
        fd.UrunKodu, fd.UrunAdi,
        SUM(fd.Miktar) AS ToplamAdet,
        SUM(fd.Miktar * fd.BirimFiyat) AS ToplamCiro,
        SUM(fd.Miktar * ISNULL(u.AlisFiyati, 0)) AS ToplamMaliyet
      FROM FaturaDetay fd
      JOIN Faturalar f ON f.FaturaId = fd.FaturaId
      LEFT JOIN Urunler u ON u.UrunKodu = fd.UrunKodu
      WHERE f.Yon = N'Satış' AND f.IsActive = 1
      GROUP BY fd.UrunKodu, fd.UrunAdi
    `);

    const rows = result.recordset.map(r => {
      const kar = Number(r.ToplamCiro) - Number(r.ToplamMaliyet);
      const karOrani = Number(r.ToplamCiro) > 0 ? (kar / Number(r.ToplamCiro)) * 100 : 0;
      return { ...r, ToplamKar: kar, KarOrani: Math.round(karOrani * 100) / 100 };
    }).sort((a, b) => b.ToplamKar - a.ToplamKar);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Ürün karlılık raporu alınamadı', detail: err.message });
  }
});

/* =========================================================
   ÜRETİM REÇETELERİ (BOM) MODÜLÜ
   ========================================================= */

app.get('/api/receteler', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query('SELECT * FROM Receteler WHERE IsActive = 1 ORDER BY ReceteId DESC');
    res.json(result.recordset);
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Reçete listesi alınamadı', detail: err.message });
  }
});

app.get('/api/receteler/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;

    const header = await pool.request()
      .input('ReceteId', sql.Int, id)
      .query('SELECT * FROM Receteler WHERE ReceteId = @ReceteId');

    const items = await pool.request()
      .input('ReceteId', sql.Int, id)
      .query('SELECT * FROM ReceteDetay WHERE ReceteId = @ReceteId');

    const istasyonlar = await pool.request()
      .input('ReceteId', sql.Int, id)
      .query('SELECT * FROM ReceteIstasyon WHERE ReceteId = @ReceteId ORDER BY Sira');

    if (header.recordset.length === 0) {
      return res.status(404).json({ error: 'Reçete bulunamadı' });
    }

    res.json({ ...header.recordset[0], items: items.recordset, istasyonlar: istasyonlar.recordset });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Reçete detayı alınamadı', detail: err.message });
  }
});

// Yeni reçete kaydet (başlık + hammadde satırları + istasyonlar)
app.post('/api/receteler', async (req, res) => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);

  try {
    const { form, items, istasyonlar } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'En az bir hammadde satırı eklemelisiniz.' });
    }

    await transaction.begin();

    const headerRequest = new sql.Request(transaction);
    const headerResult = await headerRequest
      .input('ReceteKodu', sql.NVarChar, form.receteKodu)
      .input('MamulUrunId', sql.Int, form.mamulUrunId)
      .input('MamulAdi', sql.NVarChar, form.mamulAdi)
      .input('Aciklama', sql.NVarChar, form.aciklama || null)
      .query(`
        INSERT INTO Receteler (ReceteKodu, MamulUrunId, MamulAdi, Aciklama)
        OUTPUT INSERTED.ReceteId
        VALUES (@ReceteKodu, @MamulUrunId, @MamulAdi, @Aciklama)
      `);

    const receteId = headerResult.recordset[0].ReceteId;

    for (const it of items) {
      const itemRequest = new sql.Request(transaction);
      await itemRequest
        .input('ReceteId', sql.Int, receteId)
        .input('HammaddeUrunId', sql.Int, it.hammaddeUrunId)
        .input('HammaddeAdi', sql.NVarChar, it.hammaddeAdi)
        .input('Miktar', sql.Decimal(18, 3), it.miktar || 0)
        .input('Birim', sql.NVarChar, it.birim)
        .input('Istasyon', sql.NVarChar, it.istasyon || null)
        .query(`
          INSERT INTO ReceteDetay (ReceteId, HammaddeUrunId, HammaddeAdi, Miktar, Birim, Istasyon)
          VALUES (@ReceteId, @HammaddeUrunId, @HammaddeAdi, @Miktar, @Birim, @Istasyon)
        `);
    }

    if (istasyonlar && istasyonlar.length > 0) {
      let sira = 1;
      for (const ist of istasyonlar) {
        const istRequest = new sql.Request(transaction);
        await istRequest
          .input('ReceteId', sql.Int, receteId)
          .input('Sira', sql.Int, sira++)
          .input('IstasyonAdi', sql.NVarChar, ist.istasyonAdi)
          .input('TahminiSureDk', sql.Int, ist.tahminiSureDk || 0)
          .query(`
            INSERT INTO ReceteIstasyon (ReceteId, Sira, IstasyonAdi, TahminiSureDk)
            VALUES (@ReceteId, @Sira, @IstasyonAdi, @TahminiSureDk)
          `);
      }
    }

    await transaction.commit();
    res.json({ success: true, message: 'Reçete kaydedildi', receteId });
  } catch (err) {
    console.error('Hata:', err);
    try { await transaction.rollback(); } catch (e) {}
    res.status(500).json({ error: 'Reçete kaydedilirken hata oluştu', detail: err.message });
  }
});

app.delete('/api/receteler/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    await pool.request()
      .input('ReceteId', sql.Int, id)
      .query('UPDATE Receteler SET IsActive = 0 WHERE ReceteId = @ReceteId');
    res.json({ success: true, message: 'Reçete silindi' });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Reçete silinirken hata oluştu' });
  }
});

/* =========================================================
   ÜRETİM MODÜLÜ — reçeteye göre üretim yap, stoktan hammadde düş,
   mamul stoğunu artır
   ========================================================= */

app.get('/api/uretim', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query('SELECT TOP 100 * FROM UretimEmirleri ORDER BY UretimId DESC');
    res.json(result.recordset);
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Üretim geçmişi alınamadı', detail: err.message });
  }
});

app.post('/api/uretim', async (req, res) => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);

  try {
    const { receteId, miktar, notlar } = req.body;
    if (!receteId || !miktar || miktar <= 0) {
      return res.status(400).json({ error: 'Reçete ve geçerli bir üretim miktarı gereklidir.' });
    }

    await transaction.begin();

    const receteReq = new sql.Request(transaction);
    const receteResult = await receteReq
      .input('ReceteId', sql.Int, receteId)
      .query('SELECT * FROM Receteler WHERE ReceteId = @ReceteId');

    if (receteResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Reçete bulunamadı' });
    }
    const recete = receteResult.recordset[0];

    const detayReq = new sql.Request(transaction);
    const detayResult = await detayReq
      .input('ReceteId', sql.Int, receteId)
      .query('SELECT * FROM ReceteDetay WHERE ReceteId = @ReceteId');

    // Hammaddeleri stoktan düş
    for (const d of detayResult.recordset) {
      const dusReq = new sql.Request(transaction);
      await dusReq
        .input('UrunId', sql.Int, d.HammaddeUrunId)
        .input('Dusulecek', sql.Decimal(18, 3), Number(d.Miktar) * Number(miktar))
        .query('UPDATE Urunler SET StokMiktari = StokMiktari - @Dusulecek WHERE UrunId = @UrunId');
    }

    // Mamul stoğunu artır
    const artirReq = new sql.Request(transaction);
    await artirReq
      .input('UrunId', sql.Int, recete.MamulUrunId)
      .input('Artir', sql.Decimal(18, 2), miktar)
      .query('UPDATE Urunler SET StokMiktari = StokMiktari + @Artir WHERE UrunId = @UrunId');

    // Üretim kaydı oluştur
    const kayitReq = new sql.Request(transaction);
    await kayitReq
      .input('ReceteId', sql.Int, receteId)
      .input('MamulUrunId', sql.Int, recete.MamulUrunId)
      .input('MamulAdi', sql.NVarChar, recete.MamulAdi)
      .input('UretilenMiktar', sql.Decimal(18, 2), miktar)
      .input('Notlar', sql.NVarChar, notlar || null)
      .query(`
        INSERT INTO UretimEmirleri (ReceteId, MamulUrunId, MamulAdi, UretilenMiktar, Notlar)
        VALUES (@ReceteId, @MamulUrunId, @MamulAdi, @UretilenMiktar, @Notlar)
      `);

    await transaction.commit();
    res.json({ success: true, message: `${miktar} adet ${recete.MamulAdi} üretildi, stoklar güncellendi.` });
  } catch (err) {
    console.error('Hata:', err);
    try { await transaction.rollback(); } catch (e) {}
    res.status(500).json({ error: 'Üretim işlenirken hata oluştu', detail: err.message });
  }
});

/* =========================================================
   FASON MODÜLÜ
   ========================================================= */

app.get('/api/fason', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query('SELECT * FROM FasonIslemleri WHERE IsActive = 1 ORDER BY FasonId DESC');
    res.json(result.recordset);
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Fason listesi alınamadı', detail: err.message });
  }
});

app.post('/api/fason', async (req, res) => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);
  try {
    const {
      FasonKodu, CariKodu, CariAdi, UrunKodu, UrunAdi, GonderilenMiktar, Birim,
      GonderimTarihi, BeklenenDonusTarihi, Aciklama
    } = req.body;

    await transaction.begin();

    const insertReq = new sql.Request(transaction);
    const result = await insertReq
      .input('FasonKodu', sql.NVarChar, FasonKodu)
      .input('CariKodu', sql.NVarChar, CariKodu)
      .input('CariAdi', sql.NVarChar, CariAdi)
      .input('UrunKodu', sql.NVarChar, UrunKodu)
      .input('UrunAdi', sql.NVarChar, UrunAdi)
      .input('GonderilenMiktar', sql.Decimal(18, 2), GonderilenMiktar || 0)
      .input('Birim', sql.NVarChar, Birim || 'Adet')
      .input('GonderimTarihi', sql.Date, GonderimTarihi)
      .input('BeklenenDonusTarihi', sql.Date, BeklenenDonusTarihi || null)
      .input('Aciklama', sql.NVarChar, Aciklama || null)
      .query(`
        INSERT INTO FasonIslemleri (
          FasonKodu, CariKodu, CariAdi, UrunKodu, UrunAdi, GonderilenMiktar, Birim,
          GonderimTarihi, BeklenenDonusTarihi, Aciklama
        )
        OUTPUT INSERTED.*
        VALUES (
          @FasonKodu, @CariKodu, @CariAdi, @UrunKodu, @UrunAdi, @GonderilenMiktar, @Birim,
          @GonderimTarihi, @BeklenenDonusTarihi, @Aciklama
        )
      `);

    // --- OTOMATİK STOK HAREKETİ: fasona giden malzeme kendi stoğumuzdan düşer ---
    if (UrunKodu) {
      const stokReq = new sql.Request(transaction);
      await stokReq
        .input('UrunKodu', sql.NVarChar, UrunKodu)
        .input('Miktar', sql.Decimal(18, 2), GonderilenMiktar || 0)
        .query('UPDATE Urunler SET StokMiktari = StokMiktari - @Miktar WHERE UrunKodu = @UrunKodu');
    }

    await transaction.commit();
    res.json({ success: true, message: 'Fason kaydı eklendi, stok güncellendi', data: result.recordset[0] });
  } catch (err) {
    console.error('Hata:', err);
    try { await transaction.rollback(); } catch (e) {}
    res.status(500).json({ error: 'Fason kaydedilirken hata oluştu', detail: err.message });
  }
});

// Fason dönüşü işaretle
app.put('/api/fason/:id/donus', async (req, res) => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);
  try {
    const { id } = req.params;
    const { DonenMiktar, DonusTarihi } = req.body;

    await transaction.begin();

    const fasonReq = new sql.Request(transaction);
    const fasonResult = await fasonReq.input('FasonId', sql.Int, id)
      .query('SELECT * FROM FasonIslemleri WHERE FasonId = @FasonId');
    if (fasonResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Fason kaydı bulunamadı' });
    }
    const fason = fasonResult.recordset[0];

    const updateReq = new sql.Request(transaction);
    await updateReq
      .input('FasonId', sql.Int, id)
      .input('DonenMiktar', sql.Decimal(18, 2), DonenMiktar || 0)
      .input('DonusTarihi', sql.Date, DonusTarihi)
      .query(`
        UPDATE FasonIslemleri SET
          DonenMiktar = @DonenMiktar, DonusTarihi = @DonusTarihi, Durum = 'Tamamlandı'
        WHERE FasonId = @FasonId
      `);

    // --- OTOMATİK STOK HAREKETİ: dönen mal (fasoncunun işlediği ürün) stoğa geri eklenir ---
    if (fason.UrunKodu) {
      const stokReq = new sql.Request(transaction);
      await stokReq
        .input('UrunKodu', sql.NVarChar, fason.UrunKodu)
        .input('Miktar', sql.Decimal(18, 2), DonenMiktar || 0)
        .query('UPDATE Urunler SET StokMiktari = StokMiktari + @Miktar WHERE UrunKodu = @UrunKodu');
    }

    await transaction.commit();
    res.json({ success: true, message: 'Fason dönüşü kaydedildi, stok güncellendi' });
  } catch (err) {
    console.error('Hata:', err);
    try { await transaction.rollback(); } catch (e) {}
    res.status(500).json({ error: 'Fason güncellenirken hata oluştu', detail: err.message });
  }
});

app.delete('/api/fason/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    await pool.request()
      .input('FasonId', sql.Int, id)
      .query('UPDATE FasonIslemleri SET IsActive = 0 WHERE FasonId = @FasonId');
    res.json({ success: true, message: 'Fason kaydı silindi' });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Fason kaydı silinirken hata oluştu' });
  }
});

/* =========================================================
   GİRİŞ (AUTH) MODÜLÜ
   ========================================================= */

function verifyPassword(password, salt, storedHash) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return hash === storedHash;
}

app.post('/api/auth/login', async (req, res) => {
  try {
    const { kullaniciAdi, sifre } = req.body;
    if (!kullaniciAdi || !sifre) {
      return res.status(400).json({ error: 'Kullanıcı adı ve şifre gereklidir.' });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input('KullaniciAdi', sql.NVarChar, kullaniciAdi)
      .query('SELECT * FROM Kullanicilar WHERE KullaniciAdi = @KullaniciAdi AND IsActive = 1');

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
    }

    const user = result.recordset[0];
    const gecerli = verifyPassword(sifre, user.SifreSalt, user.SifreHash);
    if (!gecerli) {
      return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
    }

    res.json({
      success: true,
      user: { id: user.KullaniciId, name: user.AdSoyad, kullaniciAdi: user.KullaniciAdi, role: user.Rol }
    });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Giriş sırasında hata oluştu', detail: err.message });
  }
});

// Yeni kullanıcı ekle (yönetici panelinden kullanılabilir)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { kullaniciAdi, sifre, adSoyad, rol } = req.body;
    if (!kullaniciAdi || !sifre) {
      return res.status(400).json({ error: 'Kullanıcı adı ve şifre gereklidir.' });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(sifre, salt, 64).toString('hex');

    const pool = await poolPromise;
    await pool.request()
      .input('KullaniciAdi', sql.NVarChar, kullaniciAdi)
      .input('SifreSalt', sql.NVarChar, salt)
      .input('SifreHash', sql.NVarChar, hash)
      .input('AdSoyad', sql.NVarChar, adSoyad || kullaniciAdi)
      .input('Rol', sql.NVarChar, rol || 'Kullanıcı')
      .query(`
        INSERT INTO Kullanicilar (KullaniciAdi, SifreSalt, SifreHash, AdSoyad, Rol)
        VALUES (@KullaniciAdi, @SifreSalt, @SifreHash, @AdSoyad, @Rol)
      `);

    res.json({ success: true, message: 'Kullanıcı oluşturuldu' });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Kullanıcı oluşturulurken hata oluştu (kullanıcı adı zaten alınmış olabilir)', detail: err.message });
  }
});

// Kullanıcı listesi (şifre bilgisi hariç)
app.get('/api/auth/kullanicilar', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query('SELECT KullaniciId, KullaniciAdi, AdSoyad, Rol, IsActive, CreatedAt FROM Kullanicilar ORDER BY KullaniciId');
    res.json(result.recordset);
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Kullanıcı listesi alınamadı', detail: err.message });
  }
});

// Kullanıcı bilgilerini güncelle (ad/rol/aktiflik)
app.put('/api/auth/kullanicilar/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    const { AdSoyad, Rol, IsActive } = req.body;

    await pool.request()
      .input('KullaniciId', sql.Int, id)
      .input('AdSoyad', sql.NVarChar, AdSoyad)
      .input('Rol', sql.NVarChar, Rol)
      .input('IsActive', sql.Bit, IsActive)
      .query(`
        UPDATE Kullanicilar SET AdSoyad=@AdSoyad, Rol=@Rol, IsActive=@IsActive
        WHERE KullaniciId=@KullaniciId
      `);

    res.json({ success: true, message: 'Kullanıcı güncellendi' });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Kullanıcı güncellenirken hata oluştu', detail: err.message });
  }
});

// Şifre sıfırla
app.put('/api/auth/kullanicilar/:id/sifre', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    const { yeniSifre } = req.body;
    if (!yeniSifre || yeniSifre.length < 4) {
      return res.status(400).json({ error: 'Şifre en az 4 karakter olmalıdır.' });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(yeniSifre, salt, 64).toString('hex');

    await pool.request()
      .input('KullaniciId', sql.Int, id)
      .input('SifreSalt', sql.NVarChar, salt)
      .input('SifreHash', sql.NVarChar, hash)
      .query('UPDATE Kullanicilar SET SifreSalt=@SifreSalt, SifreHash=@SifreHash WHERE KullaniciId=@KullaniciId');

    res.json({ success: true, message: 'Şifre güncellendi' });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Şifre güncellenirken hata oluştu', detail: err.message });
  }
});

// Kullanıcıyı pasifleştir (soft delete)
app.delete('/api/auth/kullanicilar/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    await pool.request()
      .input('KullaniciId', sql.Int, id)
      .query('UPDATE Kullanicilar SET IsActive = 0 WHERE KullaniciId = @KullaniciId');
    res.json({ success: true, message: 'Kullanıcı pasifleştirildi' });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Kullanıcı pasifleştirilirken hata oluştu' });
  }
});

/* =========================================================
   TOPLU SİPARİŞ İÇE AKTARMA (Platform siparişleri - Excel/CSV)
   ========================================================= */
app.post('/api/siparisler/toplu-import', async (req, res) => {
  const pool = await poolPromise;
  let basarili = 0, hatali = 0;
  const hatalar = [];

  try {
    const { siparisler } = req.body; // [{ form, items }]
    if (!siparisler || siparisler.length === 0) {
      return res.status(400).json({ error: 'İçe aktarılacak sipariş bulunamadı.' });
    }

    for (const s of siparisler) {
      const transaction = new sql.Transaction(pool);
      try {
        await transaction.begin();
        const toplamTutar = (s.items || []).reduce((acc, it) => acc + Number(it.satirToplam || 0), 0);

        const headerRequest = new sql.Request(transaction);
        const headerResult = await headerRequest
          .input('SiparisKodu', sql.NVarChar, s.form.siparisKodu)
          .input('SiparisYonu', sql.NVarChar, 'Satış')
          .input('SiparisTarihi', sql.Date, s.form.siparisTarihi)
          .input('SiparisTipi', sql.NVarChar, s.form.siparisTipi || 'YENİ SİPARİŞ')
          .input('SiparisVeren', sql.NVarChar, s.form.siparisVeren)
          .input('CariKodu', sql.NVarChar, s.form.cariKodu || null)
          .input('CariAdi', sql.NVarChar, s.form.cariAdi)
          .input('ToplamTutar', sql.Decimal(18, 2), toplamTutar)
          .query(`
            INSERT INTO Siparisler (SiparisKodu, SiparisYonu, SiparisTarihi, SiparisTipi, SiparisVeren, CariKodu, CariAdi, ToplamTutar)
            OUTPUT INSERTED.SiparisId
            VALUES (@SiparisKodu, @SiparisYonu, @SiparisTarihi, @SiparisTipi, @SiparisVeren, @CariKodu, @CariAdi, @ToplamTutar)
          `);

        const siparisId = headerResult.recordset[0].SiparisId;

        for (const it of (s.items || [])) {
          const itemRequest = new sql.Request(transaction);
          await itemRequest
            .input('SiparisId', sql.Int, siparisId)
            .input('UrunKodu', sql.NVarChar, it.urunKodu || null)
            .input('UrunAdi', sql.NVarChar, it.urunAdi)
            .input('Miktar', sql.Decimal(18, 2), it.miktar || 0)
            .input('Birim', sql.NVarChar, it.birim || 'ADET')
            .input('BirimFiyatKdvDahil', sql.Decimal(18, 2), it.birimFiyat || 0)
            .input('SatirToplam', sql.Decimal(18, 2), it.satirToplam || 0)
            .query(`
              INSERT INTO SiparisDetay (SiparisId, UrunKodu, UrunAdi, Miktar, Birim, BirimFiyatKdvDahil, SatirToplam)
              VALUES (@SiparisId, @UrunKodu, @UrunAdi, @Miktar, @Birim, @BirimFiyatKdvDahil, @SatirToplam)
            `);
        }

        await transaction.commit();
        basarili++;
      } catch (err) {
        try { await transaction.rollback(); } catch (e) {}
        hatali++;
        hatalar.push({ siparisKodu: s.form?.siparisKodu, hata: err.message });
      }
    }

    res.json({ success: true, basarili, hatali, hatalar });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Toplu içe aktarma sırasında hata oluştu', detail: err.message });
  }
});

/* =========================================================
   İRSALİYE MODÜLÜ (Alış / Satış)
   ========================================================= */

app.get('/api/irsaliyeler', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query('SELECT * FROM Irsaliyeler WHERE IsActive = 1 ORDER BY IrsaliyeId DESC');
    res.json(result.recordset);
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'İrsaliye listesi alınamadı', detail: err.message });
  }
});

app.get('/api/irsaliyeler/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    const header = await pool.request().input('IrsaliyeId', sql.Int, id)
      .query('SELECT * FROM Irsaliyeler WHERE IrsaliyeId = @IrsaliyeId');
    const items = await pool.request().input('IrsaliyeId', sql.Int, id)
      .query('SELECT * FROM IrsaliyeDetay WHERE IrsaliyeId = @IrsaliyeId');
    if (header.recordset.length === 0) return res.status(404).json({ error: 'İrsaliye bulunamadı' });
    res.json({ ...header.recordset[0], items: items.recordset });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'İrsaliye detayı alınamadı', detail: err.message });
  }
});

// Sipariş bilgilerini irsaliye taslağı olarak getir (siparisId ile)
app.get('/api/siparisler/:id/irsaliye-taslak', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;

    const header = await pool.request().input('SiparisId', sql.Int, id)
      .query('SELECT * FROM Siparisler WHERE SiparisId = @SiparisId');
    if (header.recordset.length === 0) return res.status(404).json({ error: 'Sipariş bulunamadı' });
    const s = header.recordset[0];

    const items = await pool.request().input('SiparisId', sql.Int, id)
      .query('SELECT * FROM SiparisDetay WHERE SiparisId = @SiparisId');

    res.json({
      form: {
        yon: s.SiparisYonu,
        cariKodu: s.CariKodu,
        cariAdi: s.CariAdi,
        siparisId: s.SiparisId,
        teslimatAdresi: s.SevkiyatAdres || s.FaturaAdres || ''
      },
      items: items.recordset.map(it => ({
        urunKodu: it.UrunKodu,
        urunAdi: it.UrunAdi,
        miktar: it.Miktar,
        birim: it.Birim,
        birimFiyat: it.BirimFiyatKdvDahil || 0,
        satirToplam: it.SatirToplam
      }))
    });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Sipariş taslağı alınamadı', detail: err.message });
  }
});

app.post('/api/irsaliyeler', async (req, res) => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);
  try {
    const { form, items } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'En az bir ürün satırı eklemelisiniz.' });
    }
    const toplamTutar = items.reduce((acc, it) => acc + Number(it.satirToplam || 0), 0);

    await transaction.begin();
    const headerRequest = new sql.Request(transaction);
    const headerResult = await headerRequest
      .input('IrsaliyeKodu', sql.NVarChar, form.irsaliyeKodu)
      .input('Yon', sql.NVarChar, form.yon || 'Satış')
      .input('IrsaliyeTarihi', sql.Date, form.irsaliyeTarihi)
      .input('CariKodu', sql.NVarChar, form.cariKodu)
      .input('CariAdi', sql.NVarChar, form.cariAdi)
      .input('SiparisId', sql.Int, form.siparisId || null)
      .input('TeslimatAdresi', sql.NVarChar, form.teslimatAdresi || null)
      .input('Notlar', sql.NVarChar, form.notlar || null)
      .input('ToplamTutar', sql.Decimal(18, 2), toplamTutar)
      .query(`
        INSERT INTO Irsaliyeler (IrsaliyeKodu, Yon, IrsaliyeTarihi, CariKodu, CariAdi, SiparisId, TeslimatAdresi, Notlar, ToplamTutar)
        OUTPUT INSERTED.IrsaliyeId
        VALUES (@IrsaliyeKodu, @Yon, @IrsaliyeTarihi, @CariKodu, @CariAdi, @SiparisId, @TeslimatAdresi, @Notlar, @ToplamTutar)
      `);

    const irsaliyeId = headerResult.recordset[0].IrsaliyeId;

    for (const it of items) {
      const itemRequest = new sql.Request(transaction);
      await itemRequest
        .input('IrsaliyeId', sql.Int, irsaliyeId)
        .input('UrunKodu', sql.NVarChar, it.urunKodu)
        .input('UrunAdi', sql.NVarChar, it.urunAdi)
        .input('Miktar', sql.Decimal(18, 2), it.miktar || 0)
        .input('Birim', sql.NVarChar, it.birim)
        .input('BirimFiyat', sql.Decimal(18, 2), it.birimFiyat || 0)
        .input('SatirToplam', sql.Decimal(18, 2), it.satirToplam || 0)
        .query(`
          INSERT INTO IrsaliyeDetay (IrsaliyeId, UrunKodu, UrunAdi, Miktar, Birim, BirimFiyat, SatirToplam)
          VALUES (@IrsaliyeId, @UrunKodu, @UrunAdi, @Miktar, @Birim, @BirimFiyat, @SatirToplam)
        `);

      // --- OTOMATİK STOK HAREKETİ: Satış irsaliyesi -> stok düşer; Alış irsaliyesi -> stok artar ---
      if (it.urunKodu) {
        const stokReq = new sql.Request(transaction);
        if ((form.yon || 'Satış') === 'Satış') {
          await stokReq
            .input('UrunKodu', sql.NVarChar, it.urunKodu)
            .input('Miktar', sql.Decimal(18, 2), it.miktar || 0)
            .query('UPDATE Urunler SET StokMiktari = StokMiktari - @Miktar WHERE UrunKodu = @UrunKodu');
        } else {
          await stokReq
            .input('UrunKodu', sql.NVarChar, it.urunKodu)
            .input('Miktar', sql.Decimal(18, 2), it.miktar || 0)
            .query('UPDATE Urunler SET StokMiktari = StokMiktari + @Miktar WHERE UrunKodu = @UrunKodu');
        }
      }
    }

    await transaction.commit();
    res.json({ success: true, message: 'İrsaliye kaydedildi', irsaliyeId });
  } catch (err) {
    console.error('Hata:', err);
    try { await transaction.rollback(); } catch (e) {}
    res.status(500).json({ error: 'İrsaliye kaydedilirken hata oluştu', detail: err.message });
  }
});

app.delete('/api/irsaliyeler/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    await pool.request().input('IrsaliyeId', sql.Int, id)
      .query('UPDATE Irsaliyeler SET IsActive = 0 WHERE IrsaliyeId = @IrsaliyeId');
    res.json({ success: true, message: 'İrsaliye silindi' });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'İrsaliye silinirken hata oluştu' });
  }
});

/* =========================================================
   FATURA MODÜLÜ (Alış / Satış)
   ========================================================= */

// İrsaliye bilgilerini fatura taslağı olarak getir (irsaliyeId ile)
app.get('/api/irsaliyeler/:id/fatura-taslak', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;

    const header = await pool.request().input('IrsaliyeId', sql.Int, id)
      .query('SELECT * FROM Irsaliyeler WHERE IrsaliyeId = @IrsaliyeId');
    if (header.recordset.length === 0) return res.status(404).json({ error: 'İrsaliye bulunamadı' });
    const i = header.recordset[0];

    const items = await pool.request().input('IrsaliyeId', sql.Int, id)
      .query('SELECT * FROM IrsaliyeDetay WHERE IrsaliyeId = @IrsaliyeId');

    // Ürün KDV oranlarını da getirelim
    const detayliSatirlar = [];
    for (const it of items.recordset) {
      let kdvOrani = 20;
      if (it.UrunKodu) {
        const urunRes = await pool.request().input('UrunKodu', sql.NVarChar, it.UrunKodu)
          .query('SELECT TOP 1 KdvOrani FROM Urunler WHERE UrunKodu = @UrunKodu');
        if (urunRes.recordset.length > 0) kdvOrani = urunRes.recordset[0].KdvOrani ?? 20;
      }
      const araToplam = Number(it.Miktar) * Number(it.BirimFiyat);
      detayliSatirlar.push({
        urunKodu: it.UrunKodu, urunAdi: it.UrunAdi, miktar: it.Miktar, birim: it.Birim,
        birimFiyat: it.BirimFiyat, kdvOrani, kdvTutari: araToplam * (kdvOrani / 100), araToplam
      });
    }

    res.json({
      form: {
        yon: i.Yon,
        cariKodu: i.CariKodu,
        cariAdi: i.CariAdi,
        irsaliyeId: i.IrsaliyeId
      },
      items: detayliSatirlar
    });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'İrsaliye taslağı alınamadı', detail: err.message });
  }
});

app.get('/api/faturalar', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query('SELECT * FROM Faturalar WHERE IsActive = 1 ORDER BY FaturaId DESC');
    res.json(result.recordset);
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Fatura listesi alınamadı', detail: err.message });
  }
});

app.post('/api/faturalar', async (req, res) => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);
  try {
    const { form, items } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'En az bir ürün satırı eklemelisiniz.' });
    }
    const araToplam = items.reduce((acc, it) => acc + Number(it.miktar || 0) * Number(it.birimFiyat || 0), 0);
    const kdvToplam = items.reduce((acc, it) => acc + Number(it.kdvTutari || 0), 0);
    const genelToplam = araToplam + kdvToplam;

    await transaction.begin();
    const headerRequest = new sql.Request(transaction);
    const headerResult = await headerRequest
      .input('FaturaKodu', sql.NVarChar, form.faturaKodu)
      .input('Yon', sql.NVarChar, form.yon || 'Satış')
      .input('FaturaTarihi', sql.Date, form.faturaTarihi)
      .input('VadeTarihi', sql.Date, form.vadeTarihi || null)
      .input('CariKodu', sql.NVarChar, form.cariKodu)
      .input('CariAdi', sql.NVarChar, form.cariAdi)
      .input('SiparisId', sql.Int, form.siparisId || null)
      .input('IrsaliyeId', sql.Int, form.irsaliyeId || null)
      .input('OdemeSekli', sql.NVarChar, form.odemeSekli)
      .input('AraToplam', sql.Decimal(18, 2), araToplam)
      .input('KdvToplam', sql.Decimal(18, 2), kdvToplam)
      .input('GenelToplam', sql.Decimal(18, 2), genelToplam)
      .query(`
        INSERT INTO Faturalar (FaturaKodu, Yon, FaturaTarihi, VadeTarihi, CariKodu, CariAdi, SiparisId, IrsaliyeId, OdemeSekli, AraToplam, KdvToplam, GenelToplam)
        OUTPUT INSERTED.FaturaId
        VALUES (@FaturaKodu, @Yon, @FaturaTarihi, @VadeTarihi, @CariKodu, @CariAdi, @SiparisId, @IrsaliyeId, @OdemeSekli, @AraToplam, @KdvToplam, @GenelToplam)
      `);

    const faturaId = headerResult.recordset[0].FaturaId;

    for (const it of items) {
      const itemRequest = new sql.Request(transaction);
      await itemRequest
        .input('FaturaId', sql.Int, faturaId)
        .input('UrunKodu', sql.NVarChar, it.urunKodu)
        .input('UrunAdi', sql.NVarChar, it.urunAdi)
        .input('Miktar', sql.Decimal(18, 2), it.miktar || 0)
        .input('Birim', sql.NVarChar, it.birim)
        .input('BirimFiyat', sql.Decimal(18, 2), it.birimFiyat || 0)
        .input('KdvOrani', sql.Int, it.kdvOrani || 20)
        .input('KdvTutari', sql.Decimal(18, 2), it.kdvTutari || 0)
        .input('SatirToplam', sql.Decimal(18, 2), Number(it.miktar || 0) * Number(it.birimFiyat || 0))
        .query(`
          INSERT INTO FaturaDetay (FaturaId, UrunKodu, UrunAdi, Miktar, Birim, BirimFiyat, KdvOrani, KdvTutari, SatirToplam)
          VALUES (@FaturaId, @UrunKodu, @UrunAdi, @Miktar, @Birim, @BirimFiyat, @KdvOrani, @KdvTutari, @SatirToplam)
        `);
    }

    // --- OTOMATİK CARİ HAREKET: Satış faturası -> cari bize borçlanır (Borç); Alış faturası -> biz cariye borçlanırız (Alacak) ---
    const hareketTipi = (form.yon || 'Satış') === 'Satış' ? 'Borç' : 'Alacak';
    const hareketRequest = new sql.Request(transaction);
    await hareketRequest
      .input('CariKodu', sql.NVarChar, form.cariKodu)
      .input('CariAdi', sql.NVarChar, form.cariAdi)
      .input('Tarih', sql.Date, form.faturaTarihi)
      .input('Tip', sql.NVarChar, hareketTipi)
      .input('Tutar', sql.Decimal(18, 2), genelToplam)
      .input('Aciklama', sql.NVarChar, `${form.faturaKodu} nolu ${form.yon} faturası`)
      .input('KaynakId', sql.Int, faturaId)
      .query(`
        INSERT INTO CariHareket (CariKodu, CariAdi, Tarih, Tip, Tutar, Aciklama, Kaynak, KaynakId)
        VALUES (@CariKodu, @CariAdi, @Tarih, @Tip, @Tutar, @Aciklama, 'Fatura', @KaynakId)
      `);

    await transaction.commit();
    res.json({ success: true, message: 'Fatura kaydedildi, cari hareket otomatik oluşturuldu', faturaId });
  } catch (err) {
    console.error('Hata:', err);
    try { await transaction.rollback(); } catch (e) {}
    res.status(500).json({ error: 'Fatura kaydedilirken hata oluştu', detail: err.message });
  }
});

/* =========================================================
   CARİ HAREKET / EKSTRE
   ========================================================= */
app.get('/api/cari-ekstre/:cariKodu', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { cariKodu } = req.params;
    const result = await pool.request().input('CariKodu', sql.NVarChar, cariKodu)
      .query('SELECT * FROM CariHareket WHERE CariKodu = @CariKodu ORDER BY Tarih DESC, HareketId DESC');

    const rows = result.recordset;
    const toplamBorc = rows.filter(r => r.Tip === 'Borç').reduce((a, r) => a + Number(r.Tutar), 0);
    const toplamAlacak = rows.filter(r => r.Tip === 'Alacak').reduce((a, r) => a + Number(r.Tutar), 0);
    const bakiye = toplamBorc - toplamAlacak; // pozitif: cari bize borçlu, negatif: biz cariye borçluyuz

    res.json({ hareketler: rows, toplamBorc, toplamAlacak, bakiye });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Cari ekstre alınamadı', detail: err.message });
  }
});

// Manuel tahsilat / ödeme kaydı (cari hareket olarak)
app.post('/api/cari-hareket', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { CariKodu, CariAdi, Tarih, Tip, Tutar, Aciklama, Kaynak } = req.body;
    await pool.request()
      .input('CariKodu', sql.NVarChar, CariKodu)
      .input('CariAdi', sql.NVarChar, CariAdi)
      .input('Tarih', sql.Date, Tarih)
      .input('Tip', sql.NVarChar, Tip)
      .input('Tutar', sql.Decimal(18, 2), Tutar)
      .input('Aciklama', sql.NVarChar, Aciklama || null)
      .input('Kaynak', sql.NVarChar, Kaynak || 'Manuel')
      .query(`
        INSERT INTO CariHareket (CariKodu, CariAdi, Tarih, Tip, Tutar, Aciklama, Kaynak)
        VALUES (@CariKodu, @CariAdi, @Tarih, @Tip, @Tutar, @Aciklama, @Kaynak)
      `);
    res.json({ success: true, message: 'Cari hareket kaydedildi' });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Cari hareket kaydedilirken hata oluştu', detail: err.message });
  }
});

app.put('/api/faturalar/:id/durum', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    const { Durum } = req.body;
    await pool.request().input('FaturaId', sql.Int, id).input('Durum', sql.NVarChar, Durum)
      .query('UPDATE Faturalar SET Durum = @Durum WHERE FaturaId = @FaturaId');
    res.json({ success: true, message: 'Fatura durumu güncellendi' });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Fatura güncellenirken hata oluştu', detail: err.message });
  }
});

app.delete('/api/faturalar/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    await pool.request().input('FaturaId', sql.Int, id)
      .query('UPDATE Faturalar SET IsActive = 0 WHERE FaturaId = @FaturaId');
    res.json({ success: true, message: 'Fatura silindi' });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Fatura silinirken hata oluştu' });
  }
});

/* =========================================================
   PERSONEL MODÜLÜ (özlük + izin + puantaj + maaş/prim)
   ========================================================= */

app.get('/api/personel', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query('SELECT * FROM Personeller WHERE IsActive = 1 ORDER BY PersonelId DESC');
    res.json(result.recordset);
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Personel listesi alınamadı', detail: err.message });
  }
});

app.post('/api/personel', async (req, res) => {
  try {
    const pool = await poolPromise;
    const b = req.body;
    const result = await pool.request()
      .input('PersonelKodu', sql.NVarChar, b.PersonelKodu)
      .input('AdSoyad', sql.NVarChar, b.AdSoyad)
      .input('TCNo', sql.NVarChar, b.TCNo || null)
      .input('DogumTarihi', sql.Date, b.DogumTarihi || null)
      .input('Cinsiyet', sql.NVarChar, b.Cinsiyet || null)
      .input('MedeniHal', sql.NVarChar, b.MedeniHal || null)
      .input('IseGirisTarihi', sql.Date, b.IseGirisTarihi || null)
      .input('IstenCikisTarihi', sql.Date, b.IstenCikisTarihi || null)
      .input('Departman', sql.NVarChar, b.Departman || null)
      .input('Pozisyon', sql.NVarChar, b.Pozisyon || null)
      .input('Telefon', sql.NVarChar, b.Telefon || null)
      .input('Email', sql.NVarChar, b.Email || null)
      .input('Adres', sql.NVarChar, b.Adres || null)
      .input('IBAN', sql.NVarChar, b.IBAN || null)
      .input('AcilDurumKisi', sql.NVarChar, b.AcilDurumKisi || null)
      .input('AcilDurumTel', sql.NVarChar, b.AcilDurumTel || null)
      .input('SabitBrutMaas', sql.Decimal(18, 2), b.SabitBrutMaas || null)
      .query(`
        INSERT INTO Personeller (
          PersonelKodu, AdSoyad, TCNo, DogumTarihi, Cinsiyet, MedeniHal,
          IseGirisTarihi, IstenCikisTarihi, Departman, Pozisyon, Telefon, Email, Adres, IBAN,
          AcilDurumKisi, AcilDurumTel, SabitBrutMaas
        )
        OUTPUT INSERTED.*
        VALUES (
          @PersonelKodu, @AdSoyad, @TCNo, @DogumTarihi, @Cinsiyet, @MedeniHal,
          @IseGirisTarihi, @IstenCikisTarihi, @Departman, @Pozisyon, @Telefon, @Email, @Adres, @IBAN,
          @AcilDurumKisi, @AcilDurumTel, @SabitBrutMaas
        )
      `);
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Personel eklenirken hata oluştu', detail: err.message });
  }
});

app.put('/api/personel/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    const b = req.body;
    await pool.request()
      .input('PersonelId', sql.Int, id)
      .input('AdSoyad', sql.NVarChar, b.AdSoyad)
      .input('TCNo', sql.NVarChar, b.TCNo || null)
      .input('DogumTarihi', sql.Date, b.DogumTarihi || null)
      .input('Cinsiyet', sql.NVarChar, b.Cinsiyet || null)
      .input('MedeniHal', sql.NVarChar, b.MedeniHal || null)
      .input('IseGirisTarihi', sql.Date, b.IseGirisTarihi || null)
      .input('IstenCikisTarihi', sql.Date, b.IstenCikisTarihi || null)
      .input('Departman', sql.NVarChar, b.Departman || null)
      .input('Pozisyon', sql.NVarChar, b.Pozisyon || null)
      .input('Telefon', sql.NVarChar, b.Telefon || null)
      .input('Email', sql.NVarChar, b.Email || null)
      .input('Adres', sql.NVarChar, b.Adres || null)
      .input('IBAN', sql.NVarChar, b.IBAN || null)
      .input('AcilDurumKisi', sql.NVarChar, b.AcilDurumKisi || null)
      .input('AcilDurumTel', sql.NVarChar, b.AcilDurumTel || null)
      .input('SabitBrutMaas', sql.Decimal(18, 2), b.SabitBrutMaas || null)
      .query(`
        UPDATE Personeller SET
          AdSoyad=@AdSoyad, TCNo=@TCNo, DogumTarihi=@DogumTarihi, Cinsiyet=@Cinsiyet, MedeniHal=@MedeniHal,
          IseGirisTarihi=@IseGirisTarihi, IstenCikisTarihi=@IstenCikisTarihi, Departman=@Departman, Pozisyon=@Pozisyon,
          Telefon=@Telefon, Email=@Email, Adres=@Adres, IBAN=@IBAN,
          AcilDurumKisi=@AcilDurumKisi, AcilDurumTel=@AcilDurumTel, SabitBrutMaas=@SabitBrutMaas
        WHERE PersonelId=@PersonelId
      `);
    res.json({ success: true, message: 'Personel güncellendi' });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Personel güncellenirken hata oluştu', detail: err.message });
  }
});

app.delete('/api/personel/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    await pool.request().input('PersonelId', sql.Int, id)
      .query('UPDATE Personeller SET IsActive = 0 WHERE PersonelId = @PersonelId');
    res.json({ success: true, message: 'Personel pasifleştirildi' });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Personel silinirken hata oluştu' });
  }
});

// --- İzinler ---
app.get('/api/personel/:id/izinler', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().input('PersonelId', sql.Int, req.params.id)
      .query('SELECT * FROM PersonelIzin WHERE PersonelId = @PersonelId ORDER BY BaslangicTarihi DESC');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'İzinler alınamadı', detail: err.message });
  }
});

app.post('/api/personel/:id/izinler', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { IzinTipi, BaslangicTarihi, BitisTarihi, GunSayisi, Aciklama, Durum } = req.body;
    await pool.request()
      .input('PersonelId', sql.Int, req.params.id)
      .input('IzinTipi', sql.NVarChar, IzinTipi)
      .input('BaslangicTarihi', sql.Date, BaslangicTarihi)
      .input('BitisTarihi', sql.Date, BitisTarihi)
      .input('GunSayisi', sql.Int, GunSayisi || 0)
      .input('Aciklama', sql.NVarChar, Aciklama || null)
      .input('Durum', sql.NVarChar, Durum || 'Onaylandı')
      .query(`
        INSERT INTO PersonelIzin (PersonelId, IzinTipi, BaslangicTarihi, BitisTarihi, GunSayisi, Aciklama, Durum)
        VALUES (@PersonelId, @IzinTipi, @BaslangicTarihi, @BitisTarihi, @GunSayisi, @Aciklama, @Durum)
      `);
    res.json({ success: true, message: 'İzin kaydedildi' });
  } catch (err) {
    res.status(500).json({ error: 'İzin kaydedilirken hata oluştu', detail: err.message });
  }
});

app.delete('/api/personel/izinler/:izinId', async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().input('IzinId', sql.Int, req.params.izinId)
      .query('DELETE FROM PersonelIzin WHERE IzinId = @IzinId');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'İzin silinirken hata oluştu' });
  }
});

// --- Puantaj ---
app.get('/api/personel/:id/puantaj', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().input('PersonelId', sql.Int, req.params.id)
      .query('SELECT * FROM PersonelPuantaj WHERE PersonelId = @PersonelId ORDER BY Tarih DESC');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Puantaj alınamadı', detail: err.message });
  }
});

app.post('/api/personel/:id/puantaj', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { Tarih, GirisSaati, CikisSaati, CalismaSuresiSaat, Durum, Aciklama } = req.body;
    await pool.request()
      .input('PersonelId', sql.Int, req.params.id)
      .input('Tarih', sql.Date, Tarih)
      .input('GirisSaati', sql.NVarChar, GirisSaati || null)
      .input('CikisSaati', sql.NVarChar, CikisSaati || null)
      .input('CalismaSuresiSaat', sql.Decimal(5, 2), CalismaSuresiSaat || 0)
      .input('Durum', sql.NVarChar, Durum || 'Tam Gün')
      .input('Aciklama', sql.NVarChar, Aciklama || null)
      .query(`
        INSERT INTO PersonelPuantaj (PersonelId, Tarih, GirisSaati, CikisSaati, CalismaSuresiSaat, Durum, Aciklama)
        VALUES (@PersonelId, @Tarih, @GirisSaati, @CikisSaati, @CalismaSuresiSaat, @Durum, @Aciklama)
      `);
    res.json({ success: true, message: 'Puantaj kaydedildi' });
  } catch (err) {
    res.status(500).json({ error: 'Puantaj kaydedilirken hata oluştu', detail: err.message });
  }
});

app.delete('/api/personel/puantaj/:puantajId', async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().input('PuantajId', sql.Int, req.params.puantajId)
      .query('DELETE FROM PersonelPuantaj WHERE PuantajId = @PuantajId');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Puantaj silinirken hata oluştu' });
  }
});

// --- Maaş & Prim ---
app.get('/api/personel/:id/maas', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().input('PersonelId', sql.Int, req.params.id)
      .query('SELECT * FROM PersonelMaas WHERE PersonelId = @PersonelId ORDER BY DonemYil DESC, DonemAy DESC');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Maaş kayıtları alınamadı', detail: err.message });
  }
});

// Bordro parametrelerini getir (frontend'de hesaplama önizlemesi / ayarlar ekranı için)
app.get('/api/bordro-parametreleri/:yil', async (req, res) => {
  try {
    const pool = await poolPromise;
    const p = await bordro.getBordroParametreleri(pool, sql, parseInt(req.params.yil));
    res.json(p);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Bordro parametrelerini güncelle (mali müşavir/yönetici mevzuat değişince burayı günceller)
app.put('/api/bordro-parametreleri/:yil', async (req, res) => {
  try {
    const pool = await poolPromise;
    const b = req.body;
    await pool.request()
      .input('Yil', sql.Int, req.params.yil)
      .input('AsgariUcretBrutAylik', sql.Decimal(18, 2), b.AsgariUcretBrutAylik)
      .input('AsgariUcretNetAylik', sql.Decimal(18, 2), b.AsgariUcretNetAylik)
      .input('SgkIsciOrani', sql.Decimal(6, 4), b.SgkIsciOrani)
      .input('IssizlikIsciOrani', sql.Decimal(6, 4), b.IssizlikIsciOrani)
      .input('SgkIsverenOrani', sql.Decimal(6, 4), b.SgkIsverenOrani)
      .input('IssizlikIsverenOrani', sql.Decimal(6, 4), b.IssizlikIsverenOrani)
      .input('SgkTabanAylik', sql.Decimal(18, 2), b.SgkTabanAylik)
      .input('SgkTavanAylik', sql.Decimal(18, 2), b.SgkTavanAylik)
      .input('DamgaVergisiBinde', sql.Decimal(8, 4), b.DamgaVergisiBinde)
      .input('GV_Dilim1_Ust', sql.Decimal(18, 2), b.GV_Dilim1_Ust)
      .input('GV_Dilim2_Ust', sql.Decimal(18, 2), b.GV_Dilim2_Ust)
      .input('GV_Dilim3_Ust', sql.Decimal(18, 2), b.GV_Dilim3_Ust)
      .input('GV_Dilim4_Ust', sql.Decimal(18, 2), b.GV_Dilim4_Ust)
      .input('GV_Oran1', sql.Decimal(6, 4), b.GV_Oran1)
      .input('GV_Oran2', sql.Decimal(6, 4), b.GV_Oran2)
      .input('GV_Oran3', sql.Decimal(6, 4), b.GV_Oran3)
      .input('GV_Oran4', sql.Decimal(6, 4), b.GV_Oran4)
      .input('GV_Oran5', sql.Decimal(6, 4), b.GV_Oran5)
      .query(`
        UPDATE BordroParametreleri SET
          AsgariUcretBrutAylik=@AsgariUcretBrutAylik, AsgariUcretNetAylik=@AsgariUcretNetAylik,
          SgkIsciOrani=@SgkIsciOrani, IssizlikIsciOrani=@IssizlikIsciOrani,
          SgkIsverenOrani=@SgkIsverenOrani, IssizlikIsverenOrani=@IssizlikIsverenOrani,
          SgkTabanAylik=@SgkTabanAylik, SgkTavanAylik=@SgkTavanAylik, DamgaVergisiBinde=@DamgaVergisiBinde,
          GV_Dilim1_Ust=@GV_Dilim1_Ust, GV_Dilim2_Ust=@GV_Dilim2_Ust, GV_Dilim3_Ust=@GV_Dilim3_Ust, GV_Dilim4_Ust=@GV_Dilim4_Ust,
          GV_Oran1=@GV_Oran1, GV_Oran2=@GV_Oran2, GV_Oran3=@GV_Oran3, GV_Oran4=@GV_Oran4, GV_Oran5=@GV_Oran5,
          GuncellemeTarihi=GETDATE()
        WHERE Yil=@Yil
      `);
    res.json({ success: true, message: 'Bordro parametreleri güncellendi' });
  } catch (err) {
    res.status(500).json({ error: 'Parametreler güncellenirken hata oluştu', detail: err.message });
  }
});

// Bordro ÖNİZLEME: kaydetmeden brütten nete hesapla (form üzerinde canlı gösterim için)
app.post('/api/personel/:id/bordro-hesapla', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { DonemYil, DonemAy, BrutMaas, GunSayisi, Prim } = req.body;
    const parametreler = await bordro.getBordroParametreleri(pool, sql, parseInt(DonemYil));
    const kumulatifMatrahOncesi = await bordro.kumulatifMatrahGetir(pool, sql, req.params.id, parseInt(DonemYil), parseInt(DonemAy));

    const sonuc = bordro.bordroHesapla({
      brutMaas: Number(BrutMaas || 0),
      gunSayisi: Number(GunSayisi || 30),
      prim: Number(Prim || 0),
      kumulatifMatrahOncesi,
      parametreler,
    });

    res.json({ success: true, hesap: sonuc, kumulatifMatrahOncesi });
  } catch (err) {
    res.status(500).json({ error: 'Bordro hesaplanırken hata oluştu', detail: err.message });
  }
});

app.post('/api/personel/:id/maas', async (req, res) => {
  try {
    const pool = await poolPromise;
    const b = req.body;
    const personelId = req.params.id;

    let kayit;

    if (b.HesaplamaTipi === 'Manuel') {
      // Eski davranış: kullanıcı brüt/net/kesinti değerlerini elle giriyor
      kayit = {
        DonemYil: b.DonemYil, DonemAy: b.DonemAy,
        BrutMaas: Number(b.BrutMaas || 0), NetMaas: Number(b.NetMaas || 0),
        Prim: Number(b.Prim || 0), Kesinti: Number(b.Kesinti || 0),
        GunSayisi: Number(b.GunSayisi || 30),
        SgkMatrahi: null, SgkIsciPrimi: null, IssizlikIsciPrimi: null,
        GelirVergisiMatrahi: null, KumulatifMatrahOncesi: null, GelirVergisiIstisnasi: null,
        GelirVergisi: null, DamgaVergisiIstisnasi: null, DamgaVergisi: null,
        IsverenSgkPrimi: null, IsverenIssizlikPrimi: null, IsverenMaliyeti: null,
        HesaplamaTipi: 'Manuel',
      };
    } else {
      // Otomatik: brüt maaş + gün sayısı + prim üzerinden SGK/vergi motoruyla hesapla
      const parametreler = await bordro.getBordroParametreleri(pool, sql, parseInt(b.DonemYil));
      const kumulatifMatrahOncesi = await bordro.kumulatifMatrahGetir(pool, sql, personelId, parseInt(b.DonemYil), parseInt(b.DonemAy));
      const sonuc = bordro.bordroHesapla({
        brutMaas: Number(b.BrutMaas || 0),
        gunSayisi: Number(b.GunSayisi || 30),
        prim: Number(b.Prim || 0),
        kumulatifMatrahOncesi,
        parametreler,
      });
      kayit = {
        DonemYil: b.DonemYil, DonemAy: b.DonemAy,
        BrutMaas: sonuc.brutMaas, NetMaas: sonuc.netMaas,
        Prim: Number(b.Prim || 0), Kesinti: sonuc.toplamKesinti,
        GunSayisi: sonuc.gunSayisi,
        SgkMatrahi: sonuc.sgkMatrahi, SgkIsciPrimi: sonuc.sgkIsciPrimi, IssizlikIsciPrimi: sonuc.issizlikIsciPrimi,
        GelirVergisiMatrahi: sonuc.gelirVergisiMatrahi, KumulatifMatrahOncesi: kumulatifMatrahOncesi,
        GelirVergisiIstisnasi: sonuc.gelirVergisiIstisnasi,
        GelirVergisi: sonuc.gelirVergisi, DamgaVergisiIstisnasi: sonuc.damgaVergisiIstisnasi, DamgaVergisi: sonuc.damgaVergisi,
        IsverenSgkPrimi: sonuc.isverenSgkPrimi, IsverenIssizlikPrimi: sonuc.isverenIssizlikPrimi, IsverenMaliyeti: sonuc.isverenMaliyeti,
        HesaplamaTipi: 'Otomatik',
      };
    }

    await pool.request()
      .input('PersonelId', sql.Int, personelId)
      .input('DonemYil', sql.Int, kayit.DonemYil)
      .input('DonemAy', sql.Int, kayit.DonemAy)
      .input('BrutMaas', sql.Decimal(18, 2), kayit.BrutMaas)
      .input('NetMaas', sql.Decimal(18, 2), kayit.NetMaas)
      .input('Prim', sql.Decimal(18, 2), kayit.Prim)
      .input('Kesinti', sql.Decimal(18, 2), kayit.Kesinti)
      .input('OdemeTarihi', sql.Date, b.OdemeTarihi || null)
      .input('Aciklama', sql.NVarChar, b.Aciklama || null)
      .input('GunSayisi', sql.Int, kayit.GunSayisi)
      .input('SgkMatrahi', sql.Decimal(18, 2), kayit.SgkMatrahi)
      .input('SgkIsciPrimi', sql.Decimal(18, 2), kayit.SgkIsciPrimi)
      .input('IssizlikIsciPrimi', sql.Decimal(18, 2), kayit.IssizlikIsciPrimi)
      .input('GelirVergisiMatrahi', sql.Decimal(18, 2), kayit.GelirVergisiMatrahi)
      .input('KumulatifMatrahOncesi', sql.Decimal(18, 2), kayit.KumulatifMatrahOncesi)
      .input('GelirVergisiIstisnasi', sql.Decimal(18, 2), kayit.GelirVergisiIstisnasi)
      .input('GelirVergisi', sql.Decimal(18, 2), kayit.GelirVergisi)
      .input('DamgaVergisiIstisnasi', sql.Decimal(18, 2), kayit.DamgaVergisiIstisnasi)
      .input('DamgaVergisi', sql.Decimal(18, 2), kayit.DamgaVergisi)
      .input('IsverenSgkPrimi', sql.Decimal(18, 2), kayit.IsverenSgkPrimi)
      .input('IsverenIssizlikPrimi', sql.Decimal(18, 2), kayit.IsverenIssizlikPrimi)
      .input('IsverenMaliyeti', sql.Decimal(18, 2), kayit.IsverenMaliyeti)
      .input('HesaplamaTipi', sql.NVarChar, kayit.HesaplamaTipi)
      .query(`
        INSERT INTO PersonelMaas (
          PersonelId, DonemYil, DonemAy, BrutMaas, NetMaas, Prim, Kesinti, OdemeTarihi, Aciklama,
          GunSayisi, SgkMatrahi, SgkIsciPrimi, IssizlikIsciPrimi, GelirVergisiMatrahi, KumulatifMatrahOncesi,
          GelirVergisiIstisnasi, GelirVergisi, DamgaVergisiIstisnasi, DamgaVergisi,
          IsverenSgkPrimi, IsverenIssizlikPrimi, IsverenMaliyeti, HesaplamaTipi
        )
        VALUES (
          @PersonelId, @DonemYil, @DonemAy, @BrutMaas, @NetMaas, @Prim, @Kesinti, @OdemeTarihi, @Aciklama,
          @GunSayisi, @SgkMatrahi, @SgkIsciPrimi, @IssizlikIsciPrimi, @GelirVergisiMatrahi, @KumulatifMatrahOncesi,
          @GelirVergisiIstisnasi, @GelirVergisi, @DamgaVergisiIstisnasi, @DamgaVergisi,
          @IsverenSgkPrimi, @IsverenIssizlikPrimi, @IsverenMaliyeti, @HesaplamaTipi
        )
      `);
    res.json({ success: true, message: 'Maaş kaydı eklendi', hesap: kayit });
  } catch (err) {
    res.status(500).json({ error: 'Maaş kaydedilirken hata oluştu', detail: err.message });
  }
});

// Personelin kıdem yılına göre yıllık izin bakiyesi (hak edilen - kullanılan)
app.get('/api/personel/:id/izin-bakiye', async (req, res) => {
  try {
    const pool = await poolPromise;
    const personelResult = await pool.request().input('PersonelId', sql.Int, req.params.id)
      .query('SELECT IseGirisTarihi FROM Personeller WHERE PersonelId = @PersonelId');
    if (personelResult.recordset.length === 0) return res.status(404).json({ error: 'Personel bulunamadı' });

    const iseGiris = personelResult.recordset[0].IseGirisTarihi;
    if (!iseGiris) return res.json({ kidemYili: 0, hakEdilenGun: 0, kullanilanGun: 0, kalanGun: 0 });

    const bugun = new Date();
    const girisT = new Date(iseGiris);
    let kidemYili = bugun.getFullYear() - girisT.getFullYear();
    const ayFarki = bugun.getMonth() - girisT.getMonth();
    if (ayFarki < 0 || (ayFarki === 0 && bugun.getDate() < girisT.getDate())) kidemYili--;
    kidemYili = Math.max(0, kidemYili);

    const hakEdilenGun = bordro.yillikIzinHakki(kidemYili);

    const kullanilanResult = await pool.request().input('PersonelId', sql.Int, req.params.id)
      .query(`
        SELECT ISNULL(SUM(GunSayisi), 0) AS Toplam FROM PersonelIzin
        WHERE PersonelId = @PersonelId AND IzinTipi = N'Yıllık'
          AND YEAR(BaslangicTarihi) = YEAR(GETDATE()) AND Durum != N'Reddedildi'
      `);
    const kullanilanGun = Number(kullanilanResult.recordset[0].Toplam || 0);

    res.json({
      kidemYili, hakEdilenGun, kullanilanGun,
      kalanGun: Math.max(0, hakEdilenGun - kullanilanGun),
    });
  } catch (err) {
    res.status(500).json({ error: 'İzin bakiyesi hesaplanırken hata oluştu', detail: err.message });
  }
});

app.delete('/api/personel/maas/:maasId', async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().input('MaasId', sql.Int, req.params.maasId)
      .query('DELETE FROM PersonelMaas WHERE MaasId = @MaasId');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Maaş kaydı silinirken hata oluştu' });
  }
});

/* =========================================================
   FİNANS MODÜLÜ (Kasa / Banka + Tahsilat / Ödeme)
   ========================================================= */

// Kasa/Banka hesapları (bakiye hesaplı)
app.get('/api/kasa-banka', async (req, res) => {
  try {
    const pool = await poolPromise;
    const hesaplar = await pool.request()
      .query('SELECT * FROM KasaBanka WHERE IsActive = 1 ORDER BY KasaBankaId');

    const sonuc = [];
    for (const h of hesaplar.recordset) {
      const hareket = await pool.request().input('KasaBankaId', sql.Int, h.KasaBankaId)
        .query(`
          SELECT
            ISNULL(SUM(CASE WHEN Tip = 'Giriş' THEN Tutar ELSE 0 END), 0) AS ToplamGiris,
            ISNULL(SUM(CASE WHEN Tip = 'Çıkış' THEN Tutar ELSE 0 END), 0) AS ToplamCikis
          FROM FinansHareket WHERE KasaBankaId = @KasaBankaId
        `);
      const { ToplamGiris, ToplamCikis } = hareket.recordset[0];
      sonuc.push({ ...h, Bakiye: Number(h.AcilisBakiyesi) + Number(ToplamGiris) - Number(ToplamCikis) });
    }
    res.json(sonuc);
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Kasa/Banka listesi alınamadı', detail: err.message });
  }
});

app.post('/api/kasa-banka', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { Ad, Tip, BankaAdi, SubeAdi, HesapNoIBAN, ParaBirimi, AcilisBakiyesi } = req.body;
    const result = await pool.request()
      .input('Ad', sql.NVarChar, Ad)
      .input('Tip', sql.NVarChar, Tip || 'Kasa')
      .input('BankaAdi', sql.NVarChar, BankaAdi || null)
      .input('SubeAdi', sql.NVarChar, SubeAdi || null)
      .input('HesapNoIBAN', sql.NVarChar, HesapNoIBAN || null)
      .input('ParaBirimi', sql.NVarChar, ParaBirimi || 'TL')
      .input('AcilisBakiyesi', sql.Decimal(18, 2), AcilisBakiyesi || 0)
      .query(`
        INSERT INTO KasaBanka (Ad, Tip, BankaAdi, SubeAdi, HesapNoIBAN, ParaBirimi, AcilisBakiyesi)
        OUTPUT INSERTED.*
        VALUES (@Ad, @Tip, @BankaAdi, @SubeAdi, @HesapNoIBAN, @ParaBirimi, @AcilisBakiyesi)
      `);
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Hesap eklenirken hata oluştu', detail: err.message });
  }
});

app.delete('/api/kasa-banka/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().input('KasaBankaId', sql.Int, req.params.id)
      .query('UPDATE KasaBanka SET IsActive = 0 WHERE KasaBankaId = @KasaBankaId');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Hesap pasifleştirilirken hata oluştu' });
  }
});

// Finans hareket listesi (tüm hesaplar veya tek hesap)
app.get('/api/finans-hareket', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { kasaBankaId } = req.query;
    let query = `
      SELECT fh.*, kb.Ad AS KasaBankaAdi FROM FinansHareket fh
      JOIN KasaBanka kb ON kb.KasaBankaId = fh.KasaBankaId
    `;
    const request = pool.request();
    if (kasaBankaId) {
      query += ' WHERE fh.KasaBankaId = @KasaBankaId';
      request.input('KasaBankaId', sql.Int, kasaBankaId);
    }
    query += ' ORDER BY fh.Tarih DESC, fh.HareketId DESC';
    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Finans hareketleri alınamadı', detail: err.message });
  }
});

// TAHSİLAT: müşteriden para al -> kasa/banka Giriş + cari borcu azalır (Alacak kaydı)
app.post('/api/tahsilat', async (req, res) => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);
  try {
    const { KasaBankaId, CariKodu, CariAdi, Tarih, Tutar, Aciklama } = req.body;
    if (!KasaBankaId || !Tutar || Tutar <= 0) {
      return res.status(400).json({ error: 'Kasa/Banka hesabı ve geçerli bir tutar gereklidir.' });
    }

    await transaction.begin();

    const finansReq = new sql.Request(transaction);
    await finansReq
      .input('KasaBankaId', sql.Int, KasaBankaId)
      .input('Tarih', sql.Date, Tarih)
      .input('Tutar', sql.Decimal(18, 2), Tutar)
      .input('Aciklama', sql.NVarChar, Aciklama || `${CariAdi || ''} tahsilat`.trim())
      .input('CariKodu', sql.NVarChar, CariKodu || null)
      .input('CariAdi', sql.NVarChar, CariAdi || null)
      .query(`
        INSERT INTO FinansHareket (KasaBankaId, Tarih, Tip, Tutar, Aciklama, Kaynak, CariKodu, CariAdi)
        VALUES (@KasaBankaId, @Tarih, 'Giriş', @Tutar, @Aciklama, 'Tahsilat', @CariKodu, @CariAdi)
      `);

    if (CariKodu) {
      const cariReq = new sql.Request(transaction);
      await cariReq
        .input('CariKodu', sql.NVarChar, CariKodu)
        .input('CariAdi', sql.NVarChar, CariAdi || null)
        .input('Tarih', sql.Date, Tarih)
        .input('Tutar', sql.Decimal(18, 2), Tutar)
        .input('Aciklama', sql.NVarChar, Aciklama || 'Tahsilat')
        .query(`
          INSERT INTO CariHareket (CariKodu, CariAdi, Tarih, Tip, Tutar, Aciklama, Kaynak)
          VALUES (@CariKodu, @CariAdi, @Tarih, 'Alacak', @Tutar, @Aciklama, 'Tahsilat')
        `);
    }

    await transaction.commit();
    res.json({ success: true, message: 'Tahsilat kaydedildi' });
  } catch (err) {
    console.error('Hata:', err);
    try { await transaction.rollback(); } catch (e) {}
    res.status(500).json({ error: 'Tahsilat kaydedilirken hata oluştu', detail: err.message });
  }
});

// ÖDEME: tedarikçiye/gidere para öde -> kasa/banka Çıkış + cari alacağımız azalır (Borç kaydı)
app.post('/api/odeme', async (req, res) => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);
  try {
    const { KasaBankaId, CariKodu, CariAdi, Tarih, Tutar, Aciklama } = req.body;
    if (!KasaBankaId || !Tutar || Tutar <= 0) {
      return res.status(400).json({ error: 'Kasa/Banka hesabı ve geçerli bir tutar gereklidir.' });
    }

    await transaction.begin();

    const finansReq = new sql.Request(transaction);
    await finansReq
      .input('KasaBankaId', sql.Int, KasaBankaId)
      .input('Tarih', sql.Date, Tarih)
      .input('Tutar', sql.Decimal(18, 2), Tutar)
      .input('Aciklama', sql.NVarChar, Aciklama || `${CariAdi || ''} ödeme`.trim())
      .input('CariKodu', sql.NVarChar, CariKodu || null)
      .input('CariAdi', sql.NVarChar, CariAdi || null)
      .query(`
        INSERT INTO FinansHareket (KasaBankaId, Tarih, Tip, Tutar, Aciklama, Kaynak, CariKodu, CariAdi)
        VALUES (@KasaBankaId, @Tarih, 'Çıkış', @Tutar, @Aciklama, 'Ödeme', @CariKodu, @CariAdi)
      `);

    if (CariKodu) {
      const cariReq = new sql.Request(transaction);
      await cariReq
        .input('CariKodu', sql.NVarChar, CariKodu)
        .input('CariAdi', sql.NVarChar, CariAdi || null)
        .input('Tarih', sql.Date, Tarih)
        .input('Tutar', sql.Decimal(18, 2), Tutar)
        .input('Aciklama', sql.NVarChar, Aciklama || 'Ödeme')
        .query(`
          INSERT INTO CariHareket (CariKodu, CariAdi, Tarih, Tip, Tutar, Aciklama, Kaynak)
          VALUES (@CariKodu, @CariAdi, @Tarih, 'Borç', @Tutar, @Aciklama, 'Ödeme')
        `);
    }

    await transaction.commit();
    res.json({ success: true, message: 'Ödeme kaydedildi' });
  } catch (err) {
    console.error('Hata:', err);
    try { await transaction.rollback(); } catch (e) {}
    res.status(500).json({ error: 'Ödeme kaydedilirken hata oluştu', detail: err.message });
  }
});

/* =========================================================
   DÖVİZ KURLARI
   ========================================================= */
app.get('/api/kurlar', async (req, res) => {
  try {
    const pool = await poolPromise;
    // Her para birimi için en güncel kuru getir
    const result = await pool.request().query(`
      SELECT k.* FROM Kurlar k
      INNER JOIN (
        SELECT ParaBirimi, MAX(KurId) AS SonKurId FROM Kurlar GROUP BY ParaBirimi
      ) son ON son.SonKurId = k.KurId
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Kurlar alınamadı', detail: err.message });
  }
});

app.post('/api/kurlar', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { ParaBirimi, Deger } = req.body;
    if (!ParaBirimi || !Deger) return res.status(400).json({ error: 'Para birimi ve değer gereklidir.' });
    await pool.request()
      .input('ParaBirimi', sql.NVarChar, ParaBirimi)
      .input('Deger', sql.Decimal(18, 4), Deger)
      .query(`INSERT INTO Kurlar (ParaBirimi, Deger) VALUES (@ParaBirimi, @Deger)`);
    res.json({ success: true, message: 'Kur güncellendi' });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Kur kaydedilirken hata oluştu', detail: err.message });
  }
});

/* =========================================================
   TEKLİF TALEPLERİ (eksik malzemeler için tedarikçiden teklif isteme)
   ========================================================= */
app.get('/api/teklif-talepleri', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query('SELECT * FROM TeklifTalepleri WHERE IsActive = 1 ORDER BY TalepId DESC');
    res.json(result.recordset);
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Teklif talepleri alınamadı', detail: err.message });
  }
});

app.post('/api/teklif-talepleri', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { UrunKodu, UrunAdi, CariKodu, CariAdi, Miktar, Birim, TeklifFiyati, ParaBirimi, Notlar } = req.body;
    const result = await pool.request()
      .input('UrunKodu', sql.NVarChar, UrunKodu || null)
      .input('UrunAdi', sql.NVarChar, UrunAdi)
      .input('CariKodu', sql.NVarChar, CariKodu || null)
      .input('CariAdi', sql.NVarChar, CariAdi || null)
      .input('Miktar', sql.Decimal(18, 2), Miktar || 0)
      .input('Birim', sql.NVarChar, Birim || null)
      .input('TeklifFiyati', sql.Decimal(18, 2), TeklifFiyati || null)
      .input('ParaBirimi', sql.NVarChar, ParaBirimi || 'TL')
      .input('Notlar', sql.NVarChar, Notlar || null)
      .query(`
        INSERT INTO TeklifTalepleri (UrunKodu, UrunAdi, CariKodu, CariAdi, Miktar, Birim, TeklifFiyati, ParaBirimi, Notlar)
        OUTPUT INSERTED.*
        VALUES (@UrunKodu, @UrunAdi, @CariKodu, @CariAdi, @Miktar, @Birim, @TeklifFiyati, @ParaBirimi, @Notlar)
      `);
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Teklif talebi kaydedilirken hata oluştu', detail: err.message });
  }
});

app.put('/api/teklif-talepleri/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { TeklifFiyati, ParaBirimi, Durum, Notlar } = req.body;
    await pool.request()
      .input('TalepId', sql.Int, req.params.id)
      .input('TeklifFiyati', sql.Decimal(18, 2), TeklifFiyati || null)
      .input('ParaBirimi', sql.NVarChar, ParaBirimi || 'TL')
      .input('Durum', sql.NVarChar, Durum)
      .input('Notlar', sql.NVarChar, Notlar || null)
      .query(`
        UPDATE TeklifTalepleri SET TeklifFiyati=@TeklifFiyati, ParaBirimi=@ParaBirimi, Durum=@Durum, Notlar=@Notlar
        WHERE TalepId=@TalepId
      `);
    res.json({ success: true, message: 'Teklif talebi güncellendi' });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Teklif talebi güncellenirken hata oluştu', detail: err.message });
  }
});

app.delete('/api/teklif-talepleri/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().input('TalepId', sql.Int, req.params.id)
      .query('UPDATE TeklifTalepleri SET IsActive = 0 WHERE TalepId = @TalepId');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Teklif talebi silinirken hata oluştu' });
  }
});

/* =========================================================
   REÇETE MALİYET HESAPLAMA (çoklu para birimi + eksik malzeme tespiti)
   ========================================================= */
app.get('/api/receteler/:id/maliyet', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    const miktar = Number(req.query.miktar || 1);

    const receteResult = await pool.request().input('ReceteId', sql.Int, id)
      .query('SELECT * FROM Receteler WHERE ReceteId = @ReceteId');
    if (receteResult.recordset.length === 0) return res.status(404).json({ error: 'Reçete bulunamadı' });
    const recete = receteResult.recordset[0];

    const detayResult = await pool.request().input('ReceteId', sql.Int, id)
      .query('SELECT * FROM ReceteDetay WHERE ReceteId = @ReceteId');

    const kurResult = await pool.request().query(`
      SELECT k.* FROM Kurlar k
      INNER JOIN (SELECT ParaBirimi, MAX(KurId) AS SonKurId FROM Kurlar GROUP BY ParaBirimi) son
      ON son.SonKurId = k.KurId
    `);
    const kurlar = { TL: 1 };
    kurResult.recordset.forEach(k => { kurlar[k.ParaBirimi] = Number(k.Deger); });

    let malzemeMaliyetiTL = 0;
    const satirlar = [];

    for (const d of detayResult.recordset) {
      const urunResult = await pool.request().input('UrunId', sql.Int, d.HammaddeUrunId)
        .query('SELECT * FROM Urunler WHERE UrunId = @UrunId');
      const urun = urunResult.recordset[0];

      const gerekliMiktar = Number(d.Miktar) * miktar;
      const mevcutStok = urun ? Number(urun.StokMiktari) : 0;
      const eksikMi = mevcutStok < gerekliMiktar;
      const eksikMiktar = eksikMi ? (gerekliMiktar - mevcutStok) : 0;

      const paraBirimi = urun?.ParaBirimi || 'TL';
      const birimFiyat = urun ? Number(urun.AlisFiyati) : 0;
      const kurDegeri = kurlar[paraBirimi] || 1;
      const satirMaliyetTL = gerekliMiktar * birimFiyat * kurDegeri;
      malzemeMaliyetiTL += satirMaliyetTL;

      satirlar.push({
        hammaddeAdi: d.HammaddeAdi,
        hammaddeUrunId: d.HammaddeUrunId,
        istasyon: d.Istasyon,
        gerekliMiktar, birim: d.Birim,
        mevcutStok, eksikMi, eksikMiktar,
        birimFiyat, paraBirimi,
        alisBirimi: urun?.AlisBirimi || null,
        cevrimOrani: urun ? Number(urun.CevrimOrani) : 1,
        satirMaliyetTL
      });
    }

    // --- Adam-saat işçilik + genel gider dağıtımı ---
    const istasyonResult = await pool.request().input('ReceteId', sql.Int, id)
      .query('SELECT ISNULL(SUM(TahminiSureDk), 0) AS ToplamDk FROM ReceteIstasyon WHERE ReceteId = @ReceteId');
    const birimSureDk = Number(istasyonResult.recordset[0].ToplamDk || 0);
    const toplamSureDk = birimSureDk * miktar;
    const toplamSureSaat = toplamSureDk / 60;

    const paramResult = await pool.request().query('SELECT * FROM MaliyetParametreleri WHERE Id = 1');
    const param = paramResult.recordset[0] || { SaatlikIscilikMaliyeti: 0, AylikUretimKapasitesiSaat: 176 };

    const giderResult = await pool.request().query('SELECT ISNULL(SUM(AylikTutar), 0) AS Toplam FROM SabitGiderler WHERE Aktif = 1');
    const toplamAylikSabitGider = Number(giderResult.recordset[0].Toplam || 0);
    const saatlikGenelGiderPayi = Number(param.AylikUretimKapasitesiSaat) > 0
      ? toplamAylikSabitGider / Number(param.AylikUretimKapasitesiSaat) : 0;

    const iscilikMaliyetiTL = toplamSureSaat * Number(param.SaatlikIscilikMaliyeti);
    const genelGiderMaliyetiTL = toplamSureSaat * saatlikGenelGiderPayi;

    const toplamTL = malzemeMaliyetiTL + iscilikMaliyetiTL + genelGiderMaliyetiTL;
    const birimMaliyetTL = toplamTL / miktar;

    // --- Satış fiyatıyla karşılaştırma (varsa) ---
    let satisKarsilastirma = null;
    if (recete.MamulUrunId) {
      const mamulResult = await pool.request().input('UrunId', sql.Int, recete.MamulUrunId)
        .query('SELECT ListeFiyati, ParaBirimi FROM Urunler WHERE UrunId = @UrunId');
      if (mamulResult.recordset[0] && Number(mamulResult.recordset[0].ListeFiyati) > 0) {
        const satisFiyati = Number(mamulResult.recordset[0].ListeFiyati);
        const birimKar = satisFiyati - birimMaliyetTL;
        satisKarsilastirma = {
          satisFiyati,
          birimKar,
          karOrani: satisFiyati > 0 ? Math.round((birimKar / satisFiyati) * 10000) / 100 : 0,
          kazandiriyorMu: birimKar >= 0,
        };
      }
    }

    res.json({
      receteKodu: recete.ReceteKodu,
      mamulAdi: recete.MamulAdi,
      uretilecekMiktar: miktar,
      malzemeMaliyetiTL,
      iscilikMaliyetiTL,
      genelGiderMaliyetiTL,
      birimSureDk, toplamSureDk,
      saatlikIscilikMaliyeti: Number(param.SaatlikIscilikMaliyeti),
      saatlikGenelGiderPayi,
      toplamMaliyetTL: toplamTL,
      toplamMaliyetUSD: kurlar.USD ? toplamTL / kurlar.USD : null,
      toplamMaliyetEUR: kurlar.EUR ? toplamTL / kurlar.EUR : null,
      birimMaliyetTL,
      satisKarsilastirma,
      kurlar,
      satirlar
    });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Maliyet hesaplanırken hata oluştu', detail: err.message });
  }
});

/* =========================================================
   MALİYET PARAMETRELERİ / SABİT GİDERLER / BAŞABAŞ NOKTASI
   ========================================================= */

app.get('/api/maliyet-parametreleri', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM MaliyetParametreleri WHERE Id = 1');
    res.json(result.recordset[0] || { SaatlikIscilikMaliyeti: 0, AylikUretimKapasitesiSaat: 176 });
  } catch (err) {
    res.status(500).json({ error: 'Parametreler alınamadı', detail: err.message });
  }
});

app.put('/api/maliyet-parametreleri', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { SaatlikIscilikMaliyeti, AylikUretimKapasitesiSaat } = req.body;
    await pool.request()
      .input('SaatlikIscilikMaliyeti', sql.Decimal(18, 2), SaatlikIscilikMaliyeti || 0)
      .input('AylikUretimKapasitesiSaat', sql.Decimal(18, 2), AylikUretimKapasitesiSaat || 176)
      .query(`
        UPDATE MaliyetParametreleri SET
          SaatlikIscilikMaliyeti = @SaatlikIscilikMaliyeti,
          AylikUretimKapasitesiSaat = @AylikUretimKapasitesiSaat,
          GuncellemeTarihi = GETDATE()
        WHERE Id = 1
      `);
    res.json({ success: true, message: 'Parametreler güncellendi' });
  } catch (err) {
    res.status(500).json({ error: 'Parametreler güncellenirken hata oluştu', detail: err.message });
  }
});

app.get('/api/sabit-giderler', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM SabitGiderler ORDER BY Kategori, GiderAdi');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Gider listesi alınamadı', detail: err.message });
  }
});

// Mevcut personel giderlerini (SabitBrutMaas x işveren SGK/işsizlik primi) otomatik toplar
app.get('/api/sabit-giderler/personel-toplam', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT ISNULL(SUM(SabitBrutMaas), 0) AS ToplamBrut, COUNT(*) AS PersonelSayisi
      FROM Personeller WHERE IsActive = 1 AND SabitBrutMaas IS NOT NULL
    `);
    const toplamBrut = Number(result.recordset[0].ToplamBrut || 0);

    // Gerçek işveren SGK+işsizlik oranlarını BordroParametreleri'nden çek (varsa),
    // yoksa güvenli bir varsayılana (SGK %15,5 + işsizlik %2 = %17,5) düş.
    let isverenOraniToplam = 0.175;
    try {
      const yil = new Date().getFullYear();
      const paramResult = await pool.request().input('Yil', sql.Int, yil)
        .query('SELECT SgkIsverenOrani, IssizlikIsverenOrani FROM BordroParametreleri WHERE Yil = @Yil');
      if (paramResult.recordset[0]) {
        isverenOraniToplam = Number(paramResult.recordset[0].SgkIsverenOrani) + Number(paramResult.recordset[0].IssizlikIsverenOrani);
      }
    } catch (e) { /* BordroParametreleri yoksa varsayılanı kullan */ }

    const tahminiIsverenMaliyeti = Math.round(toplamBrut * (1 + isverenOraniToplam) * 100) / 100;
    res.json({
      personelSayisi: result.recordset[0].PersonelSayisi,
      toplamBrutMaas: toplamBrut,
      isverenOraniToplam,
      tahminiIsverenMaliyeti,
      not: `Bu tutar, personel sayfasındaki "Sabit Brüt Maaş" alanları ve %${(isverenOraniToplam * 100).toFixed(1)} işveren SGK/işsizlik primi oranından tahmin edilmiştir.`
    });
  } catch (err) {
    res.status(500).json({ error: 'Personel gideri hesaplanırken hata oluştu', detail: err.message });
  }
});

app.post('/api/sabit-giderler', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { GiderAdi, AylikTutar, Kategori, Aciklama } = req.body;
    const result = await pool.request()
      .input('GiderAdi', sql.NVarChar, GiderAdi)
      .input('AylikTutar', sql.Decimal(18, 2), AylikTutar || 0)
      .input('Kategori', sql.NVarChar, Kategori || 'Genel Gider')
      .input('Aciklama', sql.NVarChar, Aciklama || null)
      .query(`
        INSERT INTO SabitGiderler (GiderAdi, AylikTutar, Kategori, Aciklama)
        OUTPUT INSERTED.*
        VALUES (@GiderAdi, @AylikTutar, @Kategori, @Aciklama)
      `);
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ error: 'Gider eklenirken hata oluştu', detail: err.message });
  }
});

app.put('/api/sabit-giderler/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { GiderAdi, AylikTutar, Kategori, Aciklama, Aktif } = req.body;
    await pool.request()
      .input('GiderId', sql.Int, req.params.id)
      .input('GiderAdi', sql.NVarChar, GiderAdi)
      .input('AylikTutar', sql.Decimal(18, 2), AylikTutar || 0)
      .input('Kategori', sql.NVarChar, Kategori || 'Genel Gider')
      .input('Aciklama', sql.NVarChar, Aciklama || null)
      .input('Aktif', sql.Bit, Aktif === false ? 0 : 1)
      .query(`
        UPDATE SabitGiderler SET GiderAdi=@GiderAdi, AylikTutar=@AylikTutar, Kategori=@Kategori,
          Aciklama=@Aciklama, Aktif=@Aktif WHERE GiderId=@GiderId
      `);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gider güncellenirken hata oluştu', detail: err.message });
  }
});

app.delete('/api/sabit-giderler/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().input('GiderId', sql.Int, req.params.id)
      .query('DELETE FROM SabitGiderler WHERE GiderId = @GiderId');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gider silinirken hata oluştu' });
  }
});

// Başabaş noktası hesaplama: sabit giderler otomatik, satış fiyatı + birim değişken maliyet manuel/reçeteden
app.post('/api/basabas-hesapla', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { satisFiyati, birimDegiskenMaliyet } = req.body;

    const giderResult = await pool.request().query('SELECT ISNULL(SUM(AylikTutar), 0) AS Toplam FROM SabitGiderler WHERE Aktif = 1');
    const toplamSabitGider = Number(giderResult.recordset[0].Toplam || 0);

    const sf = Number(satisFiyati || 0);
    const bdm = Number(birimDegiskenMaliyet || 0);
    const katkiPayi = sf - bdm;

    if (katkiPayi <= 0) {
      return res.json({
        toplamSabitGider, satisFiyati: sf, birimDegiskenMaliyet: bdm, katkiPayi,
        hata: 'Satış fiyatı, birim değişken maliyetin altında veya eşit. Bu fiyatla asla başabaşa ulaşılamaz.',
        basabasAdet: null, basabasCiro: null,
      });
    }

    const basabasAdet = Math.ceil(toplamSabitGider / katkiPayi);
    const basabasCiro = basabasAdet * sf;

    res.json({
      toplamSabitGider, satisFiyati: sf, birimDegiskenMaliyet: bdm, katkiPayi,
      katkiPayiOrani: sf > 0 ? Math.round((katkiPayi / sf) * 10000) / 100 : 0,
      basabasAdet, basabasCiro,
    });
  } catch (err) {
    res.status(500).json({ error: 'Başabaş noktası hesaplanırken hata oluştu', detail: err.message });
  }
});

/* =========================================================
   İHRACAT MODÜLÜ (İhracat İşlemleri, Gümrük/Nakliye Evrakları, Döviz Bozum)
   ========================================================= */

app.get('/api/ihracat', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM IhracatIslemleri ORDER BY IhracatId DESC');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'İhracat listesi alınamadı', detail: err.message });
  }
});

// İhracat yaptığımız müşterilerin özeti (kaç sevkiyat, toplam döviz/TL tutarı)
app.get('/api/ihracat/musteriler', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT
        c.CariId, c.CariKodu, c.CariAdi, c.FaturaIl,
        COUNT(i.IhracatId) AS SevkiyatSayisi,
        ISNULL(SUM(i.TLKarsiligi), 0) AS ToplamTLKarsiligi,
        MAX(i.IhracatTarihi) AS SonSevkiyatTarihi
      FROM IhracatIslemleri i
      JOIN CariListesi c ON c.CariId = i.CariId
      GROUP BY c.CariId, c.CariKodu, c.CariAdi, c.FaturaIl
      ORDER BY ToplamTLKarsiligi DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'İhracat müşterileri alınamadı', detail: err.message });
  }
});

app.get('/api/ihracat/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const header = await pool.request().input('IhracatId', sql.Int, req.params.id)
      .query('SELECT * FROM IhracatIslemleri WHERE IhracatId = @IhracatId');
    if (header.recordset.length === 0) return res.status(404).json({ error: 'İhracat kaydı bulunamadı' });
    const evrak = await pool.request().input('IhracatId', sql.Int, req.params.id)
      .query('SELECT * FROM IhracatEvrak WHERE IhracatId = @IhracatId ORDER BY YuklemeTarihi DESC');
    const bozumlar = await pool.request().input('IhracatId', sql.Int, req.params.id)
      .query('SELECT * FROM DovizBozum WHERE IhracatId = @IhracatId ORDER BY BozumTarihi DESC');
    res.json({ ...header.recordset[0], evrak: evrak.recordset, bozumlar: bozumlar.recordset });
  } catch (err) {
    res.status(500).json({ error: 'İhracat detayı alınamadı', detail: err.message });
  }
});

app.post('/api/ihracat', async (req, res) => {
  try {
    const pool = await poolPromise;
    const b = req.body;
    const tlKarsiligi = b.FaturaKuru ? Number(b.DovizTutari) * Number(b.FaturaKuru) : null;
    const result = await pool.request()
      .input('IhracatKodu', sql.NVarChar, b.IhracatKodu)
      .input('CariId', sql.Int, b.CariId)
      .input('CariKodu', sql.NVarChar, b.CariKodu || null)
      .input('CariAdi', sql.NVarChar, b.CariAdi || null)
      .input('FaturaId', sql.Int, b.FaturaId || null)
      .input('IhracatTarihi', sql.Date, b.IhracatTarihi)
      .input('TeslimSekli', sql.NVarChar, b.TeslimSekli || null)
      .input('NakliyeFirmasi', sql.NVarChar, b.NakliyeFirmasi || null)
      .input('GumrukBeyannameNo', sql.NVarChar, b.GumrukBeyannameNo || null)
      .input('VarisUlkesi', sql.NVarChar, b.VarisUlkesi || null)
      .input('ParaBirimi', sql.NVarChar, b.ParaBirimi || 'USD')
      .input('DovizTutari', sql.Decimal(18, 2), b.DovizTutari || 0)
      .input('FaturaKuru', sql.Decimal(18, 4), b.FaturaKuru || null)
      .input('TLKarsiligi', sql.Decimal(18, 2), tlKarsiligi)
      .input('Durum', sql.NVarChar, b.Durum || 'Hazırlanıyor')
      .input('Notlar', sql.NVarChar, b.Notlar || null)
      .query(`
        INSERT INTO IhracatIslemleri (
          IhracatKodu, CariId, CariKodu, CariAdi, FaturaId, IhracatTarihi, TeslimSekli, NakliyeFirmasi,
          GumrukBeyannameNo, VarisUlkesi, ParaBirimi, DovizTutari, FaturaKuru, TLKarsiligi, Durum, Notlar
        )
        OUTPUT INSERTED.*
        VALUES (
          @IhracatKodu, @CariId, @CariKodu, @CariAdi, @FaturaId, @IhracatTarihi, @TeslimSekli, @NakliyeFirmasi,
          @GumrukBeyannameNo, @VarisUlkesi, @ParaBirimi, @DovizTutari, @FaturaKuru, @TLKarsiligi, @Durum, @Notlar
        )
      `);
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ error: 'İhracat kaydedilirken hata oluştu', detail: err.message });
  }
});

app.put('/api/ihracat/:id/durum', async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('IhracatId', sql.Int, req.params.id)
      .input('Durum', sql.NVarChar, req.body.Durum)
      .query('UPDATE IhracatIslemleri SET Durum = @Durum WHERE IhracatId = @IhracatId');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Durum güncellenirken hata oluştu', detail: err.message });
  }
});

app.delete('/api/ihracat/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().input('IhracatId', sql.Int, req.params.id)
      .query('DELETE FROM IhracatIslemleri WHERE IhracatId = @IhracatId');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'İhracat kaydı silinirken hata oluştu (bağlı döviz bozum kaydı olabilir)', detail: err.message });
  }
});

/* --- İhracat Evrak Yönetimi (Gümrük Beyannamesi, Konşimento/CMR, Menşe Şahadetnamesi, Sigorta Poliçesi, Serbest) --- */
app.get('/api/ihracat/:id/evrak', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().input('IhracatId', sql.Int, req.params.id)
      .query('SELECT * FROM IhracatEvrak WHERE IhracatId = @IhracatId ORDER BY YuklemeTarihi DESC');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Evraklar alınamadı', detail: err.message });
  }
});

app.post('/api/ihracat/:id/evrak', uploadIhracatEvrak.single('dosya'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya bulunamadı' });
    const pool = await poolPromise;
    const { EvrakTipi, Baslik } = req.body;
    const dosyaYolu = `/uploads/ihracat-evrak/${req.file.filename}`;
    const result = await pool.request()
      .input('IhracatId', sql.Int, req.params.id)
      .input('EvrakTipi', sql.NVarChar, EvrakTipi || 'Serbest')
      .input('Baslik', sql.NVarChar, Baslik || null)
      .input('DosyaAdi', sql.NVarChar, req.file.originalname)
      .input('DosyaYolu', sql.NVarChar, dosyaYolu)
      .input('DosyaBoyutu', sql.Int, req.file.size)
      .query(`
        INSERT INTO IhracatEvrak (IhracatId, EvrakTipi, Baslik, DosyaAdi, DosyaYolu, DosyaBoyutu)
        OUTPUT INSERTED.*
        VALUES (@IhracatId, @EvrakTipi, @Baslik, @DosyaAdi, @DosyaYolu, @DosyaBoyutu)
      `);
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ error: 'Evrak yüklenirken hata oluştu', detail: err.message });
  }
});

app.delete('/api/ihracat/evrak/:evrakId', async (req, res) => {
  try {
    const pool = await poolPromise;
    const findResult = await pool.request().input('EvrakId', sql.Int, req.params.evrakId)
      .query('SELECT DosyaYolu FROM IhracatEvrak WHERE EvrakId = @EvrakId');
    await pool.request().input('EvrakId', sql.Int, req.params.evrakId)
      .query('DELETE FROM IhracatEvrak WHERE EvrakId = @EvrakId');
    if (findResult.recordset[0]) {
      const filePath = path.join(UPLOAD_ROOT, findResult.recordset[0].DosyaYolu.replace('/uploads/', ''));
      fs.unlink(filePath, () => {});
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Evrak silinirken hata oluştu', detail: err.message });
  }
});

/* --- Döviz Bozum Takibi --- */
app.get('/api/doviz-bozum', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT b.*, c.CariAdi, c.CariKodu, i.IhracatKodu, i.FaturaKuru AS IhracatFaturaKuru
      FROM DovizBozum b
      JOIN CariListesi c ON c.CariId = b.CariId
      LEFT JOIN IhracatIslemleri i ON i.IhracatId = b.IhracatId
      ORDER BY b.BozumTarihi DESC
    `);
    const rows = result.recordset.map(r => {
      let kurFarki = null;
      if (r.IhracatFaturaKuru) {
        kurFarki = Math.round((Number(r.BozumKuru) - Number(r.IhracatFaturaKuru)) * Number(r.DovizTutari) * 100) / 100;
      }
      return { ...r, KurFarki: kurFarki };
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Döviz bozum listesi alınamadı', detail: err.message });
  }
});

app.post('/api/doviz-bozum', async (req, res) => {
  try {
    const pool = await poolPromise;
    const b = req.body;
    const tlTutari = Number(b.DovizTutari) * Number(b.BozumKuru);
    const result = await pool.request()
      .input('IhracatId', sql.Int, b.IhracatId || null)
      .input('CariId', sql.Int, b.CariId)
      .input('ParaBirimi', sql.NVarChar, b.ParaBirimi)
      .input('DovizTutari', sql.Decimal(18, 2), b.DovizTutari)
      .input('BozumKuru', sql.Decimal(18, 4), b.BozumKuru)
      .input('TLTutari', sql.Decimal(18, 2), tlTutari)
      .input('BozumTarihi', sql.Date, b.BozumTarihi)
      .input('Aciklama', sql.NVarChar, b.Aciklama || null)
      .query(`
        INSERT INTO DovizBozum (IhracatId, CariId, ParaBirimi, DovizTutari, BozumKuru, TLTutari, BozumTarihi, Aciklama)
        OUTPUT INSERTED.*
        VALUES (@IhracatId, @CariId, @ParaBirimi, @DovizTutari, @BozumKuru, @TLTutari, @BozumTarihi, @Aciklama)
      `);
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ error: 'Döviz bozum kaydedilirken hata oluştu', detail: err.message });
  }
});

app.delete('/api/doviz-bozum/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().input('BozumId', sql.Int, req.params.id)
      .query('DELETE FROM DovizBozum WHERE BozumId = @BozumId');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Döviz bozum kaydı silinirken hata oluştu' });
  }
});

/* =========================================================
   BİLDİRİMLER (Kritik Stok, Vadesi Geçmiş Fatura, Süresi Dolan Teklif)
   ========================================================= */
app.get('/api/bildirimler', async (req, res) => {
  try {
    const pool = await poolPromise;

    const kritikStok = await pool.request().query(`
      SELECT UrunId, UrunKodu, UrunAdi, StokMiktari, KritikStokSeviyesi
      FROM Urunler
      WHERE IsActive = 1 AND Tur = N'Ürün' AND KritikStokSeviyesi > 0 AND StokMiktari <= KritikStokSeviyesi
      ORDER BY (StokMiktari - KritikStokSeviyesi) ASC
    `);

    const vadesiGecmis = await pool.request().query(`
      SELECT FaturaId, FaturaKodu, Yon, CariAdi, VadeTarihi, GenelToplam,
        DATEDIFF(DAY, VadeTarihi, GETDATE()) AS GecikmeGunSayisi
      FROM Faturalar
      WHERE IsActive = 1 AND Durum IN (N'Bekliyor', N'Gecikti') AND VadeTarihi IS NOT NULL AND VadeTarihi < GETDATE()
      ORDER BY VadeTarihi ASC
    `);

    const sureBitenTeklif = await pool.request().query(`
      SELECT TeklifId, TeklifKodu, Yon, CariAdi, GecerlilikTarihi,
        DATEDIFF(DAY, GETDATE(), GecerlilikTarihi) AS KalanGun
      FROM Teklifler
      WHERE Durum IN (N'Taslak', N'Gönderildi') AND GecerlilikTarihi IS NOT NULL
        AND DATEDIFF(DAY, GETDATE(), GecerlilikTarihi) <= 3
      ORDER BY GecerlilikTarihi ASC
    `);

    const toplamSayi = kritikStok.recordset.length + vadesiGecmis.recordset.length + sureBitenTeklif.recordset.length;

    res.json({
      toplamSayi,
      kritikStok: kritikStok.recordset,
      vadesiGecmisFaturalar: vadesiGecmis.recordset,
      sureBitenTeklifler: sureBitenTeklif.recordset,
    });
  } catch (err) {
    res.status(500).json({ error: 'Bildirimler alınamadı', detail: err.message });
  }
});

// Son 6 ay: aylık satış / alış / net kâr trendi (Panel Özet grafiği için)
app.get('/api/raporlar/aylik-trend', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT
        YEAR(FaturaTarihi) AS Yil, MONTH(FaturaTarihi) AS Ay, Yon,
        SUM(GenelToplam) AS Toplam
      FROM Faturalar
      WHERE IsActive = 1 AND FaturaTarihi >= DATEADD(MONTH, -6, GETDATE())
      GROUP BY YEAR(FaturaTarihi), MONTH(FaturaTarihi), Yon
      ORDER BY Yil, Ay
    `);

    const aylar = [];
    const simdi = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(simdi.getFullYear(), simdi.getMonth() - i, 1);
      aylar.push({ yil: d.getFullYear(), ay: d.getMonth() + 1, label: d.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' }) });
    }

    const trend = aylar.map(a => {
      const satis = result.recordset.find(r => r.Yil === a.yil && r.Ay === a.ay && r.Yon === 'Satış');
      const alis = result.recordset.find(r => r.Yil === a.yil && r.Ay === a.ay && r.Yon === 'Alış');
      const satisTutar = Number(satis?.Toplam || 0);
      const alisTutar = Number(alis?.Toplam || 0);
      return { label: a.label, satis: satisTutar, alis: alisTutar, net: satisTutar - alisTutar };
    });

    res.json(trend);
  } catch (err) {
    res.status(500).json({ error: 'Aylık trend alınamadı', detail: err.message });
  }
});

// Server başlat
registerTrendyol({ app, poolPromise, sql });
registerTrendyolExtra({ app, poolPromise, sql });
registerKolaybi({ app, poolPromise, sql });

app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda calisiyor`);
});
