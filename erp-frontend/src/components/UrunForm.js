import React, { useState, useEffect } from "react";
import axios from "axios";
import ExportToolbar from "./ExportToolbar";
import "./UrunForm.css";

const API_URL = "http://localhost:5000/api";

const emptyForm = {
  urunKodu: "", urunAdi: "", tur: "Ürün", kategori: "", birim: "Adet",
  stokMiktari: "0", kritikStokSeviyesi: "0", desi: "0",
  alisFiyati: "0", listeFiyati: "0", kdvOrani: "20", aciklama: ""
};

const KATEGORILER_URUN = ["Mobilya", "Hammadde", "Elektronik", "Kırtasiye", "Diğer"];
const KATEGORILER_HIZMET = ["Danışmanlık", "Montaj", "Nakliye", "Bakım-Onarım", "Kurulum", "Diğer"];
const BIRIMLER = ["Adet", "Kg", "Lt", "Metre", "Kutu", "Koli", "Saat", "Gün", "Proje"];

const UrunForm = () => {
  const [formData, setFormData] = useState(emptyForm);
  const [kalemler, setKalemler] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [turFiltre, setTurFiltre] = useState("Hepsi");
  const [loading, setLoading] = useState(false);

  const fetchKalemler = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/urunler`);
      setKalemler(res.data);
    } catch (err) {
      console.error("Liste alınamadı:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchKalemler(); }, []);

  useEffect(() => {
    if (editingId || formData.urunKodu) return;
    const prefix = formData.tur === "Hizmet" ? "HZM" : "URN";
    const sira = kalemler.filter(k => k.Tur === formData.tur).length + 1;
    setFormData(f => ({ ...f, urunKodu: `${prefix}-${String(sira).padStart(4, "0")}` }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kalemler, formData.tur]);

  const handleChange = (field, value) => setFormData(f => ({ ...f, [field]: value }));

  const handleTurDegis = (tur) => {
    setFormData(f => ({ ...f, tur, urunKodu: "", kategori: "" }));
  };

  const handleEdit = (item) => {
    setEditingId(item.UrunId);
    setFormData({
      urunKodu: item.UrunKodu,
      urunAdi: item.UrunAdi,
      tur: item.Tur || "Ürün",
      kategori: item.Kategori || "",
      birim: item.Birim || "Adet",
      stokMiktari: String(item.StokMiktari ?? "0"),
      kritikStokSeviyesi: String(item.KritikStokSeviyesi ?? "0"),
      desi: String(item.Desi ?? "0"),
      alisFiyati: String(item.AlisFiyati ?? "0"),
      listeFiyati: String(item.ListeFiyati ?? "0"),
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
    if (!window.confirm("Bu kaydı silmek istediğinize emin misiniz?")) return;
    try {
      await axios.delete(`${API_URL}/urunler/${id}`);
      fetchKalemler();
    } catch (err) {
      alert("Silinirken hata oluştu.");
    }
  };

  const handleSave = async () => {
    if (!formData.urunAdi || !formData.urunKodu) {
      return alert("Kod ve ad zorunludur.");
    }
    const payload = {
      UrunKodu: formData.urunKodu,
      UrunAdi: formData.urunAdi,
      Tur: formData.tur,
      Kategori: formData.kategori,
      Birim: formData.birim,
      StokMiktari: formData.tur === "Hizmet" ? 0 : formData.stokMiktari,
      KritikStokSeviyesi: formData.tur === "Hizmet" ? 0 : formData.kritikStokSeviyesi,
      Desi: formData.tur === "Hizmet" ? 0 : formData.desi,
      AlisFiyati: formData.alisFiyati,
      ListeFiyati: formData.listeFiyati,
      KdvOrani: formData.kdvOrani,
      Aciklama: formData.aciklama
    };
    try {
      if (editingId) {
        await axios.put(`${API_URL}/urunler/${editingId}`, payload);
        alert("Kayıt güncellendi.");
      } else {
        await axios.post(`${API_URL}/urunler`, payload);
        alert("Kayıt eklendi.");
      }
      setEditingId(null);
      setFormData(emptyForm);
      fetchKalemler();
    } catch (err) {
      console.error(err);
      alert("Kayıt sırasında bir hata oluştu: " + (err.response?.data?.error || err.message));
    }
  };

  const filtered = kalemler
    .filter(k => turFiltre === "Hepsi" || k.Tur === turFiltre)
    .filter(k =>
      (k.UrunAdi || "").toLowerCase().includes(search.toLowerCase()) ||
      (k.UrunKodu || "").toLowerCase().includes(search.toLowerCase())
    );

  const urunSayisi = kalemler.filter(k => k.Tur !== "Hizmet").length;
  const hizmetSayisi = kalemler.filter(k => k.Tur === "Hizmet").length;
  const kritikSayisi = kalemler.filter(k => k.Tur !== "Hizmet" && Number(k.StokMiktari) <= Number(k.KritikStokSeviyesi)).length;

  const excelColumns = [
    { key: "UrunKodu", label: "Kod" }, { key: "UrunAdi", label: "Ad" }, { key: "Tur", label: "Tür" },
    { key: "Kategori", label: "Kategori" }, { key: "StokMiktari", label: "Stok" }, { key: "Birim", label: "Birim" },
    { key: "Desi", label: "Desi" }, { key: "ListeFiyati", label: "Liste Fiyatı" }, { key: "KdvOrani", label: "KDV %" }
  ];

  return (
    <div className="urun-container">
      <div className="urun-summary">
        <div className="urun-summary-card">
          <div className="urun-summary-label">Ürün Sayısı</div>
          <div className="urun-summary-value">{urunSayisi}</div>
        </div>
        <div className="urun-summary-card">
          <div className="urun-summary-label">Hizmet Sayısı</div>
          <div className="urun-summary-value">{hizmetSayisi}</div>
        </div>
        <div className="urun-summary-card warn">
          <div className="urun-summary-label">Kritik Stok</div>
          <div className="urun-summary-value">{kritikSayisi}</div>
        </div>
      </div>

      <div className="urun-form-card">
        <div className="urun-form-header">
          {editingId ? `✏️ Kayıt Düzenle (${formData.urunKodu})` : "➕ Yeni Ürün / Hizmet Ekle"}
        </div>

        <div className="urun-tur-toggle">
          <button
            type="button"
            className={formData.tur === "Ürün" ? "active" : ""}
            onClick={() => handleTurDegis("Ürün")}
            disabled={!!editingId}
          >📦 Ürün</button>
          <button
            type="button"
            className={formData.tur === "Hizmet" ? "active" : ""}
            onClick={() => handleTurDegis("Hizmet")}
            disabled={!!editingId}
          >🔧 Hizmet</button>
        </div>

        <div className="urun-grid">
          <div className="urun-field">
            <label>{formData.tur} Kodu</label>
            <input value={formData.urunKodu} onChange={e => handleChange("urunKodu", e.target.value)} readOnly={!!editingId} />
          </div>
          <div className="urun-field">
            <label>{formData.tur} Adı *</label>
            <input value={formData.urunAdi} onChange={e => handleChange("urunAdi", e.target.value)} placeholder={formData.tur === "Hizmet" ? "Örn: Montaj Hizmeti" : "Örn: Ofis Sandalyesi"} />
          </div>
          <div className="urun-field">
            <label>Kategori</label>
            <select value={formData.kategori} onChange={e => handleChange("kategori", e.target.value)}>
              <option value="">Seçiniz</option>
              {(formData.tur === "Hizmet" ? KATEGORILER_HIZMET : KATEGORILER_URUN).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="urun-field">
            <label>Birim</label>
            <select value={formData.birim} onChange={e => handleChange("birim", e.target.value)}>
              {BIRIMLER.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {formData.tur === "Ürün" && (
            <>
              <div className="urun-field">
                <label>Stok Miktarı</label>
                <input type="number" value={formData.stokMiktari} onChange={e => handleChange("stokMiktari", e.target.value)} />
              </div>
              <div className="urun-field">
                <label>Kritik Stok Seviyesi</label>
                <input type="number" value={formData.kritikStokSeviyesi} onChange={e => handleChange("kritikStokSeviyesi", e.target.value)} />
              </div>
              <div className="urun-field">
                <label>Desi (En×Boy×Yükseklik / 3000)</label>
                <input type="number" step="0.01" value={formData.desi} onChange={e => handleChange("desi", e.target.value)} placeholder="Örn: 12.5" />
              </div>
            </>
          )}

          <div className="urun-field">
            <label>Alış Fiyatı (₺)</label>
            <input type="number" value={formData.alisFiyati} onChange={e => handleChange("alisFiyati", e.target.value)} />
          </div>
          <div className="urun-field">
            <label>Liste (Satış) Fiyatı (₺)</label>
            <input type="number" value={formData.listeFiyati} onChange={e => handleChange("listeFiyati", e.target.value)} />
          </div>
          <div className="urun-field">
            <label>KDV Oranı (%)</label>
            <select value={formData.kdvOrani} onChange={e => handleChange("kdvOrani", e.target.value)}>
              <option value="0">0</option>
              <option value="1">1</option>
              <option value="10">10</option>
              <option value="20">20</option>
            </select>
          </div>
          <div className="urun-field" style={{ gridColumn: "1 / -1" }}>
            <label>Açıklama</label>
            <textarea value={formData.aciklama} onChange={e => handleChange("aciklama", e.target.value)} rows={2} />
          </div>
        </div>
        <div className="urun-form-footer">
          <button className="urun-btn-save" onClick={handleSave}>
            {editingId ? "Değişiklikleri Kaydet" : `${formData.tur === "Hizmet" ? "Hizmeti" : "Ürünü"} Kaydet`}
          </button>
          {editingId && (
            <button className="urun-btn-cancel" onClick={handleCancel}>İptal / Yeni Kayıt</button>
          )}
        </div>
      </div>

      <div className="urun-list-card">
        <div className="urun-list-header">
          <h3>Kayıt Listesi ({filtered.length})</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select className="urun-search" style={{ minWidth: 130 }} value={turFiltre} onChange={e => setTurFiltre(e.target.value)}>
              <option value="Hepsi">Hepsi</option>
              <option value="Ürün">Sadece Ürün</option>
              <option value="Hizmet">Sadece Hizmet</option>
            </select>
            <input
              className="urun-search"
              placeholder="Kod veya ad ara..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <ExportToolbar data={filtered} columns={excelColumns} filename="urun-hizmet-listesi" />
        {loading ? (
          <p style={{ color: "#888" }}>Yükleniyor...</p>
        ) : (
          <table className="urun-table">
            <thead>
              <tr>
                <th>Kod</th><th>Ad</th><th>Tür</th><th>Kategori</th><th>Stok</th><th>Birim</th>
                <th>Liste Fiyatı</th><th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.UrunId} className={item.Tur !== "Hizmet" && Number(item.StokMiktari) <= Number(item.KritikStokSeviyesi) ? "urun-row-critical" : ""}>
                  <td><strong>{item.UrunKodu}</strong></td>
                  <td>{item.UrunAdi}</td>
                  <td>{item.Tur === "Hizmet" ? "🔧 Hizmet" : "📦 Ürün"}</td>
                  <td>{item.Kategori}</td>
                  <td>{item.Tur === "Hizmet" ? "—" : item.StokMiktari}</td>
                  <td>{item.Birim}</td>
                  <td>{Number(item.ListeFiyati || 0).toLocaleString()} ₺</td>
                  <td>
                    <button className="urun-btn-edit" onClick={() => handleEdit(item)}>Düzenle</button>
                    <button className="urun-btn-del" onClick={() => handleDelete(item.UrunId)}>Sil</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: "center", color: "#999", padding: 16 }}>Kayıt bulunamadı</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default UrunForm;
