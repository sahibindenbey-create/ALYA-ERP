const express = require('express');

module.exports = function registerReceteAgacRoutes(app, poolPromise, sql) {
  const router = express.Router();
  const companySql = `DECLARE @CompanyId INT = TRY_CONVERT(INT, SESSION_CONTEXT(N'CompanyId')); IF @CompanyId IS NULL OR @CompanyId <= 0 THROW 51001, 'CompanyId context bulunamadı.', 1;`;

  async function getRecipe(pool, id) {
    const h = await pool.request().input('ReceteId', sql.Int, id).query(`${companySql}
      SELECT TOP 1 r.*,u.UrunKodu AS MamulKodu FROM dbo.Receteler r
      LEFT JOIN dbo.Urunler u ON u.UrunId=r.MamulUrunId
      WHERE r.ReceteId=@ReceteId AND r.IsActive=1`);
    return h.recordset[0] || null;
  }

  async function getItems(pool, id) {
    const d = await pool.request().input('ReceteId', sql.Int, id).query(`${companySql}
      SELECT d.*,u.UrunKodu,u.AlisFiyati,
             ar.ReceteKodu AS AltReceteKodu,ar.ReceteAdi AS AltReceteAdi,ar.MamulAdi AS AltMamulAdi
      FROM dbo.ReceteDetay d
      LEFT JOIN dbo.Urunler u ON u.UrunId=d.HammaddeUrunId
      LEFT JOIN dbo.Receteler ar ON ar.ReceteId=d.AltReceteId AND ar.IsActive=1
      WHERE d.ReceteId=@ReceteId ORDER BY d.SiraNo,d.ReceteDetayId`);
    return d.recordset;
  }

  async function getOperations(pool, id) {
    const o = await pool.request().input('ReceteId', sql.Int, id).query(`${companySql}
      SELECT * FROM dbo.ReceteIstasyon WHERE ReceteId=@ReceteId ORDER BY Sira,ReceteIstasyonId`);
    return o.recordset;
  }

  router.get('/', async (req, res) => {
    try {
      const pool = await poolPromise;
      const r = await pool.request().query(`${companySql}
        SELECT r.ReceteId,r.ReceteKodu,r.ReceteAdi,r.MamulUrunId,r.MamulAdi,r.Versiyon,r.UretimBirimi,r.Durum,
               ISNULL(r.ReceteTipi,N'Mamul') AS ReceteTipi,ISNULL(r.CiktiMiktari,1) AS CiktiMiktari,
               ISNULL(r.CiktiBirimi,r.UretimBirimi) AS CiktiBirimi,r.Aciklama
        FROM dbo.Receteler r WHERE r.IsActive=1 ORDER BY r.MamulAdi,r.Versiyon DESC,r.ReceteId DESC`);
      res.json(r.recordset);
    } catch (e) { res.status(500).json({error:'Reçete ağacı alınamadı',detail:e.message}); }
  });

  router.get('/:id/agac', async (req,res) => {
    try {
      const id=Number(req.params.id);
      if(!Number.isInteger(id)||id<=0) return res.status(400).json({error:'Geçersiz reçete.'});
      const pool=await poolPromise;
      const root=await getRecipe(pool,id);
      if(!root) return res.status(404).json({error:'Reçete bulunamadı.'});
      const visiting=new Set();
      async function build(receteId,level=0){
        if(level>20) throw new Error('Reçete ağacı 20 seviyeyi aşıyor.');
        if(visiting.has(receteId)) throw new Error(`Reçete döngüsü tespit edildi: ${receteId}`);
        visiting.add(receteId);
        const recipe=await getRecipe(pool,receteId);
        const items=await getItems(pool,receteId);
        const operations=await getOperations(pool,receteId);
        const nodes=[];
        for(const x of items){
          const node={...x,level,children:[]};
          if(x.AltReceteId) node.children=await build(Number(x.AltReceteId),level+1);
          nodes.push(node);
        }
        visiting.delete(receteId);
        return nodes;
      }
      const items=await build(id,0);
      const operations=await getOperations(pool,id);
      res.json({recipe:root,items,operations});
    } catch(e) { res.status(500).json({error:'Reçete ağacı okunamadı',detail:e.message}); }
  });

  router.get('/:id/malzeme-ihtiyaci', async(req,res) => {
    try {
      const id=Number(req.params.id), miktar=Math.max(0,Number(req.query.miktar||1));
      if(!Number.isInteger(id)||id<=0||!Number.isFinite(miktar)) return res.status(400).json({error:'Geçersiz parametre.'});
      const pool=await poolPromise,result=[],visiting=new Set();
      async function walk(receteId,multiplier,level,parent){
        if(level>20) throw new Error('Reçete ağacı 20 seviyeyi aşıyor.');
        if(visiting.has(receteId)) throw new Error(`Reçete döngüsü tespit edildi: ${receteId}`);
        visiting.add(receteId);
        const rows=await getItems(pool,receteId);
        for(const x of rows){
          const girdi=Number(x.GirdiMiktari??x.Miktar??0), fire=Number(x.FireOrani||0), needed=girdi*(1+fire/100)*multiplier;
          if(x.AltReceteId) await walk(Number(x.AltReceteId),needed,level+1,{kalem:x.HammaddeAdi,receteId});
          else result.push({seviye:level,kalemTipi:x.KalemTipi||'Malzeme',urunId:x.HammaddeUrunId,urunAdi:x.HammaddeAdi,birim:x.GirdiBirimi||x.Birim,miktar:needed,fireOrani:fire,parentReceteId:parent?.receteId||null});
        }
        visiting.delete(receteId);
      }
      await walk(id,miktar,0,null);
      const grouped=new Map();
      for(const x of result){const k=`${x.urunId||x.urunAdi}|${x.birim}`;const old=grouped.get(k);if(old)old.miktar+=x.miktar;else grouped.set(k,{...x});}
      res.json({receteId:id,uretimMiktari:miktar,items:[...grouped.values()]});
    }catch(e){res.status(500).json({error:'Malzeme ihtiyacı hesaplanamadı',detail:e.message});}
  });

  router.get('/:id/maliyet',async(req,res)=>{
    try{
      const id=Number(req.params.id),miktar=Math.max(0,Number(req.query.miktar||1));
      if(!Number.isInteger(id)||id<=0||!Number.isFinite(miktar))return res.status(400).json({error:'Geçersiz parametre.'});
      const pool=await poolPromise,visiting=new Set();
      async function calc(receteId,quantity,level=0){
        if(level>20)throw new Error('Reçete ağacı 20 seviyeyi aşıyor.');
        if(visiting.has(receteId))throw new Error(`Reçete döngüsü tespit edildi: ${receteId}`);
        visiting.add(receteId);
        const rows=await getItems(pool,receteId),ops=await getOperations(pool,receteId);
        let material=0,service=0,transport=0,labor=0,machine=0;
        let iscilikDakika=0,makineDakika=0,tahminiSureDk=0;
        for(const x of rows){
          const q=Number(x.GirdiMiktari??x.Miktar??0)*quantity*(1+Number(x.FireOrani||0)/100);
          const type=String(x.KalemTipi||'Malzeme');
          if(x.AltReceteId){const sub=await calc(Number(x.AltReceteId),q,level+1);material+=sub.materialCost;service+=sub.serviceCost;transport+=sub.transportCost;labor+=sub.laborCost;machine+=sub.machineCost;iscilikDakika+=sub.iscilikDakika;makineDakika+=sub.makineDakika;tahminiSureDk+=sub.tahminiSureDk;}
          else if(['Hizmet','Fason'].includes(type)||x.FasonMu)service+=Number(x.HizmetBirimFiyati||0)*q;
          else if(type==='Nakliye')transport+=Number(x.NakliyeMaliyeti||0)*quantity;
          else material+=q*Number(x.AlisFiyati||0);
          labor+=Number(x.IscilikDakika||0)*quantity*Number(x.IscilikBirimMaliyeti||0);
          machine+=Number(x.MakineDakika||0)*quantity*Number(x.MakineBirimMaliyeti||0);
          iscilikDakika+=Number(x.IscilikDakika||0)*quantity;makineDakika+=Number(x.MakineDakika||0)*quantity;
        }
        for(const o of ops){service+=Number(o.HizmetMaliyeti||0)*quantity;transport+=Number(o.NakliyeMaliyeti||0)*quantity;iscilikDakika+=Number(o.IscilikDakika||0)*quantity;makineDakika+=Number(o.MakineDakika||0)*quantity;tahminiSureDk+=Number(o.TahminiSureDk||0)*quantity;}
        const total=material+service+transport+labor+machine;visiting.delete(receteId);
        return {materialCost:material,serviceCost:service,transportCost:transport,laborCost:labor,machineCost:machine,totalCost:total,unitCost:quantity?total/quantity:0,iscilikDakika,makineDakika,tahminiSureDk};
      }
      const c=await calc(id,miktar);
      res.json({uretimMiktari:miktar,...c});
    }catch(e){res.status(500).json({error:'Üretim maliyeti hesaplanamadı',detail:e.message});}
  });

  app.use('/api/recete-agaci',router);
  console.log('[Reçete Ağacı] API rotaları yüklendi.');
};