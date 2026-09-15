const { storage } = require('./company-context-hook');
const { nextDocumentNumber } = require('./core/coreService');

function install({ app, poolPromise, sql }) {
  if (app.__alyaSalesInvoiceV2Installed) return;
  app.__alyaSalesInvoiceV2Installed = true;

  const companyId = req => Number(storage.getStore()?.companyId || req.headers['x-company-id'] || 1);
  const fail = (res, err, status = 500) => res.status(status || err.statusCode || 500).json({ success:false, error:err.message || String(err) });

  app.post('/api/sales-flow/orders/:id/invoice', async (req,res) => {
    const orderId=Number(req.params.id);
    if(!Number.isInteger(orderId)) return fail(res,new Error('Geçersiz sipariş.'),400);
    const tx=new sql.Transaction(await poolPromise);
    try {
      await tx.begin();
      const cid=companyId(req);
      const order=(await new sql.Request(tx).input('SiparisId',sql.Int,orderId).query(`SELECT TOP(1) * FROM dbo.Siparisler WITH(UPDLOCK,HOLDLOCK) WHERE CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND SiparisId=@SiparisId AND ISNULL(IsActive,1)=1`)).recordset[0];
      if(!order) throw Object.assign(new Error('Sipariş bulunamadı.'),{statusCode:404});

      const existing=(await new sql.Request(tx).input('SiparisId',sql.Int,orderId).query(`SELECT TOP(1) HedefId FROM dbo.BelgeBaglantilari WITH(UPDLOCK,HOLDLOCK) WHERE CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND KaynakTip=N'SIPARIS' AND KaynakId=@SiparisId AND HedefTip=N'FATURA' ORDER BY BaglantiId DESC`)).recordset[0];
      if(existing){await tx.rollback();return res.json({success:true,alreadyExists:true,FaturaId:existing.HedefId,invoiceNo:String(existing.HedefId)});}

      const lines=(await new sql.Request(tx).input('SiparisId',sql.Int,orderId).query(`
        SELECT id.IrsaliyeDetayId,id.IrsaliyeId,id.UrunId,id.UrunKodu,id.UrunAdi,id.Miktar,id.Birim,id.BirimFiyat,sd.SiparisDetayId,
               ISNULL((SELECT SUM(fd.Miktar) FROM dbo.FaturaDetay fd WITH(UPDLOCK,HOLDLOCK) WHERE fd.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND fd.IrsaliyeDetayId=id.IrsaliyeDetayId),0) FaturalananIrsaliyeMiktari,
               ISNULL(u.KdvOrani,20) KdvOrani
        FROM dbo.IrsaliyeDetay id WITH(UPDLOCK,HOLDLOCK)
        JOIN dbo.Irsaliyeler ih ON ih.CompanyId=id.CompanyId AND ih.IrsaliyeId=id.IrsaliyeId
        JOIN dbo.SiparisDetay sd ON sd.CompanyId=id.CompanyId AND sd.SiparisDetayId=id.SiparisDetayId
        LEFT JOIN dbo.Urunler u ON u.CompanyId=id.CompanyId AND u.UrunId=id.UrunId
        WHERE id.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND ih.SiparisId=@SiparisId AND ih.Yon=N'SATIŞ' AND ISNULL(ih.IsActive,1)=1`)).recordset;
      const billable=lines.map(x=>({...x,qty:Math.max(0,Number(x.Miktar)-Number(x.FaturalananIrsaliyeMiktari||0))})).filter(x=>x.qty>0);
      if(!billable.length) throw new Error('Faturalanacak sevk edilmiş miktar bulunamadı.');

      const irsaliyeIds=[...new Set(billable.map(x=>Number(x.IrsaliyeId)))], primaryIrsaliyeId=irsaliyeIds[0];
      const code=await nextDocumentNumber({poolPromise,sql,companyId:cid,documentType:'FATURA',transaction:tx});
      let araToplam=0,kdvToplam=0;
      for(const line of billable){const gross=Number(line.BirimFiyat||0)*line.qty,rate=Number(line.KdvOrani||0),net=rate>-100?gross/(1+rate/100):gross;araToplam+=net;kdvToplam+=gross-net;}
      const genelToplam=araToplam+kdvToplam;

      const header=(await new sql.Request(tx)
        .input('FaturaKodu',sql.NVarChar(100),code).input('Yon',sql.NVarChar(50),'Satış')
        .input('CariKodu',sql.NVarChar(100),order.CariKodu||null).input('CariAdi',sql.NVarChar(250),order.CariAdi||null)
        .input('SiparisId',sql.Int,orderId).input('IrsaliyeId',sql.Int,primaryIrsaliyeId).input('OdemeSekli',sql.NVarChar(100),order.OdemeSekli||null)
        .input('AraToplam',sql.Decimal(18,2),araToplam).input('KdvToplam',sql.Decimal(18,2),kdvToplam).input('GenelToplam',sql.Decimal(18,2),genelToplam)
        .query(`INSERT dbo.Faturalar(CompanyId,FaturaKodu,Yon,FaturaTarihi,VadeTarihi,CariKodu,CariAdi,SiparisId,IrsaliyeId,OdemeSekli,AraToplam,KdvToplam,GenelToplam)
                OUTPUT INSERTED.FaturaId VALUES(TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')),@FaturaKodu,@Yon,SYSUTCDATETIME(),NULL,@CariKodu,@CariAdi,@SiparisId,@IrsaliyeId,@OdemeSekli,@AraToplam,@KdvToplam,@GenelToplam)`)).recordset[0];
      const faturaId=header.FaturaId;

      for(const line of billable){
        const grossUnit=Number(line.BirimFiyat||0),rate=Number(line.KdvOrani||0),netUnit=rate>-100?grossUnit/(1+rate/100):grossUnit,rowNet=netUnit*line.qty,rowKdv=grossUnit*line.qty-rowNet;
        await new sql.Request(tx).input('FaturaId',sql.Int,faturaId).input('IrsaliyeDetayId',sql.Int,line.IrsaliyeDetayId).input('UrunId',sql.Int,line.UrunId||null).input('UrunKodu',sql.NVarChar(100),line.UrunKodu||null).input('UrunAdi',sql.NVarChar(250),line.UrunAdi||null).input('Miktar',sql.Decimal(18,2),line.qty).input('Birim',sql.NVarChar(50),line.Birim||null).input('BirimFiyat',sql.Decimal(18,2),netUnit).input('KdvOrani',sql.Decimal(9,2),rate).input('KdvTutari',sql.Decimal(18,2),rowKdv).input('SatirToplam',sql.Decimal(18,2),rowNet+rowKdv)
          .query(`INSERT dbo.FaturaDetay(CompanyId,FaturaId,IrsaliyeDetayId,UrunId,UrunKodu,UrunAdi,Miktar,Birim,BirimFiyat,KdvOrani,KdvTutari,SatirToplam) VALUES(TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')),@FaturaId,@IrsaliyeDetayId,@UrunId,@UrunKodu,@UrunAdi,@Miktar,@Birim,@BirimFiyat,@KdvOrani,@KdvTutari,@SatirToplam)`);
        await new sql.Request(tx).input('SiparisDetayId',sql.Int,line.SiparisDetayId).input('Q',sql.Decimal(18,4),line.qty).query(`UPDATE dbo.SiparisDetay SET FaturalananMiktar=FaturalananMiktar+@Q WHERE CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND SiparisDetayId=@SiparisDetayId`);
      }

      await new sql.Request(tx).input('SiparisId',sql.Int,orderId).input('FaturaId',sql.Int,faturaId).query(`INSERT dbo.BelgeBaglantilari(CompanyId,KaynakTip,KaynakId,HedefTip,HedefId) VALUES(TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')),N'SIPARIS',@SiparisId,N'FATURA',@FaturaId)`);
      for(const irsaliyeId of irsaliyeIds) await new sql.Request(tx).input('IrsaliyeId',sql.Int,irsaliyeId).input('FaturaId',sql.Int,faturaId).query(`IF NOT EXISTS(SELECT 1 FROM dbo.BelgeBaglantilari WHERE CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND KaynakTip=N'IRSALIYE' AND KaynakId=@IrsaliyeId AND HedefTip=N'FATURA' AND HedefId=@FaturaId) INSERT dbo.BelgeBaglantilari(CompanyId,KaynakTip,KaynakId,HedefTip,HedefId) VALUES(TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')),N'IRSALIYE',@IrsaliyeId,N'FATURA',@FaturaId)`);

      await tx.commit();
      res.json({success:true,invoiceNo:code,FaturaId:faturaId,IrsaliyeId:primaryIrsaliyeId,total:genelToplam});
    } catch(err){try{await tx.rollback();}catch(_){}fail(res,err,err.statusCode||400);}
  });
}
module.exports={install};
