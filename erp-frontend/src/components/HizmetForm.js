import React, { useState, useEffect } from "react";
import axios from "axios";
import "./HizmetForm.css";

const API_URL = "http://localhost:5000/api";

const emptyForm = {
  hizmetKodu: "", hizmetAdi: "", kategori: "", birim: "Adet",
  fiyat: "0", kdvOrani: "20", aciklama: ""
};

const KATEGORILER = ["Danışmanlık", "Montaj", "Nakliye", "Bakım-Onarım", "Kurulum", "Diğer"];
const BIRIMLER = ["Adet", "Saat", "Gün", "Proje", "Paket"];

const HizmetForm = () => {
  const [formData, setFormData] = useState(emptyForm);
  const [hizmetler, setHizmetler] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchHizmetler = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/hizmetler`);
      setHizmetler(res.data);
    } catch (err) {
      console.error("Hizmet listesi alınamadı:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHizmetler(); }, []);

  useEffect(() => {
    if (editingId || formData.hizmetKodu) return;
    const sira = hizmetler.length + 1;
    setFormData(f => ({ ...f, hizmetKodu: `HZM-${String(sira).padStart(4, "0")}` }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hizmetler]);

  const handleChange = (field, value) => setFormData(f => ({ ...f, [field]: value }));

  const handleEdit = (item) => {
    setEditingId(item.HizmetId);
    setFormData({
      hizmetKodu: item.HizmetKodu,
      hizmetAdi: item.HizmetAdi,
      kategori: item.Kategori || "",
      birim: item.Birim || "Adet",
      fiyat: String(item.Fiyat ?? "0"),
      kdvOrani: String(item.KdvOrani ?? "20"),
      aciklama: item.Aciklama || ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bu hizmeti silmek istediğinize emin misiniz?")) return;
    try {
      await axios.delete(`${API_URL}/hizmetler/${id}`);
      fetchHizmetler();
    } catch (err) {
      alert("Silinirken hata oluştu.");
    }
  };

  const handleSave = async () => {
    if (!formData.hizmetAdi || !formData.hizmetKodu) {
      return alert("Hizmet kodu ve hizmet adı zorunludur.");
    }
    const payload = {
      HizmetKodu: formData.hizmetKodu,
      HizmetAdi: formData.hizmetAdi,
      Kategori: formData.kategori,
      Birim: formData.birim,
      Fiyat: formData.fiyat,
      KdvOrani: formData.kdvOrani,
      Aciklama: formData.aciklama
    };
    try {
      if (editingId) {
        await axios.put(`${API_URL}/hizmetler/${editingId}`, payload);
        alert("Hizmet güncellendi.");
      } else {
        await axios.post(`${API_URL}/hizmetler`, payload);
        alert("Hizmet kaydedildi.");
      }
      setEditingId(null);
      setFormData(emptyForm);
      fetchHizmetler();
    } catch (err) {
      console.error(err);
      alert("Kayıt sırasında bir hata oluştu: " + (err.response?.data?.error || err.message));
    }
  };

  const filtered = hizmetler.filter(h =>
    (h.HizmetAdi || "").toLowerCase().includes(search.toLowerCase()) ||
    (h.HizmetKodu || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="hizmet-container">
      <div className="hizmet-summary">
        <div className="hizmet-summary-card">
          <div className="hizmet-summary-label">Toplam Hizmet</div>
          <div className="hizmet-summary-value">{hizmetler.length}</div>
        </div>
        <div className="hizmet-summary-card">
          <div className="hizmet-summary-label">Ortalama Fiyat</div>
          <div className="hizmet-summary-value">
            {hizmetler.length > 0
              ? Math.round(hizmetler.reduce((a, h) => a + Number(h.Fiyat || 0), 0) / hizmetler.length).toLocaleString()
              : 0} ₺
          </div>
        </div>
      </div>

      <div className="hizmet-form-card">
        <div className="hizmet-form-header">
          {editingId ? `✏️ Hizmet Düzenle (${formData.hizmetKodu})` : "➕ Yeni Hizmet Ekle"}
        </div>
        <div className="hizmet-grid">
          <div className="hizmet-field">
            <label>Hizmet Kodu</label>
            <input value={formData.hizmetKodu} onChange={e => handleChange("hizmetKodu", e.target.value)} readOnly={!!editingId} />
          </div>
          <div className="hizmet-field">
            <label>Hizmet Adı *</label>
            <input value={formData.hizmetAdi} onChange={e => handleChange("hizmetAdi", e.target.value)} placeholder="Örn: Montaj Hizmeti" />
          </div>
          <div className="hizmet-field">
            <label>Kategori</label>
            <select value={formData.kategori} onChange={e => handleChange("kategori", e.target.value)}>
              <option value="">Seçiniz</option>
              {KATEGORILER.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="hizmet-field">
            <label>Birim</label>
            <select value={formData.birim} onChange={e => handleChange("birim", e.target.value)}>
              {BIRIMLER.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="hizmet-field">
            <label>Fiyat (₺)</label>
            <input type="number" value={formData.fiyat} onChange={e => handleChange("fiyat", e.target.value)} />
          </div>
          <div className="hizmet-field">
            <label>KDV Oranı (%)</label>
            <select value={formData.kdvOrani} onChange={e => handleChange("kdvOrani", e.target.value)}>
              <option value="0">0</option>
              <option value="1">1</option>
              <option value="10">10</option>
              <option value="20">20</option>
            </select>
          </div>
          <div className="hizmet-field" style={{ gridColumn: "1 / -1" }}>
            <label>Açıklama</label>
            <textarea value={formData.aciklama} onChange={e => handleChange("aciklama", e.target.value)} rows={2} />
          </div>
        </div>
        <div className="hizmet-form-footer">
          <button className="hizmet-btn-save" onClick={handleSave}>
            {editingId ? "Değişiklikleri Kaydet" : "Hizmeti Kaydet"}
          </button>
          {editingId && (
            <button className="hizmet-btn-cancel" onClick={handleCancel}>İptal / Yeni Kayıt</button>
          )}
        </div>
      </div>

      <div className="hizmet-list-card">
        <div className="hizmet-list-header">
          <h3>Hizmet Listesi ({filtered.length})</h3>
          <input
            className="hizmet-search"
            placeholder="Hizmet kodu veya adı ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {loading ? (
          <p style={{ color: "#888" }}>Yükleniyor...</p>
        ) : (
          <table className="hizmet-table">
            <thead>
              <tr>
                <th>Kod</th><th>Hizmet Adı</th><th>Kategori</th><th>Birim</th><th>Fiyat</th><th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.HizmetId}>
                  <td><strong>{item.HizmetKodu}</strong></td>
                  <td>{item.HizmetAdi}</td>
                  <td>{item.Kategori}</td>
                  <td>{item.Birim}</td>
                  <td>{Number(item.Fiyat || 0).toLocaleString()} ₺</td>
                  <td>
                    <button className="hizmet-btn-edit" onClick={() => handleEdit(item)}>Düzenle</button>
                    <button className="hizmet-btn-del" onClick={() => handleDelete(item.HizmetId)}>Sil</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "#999", padding: 16 }}>Kayıtlı hizmet bulunamadı</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default HizmetForm;
