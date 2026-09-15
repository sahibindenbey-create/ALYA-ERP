const { storage } = require('./company-context-hook');
const { nextDocumentNumber } = require('./core/coreService');

function install({ app, poolPromise, sql }) {
  if (app.__alyaSalesFlowInstalled) return;
  app.__alyaSalesFlowInstalled = true;

  const company = req => Number(storage.getStore()?.companyId || req.headers['x-company-id'] || 1);
  const fail = (res, error, status) => res.status(status || error.statusCode || 500).json({ success: false, error: error.message || String(error) });

  app.get('/api/sales-flow/orders', async (req, res) => {
    try {
      const pool = await poolPromise;
      const r = await pool.request().query(`
        SELECT s.SiparisId,s.SiparisKodu,s.SiparisYonu,s.SiparisTarihi,s.CariKodu,s.CariAdi,
               s.Durum,s.OnayDurumu,s.RezervasyonDurumu,s.ToplamTutar,
               COALESCE(SUM(d.Miktar),0) SiparisMiktari,
               COALESCE(SUM(d.RezerveMiktar),0) RezerveMiktar,
               COALESCE(SUM(d.SevkEdilenMiktar),0) SevkEdilenMiktar
        FROM dbo.Siparisler s
        LEFT JOIN dbo.SiparisDetay d ON d.CompanyId=s.CompanyId AND d.SiparisId=s.SiparisId
        WHERE s.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId'))
          AND ISNULL(s.IsActive,1)=1
          AND ISNULL(s.OnayDurumu,N'Onaylandı')<>N'İptal'
          AND COALESCE(d.Miktar,0)>COALESCE(d.SevkEdilenMiktar,0)
        GROUP BY s.SiparisId,s.SiparisKodu,s.SiparisYonu,s.SiparisTarihi,s.CariKodu,s.CariAdi,s.Durum,s.OnayDurumu,s.RezervasyonDurumu,s.ToplamTutar
        ORDER BY s.SiparisId DESC;

        SELECT d.SiparisDetayId,d.SiparisId,d.UrunId,d.UrunKodu,d.UrunAdi,d.Miktar,
               d.Birim,d.BirimFiyatKdvDahil,d.SatirToplam,d.RezerveMiktar,d.SevkEdilenMiktar,d.FaturalananMiktar
        FROM dbo.SiparisDetay d
        JOIN dbo.Siparisler s ON s.CompanyId=d.CompanyId AND s.SiparisId=d.SiparisId
        WHERE d.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId'))
          AND ISNULL(d.Miktar,0)>ISNULL(d.SevkEdilenMiktar,0)
        ORDER BY d.SiparisId DESC,d.SiparisDetayId;
      `);
      const orders = r.recordsets[0] || [];
      const lines = r.recordsets[1] || [];
      const byOrder = new Map();
      for (const o of orders) byOrder.set(o.SiparisId, { ...o, lines: [] });
      for (const line of lines) if (byOrder.has(line.SiparisId)) byOrder.get(line.SiparisId).lines.push(line);
      res.json({ success: true, orders: [...byOrder.values()] });
    } catch (error) { fail(res, error); }
  });

  app.post('/api/sales-flow/orders/:id/reserve', async (req, res) => {
    const orderId = Number(req.params.id);
    const warehouseId = Number(req.body?.warehouseId);
    if (!Number.isInteger(orderId) || !Number.isInteger(warehouseId) || warehouseId <= 0)
      return fail(res, new Error('Sipariş ve geçerli çıkış deposu zorunludur.'), 400);

    const tx = new sql.Transaction(await poolPromise);
    try {
      await tx.begin();
      const order = (await new sql.Request(tx).input('SiparisId', sql.Int, orderId).query(`
        SELECT TOP(1) s.* FROM dbo.Siparisler s WITH(UPDLOCK,HOLDLOCK)
        WHERE s.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND s.SiparisId=@SiparisId AND ISNULL(s.IsActive,1)=1
      `)).recordset[0];
      if (!order) throw Object.assign(new Error('Sipariş bulunamadı.'), { statusCode: 404 });

      const lines = (await new sql.Request(tx).input('SiparisId', sql.Int, orderId).query(`
        SELECT d.SiparisDetayId,d.UrunId,d.UrunKodu,d.Miktar,d.RezerveMiktar,d.SevkEdilenMiktar
        FROM dbo.SiparisDetay d WITH(UPDLOCK,HOLDLOCK)
        WHERE d.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND d.SiparisId=@SiparisId
          AND ISNULL(d.Miktar,0)>ISNULL(d.SevkEdilenMiktar,0)
      `)).recordset;
      if (!lines.length) throw new Error('Rezervasyon yapılacak açık sipariş satırı yok.');

      let totalReserved = 0;
      for (const line of lines) {
        const remaining = Number(line.Miktar) - Number(line.SevkEdilenMiktar || 0) - Number(line.RezerveMiktar || 0);
        if (remaining <= 0 || !line.UrunId) continue;

        const locations = (await new sql.Request(tx)
          .input('UrunId', sql.Int, line.UrunId)
          .input('DepoId', sql.Int, warehouseId)
          .query(`
            SELECT b.StokBakiyeId,b.LokasyonId,b.Miktar,b.RezerveMiktar,b.BlokeMiktar
            FROM dbo.StokBakiyeleri b WITH(UPDLOCK,HOLDLOCK)
            JOIN dbo.DepoLokasyonlari l ON l.CompanyId=b.CompanyId AND l.LokasyonId=b.LokasyonId AND l.IsActive=1
            WHERE b.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId'))
              AND b.UrunId=@UrunId AND b.DepoId=@DepoId AND b.LotNo=N'' AND b.SeriNo=N''
            ORDER BY l.IsPickable DESC,l.LokasyonId
          `)).recordset;
        let need = remaining;
        for (const stock of locations) {
          if (need <= 0) break;
          const available = Number(stock.Miktar) - Number(stock.RezerveMiktar) - Number(stock.BlokeMiktar);
          if (available <= 0) continue;
          const take = Math.min(need, available);
          await new sql.Request(tx)
            .input('StokBakiyeId', sql.BigInt, stock.StokBakiyeId)
            .input('Q', sql.Decimal(18,4), take)
            .query(`UPDATE dbo.StokBakiyeleri SET RezerveMiktar=RezerveMiktar+@Q,UpdatedAt=SYSUTCDATETIME() WHERE StokBakiyeId=@StokBakiyeId`);

          await new sql.Request(tx)
            .input('UrunId', sql.Int, line.UrunId)
            .input('DepoId', sql.Int, warehouseId)
            .input('LokasyonId', sql.Int, stock.LokasyonId)
            .input('ReferansTipi', sql.NVarChar(40), 'SIPARIS')
            .input('ReferansId', sql.NVarChar(120), String(orderId))
            .input('Miktar', sql.Decimal(18,4), take)
            .input('ReferansSatirId', sql.BigInt, line.SiparisDetayId)
            .query(`
              MERGE dbo.StokRezervasyonlari AS t
              USING (SELECT TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) CompanyId,@UrunId UrunId,@DepoId DepoId,@LokasyonId LokasyonId,@ReferansTipi ReferansTipi,@ReferansId ReferansId,@ReferansSatirId ReferansSatirId,@Miktar Miktar) s
              ON t.CompanyId=s.CompanyId AND t.ReferansTipi=s.ReferansTipi AND t.ReferansId=s.ReferansId AND t.UrunId=s.UrunId AND t.DepoId=s.DepoId AND t.LokasyonId=s.LokasyonId AND t.Durum=N'ACTIVE'
              WHEN MATCHED THEN UPDATE SET Miktar=t.Miktar+s.Miktar,ReferansSatirId=s.ReferansSatirId,UpdatedAt=SYSUTCDATETIME()
              WHEN NOT MATCHED THEN INSERT(CompanyId,UrunId,DepoId,LokasyonId,ReferansTipi,ReferansId,ReferansSatirId,Miktar) VALUES(s.CompanyId,s.UrunId,s.DepoId,s.LokasyonId,s.ReferansTipi,s.ReferansId,s.ReferansSatirId,s.Miktar);
            `);
          need -= take;
          totalReserved += take;
        }
        const reservedForLine = remaining - need;
        if (reservedForLine > 0) {
          await new sql.Request(tx).input('SiparisDetayId',sql.Int,line.SiparisDetayId).input('Q',sql.Decimal(18,4),reservedForLine).query(`UPDATE dbo.SiparisDetay SET RezerveMiktar=RezerveMiktar+@Q WHERE SiparisDetayId=@SiparisDetayId AND CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId'))`);
        }
      }

      await new sql.Request(tx).input('SiparisId',sql.Int,orderId).query(`
        UPDATE s SET RezervasyonDurumu=CASE
          WHEN NOT EXISTS(SELECT 1 FROM dbo.SiparisDetay d WHERE d.CompanyId=s.CompanyId AND d.SiparisId=s.SiparisId AND d.Miktar>d.SevkEdilenMiktar+d.RezerveMiktar) THEN N'Tam'
          WHEN EXISTS(SELECT 1 FROM dbo.SiparisDetay d WHERE d.CompanyId=s.CompanyId AND d.SiparisId=s.SiparisId AND d.RezerveMiktar>0) THEN N'Kısmi'
          ELSE N'Yok' END
        FROM dbo.Siparisler s WHERE s.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND s.SiparisId=@SiparisId
      `);
      await tx.commit();
      res.json({ success: true, reserved: totalReserved });
    } catch (error) { try { await tx.rollback(); } catch (_) {} fail(res, error); }
  });

  app.post('/api/sales-flow/orders/:id/dispatch', async (req, res) => {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId)) return fail(res, new Error('Geçersiz sipariş.'), 400);
    const tx = new sql.Transaction(await poolPromise);
    try {
      await tx.begin();
      const order = (await new sql.Request(tx).input('SiparisId',sql.Int,orderId).query(`SELECT TOP(1) * FROM dbo.Siparisler WITH(UPDLOCK,HOLDLOCK) WHERE CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND SiparisId=@SiparisId AND ISNULL(IsActive,1)=1`)).recordset[0];
      if (!order) throw Object.assign(new Error('Sipariş bulunamadı.'), { statusCode: 404 });

      const existing = (await new sql.Request(tx).input('SiparisId',sql.BigInt,orderId).query(`SELECT TOP(1) HedefId FROM dbo.BelgeBaglantilari WHERE CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND KaynakTip=N'SIPARIS' AND KaynakId=@SiparisId AND HedefTip=N'IRSALIYE' ORDER BY BaglantiId DESC`)).recordset[0];
      if (existing) {
        await tx.rollback();
        return res.json({ success:true, dispatchNo: `#${existing.HedefId}`, IrsaliyeId: existing.HedefId, alreadyExists:true });
      }

      const reservations = (await new sql.Request(tx).input('SiparisId',sql.Int,orderId).query(`
        SELECT z.*,d.SiparisDetayId,d.UrunKodu,d.UrunAdi,d.Birim,d.BirimFiyatKdvDahil,d.SatirToplam,d.Miktar SiparisMiktari,d.SevkEdilenMiktar
        FROM dbo.StokRezervasyonlari z WITH(UPDLOCK,HOLDLOCK)
        JOIN dbo.SiparisDetay d ON d.CompanyId=z.CompanyId AND d.SiparisDetayId=z.ReferansSatirId
        WHERE z.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND z.ReferansTipi=N'SIPARIS' AND z.ReferansId=CONVERT(NVARCHAR(120),@SiparisId) AND z.Durum=N'ACTIVE' AND z.Miktar>z.KarsilananMiktar
      `)).recordset;
      if (!reservations.length) throw new Error('Sevk edilecek aktif rezervasyon bulunamadı.');

      const grouped = new Map();
      for (const z of reservations) {
        const qty = Number(z.Miktar)-Number(z.KarsilananMiktar);
        if (qty <= 0) continue;
        const key = z.SiparisDetayId;
        const g = grouped.get(key) || { line:z, qty:0 };
        g.qty += qty;
        grouped.set(key,g);
      }
      const IrsaliyeKodu = await nextDocumentNumber({ poolPromise, sql, companyId: company(req), documentType:'IRSALIYE', transaction:tx });
      const header = (await new sql.Request(tx)
        .input('IrsaliyeKodu',sql.NVarChar(100),IrsaliyeKodu)
        .input('CariKodu',sql.NVarChar(100),order.CariKodu||null)
        .input('CariAdi',sql.NVarChar(250),order.CariAdi||null)
        .input('SiparisId',sql.Int,orderId)
        .input('ToplamTutar',sql.Decimal(18,2),[...grouped.values()].reduce((a,g)=>a+(Number(g.line.BirimFiyatKdvDahil||0)*g.qty),0))
        .query(`INSERT dbo.Irsaliyeler(CompanyId,IrsaliyeKodu,Yon,IrsaliyeTarihi,CariKodu,CariAdi,SiparisId,ToplamTutar) OUTPUT INSERTED.IrsaliyeId VALUES(TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')),@IrsaliyeKodu,N'SATIŞ',SYSUTCDATETIME(),@CariKodu,@CariAdi,@SiparisId,@ToplamTutar`)).recordset[0];
      const irsaliyeId = header.IrsaliyeId;

      for (const g of grouped.values()) {
        const z=g.line, qty=g.qty, lineTotal=Number(z.BirimFiyatKdvDahil||0)*qty;
        await new sql.Request(tx)
          .input('IrsaliyeId',sql.Int,irsaliyeId).input('SiparisDetayId',sql.Int,z.SiparisDetayId).input('UrunId',sql.Int,z.UrunId)
          .input('UrunKodu',sql.NVarChar(100),z.UrunKodu||null).input('UrunAdi',sql.NVarChar(250),z.UrunAdi||null).input('Miktar',sql.Decimal(18,2),qty).input('Birim',sql.NVarChar(50),z.Birim||null).input('BirimFiyat',sql.Decimal(18,2),z.BirimFiyatKdvDahil||0).input('SatirToplam',sql.Decimal(18,2),lineTotal)
          .query(`INSERT dbo.IrsaliyeDetay(CompanyId,IrsaliyeId,SiparisDetayId,UrunId,UrunKodu,UrunAdi,Miktar,Birim,BirimFiyat,SatirToplam) VALUES(TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')),@IrsaliyeId,@SiparisDetayId,@UrunId,@UrunKodu,@UrunAdi,@Miktar,@Birim,@BirimFiyat,@SatirToplam)`);
      }

      for (const z of reservations) {
        const qty = Number(z.Miktar)-Number(z.KarsilananMiktar); if (qty<=0) continue;
        const stock=(await new sql.Request(tx).input('UrunId',sql.Int,z.UrunId).input('DepoId',sql.Int,z.DepoId).input('LokasyonId',sql.Int,z.LokasyonId).query(`SELECT TOP(1) * FROM dbo.StokBakiyeleri WITH(UPDLOCK,HOLDLOCK) WHERE CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND UrunId=@UrunId AND DepoId=@DepoId AND LokasyonId=@LokasyonId AND LotNo=N'' AND SeriNo=N''`)).recordset[0];
        if(!stock) throw new Error('Rezervasyon stoğu bulunamadı.');
        if(Number(stock.Miktar)<qty || Number(stock.RezerveMiktar)<qty) throw new Error(`Sevk için yetersiz stok: ${z.UrunKodu||z.UrunId}`);
        const before=Number(stock.Miktar), after=before-qty;
        await new sql.Request(tx).input('Id',sql.BigInt,stock.StokBakiyeId).input('Q',sql.Decimal(18,4),qty).query(`UPDATE dbo.StokBakiyeleri SET Miktar=Miktar-@Q,RezerveMiktar=RezerveMiktar-@Q,UpdatedAt=SYSUTCDATETIME() WHERE StokBakiyeId=@Id`);
        await new sql.Request(tx).input('UrunId',sql.Int,z.UrunId).input('DepoId',sql.Int,z.DepoId).input('LokasyonId',sql.Int,z.LokasyonId).input('Depo',sql.NVarChar(100),String(z.DepoId)).input('Miktar',sql.Decimal(18,4),qty).input('OncekiStok',sql.Decimal(18,4),before).input('SonrakiStok',sql.Decimal(18,4),after).input('ReferansId',sql.Int,orderId).query(`INSERT dbo.StokHareketleri(CompanyId,UrunId,Depo,DepoId,LokasyonId,HareketTipi,Miktar,OncekiStok,SonrakiStok,ReferansTipi,ReferansId,Aciklama,IslemTarihi) VALUES(TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')),@UrunId,@Depo,@DepoId,@LokasyonId,N'Çıkış',@Miktar,@OncekiStok,@SonrakiStok,N'IRSALIYE',@ReferansId,@Aciklama,SYSUTCDATETIME())`).catch(()=>{});
        await new sql.Request(tx).input('RezervasyonId',sql.BigInt,z.RezervasyonId).input('IrsaliyeId',sql.Int,irsaliyeId).query(`UPDATE dbo.StokRezervasyonlari SET KarsilananMiktar=Miktar,Durum=N'FULFILLED',UpdatedAt=SYSUTCDATETIME() WHERE RezervasyonId=@RezervasyonId`);
        await new sql.Request(tx).input('SiparisDetayId',sql.Int,z.SiparisDetayId).input('Q',sql.Decimal(18,4),qty).query(`UPDATE dbo.SiparisDetay SET SevkEdilenMiktar=SevkEdilenMiktar+@Q,RezerveMiktar=CASE WHEN RezerveMiktar>=@Q THEN RezerveMiktar-@Q ELSE 0 END WHERE CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND SiparisDetayId=@SiparisDetayId`);
      }

      await new sql.Request(tx).input('SiparisId',sql.Int,orderId).input('IrsaliyeId',sql.Int,irsaliyeId).query(`
        INSERT dbo.BelgeBaglantilari(CompanyId,KaynakTip,KaynakId,HedefTip,HedefId) VALUES(TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')),N'SIPARIS',@SiparisId,N'IRSALIYE',@IrsaliyeId);
        UPDATE s SET RezervasyonDurumu=CASE WHEN EXISTS(SELECT 1 FROM dbo.SiparisDetay d WHERE d.CompanyId=s.CompanyId AND d.SiparisId=s.SiparisId AND d.Miktar>d.SevkEdilenMiktar+d.RezerveMiktar) THEN N'Kısmi' ELSE N'Tam' END FROM dbo.Siparisler s WHERE s.CompanyId=TRY_CONVERT(INT,SESSION_CONTEXT(N'CompanyId')) AND s.SiparisId=@SiparisId;
      `);
      await tx.commit();
      res.json({ success:true, dispatchNo:IrsaliyeKodu, IrsaliyeId:irsaliyeId });
    } catch (error) { try { await tx.rollback(); } catch (_) {} fail(res,error); }
  });
}

module.exports = { install };
