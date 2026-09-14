import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import ExportToolbar from "../components/ExportToolbar";

const API_URL = "http://localhost:5000/api";

const IrsaliyeListPage = () => {
  const navigate = useNavigate();
  const [irsaliyeler, setIrsaliyeler] = useState([]);
  const [filter, setFilter] = useState("Tümü");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/irsaliyeler`);
      setIrsaliyeler(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("İrsaliye listesi alınamadı:", err);
      setIrsaliyeler([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleKolaybiSync = async () => {
    setSyncing(true);
    setSyncMessage("");
    try {
      const res = await axios.post(`${API_URL}/kolaybi/irsaliye-senkronize`);
      const data = res.data || {};
      setSyncMessage(
        `KolayBi senkronizasyonu tamamlandı. ${Number(data.created || 0)} yeni, ${Number(data.updated || 0)} güncellenen, ${Number(data.skipped || 0)} atlanan, ${Number(data.errors || 0)} hatalı kayıt.`
      );
      await fetchList();
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Bilinmeyen hata";
      setSyncMessage(`KolayBi irsaliyeleri alınamadı: ${message}`);
    } finally {
      setSyncing(false);
    }
  };

  const filtered = useMemo(
    () => filter === "Tümü" ? irsaliyeler : irsaliyeler.filter(i => i.Yon === filter),
    [irsaliyeler, filter]
  );

  const toplam = useMemo(
    () => filtered.reduce((sum, i) => sum + Number(i.ToplamTutar || 0), 0),
    [filtered]
  );

  const excelCols = [
    { key: "IrsaliyeKodu", label: "İrsaliye No" },
    { key: "Yon", label: "Yön" },
    { key: "CariAdi", label: "Cari" },
    { key: "IrsaliyeTarihi", label: "Tarih" },
    { key: "ToplamTutar", label: "Toplam" },
  ];

  const handleSil = async (id) => {
    if (!window.confirm("Bu irsaliyeyi silmek istediğinize emin misiniz?")) return;
    try {
      await axios.delete(`${API_URL}/irsaliyeler/${id}`);
      await fetchList();
    } catch (err) {
      alert("İrsaliye silinemedi: " + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>İrsaliye Listesi</h2>
          <p style={{ margin: "6px 0 0", color: "#777" }}>Alış ve satış irsaliyelerini ayrı ayrı takip edin.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleKolaybiSync}
            disabled={syncing}
            style={{ fontWeight: 700 }}
          >
            {syncing ? "⏳ KolayBi'den Çekiliyor..." : "🔄 KolayBi'den İrsaliyeleri Çek"}
          </button>
          <button type="button" onClick={() => navigate("/dashboard/irsaliyeler/satis")}>🚚 Yeni Satış İrsaliyesi</button>
          <button type="button" onClick={() => navigate("/dashboard/irsaliyeler/alis")}>📥 Yeni Alış İrsaliyesi</button>
        </div>
      </div>

      {syncMessage && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "#f4f7fb", border: "1px solid #d9e2f0" }}>
          {syncMessage}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {["Tümü", "Satış", "Alış"].map(item => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            style={{ fontWeight: filter === item ? 700 : 400 }}
          >
            {item === "Tümü" ? "📋 Tümü" : item === "Satış" ? "🚚 Satış İrsaliyeleri" : "📥 Alış İrsaliyeleri"}
            {item !== "Tümü" && ` (${irsaliyeler.filter(i => i.Yon === item).length})`}
          </button>
        ))}
      </div>

      <div className="irs-list-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: 0 }}>{filter} İrsaliyeleri ({filtered.length})</h3>
            <div style={{ marginTop: 5, color: "#777" }}>Toplam: <strong>{toplam.toLocaleString("tr-TR")} ₺</strong></div>
          </div>
          <ExportToolbar data={filtered} columns={excelCols} filename={`irsaliye-${filter.toLocaleLowerCase("tr-TR")}`} />
        </div>

        {loading ? <p style={{ color: "#888" }}>Yükleniyor...</p> : (
          <div style={{ overflowX: "auto", marginTop: 14 }}>
            <table className="irs-table">
              <thead>
                <tr><th>Kod</th><th>Yön</th><th>Cari</th><th>Tarih</th><th>Toplam</th><th>İşlem</th></tr>
              </thead>
              <tbody>
                {filtered.map(i => (
                  <tr key={i.IrsaliyeId}>
                    <td><strong>{i.IrsaliyeKodu}</strong></td>
                    <td><span className={`erp-badge ${i.Yon === "Alış" ? "orange" : "blue"}`}>{i.Yon === "Alış" ? "📥 Alış" : "🚚 Satış"}</span></td>
                    <td>{i.CariAdi || i.CariKodu || "-"}</td>
                    <td>{i.IrsaliyeTarihi ? new Date(i.IrsaliyeTarihi).toLocaleDateString("tr-TR") : ""}</td>
                    <td>{Number(i.ToplamTutar || 0).toLocaleString("tr-TR")} ₺</td>
                    <td><button className="irs-btn-del-sm" onClick={() => handleSil(i.IrsaliyeId)}>Sil</button></td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "#999", padding: 24 }}>Bu bölümde kayıt bulunmuyor.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default IrsaliyeListPage;
