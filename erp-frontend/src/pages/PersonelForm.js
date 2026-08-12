import React, { useState, useEffect } from "react";
import axios from "axios";
import ExportToolbar from "../components/ExportToolbar";
import "./PersonelForm.css";

const API_URL = "http://localhost:5000/api";
const DEPARTMANLAR = ["Üretim", "Satış", "Muhasebe", "İnsan Kaynakları", "Yönetim", "Lojistik", "Diğer"];
const IZIN_TIPLERI = ["Yıllık", "Mazeret", "Rapor", "Ücretsiz", "Evlilik", "Doğum"];
const PUANTAJ_DURUMLARI = ["Tam Gün", "Yarım Gün", "İzinli", "Raporlu", "Devamsız", "Resmi Tatil"];

const emptyPersonel = {
  personelKodu: "", adSoyad: "", tcNo: "", dogumTarihi: "", cinsiyet: "", medeniHal: "",
  iseGirisTarihi: new Date().toISOString().split("T")[0], istenCikisTarihi: "",
  departman: "", pozisyon: "", telefon: "", email: "", adres: "", iban: "",
  acilDurumKisi: "", acilDurumTel: ""
};

const PersonelForm = () => {
  const [personeller, setPersoneller] = useState([]);
  const [form, setForm] = useState(emptyPersonel);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [secilenPersonel, setSecilenPersonel] = useState(null);
  const [aktifTab, setAktifTab] = useState("ozluk");

  const fetchPersoneller = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/personel`);
      setPersoneller(res.data);
    } catch (err) {
      console.error("Personel listesi alınamadı:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPersoneller(); }, []);

  useEffect(() => {
    if (editingId || form.personelKodu) return;
    setForm(f => ({ ...f, personelKodu: `PRS-${String(personeller.length + 1).padStart(4, "0")}` }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personeller]);

  const handleChange = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleKaydet = async () => {
    if (!form.adSoyad) return alert("Ad Soyad zorunludur.");
    const payload = {
      PersonelKodu: form.personelKodu, AdSoyad: form.adSoyad, TCNo: form.tcNo,
      DogumTarihi: form.dogumTarihi || null, Cinsiyet: form.cinsiyet, MedeniHal: form.medeniHal,
      IseGirisTarihi: form.iseGirisTarihi || null, IstenCikisTarihi: form.istenCikisTarihi || null,
      Departman: form.departman, Pozisyon: form.pozisyon, Telefon: form.telefon, Email: form.email,
      Adres: form.adres, IBAN: form.iban, AcilDurumKisi: form.acilDurumKisi, AcilDurumTel: form.acilDurumTel
    };
    try {
      if (editingId) {
        await axios.put(`${API_URL}/personel/${editingId}`, payload);
        alert("Personel güncellendi.");
      } else {
        await axios.post(`${API_URL}/personel`, payload);
        alert("Personel eklendi.");
      }
      setEditingId(null);
      setForm(emptyPersonel);
      fetchPersoneller();
    } catch (err) {
      alert("Kayıt sırasında hata oluştu: " + (err.response?.data?.error || err.message));
    }
  };

  const handleEdit = (p) => {
    setEditingId(p.PersonelId);
    setForm({
      personelKodu: p.PersonelKodu, adSoyad: p.AdSoyad, tcNo: p.TCNo || "",
      dogumTarihi: p.DogumTarihi ? p.DogumTarihi.split("T")[0] : "", cinsiyet: p.Cinsiyet || "", medeniHal: p.MedeniHal || "",
      iseGirisTarihi: p.IseGirisTarihi ? p.IseGirisTarihi.split("T")[0] : "",
      istenCikisTarihi: p.IstenCikisTarihi ? p.IstenCikisTarihi.split("T")[0] : "",
      departman: p.Departman || "", pozisyon: p.Pozisyon || "", telefon: p.Telefon || "", email: p.Email || "",
      adres: p.Adres || "", iban: p.IBAN || "", acilDurumKisi: p.AcilDurumKisi || "", acilDurumTel: p.AcilDurumTel || ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancel = () => { setEditingId(null); setForm(emptyPersonel); };

  const handlePasiflestir = async (id) => {
    if (!window.confirm("Bu personeli pasifleştirmek istediğinize emin misiniz?")) return;
    try {
      await axios.delete(`${API_URL}/personel/${id}`);
      fetchPersoneller();
    } catch (err) {
      alert("İşlem sırasında hata oluştu.");
    }
  };

  const acDetay = (p) => {
    setSecilenPersonel(p);
    setAktifTab("ozluk");
  };

  const filtered = personeller.filter(p =>
    (p.AdSoyad || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.PersonelKodu || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.Departman || "").toLowerCase().includes(search.toLowerCase())
  );

  const excelCols = [
    { key: "PersonelKodu", label: "Kod" }, { key: "AdSoyad", label: "Ad Soyad" }, { key: "Departman", label: "Departman" },
    { key: "Pozisyon", label: "Pozisyon" }, { key: "Telefon", label: "Telefon" }, { key: "IseGirisTarihi", label: "İşe Giriş" }
  ];

  return (
    <div className="prs-container">
      <div className="prs-form-card">
        <div className="prs-form-header">{editingId ? `✏️ Personel Düzenle (${form.personelKodu})` : "➕ Yeni Personel Ekle"}</div>
        <div className="prs-section-title">Özlük Bilgileri</div>
        <div className="prs-grid">
          <div className="prs-field"><label>Personel Kodu</label><input value={form.personelKodu} readOnly /></div>
          <div className="prs-field"><label>Ad Soyad *</label><input value={form.adSoyad} onChange={e => handleChange("adSoyad", e.target.value)} /></div>
          <div className="prs-field"><label>TC Kimlik No</label><input value={form.tcNo} onChange={e => handleChange("tcNo", e.target.value)} maxLength={11} /></div>
          <div className="prs-field"><label>Doğum Tarihi</label><input type="date" value={form.dogumTarihi} onChange={e => handleChange("dogumTarihi", e.target.value)} /></div>
          <div className="prs-field">
            <label>Cinsiyet</label>
            <select value={form.cinsiyet} onChange={e => handleChange("cinsiyet", e.target.value)}>
              <option value="">Seçiniz</option><option value="Kadın">Kadın</option><option value="Erkek">Erkek</option>
            </select>
          </div>
          <div className="prs-field">
            <label>Medeni Hal</label>
            <select value={form.medeniHal} onChange={e => handleChange("medeniHal", e.target.value)}>
              <option value="">Seçiniz</option><option value="Bekar">Bekar</option><option value="Evli">Evli</option>
            </select>
          </div>
          <div className="prs-field"><label>İşe Giriş Tarihi</label><input type="date" value={form.iseGirisTarihi} onChange={e => handleChange("iseGirisTarihi", e.target.value)} /></div>
          <div className="prs-field"><label>İşten Çıkış Tarihi</label><input type="date" value={form.istenCikisTarihi} onChange={e => handleChange("istenCikisTarihi", e.target.value)} /></div>
          <div className="prs-field">
            <label>Departman</label>
            <select value={form.departman} onChange={e => handleChange("departman", e.target.value)}>
              <option value="">Seçiniz</option>
              {DEPARTMANLAR.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="prs-field"><label>Pozisyon</label><input value={form.pozisyon} onChange={e => handleChange("pozisyon", e.target.value)} placeholder="Örn: Üretim Sorumlusu" /></div>
          <div className="prs-field"><label>Telefon</label><input value={form.telefon} onChange={e => handleChange("telefon", e.target.value)} /></div>
          <div className="prs-field"><label>E-posta</label><input value={form.email} onChange={e => handleChange("email", e.target.value)} /></div>
          <div className="prs-field"><label>IBAN</label><input value={form.iban} onChange={e => handleChange("iban", e.target.value)} placeholder="TR..." /></div>
          <div className="prs-field" style={{ gridColumn: "1 / -1" }}><label>Adres</label><textarea rows={2} value={form.adres} onChange={e => handleChange("adres", e.target.value)} /></div>
          <div className="prs-field"><label>Acil Durum Kişisi</label><input value={form.acilDurumKisi} onChange={e => handleChange("acilDurumKisi", e.target.value)} /></div>
          <div className="prs-field"><label>Acil Durum Telefon</label><input value={form.acilDurumTel} onChange={e => handleChange("acilDurumTel", e.target.value)} /></div>
        </div>
        <div className="prs-form-footer">
          <button className="prs-btn-save" onClick={handleKaydet}>{editingId ? "Değişiklikleri Kaydet" : "Personeli Kaydet"}</button>
          {editingId && <button className="prs-btn-cancel" onClick={handleCancel}>İptal / Yeni Kayıt</button>}
        </div>
      </div>

      <div className="prs-list-card">
        <div className="prs-list-header">
          <h3>Personel Listesi ({filtered.length})</h3>
          <input className="prs-search" placeholder="Ad, kod veya departman ara..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <ExportToolbar data={filtered} columns={excelCols} filename="personel-listesi" />
        {loading ? <p style={{ color: "#888" }}>Yükleniyor...</p> : (
          <table className="prs-table">
            <thead><tr><th>Kod</th><th>Ad Soyad</th><th>Departman</th><th>Pozisyon</th><th>Telefon</th><th>İşlem</th></tr></thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.PersonelId}>
                  <td><strong>{p.PersonelKodu}</strong></td>
                  <td className="prs-link" onClick={() => acDetay(p)}>{p.AdSoyad}</td>
                  <td>{p.Departman}</td>
                  <td>{p.Pozisyon}</td>
                  <td>{p.Telefon}</td>
                  <td>
                    <button className="prs-btn-edit" onClick={() => acDetay(p)}>Özlük/İzin/Puantaj/Maaş</button>
                    <button className="prs-btn-edit" onClick={() => handleEdit(p)}>Düzenle</button>
                    <button className="prs-btn-del" onClick={() => handlePasiflestir(p.PersonelId)}>Pasifleştir</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "#999", padding: 16 }}>Kayıt yok</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {secilenPersonel && (
        <PersonelDetayModal
          personel={secilenPersonel}
          aktifTab={aktifTab}
          setAktifTab={setAktifTab}
          onClose={() => setSecilenPersonel(null)}
        />
      )}
    </div>
  );
};

/* ================= DETAY MODAL: İzin / Puantaj / Maaş ================= */
const PersonelDetayModal = ({ personel, aktifTab, setAktifTab, onClose }) => {
  const [izinler, setIzinler] = useState([]);
  const [puantaj, setPuantaj] = useState([]);
  const [maaslar, setMaaslar] = useState([]);

  const [izinForm, setIzinForm] = useState({ IzinTipi: "Yıllık", BaslangicTarihi: "", BitisTarihi: "", GunSayisi: "", Aciklama: "" });
  const [puantajForm, setPuantajForm] = useState({ Tarih: new Date().toISOString().split("T")[0], GirisSaati: "09:00", CikisSaati: "18:00", CalismaSuresiSaat: "9", Durum: "Tam Gün", Aciklama: "" });
  const [maasForm, setMaasForm] = useState({ DonemYil: new Date().getFullYear(), DonemAy: new Date().getMonth() + 1, BrutMaas: "", NetMaas: "", Prim: "0", Kesinti: "0", OdemeTarihi: "", Aciklama: "" });

  const fetchIzinler = async () => {
    const res = await axios.get(`${API_URL}/personel/${personel.PersonelId}/izinler`);
    setIzinler(res.data);
  };
  const fetchPuantaj = async () => {
    const res = await axios.get(`${API_URL}/personel/${personel.PersonelId}/puantaj`);
    setPuantaj(res.data);
  };
  const fetchMaaslar = async () => {
    const res = await axios.get(`${API_URL}/personel/${personel.PersonelId}/maas`);
    setMaaslar(res.data);
  };

  useEffect(() => { fetchIzinler(); fetchPuantaj(); fetchMaaslar(); }, [personel.PersonelId]); // eslint-disable-line

  const izinEkle = async () => {
    if (!izinForm.BaslangicTarihi || !izinForm.BitisTarihi) return alert("Başlangıç ve bitiş tarihi girin.");
    try {
      await axios.post(`${API_URL}/personel/${personel.PersonelId}/izinler`, izinForm);
      setIzinForm({ IzinTipi: "Yıllık", BaslangicTarihi: "", BitisTarihi: "", GunSayisi: "", Aciklama: "" });
      fetchIzinler();
    } catch (err) { alert("İzin eklenirken hata oluştu."); }
  };
  const izinSil = async (id) => {
    await axios.delete(`${API_URL}/personel/izinler/${id}`);
    fetchIzinler();
  };

  const puantajEkle = async () => {
    if (!puantajForm.Tarih) return alert("Tarih girin.");
    try {
      await axios.post(`${API_URL}/personel/${personel.PersonelId}/puantaj`, puantajForm);
      fetchPuantaj();
    } catch (err) { alert("Puantaj eklenirken hata oluştu."); }
  };
  const puantajSil = async (id) => {
    await axios.delete(`${API_URL}/personel/puantaj/${id}`);
    fetchPuantaj();
  };

  const maasEkle = async () => {
    if (!maasForm.BrutMaas) return alert("Brüt maaş girin.");
    try {
      await axios.post(`${API_URL}/personel/${personel.PersonelId}/maas`, maasForm);
      fetchMaaslar();
    } catch (err) { alert("Maaş kaydı eklenirken hata oluştu."); }
  };
  const maasSil = async (id) => {
    await axios.delete(`${API_URL}/personel/maas/${id}`);
    fetchMaaslar();
  };

  return (
    <div className="prs-modal-backdrop" onClick={onClose}>
      <div className="prs-modal" onClick={e => e.stopPropagation()}>
        <div className="prs-modal-header">
          <div>
            <h2>{personel.AdSoyad}</h2>
            <span>{personel.PersonelKodu} — {personel.Departman} / {personel.Pozisyon}</span>
          </div>
          <button className="prs-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="prs-tabs">
          <button className={aktifTab === "ozluk" ? "active" : ""} onClick={() => setAktifTab("ozluk")}>📋 Özlük</button>
          <button className={aktifTab === "izin" ? "active" : ""} onClick={() => setAktifTab("izin")}>🏖️ İzinler ({izinler.length})</button>
          <button className={aktifTab === "puantaj" ? "active" : ""} onClick={() => setAktifTab("puantaj")}>🕐 Puantaj ({puantaj.length})</button>
          <button className={aktifTab === "maas" ? "active" : ""} onClick={() => setAktifTab("maas")}>💵 Maaş & Prim ({maaslar.length})</button>
        </div>

        <div className="prs-modal-body">
          {aktifTab === "ozluk" && (
            <div className="prs-ozluk-grid">
              <div><label>TC No</label><div>{personel.TCNo || "—"}</div></div>
              <div><label>Doğum Tarihi</label><div>{personel.DogumTarihi ? new Date(personel.DogumTarihi).toLocaleDateString("tr-TR") : "—"}</div></div>
              <div><label>Cinsiyet</label><div>{personel.Cinsiyet || "—"}</div></div>
              <div><label>Medeni Hal</label><div>{personel.MedeniHal || "—"}</div></div>
              <div><label>İşe Giriş</label><div>{personel.IseGirisTarihi ? new Date(personel.IseGirisTarihi).toLocaleDateString("tr-TR") : "—"}</div></div>
              <div><label>Telefon</label><div>{personel.Telefon || "—"}</div></div>
              <div><label>E-posta</label><div>{personel.Email || "—"}</div></div>
              <div><label>IBAN</label><div>{personel.IBAN || "—"}</div></div>
              <div style={{ gridColumn: "1 / -1" }}><label>Adres</label><div>{personel.Adres || "—"}</div></div>
              <div><label>Acil Durum Kişisi</label><div>{personel.AcilDurumKisi || "—"}</div></div>
              <div><label>Acil Durum Tel</label><div>{personel.AcilDurumTel || "—"}</div></div>
            </div>
          )}

          {aktifTab === "izin" && (
            <>
              <div className="prs-entry-row">
                <select value={izinForm.IzinTipi} onChange={e => setIzinForm({ ...izinForm, IzinTipi: e.target.value })}>
                  {IZIN_TIPLERI.map(t => <option key={t}>{t}</option>)}
                </select>
                <input type="date" value={izinForm.BaslangicTarihi} onChange={e => setIzinForm({ ...izinForm, BaslangicTarihi: e.target.value })} />
                <input type="date" value={izinForm.BitisTarihi} onChange={e => setIzinForm({ ...izinForm, BitisTarihi: e.target.value })} />
                <input type="number" placeholder="Gün" style={{ width: 70 }} value={izinForm.GunSayisi} onChange={e => setIzinForm({ ...izinForm, GunSayisi: e.target.value })} />
                <input placeholder="Açıklama" value={izinForm.Aciklama} onChange={e => setIzinForm({ ...izinForm, Aciklama: e.target.value })} />
                <button className="prs-btn-add" onClick={izinEkle}>+ Ekle</button>
              </div>
              <table className="prs-detay-table">
                <thead><tr><th>Tip</th><th>Başlangıç</th><th>Bitiş</th><th>Gün</th><th>Açıklama</th><th></th></tr></thead>
                <tbody>
                  {izinler.map(i => (
                    <tr key={i.IzinId}>
                      <td>{i.IzinTipi}</td>
                      <td>{new Date(i.BaslangicTarihi).toLocaleDateString("tr-TR")}</td>
                      <td>{new Date(i.BitisTarihi).toLocaleDateString("tr-TR")}</td>
                      <td>{i.GunSayisi}</td>
                      <td>{i.Aciklama}</td>
                      <td><button className="prs-btn-del-sm" onClick={() => izinSil(i.IzinId)}>Sil</button></td>
                    </tr>
                  ))}
                  {izinler.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "#999", padding: 10 }}>Kayıt yok</td></tr>}
                </tbody>
              </table>
            </>
          )}

          {aktifTab === "puantaj" && (
            <>
              <div className="prs-entry-row">
                <input type="date" value={puantajForm.Tarih} onChange={e => setPuantajForm({ ...puantajForm, Tarih: e.target.value })} />
                <input placeholder="Giriş" style={{ width: 70 }} value={puantajForm.GirisSaati} onChange={e => setPuantajForm({ ...puantajForm, GirisSaati: e.target.value })} />
                <input placeholder="Çıkış" style={{ width: 70 }} value={puantajForm.CikisSaati} onChange={e => setPuantajForm({ ...puantajForm, CikisSaati: e.target.value })} />
                <select value={puantajForm.Durum} onChange={e => setPuantajForm({ ...puantajForm, Durum: e.target.value })}>
                  {PUANTAJ_DURUMLARI.map(d => <option key={d}>{d}</option>)}
                </select>
                <button className="prs-btn-add" onClick={puantajEkle}>+ Ekle</button>
              </div>
              <table className="prs-detay-table">
                <thead><tr><th>Tarih</th><th>Giriş</th><th>Çıkış</th><th>Durum</th><th></th></tr></thead>
                <tbody>
                  {puantaj.slice(0, 30).map(p => (
                    <tr key={p.PuantajId}>
                      <td>{new Date(p.Tarih).toLocaleDateString("tr-TR")}</td>
                      <td>{p.GirisSaati}</td><td>{p.CikisSaati}</td>
                      <td><span className={`erp-badge ${p.Durum === "Tam Gün" ? "green" : p.Durum === "Devamsız" ? "red" : "orange"}`}>{p.Durum}</span></td>
                      <td><button className="prs-btn-del-sm" onClick={() => puantajSil(p.PuantajId)}>Sil</button></td>
                    </tr>
                  ))}
                  {puantaj.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "#999", padding: 10 }}>Kayıt yok</td></tr>}
                </tbody>
              </table>
            </>
          )}

          {aktifTab === "maas" && (
            <>
              <div className="prs-entry-row">
                <input type="number" placeholder="Yıl" style={{ width: 70 }} value={maasForm.DonemYil} onChange={e => setMaasForm({ ...maasForm, DonemYil: e.target.value })} />
                <select value={maasForm.DonemAy} onChange={e => setMaasForm({ ...maasForm, DonemAy: e.target.value })}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(ay => <option key={ay} value={ay}>{ay}. Ay</option>)}
                </select>
                <input type="number" placeholder="Brüt Maaş" value={maasForm.BrutMaas} onChange={e => setMaasForm({ ...maasForm, BrutMaas: e.target.value })} />
                <input type="number" placeholder="Net Maaş" value={maasForm.NetMaas} onChange={e => setMaasForm({ ...maasForm, NetMaas: e.target.value })} />
                <input type="number" placeholder="Prim" style={{ width: 90 }} value={maasForm.Prim} onChange={e => setMaasForm({ ...maasForm, Prim: e.target.value })} />
                <button className="prs-btn-add" onClick={maasEkle}>+ Ekle</button>
              </div>
              <table className="prs-detay-table">
                <thead><tr><th>Dönem</th><th>Brüt</th><th>Net</th><th>Prim</th><th>Kesinti</th><th></th></tr></thead>
                <tbody>
                  {maaslar.map(m => (
                    <tr key={m.MaasId}>
                      <td>{m.DonemAy}/{m.DonemYil}</td>
                      <td>{Number(m.BrutMaas).toLocaleString()} ₺</td>
                      <td style={{ fontWeight: 700 }}>{Number(m.NetMaas).toLocaleString()} ₺</td>
                      <td>{Number(m.Prim || 0).toLocaleString()} ₺</td>
                      <td>{Number(m.Kesinti || 0).toLocaleString()} ₺</td>
                      <td><button className="prs-btn-del-sm" onClick={() => maasSil(m.MaasId)}>Sil</button></td>
                    </tr>
                  ))}
                  {maaslar.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "#999", padding: 10 }}>Kayıt yok</td></tr>}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonelForm;
