import axios from "axios";

// Şirket seçiminin uygulamanın tamamında tek bir localStorage anahtarı
// üzerinden yönetilmesi gerekir. CompanySelector ve Axios interceptor da
// bu anahtarı kullanıyor.
export const COMPANY_STORAGE_KEY = "selectedCompanyId";
const LEGACY_COMPANY_STORAGE_KEY = "alya_active_company_id";

export const DEFAULT_COMPANIES = [
  { CompanyId: 1, CompanyName: "ALYA HOMES DAYANIKLI TÜKETİM MALLARI SAN. VE TİC. LTD. ŞTİ." },
  { CompanyId: 2, CompanyName: "YAMANKAYA GRUP YAPI İNŞAAT SANAYİ VE TİCARET LİMİTED ŞİRKETİ" },
  { CompanyId: 3, CompanyName: "MONO İÇ VE DIŞ TİCARET LİMİTED ŞİRKETİ" },
];

const isValidCompanyId = (value) => [1, 2, 3].includes(value);

export function getActiveCompanyId() {
  const current = localStorage.getItem(COMPANY_STORAGE_KEY);
  const legacy = localStorage.getItem(LEGACY_COMPANY_STORAGE_KEY);

  const currentId = Number(current);
  const legacyId = Number(legacy);
  const id = isValidCompanyId(currentId)
    ? currentId
    : isValidCompanyId(legacyId)
      ? legacyId
      : 1;

  // Eski sürümde seçilmiş şirket varsa yeni anahtara bir kez taşı.
  if (!isValidCompanyId(currentId) && isValidCompanyId(legacyId)) {
    localStorage.setItem(COMPANY_STORAGE_KEY, String(id));
  }

  return id;
}

export function setActiveCompanyId(companyId) {
  const id = Number(companyId);
  if (!isValidCompanyId(id)) return false;
  localStorage.setItem(COMPANY_STORAGE_KEY, String(id));
  axios.defaults.headers.common["X-Company-Id"] = String(id);
  return true;
}

export function initializeCompanyContext() {
  const id = getActiveCompanyId();
  axios.defaults.headers.common["X-Company-Id"] = String(id);
  return id;
}
