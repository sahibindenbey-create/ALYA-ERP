const express = require('express');

module.exports = function registerReceteAgacRoutes(app, poolPromise, sql) {
  const router = express.Router();
  const companySql = `DECLARE @CompanyId INT = TRY_CONVERT(INT, SESSION_CONTEXT(N'CompanyId')); IF @CompanyId IS NULL OR @CompanyId <= 0 THROW 51001, 'CompanyId context bulunamadı.', 1;`;

  router.get('/', async (req, res) => {
    try {
      const pool = await poolPromise;
      const r = await pool.request().query(`${companySql}
        SELECT r.ReceteId, r.ReceteKodu, r.ReceteAdi, r.MamulUrunId, r.MamulAdi,
               r.Versiyon, r.UretimBirimi, r.Durum,
               ISNULL(r.ReceteTipi,N'Mamul') AS ReceteTipi,
               ISNULL(r.CiktiMiktari,1) AS CiktiMiktari,
               ISNULL(r.CiktiBirimi,r.UretimBirimi) AS CiktiBirimi,
               r.Aciklama
        FROM dbo.Receteler r
        WHERE r.IsActive=1
        ORDER BY r.MamulAdi,r.Versiyon DESC,r.ReceteId DESC`);
      res.json(r.recordset);
    } catch (e) { res.status(500).json({error:'Reçete ağacı alınamadı',detail:e.message}); }
  });

  router.get('/:id/agac', async (req,res)=>{
    try {
      const id=Number(req.params.id); if(!Number.isInteger(id)||id<=0) return res.status(400).json({error:'Geçersiz reçete.'});
      const pool=await poolPromise;
      const h=await pool.request().input('ReceteId',sql.Int,id).query(`${companySql}
        SELECT TOP 1 r.*,u.UrunKodu AS MamulKodu FROM dbo.Receteler r
        LEFT JOIN dbo.Urunler u ON u.UrunId=r.MamulUrunId
        WHERE r.ReceteId=@ReceteId AND r.IsActive=1`);
      if(!h.recordset.length) return res.status(404).json({error:'Reçete bulunamadı.'});
      const d=await pool.request().input('ReceteId',sql.Int,id).query(`${companySql}
        SELECT d.*,u.UrunKodu,u.AlisFiyati,
               ar.ReceteKodu AS AltReceteKodu,ar.ReceteAdi AS AltReceteAdi,
               ar.MamulAdi AS AltMamulAdi
        FROM dbo.ReceteDetay d
        LEFT JOIN dbo.Urunler u ON u.UrunId=d.HammaddeUrunId
        LEFT JOIN dbo.Receteler ar ON ar.ReceteId=d.AltReceteId AND ar.IsActive=1
        WHERE d.ReceteId=@ReceteId ORDER BY d.SiraNo,d.ReceteDetayId`);
      const o=await pool.request().input('ReceteId',sql.Int,id).query(`${companySql}
        SELECT * FROM dbo.ReceteIstasyon WHERE ReceteId=@ReceteId ORDER BY Sira,ReceteIstasyonId`);
      res.json({recipe:h.recordset[0],items:d.recordset,operations:o.recordset});
    }catch(e){res.status(500).json({error:'Reçete ağacı okunamadı',detail:e.message});}
  });

  router.get('/:id/malzeme-ihtiyaci', async(req,res)=>{
    try{
      const id=Number(req.params.id), miktar=Math.max(0,Number(req.query.miktar||1));
      if(!Number.isInteger(id)||id<=0||!Number.isFinite(miktar)) return res.status(400).json({error:'Geçersiz parametre.'});
      const pool=await poolPromise;
      const result=[];
      const visited=new Set();
      async function walk(receteId, multiplier, level, parent){
        if(level>20) throw new Error('Reçete ağacı 20 seviyeyi aşıyor. Döngü kontrolü gerekli.');
        if(visited.has(receteId)) throw new Error(`Reçete döngüsü tespit edildi: ${receteId}`);
        visited.add(receteId);
        const q=await pool.request().input('ReceteId',sql.Int,receteId).query(`${companySql}
          SELECT d.*,ar.ReceteKodu AS AltReceteKodu FROM dbo.ReceteDetay d
          LEFT JOIN dbo.Receteler ar ON ar.ReceteId=d.AltReceteId AND ar.IsActive=1
          WHERE d.ReceteId=@ReceteId ORDER BY d.SiraNo,d.ReceteDetayId`);
        for(const x of q.recordset){
          const girdi=Number(x.GirdiMiktari??x.Miktar??0);
          const fire=Number(x.FireOrani||0);
          const needed=girdi*(1+fire/100)*multiplier;
          if(x.AltReceteId){ await walk(Number(x.AltReceteId),needed,level+1,{kalem:x.HammaddeAdi,receteId}); }
          else result.push({seviye:level,kalemTipi:x.KalemTipi||'Malzeme',urunId:x.HammaddeUrunId,urunAdi:x.HammaddeAdi,birim:x.GirdiBirimi||x.Birim,miktar:needed,fireOrani:fire,parentReceteId:parent?.receteId||null});
        }
        visited.delete(receteId);
      }
      await walk(id,miktar,0,null);
      const grouped=new Map();
      for(const x of result){const k=`${x.urunId||'x'}|${x.birim}`; const old=grouped.get(k); if(old) old.miktar+=x.miktar; else grouped.set(k,{...x});}
      res.json({receteId:id,uretimMiktari:miktar,items:[...grouped.values()]});
    }catch(e){res.status(500).json({error:'Malzeme ihtiyacı hesaplanamadı',detail:e.message});}
  });

  router.get('/:id/maliyet',async(req,res)=>{
    try{
      const id=Number(req.params.id), miktar=Math.max(0,Number(req.query.miktar||1));
      const pool=await poolPromise;
      const d=await pool.request().input('ReceteId',sql.Int,id).query(`${companySql}
        SELECT d.*,ISNULL(u.AlisFiyati,0) AS AlisFiyati
        FROM dbo.ReceteDetay d LEFT JOIN dbo.Urunler u ON u.UrunId=d.HammaddeUrunId
        WHERE d.ReceteId=@ReceteId ORDER BY d.SiraNo,d.ReceteDetayId`);
      let material=0,service=0,transport=0,labor=0,machine=0;
      for(const x of d.recordset){const q=Number(x.GirdiMiktari??x.Miktar??0)*miktar*(1+Number(x.FireOrani||0)/100); const type=String(x.KalemTipi||'Malzeme');
        const row=q*Number(x.AlisFiyati||0);
        if(['Hizmet','Fason'].includes(type)||x.FasonMu) service+=Number(x.HizmetBirimFiyati||0)*q;
        else if(type==='Nakliye') transport+=Number(x.NakliyeMaliyeti||0)*miktar;
        else material+=row;
        labor+=Number(x.IscilikDakika||0)*miktar*Number(x.IscilikBirimMaliyeti||0);
        machine+=Number(x.MakineDakika||0)*miktar*Number(x.MakineBirimMaliyeti||0);
      }
      const o=await pool.request().input('ReceteId',sql.Int,id).query(`${companySql} SELECT ISNULL(SUM(HizmetMaliyeti),0) AS HizmetMaliyeti,ISNULL(SUM(NakliyeMaliyeti),0) AS NakliyeMaliyeti FROM dbo.ReceteIstasyon WHERE ReceteId=@ReceteId`);
      service+=Number(o.recordset[0]?.HizmetMaliyeti||0)*miktar; transport+=Number(o.recordset[0]?.NakliyeMaliyeti||0)*miktar;
      res.json({uretimMiktari:miktar,materialCost:material,serviceCost:service,transportCost:transport,laborCost:labor,machineCost:machine,totalCost:material+service+transport+labor+machine,unitCost:miktar?(material+service+transport+labor+machine)/miktar:0});
    }catch(e){res.status(500).json({error:'Üretim maliyeti hesaplanamadı',detail:e.message});}
  });

  app.use('/api/recete-agaci',router);
  console.log('[Reçete Ağacı] API rotaları yüklendi.');
};
