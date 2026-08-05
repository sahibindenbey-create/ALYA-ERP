const express = require('express');
const cors = require('cors');
const { poolPromise } = require('./db');
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
    console.error('Hata:', err);
    res.status(500).json({ error: 'Veri getirme hatasi' });
  }
});

// Yeni cari ekle
app.post('/api/cariler', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { CompanyId, CariKodu, CariAdi, CariTipi, VergiDairesi, VergiNo, TCNo } = req.body;
    
    await pool.request()
      .input('CompanyId', CompanyId)
      .input('CariKodu', CariKodu)
      .input('CariAdi', CariAdi)
      .input('CariTipi', CariTipi)
      .input('VergiDairesi', VergiDairesi)
      .input('VergiNo', VergiNo)
      .input('TCNo', TCNo)
      .query(`
        INSERT INTO CariListesi (CompanyId, CariKodu, CariAdi, CariTipi, VergiDairesi, VergiNo, TCNo)
        VALUES (@CompanyId, @CariKodu, @CariAdi, @CariTipi, @VergiDairesi, @VergiNo, @TCNo)
      `);
    
    res.json({ success: true, message: 'Cari basariyla eklendi' });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Cari eklenirken hata olustu' });
  }
});

// Cari sil
app.delete('/api/cariler/:id', async (req, res) => {
  try {
    const pool = await poolPromise;
    const { id } = req.params;
    
    await pool.request()
      .input('CariId', id)
      .query('DELETE FROM CariListesi WHERE CariId = @CariId');
    
    res.json({ success: true, message: 'Cari silindi' });
  } catch (err) {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Cari silinirken hata olustu' });
  }
});

// Server başlat
app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda calisiyor`);
});