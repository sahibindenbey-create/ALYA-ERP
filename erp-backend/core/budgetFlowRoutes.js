const express=require('express');
const{createAuthMiddleware}=require('./security');
const modules=[
  require('./budgetOverviewRoutes'),
  require('./budgetScenarioCreateRoutes'),
  require('./budgetLineRoutes'),
  require('./budgetApprovalRoutes'),
  require('./budgetManualCashRoutes'),
  require('./budgetForecastRoutes'),
];
module.exports=function(app,poolPromise,sql){
  const r=express.Router();
  r.use(createAuthMiddleware({poolPromise,sql}));
  for(const register of modules) register(r,poolPromise,sql);
  app.use('/api/budget-flow',r);
};
