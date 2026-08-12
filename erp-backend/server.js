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
          SiparisKodu, SiparisTarihi, TeslimatTarihi, TahsilatTarihi,
          SiparisTipi, SiparisVeren, MusteriTemsilcisi, CariKodu, CariAdi,
          FaturaUlke, FaturaIl, FaturaIlce, FaturaAdres,
          SevkiyatUlke, SevkiyatIl, SevkiyatIlce, SevkiyatAdres,
          OdemeSekli, Vade, ToplamTutar
        )
        OUTPUT INSERTED.SiparisId
        VALUES (
          @SiparisKodu, @SiparisTarihi, @TeslimatTarihi, @TahsilatTarihi,
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

// Server başlat
app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda calisiyor`);
});
