const express=require('express'),crypto=require('crypto');const{createAuthMiddleware,requirePermission}=require('./security');const{writeAudit,nextDocumentNumber}=require('./coreService');const fail=(res,e)=>res.status(e.statusCode||500).json({success:false,error:e.message});

// Pazaryeri siparişi tüm kalemlerinde ürün eşlemesi tamamlanınca gerçek bir
// Satış Siparişi (dbo.Siparisler) oluşturur ve PazaryeriSiparisleriV2.SiparisId
// ile bağlar. Böylece pazaryeri satışı da normal satış zincirinden
// (rezervasyon -> sevkiyat -> stok düşümü -> fatura) geçer.
// Idempotent: SiparisId zaten doluysa hiçbir şey yapmaz. Eşleşmemiş kalem
// varsa null döner (henüz dönüştürülemez).
async function convertMarketplaceOrderToSalesOrder(t, req, pazaryeriSiparisId, sql) {
  const h = await new sql.Request(t).input('C', sql.Int, req.companyId).input('H', sql.BigInt, pazaryeriSiparisId)
    .query(`SELECT TOP(1) s.*, k.KanalAdi, k.KanalKodu FROM dbo.PazaryeriSiparisleriV2 s WITH(UPDLOCK,HOLDLOCK)
            JOIN dbo.PazaryeriKanallariV2 k ON k.CompanyId=s.CompanyId AND k.KanalId=s.KanalId
            WHERE s.CompanyId=@C AND s.PazaryeriSiparisId=@H;
            SELECT x.*, u.UrunKodu RealUrunKodu, u.UrunAdi RealUrunAdi FROM dbo.PazaryeriSiparisKalemleriV2 x
            LEFT JOIN dbo.Urunler u ON u.CompanyId=x.CompanyId AND u.UrunId=x.UrunId
            WHERE x.CompanyId=@C AND x.PazaryeriSiparisId=@H;`);
  const order = h.recordsets[0][0], items = h.recordsets[1];
  if (!order) return null;
  if (order.SiparisId) return order.SiparisId; // zaten dönüştürülmüş
  if (!items.length || items.some(x => !x.UrunId)) return null; // eşleşmeyen kalem var, henüz hazır değil

  // Pazaryeri siparişlerinin bağlanacağı bir Cari'si olmalı - aksi halde
  // fatura kesme gibi Cari'ye bağımlı sonraki adımlar çalışamaz (köprü
  // kopar). Her alıcı için ayrı Cari açmak yerine (perakende/pazaryeri
  // satışlarında standart pratik), KANAL BAŞINA tek bir genel Cari
  // bulunur/oluşturulur; gerçek alıcı adı Siparişte serbest metin olarak
  // (CariAdi/MusteriAdi) tutulmaya devam eder.
  const cariKodu = `PZY-${order.KanalKodu}`.slice(0, 50);
  const cariCheck = await new sql.Request(t).input('C', sql.Int, req.companyId).input('K', sql.NVarChar, cariKodu)
    .query(`SELECT CariKodu FROM dbo.CariListesi WHERE CompanyId=@C AND CariKodu=@K;`);
  if (!cariCheck.recordset[0]) {
    await new sql.Request(t).input('C', sql.Int, req.companyId).input('K', sql.NVarChar, cariKodu)
      .input('A', sql.NVarChar, `${order.KanalAdi} Pazaryeri Müşterisi`).input('T', sql.Int, 1)
      .query(`INSERT INTO dbo.CariListesi (CompanyId, CariKodu, CariAdi, CariTipi) VALUES (@C, @K, @A, @T);`);
  }

  const kod = `PZY-${order.KanalKodu}-${order.HariciSiparisNo}`.slice(0, 100);
  const siparisResult = await new sql.Request(t)
    .input('SiparisKodu', sql.NVarChar, kod)
    .input('SiparisTarihi', sql.DateTime2, order.SiparisTarihi)
    .input('SiparisTipi', sql.NVarChar, 'Pazaryeri')
    .input('SiparisVeren', sql.NVarChar, order.KanalAdi)
    .input('CariKodu', sql.NVarChar, cariKodu)
    .input('CariAdi', sql.NVarChar, order.MusteriAdi || `${order.KanalAdi} Pazaryeri Müşterisi`)
    .input('ToplamTutar', sql.Decimal(18, 2), order.GenelToplam)
    .query(`INSERT INTO dbo.Siparisler (SiparisKodu, SiparisTarihi, SiparisTipi, SiparisVeren, CariKodu, CariAdi, ToplamTutar, Durum, OnayDurumu, RezervasyonDurumu)
            OUTPUT INSERTED.SiparisId
            VALUES (@SiparisKodu, @SiparisTarihi, @SiparisTipi, @SiparisVeren, @CariKodu, @CariAdi, @ToplamTutar, N'YENİ', N'Bekliyor', N'Yok');`);
  const siparisId = siparisResult.recordset[0].SiparisId;

  for (const it of items) {
    await new sql.Request(t)
      .input('SiparisId', sql.Int, siparisId)
      .input('UrunId', sql.Int, it.UrunId)
      .input('UrunKodu', sql.NVarChar, it.RealUrunKodu || it.HariciSku)
      .input('UrunAdi', sql.NVarChar, it.RealUrunAdi || it.UrunAdi || it.HariciSku)
      .input('Miktar', sql.Decimal(18, 2), it.Miktar)
      .input('Birim', sql.NVarChar, 'Adet')
      .input('BirimFiyatKdvDahil', sql.Decimal(18, 2), it.BirimFiyat)
      .input('SatirToplam', sql.Decimal(18, 2), it.SatirToplam)
      .query(`INSERT INTO dbo.SiparisDetay (SiparisId, UrunId, UrunKodu, UrunAdi, Miktar, Birim, BirimFiyatKdvDahil, SatirToplam)
              VALUES (@SiparisId, @UrunId, @UrunKodu, @UrunAdi, @Miktar, @Birim, @BirimFiyatKdvDahil, @SatirToplam);`);
  }

  await new sql.Request(t).input('C', sql.Int, req.companyId).input('H', sql.BigInt, pazaryeriSiparisId).input('S', sql.Int, siparisId)
    .query(`UPDATE dbo.PazaryeriSiparisleriV2 SET SiparisId=@S, ErpDurumu=N'Siparişe Aktarıldı', UpdatedAt=SYSUTCDATETIME() WHERE CompanyId=@C AND PazaryeriSiparisId=@H;`);
  await writeAudit({ poolPromise: null, sql, companyId: req.companyId, userId: req.auth.userId, actionCode: 'MARKETPLACE_ORDER_CONVERTED', entityType: 'Siparis', entityId: siparisId, after: { pazaryeriSiparisId, kod, cariKodu }, req, transaction: t });
  return siparisId;
}module.exports=function(app,poolPromise,sql){const r=express.Router();r.use(createAuthMiddleware({poolPromise,sql}));r.get('/overview',requirePermission('erp.read'),async(req,res)=>{try{const p=await poolPromise,q=await p.request().input('C',sql.Int,req.companyId).query(`SELECT * FROM dbo.PazaryeriKanallariV2 WHERE CompanyId=@C ORDER BY KanalAdi;SELECT TOP(300)s.*,k.KanalAdi,(SELECT COUNT(*) FROM dbo.PazaryeriSiparisKalemleriV2 x WHERE x.CompanyId=s.CompanyId AND x.PazaryeriSiparisId=s.PazaryeriSiparisId)KalemSayisi,(SELECT COUNT(*) FROM dbo.PazaryeriSiparisKalemleriV2 x WHERE x.CompanyId=s.CompanyId AND x.PazaryeriSiparisId=s.PazaryeriSiparisId AND x.UrunId IS NULL)EslesmeyenKalem FROM dbo.PazaryeriSiparisleriV2 s JOIN dbo.PazaryeriKanallariV2 k ON k.CompanyId=s.CompanyId AND k.KanalId=s.KanalId WHERE s.CompanyId=@C ORDER BY s.PazaryeriSiparisId DESC;SELECT TOP(200)e.*,k.KanalAdi,u.UrunKodu,u.UrunAdi FROM dbo.PazaryeriUrunEslemeleriV2 e JOIN dbo.PazaryeriKanallariV2 k ON k.CompanyId=e.CompanyId AND k.KanalId=e.KanalId JOIN dbo.Urunler u ON u.CompanyId=e.CompanyId AND u.UrunId=e.UrunId WHERE e.CompanyId=@C ORDER BY e.EslemeId DESC;SELECT TOP(100)x.*,k.KanalAdi FROM dbo.PazaryeriSenkronizasyonlariV2 x JOIN dbo.PazaryeriKanallariV2 k ON k.CompanyId=x.CompanyId AND k.KanalId=x.KanalId WHERE x.CompanyId=@C ORDER BY x.SenkronId DESC;SELECT UrunId,UrunKodu,UrunAdi FROM dbo.Urunler WHERE CompanyId=@C AND ISNULL(IsActive,1)=1 ORDER BY UrunAdi;`);res.json({channels:q.recordsets[0],orders:q.recordsets[1],mappings:q.recordsets[2],syncs:q.recordsets[3],products:q.recordsets[4]});}catch(e){fail(res,e)}});r.post('/mappings',requirePermission('erp.write'),async(req,res)=>{
  const channel=Number(req.body?.channelId),product=Number(req.body?.productId),sku=String(req.body?.externalSku||'').trim();
  if(!channel||!product||!sku)return res.status(400).json({success:false,error:'Kanal, SKU ve ürün zorunludur.'});
  const p=await poolPromise,t=new sql.Transaction(p);const converted=[];
  try{
    await t.begin();
    await new sql.Request(t).input('C',sql.Int,req.companyId).input('K',sql.BigInt,channel).input('P',sql.Int,product).input('S',sql.NVarChar(120),sku).query(`MERGE dbo.PazaryeriUrunEslemeleriV2 t USING(SELECT @C CompanyId,@K KanalId,@S HariciSku)s ON t.CompanyId=s.CompanyId AND t.KanalId=s.KanalId AND t.HariciSku=s.HariciSku WHEN MATCHED THEN UPDATE SET UrunId=@P,IsActive=1,UpdatedAt=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT(CompanyId,KanalId,HariciSku,UrunId)VALUES(@C,@K,@S,@P);UPDATE x SET UrunId=@P,EslemeDurumu=N'Eşleşti' FROM dbo.PazaryeriSiparisKalemleriV2 x JOIN dbo.PazaryeriSiparisleriV2 h ON h.CompanyId=x.CompanyId AND h.PazaryeriSiparisId=x.PazaryeriSiparisId WHERE x.CompanyId=@C AND h.KanalId=@K AND x.HariciSku=@S;`);
    const affected=await new sql.Request(t).input('C',sql.Int,req.companyId).input('K',sql.BigInt,channel).input('S',sql.NVarChar(120),sku).query(`SELECT DISTINCT h.PazaryeriSiparisId FROM dbo.PazaryeriSiparisKalemleriV2 x JOIN dbo.PazaryeriSiparisleriV2 h ON h.CompanyId=x.CompanyId AND h.PazaryeriSiparisId=x.PazaryeriSiparisId WHERE x.CompanyId=@C AND h.KanalId=@K AND x.HariciSku=@S AND h.SiparisId IS NULL;`);
    for(const row of affected.recordset){
      await new sql.Request(t).input('C',sql.Int,req.companyId).input('H',sql.BigInt,row.PazaryeriSiparisId).query(`UPDATE dbo.PazaryeriSiparisleriV2 SET ErpDurumu=CASE WHEN EXISTS(SELECT 1 FROM dbo.PazaryeriSiparisKalemleriV2 WHERE CompanyId=@C AND PazaryeriSiparisId=@H AND UrunId IS NULL)THEN N'Eşleme Bekliyor' ELSE N'Hazır' END WHERE CompanyId=@C AND PazaryeriSiparisId=@H;`);
      const sid=await convertMarketplaceOrderToSalesOrder(t,req,row.PazaryeriSiparisId,sql);
      if(sid) converted.push({pazaryeriSiparisId:row.PazaryeriSiparisId,siparisId:sid});
    }
    await t.commit();
    res.status(201).json({success:true,converted});
  }catch(e){try{await t.rollback();}catch(_){}fail(res,e);}
});
r.post('/orders/import',requirePermission('erp.write'),async(req,res)=>{const channelCode=String(req.body?.channelCode||'').toUpperCase(),external=String(req.body?.externalOrderNo||'').trim(),items=Array.isArray(req.body?.items)?req.body.items:[],p=await poolPromise,t=new sql.Transaction(p);try{if(!channelCode||!external||!items.length)return res.status(400).json({success:false,error:'Kanal, harici sipariş no ve kalemler zorunludur.'});await t.begin();const h=await new sql.Request(t).input('C',sql.Int,req.companyId).input('K',sql.NVarChar(40),channelCode).input('N',sql.NVarChar(120),external).input('M',sql.NVarChar(250),req.body?.customerName||null).input('D',sql.DateTime2,req.body?.orderDate||new Date()).input('PB',sql.NVarChar(10),req.body?.currency||'TRY').input('T',sql.Decimal(18,2),items.reduce((a,x)=>a+Number(x.quantity||0)*Number(x.unitPrice||0),0)).input('HD',sql.NVarChar(60),req.body?.externalStatus||'New').input('J',sql.NVarChar(sql.MAX),JSON.stringify(req.body)).query(`DECLARE @Channel BIGINT=(SELECT KanalId FROM dbo.PazaryeriKanallariV2 WHERE CompanyId=@C AND KanalKodu=@K AND IsActive=1);IF @Channel IS NULL THROW 52710,N'Kanal bulunamadı.',1;IF EXISTS(SELECT 1 FROM dbo.PazaryeriSiparisleriV2 WHERE CompanyId=@C AND KanalId=@Channel AND HariciSiparisNo=@N)THROW 52711,N'Bu sipariş daha önce aktarıldı.',1;INSERT dbo.PazaryeriSiparisleriV2(CompanyId,KanalId,HariciSiparisNo,MusteriAdi,SiparisTarihi,ParaBirimi,GenelToplam,HariciDurum,RawJson)OUTPUT INSERTED.PazaryeriSiparisId,INSERTED.KanalId VALUES(@C,@Channel,@N,@M,@D,@PB,@T,@HD,@J)`),id=h.recordset[0].PazaryeriSiparisId,channel=h.recordset[0].KanalId;for(const x of items){const sku=String(x.sku||'').trim(),qty=Number(x.quantity),price=Number(x.unitPrice||0);if(!sku||!(qty>0))throw Object.assign(new Error('SKU ve miktar zorunludur.'),{statusCode:400});await new sql.Request(t).input('C',sql.Int,req.companyId).input('H',sql.BigInt,id).input('K',sql.BigInt,channel).input('S',sql.NVarChar(120),sku).input('A',sql.NVarChar(250),x.productName||null).input('Q',sql.Decimal(18,4),qty).input('F',sql.Decimal(18,4),price).input('T',sql.Decimal(18,2),qty*price).query(`DECLARE @P INT=(SELECT UrunId FROM dbo.PazaryeriUrunEslemeleriV2 WHERE CompanyId=@C AND KanalId=@K AND HariciSku=@S AND IsActive=1);INSERT dbo.PazaryeriSiparisKalemleriV2(CompanyId,PazaryeriSiparisId,HariciSku,UrunId,UrunAdi,Miktar,BirimFiyat,SatirToplam,EslemeDurumu)VALUES(@C,@H,@S,@P,@A,@Q,@F,@T,CASE WHEN @P IS NULL THEN N'Bekliyor' ELSE N'Eşleşti' END)`)}await new sql.Request(t).input('C',sql.Int,req.companyId).input('H',sql.BigInt,id).query(`UPDATE dbo.PazaryeriSiparisleriV2 SET ErpDurumu=CASE WHEN EXISTS(SELECT 1 FROM dbo.PazaryeriSiparisKalemleriV2 WHERE CompanyId=@C AND PazaryeriSiparisId=@H AND UrunId IS NULL)THEN N'Eşleme Bekliyor' ELSE N'Hazır' END WHERE CompanyId=@C AND PazaryeriSiparisId=@H`);const convertedSiparisId=await convertMarketplaceOrderToSalesOrder(t,req,id,sql);await t.commit();await writeAudit({poolPromise,sql,companyId:req.companyId,userId:req.auth.userId,actionCode:'MARKETPLACE_ORDER_IMPORT',entityType:'PazaryeriSiparis',entityId:id,after:{channelCode,external,itemCount:items.length,convertedSiparisId},req});res.status(201).json({success:true,orderId:id,siparisId:convertedSiparisId});}catch(e){try{await t.rollback()}catch(_){}fail(res,e)}});r.post('/sync-jobs',requirePermission('erp.write'),async(req,res)=>{try{const channel=Number(req.body?.channelId),type=String(req.body?.type||'STOK'),key=String(req.body?.operationKey||crypto.randomUUID()).slice(0,100);const p=await poolPromise,q=await p.request().input('C',sql.Int,req.companyId).input('K',sql.BigInt,channel).input('T',sql.NVarChar(30),type).input('I',sql.NVarChar(100),key).input('U',sql.Int,req.auth.userId).query(`INSERT dbo.PazaryeriSenkronizasyonlariV2(CompanyId,KanalId,IslemTipi,IslemAnahtari,CreatedBy)OUTPUT INSERTED.SenkronId VALUES(@C,@K,@T,@I,@U)`);res.status(201).json({success:true,syncId:q.recordset[0].SenkronId});}catch(e){fail(res,e)}});app.use('/api/marketplace',r)};
module.exports.convertMarketplaceOrderToSalesOrder = convertMarketplaceOrderToSalesOrder;
module.exports.ensureMarketplaceChannel = async function ensureMarketplaceChannel(t, sql, companyId, kanalKodu, kanalAdi) {
  const q = await new sql.Request(t).input('C', sql.Int, companyId).input('K', sql.NVarChar(40), kanalKodu).input('A', sql.NVarChar(120), kanalAdi)
    .query(`MERGE dbo.PazaryeriKanallariV2 t USING(SELECT @C CompanyId,@K KanalKodu)s ON t.CompanyId=s.CompanyId AND t.KanalKodu=s.KanalKodu
            WHEN NOT MATCHED THEN INSERT(CompanyId,KanalKodu,KanalAdi) VALUES(@C,@K,@A)
            WHEN MATCHED THEN UPDATE SET IsActive=1
            OUTPUT INSERTED.KanalId;`);
  return q.recordset[0]?.KanalId;
};
