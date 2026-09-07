import React, { useEffect, useState } from "react";
import axios from "axios";

const API_URL = "http://localhost:5000/api";
const STORAGE_KEY = "selectedCompanyId";

const CompanySelector = () => {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState(
    Number(localStorage.getItem(STORAGE_KEY) || 1)
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const response = await axios.get(`${API_URL}/sirketler`);
        const list = Array.isArray(response.data) ? response.data : [];
        setCompanies(list);

        const saved = Number(localStorage.getItem(STORAGE_KEY) || 1);
        const valid = list.some((x) => Number(x.CompanyId) === saved);
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

    window.dispatchEvent(
      new CustomEvent("companyChanged", { detail: { CompanyId: id } })
    );

    // Şirket değiştiğinde açık modül eski şirket verisini göstermesin.
    window.location.reload();
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12, opacity: 0.8 }}>Şirket:</span>
      <select
        value={companyId}
        onChange={handleChange}
        disabled={loading || companies.length === 0}
        style={{
          minWidth: 190,
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,.25)",
          background: "rgba(255,255,255,.12)",
          color: "inherit",
          fontWeight: 600,
          outline: "none"
        }}
      >
        {companies.map((company) => (
          <option key={company.CompanyId} value={company.CompanyId} style={{ color: "#222" }}>
            {company.CompanyCode} - {company.CompanyName}
          </option>
        ))}
      </select>
    </div>
  );
};

export default CompanySelector;
