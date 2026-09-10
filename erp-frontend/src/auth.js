const AUTH_KEY='erp_auth_user';
const TOKEN_KEY='erp_auth_token';
export function loginUser(session){const user=session?.user||session;localStorage.setItem(AUTH_KEY,JSON.stringify(user));if(session?.token)localStorage.setItem(TOKEN_KEY,session.token);if(session?.defaultCompanyId)localStorage.setItem('selectedCompanyId',String(session.defaultCompanyId));}
export function logoutUser(){localStorage.removeItem(AUTH_KEY);localStorage.removeItem(TOKEN_KEY);}
export function getCurrentUser(){try{const raw=localStorage.getItem(AUTH_KEY);return raw?JSON.parse(raw):null;}catch(_){return null;}}
export function getAuthToken(){return localStorage.getItem(TOKEN_KEY)||'';}
export function isAuthenticated(){return Boolean(getCurrentUser()&&getAuthToken());}
