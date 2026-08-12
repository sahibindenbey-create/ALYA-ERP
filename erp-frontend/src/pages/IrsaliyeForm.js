import React, { useState, useEffect } from "react";
import axios from "axios";
import SearchableSelect from "../components/SearchableSelect";
import ExportToolbar from "../components/ExportToolbar";
import "./IrsaliyeForm.css";

const API_URL = "http://localhost:5000/api";

const emptyForm = {
  irsaliyeKodu: "", yon: "Satış", irsaliyeTarihi: new Date().toISOString().split("T")[0],
  cariKodu: "", cariAdi: "", teslimatAdresi: "", notlar: ""
};
const emptyEntry = { urunKodu: "", urunAdi: "", miktar: "", birim: "Adet", birimFiyat: "" };

const IrsaliyeForm = () => {
  const [form, setForm] = useState(emptyForm);
  const [entry, setEntry] = useState(emptyEntry);
  const [items, setItems] = useState([]);
  const [cariler, setCariler] = useState([]);
  const [urunler, setUrunler] = useState([]);
  const [irsaliyeler, setIrsaliyeler] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [c, u, i] = await Promise.all([
        axios.get(`${API_URL}/cariler`).then(r => r.data).catch(() => []),
        axios.get(`${API_URL}/urunler`).then(r => r.data).catch(() => []),
        axios.get(`${API_URL}/irsaliyeler`).then(r => r.data).catch(() => []),
      ]);
      setCariler(c); setUrunler(u); setIrsaliyeler(i);
    } catch (err) {
      console.error("İrsaliye verileri alınamadı:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    if (form.irsaliyeKodu) return;
    setForm(f => ({ ...f, irsaliyeKodu: `IRS-${Date.now().toString().slice(-6)}` }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCariSecim = (kod) => {
    const c = cariler.find(x => x.CariKodu === kod);
    setForm(f => ({
      ...f, cariKodu: kod, cariAdi: c ? c.CariAdi : "",
      teslimatAdresi: c ? [c.FaturaAdresDetay, c.FaturaIlce, c.FaturaIl].filter(Boolean).join(", ") : f.teslimatAdresi
    }));
  };

  const handleUrunSecim = (id) => {
    const u = urunler.find(x => String(x.UrunId) === String(id));
    if (u) setEntry(e => ({ ...e, urunKodu: u.UrunKodu, urunAdi: u.UrunAdi, birim: u.Birim || "Adet", birimFiyat: u.ListeFiyati || "" }));
  };

  const satirEkle = () => {
    if (!entry.urunAdi || !entry.miktar) return alert("Ürün ve miktar girin.");
    const satirToplam = Number(entry.miktar) * Number(entry.birimFiyat || 0);
    setItems(prev => [...prev, { ...entry, satirToplam, id: Date.now() }]);
    setEntry(emptyEntry);
  };

  const satirSil = (id) => setItems(prev => prev.filter(it => it.id !== id));

  const resetForm = () => {
    setForm(f => ({ ...emptyForm, yon: f.yon, irsaliyeKodu: `IRS-${Date.now().toString().slice(-6)}` }));
    setItems([]);
  };

  const handleKaydet = async () => {
    if (!form.cariAdi) return alert("Lütfen bir cari seçin.");
    if (items.length === 0) return alert("En az bir ürün satırı eklemelisiniz.");
    try {
      await axios.post(`${API_URL}/irsaliyeler`, { form, items });
      alert("İrsaliye kaydedildi.");
      resetForm();
      fetchAll();
    } catch (err) {
      alert("Kaydedilirken hata oluştu: " + (err.response?.data?.error || err.message));
    }
  };

  const handleSil = async (id) => {
    if (!window.confirm("Bu irsaliyeyi silmek istediğinize emin misiniz?")) return;
    try {
      await axios.delete(`${API_URL}/irsaliyeler/${id}`);
      fetchAll();
    } catch (err) {
      alert("Silinirken hata oluştu.");
    }
  };

  const excelCols = [
    { key: "IrsaliyeKodu", label: "Kod" }, { key: "Yon", label: "Yön" }, { key: "CariAdi", label: "Cari" },
    { key: "IrsaliyeTarihi", label: "Tarih" }, { key: "ToplamTutar", label: "Toplam" }
  ];

  return (
    <div className="irs-container">
      <div className="irs-form-card">
        <div className="irs-yon-toggle">
          <button type="button" className={form.yon === "Satış" ? "active" : ""} onClick={() => setForm({ ...form, yon: "Satış", cariKodu: "", cariAdi: "" })}>🚚 Satış İrsaliyesi</button>
          <button type="button" className={form.yon === "Alış" ? "active" : ""} onClick={() => setForm({ ...form, yon: "Alış", cariKodu: "", cariAdi: "" })}>📥 Alış İrsaliyesi</button>
        </div>

        <div className="irs-grid">
          <div className="irs-field">
            <label>İrsaliye No</label>
            <input value={form.irsaliyeKodu} readOnly />
          </div>
          <div className="irs-field">
            <label>Tarih</label>
            <input type="date" value={form.irsaliyeTarihi} onChange={e => setForm({ ...form, irsaliyeTarihi: e.target.value })} />
          </div>
          <div className="irs-field" style={{ flex: 2 }}>
            <label>{form.yon === "Alış" ? "Tedarikçi" : "Müşteri"}</label>
            <SearchableSelect
              options={cariler.filter(c => form.yon === "Alış" ? c.CariTipi !== 1 : c.CariTipi !== 2).map(c => ({ value: c.CariKodu, label: c.CariAdi, sublabel: c.CariKodu }))}
              value={form.cariKodu}
              onChange={handleCariSecim}
              placeholder="Cari seçin..."
            />
          </div>
          <div className="irs-field" style={{ gridColumn: "1 / -1" }}>
            <label>Teslimat Adresi</label>
            <input value={form.teslimatAdresi} onChange={e => setForm({ ...form, teslimatAdresi: e.target.value })} />
          </div>
          <div className="irs-field" style={{ gridColumn: "1 / -1" }}>
            <label>Notlar</label>
            <textarea rows={2} value={form.notlar} onChange={e => setForm({ ...form, notlar: e.target.value })} />
          </div>
        </div>

        <div className="irs-subheader">Ürün Satırları</div>
        <div className="irs-entry-row">
          <div style={{ flex: 2 }}>
            <SearchableSelect
              options={urunler.map(u => ({ value: u.UrunId, label: u.UrunAdi, sublabel: u.UrunKodu }))}
              value={urunler.find(u => u.UrunKodu === entry.urunKodu)?.UrunId || ""}
              onChange={handleUrunSecim}
              placeholder="Ürün seçin..."
            />
          </div>
          <input type="number" placeholder="Miktar" style={{ width: 100 }} value={entry.miktar} onChange={e => setEntry({ ...entry, miktar: e.target.value })} />
          <input placeholder="Birim" style={{ width: 80 }} value={entry.birim} onChange={e => setEntry({ ...entry, birim: e.target.value })} />
          <input type="number" placeholder="Birim Fiyat" style={{ width: 110 }} value={entry.birimFiyat} onChange={e => setEntry({ ...entry, birimFiyat: e.target.value })} />
          <button className="irs-btn-add" onClick={satirEkle}>+ Ekle</button>
        </div>

        <table className="irs-table">
          <thead><tr><th>Ürün</th><th>Miktar</th><th>Birim</th><th>Birim Fiyat</th><th>Toplam</th><th></th></tr></thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id}>
                <td>{it.urunAdi}</td><td>{it.miktar}</td><td>{it.birim}</td>
                <td>{Number(it.birimFiyat).toLocaleString()} ₺</td>
                <td style={{ fontWeight: 700 }}>{Number(it.satirToplam).toLocaleString()} ₺</td>
                <td><button className="irs-btn-del-sm" onClick={() => satirSil(it.id)}>Sil</button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "#999", padding: 10 }}>Henüz ürün eklenmedi</td></tr>}
          </tbody>
        </table>

        <div className="irs-form-footer">
          <div className="irs-total">Toplam: <span>{items.reduce((a, b) => a + b.satirToplam, 0).toLocaleString()} ₺</span></div>
          <button className="irs-btn-save" onClick={handleKaydet}>İrsaliyeyi Kaydet</button>
        </div>
      </div>

      <div className="irs-list-card">
        <h3>İrsaliye Geçmişi ({irsaliyeler.length})</h3>
        <ExportToolbar data={irsaliyeler} columns={excelCols} filename="irsaliye-listesi" />
        {loading ? <p style={{ color: "#888" }}>Yükleniyor...</p> : (
          <table className="irs-table">
            <thead><tr><th>Kod</th><th>Yön</th><th>Cari</th><th>Tarih</th><th>Toplam</th><th>İşlem</th></tr></thead>
            <tbody>
              {irsaliyeler.map(i => (
                <tr key={i.IrsaliyeId}>
                  <td><strong>{i.IrsaliyeKodu}</strong></td>
                  <td><span className={`erp-badge ${i.Yon === "Alış" ? "orange" : "blue"}`}>{i.Yon === "Alış" ? "📥 Alış" : "🚚 Satış"}</span></td>
                  <td>{i.CariAdi}</td>
                  <td>{i.IrsaliyeTarihi ? new Date(i.IrsaliyeTarihi).toLocaleDateString("tr-TR") : ""}</td>
                  <td>{Number(i.ToplamTutar || 0).toLocaleString()} ₺</td>
                  <td><button className="irs-btn-del-sm" onClick={() => handleSil(i.IrsaliyeId)}>Sil</button></td>
                </tr>
              ))}
              {irsaliyeler.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "#999", padding: 16 }}>Kayıt yok</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default IrsaliyeForm;
