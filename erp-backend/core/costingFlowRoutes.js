const express=require('express');
const{createAuthMiddleware}=require('./security');
const registerOverview=require('./costingOverviewRoutes');
const registerPurchase=require('./costingPurchaseRoutes');
const registerCompletion=require('./costingCompletionRoutes');
const registerValuation=require('./costingValuationRoutes');
module.exports=function(app,poolPromise,sql){
  const r=express.Router();
  r.use(createAuthMiddleware({poolPromise,sql}));
  registerOverview(r,poolPromise,sql);
  registerPurchase(r,poolPromise,sql);
  registerCompletion(r,poolPromise,sql);
  registerValuation(r,poolPromise,sql);
  app.use('/api/costing-flow',r);
  require('./budgetFlowRoutes')(app,poolPromise,sql);
};
