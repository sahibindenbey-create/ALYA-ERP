// Basit oturum yönetimi (gerçek bir auth backend'i bağlanana kadar)
const AUTH_KEY = "erp_auth_user";

export function loginUser(userInfo) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(userInfo));
}

export function logoutUser() {
  localStorage.removeItem(AUTH_KEY);
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function isAuthenticated() {
  return !!getCurrentUser();
}
