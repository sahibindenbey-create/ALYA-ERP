const express=require('express');
const{createAuthMiddleware,requirePermission}=require('./security');

module.exports=function registerInvoiceWorkspace(app,poolPromise,sql){
  const router=express.Router();
  router.use(createAuthMiddleware({poolPromise,sql}));

  const query=async(req,inputs,statement)=>{
    const pool=await poolPromise;
    const request=pool.request().input('CompanyId',sql.Int,req.companyId);
    for(const input of inputs||[])request.input(input.name,input.type,input.value);
    return request.query(`EXEC sys.sp_set_session_context @key=N'CompanyId',@value=@CompanyId;BEGIN TRY ${statement} EXEC sys.sp_set_session_context @key=N'CompanyId',@value=NULL;END TRY BEGIN CATCH EXEC sys.sp_set_session_context @key=N'CompanyId',@value=NULL;THROW;END CATCH;`);
  };

  router.get('/',requirePermission('erp.read'),async(req,res)=>{
    try{const result=await query(req,[],`SELECT * FROM dbo.Faturalar WHERE CompanyId=@CompanyId AND IsActive=1 ORDER BY FaturaId DESC;`);return res.json(result.recordsets?.[0]||[])}
    catch(error){return res.status(500).json({success:false,error:'Fatura listesi alınamadı.',detail:error.message})}
  });

  router.get('/:id/detay',requirePermission('erp.read'),async(req,res)=>{
    const faturaId=Number(req.params.id);
    if(!Number.isInteger(faturaId)||faturaId<=0)return res.status(400).json({success:false,error:'Geçerli bir fatura numarası zorunludur.'});
    try{
      const result=await query(req,[{name:'FaturaId',type:sql.Int,value:faturaId}],`SELECT * FROM dbo.Faturalar WHERE CompanyId=@CompanyId AND FaturaId=@FaturaId AND IsActive=1;SELECT d.* FROM dbo.FaturaDetay d INNER JOIN dbo.Faturalar f ON f.FaturaId=d.FaturaId AND f.CompanyId=@CompanyId WHERE d.FaturaId=@FaturaId AND f.IsActive=1;`);
      const header=result.recordsets?.[0]?.[0];
      if(!header)return res.status(404).json({success:false,error:'Fatura seçili şirkette bulunamadı.'});
      return res.json({success:true,...header,items:result.recordsets?.[1]||[]});
    }catch(error){return res.status(500).json({success:false,error:'Fatura detayı alınamadı.',detail:error.message})}
  });

  router.put('/:id/durum',requirePermission('erp.write'),async(req,res)=>{
    const faturaId=Number(req.params.id),durum=String(req.body?.Durum||'');
    if(!['Bekliyor','Ödendi','Gecikti'].includes(durum))return res.status(400).json({success:false,error:'Geçersiz fatura durumu.'});
    try{await query(req,[{name:'FaturaId',type:sql.Int,value:faturaId},{name:'Durum',type:sql.NVarChar(30),value:durum}],`UPDATE dbo.Faturalar SET Durum=@Durum WHERE CompanyId=@CompanyId AND FaturaId=@FaturaId AND IsActive=1;`);return res.json({success:true})}catch(error){return res.status(500).json({success:false,error:'Fatura durumu güncellenemedi.',detail:error.message})}
  });

  router.delete('/:id',requirePermission('erp.write'),async(req,res)=>{
    const faturaId=Number(req.params.id);
    try{await query(req,[{name:'FaturaId',type:sql.Int,value:faturaId}],`UPDATE dbo.Faturalar SET IsActive=0 WHERE CompanyId=@CompanyId AND FaturaId=@FaturaId;`);return res.json({success:true})}catch(error){return res.status(500).json({success:false,error:'Fatura pasife alınamadı.',detail:error.message})}
  });

  app.use('/api/invoice-workspace',router);
  app.use('/api/faturalar',router);
};
