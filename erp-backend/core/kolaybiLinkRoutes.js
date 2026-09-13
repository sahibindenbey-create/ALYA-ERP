const express = require('express');
const { createAuthMiddleware, requirePermission } = require('./security');
const { writeAudit } = require('./coreService');

module.exports = function registerKolaybiLinkRoutes(app, poolPromise, sql) {
  const router = express.Router();
  router.use(createAuthMiddleware({ poolPromise, sql }));

  function requireYamankaya(req) {
    if (req.companyId !== 2) {
      throw Object.assign(new Error('İlişkilendirme yalnız Yamankaya için açıktır.'), { statusCode: 409 });
    }
  }

  async function getMetrics(db, transaction) {
    const request = transaction ? new sql.Request(transaction) : db.request();
    const query = await request.input('CompanyId', sql.Int, 2).query(`
      SELECT COUNT_BIG(*) Total, SUM(CASE WHEN f.CariId IS NOT NULL THEN 1 ELSE 0 END) Linked
      FROM dbo.KolaybiFaturaEslemeleri e
      JOIN dbo.Faturalar f ON f.CompanyId=e.CompanyId AND f.FaturaId=e.FaturaId
      WHERE e.CompanyId=@CompanyId;

      SELECT COUNT_BIG(*) Total, SUM(CASE WHEN d.UrunId IS NOT NULL THEN 1 ELSE 0 END) Linked
      FROM dbo.KolaybiFaturaEslemeleri e
      JOIN dbo.FaturaDetay d ON d.CompanyId=e.CompanyId AND d.FaturaId=e.FaturaId
      WHERE e.CompanyId=@CompanyId;

      SELECT COUNT_BIG(*) Total, SUM(CASE WHEN s.CariId IS NOT NULL THEN 1 ELSE 0 END) Linked
      FROM dbo.KolaybiBusinessMappings m
      JOIN dbo.Siparisler s ON m.CompanyId=s.CompanyId AND m.AlyaTable=N'Siparisler' AND m.AlyaId=s.SiparisId
      WHERE m.CompanyId=@CompanyId;

      SELECT COUNT_BIG(*) Total, SUM(CASE WHEN t.CariId IS NOT NULL THEN 1 ELSE 0 END) Linked
      FROM dbo.KolaybiBusinessMappings m
      JOIN dbo.Teklifler t ON m.CompanyId=t.CompanyId AND m.AlyaTable=N'Teklifler' AND m.AlyaId=t.TeklifId
      WHERE m.CompanyId=@CompanyId;

      SELECT COUNT_BIG(*) Total FROM dbo.CariDefterHareketleri
      WHERE CompanyId=@CompanyId AND BelgeTipi=N'KolayBiFatura';

      SELECT COUNT_BIG(*) Total FROM dbo.BelgeBaglantilari
      WHERE CompanyId=@CompanyId AND KaynakTip LIKE N'KolayBi%';
    `);
    const names = ['faturalarCari', 'faturaSatirlariUrun', 'siparislerCari', 'proformalarCari', 'cariDefter', 'belgeBaglantilari'];
    return Object.fromEntries(query.recordsets.map((rows, index) => {
      const row = rows[0] || {};
      return [names[index], { total: Number(row.Total || 0), linked: Number(row.Linked ?? row.Total ?? 0) }];
    }));
  }

  router.get('/plan', requirePermission('erp.read'), async (req, res) => {
    try {
      requireYamankaya(req);
      res.json({ success: true, metrics: await getMetrics(await poolPromise) });
    } catch (error) {
      res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
  });

  router.post('/run', requirePermission('core.admin'), async (req, res) => {
    if (req.body?.confirmation !== 'YAMANKAYA_LINK_DATA') {
      return res.status(400).json({ success: false, error: 'İlişkilendirme onayı eksik.' });
    }
    let transaction;
    try {
      requireYamankaya(req);
      const db = await poolPromise;
      transaction = new sql.Transaction(db);
      await transaction.begin();
      const execute = async query => {
        const result = await new sql.Request(transaction).input('CompanyId', sql.Int, 2).query(query);
        return (result.rowsAffected || []).reduce((sum, count) => sum + count, 0);
      };
      const result = {};

      result.faturalarCari = await execute(`UPDATE f SET CariId=c.CariId,CariKodu=c.CariKodu,CariAdi=c.CariAdi FROM dbo.Faturalar f JOIN dbo.KolaybiFaturaEslemeleri e ON e.CompanyId=f.CompanyId AND e.FaturaId=f.FaturaId JOIN dbo.CariListesi c ON c.CompanyId=f.CompanyId AND c.CariKodu=f.CariKodu WHERE f.CompanyId=@CompanyId AND (f.CariId IS NULL OR f.CariId<>c.CariId);`);
      result.siparislerCari = await execute(`UPDATE s SET CariId=c.CariId,CariKodu=c.CariKodu,CariAdi=c.CariAdi FROM dbo.Siparisler s JOIN dbo.KolaybiBusinessMappings m ON m.CompanyId=s.CompanyId AND m.AlyaTable=N'Siparisler' AND m.AlyaId=s.SiparisId JOIN dbo.CariListesi c ON c.CompanyId=s.CompanyId AND c.CariKodu=s.CariKodu WHERE s.CompanyId=@CompanyId AND (s.CariId IS NULL OR s.CariId<>c.CariId);`);
      result.proformalarCari = await execute(`UPDATE t SET CariId=c.CariId,CariKodu=c.CariKodu,CariAdi=c.CariAdi FROM dbo.Teklifler t JOIN dbo.KolaybiBusinessMappings m ON m.CompanyId=t.CompanyId AND m.AlyaTable=N'Teklifler' AND m.AlyaId=t.TeklifId JOIN dbo.CariListesi c ON c.CompanyId=t.CompanyId AND c.CariKodu=t.CariKodu WHERE t.CompanyId=@CompanyId AND (t.CariId IS NULL OR t.CariId<>c.CariId);`);
      result.faturaSatirlariUrun = await execute(`UPDATE d SET UrunId=u.UrunId,UrunKodu=u.UrunKodu,UrunAdi=u.UrunAdi FROM dbo.FaturaDetay d JOIN dbo.KolaybiFaturaEslemeleri e ON e.CompanyId=d.CompanyId AND e.FaturaId=d.FaturaId JOIN dbo.Urunler u ON u.CompanyId=d.CompanyId AND u.UrunKodu=d.UrunKodu WHERE d.CompanyId=@CompanyId AND (d.UrunId IS NULL OR d.UrunId<>u.UrunId);`);
      result.siparisSatirlariUrun = await execute(`UPDATE d SET UrunId=u.UrunId,UrunKodu=u.UrunKodu,UrunAdi=u.UrunAdi FROM dbo.SiparisDetay d JOIN dbo.KolaybiBusinessMappings m ON m.CompanyId=d.CompanyId AND m.AlyaTable=N'Siparisler' AND m.AlyaId=d.SiparisId JOIN dbo.Urunler u ON u.CompanyId=d.CompanyId AND u.UrunKodu=d.UrunKodu WHERE d.CompanyId=@CompanyId AND (d.UrunId IS NULL OR d.UrunId<>u.UrunId);`);
      result.proformaSatirlariUrun = await execute(`UPDATE d SET UrunId=u.UrunId,UrunKodu=u.UrunKodu,UrunAdi=u.UrunAdi FROM dbo.TeklifKalemleri d JOIN dbo.KolaybiBusinessMappings m ON m.CompanyId=d.CompanyId AND m.AlyaTable=N'Teklifler' AND m.AlyaId=d.TeklifId JOIN dbo.Urunler u ON u.CompanyId=d.CompanyId AND u.UrunKodu=d.UrunKodu WHERE d.CompanyId=@CompanyId AND (d.UrunId IS NULL OR d.UrunId<>u.UrunId);`);
      result.finansCari = await execute(`UPDATE h SET CariId=c.CariId,CariKodu=c.CariKodu,CariAdi=c.CariAdi FROM dbo.FinansHareket h JOIN dbo.KolaybiBusinessMappings m ON m.CompanyId=h.CompanyId AND m.AlyaTable=N'FinansHareket' AND m.AlyaId=h.HareketId JOIN dbo.CariListesi c ON c.CompanyId=h.CompanyId AND c.CariKodu=h.CariKodu WHERE h.CompanyId=@CompanyId AND h.CariKodu IS NOT NULL AND (h.CariId IS NULL OR h.CariId<>c.CariId);`);
      result.cariHareketCari = await execute(`UPDATE h SET CariId=c.CariId,CariKodu=c.CariKodu,CariAdi=c.CariAdi FROM dbo.CariHareket h JOIN dbo.KolaybiBusinessMappings m ON m.CompanyId=h.CompanyId AND m.AlyaTable=N'CariHareket' AND m.AlyaId=h.HareketId JOIN dbo.CariListesi c ON c.CompanyId=h.CompanyId AND c.CariKodu=h.CariKodu WHERE h.CompanyId=@CompanyId AND (h.CariId IS NULL OR h.CariId<>c.CariId);`);

      result.cariDefter = await execute(`INSERT dbo.CariDefterHareketleri(CompanyId,CariKodu,HareketTarihi,BelgeTipi,BelgeId,BelgeNo,Borc,Alacak,Aciklama) SELECT f.CompanyId,f.CariKodu,f.FaturaTarihi,N'KolayBiFatura',f.FaturaId,f.FaturaKodu,CASE WHEN e.ResourceType IN(N'sale_invoices',N'purchase_return_invoices') THEN f.GenelToplam ELSE 0 END,CASE WHEN e.ResourceType IN(N'purchase_invoices',N'sale_return_invoices') THEN f.GenelToplam ELSE 0 END,N'KolayBi fatura cari defter bağlantısı' FROM dbo.KolaybiFaturaEslemeleri e JOIN dbo.Faturalar f ON f.CompanyId=e.CompanyId AND f.FaturaId=e.FaturaId WHERE f.CompanyId=@CompanyId AND f.CariKodu IS NOT NULL AND f.GenelToplam>0 AND NOT EXISTS(SELECT 1 FROM dbo.CariDefterHareketleri h WHERE h.CompanyId=f.CompanyId AND h.CariKodu=f.CariKodu AND h.BelgeTipi=N'KolayBiFatura' AND h.BelgeId=f.FaturaId);`);

      result.belgeBaglantilari = await execute(`INSERT dbo.BelgeBaglantilari(CompanyId,KaynakTip,KaynakId,HedefTip,HedefId) SELECT x.CompanyId,x.KaynakTip,x.KaynakId,x.HedefTip,x.HedefId FROM (SELECT f.CompanyId,N'KolayBiFatura' KaynakTip,CONVERT(BIGINT,f.FaturaId) KaynakId,N'Cari' HedefTip,CONVERT(BIGINT,f.CariId) HedefId FROM dbo.Faturalar f JOIN dbo.KolaybiFaturaEslemeleri e ON e.CompanyId=f.CompanyId AND e.FaturaId=f.FaturaId WHERE f.CompanyId=@CompanyId AND f.CariId IS NOT NULL UNION ALL SELECT s.CompanyId,N'KolayBiSiparis',CONVERT(BIGINT,s.SiparisId),N'Cari',CONVERT(BIGINT,s.CariId) FROM dbo.Siparisler s JOIN dbo.KolaybiBusinessMappings m ON m.CompanyId=s.CompanyId AND m.AlyaTable=N'Siparisler' AND m.AlyaId=s.SiparisId WHERE s.CompanyId=@CompanyId AND s.CariId IS NOT NULL UNION ALL SELECT t.CompanyId,N'KolayBiTeklif',CONVERT(BIGINT,t.TeklifId),N'Cari',CONVERT(BIGINT,t.CariId) FROM dbo.Teklifler t JOIN dbo.KolaybiBusinessMappings m ON m.CompanyId=t.CompanyId AND m.AlyaTable=N'Teklifler' AND m.AlyaId=t.TeklifId WHERE t.CompanyId=@CompanyId AND t.CariId IS NOT NULL UNION ALL SELECT h.CompanyId,N'KolayBiFinans',CONVERT(BIGINT,h.HareketId),N'KasaBanka',CONVERT(BIGINT,h.KasaBankaId) FROM dbo.FinansHareket h JOIN dbo.KolaybiBusinessMappings m ON m.CompanyId=h.CompanyId AND m.AlyaTable=N'FinansHareket' AND m.AlyaId=h.HareketId WHERE h.CompanyId=@CompanyId) x WHERE NOT EXISTS(SELECT 1 FROM dbo.BelgeBaglantilari b WHERE b.CompanyId=x.CompanyId AND b.KaynakTip=x.KaynakTip AND b.KaynakId=x.KaynakId AND b.HedefTip=x.HedefTip AND b.HedefId=x.HedefId);`);

      const linked = Object.values(result).reduce((sum, count) => sum + count, 0);
      const metrics = await getMetrics(db, transaction);
      const unmatched = Object.values(metrics).reduce((sum, item) => sum + Math.max(0, item.total - item.linked), 0);
      await new sql.Request(transaction)
        .input('CompanyId', sql.Int, 2)
        .input('Linked', sql.Int, linked)
        .input('Unmatched', sql.Int, unmatched)
        .input('Summary', sql.NVarChar(sql.MAX), JSON.stringify({ result, metrics }))
        .input('CreatedBy', sql.Int, req.auth.userId)
        .query(`INSERT dbo.KolaybiLinkRuns(CompanyId,LinkedCount,UnmatchedCount,SummaryJson,CreatedBy) VALUES(@CompanyId,@Linked,@Unmatched,@Summary,@CreatedBy);`);
      await transaction.commit();

      try {
        await writeAudit({ poolPromise, sql, companyId: 2, userId: req.auth.userId, actionCode: 'KOLAYBI_LINK_DATA', entityType: 'KolaybiRelations', entityId: 2, after: { result, metrics }, req });
      } catch (_) {}
      res.json({ success: true, message: `KolayBi kayıtları ilişkilendirildi: ${linked} yeni/güncellenen bağlantı, ${unmatched} eşleşmeyen.`, result, metrics });
    } catch (error) {
      if (transaction) try { await transaction.rollback(); } catch (_) {}
      res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
  });

  app.use('/api/kolaybi-live/link', router);
};
