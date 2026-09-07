import React, { useState, useEffect } from "react";
import axios from "axios";
import SearchableSelect from "../components/SearchableSelect";
import ExportToolbar from "../components/ExportToolbar";
import "./FaturaForm.css";

const API_URL = "http://localhost:5000/api";
const ODEME_SEKILLERI = ["HAVALE/EFT", "KREDİ KARTI", "ÇEK", "NAKİT"];

const emptyForm = {
  faturaKodu: "", yon: "Satış", faturaTarihi: new Date().toISOString().split("T")[0],
  vadeTarihi: "", cariKodu: "", cariAdi: "", odemeSekli: "HAVALE/EFT"
};
const emptyEntry = { urunKodu: "", urunAdi: "", miktar: "", birim: "Adet", birimFiyat: "", kdvOrani: "20" };

const FaturaForm = ({ defaultYon, mode = "tam" }) => {
  const [form, setForm] = useState({ ...emptyForm, yon: defaultYon || emptyForm.yon });
  const [entry, setEntry] = useState(emptyEntry);
  const [items, setItems] = useState([]);
  const [cariler, setCariler] = useState([]);
  const [listeYonFiltre, setListeYonFiltre] = useState("Hepsi");
  const [listeSearch, setListeSearch] = useState("");
  const [urunler, setUrunler] = useState([]);
  const [faturalar, setFaturalar] = useState([]);
  const [irsaliyeler, setIrsaliyeler] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [c, u, f, i] = await Promise.all([
        axios.get(`${API_URL}/cariler`).then(r => r.data).catch(() => []),
        axios.get(`${API_URL}/urunler`).then(r => r.data).catch(() => []),
        axios.get(`${API_URL}/faturalar`).then(r => r.data).catch(() => []),
        axios.get(`${API_URL}/irsaliyeler`).then(r => r.data).catch(() => []),
      ]);
      setCariler(c); setUrunler(u); setFaturalar(f); setIrsaliyeler(i);
    } catch (err) {
      console.error("Fatura verileri alınamadı:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    if (form.faturaKodu) return;
    setForm(f => ({ ...f, faturaKodu: `FAT-${Date.now().toString().slice(-6)}` }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCariSecim = (kod) => {
    const c = cariler.find(x => x.CariKodu === kod);
    setForm(f => ({ ...f, cariKodu: kod, cariAdi: c ? c.CariAdi : "" }));
  };

  const handleIrsaliyedenGetir = async (irsaliyeId) => {
    if (!irsaliyeId) return;
    try {
      const res = await axios.get(`${API_URL}/irsaliyeler/${irsaliyeId}/fatura-taslak`);
      const { form: taslakForm, items: taslakItems } = res.data;
      setForm(f => ({
        ...f,
        yon: taslakForm.yon,
        cariKodu: taslakForm.cariKodu,
        cariAdi: taslakForm.cariAdi,
        irsaliyeId: taslakForm.irsaliyeId
      }));
      setItems(taslakItems.map(it => ({ ...it, id: Date.now() + Math.random() })));
      alert("İrsaliye bilgileri ve ürün satırları faturaya aktarıldı. Kontrol edip kaydedebilirsin.");
    } catch (err) {
      alert("İrsaliye taslağı alınırken hata oluştu: " + (err.response?.data?.error || err.message));
    }
  };

  const handleUrunSecim = (id) => {
    const u = urunler.find(x => String(x.UrunId) === String(id));
    if (u) setEntry(e => ({ ...e, urunKodu: u.UrunKodu, urunAdi: u.UrunAdi, birim: u.Birim || "Adet", birimFiyat: u.ListeFiyati || "", kdvOrani: String(u.KdvOrani ?? "20") }));
  };

  const satirEkle = () => {
    if (!entry.urunAdi || !entry.miktar) return alert("Ürün ve miktar girin.");
    const araToplam = Number(entry.miktar) * Number(entry.birimFiyat || 0);
    const kdvTutari = araToplam * (Number(entry.kdvOrani) / 100);
    setItems(prev => [...prev, { ...entry, araToplam, kdvTutari, id: Date.now() }]);
    setEntry(emptyEntry);
  };

  const satirSil = (id) => setItems(prev => prev.filter(it => it.id !== id));

  const resetForm = () => {
    setForm(f => ({ ...emptyForm, yon: defaultYon || f.yon, faturaKodu: `FAT-${Date.now().toString().slice(-6)}` }));
    setItems([]);
  };

  const araToplam = items.reduce((a, b) => a + b.araToplam, 0);
  const kdvToplam = items.reduce((a, b) => a + b.kdvTutari, 0);
  const genelToplam = araToplam + kdvToplam;

  const handleKaydet = async () => {
    if (!form.cariAdi) return alert("Lütfen bir cari seçin.");
    if (items.length === 0) return alert("En az bir ürün satırı eklemelisiniz.");
    try {
      await axios.post(`${API_URL}/faturalar`, { form, items });
      alert("Fatura kaydedildi.");
      resetForm();
      fetchAll();
    } catch (err) {
      alert("Kaydedilirken hata oluştu: " + (err.response?.data?.error || err.message));
    }
  };

  const handleDurumDegis = async (id, durum) => {
    try {
      await axios.put(`${API_URL}/faturalar/${id}/durum`, { Durum: durum });
      fetchAll();
    } catch (err) {
      alert("Güncellenirken hata oluştu.");
    }
  };

  const handleSil = async (id) => {
    if (!window.confirm("Bu faturayı silmek istediğinize emin misiniz?")) return;
    try {
      await axios.delete(`${API_URL}/faturalar/${id}`);
      fetchAll();
    } catch (err) {
      alert("Silinirken hata oluştu.");
    }
  };

  const excelCols = [
    { key: "FaturaKodu", label: "Kod" }, { key: "Yon", label: "Yön" }, { key: "CariAdi", label: "Cari" },
    { key: "FaturaTarihi", label: "Tarih" }, { key: "GenelToplam", label: "Genel Toplam" }, { key: "Durum", label: "Durum" }
  ];

  const gorunenFaturalar = mode === "liste"
    ? faturalar
        .filter(f => listeYonFiltre === "Hepsi" || f.Yon === listeYonFiltre)
        .filter(f => (f.CariAdi || "").toLowerCase().includes(listeSearch.toLowerCase()) || (f.FaturaKodu || "").toLowerCase().includes(listeSearch.toLowerCase()))
    : (defaultYon ? faturalar.filter(f => f.Yon === defaultYon) : faturalar);

  return (
    <div className="fat-container">
      {mode === "tam" && (
      <div className="fat-form-card">
        {!defaultYon && (
        <div className="fat-yon-toggle">
          <button type="button" className={form.yon === "Satış" ? "active" : ""} onClick={() => setForm({ ...form, yon: "Satış", cariKodu: "", cariAdi: "" })}>💰 Satış Faturası</button>
          <button type="button" className={form.yon === "Alış" ? "active" : ""} onClick={() => setForm({ ...form, yon: "Alış", cariKodu: "", cariAdi: "" })}>🧾 Alış Faturası</button>
        </div>
        )}
        {defaultYon && (
          <div className="fat-yon-toggle">
            <button type="button" className="active">
              {defaultYon === "Alış" ? "🧾 Alış Faturası" : "💰 Satış Faturası"}
            </button>
          </div>
        )}

        <div className="fat-field" style={{ marginBottom: 16 }}>
          <label>🔗 Bir İrsaliyeden Oluştur (opsiyonel)</label>
          <SearchableSelect
            options={irsaliyeler
              .filter(i => !defaultYon || i.Yon === defaultYon)
              .map(i => ({ value: i.IrsaliyeId, label: `${i.CariAdi} — ${Number(i.ToplamTutar || 0).toLocaleString()} ₺`, sublabel: i.IrsaliyeKodu }))}
            value=""
            onChange={handleIrsaliyedenGetir}
            placeholder="İrsaliyeyi seçince cari ve ürünler otomatik dolar..."
          />
        </div>

        <div className="fat-grid">
          <div className="fat-field"><label>Fatura No</label><input value={form.faturaKodu} readOnly /></div>
          <div className="fat-field"><label>Fatura Tarihi</label><input type="date" value={form.faturaTarihi} onChange={e => setForm({ ...form, faturaTarihi: e.target.value })} /></div>
          <div className="fat-field"><label>Vade Tarihi</label><input type="date" value={form.vadeTarihi} onChange={e => setForm({ ...form, vadeTarihi: e.target.value })} /></div>
          <div className="fat-field" style={{ flex: 2 }}>
            <label>{form.yon === "Alış" ? "Tedarikçi" : "Müşteri"}</label>
            <SearchableSelect
              options={cariler.filter(c => form.yon === "Alış" ? c.CariTipi !== 1 : c.CariTipi !== 2).map(c => ({ value: c.CariKodu, label: c.CariAdi, sublabel: c.CariKodu }))}
              value={form.cariKodu}
              onChange={handleCariSecim}
              placeholder="Cari seçin..."
            />
          </div>
          <div className="fat-field">
            <label>Ödeme Şekli</label>
            <select value={form.odemeSekli} onChange={e => setForm({ ...form, odemeSekli: e.target.value })}>
              {ODEME_SEKILLERI.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>

        <div className="fat-subheader">Ürün / Hizmet Satırları</div>
        <div className="fat-entry-row">
          <div style={{ flex: 2 }}>
            <SearchableSelect
              options={urunler.map(u => ({ value: u.UrunId, label: u.UrunAdi, sublabel: u.UrunKodu }))}
              value={urunler.find(u => u.UrunKodu === entry.urunKodu)?.UrunId || ""}
              onChange={handleUrunSecim}
              placeholder="Ürün / hizmet seçin..."
            />
          </div>
          <input type="number" placeholder="Miktar" style={{ width: 90 }} value={entry.miktar} onChange={e => setEntry({ ...entry, miktar: e.target.value })} />
          <input type="number" placeholder="Birim Fiyat" style={{ width: 110 }} value={entry.birimFiyat} onChange={e => setEntry({ ...entry, birimFiyat: e.target.value })} />
          <select style={{ width: 80 }} value={entry.kdvOrani} onChange={e => setEntry({ ...entry, kdvOrani: e.target.value })}>
            <option value="0">%0</option><option value="1">%1</option><option value="10">%10</option><option value="20">%20</option>
          </select>
          <button className="fat-btn-add" onClick={satirEkle}>+ Ekle</button>
        </div>

        <table className="fat-table">
          <thead><tr><th>Ürün</th><th>Miktar</th><th>Birim Fiyat</th><th>KDV</th><th>Ara Toplam</th><th></th></tr></thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id}>
                <td>{it.urunAdi}</td><td>{it.miktar}</td>
                <td>{Number(it.birimFiyat).toLocaleString()} ₺</td>
                <td>%{it.kdvOrani} ({Number(it.kdvTutari).toFixed(2)} ₺)</td>
                <td style={{ fontWeight: 700 }}>{Number(it.araToplam).toLocaleString()} ₺</td>
                <td><button className="fat-btn-del-sm" onClick={() => satirSil(it.id)}>Sil</button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "#999", padding: 10 }}>Henüz ürün eklenmedi</td></tr>}
          </tbody>
        </table>

        <div className="fat-form-footer">
          <div className="fat-totals">
            <div>Ara Toplam: <strong>{araToplam.toLocaleString()} ₺</strong></div>
            <div>KDV Toplam: <strong>{kdvToplam.toLocaleString()} ₺</strong></div>
            <div className="fat-genel-toplam">Genel Toplam: <span>{genelToplam.toLocaleString()} ₺</span></div>
          </div>
          <button className="fat-btn-save" onClick={handleKaydet}>Faturayı Kaydet</button>
        </div>
      </div>
      )}

      <div className="fat-list-card">
        <h3>{mode === "liste" ? "Tüm Faturalar" : defaultYon ? (defaultYon === "Alış" ? "Alış Faturaları" : "Satış Faturaları") : "Fatura Geçmişi"} ({gorunenFaturalar.length})</h3>
        {mode === "liste" && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Cari adı veya fatura no ara..."
              value={listeSearch}
              onChange={e => setListeSearch(e.target.value)}
              style={{ flex: 2, minWidth: 220, padding: "8px 12px", borderRadius: 6, border: "1px solid #ccc" }}
            />
            <select value={listeYonFiltre} onChange={e => setListeYonFiltre(e.target.value)} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #ccc" }}>
              <option value="Hepsi">Tüm Yönler</option>
              <option value="Satış">💰 Satış</option>
              <option value="Alış">🧾 Alış</option>
            </select>
          </div>
        )}
        <ExportToolbar data={gorunenFaturalar} columns={excelCols} filename={mode === "liste" ? "tum-faturalar" : defaultYon === "Alış" ? "alis-faturalari" : defaultYon === "Satış" ? "satis-faturalari" : "fatura-listesi"} />
        {loading ? <p style={{ color: "#888" }}>Yükleniyor...</p> : (
          <table className="fat-table">
            <thead><tr><th>Kod</th><th>Yön</th><th>Cari</th><th>Tarih</th><th>Genel Toplam</th><th>Durum</th><th>İşlem</th></tr></thead>
            <tbody>
              {gorunenFaturalar.map(f => (
                <tr key={f.FaturaId}>
                  <td><strong>{f.FaturaKodu}</strong></td>
                  <td><span className={`erp-badge ${f.Yon === "Alış" ? "orange" : "blue"}`}>{f.Yon === "Alış" ? "🧾 Alış" : "💰 Satış"}</span></td>
                  <td>{f.CariAdi}</td>
                  <td>{f.FaturaTarihi ? new Date(f.FaturaTarihi).toLocaleDateString("tr-TR") : ""}</td>
                  <td style={{ fontWeight: 700 }}>{Number(f.GenelToplam || 0).toLocaleString()} ₺</td>
                  <td>
                    <select value={f.Durum} onChange={e => handleDurumDegis(f.FaturaId, e.target.value)} className="fat-durum-select">
                      <option value="Bekliyor">Bekliyor</option>
                      <option value="Ödendi">Ödendi</option>
                      <option value="Gecikti">Gecikti</option>
                    </select>
                  </td>
                  <td><button className="fat-btn-del-sm" onClick={() => handleSil(f.FaturaId)}>Sil</button></td>
                </tr>
              ))}
              {gorunenFaturalar.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "#999", padding: 16 }}>Kayıt yok</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default FaturaForm;
