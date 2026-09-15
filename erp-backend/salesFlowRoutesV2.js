const { storage } = require('./company-context-hook');
const { nextDocumentNumber } = require('./core/coreService');

function install({ app, poolPromise, sql }) {
  if (app.__alyaSalesFlowV2Installed) return;
  app.__alyaSalesFlowV2Installed = true;

  const companyId = req => Number(storage.getStore()?.companyId || req.headers['x-company-id'] || 1);
  const fail = (res, err, status = 500) => res.status(status || err.statusCode || 500).json({ success: false, error: err.message || String(err) });

  app.get('/api/sales-flow/orders', async (req, res) => {
    try {
      const pool = await poolPromise;
      const r = await pool.request().query(`
        SELECT s.SiparisId,s.SiparisKodu,s.SiparisYonu,s.SiparisTarihi,s.CariKodu,s.CariAdi,
               s.Durum,s.OnayDurumu,s.RezervasyonDurumu,s.ToplamTutar,
               SUM(d.Miktar) SiparisMiktari,SUM(d.RezerveMiktar) RezerveMiktar,
               SUM(d.SevkEdilenMiktar) SevkEdilenMiktar
        FROM dbo.Siparisler s
        JOIN dbo.SiparisDetay d ON d.CompanyId=s.CompanyId AND d.SiparisId=s.SiparisId
        WHERE s.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId'))
          AND ISNULL(s.IsActive,1)=1 AND ISNULL(s.OnayDurumu,N'Onaylandı')<>N'İptal'
          AND d.Miktar>d.SevkEdilenMiktar
        GROUP BY s.SiparisId,s.SiparisKodu,s.SiparisYonu,s.SiparisTarihi,s.CariKodu,s.CariAdi,
                 s.Durum,s.OnayDurumu,s.RezervasyonDurumu,s.ToplamTutar
        ORDER BY s.SiparisId DESC;

        SELECT d.SiparisDetayId,d.SiparisId,d.UrunId,d.UrunKodu,d.UrunAdi,d.Miktar,d.Birim,
               d.BirimFiyatKdvDahil,d.SatirToplam,d.RezerveMiktar,d.SevkEdilenMiktar,d.FaturalananMiktar
        FROM dbo.SiparisDetay d
        WHERE d.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND d.Miktar>d.SevkEdilenMiktar
        ORDER BY d.SiparisId DESC,d.SiparisDetayId;
      `);
      const orders = r.recordsets[0] || [];
      const lines = r.recordsets[1] || [];
      const map = new Map(orders.map(o => [o.SiparisId, { ...o, lines: [] }]));
      for (const line of lines) map.get(line.SiparisId)?.lines.push(line);
      res.json({ success: true, orders: [...map.values()] });
    } catch (err) { fail(res, err); }
  });

  app.post('/api/sales-flow/orders/:id/reserve', async (req, res) => {
    const orderId = Number(req.params.id);
    const warehouseId = Number(req.body?.warehouseId);
    if (!Number.isInteger(orderId) || !Number.isInteger(warehouseId) || warehouseId < 1)
      return fail(res, new Error('Sipariş ve geçerli çıkış deposu zorunludur.'), 400);

    const tx = new sql.Transaction(await poolPromise);
    try {
      await tx.begin();
      const order = (await new sql.Request(tx)
        .input('SiparisId', sql.Int, orderId)
        .query(`SELECT TOP(1) * FROM dbo.Siparisler WITH(UPDLOCK,HOLDLOCK)
                WHERE CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND SiparisId=@SiparisId AND ISNULL(IsActive,1)=1`)).recordset[0];
      if (!order) throw Object.assign(new Error('Sipariş bulunamadı.'), { statusCode: 404 });

      const lines = (await new sql.Request(tx)
        .input('SiparisId', sql.Int, orderId)
        .query(`SELECT SiparisDetayId,UrunId,UrunKodu,Miktar,RezerveMiktar,SevkEdilenMiktar
                FROM dbo.SiparisDetay WITH(UPDLOCK,HOLDLOCK)
                WHERE CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND SiparisId=@SiparisId`)).recordset;
      let reserved = 0;

      for (const line of lines) {
        let need = Number(line.Miktar) - Number(line.SevkEdilenMiktar || 0) - Number(line.RezerveMiktar || 0);
        if (need <= 0 || !line.UrunId) continue;

        const stocks = (await new sql.Request(tx)
          .input('UrunId', sql.Int, line.UrunId).input('DepoId', sql.Int, warehouseId)
          .query(`SELECT b.StokBakiyeId,b.LokasyonId,b.Miktar,b.RezerveMiktar,b.BlokeMiktar
                  FROM dbo.StokBakiyeleri b WITH(UPDLOCK,HOLDLOCK)
                  JOIN dbo.DepoLokasyonlari l ON l.CompanyId=b.CompanyId AND l.LokasyonId=b.LokasyonId AND l.IsActive=1
                  WHERE b.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND b.UrunId=@UrunId
                    AND b.DepoId=@DepoId AND b.LotNo=N'' AND b.SeriNo=N''
                  ORDER BY l.IsPickable DESC,l.LokasyonId`)).recordset;

        for (const stock of stocks) {
          if (need <= 0) break;
          const available = Number(stock.Miktar)-Number(stock.RezerveMiktar)-Number(stock.BlokeMiktar);
          if (available <= 0) continue;
          const take = Math.min(need, available);

          await new sql.Request(tx).input('Id',sql.BigInt,stock.StokBakiyeId).input('Q',sql.Decimal(18,4),take)
            .query(`UPDATE dbo.StokBakiyeleri SET RezerveMiktar=RezerveMiktar+@Q,UpdatedAt=SYSUTCDATETIME() WHERE StokBakiyeId=@Id`);

          const existing = (await new sql.Request(tx)
            .input('UrunId',sql.Int,line.UrunId).input('DepoId',sql.Int,warehouseId).input('LokasyonId',sql.Int,stock.LokasyonId)
            .input('ReferansId',sql.NVarChar(120),String(orderId))
            .query(`SELECT TOP(1) RezervasyonId FROM dbo.StokRezervasyonlari WITH(UPDLOCK,HOLDLOCK)
                    WHERE CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND ReferansTipi=N'SIPARIS' AND ReferansId=@ReferansId
                      AND UrunId=@UrunId AND DepoId=@DepoId AND LokasyonId=@LokasyonId AND Durum=N'ACTIVE'`)).recordset[0];

          if (existing) {
            await new sql.Request(tx).input('Id',sql.BigInt,existing.RezervasyonId).input('Q',sql.Decimal(18,4),take)
              .query(`UPDATE dbo.StokRezervasyonlari SET Miktar=Miktar+@Q,ReferansSatirId=${Number(line.SiparisDetayId)},UpdatedAt=SYSUTCDATETIME() WHERE RezervasyonId=@Id`);
          } else {
            await new sql.Request(tx)
              .input('UrunId',sql.Int,line.UrunId).input('DepoId',sql.Int,warehouseId).input('LokasyonId',sql.Int,stock.LokasyonId)
              .input('ReferansId',sql.NVarChar(120),String(orderId)).input('Q',sql.Decimal(18,4),take)
              .input('SatirId',sql.BigInt,line.SiparisDetayId)
              .query(`INSERT dbo.StokRezervasyonlari(CompanyId,UrunId,DepoId,LokasyonId,ReferansTipi,ReferansId,ReferansSatirId,Miktar)
                      VALUES(TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')),@UrunId,@DepoId,@LokasyonId,N'SIPARIS',@ReferansId,@SatirId,@Q)`);
          }
          await new sql.Request(tx).input('Id',sql.Int,line.SiparisDetayId).input('Q',sql.Decimal(18,4),take)
            .query(`UPDATE dbo.SiparisDetay SET RezerveMiktar=RezerveMiktar+@Q WHERE CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND SiparisDetayId=@Id`);
          need -= take;
          reserved += take;
        }
      }

      await new sql.Request(tx).input('SiparisId',sql.Int,orderId).query(`
        UPDATE s SET RezervasyonDurumu=CASE
          WHEN NOT EXISTS(SELECT 1 FROM dbo.SiparisDetay d WHERE d.CompanyId=s.CompanyId AND d.SiparisId=s.SiparisId AND d.Miktar>d.SevkEdilenMiktar+d.RezerveMiktar) THEN N'Tam'
          WHEN EXISTS(SELECT 1 FROM dbo.SiparisDetay d WHERE d.CompanyId=s.CompanyId AND d.SiparisId=s.SiparisId AND d.RezerveMiktar>0) THEN N'Kısmi'
          ELSE N'Yok' END
        FROM dbo.Siparisler s WHERE s.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND s.SiparisId=@SiparisId`);
      await tx.commit();
      res.json({ success:true, reserved });
    } catch (err) { try { await tx.rollback(); } catch (_) {} fail(res, err, err.statusCode || 400); }
  });

  app.post('/api/sales-flow/orders/:id/dispatch', async (req, res) => {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId)) return fail(res,new Error('Geçersiz sipariş.'),400);
    const tx = new sql.Transaction(await poolPromise);
    try {
      await tx.begin();
      const order = (await new sql.Request(tx).input('SiparisId',sql.Int,orderId)
        .query(`SELECT TOP(1) * FROM dbo.Siparisler WITH(UPDLOCK,HOLDLOCK) WHERE CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND SiparisId=@SiparisId AND ISNULL(IsActive,1)=1`)).recordset[0];
      if (!order) throw Object.assign(new Error('Sipariş bulunamadı.'),{statusCode:404});

      const existing = (await new sql.Request(tx).input('SiparisId',sql.BigInt,orderId)
        .query(`SELECT TOP(1) HedefId FROM dbo.BelgeBaglantilari WHERE CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND KaynakTip=N'SIPARIS' AND KaynakId=@SiparisId AND HedefTip=N'IRSALIYE' ORDER BY BaglantiId DESC`)).recordset[0];
      if (existing) {
        await tx.rollback();
        return res.json({success:true,alreadyExists:true,IrsaliyeId:existing.HedefId,dispatchNo:String(existing.HedefId)});
      }

      const reservations = (await new sql.Request(tx).input('SiparisId',sql.Int,orderId).query(`
        SELECT z.RezervasyonId,z.UrunId,z.DepoId,z.LokasyonId,z.Miktar,z.KarsilananMiktar,
               d.SiparisDetayId,d.UrunKodu,d.UrunAdi,d.Birim,d.BirimFiyatKdvDahil
        FROM dbo.StokRezervasyonlari z WITH(UPDLOCK,HOLDLOCK)
        JOIN dbo.SiparisDetay d ON d.CompanyId=z.CompanyId AND d.SiparisDetayId=z.ReferansSatirId
        WHERE z.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND z.ReferansTipi=N'SIPARIS'
          AND z.ReferansId=CONVERT(NVARCHAR(120),@SiparisId) AND z.Durum=N'ACTIVE' AND z.Miktar>z.KarsilananMiktar`)).recordset;
      if (!reservations.length) throw new Error('Sevk edilecek aktif rezervasyon bulunamadı.');

      const grouped = new Map();
      for (const z of reservations) {
        const q=Number(z.Miktar)-Number(z.KarsilananMiktar);
        if(q<=0) continue;
        const g=grouped.get(z.SiparisDetayId)||{line:z,qty:0}; g.qty+=q; grouped.set(z.SiparisDetayId,g);
      }
      if (!grouped.size) throw new Error('Sevk edilecek miktar bulunamadı.');

      const code=await nextDocumentNumber({poolPromise,sql,companyId:companyId(req),documentType:'IRSALIYE',transaction:tx});
      const total=[...grouped.values()].reduce((sum,g)=>sum+Number(g.line.BirimFiyatKdvDahil||0)*g.qty,0);
      const header=(await new sql.Request(tx)
        .input('Kodu',sql.NVarChar(100),code).input('CariKodu',sql.NVarChar(100),order.CariKodu||null)
        .input('CariAdi',sql.NVarChar(250),order.CariAdi||null).input('SiparisId',sql.Int,orderId).input('Toplam',sql.Decimal(18,2),total)
        .query(`INSERT dbo.Irsaliyeler(CompanyId,IrsaliyeKodu,Yon,IrsaliyeTarihi,CariKodu,CariAdi,SiparisId,ToplamTutar)
                OUTPUT INSERTED.IrsaliyeId VALUES(TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')),@Kodu,N'SATIŞ',SYSUTCDATETIME(),@CariKodu,@CariAdi,@SiparisId,@Toplam)`)).recordset[0];
      const irsaliyeId=header.IrsaliyeId;

      for (const g of grouped.values()) {
        const z=g.line,q=g.qty;
        await new sql.Request(tx).input('IrsaliyeId',sql.Int,irsaliyeId).input('SiparisDetayId',sql.Int,z.SiparisDetayId).input('UrunId',sql.Int,z.UrunId)
          .input('UrunKodu',sql.NVarChar(100),z.UrunKodu||null).input('UrunAdi',sql.NVarChar(250),z.UrunAdi||null)
          .input('Miktar',sql.Decimal(18,2),q).input('Birim',sql.NVarChar(50),z.Birim||null).input('BirimFiyat',sql.Decimal(18,2),z.BirimFiyatKdvDahil||0)
          .input('SatirToplam',sql.Decimal(18,2),Number(z.BirimFiyatKdvDahil||0)*q)
          .query(`INSERT dbo.IrsaliyeDetay(CompanyId,IrsaliyeId,SiparisDetayId,UrunId,UrunKodu,UrunAdi,Miktar,Birim,BirimFiyat,SatirToplam)
                  VALUES(TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')),@IrsaliyeId,@SiparisDetayId,@UrunId,@UrunKodu,@UrunAdi,@Miktar,@Birim,@BirimFiyat,@SatirToplam)`);
      }

      for (const z of reservations) {
        const q=Number(z.Miktar)-Number(z.KarsilananMiktar); if(q<=0) continue;
        const stock=(await new sql.Request(tx).input('UrunId',sql.Int,z.UrunId).input('DepoId',sql.Int,z.DepoId).input('LokasyonId',sql.Int,z.LokasyonId)
          .query(`SELECT TOP(1) b.*,d.DepoAdi FROM dbo.StokBakiyeleri b WITH(UPDLOCK,HOLDLOCK)
                  JOIN dbo.Depolar d ON d.CompanyId=b.CompanyId AND d.DepoId=b.DepoId
                  WHERE b.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND b.UrunId=@UrunId AND b.DepoId=@DepoId AND b.LokasyonId=@LokasyonId AND b.LotNo=N'' AND b.SeriNo=N''`)).recordset[0];
        if(!stock) throw new Error(`Rezervasyon stoğu bulunamadı: ${z.UrunKodu||z.UrunId}`);
        if(Number(stock.Miktar)<q || Number(stock.RezerveMiktar)<q) throw new Error(`Sevk için yetersiz stok: ${z.UrunKodu||z.UrunId}`);
        const before=Number(stock.Miktar),after=before-q;
        await new sql.Request(tx).input('Id',sql.BigInt,stock.StokBakiyeId).input('Q',sql.Decimal(18,4),q)
          .query(`UPDATE dbo.StokBakiyeleri SET Miktar=Miktar-@Q,RezerveMiktar=RezerveMiktar-@Q,UpdatedAt=SYSUTCDATETIME() WHERE StokBakiyeId=@Id`);
        await new sql.Request(tx).input('UrunId',sql.Int,z.UrunId).input('DepoId',sql.Int,z.DepoId).input('LokasyonId',sql.Int,z.LokasyonId)
          .input('Depo',sql.NVarChar(100),stock.DepoAdi).input('Miktar',sql.Decimal(18,4),q).input('Onceki',sql.Decimal(18,4),before).input('Sonraki',sql.Decimal(18,4),after)
          .input('ReferansId',sql.Int,orderId).input('Aciklama',sql.NVarChar(500),`Sipariş ${order.SiparisKodu||orderId} sevkiyatı`)
          .query(`INSERT dbo.StokHareketleri(CompanyId,UrunId,Depo,DepoId,LokasyonId,HareketTipi,Miktar,OncekiStok,SonrakiStok,ReferansTipi,ReferansId,Aciklama,IslemTarihi)
                  VALUES(TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')),@UrunId,@Depo,@DepoId,@LokasyonId,N'Çıkış',@Miktar,@Onceki,@Sonraki,N'IRSALIYE',@ReferansId,@Aciklama,SYSUTCDATETIME())`);
        await new sql.Request(tx).input('Id',sql.BigInt,z.RezervasyonId).query(`UPDATE dbo.StokRezervasyonlari SET KarsilananMiktar=Miktar,Durum=N'FULFILLED',UpdatedAt=SYSUTCDATETIME() WHERE RezervasyonId=@Id`);
        await new sql.Request(tx).input('Id',sql.Int,z.SiparisDetayId).input('Q',sql.Decimal(18,4),q)
          .query(`UPDATE dbo.SiparisDetay SET SevkEdilenMiktar=SevkEdilenMiktar+@Q,RezerveMiktar=CASE WHEN RezerveMiktar>=@Q THEN RezerveMiktar-@Q ELSE 0 END WHERE CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND SiparisDetayId=@Id`);
      }

      await new sql.Request(tx).input('SiparisId',sql.Int,orderId).input('IrsaliyeId',sql.Int,irsaliyeId).query(`
        INSERT dbo.BelgeBaglantilari(CompanyId,KaynakTip,KaynakId,HedefTip,HedefId)
        VALUES(TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')),N'SIPARIS',@SiparisId,N'IRSALIYE',@IrsaliyeId);
        UPDATE s SET RezervasyonDurumu=CASE WHEN EXISTS(SELECT 1 FROM dbo.SiparisDetay d WHERE d.CompanyId=s.CompanyId AND d.SiparisId=s.SiparisId AND d.Miktar>d.SevkEdilenMiktar+d.RezerveMiktar) THEN N'Kısmi' ELSE N'Tam' END
        FROM dbo.Siparisler s WHERE s.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND s.SiparisId=@SiparisId;`);
      await tx.commit();
      res.json({success:true,dispatchNo:code,IrsaliyeId:irsaliyeId});
    } catch(err) { try { await tx.rollback(); } catch(_) {} fail(res,err,err.statusCode||400); }
  });
}

module.exports={install};
