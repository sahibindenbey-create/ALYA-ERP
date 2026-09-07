import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API_URL = "http://localhost:5000/api";

const UrunDosyaYonetimi = ({ urunId }) => {
  const [dosyalar, setDosyalar] = useState([]);
  const [resimYukleniyor, setResimYukleniyor] = useState(false);
  const [dosyaYukleniyor, setDosyaYukleniyor] = useState(false);
  const [dosyaBaslik, setDosyaBaslik] = useState("");
  const [dosyaTip, setDosyaTip] = useState("Teknik Çizim");

  const fetchDosyalar = useCallback(async () => {
    if (!urunId) return;
    try {
      const res = await axios.get(`${API_URL}/urunler/${urunId}/dosya`);
      setDosyalar(res.data);
    } catch (err) { console.error("Dosyalar alınamadı", err); }
  }, [urunId]);

  useEffect(() => { fetchDosyalar(); }, [fetchDosyalar]);

  const resimYukle = async (file) => {
    if (!file) return;
    setResimYukleniyor(true);
    const form = new FormData();
    form.append("dosya", file);
    form.append("Tip", "Resim");
    form.append("KapakResmi", resimler.length === 0 ? "true" : "false");
    try {
      await axios.post(`${API_URL}/urunler/${urunId}/dosya`, form, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      fetchDosyalar();
    } catch (err) {
      alert("Resim yüklenirken hata oluştu: " + (err.response?.data?.error || err.message));
    } finally { setResimYukleniyor(false); }
  };

  const dosyaYukle = async (file) => {
    if (!file) return;
    setDosyaYukleniyor(true);
    const form = new FormData();
    form.append("dosya", file);
    form.append("Tip", dosyaTip);
    if (dosyaBaslik) form.append("Baslik", dosyaBaslik);
    try {
      await axios.post(`${API_URL}/urunler/${urunId}/dosya`, form, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setDosyaBaslik("");
      fetchDosyalar();
    } catch (err) {
      alert("Dosya yüklenirken hata oluştu: " + (err.response?.data?.error || err.message));
    } finally { setDosyaYukleniyor(false); }
  };

  const kapakYap = async (dosyaId) => {
    await axios.put(`${API_URL}/urunler/dosya/${dosyaId}/kapak-yap`);
    fetchDosyalar();
  };

  const dosyaSil = async (dosyaId) => {
    if (!window.confirm("Bu dosyayı silmek istediğinize emin misiniz?")) return;
    await axios.delete(`${API_URL}/urunler/dosya/${dosyaId}`);
    fetchDosyalar();
  };

  if (!urunId) {
    return (
      <div className="urun-form-card">
        <div className="urun-form-header">Resimler & Dosyalar</div>
        <p style={{ color: "#888", fontSize: "0.85rem", padding: "0 20px 20px" }}>
          Resim/dosya yükleyebilmek için önce ürünün kaydedilmesi gerekir.
        </p>
      </div>
    );
  }

  const resimler = dosyalar.filter(d => d.Tip === "Resim");
  const digerDosyalar = dosyalar.filter(d => d.Tip !== "Resim");

  return (
    <div className="urun-form-card">
      <div className="urun-form-header">Resimler & Dosyalar</div>
      <div style={{ padding: "0 20px 20px" }}>

        <h4 className="udy-alt-baslik">📷 Ürün Resimleri</h4>
        <div className="udy-resim-grid">
          {resimler.map(r => (
            <div className="udy-resim-kart" key={r.DosyaId}>
              <img src={`http://localhost:5000${r.DosyaYolu}`} alt={r.DosyaAdi} />
              {r.KapakResmi ? (
                <span className="udy-kapak-badge">Kapak Resmi</span>
              ) : (
                <button type="button" className="udy-kapak-btn" onClick={() => kapakYap(r.DosyaId)}>Kapak Yap</button>
              )}
              <button type="button" className="udy-sil-btn" onClick={() => dosyaSil(r.DosyaId)}>Sil</button>
            </div>
          ))}
          <label className="udy-resim-ekle">
            {resimYukleniyor ? "Yükleniyor..." : "+ Resim Ekle"}
            <input type="file" accept="image/*" className="hidden-file-input"
              onChange={(e) => resimYukle(e.target.files[0])} disabled={resimYukleniyor} />
          </label>
        </div>

        <h4 className="udy-alt-baslik" style={{ marginTop: 24 }}>📎 Teknik Çizim / Diğer Dosyalar</h4>
        <div className="udy-dosya-ekle-row">
          <select value={dosyaTip} onChange={e => setDosyaTip(e.target.value)}>
            <option value="Teknik Çizim">Teknik Çizim</option>
            <option value="Diğer">Diğer</option>
          </select>
          <input type="text" placeholder="Başlık (opsiyonel)" value={dosyaBaslik} onChange={e => setDosyaBaslik(e.target.value)} />
          <label className="evrak-upload-label">
            {dosyaYukleniyor ? "Yükleniyor..." : "+ Dosya Seç"}
            <input type="file" className="hidden-file-input"
              onChange={(e) => dosyaYukle(e.target.files[0])} disabled={dosyaYukleniyor} />
          </label>
        </div>
        {digerDosyalar.length > 0 && (
          <div className="udy-dosya-liste">
            {digerDosyalar.map(d => (
              <div className="udy-dosya-item" key={d.DosyaId}>
                <span className="udy-dosya-tip">{d.Tip}</span>
                <a href={`http://localhost:5000${d.DosyaYolu}`} target="_blank" rel="noreferrer">📄 {d.Baslik || d.DosyaAdi}</a>
                <button type="button" className="evrak-sil-btn" onClick={() => dosyaSil(d.DosyaId)}>Sil</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UrunDosyaYonetimi;
