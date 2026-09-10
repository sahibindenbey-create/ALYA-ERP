const test=require('node:test');
const assert=require('node:assert/strict');
process.env.NODE_ENV='test';
process.env.ERP_SESSION_SECRET='test-secret-that-is-longer-than-thirty-two-characters';
const {createSessionToken,verifySessionToken}=require('../core/security');
test('imzalı oturum belirteci oluşturulur ve doğrulanır',()=>{const token=createSessionToken({KullaniciId:42,KullaniciAdi:'demo'},60);const payload=verifySessionToken(token);assert.equal(payload.sub,42);assert.equal(payload.username,'demo');});
test('değiştirilmiş oturum belirteci reddedilir',()=>{const token=createSessionToken({KullaniciId:7,KullaniciAdi:'demo'},60);const [payload,signature]=token.split('.');assert.throws(()=>verifySessionToken(`${payload}x.${signature}`));});
test('süresi dolmuş oturum belirteci reddedilir',()=>{const token=createSessionToken({KullaniciId:7,KullaniciAdi:'demo'},-1);assert.throws(()=>verifySessionToken(token),/süresi dolmuş/);});
