import axios from "axios";

export const COMPANY_STORAGE_KEY = "alya_active_company_id";

export const DEFAULT_COMPANIES = [
  { CompanyId: 1, CompanyName: "ALYA HOMES DAYANIKLI TÜKETİM MALLARI SAN. VE TİC. LTD. ŞTİ." },
  { CompanyId: 2, CompanyName: "YAMANKAYA GRUP YAPI İNŞAAT SANAYİ VE TİCARET LİMİTED ŞİRKETİ" },
  { CompanyId: 3, CompanyName: "MONO İÇ VE DIŞ TİCARET LİMİTED ŞİRKETİ" },
];

export function getActiveCompanyId() {
  const value = Number(localStorage.getItem(COMPANY_STORAGE_KEY) || 1);
  return [1, 2, 3].includes(value) ? value : 1;
}

export function setActiveCompanyId(companyId) {
  const id = Number(companyId);
  if (![1, 2, 3].includes(id)) return false;
  localStorage.setItem(COMPANY_STORAGE_KEY, String(id));
  axios.defaults.headers.common["X-Company-Id"] = String(id);
  return true;
}

export function initializeCompanyContext() {
  const id = getActiveCompanyId();
  axios.defaults.headers.common["X-Company-Id"] = String(id);
  return id;
}
