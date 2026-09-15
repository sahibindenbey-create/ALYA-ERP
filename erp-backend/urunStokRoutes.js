function install({ app, poolPromise, sql }) {
  if (app.__alyaUrunStokRoutesInstalled) return;
  app.__alyaUrunStokRoutesInstalled = true;

  app.post('/api/urunler/:id/stok/initialize', async (req, res) => {
    const urunId = Number(req.params.id);
    const requestedQuantity = Number(req.body?.quantity ?? 0);
    if (!Number.isInteger(urunId) || urunId <= 0 || !Number.isFinite(requestedQuantity) || requestedQuantity < 0) {
      return res.status(400).json({ success: false, error: 'Geçersiz ürün veya stok miktarı.' });
    }

    const tx = new sql.Transaction(await poolPromise);
    try {
      await tx.begin();

      const product = (await new sql.Request(tx)
        .input('UrunId', sql.Int, urunId)
        .query(`
          SELECT TOP (1) UrunId, CompanyId, Tur, UrunAdi, StokMiktari, KritikStokSeviyesi
          FROM dbo.Urunler
          WHERE UrunId=@UrunId
            AND CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId'))
            AND ISNULL(IsActive,1)=1;
        `)).recordset[0];

      if (!product) throw Object.assign(new Error('Ürün bulunamadı.'), { statusCode: 404 });
      if (String(product.Tur || 'Ürün') === 'Hizmet') {
        await tx.commit();
        return res.json({ success: true, initialized: false, message: 'Hizmet için stok bakiyesi oluşturulmadı.' });
      }

      const warehouse = (await new sql.Request(tx).query(`
        SELECT TOP (1) d.DepoId, l.LokasyonId
        FROM dbo.Depolar d
        INNER JOIN dbo.DepoLokasyonlari l
          ON l.CompanyId=d.CompanyId AND l.DepoId=d.DepoId AND l.LokasyonKodu=N'GENEL' AND l.IsActive=1
        WHERE d.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId'))
          AND d.DepoKodu=N'MERKEZ' AND d.IsActive=1;
      `)).recordset[0];

      if (!warehouse) throw new Error('Merkez depo / GENEL lokasyonu bulunamadı.');

      const existing = (await new sql.Request(tx)
        .input('UrunId', sql.Int, urunId)
        .input('DepoId', sql.Int, warehouse.DepoId)
        .input('LokasyonId', sql.Int, warehouse.LokasyonId)
        .query(`
          SELECT TOP (1) * FROM dbo.StokBakiyeleri WITH (UPDLOCK,HOLDLOCK)
          WHERE CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId'))
            AND UrunId=@UrunId AND DepoId=@DepoId AND LokasyonId=@LokasyonId
            AND LotNo=N'' AND SeriNo=N'';
        `)).recordset[0];

      if (existing) {
        await tx.commit();
        return res.json({ success: true, initialized: false, alreadyExists: true, StokBakiyeId: existing.StokBakiyeId, Miktar: existing.Miktar });
      }

      const quantity = requestedQuantity;
      const minimum = Number(product.KritikStokSeviyesi || 0);
      const inserted = await new sql.Request(tx)
        .input('UrunId', sql.Int, urunId)
        .input('DepoId', sql.Int, warehouse.DepoId)
        .input('LokasyonId', sql.Int, warehouse.LokasyonId)
        .input('Miktar', sql.Decimal(18,4), quantity)
        .input('MinimumStok', sql.Decimal(18,4), minimum)
        .query(`
          INSERT dbo.StokBakiyeleri
            (CompanyId,UrunId,DepoId,LokasyonId,Miktar,MinimumStok,YenidenSiparisNoktasi)
          OUTPUT INSERTED.StokBakiyeId, INSERTED.Miktar
          VALUES
            (TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')),@UrunId,@DepoId,@LokasyonId,@Miktar,@MinimumStok,@MinimumStok);
        `);

      await tx.commit();
      res.json({ success: true, initialized: true, StokBakiyeId: inserted.recordset[0].StokBakiyeId, Miktar: inserted.recordset[0].Miktar });
    } catch (error) {
      try { await tx.rollback(); } catch (_) {}
      res.status(error.statusCode || 500).json({ success: false, error: error.message || String(error) });
    }
  });

  app.get('/api/urunler/:id/stok', async (req, res) => {
    const urunId = Number(req.params.id);
    if (!Number.isInteger(urunId) || urunId <= 0) return res.status(400).json({ success: false, error: 'Geçersiz ürün.' });
    try {
      const pool = await poolPromise;
      const result = await pool.request().input('UrunId', sql.Int, urunId).query(`
        SELECT
          b.UrunId,
          SUM(b.Miktar) AS FizikselStok,
          SUM(b.RezerveMiktar) AS RezerveStok,
          SUM(b.BlokeMiktar) AS BlokeStok,
          SUM(b.Miktar-b.RezerveMiktar-b.BlokeMiktar) AS KullanilabilirStok,
          MIN(COALESCE(p.YenidenSiparisNoktasi,b.YenidenSiparisNoktasi,0)) AS YenidenSiparisNoktasi
        FROM dbo.StokBakiyeleri b
        LEFT JOIN dbo.StokPolitikalariV2 p
          ON p.CompanyId=b.CompanyId AND p.UrunId=b.UrunId AND p.IsActive=1
        WHERE b.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId'))
          AND b.UrunId=@UrunId
        GROUP BY b.UrunId;
      `);
      res.json({ success: true, data: result.recordset[0] || null });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message || String(error) });
    }
  });
}

module.exports = { install };