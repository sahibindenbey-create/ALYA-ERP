const express = require('express');

/*
 * Reçeteden gerçek üretim işlemi.
 * - Seçili şirketi SESSION_CONTEXT üzerinden zorunlu kılar.
 * - Çok seviyeli AltReceteId ağacını açar.
 * - Hammadde stoklarını kilitleyip düşer.
 * - Mamul stokunu artırır.
 * - UretimEmirleri ve StokHareketleri kaydını aynı transaction içinde oluşturur.
 * Herhangi bir adım başarısız olursa tamamı geri alınır.
 */
module.exports = function registerReceteUretimRoutes(app, poolPromise, sql) {
  const router = express.Router();
  const companySql = `DECLARE @SessionCompanyId INT = TRY_CONVERT(INT, SESSION_CONTEXT(N'CompanyId')); IF @SessionCompanyId IS NULL OR @SessionCompanyId <= 0 THROW 51001, 'CompanyId context bulunamadı.', 1;`;

  async function loadRecipe(request, receteId) {
    const h = await request.input('RecipeId', sql.Int, receteId).query(`${companySql}
      SELECT TOP 1 r.ReceteId,r.CompanyId,r.MamulUrunId,r.MamulAdi,
             ISNULL(r.CiktiMiktari,1) AS CiktiMiktari,
             ISNULL(r.StandartFireOrani,0) AS StandartFireOrani,
             r.UretimBirimi,r.CiktiBirimi
      FROM dbo.Receteler r
      WHERE r.ReceteId=@RecipeId AND r.IsActive=1 AND r.Durum=N'Aktif'`);
    if (!h.recordset.length) throw new Error(`Aktif reçete bulunamadı: ${receteId}`);

    const d = await request.input('RecipeId2', sql.Int, receteId).query(`${companySql}
      SELECT d.ReceteDetayId,d.ReceteId,d.HammaddeUrunId,d.HammaddeAdi,
             ISNULL(d.Miktar,0) AS Miktar,ISNULL(d.GirdiMiktari,d.Miktar) AS GirdiMiktari,
             ISNULL(d.CiktiMiktari,0) AS DetayCiktiMiktari,
             ISNULL(d.FireOrani,0) AS FireOrani,d.KalemTipi,d.AltReceteId,
             ISNULL(d.FasonMu,0) AS FasonMu,d.Depo,d.Birim
      FROM dbo.ReceteDetay d
      WHERE d.ReceteId=@RecipeId2
      ORDER BY d.SiraNo,d.ReceteDetayId`);
    return { ...h.recordset[0], items: d.recordset };
  }

  async function explode(request, receteId, outputQty, stack = []) {
    if (stack.includes(receteId)) {
      throw new Error(`Reçete döngüsü tespit edildi: ${[...stack, receteId].join(' -> ')}`);
    }
    const recipe = await loadRecipe(request, receteId);
    const baseOutput = Number(recipe.CiktiMiktari) || 1;
    const factor = outputQty / baseOutput;
    const requirements = new Map();

    for (const item of recipe.items) {
      const type = String(item.KalemTipi || 'Malzeme');
      if (!item.HammaddeUrunId || item.FasonMu || ['Hizmet', 'Fason', 'Nakliye'].includes(type)) continue;

      const unitQty = Number(item.GirdiMiktari || item.Miktar || 0);
      if (unitQty <= 0) continue;
      const fire = Number(item.FireOrani || 0);
      const required = unitQty * factor * (1 + fire / 100);

      if (item.AltReceteId) {
        const nested = await explode(request, Number(item.AltReceteId), required, [...stack, receteId]);
        for (const n of nested) {
          const old = requirements.get(n.UrunId) || { ...n, Miktar: 0 };
          old.Miktar += n.Miktar;
          requirements.set(n.UrunId, old);
        }
      } else {
        const old = requirements.get(item.HammaddeUrunId) || {
          UrunId: item.HammaddeUrunId,
          UrunAdi: item.HammaddeAdi,
          Birim: item.Birim,
          Depo: item.Depo || 'Merkez Depo',
          Miktar: 0
        };
        old.Miktar += required;
        requirements.set(item.HammaddeUrunId, old);
      }
    }
    return [...requirements.values()];
  }

  router.post('/:id/uret', async (req, res) => {
    const receteId = Number(req.params.id);
    const miktar = Number(req.body?.miktar ?? req.body?.UretilenMiktar);
    const notlar = req.body?.notlar ?? req.body?.Notlar ?? null;
    const depo = String(req.body?.depo ?? req.body?.Depo ?? 'Merkez Depo').trim() || 'Merkez Depo';

    if (!Number.isInteger(receteId) || receteId <= 0) return res.status(400).json({ error: 'Geçersiz reçete.' });
    if (!Number.isFinite(miktar) || miktar <= 0) return res.status(400).json({ error: 'Üretim miktarı sıfırdan büyük olmalıdır.' });

    const transaction = new sql.Transaction(await poolPromise);
    try {
      await transaction.begin();
      const request = new sql.Request(transaction);
      const recipe = await loadRecipe(request, receteId);
      const requirements = await explode(new sql.Request(transaction), receteId, miktar);

      // Önce tüm hammaddeleri kilitle ve yeterli stok olduğunu doğrula.
      const locked = [];
      for (const item of requirements) {
        const r = new sql.Request(transaction)
          .input('UrunId', sql.Int, item.UrunId);
        const stock = await r.query(`${companySql}
          SELECT TOP 1 UrunId,UrunAdi,Birim,ISNULL(StokMiktari,0) AS StokMiktari,Tur
          FROM dbo.Urunler WITH (UPDLOCK,HOLDLOCK)
          WHERE UrunId=@UrunId AND IsActive=1`);
        if (!stock.recordset.length) throw new Error(`Hammadde ürün bulunamadı: ${item.UrunId}`);
        const row = stock.recordset[0];
        if (String(row.Tur || '').toLowerCase() === 'hizmet') throw new Error(`Hizmet kartı hammadde olarak kullanılamaz: ${row.UrunAdi}`);
        const onceki = Number(row.StokMiktari || 0);
        const gereken = Number(item.Miktar || 0);
        if (onceki < gereken) throw new Error(`Yetersiz stok: ${row.UrunAdi}. Mevcut ${onceki}, gereken ${gereken}.`);
        locked.push({ ...item, UrunAdi: row.UrunAdi, Birim: row.Birim || item.Birim, OncekiStok: onceki, Gereken: gereken });
      }

      // Mamulü de kilitle; aynı anda başka üretim/stok hareketinin üzerine yazmasını önler.
      const mamulReq = new sql.Request(transaction).input('MamulUrunId', sql.Int, recipe.MamulUrunId);
      const mamulResult = await mamulReq.query(`${companySql}
        SELECT TOP 1 UrunId,UrunAdi,Birim,ISNULL(StokMiktari,0) AS StokMiktari,Tur
        FROM dbo.Urunler WITH (UPDLOCK,HOLDLOCK)
        WHERE UrunId=@MamulUrunId AND IsActive=1`);
      if (!mamulResult.recordset.length) throw new Error('Mamul ürün kartı bulunamadı veya pasif.');
      const mamul = mamulResult.recordset[0];
      if (String(mamul.Tur || '').toLowerCase() === 'hizmet') throw new Error('Hizmet kartına üretim yapılamaz.');

      const insertProduction = new sql.Request(transaction)
        .input('ReceteId', sql.Int, receteId)
        .input('MamulUrunId', sql.Int, recipe.MamulUrunId)
        .input('MamulAdi', sql.NVarChar, recipe.MamulAdi || mamul.UrunAdi)
        .input('UretilenMiktar', sql.Decimal(18, 4), miktar)
        .input('Notlar', sql.NVarChar, notlar);
      const production = await insertProduction.query(`${companySql}
        INSERT INTO dbo.UretimEmirleri (CompanyId,ReceteId,MamulUrunId,MamulAdi,UretilenMiktar,Notlar)
        OUTPUT INSERTED.UretimId
        VALUES (@SessionCompanyId,@ReceteId,@MamulUrunId,@MamulAdi,@UretilenMiktar,@Notlar)`);
      const uretimId = production.recordset[0].UretimId;

      for (const item of locked) {
        const sonraki = item.OncekiStok - item.Gereken;
        await new sql.Request(transaction)
          .input('UrunId', sql.Int, item.UrunId)
          .input('SonrakiStok', sql.Decimal(18, 4), sonraki)
          .query(`${companySql}
            UPDATE dbo.Urunler
            SET StokMiktari=@SonrakiStok,UpdatedAt=SYSDATETIME()
            WHERE UrunId=@UrunId AND IsActive=1`);

        await new sql.Request(transaction)
          .input('UrunId', sql.Int, item.UrunId)
          .input('Depo', sql.NVarChar(100), item.Depo || depo)
          .input('Miktar', sql.Decimal(18, 4), item.Gereken)
          .input('OncekiStok', sql.Decimal(18, 4), item.OncekiStok)
          .input('SonrakiStok', sql.Decimal(18, 4), sonraki)
          .input('ReferansId', sql.Int, uretimId)
          .input('Aciklama', sql.NVarChar(500), `Üretim hammadde tüketimi - Reçete ${receteId}`)
          .query(`${companySql}
            INSERT INTO dbo.StokHareketleri
              (CompanyId,UrunId,Depo,HareketTipi,Miktar,OncekiStok,SonrakiStok,ReferansTipi,ReferansId,Aciklama)
            VALUES
              (@SessionCompanyId,@UrunId,@Depo,N'Çıkış',@Miktar,@OncekiStok,@SonrakiStok,N'Üretim',@ReferansId,@Aciklama)`);
      }

      const mamulOnceki = Number(mamul.StokMiktari || 0);
      const mamulSonraki = mamulOnceki + miktar;
      await new sql.Request(transaction)
        .input('UrunId', sql.Int, recipe.MamulUrunId)
        .input('SonrakiStok', sql.Decimal(18, 4), mamulSonraki)
        .query(`${companySql}
          UPDATE dbo.Urunler SET StokMiktari=@SonrakiStok,UpdatedAt=SYSDATETIME()
          WHERE UrunId=@UrunId AND IsActive=1`);

      await new sql.Request(transaction)
        .input('UrunId', sql.Int, recipe.MamulUrunId)
        .input('Depo', sql.NVarChar(100), depo)
        .input('Miktar', sql.Decimal(18, 4), miktar)
        .input('OncekiStok', sql.Decimal(18, 4), mamulOnceki)
        .input('SonrakiStok', sql.Decimal(18, 4), mamulSonraki)
        .input('ReferansId', sql.Int, uretimId)
        .input('Aciklama', sql.NVarChar(500), `Üretim mamul girişi - Reçete ${receteId}`)
        .query(`${companySql}
          INSERT INTO dbo.StokHareketleri
            (CompanyId,UrunId,Depo,HareketTipi,Miktar,OncekiStok,SonrakiStok,ReferansTipi,ReferansId,Aciklama)
          VALUES
            (@SessionCompanyId,@UrunId,@Depo,N'Giriş',@Miktar,@OncekiStok,@SonrakiStok,N'Üretim',@ReferansId,@Aciklama)`);

      await transaction.commit();
      res.json({
        success: true,
        uretimId,
        receteId,
        mamulUrunId: recipe.MamulUrunId,
        uretilenMiktar: miktar,
        tuketilenHammaddeler: locked.map(x => ({ UrunId: x.UrunId, UrunAdi: x.UrunAdi, Miktar: x.Gereken, OncekiStok: x.OncekiStok, SonrakiStok: x.OncekiStok - x.Gereken })),
        mamulStok: { OncekiStok: mamulOnceki, SonrakiStok: mamulSonraki }
      });
    } catch (e) {
      try { await transaction.rollback(); } catch (_) {}
      console.error('[Reçete Üretim]', e);
      res.status(400).json({ error: e.message || 'Üretim gerçekleştirilemedi.' });
    }
  });

  app.use('/api/recete-uretim', router);
};
