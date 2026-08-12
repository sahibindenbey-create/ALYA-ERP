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

const FaturaForm = () => {
  const [form, setForm] = useState(emptyForm);
  const [entry, setEntry] = useState(emptyEntry);
  const [items, setItems] = useState([]);
  const [cariler, setCariler] = useState([]);
  const [urunler, setUrunler] = useState([]);
  const [faturalar, setFaturalar] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [c, u, f] = await Promise.all([
        axios.get(`${API_URL}/cariler`).then(r => r.data).catch(() => []),
        axios.get(`${API_URL}/urunler`).then(r => r.data).catch(() => []),
        axios.get(`${API_URL}/faturalar`).then(r => r.data).catch(() => []),
      ]);
      setCariler(c); setUrunler(u); setFaturalar(f);
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
    setForm(f => ({ ...emptyForm, yon: f.yon, faturaKodu: `FAT-${Date.now().toString().slice(-6)}` }));
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

  return (
    <div className="fat-container">
      <div className="fat-form-card">
        <div className="fat-yon-toggle">
          <button type="button" className={form.yon === "Satış" ? "active" : ""} onClick={() => setForm({ ...form, yon: "Satış", cariKodu: "", cariAdi: "" })}>💰 Satış Faturası</button>
          <button type="button" className={form.yon === "Alış" ? "active" : ""} onClick={() => setForm({ ...form, yon: "Alış", cariKodu: "", cariAdi: "" })}>🧾 Alış Faturası</button>
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

      <div className="fat-list-card">
        <h3>Fatura Geçmişi ({faturalar.length})</h3>
        <ExportToolbar data={faturalar} columns={excelCols} filename="fatura-listesi" />
        {loading ? <p style={{ color: "#888" }}>Yükleniyor...</p> : (
          <table className="fat-table">
            <thead><tr><th>Kod</th><th>Yön</th><th>Cari</th><th>Tarih</th><th>Genel Toplam</th><th>Durum</th><th>İşlem</th></tr></thead>
            <tbody>
              {faturalar.map(f => (
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
              {faturalar.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "#999", padding: 16 }}>Kayıt yok</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default FaturaForm;
