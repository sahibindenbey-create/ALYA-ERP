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

// Server başlat
app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda calisiyor`);
});
