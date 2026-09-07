import React, { useState, useEffect } from "react";
import axios from "axios";
import SearchableSelect from "../components/SearchableSelect";
import ExportToolbar from "../components/ExportToolbar";
import "./FaturaForm.css";
import "./TeklifForm.css";

const API_URL = "http://localhost:5000/api";
const DURUMLAR = ["Taslak", "Gönderildi", "Kabul Edildi", "Reddedildi", "Süresi Doldu"];

const emptyForm = {
  teklifKodu: "", yon: "Satış", cariId: "", cariKodu: "", cariAdi: "",
  teklifTarihi: new Date().toISOString().split("T")[0], gecerlilikTarihi: "",
  odemeSekli: "", teslimatSuresi: "", notlar: "", durum: "Taslak"
};
const emptyEntry = { urunId: "", urunKodu: "", urunAdi: "", miktar: "1", birim: "Adet", birimFiyat: "", iskonto: "0", kdvOrani: "20" };

const bugunISO = () => new Date().toISOString().split("T")[0];

const gecerlilikDurumu = (gecerlilikTarihi, durum) => {
  if (!gecerlilikTarihi || ["Kabul Edildi", "Reddedildi", "Siparişe Dönüştü"].includes(durum)) return null;
  const fark = Math.ceil((new Date(gecerlilikTarihi) - new Date(bugunISO())) / (1000 * 60 * 60 * 24));
  if (fark < 0) return { tip: "gecmis", metin: `${Math.abs(fark)} gün önce doldu` };
  if (fark <= 3) return { tip: "yaklasan", metin: `${fark} gün kaldı` };
  return null;
};

const TeklifForm = ({ defaultYon, mode = "tam" }) => {
  const [form, setForm] = useState({ ...emptyForm, yon: defaultYon || emptyForm.yon });
  const [entry, setEntry] = useState(emptyEntry);
  const [items, setItems] = useState([]);
  const [cariler, setCariler] = useState([]);
  const [urunler, setUrunler] = useState([]);
  const [teklifler, setTeklifler] = useState([]);
  const [listeYonFiltre, setListeYonFiltre] = useState("Hepsi");
  const [listeDurumFiltre, setListeDurumFiltre] = useState("Hepsi");
  const [listeSearch, setListeSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [c, u, t] = await Promise.all([
        axios.get(`${API_URL}/cariler`).then(r => r.data).catch(() => []),
        axios.get(`${API_URL}/urunler`).then(r => r.data).catch(() => []),
        axios.get(`${API_URL}/teklifler`).then(r => r.data).catch(() => []),
      ]);
      setCariler(c); setUrunler(u); setTeklifler(t);
    } catch (err) { console.error("Teklif verileri alınamadı:", err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    if (form.teklifKodu) return;
    const on = defaultYon === "Alış" ? "AT" : "ST";
    setForm(f => ({ ...f, teklifKodu: `${on}-${Date.now().toString().slice(-6)}` }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCariSecim = (cariId) => {
    const c = cariler.find(x => String(x.CariId) === String(cariId));
    setForm(f => ({ ...f, cariId, cariKodu: c ? c.CariKodu : "", cariAdi: c ? c.CariAdi : "" }));
  };

  const handleUrunSecim = (id) => {
    const u = urunler.find(x => String(x.UrunId) === String(id));
    if (u) setEntry(e => ({ ...e, urunId: id, urunKodu: u.UrunKodu, urunAdi: u.UrunAdi, birim: u.Birim || "Adet", birimFiyat: (form.yon === "Alış" ? u.AlisFiyati : u.ListeFiyati) || "", kdvOrani: String(u.KdvOrani ?? "20") }));
  };

  const satirEkle = () => {
    if (!entry.urunAdi || !entry.miktar) return alert("Ürün ve miktar girin.");
    const brut = Number(entry.miktar) * Number(entry.birimFiyat || 0);
    const iskontolu = brut * (1 - Number(entry.iskonto || 0) / 100);
    const kdvTutari = iskontolu * (Number(entry.kdvOrani) / 100);
    const satirToplam = iskontolu + kdvTutari;
    setItems(prev => [...prev, { ...entry, araToplam: iskontolu, kdvTutari, satirToplam, id: Date.now() }]);
    setEntry(emptyEntry);
  };

  const satirSil = (id) => setItems(prev => prev.filter(it => it.id !== id));

  const resetForm = () => {
    const on = defaultYon === "Alış" ? "AT" : "ST";
    setForm(f => ({ ...emptyForm, yon: defaultYon || f.yon, teklifKodu: `${on}-${Date.now().toString().slice(-6)}` }));
    setItems([]);
  };

  const araToplam = items.reduce((a, b) => a + b.araToplam, 0);
  const kdvToplam = items.reduce((a, b) => a + b.kdvTutari, 0);
  const genelToplam = araToplam + kdvToplam;

  const handleKaydet = async () => {
    if (!form.cariAdi) return alert("Lütfen bir cari seçin.");
    if (items.length === 0) return alert("En az bir ürün satırı eklemelisiniz.");
    try {
      await axios.post(`${API_URL}/teklifler`, { form, items });
      alert("Teklif kaydedildi.");
      resetForm();
      fetchAll();
    } catch (err) {
      alert("Kaydedilirken hata oluştu: " + (err.response?.data?.error || err.message));
    }
  };

  const handleDurumDegis = async (id, durum) => {
    try {
      await axios.put(`${API_URL}/teklifler/${id}/durum`, { Durum: durum });
      fetchAll();
    } catch (err) { alert("Güncellenirken hata oluştu."); }
  };

  const handleSipariseDonustur = async (id) => {
    if (!window.confirm("Bu teklif siparişe dönüştürülsün mü?")) return;
    try {
      const res = await axios.post(`${API_URL}/teklifler/${id}/siparise-donustur`);
      alert(`Sipariş oluşturuldu (${res.data.siparisId}).`);
      fetchAll();
    } catch (err) { alert("Dönüştürülürken hata oluştu: " + (err.response?.data?.error || err.message)); }
  };

  const handleSil = async (id) => {
    if (!window.confirm("Bu teklifi silmek istediğinize emin misiniz?")) return;
    try {
      await axios.delete(`${API_URL}/teklifler/${id}`);
      fetchAll();
    } catch (err) { alert("Silinirken hata oluştu."); }
  };

  const excelCols = [
    { key: "TeklifKodu", label: "Kod" }, { key: "Yon", label: "Yön" }, { key: "CariAdi", label: "Cari" },
    { key: "TeklifTarihi", label: "Tarih" }, { key: "GecerlilikTarihi", label: "Geçerlilik" },
    { key: "GenelToplam", label: "Genel Toplam" }, { key: "Durum", label: "Durum" }
  ];

  const gorunenTeklifler = mode === "liste"
    ? teklifler
        .filter(t => listeYonFiltre === "Hepsi" || t.Yon === listeYonFiltre)
        .filter(t => listeDurumFiltre === "Hepsi" || t.Durum === listeDurumFiltre)
        .filter(t => (t.CariAdi || "").toLowerCase().includes(listeSearch.toLowerCase()) || (t.TeklifKodu || "").toLowerCase().includes(listeSearch.toLowerCase()))
    : (defaultYon ? teklifler.filter(t => t.Yon === defaultYon) : teklifler);

  return (
    <div className="fat-container">
      {mode === "tam" && (
      <div className="fat-form-card">
        {!defaultYon && (
        <div className="fat-yon-toggle">
          <button type="button" className={form.yon === "Satış" ? "active" : ""} onClick={() => setForm({ ...form, yon: "Satış", cariId: "", cariKodu: "", cariAdi: "" })}>💰 Satış Teklifi</button>
          <button type="button" className={form.yon === "Alış" ? "active" : ""} onClick={() => setForm({ ...form, yon: "Alış", cariId: "", cariKodu: "", cariAdi: "" })}>🧾 Alış Teklifi</button>
        </div>
        )}
        {defaultYon && (
          <div className="fat-yon-toggle">
            <button type="button" className="active">
              {defaultYon === "Alış" ? "🧾 Alış Teklifi" : "💰 Satış Teklifi"}
            </button>
          </div>
        )}

        <div className="fat-grid">
          <div className="fat-field"><label>Teklif No</label><input value={form.teklifKodu} readOnly /></div>
          <div className="fat-field"><label>Teklif Tarihi</label><input type="date" value={form.teklifTarihi} onChange={e => setForm({ ...form, teklifTarihi: e.target.value })} /></div>
          <div className="fat-field"><label>Geçerlilik Tarihi</label><input type="date" value={form.gecerlilikTarihi} onChange={e => setForm({ ...form, gecerlilikTarihi: e.target.value })} /></div>
          <div className="fat-field" style={{ flex: 2 }}>
            <label>{form.yon === "Alış" ? "Tedarikçi" : "Müşteri"}</label>
            <SearchableSelect
              options={cariler.map(c => ({ value: c.CariId, label: c.CariAdi, sublabel: c.CariKodu }))}
              value={form.cariId}
              onChange={handleCariSecim}
              placeholder="Firma seçin..."
            />
          </div>
        </div>

        <div className="fat-grid">
          <div className="fat-field"><label>Ödeme Şekli</label><input value={form.odemeSekli} onChange={e => setForm({ ...form, odemeSekli: e.target.value })} placeholder="Örn: Peşin, 30 gün vade" /></div>
          <div className="fat-field" style={{ flex: 2 }}><label>Teslimat Süresi</label><input value={form.teslimatSuresi} onChange={e => setForm({ ...form, teslimatSuresi: e.target.value })} placeholder="Örn: Siparişten sonra 15 iş günü" /></div>
        </div>

        <div className="fat-field" style={{ marginBottom: 16 }}>
          <label>Notlar</label>
          <input value={form.notlar} onChange={e => setForm({ ...form, notlar: e.target.value })} />
        </div>

        <h4 className="fat-subheader">Ürün Satırları</h4>
        <div className="fat-entry-row">
          <div style={{ flex: 2 }}>
            <SearchableSelect
              options={urunler.map(u => ({ value: u.UrunId, label: u.UrunAdi, sublabel: u.UrunKodu }))}
              value={entry.urunId}
              onChange={handleUrunSecim}
              placeholder="Ürün seçin..."
            />
          </div>
          <input type="number" placeholder="Miktar" style={{ width: 80 }} value={entry.miktar} onChange={e => setEntry({ ...entry, miktar: e.target.value })} />
          <input value={entry.birim} onChange={e => setEntry({ ...entry, birim: e.target.value })} placeholder="Birim" style={{ width: 80 }} />
          <input type="number" placeholder="Birim Fiyat" style={{ width: 100 }} value={entry.birimFiyat} onChange={e => setEntry({ ...entry, birimFiyat: e.target.value })} />
          <input type="number" placeholder="İsk.%" style={{ width: 70 }} value={entry.iskonto} onChange={e => setEntry({ ...entry, iskonto: e.target.value })} />
          <select style={{ width: 80 }} value={entry.kdvOrani} onChange={e => setEntry({ ...entry, kdvOrani: e.target.value })}>
            <option value="0">KDV %0</option><option value="1">KDV %1</option><option value="10">KDV %10</option><option value="20">KDV %20</option>
          </select>
          <button className="fat-btn-add" onClick={satirEkle}>+ Ekle</button>
        </div>

        <table className="fat-table">
          <thead><tr><th>Ürün</th><th>Miktar</th><th>Birim Fiyat</th><th>İsk.%</th><th>KDV</th><th>Satır Toplam</th><th></th></tr></thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id}>
                <td>{it.urunAdi}</td>
                <td>{it.miktar} {it.birim}</td>
                <td>{Number(it.birimFiyat).toLocaleString()} ₺</td>
                <td>%{it.iskonto}</td>
                <td>%{it.kdvOrani}</td>
                <td style={{ fontWeight: 700 }}>{it.satirToplam.toLocaleString()} ₺</td>
                <td><button className="fat-btn-del-sm" onClick={() => satirSil(it.id)}>Sil</button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "#999", padding: 10 }}>Henüz ürün eklenmedi</td></tr>}
          </tbody>
        </table>

        <div className="fat-form-footer">
          <div className="fat-totals">
            <div>Ara Toplam: <strong>{araToplam.toLocaleString()} ₺</strong></div>
            <div>KDV Toplam: <strong>{kdvToplam.toLocaleString()} ₺</strong></div>
            <div className="fat-genel-toplam">Genel Toplam: <span>{genelToplam.toLocaleString()} ₺</span></div>
          </div>
          <button className="fat-btn-save" onClick={handleKaydet}>Teklifi Kaydet</button>
        </div>
      </div>
      )}

      <div className="fat-list-card">
        <h3>{mode === "liste" ? "Tüm Teklifler" : defaultYon === "Alış" ? "Alış Teklifleri" : "Satış Teklifleri"} ({gorunenTeklifler.length})</h3>
        {mode === "liste" && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Cari adı veya teklif no ara..."
              value={listeSearch}
              onChange={e => setListeSearch(e.target.value)}
              style={{ flex: 2, minWidth: 220, padding: "8px 12px", borderRadius: 6, border: "1px solid #ccc" }}
            />
            <select value={listeYonFiltre} onChange={e => setListeYonFiltre(e.target.value)} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #ccc" }}>
              <option value="Hepsi">Tüm Yönler</option>
              <option value="Satış">💰 Satış</option>
              <option value="Alış">🧾 Alış</option>
            </select>
            <select value={listeDurumFiltre} onChange={e => setListeDurumFiltre(e.target.value)} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #ccc" }}>
              <option value="Hepsi">Tüm Durumlar</option>
              {DURUMLAR.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}
        <ExportToolbar data={gorunenTeklifler} columns={excelCols} filename="teklif-listesi" />
        {loading ? <p style={{ color: "#888" }}>Yükleniyor...</p> : (
          <table className="fat-table">
            <thead><tr><th>Kod</th><th>Yön</th><th>Cari</th><th>Tarih</th><th>Geçerlilik</th><th>Toplam</th><th>Durum</th><th>İşlem</th></tr></thead>
            <tbody>
              {gorunenTeklifler.map(t => {
                const gc = gecerlilikDurumu(t.GecerlilikTarihi, t.Durum);
                return (
                  <tr key={t.TeklifId}>
                    <td>{t.TeklifKodu}</td>
                    <td><span className={`erp-badge ${t.Yon === "Alış" ? "orange" : "blue"}`}>{t.Yon === "Alış" ? "🧾 Alış" : "💰 Satış"}</span></td>
                    <td>{t.CariAdi}</td>
                    <td>{t.TeklifTarihi ? new Date(t.TeklifTarihi).toLocaleDateString("tr-TR") : ""}</td>
                    <td>
                      {t.GecerlilikTarihi ? new Date(t.GecerlilikTarihi).toLocaleDateString("tr-TR") : "—"}
                      {gc && <div className={`teklif-sure-badge ${gc.tip}`}>{gc.metin}</div>}
                    </td>
                    <td style={{ fontWeight: 700 }}>{Number(t.GenelToplam || 0).toLocaleString()} ₺</td>
                    <td>
                      <select value={t.Durum} onChange={e => handleDurumDegis(t.TeklifId, e.target.value)} className="fat-durum-select">
                        {DURUMLAR.map(d => <option key={d} value={d}>{d}</option>)}
                        {t.Durum === "Siparişe Dönüştü" && <option value="Siparişe Dönüştü">Siparişe Dönüştü</option>}
                      </select>
                    </td>
                    <td>
                      {t.Durum === "Kabul Edildi" && !t.DonusturulenSiparisId && (
                        <button className="fat-btn-add" onClick={() => handleSipariseDonustur(t.TeklifId)} style={{ marginRight: 6 }}>Siparişe Dönüştür</button>
                      )}
                      <button className="fat-btn-del-sm" onClick={() => handleSil(t.TeklifId)}>Sil</button>
                    </td>
                  </tr>
                );
              })}
              {gorunenTeklifler.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: "#999", padding: 16 }}>Kayıt yok</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default TeklifForm;
