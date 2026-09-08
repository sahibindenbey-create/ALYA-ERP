const { poolPromise, sql } = require('./db');

module.exports = function registerStokRoutes(app) {
  const companySql = `DECLARE @SessionCompanyId INT = TRY_CONVERT(INT, SESSION_CONTEXT(N'CompanyId')); IF @SessionCompanyId IS NULL OR @SessionCompanyId <= 0 THROW 51001, 'CompanyId context bulunamadı.', 1;`;

  app.get('/api/stok', async (req, res) => {
    try {
      const pool = await poolPromise;
      const result = await pool.request().query(`${companySql}
        SELECT
          u.UrunId, u.UrunKodu, u.UrunAdi, u.Birim, u.Kategori,
          CAST(ISNULL(u.StokMiktari,0) AS DECIMAL(18,4)) AS Mevcut,
          CAST(ISNULL(u.KritikStokSeviyesi,0) AS DECIMAL(18,4)) AS KritikStokSeviyesi,
          CASE WHEN ISNULL(u.StokMiktari,0) <= ISNULL(u.KritikStokSeviyesi,0) THEN 1 ELSE 0 END AS Kritik
        FROM dbo.Urunler u
        WHERE ISNULL(u.IsActive,1)=1 AND ISNULL(u.Tur,N'Ürün') <> N'Hizmet'
          AND u.CompanyId=@SessionCompanyId
        ORDER BY u.UrunKodu
      `);
      res.json(result.recordset);
    } catch (err) {
      console.error('[Stok] liste', err);
      res.status(500).json({ error: 'Stok listesi alınamadı', detail: err.message });
    }
  });

  app.get('/api/stok/hareketler', async (req, res) => {
    try {
      const pool = await poolPromise;
      const request = pool.request();
      if (req.query.urunId) request.input('UrunId', sql.Int, Number(req.query.urunId));
      const result = await request.query(`${companySql}
        SELECT TOP (500)
          h.StokHareketId, h.UrunId, u.UrunKodu, u.UrunAdi, u.Birim,
          h.Depo, h.HareketTipi, h.Miktar, h.OncekiStok, h.SonrakiStok,
          h.ReferansTipi, h.ReferansId, h.Aciklama, h.CreatedAt
        FROM dbo.StokHareketleri h
        INNER JOIN dbo.Urunler u ON u.UrunId=h.UrunId
        WHERE h.CompanyId=@SessionCompanyId
          AND u.CompanyId=@SessionCompanyId
          AND (@UrunId IS NULL OR h.UrunId=@UrunId)
        ORDER BY h.CreatedAt DESC, h.StokHareketId DESC
      `);
      res.json(result.recordset);
    } catch (err) {
      console.error('[Stok] hareketler', err);
      res.status(500).json({ error: 'Stok hareketleri alınamadı', detail: err.message });
    }
  });

  app.post('/api/stok/hareket', async (req, res) => {
    const b = req.body || {};
    const urunId = Number(b.UrunId);
    const miktar = Number(b.Miktar);
    const tip = String(b.HareketTipi || '');
    const depo = String(b.Depo || 'Merkez Depo').trim() || 'Merkez Depo';

    if (!urunId || !Number.isFinite(miktar) || miktar <= 0 || !['Giriş','Çıkış','Sayım','Düzeltme'].includes(tip)) {
      return res.status(400).json({ error: 'Ürün, hareket tipi ve pozitif miktar zorunludur.' });
    }

    const transaction = new sql.Transaction(await poolPromise);
    try {
      await transaction.begin();
      const request = new sql.Request(transaction);
      const urun = await request
        .input('UrunId', sql.Int, urunId)
        .query(`${companySql}
          SELECT TOP 1 UrunId,StokMiktari,Tur
          FROM dbo.Urunler WITH (UPDLOCK,HOLDLOCK)
          WHERE UrunId=@UrunId AND CompanyId=@SessionCompanyId AND IsActive=1`);
      if (!urun.recordset[0]) throw new Error('Ürün bulunamadı, pasif veya seçili şirkete ait değil.');
      if (urun.recordset[0].Tur === 'Hizmet') throw new Error('Hizmet kartında stok hareketi yapılamaz.');

      const onceki = Number(urun.recordset[0].StokMiktari || 0);
      let sonraki = onceki;
      if (tip === 'Giriş') sonraki = onceki + miktar;
      else if (tip === 'Çıkış') sonraki = onceki - miktar;
      else if (tip === 'Sayım' || tip === 'Düzeltme') sonraki = Number(b.SonrakiStok);
      if (!Number.isFinite(sonraki) || sonraki < 0) throw new Error('Stok miktarı geçersiz.');

      await new sql.Request(transaction)
        .input('UrunId', sql.Int, urunId)
        .input('SonrakiStok', sql.Decimal(18,4), sonraki)
        .query(`${companySql}
          UPDATE dbo.Urunler
          SET StokMiktari=@SonrakiStok, UpdatedAt=SYSDATETIME()
          WHERE UrunId=@UrunId AND CompanyId=@SessionCompanyId AND IsActive=1`);

      const insert = new sql.Request(transaction);
      insert.input('UrunId', sql.Int, urunId);
      insert.input('Depo', sql.NVarChar(100), depo);
      insert.input('HareketTipi', sql.NVarChar(20), tip);
      insert.input('Miktar', sql.Decimal(18,4), miktar);
      insert.input('OncekiStok', sql.Decimal(18,4), onceki);
      insert.input('SonrakiStok', sql.Decimal(18,4), sonraki);
      insert.input('ReferansTipi', sql.NVarChar(50), b.ReferansTipi || null);
      insert.input('ReferansId', sql.Int, b.ReferansId ? Number(b.ReferansId) : null);
      insert.input('Aciklama', sql.NVarChar(500), b.Aciklama || null);
      const result = await insert.query(`${companySql}
        INSERT INTO dbo.StokHareketleri
          (CompanyId,UrunId,Depo,HareketTipi,Miktar,OncekiStok,SonrakiStok,ReferansTipi,ReferansId,Aciklama)
        VALUES
          (@SessionCompanyId,@UrunId,@Depo,@HareketTipi,@Miktar,@OncekiStok,@SonrakiStok,@ReferansTipi,@ReferansId,@Aciklama);
        SELECT SCOPE_IDENTITY() AS StokHareketId;
      `);
      await transaction.commit();
      res.json({ success: true, StokHareketId: result.recordset[0].StokHareketId, OncekiStok: onceki, SonrakiStok: sonraki });
    } catch (err) {
      try { await transaction.rollback(); } catch (_) {}
      console.error('[Stok] hareket kaydı', err);
      res.status(500).json({ error: err.message || 'Stok hareketi kaydedilemedi' });
    }
  });
};
