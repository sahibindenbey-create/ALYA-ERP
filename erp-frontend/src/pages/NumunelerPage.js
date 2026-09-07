import React, { useState, useEffect } from "react";
import axios from "axios";
import SearchableSelect from "../components/SearchableSelect";
import ExportToolbar from "../components/ExportToolbar";
import "./NumunelerPage.css";

const API_URL = "http://localhost:5000/api";

const DURUMLAR = ["Beklemede", "Siparişe Dönüştü", "İade Edildi", "Kayıp"];

const emptyForm = {
  CariId: "", UrunId: "", UrunAdiSerbest: "", Miktar: "1", Birim: "Adet",
  VerilmeTarihi: new Date().toISOString().split("T")[0], VerenKisi: "", Aciklama: ""
};

const NumunelerPage = () => {
  const [numuneler, setNumuneler] = useState([]);
  const [cariler, setCariler] = useState([]);
  const [urunler, setUrunler] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [serbestUrunModu, setSerbestUrunModu] = useState(false);
  const [durumFiltre, setDurumFiltre] = useState("Hepsi");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [nRes, cRes, uRes] = await Promise.all([
        axios.get(`${API_URL}/numuneler`),
        axios.get(`${API_URL}/cariler`),
        axios.get(`${API_URL}/urunler`),
      ]);
      setNumuneler(nRes.data);
      setCariler(cRes.data);
      setUrunler(uRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const kaydet = async () => {
    if (!form.CariId) return alert("Cari seçin.");
    if (!serbestUrunModu && !form.UrunId) return alert("Ürün seçin veya serbest ürün adı girin.");
    if (serbestUrunModu && !form.UrunAdiSerbest) return alert("Ürün adı girin.");
    try {
      await axios.post(`${API_URL}/numuneler`, {
        ...form,
        UrunId: serbestUrunModu ? null : form.UrunId,
        UrunAdiSerbest: serbestUrunModu ? form.UrunAdiSerbest : null,
      });
      setForm(emptyForm);
      setSerbestUrunModu(false);
      fetchAll();
    } catch (err) { alert("Kaydedilirken hata oluştu: " + (err.response?.data?.error || err.message)); }
  };

  const durumGuncelle = async (id, yeniDurum) => {
    try {
      await axios.put(`${API_URL}/numuneler/${id}`, {
        Durum: yeniDurum,
        DonusTarihi: yeniDurum === "İade Edildi" ? new Date().toISOString().split("T")[0] : null,
      });
      fetchAll();
    } catch (err) { alert("Güncellenirken hata oluştu."); }
  };

  const sil = async (id) => {
    if (!window.confirm("Bu numune kaydını silmek istediğinize emin misiniz?")) return;
    await axios.delete(`${API_URL}/numuneler/${id}`);
    fetchAll();
  };

  const gorunen = numuneler
    .filter(n => durumFiltre === "Hepsi" || n.Durum === durumFiltre)
    .filter(n =>
      (n.CariAdi || "").toLowerCase().includes(search.toLowerCase()) ||
      (n.UrunAdiTablo || n.UrunAdiSerbest || "").toLowerCase().includes(search.toLowerCase())
    );

  const excelCols = [
    { key: "CariAdi", label: "Cari" }, { key: "UrunAdiTablo", label: "Ürün" },
    { key: "Miktar", label: "Miktar" }, { key: "VerilmeTarihi", label: "Verilme Tarihi" },
    { key: "Durum", label: "Durum" }, { key: "VerenKisi", label: "Veren" }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="fin-card">
        <div className="fin-card-header"><h3>Yeni Numune Kaydı</h3></div>
        <div className="prs-bordro-inputs">
          <div style={{ minWidth: 220 }}>
            <label>Cari *</label>
            <SearchableSelect
              options={cariler.map(c => ({ value: c.CariId, label: c.CariAdi, sublabel: c.CariKodu }))}
              value={form.CariId}
              onChange={val => setForm({ ...form, CariId: val })}
              placeholder="Cari seçin..."
            />
          </div>

          <div style={{ minWidth: 220 }}>
            <label>
              Ürün *{" "}
              <button type="button" onClick={() => setSerbestUrunModu(!serbestUrunModu)} className="numune-toggle-mini">
                {serbestUrunModu ? "Listeden seç" : "Serbest yaz"}
              </button>
            </label>
            {serbestUrunModu ? (
              <input value={form.UrunAdiSerbest} onChange={e => setForm({ ...form, UrunAdiSerbest: e.target.value })} placeholder="Ürün adı..." />
            ) : (
              <SearchableSelect
                options={urunler.map(u => ({ value: u.UrunId, label: u.UrunAdi, sublabel: u.UrunKodu }))}
                value={form.UrunId}
                onChange={val => setForm({ ...form, UrunId: val })}
                placeholder="Ürün seçin..."
              />
            )}
          </div>

          <div><label>Miktar</label><input type="number" style={{ width: 80 }} value={form.Miktar} onChange={e => setForm({ ...form, Miktar: e.target.value })} /></div>
          <div><label>Birim</label><input style={{ width: 80 }} value={form.Birim} onChange={e => setForm({ ...form, Birim: e.target.value })} /></div>
          <div><label>Verilme Tarihi</label><input type="date" value={form.VerilmeTarihi} onChange={e => setForm({ ...form, VerilmeTarihi: e.target.value })} /></div>
          <div><label>Veren Kişi</label><input value={form.VerenKisi} onChange={e => setForm({ ...form, VerenKisi: e.target.value })} placeholder="Ad Soyad" /></div>
          <div style={{ flex: 1, minWidth: 200 }}><label>Açıklama</label><input value={form.Aciklama} onChange={e => setForm({ ...form, Aciklama: e.target.value })} /></div>
          <button onClick={kaydet}>+ Kaydet</button>
        </div>
      </div>

      <div className="fin-card">
        <div className="fin-card-header"><h3>Numune Listesi ({gorunen.length})</h3></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Cari veya ürün ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 2, minWidth: 220, padding: "8px 12px", borderRadius: 6, border: "1px solid #ccc" }}
          />
          <select value={durumFiltre} onChange={e => setDurumFiltre(e.target.value)} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #ccc" }}>
            <option value="Hepsi">Tüm Durumlar</option>
            {DURUMLAR.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <ExportToolbar data={gorunen} columns={excelCols} filename="numune-listesi" />
        {loading ? <p style={{ color: "#888" }}>Yükleniyor...</p> : (
          <table className="fin-table">
            <thead><tr><th>Cari</th><th>Ürün</th><th>Miktar</th><th>Verilme Tarihi</th><th>Veren</th><th>Durum</th><th>İşlem</th></tr></thead>
            <tbody>
              {gorunen.map(n => (
                <tr key={n.NumuneId}>
                  <td>{n.CariAdi}</td>
                  <td>{n.UrunAdiTablo || n.UrunAdiSerbest}</td>
                  <td>{n.Miktar} {n.Birim}</td>
                  <td>{n.VerilmeTarihi ? new Date(n.VerilmeTarihi).toLocaleDateString("tr-TR") : ""}</td>
                  <td>{n.VerenKisi || "—"}</td>
                  <td>
                    <select value={n.Durum} onChange={e => durumGuncelle(n.NumuneId, e.target.value)} className="numune-durum-select">
                      {DURUMLAR.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </td>
                  <td><button className="prs-btn-del-sm" onClick={() => sil(n.NumuneId)}>Sil</button></td>
                </tr>
              ))}
              {gorunen.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "#999", padding: 16 }}>Kayıt yok</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default NumunelerPage;
