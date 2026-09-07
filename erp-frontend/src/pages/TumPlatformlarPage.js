import React, { useState, useEffect } from "react";
import axios from "axios";
import ExportToolbar from "../components/ExportToolbar";

const API_URL = "http://localhost:5000/api";

const TumPlatformlarPage = () => {
  const [siparisler, setSiparisler] = useState([]);
  const [loading, setLoading] = useState(false);
  const [platformFiltre, setPlatformFiltre] = useState("Hepsi");
  const [search, setSearch] = useState("");

  const fetchSiparisler = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/siparisler`);
      // Sadece bir platformdan (SiparisVeren dolu) gelen siparişler
      const platformSiparisleri = (res.data || []).filter(s => s.SiparisVeren && s.SiparisVeren.trim() !== "");
      setSiparisler(platformSiparisleri);
    } catch (err) {
      console.error("Platform siparişleri alınamadı:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSiparisler(); }, []);

  const platformlar = ["Hepsi", ...Array.from(new Set(siparisler.map(s => s.SiparisVeren))).sort()];

  const gorunen = siparisler
    .filter(s => platformFiltre === "Hepsi" || s.SiparisVeren === platformFiltre)
    .filter(s =>
      (s.CariAdi || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.SiparisKodu || "").toLowerCase().includes(search.toLowerCase())
    );

  const platformOzet = platformlar.filter(p => p !== "Hepsi").map(p => ({
    platform: p,
    adet: siparisler.filter(s => s.SiparisVeren === p).length,
    toplam: siparisler.filter(s => s.SiparisVeren === p).reduce((a, s) => a + Number(s.ToplamTutar || 0), 0),
  }));

  const excelCols = [
    { key: "SiparisVeren", label: "Platform" }, { key: "SiparisKodu", label: "Sipariş No" },
    { key: "CariAdi", label: "Cari" }, { key: "SiparisTarihi", label: "Tarih" },
    { key: "Durum", label: "Durum" }, { key: "ToplamTutar", label: "Toplam" }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="erp-stat-grid">
        {platformOzet.length === 0 && (
          <div className="erp-stat-card">
            <div className="erp-stat-icon">🛒</div>
            <div><div className="erp-stat-label">Platform Siparişi</div><div className="erp-stat-value">Henüz yok</div></div>
          </div>
        )}
        {platformOzet.map(p => (
          <div className="erp-stat-card" key={p.platform}>
            <div className="erp-stat-icon">🛒</div>
            <div>
              <div className="erp-stat-label">{p.platform}</div>
              <div className="erp-stat-value">{p.adet} sipariş</div>
              <div style={{ fontSize: 13, color: "#666" }}>{p.toplam.toLocaleString()} ₺</div>
            </div>
          </div>
        ))}
      </div>

      <div className="fin-card">
        <div className="fin-card-header">
          <h3>Tüm Platform Siparişleri ({gorunen.length})</h3>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Cari adı veya sipariş no ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 2, minWidth: 220, padding: "8px 12px", borderRadius: 6, border: "1px solid #ccc" }}
          />
          <select value={platformFiltre} onChange={e => setPlatformFiltre(e.target.value)} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #ccc" }}>
            {platformlar.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <ExportToolbar data={gorunen} columns={excelCols} filename="tum-platform-siparisleri" />
        {loading ? <p style={{ color: "#888" }}>Yükleniyor...</p> : (
          <table className="fin-table">
            <thead><tr><th>Platform</th><th>Sipariş No</th><th>Cari</th><th>Tarih</th><th>Durum</th><th>Toplam</th></tr></thead>
            <tbody>
              {gorunen.map(s => (
                <tr key={s.SiparisId}>
                  <td><span className="erp-badge blue">{s.SiparisVeren}</span></td>
                  <td>{s.SiparisKodu}</td>
                  <td>{s.CariAdi}</td>
                  <td>{s.SiparisTarihi ? new Date(s.SiparisTarihi).toLocaleDateString("tr-TR") : ""}</td>
                  <td>{s.Durum}</td>
                  <td style={{ fontWeight: 700 }}>{Number(s.ToplamTutar || 0).toLocaleString()} ₺</td>
                </tr>
              ))}
              {gorunen.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "#999", padding: 16 }}>
                  Henüz platform siparişi yok. "Excel İçe Aktar" sayfasından veya Trendyol canlı bağlantısından sipariş aktarabilirsiniz.
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default TumPlatformlarPage;
