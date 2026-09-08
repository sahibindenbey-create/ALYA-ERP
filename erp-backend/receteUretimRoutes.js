const express = require('express');

module.exports = function registerReceteUretimRoutes(app, poolPromise, sql) {
  const router = express.Router();
  const companySql = `DECLARE @SessionCompanyId INT = TRY_CONVERT(INT, SESSION_CONTEXT(N'CompanyId')); IF @SessionCompanyId IS NULL OR @SessionCompanyId <= 0 THROW 51001, 'CompanyId context bulunamadı.', 1;`;

  async function recipe(request, id) {
    const h = await request.input('RecipeId', sql.Int, id).query(`${companySql}
      SELECT TOP 1 r.ReceteId,r.CompanyId,r.MamulUrunId,r.MamulAdi,
        ISNULL(r.CiktiMiktari,1) CiktiMiktari,ISNULL(r.StandartFireOrani,0) StandartFireOrani,
        r.UretimBirimi,r.CiktiBirimi
      FROM dbo.Receteler r
      WHERE r.ReceteId=@RecipeId AND r.CompanyId=@SessionCompanyId
        AND r.IsActive=1 AND r.Durum=N'Aktif'`);
    if (!h.recordset.length) throw new Error(`Aktif reçete bulunamadı: ${id}`);

    const d = await new sql.Request(request.transaction).input('RecipeId2', sql.Int, id).query(`${companySql}
      SELECT d.ReceteDetayId,d.ReceteId,d.HammaddeUrunId,d.HammaddeAdi,
        ISNULL(d.Miktar,0) Miktar,ISNULL(d.GirdiMiktari,d.Miktar) GirdiMiktari,
        ISNULL(d.FireOrani,0) FireOrani,ISNULL(d.VerimOrani,100) VerimOrani,
        d.KalemTipi,d.AltReceteId,ISNULL(d.FasonMu,0) FasonMu,d.Depo,d.Birim
      FROM dbo.ReceteDetay d
      WHERE d.ReceteId=@RecipeId2 AND d.CompanyId=@SessionCompanyId
      ORDER BY d.SiraNo,d.ReceteDetayId`);
    return { ...h.recordset[0], items:d.recordset };
  }

  async function explode(request, id, outputQty, stack=[]) {
    if (stack.includes(id)) throw new Error(`Reçete döngüsü tespit edildi: ${[...stack,id].join(' -> ')}`);
    const r = await recipe(request,id);
    const base = Number(r.CiktiMiktari)||1;
    const factor = outputQty/base;
    const recipeFire = Number(r.StandartFireOrani||0);
    if (recipeFire<0 || recipeFire>=100) throw new Error(`Reçete ${id} için geçersiz standart fire oranı.`);
    const map = new Map();
    for (const x of r.items) {
      const type=String(x.KalemTipi||'Malzeme');
      if (!x.HammaddeUrunId || x.FasonMu || ['Hizmet','Fason','Nakliye'].includes(type)) continue;
      const unit=Number(x.GirdiMiktari||x.Miktar||0); if(unit<=0) continue;
      const fire=Number(x.FireOrani||0), yieldRate=Number(x.VerimOrani??100);
      if(fire<0||fire>=100) throw new Error(`Geçersiz fire oranı: ${x.HammaddeAdi||x.HammaddeUrunId}`);
      if(yieldRate<=0||yieldRate>100) throw new Error(`Geçersiz verim oranı: ${x.HammaddeAdi||x.HammaddeUrunId}`);
      const qty=unit*factor*(100/yieldRate)*(1+fire/100)*(1+recipeFire/100);
      if(x.AltReceteId){
        const nested=await explode(request,Number(x.AltReceteId),qty,[...stack,id]);
        for(const n of nested){
          const key=`${n.UrunId}|${n.Depo||'Merkez Depo'}`;
          const old=map.get(key)||{...n,Miktar:0}; old.Miktar+=n.Miktar; map.set(key,old);
        }
      } else {
        const key=`${x.HammaddeUrunId}|${x.Depo||'Merkez Depo'}`;
        const old=map.get(key)||{UrunId:x.HammaddeUrunId,UrunAdi:x.HammaddeAdi,Birim:x.Birim,Depo:x.Depo||'Merkez Depo',Miktar:0};
        old.Miktar+=qty; map.set(key,old);
      }
    }
    return [...map.values()];
  }

  router.post('/:id/uret',async(req,res)=>{
    const receteId=Number(req.params.id), miktar=Number(req.body?.miktar??req.body?.UretilenMiktar);
    const notlar=req.body?.notlar??req.body?.Notlar??null;
    const depo=String(req.body?.depo??req.body?.Depo??'Merkez Depo').trim()||'Merkez Depo';
    const key=String(req.body?.islemAnahtari??req.body?.IslemAnahtari??'').trim();
    if(!Number.isInteger(receteId)||receteId<=0) return res.status(400).json({error:'Geçersiz reçete.'});
    if(!Number.isFinite(miktar)||miktar<=0) return res.status(400).json({error:'Üretim miktarı sıfırdan büyük olmalıdır.'});
    if(!key||key.length>100) return res.status(400).json({error:'Üretim işlem anahtarı geçersiz.'});

    const tx=new sql.Transaction(await poolPromise);
    try{
      await tx.begin();
      const request=new sql.Request(tx);
      const existing=await request.input('IslemAnahtari',sql.NVarChar(100),key).query(`${companySql}
        SELECT TOP 1 UretimId,ReceteId,MamulUrunId,UretilenMiktar
        FROM dbo.UretimEmirleri WITH(UPDLOCK,HOLDLOCK)
        WHERE CompanyId=@SessionCompanyId AND IslemAnahtari=@IslemAnahtari`);
      if(existing.recordset.length){await tx.rollback();const e=existing.recordset[0];return res.json({success:true,duplicate:true,uretimId:e.UretimId,receteId:e.ReceteId,mamulUrunId:e.MamulUrunId,uretilenMiktar:Number(e.UretilenMiktar),message:'Bu üretim isteği daha önce işlendi; stok ikinci kez değiştirilmedi.'});}

      request.transaction=tx;
      const r=await recipe(request,receteId);
      const requirements=await explode(request,receteId,miktar);
      const locked=[];
      for(const x of requirements){
        const stock=await new sql.Request(tx).input('UrunId',sql.Int,x.UrunId).query(`${companySql}
          SELECT TOP 1 UrunId,UrunAdi,Birim,ISNULL(StokMiktari,0) StokMiktari,Tur
          FROM dbo.Urunler WITH(UPDLOCK,HOLDLOCK)
          WHERE UrunId=@UrunId AND CompanyId=@SessionCompanyId AND IsActive=1`);
        if(!stock.recordset.length) throw new Error(`Hammadde ürün bulunamadı: ${x.UrunId}`);
        const u=stock.recordset[0], onceki=Number(u.StokMiktari||0), gereken=Number(x.Miktar||0);
        if(String(u.Tur||'').toLowerCase()==='hizmet') throw new Error(`Hizmet kartı hammadde olarak kullanılamaz: ${u.UrunAdi}`);
        if(gereken>onceki) throw new Error(`Yetersiz stok: ${u.UrunAdi}. Mevcut ${onceki}, gereken ${gereken}.`);
        locked.push({...x,UrunAdi:u.UrunAdi,Birim:u.Birim||x.Birim,OncekiStok:onceki,Gereken:gereken});
      }

      const mr=await new sql.Request(tx).input('MamulUrunId',sql.Int,r.MamulUrunId).query(`${companySql}
        SELECT TOP 1 UrunId,UrunAdi,Birim,ISNULL(StokMiktari,0) StokMiktari,Tur
        FROM dbo.Urunler WITH(UPDLOCK,HOLDLOCK)
        WHERE UrunId=@MamulUrunId AND CompanyId=@SessionCompanyId AND IsActive=1`);
      if(!mr.recordset.length) throw new Error('Mamul ürün kartı bulunamadı veya pasif.');
      const mamul=mr.recordset[0];
      if(String(mamul.Tur||'').toLowerCase()==='hizmet') throw new Error('Hizmet kartına üretim yapılamaz.');

      const p=await new sql.Request(tx)
        .input('ReceteId',sql.Int,receteId).input('MamulUrunId',sql.Int,r.MamulUrunId)
        .input('MamulAdi',sql.NVarChar,r.MamulAdi||mamul.UrunAdi).input('UretilenMiktar',sql.Decimal(18,4),miktar)
        .input('Notlar',sql.NVarChar,notlar).input('IslemAnahtari',sql.NVarChar(100),key)
        .query(`${companySql}
          INSERT INTO dbo.UretimEmirleri(CompanyId,ReceteId,MamulUrunId,MamulAdi,UretilenMiktar,Notlar,IslemAnahtari)
          OUTPUT INSERTED.UretimId VALUES(@SessionCompanyId,@ReceteId,@MamulUrunId,@MamulAdi,@UretilenMiktar,@Notlar,@IslemAnahtari)`);
      const uretimId=p.recordset[0].UretimId;

      for(const x of locked){
        const sonraki=x.OncekiStok-x.Gereken;
        await new sql.Request(tx).input('UrunId',sql.Int,x.UrunId).input('Stok',sql.Decimal(18,4),sonraki).query(`${companySql}
          UPDATE dbo.Urunler SET StokMiktari=@Stok,UpdatedAt=SYSDATETIME() WHERE UrunId=@UrunId AND CompanyId=@SessionCompanyId AND IsActive=1`);
        await new sql.Request(tx).input('UrunId',sql.Int,x.UrunId).input('Depo',sql.NVarChar(100),x.Depo||depo).input('Miktar',sql.Decimal(18,4),x.Gereken).input('Onceki',sql.Decimal(18,4),x.OncekiStok).input('Sonraki',sql.Decimal(18,4),sonraki).input('RefId',sql.Int,uretimId).query(`${companySql}
          INSERT INTO dbo.StokHareketleri(CompanyId,UrunId,Depo,HareketTipi,Miktar,OncekiStok,SonrakiStok,ReferansTipi,ReferansId,Aciklama)
          VALUES(@SessionCompanyId,@UrunId,@Depo,N'Çıkış',@Miktar,@Onceki,@Sonraki,N'Üretim',@RefId,@Aciklama)`);
      }

      const mo=Number(mamul.StokMiktari||0), ms=mo+miktar;
      await new sql.Request(tx).input('UrunId',sql.Int,r.MamulUrunId).input('Stok',sql.Decimal(18,4),ms).query(`${companySql}
        UPDATE dbo.Urunler SET StokMiktari=@Stok,UpdatedAt=SYSDATETIME() WHERE UrunId=@UrunId AND CompanyId=@SessionCompanyId AND IsActive=1`);
      await new sql.Request(tx).input('UrunId',sql.Int,r.MamulUrunId).input('Depo',sql.NVarChar(100),depo).input('Miktar',sql.Decimal(18,4),miktar).input('Onceki',sql.Decimal(18,4),mo).input('Sonraki',sql.Decimal(18,4),ms).input('RefId',sql.Int,uretimId).query(`${companySql}
        INSERT INTO dbo.StokHareketleri(CompanyId,UrunId,Depo,HareketTipi,Miktar,OncekiStok,SonrakiStok,ReferansTipi,ReferansId,Aciklama)
        VALUES(@SessionCompanyId,@UrunId,@Depo,N'Giriş',@Miktar,@Onceki,@Sonraki,N'Üretim',@RefId,@Aciklama)`);
      await tx.commit();
      res.json({success:true,duplicate:false,uretimId,receteId,mamulUrunId:r.MamulUrunId,uretilenMiktar:miktar,depo,tuketilenHammaddeler:locked.map(x=>({UrunId:x.UrunId,UrunAdi:x.UrunAdi,Depo:x.Depo||depo,Miktar:x.Gereken,OncekiStok:x.OncekiStok,SonrakiStok:x.OncekiStok-x.Gereken})),mamulStok:{OncekiStok:mo,SonrakiStok:ms}});
    }catch(e){try{await tx.rollback();}catch(_){}console.error('[Reçete Üretim]',e);res.status(400).json({error:e.message||'Üretim gerçekleştirilemedi.'});}
  });
  app.use('/api/recete-uretim',router);
};
