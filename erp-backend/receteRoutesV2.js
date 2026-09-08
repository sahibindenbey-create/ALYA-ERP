const express = require('express');

module.exports = function registerReceteRoutes(app, poolPromise, sql) {
  const router = express.Router();
  const companySql = `DECLARE @CompanyId INT = TRY_CONVERT(INT, SESSION_CONTEXT(N'CompanyId')); IF @CompanyId IS NULL OR @CompanyId <= 0 THROW 51001, 'CompanyId context bulunamadı.', 1;`;

  router.get('/', async (req, res) => {
    try {
      const pool = await poolPromise;
      const r = await pool.request().query(`${companySql}
        SELECT r.*, u.UrunKodu AS MamulKodu
        FROM dbo.Receteler r
        LEFT JOIN dbo.Urunler u ON u.UrunId = r.MamulUrunId
        WHERE r.IsActive = 1
        ORDER BY r.MamulAdi, r.Versiyon DESC, r.ReceteId DESC`);
      res.json(r.recordset);
    } catch (e) {
      res.status(500).json({ error: 'Reçeteler alınamadı', detail: e.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const pool = await poolPromise;
      const id = Number(req.params.id);
      const h = await pool.request().input('ReceteId', sql.Int, id).query(`${companySql}
        SELECT r.*, u.UrunKodu AS MamulKodu
        FROM dbo.Receteler r
        LEFT JOIN dbo.Urunler u ON u.UrunId = r.MamulUrunId
        WHERE r.ReceteId = @ReceteId AND r.IsActive = 1`);
      if (!h.recordset.length) return res.status(404).json({ error: 'Reçete bulunamadı' });

      const d = await pool.request().input('ReceteId', sql.Int, id).query(`${companySql}
        SELECT d.*, u.UrunKodu, u.AlisFiyati
        FROM dbo.ReceteDetay d
        LEFT JOIN dbo.Urunler u ON u.UrunId = d.HammaddeUrunId
        WHERE d.ReceteId = @ReceteId
        ORDER BY d.SiraNo, d.ReceteDetayId`);

      const o = await pool.request().input('ReceteId', sql.Int, id).query(`${companySql}
        SELECT * FROM dbo.ReceteIstasyon
        WHERE ReceteId = @ReceteId ORDER BY Sira`);

      res.json({ ...h.recordset[0], items: d.recordset, operations: o.recordset });
    } catch (e) {
      res.status(500).json({ error: 'Reçete detayı alınamadı', detail: e.message });
    }
  });

  router.get('/:id/maliyet', async (req, res) => {
    try {
      const pool = await poolPromise;
      const id = Number(req.params.id);
      const r = await pool.request().input('ReceteId', sql.Int, id).query(`${companySql}
        SELECT d.HammaddeUrunId, d.HammaddeAdi, d.Miktar, d.Birim, d.FireOrani,
          ISNULL(u.AlisFiyati, 0) AS AlisFiyati,
          d.Miktar * (1 + ISNULL(d.FireOrani, 0) / 100.0) * ISNULL(u.AlisFiyati, 0) AS SatirMaliyeti
        FROM dbo.ReceteDetay d
        LEFT JOIN dbo.Urunler u ON u.UrunId = d.HammaddeUrunId
        WHERE d.ReceteId = @ReceteId
        ORDER BY d.SiraNo, d.ReceteDetayId`);

      const materialCost = r.recordset.reduce((s, x) => s + Number(x.SatirMaliyeti || 0), 0);
      const o = await pool.request().input('ReceteId', sql.Int, id).query(`${companySql}
        SELECT ISNULL(SUM(IscilikDakika), 0) AS IscilikDakika,
               ISNULL(SUM(MakineDakika), 0) AS MakineDakika,
               ISNULL(SUM(TahminiSureDk), 0) AS TahminiSureDk
        FROM dbo.ReceteIstasyon WHERE ReceteId = @ReceteId`);

      res.json({
        items: r.recordset,
        materialCost,
        iscilikDakika: Number(o.recordset[0]?.IscilikDakika || 0),
        makineDakika: Number(o.recordset[0]?.MakineDakika || 0),
        tahminiSureDk: Number(o.recordset[0]?.TahminiSureDk || 0),
        totalCost: materialCost
      });
    } catch (e) {
      res.status(500).json({ error: 'Reçete maliyeti hesaplanamadı', detail: e.message });
    }
  });

  async function saveRecipe(transaction, form, items, operations, existingId = null) {
    const request = new sql.Request(transaction)
      .input('ReceteKodu', sql.NVarChar, form.receteKodu)
      .input('ReceteAdi', sql.NVarChar, form.receteAdi || form.mamulAdi || null)
      .input('MamulUrunId', sql.Int, Number(form.mamulUrunId))
      .input('MamulAdi', sql.NVarChar, form.mamulAdi)
      .input('Aciklama', sql.NVarChar, form.aciklama || null)
      .input('Versiyon', sql.Int, Number(form.versiyon || 1))
      .input('UretimBirimi', sql.NVarChar, form.uretimBirimi || 'Adet')
      .input('Durum', sql.NVarChar, form.durum || 'Aktif');

    let receteId;
    if (existingId) {
      await request.input('ReceteId', sql.Int, existingId).query(`${companySql}
        UPDATE dbo.Receteler SET
          ReceteKodu=@ReceteKodu, ReceteAdi=@ReceteAdi, MamulUrunId=@MamulUrunId,
          MamulAdi=@MamulAdi, Aciklama=@Aciklama, Versiyon=@Versiyon,
          UretimBirimi=@UretimBirimi, Durum=@Durum
        WHERE ReceteId=@ReceteId`);
      receteId = existingId;
      await new sql.Request(transaction).input('ReceteId', sql.Int, receteId).query(`${companySql} DELETE FROM dbo.ReceteDetay WHERE ReceteId=@ReceteId`);
      await new sql.Request(transaction).input('ReceteId', sql.Int, receteId).query(`${companySql} DELETE FROM dbo.ReceteIstasyon WHERE ReceteId=@ReceteId`);
    } else {
      const h = await request.query(`${companySql}
        INSERT INTO dbo.Receteler(ReceteKodu,ReceteAdi,MamulUrunId,MamulAdi,Aciklama,Versiyon,UretimBirimi,Durum)
        OUTPUT INSERTED.ReceteId
        VALUES(@ReceteKodu,@ReceteAdi,@MamulUrunId,@MamulAdi,@Aciklama,@Versiyon,@UretimBirimi,@Durum)`);
      receteId = h.recordset[0].ReceteId;
    }

    for (let i = 0; i < items.length; i++) {
      const x = items[i];
      await new sql.Request(transaction)
        .input('ReceteId', sql.Int, receteId)
        .input('HammaddeUrunId', sql.Int, Number(x.hammaddeUrunId ?? x.HammaddeUrunId))
        .input('HammaddeAdi', sql.NVarChar, x.hammaddeAdi ?? x.HammaddeAdi)
        .input('Miktar', sql.Decimal(18, 4), Number(x.miktar ?? x.Miktar))
        .input('Birim', sql.NVarChar, x.birim ?? x.Birim ?? 'Adet')
        .input('Istasyon', sql.NVarChar, x.istasyon ?? x.Istasyon ?? null)
        .input('FireOrani', sql.Decimal(9, 4), Number(x.fireOrani ?? x.FireOrani ?? 0))
        .input('SiraNo', sql.Int, i + 1)
        .input('Aciklama', sql.NVarChar, x.aciklama ?? x.Aciklama ?? null)
        .query(`${companySql}
          INSERT INTO dbo.ReceteDetay(ReceteId,HammaddeUrunId,HammaddeAdi,Miktar,Birim,Istasyon,FireOrani,SiraNo,Aciklama)
          VALUES(@ReceteId,@HammaddeUrunId,@HammaddeAdi,@Miktar,@Birim,@Istasyon,@FireOrani,@SiraNo,@Aciklama)`);
    }

    for (let i = 0; i < operations.length; i++) {
      const x = operations[i];
      await new sql.Request(transaction)
        .input('ReceteId', sql.Int, receteId)
        .input('CompanyId', sql.Int, null)
        .input('Sira', sql.Int, i + 1)
        .input('IstasyonAdi', sql.NVarChar, x.istasyonAdi ?? x.IstasyonAdi ?? '')
        .input('TahminiSureDk', sql.Decimal(18, 4), Number(x.tahminiSureDk ?? x.TahminiSureDk ?? 0))
        .input('IslemAdi', sql.NVarChar, x.islemAdi ?? x.IslemAdi ?? null)
        .input('IscilikDakika', sql.Decimal(18, 4), Number(x.iscilikDakika ?? x.IscilikDakika ?? 0))
        .input('MakineDakika', sql.Decimal(18, 4), Number(x.makineDakika ?? x.MakineDakika ?? 0))
        .input('FasonMu', sql.Bit, !!(x.fasonMu ?? x.FasonMu))
        .input('Aciklama', sql.NVarChar, x.aciklama ?? x.Aciklama ?? null)
        .query(`${companySql}
          INSERT INTO dbo.ReceteIstasyon(ReceteId,CompanyId,Sira,IstasyonAdi,TahminiSureDk,IslemAdi,IscilikDakika,MakineDakika,FasonMu,Aciklama)
          VALUES(@ReceteId,@CompanyId,@Sira,@IstasyonAdi,@TahminiSureDk,@IslemAdi,@IscilikDakika,@MakineDakika,@FasonMu,@Aciklama)`);
    }

    return receteId;
  }

  router.post('/', async (req, res) => {
    const transaction = new sql.Transaction(await poolPromise);
    try {
      const { form, items = [], operations = [] } = req.body;
      if (!form?.mamulUrunId) return res.status(400).json({ error: 'Mamul ürün seçilmelidir.' });
      if (!items.length) return res.status(400).json({ error: 'En az bir hammadde satırı gereklidir.' });
      await transaction.begin();
      const receteId = await saveRecipe(transaction, form, items, operations);
      await transaction.commit();
      res.json({ success: true, receteId, message: 'Reçete oluşturuldu' });
    } catch (e) {
      try { await transaction.rollback(); } catch (_) {}
      res.status(500).json({ error: 'Reçete kaydedilemedi', detail: e.message });
    }
  });

  router.put('/:id', async (req, res) => {
    const transaction = new sql.Transaction(await poolPromise);
    try {
      const id = Number(req.params.id);
      const { form, items = [], operations = [] } = req.body;
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Geçersiz reçete.' });
      if (!form?.mamulUrunId) return res.status(400).json({ error: 'Mamul ürün seçilmelidir.' });
      if (!items.length) return res.status(400).json({ error: 'En az bir hammadde satırı gereklidir.' });
      await transaction.begin();
      const check = await new sql.Request(transaction).input('ReceteId', sql.Int, id).query(`${companySql} SELECT ReceteId FROM dbo.Receteler WHERE ReceteId=@ReceteId AND IsActive=1`);
      if (!check.recordset.length) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Reçete bulunamadı.' });
      }
      const receteId = await saveRecipe(transaction, form, items, operations, id);
      await transaction.commit();
      res.json({ success: true, receteId, message: 'Reçete güncellendi' });
    } catch (e) {
      try { await transaction.rollback(); } catch (_) {}
      res.status(500).json({ error: 'Reçete güncellenemedi', detail: e.message });
    }
  });

  router.post('/:id/revizyon', async (req, res) => {
    const transaction = new sql.Transaction(await poolPromise);
    try {
      const id = Number(req.params.id);
      await transaction.begin();
      const h = await new sql.Request(transaction).input('ReceteId', sql.Int, id).query(`${companySql}
        SELECT TOP 1 * FROM dbo.Receteler WHERE ReceteId=@ReceteId AND IsActive=1`);
      if (!h.recordset.length) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Kaynak reçete bulunamadı.' });
      }
      const old = h.recordset[0];
      const d = await new sql.Request(transaction).input('ReceteId', sql.Int, id).query(`${companySql} SELECT * FROM dbo.ReceteDetay WHERE ReceteId=@ReceteId ORDER BY SiraNo,ReceteDetayId`);
      const o = await new sql.Request(transaction).input('ReceteId', sql.Int, id).query(`${companySql} SELECT * FROM dbo.ReceteIstasyon WHERE ReceteId=@ReceteId ORDER BY Sira`);

      const nextVersion = Number(old.Versiyon || 1) + 1;
      const form = {
        receteKodu: old.ReceteKodu,
        receteAdi: old.ReceteAdi,
        mamulUrunId: old.MamulUrunId,
        mamulAdi: old.MamulAdi,
        aciklama: old.Aciklama,
        versiyon: nextVersion,
        uretimBirimi: old.UretimBirimi,
        durum: 'Taslak'
      };
      const items = d.recordset.map(x => ({ hammaddeUrunId:x.HammaddeUrunId, hammaddeAdi:x.HammaddeAdi, miktar:x.Miktar, birim:x.Birim, istasyon:x.Istasyon, fireOrani:x.FireOrani, aciklama:x.Aciklama }));
      const operations = o.recordset.map(x => ({ istasyonAdi:x.IstasyonAdi, islemAdi:x.IslemAdi, tahminiSureDk:x.TahminiSureDk, iscilikDakika:x.IscilikDakika, makineDakika:x.MakineDakika, fasonMu:x.FasonMu, aciklama:x.Aciklama }));
      const newId = await saveRecipe(transaction, form, items, operations);
      await transaction.commit();
      res.json({ success:true, receteId:newId, versiyon:nextVersion, message:`Revizyon V${nextVersion} oluşturuldu.` });
    } catch (e) {
      try { await transaction.rollback(); } catch (_) {}
      res.status(500).json({ error: 'Revizyon oluşturulamadı', detail: e.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const pool = await poolPromise;
      await pool.request().input('ReceteId', sql.Int, Number(req.params.id)).query(`${companySql} UPDATE dbo.Receteler SET IsActive=0 WHERE ReceteId=@ReceteId`);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Reçete silinemedi', detail: e.message });
    }
  });

  app.use('/api/recete-yonetim', router);
};
