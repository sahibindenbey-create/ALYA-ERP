import React, { useState, useEffect } from "react";
import axios from "axios";
import SearchableSelect from "../components/SearchableSelect";
import ExportToolbar from "../components/ExportToolbar";
import "./FasonPage.css";

const API_URL = "http://localhost:5000/api";

const emptyForm = {
  fasonKodu: "", cariKodu: "", cariAdi: "", urunKodu: "", urunAdi: "",
  gonderilenMiktar: "", birim: "Adet", gonderimTarihi: new Date().toISOString().split("T")[0],
  beklenenDonusTarihi: "", aciklama: ""
};

const FasonPage = () => {
  const [form, setForm] = useState(emptyForm);
  const [kayitlar, setKayitlar] = useState([]);
  const [cariler, setCariler] = useState([]);
  const [urunler, setUrunler] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [f, c, u] = await Promise.all([
        axios.get(`${API_URL}/fason`).then(r => r.data),
        axios.get(`${API_URL}/cariler`).then(r => r.data),
        axios.get(`${API_URL}/urunler`).then(r => r.data),
      ]);
      setKayitlar(f); setCariler(c); setUrunler(u);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    if (form.fasonKodu) return;
    setForm(f => ({ ...f, fasonKodu: `FSN-${Date.now().toString().slice(-6)}` }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCariSecim = (kod) => {
    const c = cariler.find(x => x.CariKodu === kod);
    setForm(f => ({ ...f, cariKodu: kod, cariAdi: c ? c.CariAdi : "" }));
  };

  const handleUrunSecim = (id) => {
    const u = urunler.find(x => String(x.UrunId) === String(id));
    setForm(f => ({ ...f, urunKodu: u?.UrunKodu || "", urunAdi: u?.UrunAdi || "", birim: u?.Birim || "Adet" }));
  };

  const handleKaydet = async () => {
    if (!form.cariAdi || !form.urunAdi || !form.gonderilenMiktar) {
      return alert("Fasoncu firma, ürün ve miktar zorunludur.");
    }
    try {
      await axios.post(`${API_URL}/fason`, {
        FasonKodu: form.fasonKodu, CariKodu: form.cariKodu, CariAdi: form.cariAdi,
        UrunKodu: form.urunKodu, UrunAdi: form.urunAdi, GonderilenMiktar: form.gonderilenMiktar,
        Birim: form.birim, GonderimTarihi: form.gonderimTarihi,
        BeklenenDonusTarihi: form.beklenenDonusTarihi || null, Aciklama: form.aciklama
      });
      alert("Fason kaydı eklendi.");
      setForm({ ...emptyForm, fasonKodu: `FSN-${Date.now().toString().slice(-6)}` });
      fetchAll();
    } catch (err) {
      alert("Kayıt sırasında hata oluştu: " + (err.response?.data?.error || err.message));
    }
  };

  const handleDonus = async (item) => {
    const miktarStr = window.prompt(`"${item.UrunAdi}" için dönen miktarı girin:`, item.GonderilenMiktar);
    if (!miktarStr) return;
    try {
      await axios.put(`${API_URL}/fason/${item.FasonId}/donus`, {
        DonenMiktar: Number(miktarStr), DonusTarihi: new Date().toISOString().split("T")[0]
      });
      fetchAll();
    } catch (err) {
      alert("Güncellenirken hata oluştu.");
    }
  };

  const handleSil = async (id) => {
    if (!window.confirm("Bu kaydı silmek istediğinize emin misiniz?")) return;
    try {
      await axios.delete(`${API_URL}/fason/${id}`);
      fetchAll();
    } catch (err) {
      alert("Silinirken hata oluştu.");
    }
  };

  const excelCols = [
    { key: "FasonKodu", label: "Kod" }, { key: "CariAdi", label: "Fasoncu" }, { key: "UrunAdi", label: "Ürün" },
    { key: "GonderilenMiktar", label: "Gönderilen" }, { key: "DonenMiktar", label: "Dönen" }, { key: "Durum", label: "Durum" }
  ];

  return (
    <div className="fason-container">
      <div className="fason-form-card">
        <div className="fason-form-header">🏭 Fasona Gönderilecek Mal</div>
        <div className="fason-grid">
          <div className="fason-field">
            <label>Fason Kodu</label>
            <input value={form.fasonKodu} readOnly />
          </div>
          <div className="fason-field">
            <label>Fasoncu Firma *</label>
            <SearchableSelect
              options={cariler.map(c => ({ value: c.CariKodu, label: c.CariAdi, sublabel: c.CariKodu }))}
              value={form.cariKodu}
              onChange={handleCariSecim}
              placeholder="Cari (fasoncu) seçin..."
            />
          </div>
          <div className="fason-field">
            <label>Gönderilecek Ürün *</label>
            <SearchableSelect
              options={urunler.filter(u => u.Tur !== "Hizmet").map(u => ({ value: u.UrunId, label: u.UrunAdi, sublabel: u.UrunKodu }))}
              value={urunler.find(u => u.UrunKodu === form.urunKodu)?.UrunId || ""}
              onChange={handleUrunSecim}
              placeholder="Ürün seçin..."
            />
          </div>
          <div className="fason-field">
            <label>Miktar</label>
            <input type="number" value={form.gonderilenMiktar} onChange={e => setForm({ ...form, gonderilenMiktar: e.target.value })} />
          </div>
          <div className="fason-field">
            <label>Gönderim Tarihi</label>
            <input type="date" value={form.gonderimTarihi} onChange={e => setForm({ ...form, gonderimTarihi: e.target.value })} />
          </div>
          <div className="fason-field">
            <label>Beklenen Dönüş Tarihi</label>
            <input type="date" value={form.beklenenDonusTarihi} onChange={e => setForm({ ...form, beklenenDonusTarihi: e.target.value })} />
          </div>
          <div className="fason-field" style={{ gridColumn: "1 / -1" }}>
            <label>Açıklama</label>
            <textarea rows={2} value={form.aciklama} onChange={e => setForm({ ...form, aciklama: e.target.value })} />
          </div>
        </div>
        <div className="fason-form-footer">
          <button className="fason-btn-save" onClick={handleKaydet}>Fasona Gönder</button>
        </div>
      </div>

      <div className="fason-list-card">
        <h3>Fason Hareketleri ({kayitlar.length})</h3>
        <ExportToolbar data={kayitlar} columns={excelCols} filename="fason-hareketleri" />
        {loading ? <p style={{ color: "#888" }}>Yükleniyor...</p> : (
          <table className="fason-table">
            <thead>
              <tr>
                <th>Kod</th><th>Fasoncu</th><th>Ürün</th><th>Gönderilen</th><th>Dönen</th>
                <th>Gönderim</th><th>Beklenen Dönüş</th><th>Durum</th><th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {kayitlar.map(k => (
                <tr key={k.FasonId}>
                  <td><strong>{k.FasonKodu}</strong></td>
                  <td>{k.CariAdi}</td>
                  <td>{k.UrunAdi}</td>
                  <td>{k.GonderilenMiktar} {k.Birim}</td>
                  <td>{k.DonenMiktar || "—"}</td>
                  <td>{k.GonderimTarihi ? new Date(k.GonderimTarihi).toLocaleDateString("tr-TR") : ""}</td>
                  <td>{k.BeklenenDonusTarihi ? new Date(k.BeklenenDonusTarihi).toLocaleDateString("tr-TR") : "—"}</td>
                  <td>
                    <span className={`fason-badge ${k.Durum === "Tamamlandı" ? "green" : "orange"}`}>{k.Durum}</span>
                  </td>
                  <td>
                    {k.Durum !== "Tamamlandı" && (
                      <button className="fason-btn-edit" onClick={() => handleDonus(k)}>Dönüş Gir</button>
                    )}
                    <button className="fason-btn-del" onClick={() => handleSil(k.FasonId)}>Sil</button>
                  </td>
                </tr>
              ))}
              {kayitlar.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: "center", color: "#999", padding: 16 }}>Kayıt yok</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default FasonPage;
