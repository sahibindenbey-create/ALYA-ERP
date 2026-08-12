const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { poolPromise, sql } = require('./db');
const app = express();
const PORT = 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

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
      RiskLimiti, VadeGunu, ParaBirimi
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
      .query(`
        INSERT INTO CariListesi (
          CompanyId, CariKodu, CariAdi, CariTipi, MusteriTuru, Segment,
          VergiDairesi, VergiNo, TCNo,
          FaturaIl, FaturaIlce, FaturaAdresDetay,
          SevkiyatIl, SevkiyatIlce, SevkiyatAdresDetay,
          Yetkili1Ad, Yetkili1Gorev, Yetkili1Cep, Yetkili1Mail,
          Yetkili2Ad, Yetkili2Gorev, Yetkili2Cep, Yetkili2Mail,
          RiskLimiti, VadeGunu, ParaBirimi
        )
        OUTPUT INSERTED.*
        VALUES (
          @CompanyId, @CariKodu, @CariAdi, @CariTipi, @MusteriTuru, @Segment,
          @VergiDairesi, @VergiNo, @TCNo,
          @FaturaIl, @FaturaIlce, @FaturaAdresDetay,
          @SevkiyatIl, @SevkiyatIlce, @SevkiyatAdresDetay,
          @Yetkili1Ad, @Yetkili1Gorev, @Yetkili1Cep, @Yetkili1Mail,
          @Yetkili2Ad, @Yetkili2Gorev, @Yetkili2Cep, @Yetkili2Mail,
          @RiskLimiti, @VadeGunu, @ParaBirimi
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
      RiskLimiti, VadeGunu, ParaBirimi
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
      .query(`
        UPDATE CariListesi SET
          CariAdi=@CariAdi, CariTipi=@CariTipi, MusteriTuru=@MusteriTuru, Segment=@Segment,
          VergiDairesi=@VergiDairesi, VergiNo=@VergiNo, TCNo=@TCNo,
          FaturaIl=@FaturaIl, FaturaIlce=@FaturaIlce, FaturaAdresDetay=@FaturaAdresDetay,
          SevkiyatIl=@SevkiyatIl, SevkiyatIlce=@SevkiyatIlce, SevkiyatAdresDetay=@SevkiyatAdresDetay,
          Yetkili1Ad=@Yetkili1Ad, Yetkili1Gorev=@Yetkili1Gorev, Yetkili1Cep=@Yetkili1Cep, Yetkili1Mail=@Yetkili1Mail,
          Yetkili2Ad=@Yetkili2Ad, Yetkili2Gorev=@Yetkili2Gorev, Yetkili2Cep=@Yetkili2Cep, Yetkili2Mail=@Yetkili2Mail,
          RiskLimiti=@RiskLimiti, VadeGunu=@VadeGunu, ParaBirimi=@ParaBirimi
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
      .query(`
        INSERT INTO Siparisler (
          SiparisKodu, SiparisYonu, SiparisTarihi, TeslimatTarihi, TahsilatTarihi,
          SiparisTipi, SiparisVeren, MusteriTemsilcisi, CariKodu, CariAdi,
          FaturaUlke, FaturaIl, FaturaIlce, FaturaAdres,
          SevkiyatUlke, SevkiyatIl, SevkiyatIlce, SevkiyatAdres,
          OdemeSekli, Vade, ToplamTutar
        )
        OUTPUT INSERTED.SiparisId
        VALUES (
          @SiparisKodu, @SiparisYonu, @SiparisTarihi, @TeslimatTarihi, @TahsilatTarihi,
          @SiparisTipi, @SiparisVeren, @MusteriTemsilcisi, @CariKodu, @CariAdi,
          @FaturaUlke, @FaturaIl, @FaturaIlce, @FaturaAdres,
          @SevkiyatUlke, @SevkiyatIl, @SevkiyatIlce, @SevkiyatAdres,
          @OdemeSekli, @Vade, @ToplamTutar
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
      AlisFiyati, ListeFiyati, KdvOrani, Aciklama, Tur, Desi
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
      .query(`
        INSERT INTO Urunler (
          UrunKodu, UrunAdi, Kategori, Birim, StokMiktari, KritikStokSeviyesi,
          AlisFiyati, ListeFiyati, KdvOrani, Aciklama, Tur, Desi
        )
        OUTPUT INSERTED.*
        VALUES (
          @UrunKodu, @UrunAdi, @Kategori, @Birim, @StokMiktari, @KritikStokSeviyesi,
          @AlisFiyati, @ListeFiyati, @KdvOrani, @Aciklama, @Tur, @Desi
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
      AlisFiyati, ListeFiyati, KdvOrani, Aciklama, Tur, Desi
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
      .query(`
        UPDATE Urunler SET
          UrunAdi=@UrunAdi, Kategori=@Kategori, Birim=@Birim,
          StokMiktari=@StokMiktari, KritikStokSeviyesi=@KritikStokSeviyesi,
          AlisFiyati=@AlisFiyati, ListeFiyati=@ListeFiyati, KdvOrani=@KdvOrani, Aciklama=@Aciklama,
          Tur=@Tur, Desi=@Desi
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
        .query(`
          INSERT INTO ReceteDetay (ReceteId, HammaddeUrunId, HammaddeAdi, Miktar, Birim)
          VALUES (@ReceteId, @HammaddeUrunId, @HammaddeAdi, @Miktar, @Birim)
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
  try {
    const pool = await poolPromise;
    const {
      FasonKodu, CariKodu, CariAdi, UrunKodu, UrunAdi, GonderilenMiktar, Birim,
      GonderimTarihi, BeklenenDonusTarihi, Aciklama
    } = req.body;

    const result = await pool.request()
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

    res.json({ success: true, message: 'Fason kaydı eklendi', data: result.recordset[0] });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Fason kaydedilirken hata oluştu', detail: err.message });
  }
});

// Fason dönüşü işaretle
app.put('/api/fason/:id/donus', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    const { DonenMiktar, DonusTarihi } = req.body;

    await pool.request()
      .input('FasonId', sql.Int, id)
      .input('DonenMiktar', sql.Decimal(18, 2), DonenMiktar || 0)
      .input('DonusTarihi', sql.Date, DonusTarihi)
      .query(`
        UPDATE FasonIslemleri SET
          DonenMiktar = @DonenMiktar, DonusTarihi = @DonusTarihi, Durum = 'Tamamlandı'
        WHERE FasonId = @FasonId
      `);

    res.json({ success: true, message: 'Fason dönüşü kaydedildi' });
  } catch (err) {
    console.error('Hata:', err);
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
      .query(`
        INSERT INTO Personeller (
          PersonelKodu, AdSoyad, TCNo, DogumTarihi, Cinsiyet, MedeniHal,
          IseGirisTarihi, IstenCikisTarihi, Departman, Pozisyon, Telefon, Email, Adres, IBAN,
          AcilDurumKisi, AcilDurumTel
        )
        OUTPUT INSERTED.*
        VALUES (
          @PersonelKodu, @AdSoyad, @TCNo, @DogumTarihi, @Cinsiyet, @MedeniHal,
          @IseGirisTarihi, @IstenCikisTarihi, @Departman, @Pozisyon, @Telefon, @Email, @Adres, @IBAN,
          @AcilDurumKisi, @AcilDurumTel
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
      .query(`
        UPDATE Personeller SET
          AdSoyad=@AdSoyad, TCNo=@TCNo, DogumTarihi=@DogumTarihi, Cinsiyet=@Cinsiyet, MedeniHal=@MedeniHal,
          IseGirisTarihi=@IseGirisTarihi, IstenCikisTarihi=@IstenCikisTarihi, Departman=@Departman, Pozisyon=@Pozisyon,
          Telefon=@Telefon, Email=@Email, Adres=@Adres, IBAN=@IBAN,
          AcilDurumKisi=@AcilDurumKisi, AcilDurumTel=@AcilDurumTel
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

app.post('/api/personel/:id/maas', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { DonemYil, DonemAy, BrutMaas, NetMaas, Prim, Kesinti, OdemeTarihi, Aciklama } = req.body;
    await pool.request()
      .input('PersonelId', sql.Int, req.params.id)
      .input('DonemYil', sql.Int, DonemYil)
      .input('DonemAy', sql.Int, DonemAy)
      .input('BrutMaas', sql.Decimal(18, 2), BrutMaas || 0)
      .input('NetMaas', sql.Decimal(18, 2), NetMaas || 0)
      .input('Prim', sql.Decimal(18, 2), Prim || 0)
      .input('Kesinti', sql.Decimal(18, 2), Kesinti || 0)
      .input('OdemeTarihi', sql.Date, OdemeTarihi || null)
      .input('Aciklama', sql.NVarChar, Aciklama || null)
      .query(`
        INSERT INTO PersonelMaas (PersonelId, DonemYil, DonemAy, BrutMaas, NetMaas, Prim, Kesinti, OdemeTarihi, Aciklama)
        VALUES (@PersonelId, @DonemYil, @DonemAy, @BrutMaas, @NetMaas, @Prim, @Kesinti, @OdemeTarihi, @Aciklama)
      `);
    res.json({ success: true, message: 'Maaş kaydı eklendi' });
  } catch (err) {
    res.status(500).json({ error: 'Maaş kaydedilirken hata oluştu', detail: err.message });
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

// Server başlat
app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda calisiyor`);
});
