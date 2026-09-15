const { storage } = require('./company-context-hook');
const { nextDocumentNumber } = require('./core/coreService');

function install({ app, poolPromise, sql }) {
  if (app.__alyaStokV2Installed) return;
  app.__alyaStokV2Installed = true;

  const company = req => Number(storage.getStore()?.companyId || req.headers['x-company-id'] || 1);
  const fail = (res, error, status = 500) => res.status(status).json({ success: false, error: error.message || String(error) });

  app.get('/api/stok/v2/overview', async (req, res) => {
    try {
      const pool = await poolPromise;
      const request = pool.request();
      if (req.query.depoId) request.input('DepoId', sql.Int, Number(req.query.depoId));
      const result = await request.query(`
        SELECT b.StokBakiyeId,b.CompanyId,b.UrunId,u.UrunKodu,u.UrunAdi,u.Birim,
               b.DepoId,d.DepoKodu,d.DepoAdi,b.LokasyonId,l.LokasyonKodu,l.LokasyonAdi,
               b.Miktar,b.RezerveMiktar,b.BlokeMiktar,
               CAST(b.Miktar-b.RezerveMiktar-b.BlokeMiktar AS DECIMAL(18,4)) KullanilabilirStok,
               COALESCE(p.YenidenSiparisNoktasi,b.YenidenSiparisNoktasi,0) YenidenSiparisNoktasi,
               COALESCE(p.MinimumStok,b.MinimumStok,0) MinimumStok,
               p.MaksimumStok,
               CASE WHEN b.Miktar-b.RezerveMiktar-b.BlokeMiktar<=COALESCE(p.YenidenSiparisNoktasi,b.YenidenSiparisNoktasi,0) THEN 1 ELSE 0 END Kritik
        FROM dbo.StokBakiyeleri b
        INNER JOIN dbo.Urunler u ON u.CompanyId=b.CompanyId AND u.UrunId=b.UrunId
        INNER JOIN dbo.Depolar d ON d.CompanyId=b.CompanyId AND d.DepoId=b.DepoId
        INNER JOIN dbo.DepoLokasyonlari l ON l.CompanyId=b.CompanyId AND l.LokasyonId=b.LokasyonId
        LEFT JOIN dbo.StokPolitikalariV2 p ON p.CompanyId=b.CompanyId AND p.UrunId=b.UrunId AND p.IsActive=1
        WHERE b.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId'))
          AND (@DepoId IS NULL OR b.DepoId=@DepoId)
        ORDER BY u.UrunKodu,d.DepoKodu,l.LokasyonKodu;

        SELECT DepoId,DepoKodu,DepoAdi,DepoTipi,IsActive FROM dbo.Depolar
        WHERE CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND IsActive=1 ORDER BY DepoKodu;

        SELECT LokasyonId,DepoId,LokasyonKodu,LokasyonAdi,RafKodu,Koridor,IsPickable,IsActive FROM dbo.DepoLokasyonlari
        WHERE CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND IsActive=1 ORDER BY DepoId,LokasyonKodu;

        SELECT TOP (500) h.StokHareketId,h.UrunId,u.UrunKodu,u.UrunAdi,u.Birim,h.DepoId,d.DepoAdi,h.LokasyonId,l.LokasyonAdi,
               h.HareketTipi,h.Miktar,h.OncekiStok,h.SonrakiStok,h.ReferansTipi,h.ReferansId,h.Aciklama,
               COALESCE(h.IslemTarihi,h.CreatedAt) IslemTarihi
        FROM dbo.StokHareketleri h
        INNER JOIN dbo.Urunler u ON u.CompanyId=h.CompanyId AND u.UrunId=h.UrunId
        LEFT JOIN dbo.Depolar d ON d.CompanyId=h.CompanyId AND d.DepoId=h.DepoId
        LEFT JOIN dbo.DepoLokasyonlari l ON l.CompanyId=h.CompanyId AND l.LokasyonId=h.LokasyonId
        WHERE h.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId'))
        ORDER BY COALESCE(h.IslemTarihi,h.CreatedAt) DESC,h.StokHareketId DESC;
      `);
      res.json({ balances: result.recordsets[0] || [], warehouses: result.recordsets[1] || [], locations: result.recordsets[2] || [], movements: result.recordsets[3] || [] });
    } catch (error) { fail(res, error); }
  });

  app.post('/api/stok/v2/movement', async (req, res) => {
    const b=req.body||{};
    const productId=Number(b.productId),warehouseId=Number(b.warehouseId),locationId=Number(b.locationId),quantity=Number(b.quantity),type=String(b.type||'');
    if(!Number.isInteger(productId)||!Number.isInteger(warehouseId)||!Number.isInteger(locationId)||!Number.isFinite(quantity)||quantity<=0||!['IN','OUT','ADJUST'].includes(type)) return fail(res,new Error('Ürün, depo, lokasyon, işlem tipi ve pozitif miktar zorunludur.'),400);
    const transaction=new sql.Transaction(await poolPromise);
    try{
      await transaction.begin();
      const q=new sql.Request(transaction).input('UrunId',sql.Int,productId).input('DepoId',sql.Int,warehouseId).input('LokasyonId',sql.Int,locationId);
      const row=(await q.query(`SELECT TOP(1) b.*,u.UrunAdi,u.Birim,d.DepoAdi FROM dbo.StokBakiyeleri b WITH(UPDLOCK,HOLDLOCK) JOIN dbo.Urunler u ON u.UrunId=b.UrunId AND u.CompanyId=b.CompanyId JOIN dbo.Depolar d ON d.DepoId=b.DepoId AND d.CompanyId=b.CompanyId WHERE b.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND b.UrunId=@UrunId AND b.DepoId=@DepoId AND b.LokasyonId=@LokasyonId AND b.LotNo=N'' AND b.SeriNo=N''`)).recordset[0];
      if(!row) throw new Error('Seçilen ürün/depo/lokasyon için stok bakiyesi bulunamadı.');
      const before=Number(row.Miktar), after=type==='IN'?before+quantity:type==='OUT'?before-quantity:Number(b.newQuantity);
      if(!Number.isFinite(after)||after<0) throw new Error('İşlem sonrası stok negatif olamaz.');
      if(after<Number(row.RezerveMiktar)+Number(row.BlokeMiktar)) throw new Error('Rezerve veya bloke stok fiziksel stoktan fazla olamaz.');
      const u=new sql.Request(transaction).input('StokBakiyeId',sql.BigInt,row.StokBakiyeId).input('Miktar',sql.Decimal(18,4),after);
      await u.query(`UPDATE dbo.StokBakiyeleri SET Miktar=@Miktar,UpdatedAt=SYSUTCDATETIME() WHERE StokBakiyeId=@StokBakiyeId`);
      const hareketTipi=type==='IN'?'Giriş':type==='OUT'?'Çıkış':'Düzeltme';
      const h=new sql.Request(transaction).input('UrunId',sql.Int,productId).input('DepoId',sql.Int,warehouseId).input('LokasyonId',sql.Int,locationId).input('Depo',sql.NVarChar(100),row.DepoAdi).input('HareketTipi',sql.NVarChar(20),hareketTipi).input('Miktar',sql.Decimal(18,4),quantity).input('OncekiStok',sql.Decimal(18,4),before).input('SonrakiStok',sql.Decimal(18,4),after).input('ReferansTipi',sql.NVarChar(50),b.referenceType||null).input('ReferansId',sql.Int,/^\d+$/.test(String(b.referenceId||''))?Number(b.referenceId):null).input('Aciklama',sql.NVarChar(500),b.note||null);
      const hr=await h.query(`INSERT dbo.StokHareketleri(CompanyId,UrunId,Depo,DepoId,LokasyonId,HareketTipi,Miktar,OncekiStok,SonrakiStok,ReferansTipi,ReferansId,Aciklama,IslemTarihi) VALUES(TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')),@UrunId,@Depo,@DepoId,@LokasyonId,@HareketTipi,@Miktar,@OncekiStok,@SonrakiStok,@ReferansTipi,@ReferansId,@Aciklama,SYSUTCDATETIME()); SELECT SCOPE_IDENTITY() StokHareketId;`);
      await transaction.commit();
      res.json({success:true,StokHareketId:hr.recordset[0].StokHareketId,OncekiStok:before,SonrakiStok:after});
    }catch(error){try{await transaction.rollback();}catch(_){} fail(res,error,error.message.includes('bulunamadı')?404:400);}
  });

  app.post('/api/stok/v2/reservations', async (req,res)=>{
    const b=req.body||{}; const productId=Number(b.productId),warehouseId=Number(b.warehouseId),locationId=Number(b.locationId),quantity=Number(b.quantity);
    if(!Number.isInteger(productId)||!Number.isInteger(warehouseId)||!Number.isInteger(locationId)||!Number.isFinite(quantity)||quantity<=0||!b.referenceType||!b.referenceId) return fail(res,new Error('Ürün, depo, lokasyon, miktar ve referans zorunludur.'),400);
    const tx=new sql.Transaction(await poolPromise);
    try{await tx.begin();
      const r=await new sql.Request(tx).input('UrunId',sql.Int,productId).input('DepoId',sql.Int,warehouseId).input('LokasyonId',sql.Int,locationId).query(`SELECT TOP(1) b.* FROM dbo.StokBakiyeleri b WITH(UPDLOCK,HOLDLOCK) WHERE b.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND b.UrunId=@UrunId AND b.DepoId=@DepoId AND b.LokasyonId=@LokasyonId AND b.LotNo=N'' AND b.SeriNo=N''`);
      const row=r.recordset[0]; if(!row) throw new Error('Stok bakiyesi bulunamadı.');
      const available=Number(row.Miktar)-Number(row.RezerveMiktar)-Number(row.BlokeMiktar); if(quantity>available) throw new Error(`Yetersiz kullanılabilir stok. Mevcut: ${available}`);
      const exists=await new sql.Request(tx).input('ReferansTipi',sql.NVarChar(40),String(b.referenceType)).input('ReferansId',sql.NVarChar(120),String(b.referenceId)).input('UrunId',sql.Int,productId).input('DepoId',sql.Int,warehouseId).input('LokasyonId',sql.Int,locationId).query(`SELECT RezervasyonId FROM dbo.StokRezervasyonlari WHERE CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND ReferansTipi=@ReferansTipi AND ReferansId=@ReferansId AND UrunId=@UrunId AND DepoId=@DepoId AND LokasyonId=@LokasyonId AND Durum=N'ACTIVE'`);
      if(exists.recordset[0]) throw new Error('Bu referans için aktif rezervasyon zaten mevcut.');
      await new sql.Request(tx).input('Id',sql.BigInt,row.StokBakiyeId).input('Q',sql.Decimal(18,4),quantity).query(`UPDATE dbo.StokBakiyeleri SET RezerveMiktar=RezerveMiktar+@Q,UpdatedAt=SYSUTCDATETIME() WHERE StokBakiyeId=@Id`);
      const ins=new sql.Request(tx).input('UrunId',sql.Int,productId).input('DepoId',sql.Int,warehouseId).input('LokasyonId',sql.Int,locationId).input('ReferansTipi',sql.NVarChar(40),String(b.referenceType)).input('ReferansId',sql.NVarChar(120),String(b.referenceId)).input('Miktar',sql.Decimal(18,4),quantity);
      const rr=await ins.query(`INSERT dbo.StokRezervasyonlari(CompanyId,UrunId,DepoId,LokasyonId,ReferansTipi,ReferansId,Miktar) VALUES(TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')),@UrunId,@DepoId,@LokasyonId,@ReferansTipi,@ReferansId,@Miktar); SELECT SCOPE_IDENTITY() RezervasyonId;`);
      await tx.commit(); res.json({success:true,RezervasyonId:rr.recordset[0].RezervasyonId});
    }catch(error){try{await tx.rollback();}catch(_){} fail(res,error,error.message.includes('Yetersiz')?409:400);}
  });

  app.get('/api/stok/v2/operations', async(req,res)=>{try{const pool=await poolPromise;const r=await pool.request().query(`SELECT TOP(500) z.RezervasyonId,z.ReferansTipi,z.ReferansId,z.Miktar,z.KarsilananMiktar,z.Durum,z.UrunId,u.UrunAdi,u.UrunKodu,z.DepoId,d.DepoAdi,z.LokasyonId,l.LokasyonAdi FROM dbo.StokRezervasyonlari z JOIN dbo.Urunler u ON u.CompanyId=z.CompanyId AND u.UrunId=z.UrunId JOIN dbo.Depolar d ON d.CompanyId=z.CompanyId AND d.DepoId=z.DepoId JOIN dbo.DepoLokasyonlari l ON l.CompanyId=z.CompanyId AND l.LokasyonId=z.LokasyonId WHERE z.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND z.Durum=N'ACTIVE' ORDER BY z.RezervasyonId DESC;
SELECT TOP(200) t.TransferId,t.TransferNo,t.KaynakDepoId,sd.DepoAdi KaynakDepoAdi,t.HedefDepoId,td.DepoAdi HedefDepoAdi,t.Durum,t.TransferTarihi,t.Aciklama FROM dbo.StokTransferleri t JOIN dbo.Depolar sd ON sd.DepoId=t.KaynakDepoId AND sd.CompanyId=t.CompanyId JOIN dbo.Depolar td ON td.DepoId=t.HedefDepoId AND td.CompanyId=t.CompanyId WHERE t.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) ORDER BY t.TransferId DESC;
SELECT TOP(200) s.SayimId,s.SayimNo,s.DepoId,d.DepoAdi,s.Durum,s.SayimTarihi,s.Aciklama FROM dbo.StokSayimFisleri s JOIN dbo.Depolar d ON d.DepoId=s.DepoId AND d.CompanyId=s.CompanyId WHERE s.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) ORDER BY s.SayimId DESC;`);res.json({reservations:r.recordsets[0]||[],transfers:r.recordsets[1]||[],counts:r.recordsets[2]||[]});}catch(error){fail(res,error);}});

  app.post('/api/stok/v2/operations/transfers', async(req,res)=>{
    const b=req.body||{},productId=Number(b.productId),sourceWarehouseId=Number(b.sourceWarehouseId),targetWarehouseId=Number(b.targetWarehouseId),sourceLocationId=Number(b.sourceLocationId),targetLocationId=Number(b.targetLocationId),quantity=Number(b.quantity);
    if(![productId,sourceWarehouseId,targetWarehouseId,sourceLocationId,targetLocationId].every(Number.isInteger)||sourceWarehouseId===targetWarehouseId||!Number.isFinite(quantity)||quantity<=0) return fail(res,new Error('Transfer bilgileri geçersiz.'),400);
    const tx=new sql.Transaction(await poolPromise);
    try{await tx.begin();
      const src=(await new sql.Request(tx).input('UrunId',sql.Int,productId).input('DepoId',sql.Int,sourceWarehouseId).input('LokasyonId',sql.Int,sourceLocationId).query(`SELECT TOP(1) b.* FROM dbo.StokBakiyeleri b WITH(UPDLOCK,HOLDLOCK) WHERE b.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND b.UrunId=@UrunId AND b.DepoId=@DepoId AND b.LokasyonId=@LokasyonId AND b.LotNo=N'' AND b.SeriNo=N''`)).recordset[0];
      if(!src) throw new Error('Kaynak stok bakiyesi bulunamadı.'); const available=Number(src.Miktar)-Number(src.RezerveMiktar)-Number(src.BlokeMiktar); if(quantity>available) throw new Error(`Yetersiz kullanılabilir stok. Mevcut: ${available}`);
      const validLoc=await new sql.Request(tx).input('DepoId',sql.Int,targetWarehouseId).input('LokasyonId',sql.Int,targetLocationId).query(`SELECT TOP(1) LokasyonId FROM dbo.DepoLokasyonlari WHERE CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND DepoId=@DepoId AND LokasyonId=@LokasyonId AND IsActive=1`); if(!validLoc.recordset[0]) throw new Error('Hedef lokasyon seçilen depoya ait değil.');
      let dst=(await new sql.Request(tx).input('UrunId',sql.Int,productId).input('DepoId',sql.Int,targetWarehouseId).input('LokasyonId',sql.Int,targetLocationId).query(`SELECT TOP(1) b.* FROM dbo.StokBakiyeleri b WITH(UPDLOCK,HOLDLOCK) WHERE b.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND b.UrunId=@UrunId AND b.DepoId=@DepoId AND b.LokasyonId=@LokasyonId AND b.LotNo=N'' AND b.SeriNo=N''`)).recordset[0];
      if(!dst){const ir=await new sql.Request(tx).input('UrunId',sql.Int,productId).input('DepoId',sql.Int,targetWarehouseId).input('LokasyonId',sql.Int,targetLocationId).query(`INSERT dbo.StokBakiyeleri(CompanyId,UrunId,DepoId,LokasyonId,Miktar) VALUES(TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')),@UrunId,@DepoId,@LokasyonId,0); SELECT SCOPE_IDENTITY() StokBakiyeId;`);dst={StokBakiyeId:ir.recordset[0].StokBakiyeId,Miktar:0,RezerveMiktar:0,BlokeMiktar:0};}
      const no=await nextDocumentNumber({poolPromise,sql,companyId:company(req),documentType:'STOK_TRANSFER',transaction:tx});
      const tr=await new sql.Request(tx).input('TransferNo',sql.NVarChar(64),no).input('KaynakDepoId',sql.Int,sourceWarehouseId).input('HedefDepoId',sql.Int,targetWarehouseId).input('Aciklama',sql.NVarChar(500),b.note||null).query(`INSERT dbo.StokTransferleri(CompanyId,TransferNo,KaynakDepoId,HedefDepoId,Durum,TransferTarihi,Aciklama) VALUES(TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')),@TransferNo,@KaynakDepoId,@HedefDepoId,N'Tamamlandı',SYSUTCDATETIME(),@Aciklama); SELECT SCOPE_IDENTITY() TransferId;`);
      await new sql.Request(tx).input('TransferId',sql.BigInt,tr.recordset[0].TransferId).input('UrunId',sql.Int,productId).input('KaynakLokasyonId',sql.Int,sourceLocationId).input('HedefLokasyonId',sql.Int,targetLocationId).input('Miktar',sql.Decimal(18,4),quantity).query(`INSERT dbo.StokTransferKalemleri(TransferId,UrunId,KaynakLokasyonId,HedefLokasyonId,Miktar) VALUES(@TransferId,@UrunId,@KaynakLokasyonId,@HedefLokasyonId,@Miktar)`);
      await new sql.Request(tx).input('Id',sql.BigInt,src.StokBakiyeId).input('Q',sql.Decimal(18,4),quantity).query(`UPDATE dbo.StokBakiyeleri SET Miktar=Miktar-@Q,UpdatedAt=SYSUTCDATETIME() WHERE StokBakiyeId=@Id`);
      await new sql.Request(tx).input('Id',sql.BigInt,dst.StokBakiyeId).input('Q',sql.Decimal(18,4),quantity).query(`UPDATE dbo.StokBakiyeleri SET Miktar=Miktar+@Q,UpdatedAt=SYSUTCDATETIME() WHERE StokBakiyeId=@Id`);
      await tx.commit();res.json({success:true,TransferId:tr.recordset[0].TransferId,TransferNo:no});
    }catch(error){try{await tx.rollback();}catch(_){}fail(res,error,error.message.includes('Yetersiz')?409:400);}
  });

  app.post('/api/stok/v2/operations/counts', async(req,res)=>{
    const b=req.body||{},productId=Number(b.productId),warehouseId=Number(b.warehouseId),locationId=Number(b.locationId),counted=Number(b.countedQuantity);
    if(![productId,warehouseId,locationId].every(Number.isInteger)||!Number.isFinite(counted)||counted<0)return fail(res,new Error('Sayım bilgileri geçersiz.'),400);
    const tx=new sql.Transaction(await poolPromise);try{await tx.begin();
      const row=(await new sql.Request(tx).input('UrunId',sql.Int,productId).input('DepoId',sql.Int,warehouseId).input('LokasyonId',sql.Int,locationId).query(`SELECT TOP(1) b.* FROM dbo.StokBakiyeleri b WITH(UPDLOCK,HOLDLOCK) WHERE b.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND b.UrunId=@UrunId AND b.DepoId=@DepoId AND b.LokasyonId=@LokasyonId AND b.LotNo=N'' AND b.SeriNo=N''`)).recordset[0];if(!row)throw new Error('Stok bakiyesi bulunamadı.');
      if(counted<Number(row.RezerveMiktar)+Number(row.BlokeMiktar))throw new Error('Sayım miktarı rezerve/bloke stoktan düşük olamaz.');
      const no=await nextDocumentNumber({poolPromise,sql,companyId:company(req),documentType:'STOK_SAYIM',transaction:tx});
      const f=await new sql.Request(tx).input('SayimNo',sql.NVarChar(64),no).input('DepoId',sql.Int,warehouseId).input('Aciklama',sql.NVarChar(500),b.note||null).query(`INSERT dbo.StokSayimFisleri(CompanyId,SayimNo,DepoId,Durum,SayimTarihi,Aciklama) VALUES(TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')),@SayimNo,@DepoId,N'Tamamlandı',SYSUTCDATETIME(),@Aciklama);SELECT SCOPE_IDENTITY() SayimId;`);
      await new sql.Request(tx).input('SayimId',sql.BigInt,f.recordset[0].SayimId).input('UrunId',sql.Int,productId).input('LokasyonId',sql.Int,locationId).input('Sistem',sql.Decimal(18,4),row.Miktar).input('Sayilan',sql.Decimal(18,4),counted).query(`INSERT dbo.StokSayimKalemleri(SayimId,UrunId,LokasyonId,SistemMiktari,SayilanMiktar) VALUES(@SayimId,@UrunId,@LokasyonId,@Sistem,@Sayilan)`);
      await new sql.Request(tx).input('Id',sql.BigInt,row.StokBakiyeId).input('Miktar',sql.Decimal(18,4),counted).query(`UPDATE dbo.StokBakiyeleri SET Miktar=@Miktar,UpdatedAt=SYSUTCDATETIME() WHERE StokBakiyeId=@Id`);
      const h=new sql.Request(tx).input('UrunId',sql.Int,productId).input('DepoId',sql.Int,warehouseId).input('LokasyonId',sql.Int,locationId).input('Depo',sql.NVarChar(100),'').input('Miktar',sql.Decimal(18,4),Math.abs(counted-Number(row.Miktar))).input('Onceki',sql.Decimal(18,4),row.Miktar).input('Sonraki',sql.Decimal(18,4),counted).input('RefId',sql.Int,Number(f.recordset[0].SayimId));
      await h.query(`INSERT dbo.StokHareketleri(CompanyId,UrunId,Depo,DepoId,LokasyonId,HareketTipi,Miktar,OncekiStok,SonrakiStok,ReferansTipi,ReferansId,Aciklama,IslemTarihi) VALUES(TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')),@UrunId,@Depo,@DepoId,@LokasyonId,N'Sayım',CASE WHEN @Miktar=0 THEN CAST(0.0001 AS DECIMAL(18,4)) ELSE @Miktar END,@Onceki,@Sonraki,N'STOK_SAYIM',@RefId,@Aciklama,SYSUTCDATETIME())`);
      await tx.commit();res.json({success:true,SayimId:f.recordset[0].SayimId,SayimNo:no});
    }catch(error){try{await tx.rollback();}catch(_){}fail(res,error,400);}
  });

  app.put('/api/stok/v2/operations/policies', async(req,res)=>{const b=req.body||{},productId=Number(b.productId),minimum=Number(b.minimum||0),reorder=Number(b.reorderPoint||0),maximum=b.maximum==null||b.maximum===''?null:Number(b.maximum);if(!Number.isInteger(productId)||minimum<0||reorder<0||maximum!==null&&(maximum<minimum||!Number.isFinite(maximum)))return fail(res,new Error('Stok politikası değerleri geçersiz.'),400);try{const pool=await poolPromise;const r=await pool.request().input('UrunId',sql.Int,productId).input('MinimumStok',sql.Decimal(18,4),minimum).input('MaksimumStok',sql.Decimal(18,4),maximum).input('YenidenSiparisNoktasi',sql.Decimal(18,4),reorder).query(`MERGE dbo.StokPolitikalariV2 AS t USING(SELECT TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) CompanyId,@UrunId UrunId)s ON t.CompanyId=s.CompanyId AND t.UrunId=s.UrunId WHEN MATCHED THEN UPDATE SET MinimumStok=@MinimumStok,MaksimumStok=@MaksimumStok,YenidenSiparisNoktasi=@YenidenSiparisNoktasi,IsActive=1,UpdatedAt=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT(CompanyId,UrunId,MinimumStok,MaksimumStok,YenidenSiparisNoktasi) VALUES(s.CompanyId,@UrunId,@MinimumStok,@MaksimumStok,@YenidenSiparisNoktasi) OUTPUT INSERTED.*;`);res.json({success:true,data:r.recordset[0]});}catch(error){fail(res,error,400);}});

  app.post('/api/stok/v2/operations/reservations/:id/release',async(req,res)=>{const id=Number(req.params.id);if(!Number.isInteger(id))return fail(res,new Error('Geçersiz rezervasyon.'),400);const tx=new sql.Transaction(await poolPromise);try{await tx.begin();const r=await new sql.Request(tx).input('Id',sql.BigInt,id).query(`SELECT TOP(1) * FROM dbo.StokRezervasyonlari WITH(UPDLOCK,HOLDLOCK) WHERE RezervasyonId=@Id AND CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND Durum=N'ACTIVE'`);const row=r.recordset[0];if(!row)throw new Error('Aktif rezervasyon bulunamadı.');await new sql.Request(tx).input('UrunId',sql.Int,row.UrunId).input('DepoId',sql.Int,row.DepoId).input('LokasyonId',sql.Int,row.LokasyonId).input('Q',sql.Decimal(18,4),row.Miktar).query(`UPDATE dbo.StokBakiyeleri SET RezerveMiktar=RezerveMiktar-@Q,UpdatedAt=SYSUTCDATETIME() WHERE CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND UrunId=@UrunId AND DepoId=@DepoId AND LokasyonId=@LokasyonId AND LotNo=N'' AND SeriNo=N'' AND RezerveMiktar>=@Q`);await new sql.Request(tx).input('Id',sql.BigInt,id).query(`UPDATE dbo.StokRezervasyonlari SET Durum=N'RELEASED',UpdatedAt=SYSUTCDATETIME() WHERE RezervasyonId=@Id`);await tx.commit();res.json({success:true});}catch(error){try{await tx.rollback();}catch(_){}fail(res,error,400);}});
}

module.exports = { install };
