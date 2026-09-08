const express = require('express');

module.exports = function registerReceteRoutes(app, poolPromise, sql) {
  const router = express.Router();
  const companySql = `DECLARE @SessionCompanyId INT = TRY_CONVERT(INT, SESSION_CONTEXT(N'CompanyId')); IF @SessionCompanyId IS NULL OR @SessionCompanyId <= 0 THROW 51001, 'CompanyId context bulunamadı.', 1;`;

  router.get('/', async (req, res) => {
    try {
      const pool = await poolPromise;
      const r = await pool.request().query(`${companySql}
        SELECT r.*, u.UrunKodu AS MamulKodu
        FROM dbo.Receteler r LEFT JOIN dbo.Urunler u ON u.UrunId=r.MamulUrunId
        WHERE r.IsActive=1 ORDER BY r.MamulAdi,r.Versiyon DESC,r.ReceteId DESC`);
      res.json(r.recordset);
    } catch (e) { res.status(500).json({error:'Reçeteler alınamadı',detail:e.message}); }
  });

  router.get('/:id', async (req,res)=>{
    try {
      const pool=await poolPromise, id=Number(req.params.id);
      const h=await pool.request().input('ReceteId',sql.Int,id).query(`${companySql}
        SELECT r.*,u.UrunKodu AS MamulKodu FROM dbo.Receteler r LEFT JOIN dbo.Urunler u ON u.UrunId=r.MamulUrunId
        WHERE r.ReceteId=@ReceteId AND r.IsActive=1`);
      if(!h.recordset.length) return res.status(404).json({error:'Reçete bulunamadı'});
      const d=await pool.request().input('ReceteId',sql.Int,id).query(`${companySql}
        SELECT d.*,u.UrunKodu,u.AlisFiyati,ar.ReceteKodu AS AltReceteKodu,ar.ReceteAdi AS AltReceteAdi,ar.MamulAdi AS AltMamulAdi
        FROM dbo.ReceteDetay d LEFT JOIN dbo.Urunler u ON u.UrunId=d.HammaddeUrunId
        LEFT JOIN dbo.Receteler ar ON ar.ReceteId=d.AltReceteId AND ar.IsActive=1
        WHERE d.ReceteId=@ReceteId ORDER BY d.SiraNo,d.ReceteDetayId`);
      const o=await pool.request().input('ReceteId',sql.Int,id).query(`${companySql} SELECT * FROM dbo.ReceteIstasyon WHERE ReceteId=@ReceteId ORDER BY Sira`);
      res.json({...h.recordset[0],items:d.recordset,operations:o.recordset});
    } catch(e){res.status(500).json({error:'Reçete detayı alınamadı',detail:e.message});}
  });

  router.get('/:id/maliyet',async(req,res)=>{
    try{
      const pool=await poolPromise,id=Number(req.params.id),miktar=Math.max(0,Number(req.query.miktar||1));
      const d=await pool.request().input('ReceteId',sql.Int,id).query(`${companySql}
        SELECT d.*,ISNULL(u.AlisFiyati,0) AS AlisFiyati FROM dbo.ReceteDetay d LEFT JOIN dbo.Urunler u ON u.UrunId=d.HammaddeUrunId
        WHERE d.ReceteId=@ReceteId ORDER BY d.SiraNo,d.ReceteDetayId`);
      let material=0,service=0,transport=0,labor=0,machine=0;
      for(const x of d.recordset){
        const q=Number(x.GirdiMiktari??x.Miktar??0)*miktar*(1+Number(x.FireOrani||0)/100);
        const type=String(x.KalemTipi||'Malzeme');
        if(['Hizmet','Fason'].includes(type)||x.FasonMu) service+=Number(x.HizmetBirimFiyati||0)*q;
        else if(type==='Nakliye') transport+=Number(x.NakliyeMaliyeti||0)*miktar;
        else if(x.AltReceteId){ /* alt reçete maliyeti ağacın kökünden hesaplanır */ }
        else material+=q*Number(x.AlisFiyati||0);
        labor+=Number(x.IscilikDakika||0)*miktar*Number(x.IscilikBirimMaliyeti||0);
        machine+=Number(x.MakineDakika||0)*miktar*Number(x.MakineBirimMaliyeti||0);
      }
      const o=await pool.request().input('ReceteId',sql.Int,id).query(`${companySql}
        SELECT ISNULL(SUM(HizmetMaliyeti),0) AS HizmetMaliyeti,ISNULL(SUM(NakliyeMaliyeti),0) AS NakliyeMaliyeti,
               ISNULL(SUM(IscilikDakika),0) AS IscilikDakika,ISNULL(SUM(MakineDakika),0) AS MakineDakika,ISNULL(SUM(TahminiSureDk),0) AS TahminiSureDk
        FROM dbo.ReceteIstasyon WHERE ReceteId=@ReceteId`);
      service+=Number(o.recordset[0]?.HizmetMaliyeti||0)*miktar; transport+=Number(o.recordset[0]?.NakliyeMaliyeti||0)*miktar;
      const iscilikDakika=Number(o.recordset[0]?.IscilikDakika||0)+d.recordset.reduce((s,x)=>s+Number(x.IscilikDakika||0)*miktar,0);
      const makineDakika=Number(o.recordset[0]?.MakineDakika||0)+d.recordset.reduce((s,x)=>s+Number(x.MakineDakika||0)*miktar,0);
      const total=material+service+transport+labor+machine;
      res.json({uretimMiktari:miktar,materialCost:material,serviceCost:service,transportCost:transport,laborCost:labor,machineCost:machine,iscilikDakika,makineDakika,tahminiSureDk:Number(o.recordset[0]?.TahminiSureDk||0)*miktar,totalCost:total,unitCost:miktar?total/miktar:0});
    }catch(e){res.status(500).json({error:'Reçete maliyeti hesaplanamadı',detail:e.message});}
  });

  async function saveRecipe(transaction,form,items,operations,existingId=null){
    const request=new sql.Request(transaction)
      .input('ReceteKodu',sql.NVarChar,form.receteKodu)
      .input('ReceteAdi',sql.NVarChar,form.receteAdi||form.mamulAdi||null)
      .input('MamulUrunId',sql.Int,Number(form.mamulUrunId))
      .input('MamulAdi',sql.NVarChar,form.mamulAdi)
      .input('Aciklama',sql.NVarChar,form.aciklama||null)
      .input('Versiyon',sql.Int,Number(form.versiyon||1))
      .input('UretimBirimi',sql.NVarChar,form.uretimBirimi||'Adet')
      .input('Durum',sql.NVarChar,form.durum||'Aktif')
      .input('ReceteTipi',sql.NVarChar,form.receteTipi||'Mamul')
      .input('CiktiMiktari',sql.Decimal(18,4),Number(form.ciktiMiktari||1))
      .input('CiktiBirimi',sql.NVarChar,form.ciktiBirimi||form.uretimBirimi||'Adet')
      .input('StandartFireOrani',sql.Decimal(9,4),Number(form.standartFireOrani||0));
    let receteId;
    if(existingId){
      await request.input('ReceteId',sql.Int,existingId).query(`${companySql} UPDATE dbo.Receteler SET
        ReceteKodu=@ReceteKodu,ReceteAdi=@ReceteAdi,MamulUrunId=@MamulUrunId,MamulAdi=@MamulAdi,Aciklama=@Aciklama,Versiyon=@Versiyon,
        UretimBirimi=@UretimBirimi,Durum=@Durum,ReceteTipi=@ReceteTipi,CiktiMiktari=@CiktiMiktari,CiktiBirimi=@CiktiBirimi,StandartFireOrani=@StandartFireOrani
        WHERE ReceteId=@ReceteId`);
      receteId=existingId;
      await new sql.Request(transaction).input('ReceteId',sql.Int,receteId).query(`${companySql} DELETE FROM dbo.ReceteDetay WHERE ReceteId=@ReceteId`);
      await new sql.Request(transaction).input('ReceteId',sql.Int,receteId).query(`${companySql} DELETE FROM dbo.ReceteIstasyon WHERE ReceteId=@ReceteId`);
    }else{
      const h=await request.query(`${companySql} INSERT INTO dbo.Receteler(CompanyId,ReceteKodu,ReceteAdi,MamulUrunId,MamulAdi,Aciklama,Versiyon,UretimBirimi,Durum,ReceteTipi,CiktiMiktari,CiktiBirimi,StandartFireOrani)
        OUTPUT INSERTED.ReceteId VALUES(@SessionCompanyId,@ReceteKodu,@ReceteAdi,@MamulUrunId,@MamulAdi,@Aciklama,@Versiyon,@UretimBirimi,@Durum,@ReceteTipi,@CiktiMiktari,@CiktiBirimi,@StandartFireOrani)`);
      receteId=h.recordset[0].ReceteId;
    }
    for(let i=0;i<items.length;i++){
      const x=items[i];
      await new sql.Request(transaction)
        .input('ReceteId',sql.Int,receteId).input('HammaddeUrunId',sql.Int,Number(x.hammaddeUrunId??x.HammaddeUrunId)||null)
        .input('HammaddeAdi',sql.NVarChar,x.hammaddeAdi??x.HammaddeAdi??'').input('Miktar',sql.Decimal(18,4),Number(x.miktar??x.Miktar??x.girdiMiktari??x.GirdiMiktari??0))
        .input('Birim',sql.NVarChar,x.birim??x.Birim??x.girdiBirimi??x.GirdiBirimi??'Adet').input('Istasyon',sql.NVarChar,x.istasyon??x.Istasyon??null)
        .input('FireOrani',sql.Decimal(9,4),Number(x.fireOrani??x.FireOrani??0)).input('SiraNo',sql.Int,i+1).input('Aciklama',sql.NVarChar,x.aciklama??x.Aciklama??null)
        .input('KalemTipi',sql.NVarChar,x.kalemTipi??x.KalemTipi??'Malzeme').input('AltReceteId',sql.Int,Number(x.altReceteId??x.AltReceteId)||null)
        .input('GirdiMiktari',sql.Decimal(18,4),Number(x.girdiMiktari??x.GirdiMiktari??x.miktar??x.Miktar??0))
        .input('GirdiBirimi',sql.NVarChar,x.girdiBirimi??x.GirdiBirimi??x.birim??x.Birim??'Adet')
        .input('CiktiMiktari',sql.Decimal(18,4),Number(x.ciktiMiktari??x.CiktiMiktari)||null)
        .input('CiktiBirimi',sql.NVarChar,x.ciktiBirimi??x.CiktiBirimi??x.birim??x.Birim??null)
        .input('VerimOrani',sql.Decimal(9,4),Number(x.verimOrani??x.VerimOrani??100))
        .input('DonusumAciklama',sql.NVarChar,x.donusumAciklama??x.DonusumAciklama??null)
        .input('TedarikciCariId',sql.Int,Number(x.tedarikciCariId??x.TedarikciCariId)||null)
        .input('FasonMu',sql.Bit,!!(x.fasonMu??x.FasonMu)).input('HizmetBirimFiyati',sql.Decimal(18,4),Number(x.hizmetBirimFiyati??x.HizmetBirimFiyati??0))
        .input('NakliyeMaliyeti',sql.Decimal(18,4),Number(x.nakliyeMaliyeti??x.NakliyeMaliyeti??0)).input('IscilikDakika',sql.Decimal(18,4),Number(x.iscilikDakika??x.IscilikDakika??0))
        .input('MakineDakika',sql.Decimal(18,4),Number(x.makineDakika??x.MakineDakika??0)).input('IscilikBirimMaliyeti',sql.Decimal(18,4),Number(x.iscilikBirimMaliyeti??x.IscilikBirimMaliyeti??0))
        .input('MakineBirimMaliyeti',sql.Decimal(18,4),Number(x.makineBirimMaliyeti??x.MakineBirimMaliyeti??0)).input('Depo',sql.NVarChar,x.depo??x.Depo??null)
        .input('OperasyonSira',sql.Int,Number(x.operasyonSira??x.OperasyonSira)||null).input('IstasyonAdi',sql.NVarChar,x.istasyonAdi??x.IstasyonAdi??x.istasyon??x.Istasyon??null)
        .query(`${companySql} INSERT INTO dbo.ReceteDetay(CompanyId,ReceteId,HammaddeUrunId,HammaddeAdi,Miktar,Birim,Istasyon,FireOrani,SiraNo,Aciklama,KalemTipi,AltReceteId,GirdiMiktari,GirdiBirimi,CiktiMiktari,CiktiBirimi,VerimOrani,DonusumAciklama,TedarikciCariId,FasonMu,HizmetBirimFiyati,NakliyeMaliyeti,IscilikDakika,MakineDakika,IscilikBirimMaliyeti,MakineBirimMaliyeti,Depo,OperasyonSira,IstasyonAdi)
          VALUES(@SessionCompanyId,@ReceteId,@HammaddeUrunId,@HammaddeAdi,@Miktar,@Birim,@Istasyon,@FireOrani,@SiraNo,@Aciklama,@KalemTipi,@AltReceteId,@GirdiMiktari,@GirdiBirimi,@CiktiMiktari,@CiktiBirimi,@VerimOrani,@DonusumAciklama,@TedarikciCariId,@FasonMu,@HizmetBirimFiyati,@NakliyeMaliyeti,@IscilikDakika,@MakineDakika,@IscilikBirimMaliyeti,@MakineBirimMaliyeti,@Depo,@OperasyonSira,@IstasyonAdi)`);
    }
    for(let i=0;i<operations.length;i++){
      const x=operations[i];
      await new sql.Request(transaction).input('ReceteId',sql.Int,receteId).input('Sira',sql.Int,i+1)
        .input('IstasyonAdi',sql.NVarChar,x.istasyonAdi??x.IstasyonAdi??'').input('TahminiSureDk',sql.Decimal(18,4),Number(x.tahminiSureDk??x.TahminiSureDk??0))
        .input('IslemAdi',sql.NVarChar,x.islemAdi??x.IslemAdi??null).input('IscilikDakika',sql.Decimal(18,4),Number(x.iscilikDakika??x.IscilikDakika??0))
        .input('MakineDakika',sql.Decimal(18,4),Number(x.makineDakika??x.MakineDakika??0)).input('FasonMu',sql.Bit,!!(x.fasonMu??x.FasonMu)).input('Aciklama',sql.NVarChar,x.aciklama??x.Aciklama??null)
        .input('TedarikciCariId',sql.Int,Number(x.tedarikciCariId??x.TedarikciCariId)||null).input('HizmetMaliyeti',sql.Decimal(18,4),Number(x.hizmetMaliyeti??x.HizmetMaliyeti??0))
        .input('NakliyeMaliyeti',sql.Decimal(18,4),Number(x.nakliyeMaliyeti??x.NakliyeMaliyeti??0)).input('GirdiMiktari',sql.Decimal(18,4),Number(x.girdiMiktari??x.GirdiMiktari)||null)
        .input('CiktiMiktari',sql.Decimal(18,4),Number(x.ciktiMiktari??x.CiktiMiktari)||null).input('CiktiBirimi',sql.NVarChar,x.ciktiBirimi??x.CiktiBirimi??null).input('Depo',sql.NVarChar,x.depo??x.Depo??null)
        .query(`${companySql} INSERT INTO dbo.ReceteIstasyon(ReceteId,CompanyId,Sira,IstasyonAdi,TahminiSureDk,IslemAdi,IscilikDakika,MakineDakika,FasonMu,Aciklama,TedarikciCariId,HizmetMaliyeti,NakliyeMaliyeti,GirdiMiktari,CiktiMiktari,CiktiBirimi,Depo)
          VALUES(@ReceteId,@SessionCompanyId,@Sira,@IstasyonAdi,@TahminiSureDk,@IslemAdi,@IscilikDakika,@MakineDakika,@FasonMu,@Aciklama,@TedarikciCariId,@HizmetMaliyeti,@NakliyeMaliyeti,@GirdiMiktari,@CiktiMiktari,@CiktiBirimi,@Depo)`);
    }
    return receteId;
  }

  router.post('/',async(req,res)=>{
    const transaction=new sql.Transaction(await poolPromise);
    try{const {form,items=[],operations=[]}=req.body;if(!form?.mamulUrunId)return res.status(400).json({error:'Mamul ürün seçilmelidir.'});if(!items.length)return res.status(400).json({error:'En az bir hammadde satırı gereklidir.'});await transaction.begin();const receteId=await saveRecipe(transaction,form,items,operations);await transaction.commit();res.json({success:true,receteId,message:'Reçete oluşturuldu'});}catch(e){try{await transaction.rollback();}catch(_){}res.status(500).json({error:'Reçete kaydedilemedi',detail:e.message});}
  });

  router.put('/:id',async(req,res)=>{
    const transaction=new sql.Transaction(await poolPromise);
    try{const id=Number(req.params.id),{form,items=[],operations=[]}=req.body;if(!Number.isInteger(id)||id<=0)return res.status(400).json({error:'Geçersiz reçete.'});if(!form?.mamulUrunId)return res.status(400).json({error:'Mamul ürün seçilmelidir.'});if(!items.length)return res.status(400).json({error:'En az bir hammadde satırı gereklidir.'});await transaction.begin();const check=await new sql.Request(transaction).input('ReceteId',sql.Int,id).query(`${companySql} SELECT ReceteId FROM dbo.Receteler WHERE ReceteId=@ReceteId AND IsActive=1`);if(!check.recordset.length){await transaction.rollback();return res.status(404).json({error:'Reçete bulunamadı.'});}const receteId=await saveRecipe(transaction,form,items,operations,id);await transaction.commit();res.json({success:true,receteId,message:'Reçete güncellendi'});}catch(e){try{await transaction.rollback();}catch(_){}res.status(500).json({error:'Reçete güncellenemedi',detail:e.message});}
  });

  router.post('/:id/revizyon',async(req,res)=>{
    const transaction=new sql.Transaction(await poolPromise);
    try{
      const id=Number(req.params.id);await transaction.begin();
      const h=await new sql.Request(transaction).input('ReceteId',sql.Int,id).query(`${companySql} SELECT TOP 1 * FROM dbo.Receteler WHERE ReceteId=@ReceteId AND IsActive=1`);
      if(!h.recordset.length){await transaction.rollback();return res.status(404).json({error:'Kaynak reçete bulunamadı.'});}
      const old=h.recordset[0],d=await new sql.Request(transaction).input('ReceteId',sql.Int,id).query(`${companySql} SELECT * FROM dbo.ReceteDetay WHERE ReceteId=@ReceteId ORDER BY SiraNo,ReceteDetayId`),o=await new sql.Request(transaction).input('ReceteId',sql.Int,id).query(`${companySql} SELECT * FROM dbo.ReceteIstasyon WHERE ReceteId=@ReceteId ORDER BY Sira`);
      const nextVersion=Number(old.Versiyon||1)+1;
      const form={receteKodu:old.ReceteKodu,receteAdi:old.ReceteAdi,mamulUrunId:old.MamulUrunId,mamulAdi:old.MamulAdi,aciklama:old.Aciklama,versiyon:nextVersion,uretimBirimi:old.UretimBirimi,durum:'Taslak',receteTipi:old.ReceteTipi||'Mamul',ciktiMiktari:old.CiktiMiktari||1,ciktiBirimi:old.CiktiBirimi||old.UretimBirimi||'Adet',standartFireOrani:old.StandartFireOrani||0};
      const items=d.recordset.map(x=>({hammaddeUrunId:x.HammaddeUrunId,hammaddeAdi:x.HammaddeAdi,miktar:x.Miktar,birim:x.Birim,istasyon:x.Istasyon,fireOrani:x.FireOrani,aciklama:x.Aciklama,kalemTipi:x.KalemTipi,altReceteId:x.AltReceteId,girdiMiktari:x.GirdiMiktari,girdiBirimi:x.GirdiBirimi,ciktiMiktari:x.CiktiMiktari,ciktiBirimi:x.CiktiBirimi,verimOrani:x.VerimOrani,donusumAciklama:x.DonusumAciklama,tedarikciCariId:x.TedarikciCariId,fasonMu:x.FasonMu,hizmetBirimFiyati:x.HizmetBirimFiyati,nakliyeMaliyeti:x.NakliyeMaliyeti,iscilikDakika:x.IscilikDakika,makineDakika:x.MakineDakika,iscilikBirimMaliyeti:x.IscilikBirimMaliyeti,makineBirimMaliyeti:x.MakineBirimMaliyeti,depo:x.Depo,operasyonSira:x.OperasyonSira,istasyonAdi:x.IstasyonAdi}));
      const operations=o.recordset.map(x=>({istasyonAdi:x.IstasyonAdi,islemAdi:x.IslemAdi,tahminiSureDk:x.TahminiSureDk,iscilikDakika:x.IscilikDakika,makineDakika:x.MakineDakika,fasonMu:x.FasonMu,aciklama:x.Aciklama,tedarikciCariId:x.TedarikciCariId,hizmetMaliyeti:x.HizmetMaliyeti,nakliyeMaliyeti:x.NakliyeMaliyeti,girdiMiktari:x.GirdiMiktari,ciktiMiktari:x.CiktiMiktari,ciktiBirimi:x.CiktiBirimi,depo:x.Depo}));
      const newId=await saveRecipe(transaction,form,items,operations);await transaction.commit();res.json({success:true,receteId:newId,versiyon:nextVersion,message:`Revizyon V${nextVersion} oluşturuldu.`});
    }catch(e){try{await transaction.rollback();}catch(_){}res.status(500).json({error:'Revizyon oluşturulamadı',detail:e.message});}
  });

  router.delete('/:id',async(req,res)=>{try{const pool=await poolPromise;await pool.request().input('ReceteId',sql.Int,Number(req.params.id)).query(`${companySql} UPDATE dbo.Receteler SET IsActive=0 WHERE ReceteId=@ReceteId`);res.json({success:true});}catch(e){res.status(500).json({error:'Reçete silinemedi',detail:e.message});}});
  app.use('/api/recete-yonetim',router);
};
