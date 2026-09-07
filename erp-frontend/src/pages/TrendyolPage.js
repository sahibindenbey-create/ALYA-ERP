import React, { useState, useEffect } from "react";
import axios from "axios";
import "./TrendyolPage.css";

const API_URL = "http://localhost:5000/api/platformlar/trendyol";

const STATUS_RENK = {
  Created: "orange", Picking: "orange", Invoiced: "blue", Shipped: "blue",
  Delivered: "green", Cancelled: "red", Returned: "red", UnDelivered: "red"
};

const TrendyolPage = () => {
  const [durum, setDurum] = useState(null);
  const [siparisler, setSiparisler] = useState([]);
  const [toplamSayfa, setToplamSayfa] = useState(0);
  const [sayfa, setSayfa] = useState(0);
  const [statusFiltre, setStatusFiltre] = useState("");
  const [loading, setLoading] = useState(false);
  const [senkronEdiliyor, setSenkronEdiliyor] = useState(false);
  const [secili, setSecili] = useState([]);
  const [kargoFirmalari, setKargoFirmalari] = useState([]);

  const fetchDurum = async () => {
    try {
      const res = await axios.get(`${API_URL}/durum`);
      setDurum(res.data);
    } catch (err) {
      setDurum({ configured: false });
    }
  };

  const fetchSiparisler = async (p = sayfa) => {
    setLoading(true);
    try {
      const params = { page: p, size: 50 };
      if (statusFiltre) params.status = statusFiltre;
      const res = await axios.get(`${API_URL}/siparisler`, { params });
      setSiparisler(res.data.content || []);
      setToplamSayfa(res.data.totalPages || 0);
    } catch (err) {
      alert("Trendyol siparişleri alınamadı: " + (err.response?.data?.error || err.message));
      setSiparisler([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchKargoFirmalari = async () => {
    try {
      const res = await axios.get(`${API_URL}/kargo-firmalari`);
      setKargoFirmalari(res.data.cargoProviders || []);
    } catch (err) { /* sessiz geç */ }
  };

  useEffect(() => {
    fetchDurum();
    fetchKargoFirmalari();
  }, []);

  useEffect(() => {
    if (durum?.configured) fetchSiparisler(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durum, statusFiltre]);

  const toggleSecim = (pkg) => {
    setSecili(prev =>
      prev.includes(pkg) ? prev.filter(p => p !== pkg) : [...prev, pkg]
    );
  };

  const tumunuSec = () => {
    setSecili(secili.length === siparisler.length ? [] : [...siparisler]);
  };

  const senkronizeEt = async () => {
    if (secili.length === 0) return alert("Senkronize edilecek sipariş seçin (ya da 'Tümünü Seç').");
    setSenkronEdiliyor(true);
    try {
      const res = await axios.post(`${API_URL}/senkronize`, { packages: secili });
      alert(`${res.data.inserted} yeni sipariş içe aktarıldı, ${res.data.skipped} zaten mevcuttu (atlandı).`);
      setSecili([]);
    } catch (err) {
      alert("Senkronizasyon sırasında hata: " + (err.response?.data?.error || err.message));
    } finally {
      setSenkronEdiliyor(false);
    }
  };

  const kargoDegistir = async (pkg, cargoCode) => {
    const packageId = pkg.shipmentPackageId ?? pkg.id;
    try {
      await axios.put(`${API_URL}/kargo-degistir/${packageId}`, { cargoProvider: cargoCode });
      alert("Kargo firması güncellendi.");
      fetchSiparisler();
    } catch (err) {
      alert("Kargo firması değiştirilirken hata: " + (err.response?.data?.error || err.message));
    }
  };

  if (durum === null) return <div className="ty-container"><p>Yükleniyor...</p></div>;

  if (!durum.configured) {
    return (
      <div className="ty-container">
        <div className="ty-card ty-warn">
          <h3>⚠️ Trendyol Bağlantısı Yapılandırılmamış</h3>
          <p>
            Backend'deki <code>.env</code> dosyasında <code>TRENDYOL_SELLER_ID</code>, <code>TRENDYOL_API_KEY</code> ve{" "}
            <code>TRENDYOL_API_SECRET</code> değerlerinin dolu olduğundan emin ol, sonra backend'i yeniden başlat.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ty-container">
      <div className="ty-summary">
        <div className="ty-summary-card">
          <div className="ty-summary-label">Bağlantı Durumu</div>
          <div className="ty-summary-value green">✓ Bağlı</div>
        </div>
        <div className="ty-summary-card">
          <div className="ty-summary-label">Satıcı ID</div>
          <div className="ty-summary-value">{durum.sellerId}</div>
        </div>
        <div className="ty-summary-card">
          <div className="ty-summary-label">Bu Sayfadaki Sipariş</div>
          <div className="ty-summary-value">{siparisler.length}</div>
        </div>
      </div>

      <div className="ty-card">
        <div className="ty-toolbar">
          <select value={statusFiltre} onChange={e => setStatusFiltre(e.target.value)}>
            <option value="">Tüm Durumlar</option>
            <option value="Created">Yeni (Created)</option>
            <option value="Picking">Hazırlanıyor</option>
            <option value="Invoiced">Faturalandı</option>
            <option value="Shipped">Kargoda</option>
            <option value="Delivered">Teslim Edildi</option>
            <option value="Cancelled">İptal</option>
          </select>
          <button className="ty-btn-secondary" onClick={() => fetchSiparisler(sayfa)}>🔄 Yenile</button>
          <button className="ty-btn-secondary" onClick={tumunuSec}>{secili.length === siparisler.length ? "Seçimi Kaldır" : "Tümünü Seç"}</button>
          <button className="ty-btn-primary" onClick={senkronizeEt} disabled={senkronEdiliyor || secili.length === 0}>
            {senkronEdiliyor ? "Aktarılıyor..." : `Seçilenleri ERP'ye Aktar (${secili.length})`}
          </button>
        </div>

        {loading ? <p style={{ color: "#888" }}>Yükleniyor...</p> : (
          <table className="ty-table">
            <thead>
              <tr><th></th><th>Sipariş No</th><th>Tarih</th><th>Müşteri</th><th>Ürün Sayısı</th><th>Tutar</th><th>Durum</th><th>Kargo</th></tr>
            </thead>
            <tbody>
              {siparisler.map((s, idx) => (
                <tr key={s.shipmentPackageId || s.orderNumber || idx}>
                  <td><input type="checkbox" checked={secili.includes(s)} onChange={() => toggleSecim(s)} /></td>
                  <td><strong>{s.orderNumber}</strong></td>
                  <td>{s.orderDate ? new Date(s.orderDate).toLocaleDateString("tr-TR") : "—"}</td>
                  <td>{[s.customerFirstName, s.customerLastName].filter(Boolean).join(" ") || "—"}</td>
                  <td>{s.lines?.length ?? "—"}</td>
                  <td style={{ fontWeight: 700 }}>{s.grossAmount ? `${Number(s.grossAmount).toLocaleString()} ₺` : "—"}</td>
                  <td><span className={`erp-badge ${STATUS_RENK[s.status] || "blue"}`}>{s.status || "—"}</span></td>
                  <td>
                    <select
                      defaultValue=""
                      onChange={e => { if (e.target.value) kargoDegistir(s, e.target.value); }}
                      className="ty-kargo-select"
                    >
                      <option value="">{s.cargoProviderName || "Kargo Seç"}</option>
                      {kargoFirmalari.map(k => <option key={k.code} value={k.code}>{k.name}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {siparisler.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: "#999", padding: 16 }}>Sipariş bulunamadı</td></tr>}
            </tbody>
          </table>
        )}

        {toplamSayfa > 1 && (
          <div className="ty-pagination">
            <button disabled={sayfa === 0} onClick={() => { setSayfa(sayfa - 1); fetchSiparisler(sayfa - 1); }}>← Önceki</button>
            <span>Sayfa {sayfa + 1} / {toplamSayfa}</span>
            <button disabled={sayfa >= toplamSayfa - 1} onClick={() => { setSayfa(sayfa + 1); fetchSiparisler(sayfa + 1); }}>Sonraki →</button>
          </div>
        )}
      </div>

      <div className="ty-note">
        ℹ️ "Seçilenleri ERP'ye Aktar" ile seçtiğin Trendyol siparişleri sisteme kaydedilir (tekrar aktarırsan zaten var olanlar atlanır).
        Fatura oluşturma / e-fatura linki gönderme ve kargo etiketi indirme uçları backend'de hazır ama henüz bu ekranda arayüzü yok —
        istersen bir sonraki adımda ekleyebilirim.
      </div>
    </div>
  );
};

export default TrendyolPage;
