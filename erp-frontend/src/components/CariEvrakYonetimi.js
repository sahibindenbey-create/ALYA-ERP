import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API_URL = "http://localhost:5000/api";

const SABIT_EVRAK_TIPLERI = [
  { key: "Vergi Levhası", icon: "🧾" },
  { key: "İmza Sirküleri", icon: "✍️" },
  { key: "Ticaret Sicil Gazetesi", icon: "📰" },
  { key: "Faaliyet Belgesi", icon: "📋" },
];

const CariEvrakYonetimi = ({ cariId }) => {
  const [evraklar, setEvraklar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState({});
  const [serbestBaslik, setSerbestBaslik] = useState("");

  const fetchEvraklar = useCallback(async () => {
    if (!cariId) return;
    try {
      const res = await axios.get(`${API_URL}/cariler/${cariId}/evrak`);
      setEvraklar(res.data);
    } catch (err) { console.error("Evraklar alınamadı", err); }
  }, [cariId]);

  useEffect(() => { fetchEvraklar(); }, [fetchEvraklar]);

  const dosyaSec = async (file, evrakTipi, baslik) => {
    if (!file) return;
    setYukleniyor(prev => ({ ...prev, [evrakTipi]: true }));
    const form = new FormData();
    form.append("dosya", file);
    form.append("EvrakTipi", evrakTipi);
    if (baslik) form.append("Baslik", baslik);
    try {
      await axios.post(`${API_URL}/cariler/${cariId}/evrak`, form, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setSerbestBaslik("");
      fetchEvraklar();
    } catch (err) {
      alert("Dosya yüklenirken hata oluştu: " + (err.response?.data?.error || err.message));
    } finally {
      setYukleniyor(prev => ({ ...prev, [evrakTipi]: false }));
    }
  };

  const evrakSil = async (evrakId) => {
    if (!window.confirm("Bu evrakı silmek istediğinize emin misiniz?")) return;
    await axios.delete(`${API_URL}/cariler/evrak/${evrakId}`);
    fetchEvraklar();
  };

  if (!cariId) {
    return (
      <section className="form-section">
        <h3 className="section-title">Evrak Arşivi</h3>
        <p style={{ color: "#888", fontSize: "0.85rem" }}>
          Evrak yükleyebilmek için önce carinin kaydedilmesi gerekir. Cariyi kaydedin, ardından
          düzenleme moduna girip evrakları ekleyin.
        </p>
      </section>
    );
  }

  const sabitEvrak = (tip) => evraklar.find(e => e.EvrakTipi === tip);
  const serbestEvraklar = evraklar.filter(e => e.EvrakTipi === "Serbest");

  return (
    <section className="form-section">
      <h3 className="section-title">Evrak Arşivi</h3>

      <div className="evrak-grid">
        {SABIT_EVRAK_TIPLERI.map(({ key, icon }) => {
          const mevcut = sabitEvrak(key);
          return (
            <div className="evrak-slot" key={key}>
              <div className="evrak-slot-header">{icon} {key}</div>
              {mevcut ? (
                <div className="evrak-slot-dosya">
                  <a href={`http://localhost:5000${mevcut.DosyaYolu}`} target="_blank" rel="noreferrer">
                    📎 {mevcut.DosyaAdi}
                  </a>
                  <button type="button" className="evrak-sil-btn" onClick={() => evrakSil(mevcut.EvrakId)}>Sil</button>
                </div>
              ) : (
                <label className="evrak-upload-label">
                  {yukleniyor[key] ? "Yükleniyor..." : "+ Dosya Yükle"}
                  <input
                    type="file"
                    className="hidden-file-input"
                    onChange={(e) => dosyaSec(e.target.files[0], key)}
                    disabled={yukleniyor[key]}
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>

      <div className="evrak-serbest">
        <h4>Serbest Dosyalar</h4>
        <div className="evrak-serbest-ekle">
          <input
            type="text"
            placeholder="Dosya başlığı (opsiyonel, örn: Sözleşme, Referans Mektubu...)"
            value={serbestBaslik}
            onChange={(e) => setSerbestBaslik(e.target.value)}
          />
          <label className="evrak-upload-label">
            {yukleniyor["Serbest"] ? "Yükleniyor..." : "+ Dosya Seç"}
            <input
              type="file"
              className="hidden-file-input"
              onChange={(e) => dosyaSec(e.target.files[0], "Serbest", serbestBaslik)}
              disabled={yukleniyor["Serbest"]}
            />
          </label>
        </div>
        {serbestEvraklar.length > 0 && (
          <div className="evrak-serbest-liste">
            {serbestEvraklar.map(e => (
              <div className="evrak-serbest-item" key={e.EvrakId}>
                <a href={`http://localhost:5000${e.DosyaYolu}`} target="_blank" rel="noreferrer">
                  📎 {e.Baslik || e.DosyaAdi}
                </a>
                <span className="evrak-tarih">{new Date(e.YuklemeTarihi).toLocaleDateString("tr-TR")}</span>
                <button type="button" className="evrak-sil-btn" onClick={() => evrakSil(e.EvrakId)}>Sil</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default CariEvrakYonetimi;
