import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import SearchableSelect from "../components/SearchableSelect";
import ExportToolbar from "../components/ExportToolbar";
import "./IhracatPage.css";

const API_URL = "http://localhost:5000/api";
const DURUMLAR = ["Hazırlanıyor", "Gümrükte", "Sevk Edildi", "Teslim Edildi", "Tamamlandı"];
const TESLIM_SEKILLERI = ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DDP"];
const PARA_BIRIMLERI = ["USD", "EUR", "GBP"];
const EVRAK_TIPLERI = ["Gümrük Beyannamesi", "Konşimento (B/L)", "CMR", "Menşe Şahadetnamesi", "Sigorta Poliçesi"];

const emptyIhracatForm = {
  IhracatKodu: "", CariId: "", CariKodu: "", CariAdi: "",
  IhracatTarihi: new Date().toISOString().split("T")[0],
  TeslimSekli: "FOB", NakliyeFirmasi: "", GumrukBeyannameNo: "", VarisUlkesi: "",
  ParaBirimi: "USD", DovizTutari: "", FaturaKuru: "", Notlar: ""
};

const emptyBozumForm = {
  IhracatId: "", CariId: "", ParaBirimi: "USD", DovizTutari: "",
  BozumKuru: "", BozumTarihi: new Date().toISOString().split("T")[0], Aciklama: ""
};

const IhracatPage = () => {
  const [tab, setTab] = useState("islemler");
  const [ihracatlar, setIhracatlar] = useState([]);
  const [musteriler, setMusteriler] = useState([]);
  const [bozumlar, setBozumlar] = useState([]);
  const [cariler, setCariler] = useState([]);

  const [ihracatForm, setIhracatForm] = useState(emptyIhracatForm);
  const [bozumForm, setBozumForm] = useState(emptyBozumForm);
  const [seciliIhracat, setSeciliIhracat] = useState(null);
  const [seciliEvrak, setSeciliEvrak] = useState([]);
  const [evrakYukleniyor, setEvrakYukleniyor] = useState({});
  const [serbestBaslik, setSerbestBaslik] = useState("");

  const fetchAll = async () => {
    try {
      const [i, m, b, c] = await Promise.all([
        axios.get(`${API_URL}/ihracat`).then(r => r.data),
        axios.get(`${API_URL}/ihracat/musteriler`).then(r => r.data),
        axios.get(`${API_URL}/doviz-bozum`).then(r => r.data),
        axios.get(`${API_URL}/cariler`).then(r => r.data),
      ]);
      setIhracatlar(i); setMusteriler(m); setBozumlar(b); setCariler(c);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    if (!ihracatForm.IhracatKodu) {
      setIhracatForm(f => ({ ...f, IhracatKodu: `IHR-${Date.now().toString().slice(-6)}` }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchEvrak = useCallback(async (ihracatId) => {
    if (!ihracatId) return;
    const res = await axios.get(`${API_URL}/ihracat/${ihracatId}/evrak`);
    setSeciliEvrak(res.data);
  }, []);

  useEffect(() => { if (seciliIhracat) fetchEvrak(seciliIhracat.IhracatId); }, [seciliIhracat, fetchEvrak]);

  const handleCariSecim = (cariId) => {
    const c = cariler.find(x => String(x.CariId) === String(cariId));
    setIhracatForm(f => ({ ...f, CariId: cariId, CariKodu: c ? c.CariKodu : "", CariAdi: c ? c.CariAdi : "" }));
  };

  const ihracatKaydet = async () => {
    if (!ihracatForm.CariId) return alert("Müşteri seçin.");
    if (!ihracatForm.DovizTutari) return alert("Döviz tutarını girin.");
    try {
      await axios.post(`${API_URL}/ihracat`, ihracatForm);
      setIhracatForm({ ...emptyIhracatForm, IhracatKodu: `IHR-${Date.now().toString().slice(-6)}` });
      fetchAll();
      alert("İhracat kaydı oluşturuldu.");
    } catch (err) { alert("Kaydedilirken hata oluştu: " + (err.response?.data?.error || err.message)); }
  };

  const durumDegis = async (id, durum) => {
    await axios.put(`${API_URL}/ihracat/${id}/durum`, { Durum: durum });
    fetchAll();
  };

  const ihracatSil = async (id) => {
    if (!window.confirm("Bu ihracat kaydını silmek istediğinize emin misiniz?")) return;
    try {
      await axios.delete(`${API_URL}/ihracat/${id}`);
      if (seciliIhracat?.IhracatId === id) setSeciliIhracat(null);
      fetchAll();
    } catch (err) { alert("Silinirken hata oluştu: " + (err.response?.data?.error || err.message)); }
  };

  const evrakYukle = async (file, evrakTipi, baslik) => {
    if (!file || !seciliIhracat) return;
    setEvrakYukleniyor(prev => ({ ...prev, [evrakTipi]: true }));
    const form = new FormData();
    form.append("dosya", file);
    form.append("EvrakTipi", evrakTipi);
    if (baslik) form.append("Baslik", baslik);
    try {
      await axios.post(`${API_URL}/ihracat/${seciliIhracat.IhracatId}/evrak`, form, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setSerbestBaslik("");
      fetchEvrak(seciliIhracat.IhracatId);
    } catch (err) { alert("Evrak yüklenirken hata oluştu."); }
    finally { setEvrakYukleniyor(prev => ({ ...prev, [evrakTipi]: false })); }
  };

  const evrakSil = async (evrakId) => {
    if (!window.confirm("Bu evrakı silmek istediğinize emin misiniz?")) return;
    await axios.delete(`${API_URL}/ihracat/evrak/${evrakId}`);
    fetchEvrak(seciliIhracat.IhracatId);
  };

  const bozumKaydet = async () => {
    if (!bozumForm.CariId || !bozumForm.DovizTutari || !bozumForm.BozumKuru) return alert("Cari, döviz tutarı ve kur girin.");
    try {
      await axios.post(`${API_URL}/doviz-bozum`, bozumForm);
      setBozumForm(emptyBozumForm);
      fetchAll();
    } catch (err) { alert("Kaydedilirken hata oluştu: " + (err.response?.data?.error || err.message)); }
  };

  const bozumSil = async (id) => {
    if (!window.confirm("Bu bozum kaydını silmek istediğinize emin misiniz?")) return;
    await axios.delete(`${API_URL}/doviz-bozum/${id}`);
    fetchAll();
  };

  const ihracatExcelCols = [
    { key: "IhracatKodu", label: "Kod" }, { key: "CariAdi", label: "Müşteri" }, { key: "IhracatTarihi", label: "Tarih" },
    { key: "TeslimSekli", label: "Teslim Şekli" }, { key: "ParaBirimi", label: "PB" }, { key: "DovizTutari", label: "Tutar" },
    { key: "TLKarsiligi", label: "TL Karşılığı" }, { key: "Durum", label: "Durum" }
  ];
  const bozumExcelCols = [
    { key: "CariAdi", label: "Müşteri" }, { key: "IhracatKodu", label: "İhracat Kodu" }, { key: "ParaBirimi", label: "PB" },
    { key: "DovizTutari", label: "Döviz Tutarı" }, { key: "BozumKuru", label: "Bozum Kuru" }, { key: "TLTutari", label: "TL Tutarı" },
    { key: "BozumTarihi", label: "Tarih" }, { key: "KurFarki", label: "Kur Farkı" }
  ];

  return (
    <div className="ihr-container">
      <div className="ihr-tabs">
        <button className={tab === "islemler" ? "active" : ""} onClick={() => setTab("islemler")}>İhracat İşlemleri</button>
        <button className={tab === "bozum" ? "active" : ""} onClick={() => setTab("bozum")}>Döviz Bozum Takibi</button>
        <button className={tab === "musteriler" ? "active" : ""} onClick={() => setTab("musteriler")}>İhracat Müşterileri</button>
      </div>

      {tab === "islemler" && (
        <>
          <div className="ihr-card">
            <div className="ihr-card-header"><h3>Yeni İhracat Kaydı</h3></div>
            <div className="ihr-form-grid">
              <div><label>İhracat Kodu</label><input value={ihracatForm.IhracatKodu} readOnly /></div>
              <div style={{ gridColumn: "span 2" }}>
                <label>Müşteri *</label>
                <SearchableSelect
                  options={cariler.map(c => ({ value: c.CariId, label: c.CariAdi, sublabel: c.CariKodu }))}
                  value={ihracatForm.CariId}
                  onChange={handleCariSecim}
                  placeholder="Müşteri seçin..."
                />
              </div>
              <div><label>İhracat Tarihi</label><input type="date" value={ihracatForm.IhracatTarihi} onChange={e => setIhracatForm({ ...ihracatForm, IhracatTarihi: e.target.value })} /></div>
              <div>
                <label>Teslim Şekli (Incoterms)</label>
                <select value={ihracatForm.TeslimSekli} onChange={e => setIhracatForm({ ...ihracatForm, TeslimSekli: e.target.value })}>
                  {TESLIM_SEKILLERI.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div><label>Varış Ülkesi</label><input value={ihracatForm.VarisUlkesi} onChange={e => setIhracatForm({ ...ihracatForm, VarisUlkesi: e.target.value })} /></div>
              <div><label>Nakliye Firması</label><input value={ihracatForm.NakliyeFirmasi} onChange={e => setIhracatForm({ ...ihracatForm, NakliyeFirmasi: e.target.value })} /></div>
              <div><label>Gümrük Beyanname No</label><input value={ihracatForm.GumrukBeyannameNo} onChange={e => setIhracatForm({ ...ihracatForm, GumrukBeyannameNo: e.target.value })} /></div>
              <div>
                <label>Para Birimi</label>
                <select value={ihracatForm.ParaBirimi} onChange={e => setIhracatForm({ ...ihracatForm, ParaBirimi: e.target.value })}>
                  {PARA_BIRIMLERI.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div><label>Döviz Tutarı *</label><input type="number" value={ihracatForm.DovizTutari} onChange={e => setIhracatForm({ ...ihracatForm, DovizTutari: e.target.value })} /></div>
              <div><label>Fatura Günü Kuru</label><input type="number" step="0.0001" value={ihracatForm.FaturaKuru} onChange={e => setIhracatForm({ ...ihracatForm, FaturaKuru: e.target.value })} /></div>
              <div style={{ gridColumn: "1 / -1" }}><label>Notlar</label><input value={ihracatForm.Notlar} onChange={e => setIhracatForm({ ...ihracatForm, Notlar: e.target.value })} /></div>
            </div>
            <button className="ihr-save-btn" onClick={ihracatKaydet}>+ İhracat Kaydı Oluştur</button>
          </div>

          <div className="ihr-card">
            <div className="ihr-card-header"><h3>İhracat Listesi ({ihracatlar.length})</h3></div>
            <ExportToolbar data={ihracatlar} columns={ihracatExcelCols} filename="ihracat-listesi" />
            <table className="ihr-table">
              <thead><tr><th>Kod</th><th>Müşteri</th><th>Tarih</th><th>Teslim</th><th>Tutar</th><th>TL Karşılığı</th><th>Durum</th><th>Evrak</th><th></th></tr></thead>
              <tbody>
                {ihracatlar.map(i => (
                  <tr key={i.IhracatId} className={seciliIhracat?.IhracatId === i.IhracatId ? "ihr-secili-row" : ""}>
                    <td>{i.IhracatKodu}</td>
                    <td>{i.CariAdi}</td>
                    <td>{new Date(i.IhracatTarihi).toLocaleDateString("tr-TR")}</td>
                    <td>{i.TeslimSekli}</td>
                    <td>{Number(i.DovizTutari).toLocaleString()} {i.ParaBirimi}</td>
                    <td>{i.TLKarsiligi ? Number(i.TLKarsiligi).toLocaleString() + " ₺" : "—"}</td>
                    <td>
                      <select value={i.Durum} onChange={e => durumDegis(i.IhracatId, e.target.value)} className="ihr-durum-select">
                        {DURUMLAR.map(d => <option key={d}>{d}</option>)}
                      </select>
                    </td>
                    <td><button className="ihr-evrak-btn" onClick={() => setSeciliIhracat(i)}>📎 Evraklar</button></td>
                    <td><button className="ihr-sil-btn" onClick={() => ihracatSil(i.IhracatId)}>Sil</button></td>
                  </tr>
                ))}
                {ihracatlar.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", color: "#999", padding: 14 }}>Henüz ihracat kaydı yok</td></tr>}
              </tbody>
            </table>
          </div>

          {seciliIhracat && (
            <div className="ihr-card">
              <div className="ihr-card-header">
                <h3>📎 {seciliIhracat.IhracatKodu} — Gümrük & Nakliye Evrakları</h3>
                <button className="ihr-kapat-btn" onClick={() => setSeciliIhracat(null)}>✕ Kapat</button>
              </div>
              <div className="evrak-grid">
                {EVRAK_TIPLERI.map(tip => {
                  const mevcutlar = seciliEvrak.filter(e => e.EvrakTipi === tip);
                  return (
                    <div className="evrak-slot" key={tip}>
                      <div className="evrak-slot-header">📄 {tip}</div>
                      {mevcutlar.map(e => (
                        <div className="evrak-slot-dosya" key={e.EvrakId}>
                          <a href={`http://localhost:5000${e.DosyaYolu}`} target="_blank" rel="noreferrer">📎 {e.DosyaAdi}</a>
                          <button type="button" className="evrak-sil-btn" onClick={() => evrakSil(e.EvrakId)}>Sil</button>
                        </div>
                      ))}
                      <label className="evrak-upload-label">
                        {evrakYukleniyor[tip] ? "Yükleniyor..." : "+ Dosya Yükle"}
                        <input type="file" className="hidden-file-input" onChange={e => evrakYukle(e.target.files[0], tip)} disabled={evrakYukleniyor[tip]} />
                      </label>
                    </div>
                  );
                })}
              </div>
              <div className="evrak-serbest" style={{ marginTop: 16 }}>
                <h4>Serbest Dosyalar</h4>
                <div className="evrak-serbest-ekle">
                  <input type="text" placeholder="Dosya başlığı..." value={serbestBaslik} onChange={e => setSerbestBaslik(e.target.value)} />
                  <label className="evrak-upload-label">
                    {evrakYukleniyor["Serbest"] ? "Yükleniyor..." : "+ Dosya Seç"}
                    <input type="file" className="hidden-file-input" onChange={e => evrakYukle(e.target.files[0], "Serbest", serbestBaslik)} disabled={evrakYukleniyor["Serbest"]} />
                  </label>
                </div>
                {seciliEvrak.filter(e => e.EvrakTipi === "Serbest").map(e => (
                  <div className="evrak-serbest-item" key={e.EvrakId}>
                    <a href={`http://localhost:5000${e.DosyaYolu}`} target="_blank" rel="noreferrer">📎 {e.Baslik || e.DosyaAdi}</a>
                    <button type="button" className="evrak-sil-btn" onClick={() => evrakSil(e.EvrakId)}>Sil</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === "bozum" && (
        <>
          <div className="ihr-card">
            <div className="ihr-card-header"><h3>Yeni Döviz Bozum Kaydı</h3></div>
            <div className="ihr-form-grid">
              <div style={{ gridColumn: "span 2" }}>
                <label>Müşteri *</label>
                <SearchableSelect
                  options={cariler.map(c => ({ value: c.CariId, label: c.CariAdi, sublabel: c.CariKodu }))}
                  value={bozumForm.CariId}
                  onChange={val => setBozumForm({ ...bozumForm, CariId: val })}
                  placeholder="Müşteri seçin..."
                />
              </div>
              <div>
                <label>İlgili İhracat (opsiyonel)</label>
                <SearchableSelect
                  options={ihracatlar.map(i => ({ value: i.IhracatId, label: i.IhracatKodu, sublabel: i.CariAdi }))}
                  value={bozumForm.IhracatId}
                  onChange={val => setBozumForm({ ...bozumForm, IhracatId: val })}
                  placeholder="İhracat seçin..."
                />
              </div>
              <div>
                <label>Para Birimi</label>
                <select value={bozumForm.ParaBirimi} onChange={e => setBozumForm({ ...bozumForm, ParaBirimi: e.target.value })}>
                  {PARA_BIRIMLERI.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div><label>Döviz Tutarı *</label><input type="number" value={bozumForm.DovizTutari} onChange={e => setBozumForm({ ...bozumForm, DovizTutari: e.target.value })} /></div>
              <div><label>Bozum Kuru *</label><input type="number" step="0.0001" value={bozumForm.BozumKuru} onChange={e => setBozumForm({ ...bozumForm, BozumKuru: e.target.value })} /></div>
              <div><label>Bozum Tarihi</label><input type="date" value={bozumForm.BozumTarihi} onChange={e => setBozumForm({ ...bozumForm, BozumTarihi: e.target.value })} /></div>
              <div style={{ gridColumn: "1 / -1" }}><label>Açıklama</label><input value={bozumForm.Aciklama} onChange={e => setBozumForm({ ...bozumForm, Aciklama: e.target.value })} /></div>
            </div>
            <button className="ihr-save-btn" onClick={bozumKaydet}>+ Bozum Kaydı Ekle</button>
          </div>

          <div className="ihr-card">
            <div className="ihr-card-header"><h3>Döviz Bozum Listesi ({bozumlar.length})</h3></div>
            <ExportToolbar data={bozumlar} columns={bozumExcelCols} filename="doviz-bozum-listesi" />
            <table className="ihr-table">
              <thead><tr><th>Müşteri</th><th>İhracat</th><th>Döviz</th><th>Bozum Kuru</th><th>TL Tutarı</th><th>Tarih</th><th>Kur Farkı</th><th></th></tr></thead>
              <tbody>
                {bozumlar.map(b => (
                  <tr key={b.BozumId}>
                    <td>{b.CariAdi}</td>
                    <td>{b.IhracatKodu || "—"}</td>
                    <td>{Number(b.DovizTutari).toLocaleString()} {b.ParaBirimi}</td>
                    <td>{Number(b.BozumKuru).toLocaleString()}</td>
                    <td style={{ fontWeight: 700 }}>{Number(b.TLTutari).toLocaleString()} ₺</td>
                    <td>{new Date(b.BozumTarihi).toLocaleDateString("tr-TR")}</td>
                    <td>
                      {b.KurFarki !== null ? (
                        <span className={`ihr-kur-farki ${b.KurFarki >= 0 ? "pozitif" : "negatif"}`}>
                          {b.KurFarki >= 0 ? "+" : ""}{b.KurFarki.toLocaleString()} ₺
                        </span>
                      ) : "—"}
                    </td>
                    <td><button className="ihr-sil-btn" onClick={() => bozumSil(b.BozumId)}>Sil</button></td>
                  </tr>
                ))}
                {bozumlar.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: "#999", padding: 14 }}>Henüz bozum kaydı yok</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "musteriler" && (
        <div className="ihr-card">
          <div className="ihr-card-header"><h3>İhracat Yaptığımız Müşteriler ({musteriler.length})</h3></div>
          <ExportToolbar
            data={musteriler}
            columns={[{ key: "CariAdi", label: "Müşteri" }, { key: "SevkiyatSayisi", label: "Sevkiyat Sayısı" }, { key: "ToplamTLKarsiligi", label: "Toplam TL" }, { key: "SonSevkiyatTarihi", label: "Son Sevkiyat" }]}
            filename="ihracat-musterileri"
          />
          <table className="ihr-table">
            <thead><tr><th>Müşteri</th><th>Sevkiyat Sayısı</th><th>Toplam TL Karşılığı</th><th>Son Sevkiyat</th></tr></thead>
            <tbody>
              {musteriler.map(m => (
                <tr key={m.CariId}>
                  <td>{m.CariAdi} <span className="ihr-mini-kod">{m.CariKodu}</span></td>
                  <td>{m.SevkiyatSayisi}</td>
                  <td style={{ fontWeight: 700 }}>{Number(m.ToplamTLKarsiligi).toLocaleString()} ₺</td>
                  <td>{m.SonSevkiyatTarihi ? new Date(m.SonSevkiyatTarihi).toLocaleDateString("tr-TR") : "—"}</td>
                </tr>
              ))}
              {musteriler.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "#999", padding: 14 }}>Henüz ihracat müşterisi yok</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default IhracatPage;
