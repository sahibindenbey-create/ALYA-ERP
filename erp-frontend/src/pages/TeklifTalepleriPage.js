import React, { useState, useEffect } from "react";
import axios from "axios";
import ExportToolbar from "../components/ExportToolbar";
import "./TeklifTalepleriPage.css";

const API_URL = "http://localhost:5000/api";
const DURUMLAR = ["Beklemede", "Teklif Geldi", "Kabul Edildi", "Reddedildi"];

const TeklifTalepleriPage = () => {
  const [talepler, setTalepler] = useState([]);
  const [loading, setLoading] = useState(false);
  const [duzenleId, setDuzenleId] = useState(null);
  const [duzenleForm, setDuzenleForm] = useState({});

  const fetchTalepler = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/teklif-talepleri`);
      setTalepler(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTalepler(); }, []);

  const baslaDuzenle = (t) => {
    setDuzenleId(t.TalepId);
    setDuzenleForm({ TeklifFiyati: t.TeklifFiyati || "", ParaBirimi: t.ParaBirimi || "TL", Durum: t.Durum, Notlar: t.Notlar || "" });
  };

  const kaydet = async (id) => {
    try {
      await axios.put(`${API_URL}/teklif-talepleri/${id}`, duzenleForm);
      setDuzenleId(null);
      fetchTalepler();
    } catch (err) {
      alert("Güncellenirken hata oluştu.");
    }
  };

  const sil = async (id) => {
    if (!window.confirm("Bu talebi silmek istediğinize emin misiniz?")) return;
    try {
      await axios.delete(`${API_URL}/teklif-talepleri/${id}`);
      fetchTalepler();
    } catch (err) {
      alert("Silinirken hata oluştu.");
    }
  };

  const excelCols = [
    { key: "UrunAdi", label: "Malzeme" }, { key: "CariAdi", label: "Tedarikçi" }, { key: "Miktar", label: "Miktar" },
    { key: "TeklifFiyati", label: "Teklif Fiyatı" }, { key: "Durum", label: "Durum" }
  ];

  return (
    <div className="tt-container">
      <div className="tt-card">
        <div className="tt-header">
          <h3>Teklif Talepleri ({talepler.length})</h3>
        </div>
        <p className="tt-desc">
          Reçete maliyet hesabında eksik çıkan malzemeler için "Teklif Al" ile oluşturduğun talepler burada listelenir.
          Tedarikçiden fiyat geldiğinde durumunu güncelleyebilirsin.
        </p>
        <ExportToolbar data={talepler} columns={excelCols} filename="teklif-talepleri" />
        {loading ? <p style={{ color: "#888" }}>Yükleniyor...</p> : (
          <table className="tt-table">
            <thead><tr><th>Malzeme</th><th>Tedarikçi</th><th>Miktar</th><th>Teklif Fiyatı</th><th>Durum</th><th>Not</th><th>İşlem</th></tr></thead>
            <tbody>
              {talepler.map(t => (
                <tr key={t.TalepId}>
                  <td><strong>{t.UrunAdi}</strong></td>
                  <td>{t.CariAdi || "—"}</td>
                  <td>{t.Miktar} {t.Birim}</td>
                  {duzenleId === t.TalepId ? (
                    <>
                      <td>
                        <input type="number" style={{ width: 80 }} value={duzenleForm.TeklifFiyati} onChange={e => setDuzenleForm({ ...duzenleForm, TeklifFiyati: e.target.value })} />
                        <select value={duzenleForm.ParaBirimi} onChange={e => setDuzenleForm({ ...duzenleForm, ParaBirimi: e.target.value })}>
                          <option>TL</option><option>USD</option><option>EUR</option>
                        </select>
                      </td>
                      <td>
                        <select value={duzenleForm.Durum} onChange={e => setDuzenleForm({ ...duzenleForm, Durum: e.target.value })}>
                          {DURUMLAR.map(d => <option key={d}>{d}</option>)}
                        </select>
                      </td>
                      <td><input value={duzenleForm.Notlar} onChange={e => setDuzenleForm({ ...duzenleForm, Notlar: e.target.value })} /></td>
                      <td>
                        <button className="tt-btn-edit" onClick={() => kaydet(t.TalepId)}>Kaydet</button>
                        <button className="tt-btn-cancel" onClick={() => setDuzenleId(null)}>İptal</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{t.TeklifFiyati ? `${Number(t.TeklifFiyati).toLocaleString()} ${t.ParaBirimi}` : "—"}</td>
                      <td><span className={`erp-badge ${t.Durum === "Kabul Edildi" ? "green" : t.Durum === "Reddedildi" ? "red" : "orange"}`}>{t.Durum}</span></td>
                      <td>{t.Notlar}</td>
                      <td>
                        <button className="tt-btn-edit" onClick={() => baslaDuzenle(t)}>Güncelle</button>
                        <button className="tt-btn-del" onClick={() => sil(t.TalepId)}>Sil</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {talepler.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "#999", padding: 16 }}>Henüz teklif talebi yok</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default TeklifTalepleriPage;
