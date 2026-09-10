const express = require('express');
const { createAuthMiddleware, requirePermission } = require('./security');
const { writeAudit } = require('./coreService');

module.exports = function registerWorkflowRoutes(app, poolPromise, sql) {
  const router = express.Router();
  router.use(createAuthMiddleware({ poolPromise, sql }));

  router.get('/workflows', requirePermission('core.workflow.manage'), async (req, res) => {
    const pool = await poolPromise;
    const result = await pool.request().input('CompanyId', sql.Int, req.companyId).query(`
      SELECT WorkflowId,WorkflowCode,WorkflowName,EntityType,IsActive,CreatedAt,UpdatedAt
      FROM dbo.Workflows WHERE CompanyId=@CompanyId ORDER BY WorkflowName;
      SELECT s.WorkflowStepId,s.WorkflowId,s.StepOrder,s.StepName,s.ApproverRoleId,s.ApproverUserId,s.MinimumApprovals,s.IsFinal,r.RoleName,k.KullaniciAdi
      FROM dbo.WorkflowSteps s LEFT JOIN dbo.Roles r ON r.RoleId=s.ApproverRoleId LEFT JOIN dbo.Kullanicilar k ON k.KullaniciId=s.ApproverUserId
      WHERE EXISTS(SELECT 1 FROM dbo.Workflows w WHERE w.WorkflowId=s.WorkflowId AND w.CompanyId=@CompanyId) ORDER BY s.WorkflowId,s.StepOrder;
    `);
    res.json({ workflows: result.recordsets[0], steps: result.recordsets[1] });
  });

  router.post('/workflows', requirePermission('core.workflow.manage'), async (req, res) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    try {
      const { workflowCode, workflowName, entityType, steps } = req.body || {};
      if (!workflowCode || !workflowName || !entityType || !Array.isArray(steps) || !steps.length) {
        return res.status(400).json({ success:false, error:'Akış kodu, adı, varlık türü ve en az bir adım zorunludur.' });
      }
      if (steps.some((step) => !step.stepName || (!step.approverRoleId && !step.approverUserId))) {
        return res.status(400).json({ success:false, error:'Her adım için ad ve onaylayıcı rol/kullanıcı zorunludur.' });
      }
      await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      const workflowResult = await new sql.Request(transaction)
        .input('CompanyId',sql.Int,req.companyId).input('WorkflowCode',sql.NVarChar(64),String(workflowCode).toUpperCase())
        .input('WorkflowName',sql.NVarChar(160),workflowName).input('EntityType',sql.NVarChar(120),entityType)
        .input('UserId',sql.Int,req.auth.userId).query(`
          INSERT dbo.Workflows(CompanyId,WorkflowCode,WorkflowName,EntityType,CreatedBy)
          OUTPUT INSERTED.WorkflowId VALUES(@CompanyId,@WorkflowCode,@WorkflowName,@EntityType,@UserId);
        `);
      const workflowId = workflowResult.recordset[0].WorkflowId;
      for (let index=0; index<steps.length; index+=1) {
        const step=steps[index];
        await new sql.Request(transaction)
          .input('WorkflowId',sql.Int,workflowId).input('StepOrder',sql.Int,index+1)
          .input('StepName',sql.NVarChar(160),step.stepName).input('ApproverRoleId',sql.Int,step.approverRoleId||null)
          .input('ApproverUserId',sql.Int,step.approverUserId||null).input('MinimumApprovals',sql.Int,Math.max(1,Number(step.minimumApprovals)||1))
          .input('IsFinal',sql.Bit,index===steps.length-1).query(`
            INSERT dbo.WorkflowSteps(WorkflowId,StepOrder,StepName,ApproverRoleId,ApproverUserId,MinimumApprovals,IsFinal)
            VALUES(@WorkflowId,@StepOrder,@StepName,@ApproverRoleId,@ApproverUserId,@MinimumApprovals,@IsFinal);
          `);
      }
      await writeAudit({poolPromise,sql,companyId:req.companyId,userId:req.auth.userId,actionCode:'WORKFLOW_CREATE',entityType:'Workflow',entityId:workflowId,after:{workflowCode,workflowName,entityType,steps},req,transaction});
      await transaction.commit();
      res.status(201).json({ success:true, workflowId });
    } catch(error) {
      try { await transaction.rollback(); } catch (_) {}
      res.status(error.number===2601||error.number===2627?409:500).json({success:false,error:'Onay akışı oluşturulamadı.',detail:error.message});
    }
  });

  router.post('/workflows/:workflowCode/start', async (req, res) => {
    try {
      const { entityType, entityId }=req.body||{};
      if(!entityType||entityId==null) return res.status(400).json({success:false,error:'Varlık türü ve kayıt kimliği zorunludur.'});
      const pool=await poolPromise;
      const result=await pool.request().input('CompanyId',sql.Int,req.companyId).input('WorkflowCode',sql.NVarChar(64),String(req.params.workflowCode).toUpperCase()).input('EntityType',sql.NVarChar(120),entityType).input('EntityId',sql.NVarChar(120),String(entityId)).input('UserId',sql.Int,req.auth.userId).query(`
        INSERT dbo.WorkflowInstances(CompanyId,WorkflowId,EntityType,EntityId,RequestedBy)
        OUTPUT INSERTED.*
        SELECT @CompanyId,w.WorkflowId,@EntityType,@EntityId,@UserId FROM dbo.Workflows w
        WHERE w.CompanyId=@CompanyId AND w.WorkflowCode=@WorkflowCode AND w.EntityType=@EntityType AND w.IsActive=1;
      `);
      if(!result.recordset.length) return res.status(404).json({success:false,error:'Aktif onay akışı bulunamadı.'});
      await writeAudit({poolPromise,sql,companyId:req.companyId,userId:req.auth.userId,actionCode:'WORKFLOW_START',entityType,entityId,after:result.recordset[0],req});
      res.status(201).json({success:true,data:result.recordset[0]});
    }catch(error){res.status(error.number===2601||error.number===2627?409:500).json({success:false,error:'Onay akışı başlatılamadı.',detail:error.message});}
  });

  router.get('/workflow-inbox', requirePermission('core.workflow.approve'), async(req,res)=>{
    const pool=await poolPromise;
    const result=await pool.request().input('CompanyId',sql.Int,req.companyId).input('UserId',sql.Int,req.auth.userId).input('RoleId',sql.Int,req.auth.roleId).query(`
      SELECT i.WorkflowInstanceId,w.WorkflowName,i.EntityType,i.EntityId,i.RequestedAt,i.RequestedBy,s.WorkflowStepId,s.StepName,s.StepOrder,s.MinimumApprovals
      FROM dbo.WorkflowInstances i INNER JOIN dbo.Workflows w ON w.WorkflowId=i.WorkflowId
      INNER JOIN dbo.WorkflowSteps s ON s.WorkflowId=i.WorkflowId AND s.StepOrder=i.CurrentStepOrder
      WHERE i.CompanyId=@CompanyId AND i.Status=N'Pending' AND (s.ApproverUserId=@UserId OR s.ApproverRoleId=@RoleId)
        AND NOT EXISTS(SELECT 1 FROM dbo.WorkflowApprovals a WHERE a.WorkflowInstanceId=i.WorkflowInstanceId AND a.WorkflowStepId=s.WorkflowStepId AND a.ApproverUserId=@UserId)
      ORDER BY i.RequestedAt;
    `);
    res.json(result.recordset);
  });

  router.post('/workflow-inbox/:instanceId/decision', requirePermission('core.workflow.approve'), async(req,res)=>{
    const decision=req.body?.decision; const comment=req.body?.comment||null;
    if(!['Approved','Rejected'].includes(decision)) return res.status(400).json({success:false,error:'Karar Approved veya Rejected olmalıdır.'});
    const pool=await poolPromise; const transaction=new sql.Transaction(pool);
    try{
      await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      const current=await new sql.Request(transaction).input('CompanyId',sql.Int,req.companyId).input('InstanceId',sql.BigInt,req.params.instanceId).input('UserId',sql.Int,req.auth.userId).input('RoleId',sql.Int,req.auth.roleId).query(`
        SELECT TOP(1) i.WorkflowInstanceId,i.WorkflowId,i.CurrentStepOrder,s.WorkflowStepId,s.MinimumApprovals,s.IsFinal
        FROM dbo.WorkflowInstances i WITH(UPDLOCK,HOLDLOCK) INNER JOIN dbo.WorkflowSteps s ON s.WorkflowId=i.WorkflowId AND s.StepOrder=i.CurrentStepOrder
        WHERE i.CompanyId=@CompanyId AND i.WorkflowInstanceId=@InstanceId AND i.Status=N'Pending' AND (s.ApproverUserId=@UserId OR s.ApproverRoleId=@RoleId);
      `);
      const row=current.recordset[0]; if(!row) throw Object.assign(new Error('Onay kaydı bulunamadı veya yetkiniz yok.'),{statusCode:404});
      await new sql.Request(transaction).input('CompanyId',sql.Int,req.companyId).input('InstanceId',sql.BigInt,row.WorkflowInstanceId).input('StepId',sql.Int,row.WorkflowStepId).input('UserId',sql.Int,req.auth.userId).input('Decision',sql.NVarChar(16),decision).input('Comment',sql.NVarChar(1000),comment).query(`INSERT dbo.WorkflowApprovals(CompanyId,WorkflowInstanceId,WorkflowStepId,ApproverUserId,Decision,Comment) VALUES(@CompanyId,@InstanceId,@StepId,@UserId,@Decision,@Comment);`);
      let nextStatus='Pending';
      if(decision==='Rejected'){nextStatus='Rejected';await new sql.Request(transaction).input('InstanceId',sql.BigInt,row.WorkflowInstanceId).query(`UPDATE dbo.WorkflowInstances SET Status=N'Rejected',CompletedAt=SYSUTCDATETIME() WHERE WorkflowInstanceId=@InstanceId;`);}else{
        const count=await new sql.Request(transaction).input('InstanceId',sql.BigInt,row.WorkflowInstanceId).input('StepId',sql.Int,row.WorkflowStepId).query(`SELECT COUNT(*) ApprovalCount FROM dbo.WorkflowApprovals WHERE WorkflowInstanceId=@InstanceId AND WorkflowStepId=@StepId AND Decision=N'Approved';`);
        if(count.recordset[0].ApprovalCount>=row.MinimumApprovals){if(row.IsFinal){nextStatus='Approved';await new sql.Request(transaction).input('InstanceId',sql.BigInt,row.WorkflowInstanceId).query(`UPDATE dbo.WorkflowInstances SET Status=N'Approved',CompletedAt=SYSUTCDATETIME() WHERE WorkflowInstanceId=@InstanceId;`);}else await new sql.Request(transaction).input('InstanceId',sql.BigInt,row.WorkflowInstanceId).query(`UPDATE dbo.WorkflowInstances SET CurrentStepOrder=CurrentStepOrder+1 WHERE WorkflowInstanceId=@InstanceId;`);}
      }
      await writeAudit({poolPromise,sql,companyId:req.companyId,userId:req.auth.userId,actionCode:`WORKFLOW_${decision.toUpperCase()}`,entityType:'WorkflowInstance',entityId:row.WorkflowInstanceId,after:{decision,comment,status:nextStatus},req,transaction});
      await transaction.commit(); res.json({success:true,status:nextStatus});
    }catch(error){try{await transaction.rollback();}catch(_){} res.status(error.statusCode||((error.number===2601||error.number===2627)?409:500)).json({success:false,error:error.message});}
  });

  app.use('/api/core',router);
};
