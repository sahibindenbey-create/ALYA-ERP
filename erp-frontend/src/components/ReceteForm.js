import React, { useState, useEffect } from "react";
import axios from "axios";
import SearchableSelect from "./SearchableSelect";
import ExportToolbar from "./ExportToolbar";
import "./ReceteForm.css";

const API_URL = "http://localhost:5000/api";

const emptyForm = { receteKodu: "", mamulUrunId: "", mamulAdi: "", aciklama: "" };
const emptyEntry = { hammaddeUrunId: "", hammaddeAdi: "", miktar: "", birim: "Adet" };
const emptyIstasyon = { istasyonAdi: "", tahminiSureDk: "" };

const ReceteForm = () => {
  const [form, setForm] = useState(emptyForm);
  const [entry, setEntry] = useState(emptyEntry);
  const [items, setItems] = useState([]);
  const [istasyonEntry, setIstasyonEntry] = useState(emptyIstasyon);
  const [istasyonlar, setIstasyonlar] = useState([]);
  const [urunler, setUrunler] = useState([]);
  const [receteler, setReceteler] = useState([]);
  const [uretimGecmisi, setUretimGecmisi] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchUrunler = async () => {
    try {
      const res = await axios.get(`${API_URL}/urunler`);
      setUrunler(res.data);
    } catch (err) {
      console.error("Ürün listesi alınamadı:", err);
    }
  };

  const fetchReceteler = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/receteler`);
      setReceteler(res.data);
    } catch (err) {
      console.error("Reçete listesi alınamadı:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUretimGecmisi = async () => {
    try {
      const res = await axios.get(`${API_URL}/uretim`);
      setUretimGecmisi(res.data);
    } catch (err) {
      console.error("Üretim geçmişi alınamadı:", err);
    }
  };

  useEffect(() => { fetchUrunler(); fetchReceteler(); fetchUretimGecmisi(); }, []);

  useEffect(() => {
    if (form.receteKodu) return;
    setForm(f => ({ ...f, receteKodu: `REC-${Date.now().toString().slice(-6)}` }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMamulSecim = (id) => {
    const secilen = urunler.find(u => String(u.UrunId) === String(id));
    setForm(f => ({ ...f, mamulUrunId: id, mamulAdi: secilen ? secilen.UrunAdi : "" }));
  };

  const handleHammaddeSecim = (id) => {
    const secilen = urunler.find(u => String(u.UrunId) === String(id));
    setEntry(e => ({ ...e, hammaddeUrunId: id, hammaddeAdi: secilen ? secilen.UrunAdi : "", birim: secilen?.Birim || "Adet" }));
  };

  const satirEkle = () => {
    if (!entry.hammaddeUrunId || !entry.miktar) {
      return alert("Hammadde seçin ve miktar girin.");
    }
    setItems(prev => [...prev, { ...entry, id: Date.now() }]);
    setEntry(emptyEntry);
  };

  const satirSil = (id) => setItems(prev => prev.filter(it => it.id !== id));

  const istasyonEkle = () => {
    if (!istasyonEntry.istasyonAdi) return alert("İstasyon adı girin.");
    setIstasyonlar(prev => [...prev, { ...istasyonEntry, id: Date.now() }]);
    setIstasyonEntry(emptyIstasyon);
  };

  const istasyonSil = (id) => setIstasyonlar(prev => prev.filter(it => it.id !== id));

  const resetForm = () => {
    setForm({ ...emptyForm, receteKodu: `REC-${Date.now().toString().slice(-6)}` });
    setItems([]);
    setIstasyonlar([]);
  };

  const handleKaydet = async () => {
    if (!form.mamulUrunId) return alert("Lütfen üretilecek mamul ürünü seçin.");
    if (items.length === 0) return alert("En az bir hammadde satırı eklemelisiniz.");

    try {
      await axios.post(`${API_URL}/receteler`, { form, items, istasyonlar });
      alert(`Reçete kaydedildi: ${form.receteKodu}`);
      resetForm();
      fetchReceteler();
    } catch (err) {
      console.error(err);
      alert("Reçete kaydedilirken hata oluştu: " + (err.response?.data?.error || err.message));
    }
  };

  const handleSil = async (id) => {
    if (!window.confirm("Bu reçeteyi silmek istediğinize emin misiniz?")) return;
    try {
      await axios.delete(`${API_URL}/receteler/${id}`);
      fetchReceteler();
    } catch (err) {
      alert("Silinirken hata oluştu.");
    }
  };

  const handleUret = async (recete) => {
    const miktarStr = window.prompt(`"${recete.MamulAdi}" için kaç adet üretim yapılacak? (Hammaddeler stoktan otomatik düşülür)`, "1");
    if (!miktarStr) return;
    const miktar = Number(miktarStr);
    if (!miktar || miktar <= 0) return alert("Geçerli bir miktar girin.");

    try {
      const res = await axios.post(`${API_URL}/uretim`, { receteId: recete.ReceteId, miktar });
      alert(res.data.message);
      fetchUretimGecmisi();
      fetchUrunler();
    } catch (err) {
      alert("Üretim işlenirken hata oluştu: " + (err.response?.data?.error || err.message));
    }
  };

  const receteExcelCols = [
    { key: "ReceteKodu", label: "Kod" }, { key: "MamulAdi", label: "Mamul" }, { key: "Aciklama", label: "Açıklama" }
  ];

  return (
    <div className="recete-container">
      <div className="recete-form-card">
        <div className="recete-form-header">🧪 Yeni Üretim Reçetesi (BOM)</div>

        <div className="recete-top-grid">
          <div className="recete-field">
            <label>Reçete Kodu</label>
            <input value={form.receteKodu} readOnly />
          </div>
          <div className="recete-field" style={{ flex: 2 }}>
            <label>Üretilecek Mamul (Ürün) *</label>
            <SearchableSelect
              options={urunler.filter(u => u.Tur !== "Hizmet").map(u => ({ value: u.UrunId, label: u.UrunAdi, sublabel: u.UrunKodu }))}
              value={form.mamulUrunId}
              onChange={handleMamulSecim}
              placeholder="Mamul ürün seçin..."
            />
          </div>
          <div className="recete-field" style={{ flex: 2 }}>
            <label>Açıklama</label>
            <input value={form.aciklama} onChange={e => setForm({ ...form, aciklama: e.target.value })} placeholder="Opsiyonel not" />
          </div>
        </div>

        <div className="recete-subheader">Hammadde / Malzeme Satırları</div>
        <div className="recete-entry-row">
          <div style={{ flex: 2 }}>
            <SearchableSelect
              options={urunler.map(u => ({ value: u.UrunId, label: u.UrunAdi, sublabel: u.UrunKodu }))}
              value={entry.hammaddeUrunId}
              onChange={handleHammaddeSecim}
              placeholder="Hammadde seçin..."
            />
          </div>
          <input
            type="number" placeholder="Miktar" style={{ width: 110 }}
            value={entry.miktar} onChange={e => setEntry({ ...entry, miktar: e.target.value })}
          />
          <input
            placeholder="Birim" style={{ width: 90 }}
            value={entry.birim} onChange={e => setEntry({ ...entry, birim: e.target.value })}
          />
          <button className="recete-btn-add" onClick={satirEkle}>+ Ekle</button>
        </div>

        <table className="recete-table">
          <thead>
            <tr><th>Hammadde</th><th>Miktar</th><th>Birim</th><th></th></tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id}>
                <td>{it.hammaddeAdi}</td>
                <td>{it.miktar}</td>
                <td>{it.birim}</td>
                <td><button className="recete-btn-del-sm" onClick={() => satirSil(it.id)}>Sil</button></td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: "center", color: "#999", padding: 10 }}>Henüz hammadde eklenmedi</td></tr>
            )}
          </tbody>
        </table>

        <div className="recete-subheader">Üretim İstasyonları (Rota)</div>
        <div className="recete-entry-row">
          <input
            placeholder="İstasyon adı (örn: Kesme/Bükme, Kaynak/Montaj, Boyahane...)"
            style={{ flex: 2 }}
            value={istasyonEntry.istasyonAdi}
            onChange={e => setIstasyonEntry({ ...istasyonEntry, istasyonAdi: e.target.value })}
          />
          <input
            type="number" placeholder="Tahmini süre (dk)" style={{ width: 150 }}
            value={istasyonEntry.tahminiSureDk}
            onChange={e => setIstasyonEntry({ ...istasyonEntry, tahminiSureDk: e.target.value })}
          />
          <button className="recete-btn-add" onClick={istasyonEkle}>+ Ekle</button>
        </div>

        {istasyonlar.length > 0 && (
          <div className="recete-istasyon-flow">
            {istasyonlar.map((ist, idx) => (
              <React.Fragment key={ist.id}>
                {idx > 0 && <span className="recete-flow-arrow">→</span>}
                <div className="recete-flow-chip">
                  <span>{ist.istasyonAdi}</span>
                  {ist.tahminiSureDk && <small>{ist.tahminiSureDk} dk</small>}
                  <button onClick={() => istasyonSil(ist.id)}>✕</button>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}

        <div className="recete-form-footer">
          <button className="recete-btn-save" onClick={handleKaydet}>Reçeteyi Kaydet</button>
        </div>
      </div>

      <div className="recete-list-card">
        <h3>Kayıtlı Reçeteler ({receteler.length})</h3>
        <ExportToolbar data={receteler} columns={receteExcelCols} filename="uretim-receteleri" />
        {loading ? <p style={{ color: "#888" }}>Yükleniyor...</p> : (
          <table className="recete-table">
            <thead>
              <tr><th>Kod</th><th>Mamul</th><th>Açıklama</th><th>İşlem</th></tr>
            </thead>
            <tbody>
              {receteler.map(r => (
                <tr key={r.ReceteId}>
                  <td><strong>{r.ReceteKodu}</strong></td>
                  <td>{r.MamulAdi}</td>
                  <td>{r.Aciklama}</td>
                  <td>
                    <button className="recete-btn-uret" onClick={() => handleUret(r)}>⚙️ Üret</button>
                    <button className="recete-btn-del-sm" onClick={() => handleSil(r.ReceteId)}>Sil</button>
                  </td>
                </tr>
              ))}
              {receteler.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: "center", color: "#999", padding: 10 }}>Henüz kayıtlı reçete yok</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="recete-list-card">
        <h3>Son Üretim Hareketleri ({uretimGecmisi.length})</h3>
        <table className="recete-table">
          <thead>
            <tr><th>Tarih</th><th>Mamul</th><th>Üretilen Miktar</th><th>Not</th></tr>
          </thead>
          <tbody>
            {uretimGecmisi.slice(0, 15).map(u => (
              <tr key={u.UretimId}>
                <td>{u.UretimTarihi ? new Date(u.UretimTarihi).toLocaleString("tr-TR") : ""}</td>
                <td>{u.MamulAdi}</td>
                <td>{u.UretilenMiktar}</td>
                <td>{u.Notlar}</td>
              </tr>
            ))}
            {uretimGecmisi.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: "center", color: "#999", padding: 10 }}>Henüz üretim yapılmadı</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReceteForm;
