const express = require("express");
const { createAuthMiddleware } = require("./security");
const modules = [require("./fixedAssetOverviewRoutes"),require("./fixedAssetRegisterRoutes"),require("./fixedAssetDepreciationRoutes"),require("./fixedAssetLifecycleRoutes")];
module.exports = function(app,poolPromise,sql){const router=express.Router();router.use(createAuthMiddleware({poolPromise,sql}));for(const register of modules)register(router,poolPromise,sql);app.use("/api/fixed-assets",router);};
