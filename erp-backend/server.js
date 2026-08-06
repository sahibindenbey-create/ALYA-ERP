const express = require('express');
const cors = require('cors');
const { sql, poolPromise } = require('./db');
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
  res.json({ message: 'ERP Backend API çalışiyor!' });
});

// Tüm carileri getir
app.get('/api/cariler', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query('SELECT * FROM CariListesi');
    
    console.log('Sorgu sonucu:', result.recordset);
    console.log('Kayit sayisi:', result.recordset.length);
    
    res.json(result.recordset);
  } catch (err) {
    console.error('Hata (GET /api/cariler):', err.message || err);
    res.status(500).json({ error: 'Veri getirme hatasi' });
  }
});

// Yeni cari ekle
app.post('/api/cariler', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { CompanyId, CariKodu, CariAdi, CariTipi, VergiDairesi, VergiNo, TCNo } = req.body;

    const result = await pool.request()
      .input('CompanyId', sql.Int, CompanyId)
      .input('CariKodu', sql.NVarChar(50), CariKodu)
      .input('CariAdi', sql.NVarChar(200), CariAdi)
      .input('CariTipi', sql.Int, CariTipi)
      .input('VergiDairesi', sql.NVarChar(100), VergiDairesi)
      .input('VergiNo', sql.NVarChar(50), VergiNo)
      .input('TCNo', sql.NVarChar(50), TCNo)
      .query(`
        INSERT INTO CariListesi (CompanyId, CariKodu, CariAdi, CariTipi, VergiDairesi, VergiNo, TCNo)
        OUTPUT INSERTED.*
        VALUES (@CompanyId, @CariKodu, @CariAdi, @CariTipi, @VergiDairesi, @VergiNo, @TCNo)
      `);

    const inserted = result.recordset && result.recordset[0] ? result.recordset[0] : null;
    res.json({ success: true, inserted });
  } catch (err) {
    console.error('Hata (POST /api/cariler):', err.message || err);
    res.status(500).json({ error: 'Cari eklenirken hata olustu', details: err.message || err });
  }
});

// Cari sil
app.delete('/api/cariler/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    
    const result = await pool.request()
      .input('CariId', sql.Int, id)
      .query('DELETE FROM CariListesi WHERE CariId = @CariId');
    
    res.json({ success: true, message: 'Cari silindi' });
  } catch (err) {
    console.error('Hata (DELETE /api/cariler/:id):', err.message || err);
    res.status(500).json({ error: 'Cari silinirken hata olustu' });
  }
});

// --- ÜRÜN ve STOK ENDPOINTLERİ ---
// Arama: GET /api/urunler?q=term
app.get('/api/urunler', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const pool = await poolPromise;
    const request = pool.request();
    if (q) {
      const like = `%${q}%`;
      request.input('q', sql.NVarChar(200), like);
      const result = await request.query("SELECT TOP 50 * FROM Urunler WHERE UrunKodu LIKE @q OR UrunAdi LIKE @q ORDER BY UrunAdi");
      res.json(result.recordset);
    } else {
      const result = await request.query('SELECT TOP 100 * FROM Urunler ORDER BY UrunAdi');
      res.json(result.recordset);
    }
  } catch (err) {
    console.error('Hata (GET /api/urunler):', err.message || err);
    res.status(500).json({ error: 'Urunler getirme hatasi', details: err.message || err });
  }
});

// Tek ürün: GET /api/urunler/:id
app.get('/api/urunler/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    const result = await pool.request()
      .input('UrunId', sql.Int, id)
      .query('SELECT * FROM Urunler WHERE UrunId = @UrunId');
    res.json(result.recordset[0] || null);
  } catch (err) {
    console.error('Hata (GET /api/urunler/:id):', err.message || err);
    res.status(500).json({ error: 'Urun getirme hatasi', details: err.message || err });
  }
});

// Stok listesi: GET /api/stok
app.get('/api/stok', async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query('SELECT TOP 500 * FROM Stok ORDER BY UrunId');
    res.json(result.recordset);
  } catch (err) {
    console.error('Hata (GET /api/stok):', err.message || err);
    res.status(500).json({ error: 'Stok getirme hatasi', details: err.message || err });
  }
});

// Sipariş kaydetme: POST /api/siparisler
// Beklenen body: { header: { SiparisNo, SiparisTarihi, CariId, OdemeSekli, ... }, items: [{ UrunId, UrunKodu, Miktar, Birim, ListeFiyati, Iskonto, SatirToplam }, ...] }
app.post('/api/siparisler', async (req, res) => {
  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);
  try {
    const { header = {}, items = [] } = req.body;
    await tx.begin();
    const tr = tx.request();

    // Basit örnek: Siparisler tablosuna ekle (kolonlar ortamınıza göre uyarlanmalı)
    tr.input('SiparisNo', sql.NVarChar(100), header.SiparisNo || null);
    tr.input('SiparisTarihi', sql.Date, header.SiparisTarihi ? new Date(header.SiparisTarihi) : null);
    tr.input('CariId', sql.Int, header.CariId || null);
    tr.input('OdemeSekli', sql.NVarChar(50), header.OdemeSekli || null);

    const insertHeaderResult = await tr.query(`
      INSERT INTO Siparisler (SiparisNo, SiparisTarihi, CariId, OdemeSekli)
      OUTPUT INSERTED.*
      VALUES (@SiparisNo, @SiparisTarihi, @CariId, @OdemeSekli)
    `);

    const siparis = insertHeaderResult.recordset[0];
    const siparisId = siparis ? siparis.SiparisId : null;

    // Kalemleri ekle ve stokları düş
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const itemReq = tx.request();
      itemReq.input('SiparisId', sql.Int, siparisId);
      itemReq.input('UrunId', sql.Int, it.UrunId);
      itemReq.input('UrunKodu', sql.NVarChar(100), it.UrunKodu || null);
      itemReq.input('Miktar', sql.Decimal(18, 2), it.Miktar || 0);
      itemReq.input('Birim', sql.NVarChar(20), it.Birim || null);
      itemReq.input('ListeFiyati', sql.Decimal(18, 2), it.ListeFiyati || 0);
      itemReq.input('Iskonto', sql.Decimal(5, 2), it.Iskonto || 0);
      itemReq.input('SatirToplam', sql.Decimal(18, 2), it.SatirToplam || 0);

      await itemReq.query(`
        INSERT INTO SiparisKalemleri (SiparisId, UrunId, UrunKodu, Miktar, Birim, ListeFiyati, Iskonto, SatirToplam)
        VALUES (@SiparisId, @UrunId, @UrunKodu, @Miktar, @Birim, @ListeFiyati, @Iskonto, @SatirToplam)
      `);

      // Stok güncelle (örnek: MevcutStok kolonu)
      await tx.request()
        .input('UrunId', sql.Int, it.UrunId)
        .input('Miktar', sql.Decimal(18, 2), it.Miktar || 0)
        .query('UPDATE Stok SET Mevcut = Mevcut - @Miktar WHERE UrunId = @UrunId');
    }

    await tx.commit();
    res.json({ success: true, siparisId, inserted: siparis });
  } catch (err) {
    console.error('Hata (POST /api/siparisler):', err.message || err);
    try { await tx.rollback(); } catch (rerr) { console.error('Rollback hatasi:', rerr); }
    res.status(500).json({ error: 'Siparis kaydedilirken hata olustu', details: err.message || err });
  }
});

// Server başlat
app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda calisiyor`);
});
