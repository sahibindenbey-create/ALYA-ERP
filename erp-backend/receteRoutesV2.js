const express = require('express');

module.exports = function registerReceteRoutes(app, poolPromise, sql) {
  const router = express.Router();

  const companySql = `
    DECLARE @CompanyId INT = TRY_CONVERT(INT, SESSION_CONTEXT(N'CompanyId'));
    IF @CompanyId IS NULL OR @CompanyId <= 0 THROW 51001, 'CompanyId context bulunamadı.', 1;
  `;

  router.get('/', async (req, res) => {
    try {
      const pool = await poolPromise;
      const result = await pool.request().query(`${companySql}
        SELECT r.*, u.UrunKodu AS MamulKodu
        FROM dbo.Receteler r
        LEFT JOIN dbo.Urunler u ON u.UrunId = r.MamulUrunId
        WHERE r.IsActive = 1
        ORDER BY r.MamulAdi, r.Versiyon DESC, r.ReceteId DESC`);
      res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: 'Reçeteler alınamadı', detail: err.message }); }
  });

  router.get('/:id', async (req, res) => {
    try {
      const pool = await poolPromise;
      const id = Number(req.params.id);
      const header = await pool.request().input('ReceteId', sql.Int, id).query(`${companySql}
        SELECT r.*, u.UrunKodu AS MamulKodu
        FROM dbo.Receteler r LEFT JOIN dbo.Urunler u ON u.UrunId = r.MamulUrunId
        WHERE r.ReceteId=@ReceteId AND r.IsActive=1`);
      if (!header.recordset.length) return res.status(404).json({ error: 'Reçete bulunamadı' });
      const items = await pool.request().input('ReceteId', sql.Int, id).query(`${companySql}
        SELECT d.*, u.UrunKodu, u.AlisFiyati
        FROM dbo.ReceteDetay d LEFT JOIN dbo.Urunler u ON u.UrunId=d.HammaddeUrunId
        WHERE d.ReceteId=@ReceteId ORDER BY d.SiraNo, d.ReceteDetayId`);
      const operations = await pool.request().input('ReceteId', sql.Int, id).query(`${companySql}
        SELECT * FROM dbo.ReceteIstasyon WHERE ReceteId=@ReceteId ORDER BY Sira`);
      res.json({ ...header.recordset[0], items: items.recordset, operations: operations.recordset });
    } catch (err) { res.status(500).json({ error: 'Reçete detayı alınamadı', detail: err.message }); }
  });

  router.get('/:id/maliyet', async (req, res) => {
    try {
      const pool = await poolPromise;
      const id = Number(req.params.id);
      const result = await pool.request().input('ReceteId', sql.Int, id).query(`${companySql}
        SELECT d.HammaddeUrunId, d.HammaddeAdi, d.Miktar, d.Birim, d.FireOrani,
               ISNULL(u.AlisFiyati,0) AS AlisFiyati,
               d.Miktar * (1 + ISNULL(d.FireOrani,0)/100.0) * ISNULL(u.AlisFiyati,0) AS SatirMaliyeti
        FROM dbo.ReceteDetay d LEFT JOIN dbo.Urunler u ON u.UrunId=d.HammaddeUrunId
        WHERE d.ReceteId=@ReceteId ORDER BY d.SiraNo, d.ReceteDetayId`);
      const items = result.recordset;
      const materialCost = items.reduce((s, x) => s + Number(x.SatirMaliyeti || 0), 0);
      const op = await pool.request().input('ReceteId', sql.Int, id).query(`${companySql}
        SELECT ISNULL(SUM(IscilikDakika),0) AS IscilikDakika, ISNULL(SUM(MakineDakika),0) AS MakineDakika
        FROM dbo.ReceteIstasyon WHERE ReceteId=@ReceteId`);
      res.json({ items, materialCost, iscilikDakika: Number(op.recordset[0]?.IscilikDakika || 0), makineDakika: Number(op.recordset[0]?.MakineDakika || 0), totalCost: materialCost });
    } catch (err) { res.status(500).json({ error: 'Reçete maliyeti hesaplanamadı', detail: err.message }); }
  });

  router.post('/', async (req, res) => {
    const transaction = new sql.Transaction(await poolPromise);
    try {
      const { form, items = [], operations = [] } = req.body;
      if (!form?.mamulUrunId) return res.status(400).json({ error: 'Mamul ürün seçilmelidir.' });
      if (!items.length) return res.status(400).json({ error: 'En az bir hammadde satırı gereklidir.' });
      await transaction.begin();
      const head = await new sql.Request(transaction)
        .input('ReceteKodu', sql.NVarChar, form.receteKodu)
        .input('ReceteAdi', sql.NVarChar, form.receteAdi || form.mamulAdi || null)
        .input('MamulUrunId', sql.Int, Number(form.mamulUrunId))
        .input('MamulAdi', sql.NVarChar, form.mamulAdi)
        .input('Aciklama', sql.NVarChar, form.aciklama || null)
        .input('Versiyon', sql.Int, Number(form.versiyon || 1))
        .input('UretimBirimi', sql.NVarChar, form.uretimBirimi || 'Adet')
        .input('Durum', sql.NVarChar, form.durum || 'Aktif')
        .query(`${companySql}
          INSERT INTO dbo.Receteler (ReceteKodu, ReceteAdi, MamulUrunId, MamulAdi, Aciklama, Versiyon, UretimBirimi, Durum)
          OUTPUT INSERTED.ReceteId VALUES (@ReceteKodu,@ReceteAdi,@MamulUrunId,@MamulAdi,@Aciklama,@Versiyon,@UretimBirimi,@Durum)`);
      const receteId = head.recordset[0].ReceteId;
      for (let i=0;i<items.length;i++) {
        const it=items[i];
        await new sql.Request(transaction)
          .input('ReceteId',sql.Int,receteId).input('HammaddeUrunId',sql.Int,Number(it.hammaddeUrunId))
          .input('HammaddeAdi',sql.NVarChar,it.hammaddeAdi).input('Miktar',sql.Decimal(18,4),Number(it.miktar))
          .input('Birim',sql.NVarChar,it.birim||'Adet').input('Istasyon',sql.NVarChar,it.istasyon||null)
          .input('FireOrani',sql.Decimal(9,4),Number(it.fireOrani||0)).input('SiraNo',sql.Int,i+1).input('Aciklama',sql.NVarChar,it.aciklama||null)
          .query(`${companySql} INSERT INTO dbo.ReceteDetay (ReceteId,HammaddeUrunId,HammaddeAdi,Miktar,Birim,Istasyon,FireOrani,SiraNo,Aciklama)
                  VALUES (@ReceteId,@HammaddeUrunId,@HammaddeAdi,@Miktar,@Birim,@Istasyon,@FireOrani,@SiraNo,@Aciklama)`);
      }
      for (let i=0;i<operations.length;i++) {
        const op=operations[i];
        await new sql.Request(transaction)
          .input('ReceteId',sql.Int,receteId).input('Sira',sql.Int,i+1).input('IstasyonAdi',sql.NVarChar,op.istasyonAdi||'')
          .input('TahminiSureDk',sql.Decimal(18,4),Number(op.tahminiSureDk||0)).input('IslemAdi',sql.NVarChar,op.islemAdi||null)
          .input('IscilikDakika',sql.Decimal(18,4),Number(op.iscilikDakika||0)).input('MakineDakika',sql.Decimal(18,4),Number(op.makineDakika||0))
          .input('FasonMu',sql.Bit,!!op.fasonMu).input('Aciklama',sql.NVarChar,op.aciklama||null)
          .query(`${companySql} INSERT INTO dbo.ReceteIstasyon (ReceteId,Sira,IstasyonAdi,TahminiSureDk,IslemAdi,IscilikDakika,MakineDakika,FasonMu,Aciklama)
                  VALUES (@ReceteId,@Sira,@IstasyonAdi,@TahminiSureDk,@IslemAdi,@IscilikDakika,@MakineDakika,@FasonMu,@Aciklama)`);
      }
      await transaction.commit();
      res.json({ success:true, receteId, message:'Reçete oluşturuldu' });
    } catch(err) { try{await transaction.rollback();}catch(e){} res.status(500).json({error:'Reçete kaydedilemedi',detail:err.message}); }
  });

  router.delete('/:id', async (req,res)=>{
    try {
      const pool=await poolPromise;
      await pool.request().input('ReceteId',sql.Int,Number(req.params.id)).query(`${companySql} UPDATE dbo.Receteler SET IsActive=0 WHERE ReceteId=@ReceteId`);
      res.json({success:true});
    } catch(err){res.status(500).json({error:'Reçete silinemedi',detail:err.message});}
  });

  app.use('/api/recete-yonetim', router);
};
