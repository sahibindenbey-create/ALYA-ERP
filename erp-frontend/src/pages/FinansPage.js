import React, { useState, useEffect } from "react";
import axios from "axios";
import SearchableSelect from "../components/SearchableSelect";
import ExportToolbar from "../components/ExportToolbar";
import "./FinansPage.css";

const API_URL = "http://localhost:5000/api";

const emptyHesap = { Ad: "", Tip: "Kasa", BankaAdi: "", SubeAdi: "", HesapNoIBAN: "", ParaBirimi: "TL", AcilisBakiyesi: "0" };
const emptyIslem = { KasaBankaId: "", CariKodu: "", CariAdi: "", Tarih: new Date().toISOString().split("T")[0], Tutar: "", Aciklama: "" };

const FinansPage = () => {
  const [hesaplar, setHesaplar] = useState([]);
  const [hareketler, setHareketler] = useState([]);
  const [cariler, setCariler] = useState([]);
  const [loading, setLoading] = useState(false);

  const [hesapForm, setHesapForm] = useState(emptyHesap);
  const [hesapFormAcik, setHesapFormAcik] = useState(false);

  const [islemTipi, setIslemTipi] = useState("Tahsilat");
  const [islemForm, setIslemForm] = useState(emptyIslem);

  const [filtreHesap, setFiltreHesap] = useState("");

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [h, f, c] = await Promise.all([
        axios.get(`${API_URL}/kasa-banka`).then(r => r.data).catch(() => []),
        axios.get(`${API_URL}/finans-hareket`).then(r => r.data).catch(() => []),
        axios.get(`${API_URL}/cariler`).then(r => r.data).catch(() => []),
      ]);
      setHesaplar(h); setHareketler(f); setCariler(c);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const toplamBakiye = hesaplar.reduce((a, h) => a + Number(h.Bakiye || 0), 0);
  const kasaBakiye = hesaplar.filter(h => h.Tip === "Kasa").reduce((a, h) => a + Number(h.Bakiye || 0), 0);
  const bankaBakiye = hesaplar.filter(h => h.Tip === "Banka").reduce((a, h) => a + Number(h.Bakiye || 0), 0);

  const handleHesapEkle = async () => {
    if (!hesapForm.Ad) return alert("Hesap adı zorunludur.");
    try {
      await axios.post(`${API_URL}/kasa-banka`, hesapForm);
      setHesapForm(emptyHesap);
      setHesapFormAcik(false);
      fetchAll();
    } catch (err) {
      alert("Hesap eklenirken hata oluştu: " + (err.response?.data?.error || err.message));
    }
  };

  const handleCariSecim = (kod) => {
    const c = cariler.find(x => x.CariKodu === kod);
    setIslemForm(f => ({ ...f, CariKodu: kod, CariAdi: c ? c.CariAdi : "" }));
  };

  const handleIslemKaydet = async () => {
    if (!islemForm.KasaBankaId || !islemForm.Tutar) {
      return alert("Kasa/Banka hesabı ve tutar zorunludur.");
    }
    const endpoint = islemTipi === "Tahsilat" ? "tahsilat" : "odeme";
    try {
      await axios.post(`${API_URL}/${endpoint}`, islemForm);
      alert(`${islemTipi} kaydedildi.`);
      setIslemForm(emptyIslem);
      fetchAll();
    } catch (err) {
      alert("Kayıt sırasında hata oluştu: " + (err.response?.data?.error || err.message));
    }
  };

  const gorunenHareketler = filtreHesap
    ? hareketler.filter(h => String(h.KasaBankaId) === String(filtreHesap))
    : hareketler;

  const excelCols = [
    { key: "Tarih", label: "Tarih" }, { key: "KasaBankaAdi", label: "Hesap" }, { key: "Tip", label: "Tip" },
    { key: "Tutar", label: "Tutar" }, { key: "Kaynak", label: "Kaynak" }, { key: "CariAdi", label: "Cari" }, { key: "Aciklama", label: "Açıklama" }
  ];

  return (
    <div className="fin-container">
      <div className="erp-stat-grid">
        <div className="erp-stat-card">
          <div className="erp-stat-icon success">💰</div>
          <div><div className="erp-stat-label">Toplam Bakiye</div><div className="erp-stat-value">{toplamBakiye.toLocaleString()} ₺</div></div>
        </div>
        <div className="erp-stat-card">
          <div className="erp-stat-icon">💵</div>
          <div><div className="erp-stat-label">Kasa Bakiyesi</div><div className="erp-stat-value">{kasaBakiye.toLocaleString()} ₺</div></div>
        </div>
        <div className="erp-stat-card">
          <div className="erp-stat-icon">🏦</div>
          <div><div className="erp-stat-label">Banka Bakiyesi</div><div className="erp-stat-value">{bankaBakiye.toLocaleString()} ₺</div></div>
        </div>
      </div>

      <div className="fin-card">
        <div className="fin-card-header">
          <h3>Kasa / Banka Hesapları</h3>
          <button className="fin-btn-add-hesap" onClick={() => setHesapFormAcik(!hesapFormAcik)}>
            {hesapFormAcik ? "✕ Vazgeç" : "+ Yeni Hesap"}
          </button>
        </div>

        {hesapFormAcik && (
          <div className="fin-hesap-form">
            <input placeholder="Hesap Adı" value={hesapForm.Ad} onChange={e => setHesapForm({ ...hesapForm, Ad: e.target.value })} />
            <select value={hesapForm.Tip} onChange={e => setHesapForm({ ...hesapForm, Tip: e.target.value })}>
              <option value="Kasa">Kasa</option><option value="Banka">Banka</option>
            </select>
            {hesapForm.Tip === "Banka" && (
              <>
                <input placeholder="Banka Adı" value={hesapForm.BankaAdi} onChange={e => setHesapForm({ ...hesapForm, BankaAdi: e.target.value })} />
                <input placeholder="IBAN / Hesap No" value={hesapForm.HesapNoIBAN} onChange={e => setHesapForm({ ...hesapForm, HesapNoIBAN: e.target.value })} />
              </>
            )}
            <input type="number" placeholder="Açılış Bakiyesi" value={hesapForm.AcilisBakiyesi} onChange={e => setHesapForm({ ...hesapForm, AcilisBakiyesi: e.target.value })} />
            <button className="fin-btn-save-sm" onClick={handleHesapEkle}>Kaydet</button>
          </div>
        )}

        <div className="fin-hesap-grid">
          {hesaplar.map(h => (
            <div key={h.KasaBankaId} className="fin-hesap-card">
              <div className="fin-hesap-tip">{h.Tip === "Kasa" ? "💵" : "🏦"} {h.Tip}</div>
              <div className="fin-hesap-ad">{h.Ad}</div>
              {h.BankaAdi && <div className="fin-hesap-detay">{h.BankaAdi} {h.HesapNoIBAN && `— ${h.HesapNoIBAN}`}</div>}
              <div className={`fin-hesap-bakiye ${h.Bakiye < 0 ? "neg" : ""}`}>{Number(h.Bakiye).toLocaleString()} {h.ParaBirimi}</div>
            </div>
          ))}
          {hesaplar.length === 0 && <p style={{ color: "#999" }}>Henüz hesap yok.</p>}
        </div>
      </div>

      <div className="fin-card">
        <div className="fin-yon-toggle">
          <button className={islemTipi === "Tahsilat" ? "active" : ""} onClick={() => setIslemTipi("Tahsilat")}>💰 Tahsilat (Para Girişi)</button>
          <button className={islemTipi === "Ödeme" ? "active" : ""} onClick={() => setIslemTipi("Ödeme")}>💸 Ödeme (Para Çıkışı)</button>
        </div>

        <div className="fin-islem-grid">
          <div className="fin-field">
            <label>Kasa / Banka Hesabı *</label>
            <SearchableSelect
              options={hesaplar.map(h => ({ value: h.KasaBankaId, label: h.Ad, sublabel: h.Tip }))}
              value={islemForm.KasaBankaId}
              onChange={val => setIslemForm({ ...islemForm, KasaBankaId: val })}
              placeholder="Hesap seçin..."
            />
          </div>
          <div className="fin-field">
            <label>Cari (opsiyonel)</label>
            <SearchableSelect
              options={cariler.map(c => ({ value: c.CariKodu, label: c.CariAdi, sublabel: c.CariKodu }))}
              value={islemForm.CariKodu}
              onChange={handleCariSecim}
              placeholder="Cari seçin..."
            />
          </div>
          <div className="fin-field"><label>Tarih</label><input type="date" value={islemForm.Tarih} onChange={e => setIslemForm({ ...islemForm, Tarih: e.target.value })} /></div>
          <div className="fin-field"><label>Tutar (₺) *</label><input type="number" value={islemForm.Tutar} onChange={e => setIslemForm({ ...islemForm, Tutar: e.target.value })} /></div>
          <div className="fin-field" style={{ gridColumn: "1 / -1" }}><label>Açıklama</label><input value={islemForm.Aciklama} onChange={e => setIslemForm({ ...islemForm, Aciklama: e.target.value })} /></div>
        </div>
        <button className="fin-btn-save" onClick={handleIslemKaydet}>{islemTipi} Kaydet</button>
      </div>

      <div className="fin-card">
        <div className="fin-card-header">
          <h3>Hareket Geçmişi ({gorunenHareketler.length})</h3>
          <SearchableSelect
            options={[{ value: "", label: "Tüm Hesaplar" }, ...hesaplar.map(h => ({ value: h.KasaBankaId, label: h.Ad, sublabel: h.Tip }))]}
            value={filtreHesap}
            onChange={setFiltreHesap}
            placeholder="Hesaba göre filtrele..."
          />
        </div>
        <ExportToolbar data={gorunenHareketler} columns={excelCols} filename="finans-hareketleri" />
        {loading ? <p style={{ color: "#888" }}>Yükleniyor...</p> : (
          <table className="fin-table">
            <thead><tr><th>Tarih</th><th>Hesap</th><th>Tip</th><th>Kaynak</th><th>Cari</th><th>Açıklama</th><th>Tutar</th></tr></thead>
            <tbody>
              {gorunenHareketler.map(h => (
                <tr key={h.HareketId}>
                  <td>{new Date(h.Tarih).toLocaleDateString("tr-TR")}</td>
                  <td>{h.KasaBankaAdi}</td>
                  <td><span className={`erp-badge ${h.Tip === "Giriş" ? "green" : "red"}`}>{h.Tip === "Giriş" ? "↓ Giriş" : "↑ Çıkış"}</span></td>
                  <td>{h.Kaynak}</td>
                  <td>{h.CariAdi || "—"}</td>
                  <td>{h.Aciklama}</td>
                  <td style={{ fontWeight: 700, color: h.Tip === "Giriş" ? "var(--success)" : "var(--danger)" }}>
                    {h.Tip === "Giriş" ? "+" : "-"}{Number(h.Tutar).toLocaleString()} ₺
                  </td>
                </tr>
              ))}
              {gorunenHareketler.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "#999", padding: 16 }}>Kayıt yok</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default FinansPage;
