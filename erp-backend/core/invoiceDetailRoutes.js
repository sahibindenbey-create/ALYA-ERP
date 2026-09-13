const express=require('express');
const{createAuthMiddleware,requirePermission}=require('./security');

module.exports=function registerInvoiceDetailRoutes(app,poolPromise,sql){
  const router=express.Router();
  router.use(createAuthMiddleware({poolPromise,sql}));

  router.get('/:id/detay',requirePermission('erp.read'),async(req,res)=>{
    const faturaId=Number(req.params.id);
    if(!Number.isInteger(faturaId)||faturaId<=0){
      return res.status(400).json({success:false,error:'Geçerli bir fatura numarası zorunludur.'});
    }

    try{
      const pool=await poolPromise;
      const result=await pool.request()
        .input('CompanyId',sql.Int,req.companyId)
        .input('FaturaId',sql.Int,faturaId)
        .query(`
          EXEC sys.sp_set_session_context @key=N'CompanyId',@value=@CompanyId;
          BEGIN TRY
            SELECT *
            FROM dbo.Faturalar
            WHERE CompanyId=@CompanyId AND FaturaId=@FaturaId AND IsActive=1;

            SELECT d.*
            FROM dbo.FaturaDetay d
            INNER JOIN dbo.Faturalar f
              ON f.FaturaId=d.FaturaId AND f.CompanyId=@CompanyId
            WHERE d.FaturaId=@FaturaId AND f.IsActive=1;

            EXEC sys.sp_set_session_context @key=N'CompanyId',@value=NULL;
          END TRY
          BEGIN CATCH
            EXEC sys.sp_set_session_context @key=N'CompanyId',@value=NULL;
            THROW;
          END CATCH;
        `);

      const header=result.recordsets?.[0]?.[0];
      if(!header){
        return res.status(404).json({success:false,error:'Fatura bulunamadı veya seçili şirkete ait değil.'});
      }

      return res.json({success:true,...header,items:result.recordsets?.[1]||[]});
    }catch(error){
      return res.status(500).json({success:false,error:'Fatura detayı alınamadı.',detail:error.message});
    }
  });

  app.use('/api/faturalar',router);
};
