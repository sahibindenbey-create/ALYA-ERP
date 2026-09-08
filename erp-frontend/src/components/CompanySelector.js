import React, { useEffect, useState } from "react";
import axios from "axios";
import "./CompanySelector.css";

const API_URL = "http://localhost:5000/api";
const STORAGE_KEY = "selectedCompanyId";

const CompanySelector = () => {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState(Number(localStorage.getItem(STORAGE_KEY) || 1));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const response = await axios.get(`${API_URL}/sirketler`);
        const list = Array.isArray(response.data) ? response.data : [];
        setCompanies(list);

        const saved = Number(localStorage.getItem(STORAGE_KEY) || 1);
        const valid = list.some((company) => Number(company.CompanyId) === saved);
        if (!valid && list.length > 0) {
          localStorage.setItem(STORAGE_KEY, String(list[0].CompanyId));
          setCompanyId(Number(list[0].CompanyId));
        }
      } catch (error) {
        console.error("Şirketler alınamadı:", error);
      } finally {
        setLoading(false);
      }
    };

    loadCompanies();
  }, []);

  const handleChange = (event) => {
    const id = Number(event.target.value);
    localStorage.setItem(STORAGE_KEY, String(id));
    setCompanyId(id);
    window.dispatchEvent(new CustomEvent("companyChanged", { detail: { CompanyId: id } }));
    window.location.reload();
  };

  const selectedCompany = companies.find((company) => Number(company.CompanyId) === companyId);

  return (
    <div className="company-selector">
      <span className="company-selector-label">ŞİRKET</span>
      <div className="company-selector-control">
        <span className="company-selector-mark" aria-hidden="true">◆</span>
        <select
          value={companyId}
          onChange={handleChange}
          disabled={loading || companies.length === 0}
          aria-label="Aktif şirket"
        >
          {companies.map((company) => (
            <option key={company.CompanyId} value={company.CompanyId}>
              {company.CompanyCode} - {company.CompanyName}
            </option>
          ))}
        </select>
      </div>
      {selectedCompany && <span className="company-selector-status">● AKTİF</span>}
    </div>
  );
};

export default CompanySelector;
