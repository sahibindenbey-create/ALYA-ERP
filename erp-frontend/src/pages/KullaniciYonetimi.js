import React, { useState, useEffect } from "react";
import axios from "axios";
import { getCurrentUser } from "../auth";
import "./KullaniciYonetimi.css";

const API_URL = "http://localhost:5000/api";
const ROLLER = ["Yönetici", "Kullanıcı", "Sadece Görüntüleme"];

const emptyForm = { kullaniciAdi: "", sifre: "", adSoyad: "", rol: "Kullanıcı" };

const KullaniciYonetimi = () => {
  const currentUser = getCurrentUser();
  const [kullanicilar, setKullanicilar] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ AdSoyad: "", Rol: "", IsActive: true });

  const fetchKullanicilar = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/auth/kullanicilar`);
      setKullanicilar(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchKullanicilar(); }, []);

  const handleEkle = async () => {
    if (!form.kullaniciAdi || !form.sifre) {
      return alert("Kullanıcı adı ve şifre zorunludur.");
    }
    if (form.sifre.length < 4) {
      return alert("Şifre en az 4 karakter olmalıdır.");
    }
    try {
      await axios.post(`${API_URL}/auth/register`, form);
      alert("Kullanıcı eklendi.");
      setForm(emptyForm);
      fetchKullanicilar();
    } catch (err) {
      alert("Kullanıcı eklenirken hata: " + (err.response?.data?.error || err.message));
    }
  };

  const startEdit = (k) => {
    setEditingId(k.KullaniciId);
    setEditForm({ AdSoyad: k.AdSoyad, Rol: k.Rol, IsActive: k.IsActive });
  };

  const handleGuncelle = async (id) => {
    try {
      await axios.put(`${API_URL}/auth/kullanicilar/${id}`, editForm);
      setEditingId(null);
      fetchKullanicilar();
    } catch (err) {
      alert("Güncellenirken hata oluştu.");
    }
  };

  const handleSifreSifirla = async (id, kullaniciAdi) => {
    const yeni = window.prompt(`"${kullaniciAdi}" için yeni şifre girin (en az 4 karakter):`);
    if (!yeni) return;
    try {
      await axios.put(`${API_URL}/auth/kullanicilar/${id}/sifre`, { yeniSifre: yeni });
      alert("Şifre güncellendi.");
    } catch (err) {
      alert("Şifre güncellenirken hata: " + (err.response?.data?.error || err.message));
    }
  };

  const handlePasiflestir = async (id) => {
    if (!window.confirm("Bu kullanıcıyı pasifleştirmek istediğinize emin misiniz? (Artık giriş yapamaz)")) return;
    try {
      await axios.delete(`${API_URL}/auth/kullanicilar/${id}`);
      fetchKullanicilar();
    } catch (err) {
      alert("İşlem sırasında hata oluştu.");
    }
  };

  return (
    <div className="kul-container">
      {currentUser?.role !== "Yönetici" ? (
        <div className="kul-form-card" style={{ textAlign: "center", color: "var(--text-secondary)" }}>
          🔒 Bu sayfaya sadece <strong>Yönetici</strong> rolündeki kullanıcılar erişebilir.
        </div>
      ) : (
      <>
      <div className="kul-form-card">
        <div className="kul-form-header">➕ Yeni Kullanıcı Ekle</div>
        <div className="kul-grid">
          <div className="kul-field">
            <label>Kullanıcı Adı *</label>
            <input value={form.kullaniciAdi} onChange={e => setForm({ ...form, kullaniciAdi: e.target.value })} placeholder="örn: mehmet.demir" />
          </div>
          <div className="kul-field">
            <label>Ad Soyad</label>
            <input value={form.adSoyad} onChange={e => setForm({ ...form, adSoyad: e.target.value })} />
          </div>
          <div className="kul-field">
            <label>Şifre *</label>
            <input type="password" value={form.sifre} onChange={e => setForm({ ...form, sifre: e.target.value })} placeholder="En az 4 karakter" />
          </div>
          <div className="kul-field">
            <label>Rol</label>
            <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>
              {ROLLER.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div className="kul-form-footer">
          <button className="kul-btn-save" onClick={handleEkle}>Kullanıcı Ekle</button>
        </div>
      </div>

      <div className="kul-list-card">
        <h3>Kullanıcılar ({kullanicilar.length})</h3>
        {loading ? <p style={{ color: "#888" }}>Yükleniyor...</p> : (
          <table className="kul-table">
            <thead>
              <tr><th>Kullanıcı Adı</th><th>Ad Soyad</th><th>Rol</th><th>Durum</th><th>İşlem</th></tr>
            </thead>
            <tbody>
              {kullanicilar.map(k => (
                <tr key={k.KullaniciId}>
                  <td><strong>{k.KullaniciAdi}</strong></td>
                  {editingId === k.KullaniciId ? (
                    <>
                      <td><input value={editForm.AdSoyad} onChange={e => setEditForm({ ...editForm, AdSoyad: e.target.value })} /></td>
                      <td>
                        <select value={editForm.Rol} onChange={e => setEditForm({ ...editForm, Rol: e.target.value })}>
                          {ROLLER.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td>
                        <label style={{ fontSize: "0.8rem" }}>
                          <input type="checkbox" checked={editForm.IsActive} onChange={e => setEditForm({ ...editForm, IsActive: e.target.checked })} /> Aktif
                        </label>
                      </td>
                      <td>
                        <button className="kul-btn-edit" onClick={() => handleGuncelle(k.KullaniciId)}>Kaydet</button>
                        <button className="kul-btn-cancel" onClick={() => setEditingId(null)}>İptal</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{k.AdSoyad}</td>
                      <td>{k.Rol}</td>
                      <td><span className={`kul-badge ${k.IsActive ? "green" : "red"}`}>{k.IsActive ? "Aktif" : "Pasif"}</span></td>
                      <td>
                        <button className="kul-btn-edit" onClick={() => startEdit(k)}>Düzenle</button>
                        <button className="kul-btn-edit" onClick={() => handleSifreSifirla(k.KullaniciId, k.KullaniciAdi)}>Şifre Sıfırla</button>
                        {k.IsActive && (
                          <button className="kul-btn-del" onClick={() => handlePasiflestir(k.KullaniciId)}>Pasifleştir</button>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {kullanicilar.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "#999", padding: 16 }}>Kullanıcı bulunamadı</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      </>
      )}
    </div>
  );
};

export default KullaniciYonetimi;
