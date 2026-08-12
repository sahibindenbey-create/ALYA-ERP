import React, { useState, useEffect } from "react";
import axios from "axios";
import ExportToolbar from "../components/ExportToolbar";
import "./KayitlarPage.css";

const API_URL = "http://localhost:5000/api";

const TABS = [
  { key: "cariler", label: "Cariler" },
  { key: "urunler", label: "Ürün / Hizmet" },
  { key: "siparisler", label: "Siparişler" },
  { key: "receteler", label: "Reçeteler" },
  { key: "fason", label: "Fason" },
];

const KayitlarPage = () => {
  const [activeTab, setActiveTab] = useState("cariler");
  const [data, setData] = useState({ cariler: [], urunler: [], siparisler: [], receteler: [], fason: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [cariler, urunler, siparisler, receteler, fason] = await Promise.all([
        axios.get(`${API_URL}/cariler`).then(r => r.data).catch(() => []),
        axios.get(`${API_URL}/urunler`).then(r => r.data).catch(() => []),
        axios.get(`${API_URL}/siparisler`).then(r => r.data).catch(() => []),
        axios.get(`${API_URL}/receteler`).then(r => r.data).catch(() => []),
        axios.get(`${API_URL}/fason`).then(r => r.data).catch(() => []),
      ]);
      setData({ cariler, urunler, siparisler, receteler, fason });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const filterRows = (rows, fields) => {
    if (!search) return rows;
    const s = search.toLowerCase();
    return rows.filter(row => fields.some(f => String(row[f] || "").toLowerCase().includes(s)));
  };

  const renderTable = () => {
    if (loading) return <p style={{ color: "#888" }}>Yükleniyor...</p>;

    switch (activeTab) {
      case "cariler": {
        const rows = filterRows(data.cariler, ["CariKodu", "CariAdi"]);
        return (
          <table className="ky-table">
            <thead><tr><th>Kod</th><th>Ünvan</th><th>Tür</th><th>Vergi/TC No</th><th>İl</th><th>Vade Günü</th></tr></thead>
            <tbody>
              {rows.map(c => (
                <tr key={c.CariId}>
                  <td><strong>{c.CariKodu}</strong></td>
                  <td>{c.CariAdi}</td>
                  <td>{c.CariTipi === 1 ? "Müşteri" : c.CariTipi === 2 ? "Tedarikçi" : "Her İkisi"}</td>
                  <td>{c.VergiNo || c.TCNo}</td>
                  <td>{c.FaturaIl}</td>
                  <td>{c.VadeGunu}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="ky-empty">Kayıt yok</td></tr>}
            </tbody>
          </table>
        );
      }
      case "urunler": {
        const rows = filterRows(data.urunler, ["UrunKodu", "UrunAdi"]);
        return (
          <table className="ky-table">
            <thead><tr><th>Kod</th><th>Ad</th><th>Tür</th><th>Kategori</th><th>Stok</th><th>Birim</th><th>Liste Fiyatı</th></tr></thead>
            <tbody>
              {rows.map(u => (
                <tr key={u.UrunId} className={u.Tur !== "Hizmet" && Number(u.StokMiktari) <= Number(u.KritikStokSeviyesi) ? "ky-row-warn" : ""}>
                  <td><strong>{u.UrunKodu}</strong></td>
                  <td>{u.UrunAdi}</td>
                  <td>{u.Tur === "Hizmet" ? "🔧 Hizmet" : "📦 Ürün"}</td>
                  <td>{u.Kategori}</td>
                  <td>{u.Tur === "Hizmet" ? "—" : u.StokMiktari}</td>
                  <td>{u.Birim}</td>
                  <td>{Number(u.ListeFiyati || 0).toLocaleString()} ₺</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="ky-empty">Kayıt yok</td></tr>}
            </tbody>
          </table>
        );
      }
      case "fason": {
        const rows = filterRows(data.fason, ["FasonKodu", "CariAdi", "UrunAdi"]);
        return (
          <table className="ky-table">
            <thead><tr><th>Kod</th><th>Fasoncu</th><th>Ürün</th><th>Gönderilen</th><th>Dönen</th><th>Durum</th></tr></thead>
            <tbody>
              {rows.map(f => (
                <tr key={f.FasonId}>
                  <td><strong>{f.FasonKodu}</strong></td>
                  <td>{f.CariAdi}</td>
                  <td>{f.UrunAdi}</td>
                  <td>{f.GonderilenMiktar} {f.Birim}</td>
                  <td>{f.DonenMiktar || "—"}</td>
                  <td>{f.Durum}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="ky-empty">Kayıt yok</td></tr>}
            </tbody>
          </table>
        );
      }
      case "siparisler": {
        const rows = filterRows(data.siparisler, ["SiparisKodu", "CariAdi"]);
        return (
          <table className="ky-table">
            <thead><tr><th>Sipariş No</th><th>Tarih</th><th>Cari</th><th>Tip</th><th>Durum</th><th>Toplam</th></tr></thead>
            <tbody>
              {rows.map(s => (
                <tr key={s.SiparisId}>
                  <td><strong>{s.SiparisKodu}</strong></td>
                  <td>{s.SiparisTarihi ? new Date(s.SiparisTarihi).toLocaleDateString("tr-TR") : ""}</td>
                  <td>{s.CariAdi}</td>
                  <td>{s.SiparisTipi}</td>
                  <td>{s.Durum}</td>
                  <td>{Number(s.ToplamTutar || 0).toLocaleString()} ₺</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="ky-empty">Kayıt yok</td></tr>}
            </tbody>
          </table>
        );
      }
      case "receteler": {
        const rows = filterRows(data.receteler, ["ReceteKodu", "MamulAdi"]);
        return (
          <table className="ky-table">
            <thead><tr><th>Kod</th><th>Mamul</th><th>Açıklama</th><th>Oluşturulma</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.ReceteId}>
                  <td><strong>{r.ReceteKodu}</strong></td>
                  <td>{r.MamulAdi}</td>
                  <td>{r.Aciklama}</td>
                  <td>{r.CreatedAt ? new Date(r.CreatedAt).toLocaleDateString("tr-TR") : ""}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={4} className="ky-empty">Kayıt yok</td></tr>}
            </tbody>
          </table>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="ky-container">
      <div className="ky-summary">
        {TABS.map(t => (
          <div key={t.key} className={`ky-summary-card ${activeTab === t.key ? "active" : ""}`} onClick={() => setActiveTab(t.key)}>
            <div className="ky-summary-label">{t.label}</div>
            <div className="ky-summary-value">{data[t.key]?.length ?? 0}</div>
          </div>
        ))}
      </div>

      <div className="ky-panel">
        <div className="ky-panel-header">
          <div className="ky-tabs">
            {TABS.map(t => (
              <button
                key={t.key}
                className={`ky-tab ${activeTab === t.key ? "active" : ""}`}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <input
            className="ky-search"
            placeholder="Ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <ExportToolbar
          data={data[activeTab] || []}
          columns={Object.keys((data[activeTab] || [])[0] || {}).map(k => ({ key: k, label: k }))}
          filename={`kayitlar-${activeTab}`}
        />
        {renderTable()}
      </div>
    </div>
  );
};

export default KayitlarPage;
