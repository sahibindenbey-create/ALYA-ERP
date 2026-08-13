const registerTrendyol = ({ app, poolPromise, sql }) => {
  const sellerId = process.env.TRENDYOL_SELLER_ID;
  const apiKey = process.env.TRENDYOL_API_KEY;
  const apiSecret = process.env.TRENDYOL_API_SECRET;
  const baseUrl = (process.env.TRENDYOL_BASE_URL || 'https://apigw.trendyol.com').replace(/\/$/, '');
  const configured = () => Boolean(sellerId && apiKey && apiSecret);
  const auth = () => `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;
  async function request(path, query = {}) {
    if (!configured()) throw Object.assign(new Error('Trendyol API bilgileri .env içinde tanımlı değil.'), { status: 503 });
    const url = new URL(`${baseUrl}${path}`);
    Object.entries(query).forEach(([k,v]) => { if (v !== undefined && v !== null && v !== '') url.searchParams.set(k,String(v)); });
    const r = await fetch(url, { headers: { Authorization: auth(), Accept: 'application/json', 'User-Agent': 'ALYA-ERP' } });
    const text = await r.text(); let body; try { body = text ? JSON.parse(text) : {}; } catch { body = { raw:text }; }
    if (!r.ok) throw Object.assign(new Error(body?.message || `Trendyol HTTP ${r.status}`), { status:r.status, body });
    return body;
  }
  app.get('/api/platformlar/trendyol/durum', (req,res) => res.json({platform:'Trendyol',configured:configured(),sellerId:sellerId||null}));
  app.get('/api/platformlar/trendyol/siparisler', async (req,res) => {
    try {
      const now=Date.now();
      const data=await request(`/integration/order/sellers/${encodeURIComponent(sellerId)}/v2/orders`, {
        startDate:Number(req.query.startDate||now-7*86400000), endDate:Number(req.query.endDate||now),
        page:Number(req.query.page||0), size:Math.min(Number(req.query.size||50),200),
        status:req.query.status||undefined, orderByField:'PackageLastModifiedDate', orderByDirection:'DESC'
      }); res.json(data);
    } catch(e) { res.status(e.status||500).json({error:'Trendyol siparişleri alınamadı',detail:e.message,trendyol:e.body||null}); }
  });
  app.get('/api/platformlar/trendyol/siparisler/stream', async (req,res) => {
    try {
      const q={size:Math.min(Number(req.query.size||50),200)};
      ['nextCursor','packageItemStatuses'].forEach(k=>{if(req.query[k])q[k]=req.query[k]});
      ['lastModifiedStartDate','lastModifiedEndDate'].forEach(k=>{if(req.query[k])q[k]=Number(req.query[k])});
      res.json(await request(`/integration/order/sellers/${encodeURIComponent(sellerId)}/orders/stream`,q));
    } catch(e) { res.status(e.status||500).json({error:'Trendyol stream alınamadı',detail:e.message,trendyol:e.body||null}); }
  });
  app.post('/api/platformlar/trendyol/senkronize', async (req,res) => {
    const packages=Array.isArray(req.body?.packages)?req.body.packages:[];
    if(!packages.length)return res.status(400).json({error:'İçe aktarılacak Trendyol paketi yok.'});
    const pool=await poolPromise, tx=new sql.Transaction(pool); let inserted=0,skipped=0;
    try {
      await tx.begin();
      for(const p of packages){
        const packageId=p.shipmentPackageId??p.id, orderNo=p.orderNumber||'';
        const exists=await new sql.Request(tx).input('Platform',sql.NVarChar(50),'Trendyol').input('ShipmentPackageId',sql.NVarChar(100),packageId?String(packageId):null).input('OrderNumber',sql.NVarChar(100),orderNo||null).query(`SELECT TOP 1 IntegrationId FROM PlatformSiparisler WHERE Platform=@Platform AND ((ShipmentPackageId=@ShipmentPackageId AND @ShipmentPackageId IS NOT NULL) OR (OrderNumber=@OrderNumber AND @OrderNumber IS NOT NULL))`);
        if(exists.recordset.length){skipped++;continue;}
        await new sql.Request(tx).input('Platform',sql.NVarChar(50),'Trendyol').input('ShipmentPackageId',sql.NVarChar(100),packageId?String(packageId):null).input('OrderNumber',sql.NVarChar(100),orderNo||null).input('Status',sql.NVarChar(50),p.status||p.packageStatus||null).input('RawJson',sql.NVarChar(sql.MAX),JSON.stringify(p)).input('PackageLastModifiedDate',sql.BigInt,Number(p.packageLastModifiedDate||p.lastModifiedDate||0)).query(`INSERT INTO PlatformSiparisler (Platform,ShipmentPackageId,OrderNumber,Status,RawJson,PackageLastModifiedDate) VALUES (@Platform,@ShipmentPackageId,@OrderNumber,@Status,@RawJson,@PackageLastModifiedDate)`);
        inserted++;
      }
      await tx.commit(); res.json({success:true,inserted,skipped});
    } catch(e) { try{await tx.rollback()}catch{} res.status(500).json({error:'Trendyol kayıtları kaydedilemedi',detail:e.message}); }
  });
};
module.exports=registerTrendyol;
