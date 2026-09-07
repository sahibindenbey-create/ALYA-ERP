import React, { useEffect, useState } from "react";
import axios from "axios";
import BusinessIcon from "@mui/icons-material/Business";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { DEFAULT_COMPANIES, getActiveCompanyId, initializeCompanyContext, setActiveCompanyId } from "../companyContext";

export default function CompanySelector() {
  const [companies, setCompanies] = useState(DEFAULT_COMPANIES);
  const [activeId, setActiveId] = useState(getActiveCompanyId());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    initializeCompanyContext();
    axios.get("http://localhost:5000/api/sirketler")
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length) setCompanies(res.data);
      })
      .catch(() => {});
  }, []);

  const active = companies.find(c => Number(c.CompanyId) === activeId) || DEFAULT_COMPANIES[0];

  const handleChange = (event) => {
    const id = Number(event.target.value);
    setLoading(true);
    setActiveCompanyId(id);
    setActiveId(id);
    // Şirket değişiminde tüm açık modüllerin yeni context'i kullanması için sayfayı yeniliyoruz.
    window.location.reload();
  };

  return (
    <div className="alya-company-selector" title={active.CompanyName}>
      <BusinessIcon fontSize="small" />
      <div className="alya-company-selector-text">
        <span className="alya-company-selector-label">AKTİF ŞİRKET</span>
        <select value={activeId} onChange={handleChange} disabled={loading} aria-label="Aktif şirket">
          {companies.map(company => (
            <option key={company.CompanyId} value={company.CompanyId}>
              {company.CompanyName}
            </option>
          ))}
        </select>
      </div>
      <ExpandMoreIcon fontSize="small" className="alya-company-selector-arrow" />
    </div>
  );
}
