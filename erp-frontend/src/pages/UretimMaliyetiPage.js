import React, { useState, useEffect } from "react";
import axios from "axios";
import "./UretimMaliyetiPage.css";

const API_URL = "http://localhost:5000/api";
const KATEGORILER = ["Genel Gider", "Görünmeyen Gider", "Personel"];

const emptyGider = { GiderAdi: "", AylikTutar: "", Kategori: "Genel Gider", Aciklama: "" };

const UretimMaliyetiPage = () => {
  const [tab, setTab] = useState("giderler");

  // Giderler
  const [giderler, setGiderler] = useState([]);
  const [giderForm, setGiderForm] = useState(emptyGider);
  const [personelOzet, setPersonelOzet] = useState(null);

  // Parametreler
  const [param, setParam] = useState({ SaatlikIscilikMaliyeti: "0", AylikUretimKapasitesiSaat: "176" });

  // Başabaş
  const [basabasForm, setBasabasForm] = useState({ satisFiyati: "", birimDegiskenMaliyet: "" });
  const [basabasSonuc, setBasabasSonuc] = useState(null);

  const fetchGiderler = async () => {
    const res = await axios.get(`${API_URL}/sabit-giderler`);
    setGiderler(res.data);
  };
  const fetchPersonelOzet = async () => {
    try { const res = await axios.get(`${API_URL}/sabit-giderler/personel-toplam`); setPersonelOzet(res.data); }
    catch (err) { console.error(err); }
  };
  const fetchParam = async () => {
    const res = await axios.get(`${API_URL}/maliyet-parametreleri`);
    setParam({ SaatlikIscilikMaliyeti: String(res.data.SaatlikIscilikMaliyeti), AylikUretimKapasitesiSaat: String(res.data.AylikUretimKapasitesiSaat) });
  };

  useEffect(() => { fetchGiderler(); fetchPersonelOzet(); fetchParam(); }, []);

  const giderEkle = async () => {
    if (!giderForm.GiderAdi || !giderForm.AylikTutar) return alert("Gider adı ve tutar girin.");
    try {
      await axios.post(`${API_URL}/sabit-giderler`, giderForm);
      setGiderForm(emptyGider);
      fetchGiderler();
    } catch (err) { alert("Gider eklenirken hata oluştu."); }
  };

  const giderSil = async (id) => {
    if (!window.confirm("Bu gideri silmek istediğinize emin misiniz?")) return;
    await axios.delete(`${API_URL}/sabit-giderler/${id}`);
    fetchGiderler();
  };

  const giderAktifDegistir = async (g) => {
    await axios.put(`${API_URL}/sabit-giderler/${g.GiderId}`, { ...g, Aktif: !g.Aktif });
    fetchGiderler();
  };

  const personelGideriEkle = () => {
    if (!personelOzet) return;
    setGiderForm({
      GiderAdi: "Personel Giderleri (Otomatik)",
      AylikTutar: String(personelOzet.tahminiIsverenMaliyeti),
      Kategori: "Personel",
      Aciklama: `${personelOzet.personelSayisi} personel, brüt toplam ${personelOzet.toplamBrutMaas.toLocaleString()} ₺ üzerinden tahmini işveren maliyeti.`,
    });
  };

  const paramKaydet = async () => {
    try {
      await axios.put(`${API_URL}/maliyet-parametreleri`, param);
      alert("Parametreler güncellendi.");
    } catch (err) { alert("Kaydedilirken hata oluştu."); }
  };

  const basabasHesapla = async () => {
    if (!basabasForm.satisFiyati) return alert("Satış fiyatı girin.");
    try {
      const res = await axios.post(`${API_URL}/basabas-hesapla`, basabasForm);
      setBasabasSonuc(res.data);
    } catch (err) { alert("Hesaplanırken hata oluştu."); }
  };

  const aktifGiderToplam = giderler.filter(g => g.Aktif).reduce((a, g) => a + Number(g.AylikTutar), 0);
  const saatlikGenelGider = Number(param.AylikUretimKapasitesiSaat) > 0 ? aktifGiderToplam / Number(param.AylikUretimKapasitesiSaat) : 0;

  return (
    <div className="ump-container">
      <div className="ump-tabs">
        <button className={tab === "giderler" ? "active" : ""} onClick={() => setTab("giderler")}>Gider Kalemleri</button>
        <button className={tab === "parametre" ? "active" : ""} onClick={() => setTab("parametre")}>İşçilik & Kapasite</button>
        <button className={tab === "basabas" ? "active" : ""} onClick={() => setTab("basabas")}>Başabaş Noktası</button>
      </div>

      {/* --- GİDER KALEMLERİ --- */}
      {tab === "giderler" && (
        <>
          <div className="ump-card">
            <div className="ump-card-header"><h3>Aylık Sabit Giderler (Kira, Elektrik, Sigorta, Personel vb.)</h3></div>
            <div className="ump-ozet-satir">Aktif Toplam Aylık Gider: <strong>{aktifGiderToplam.toLocaleString()} ₺</strong></div>

            {personelOzet && personelOzet.personelSayisi > 0 && (
              <div className="ump-personel-oneri">
                <span>💡 Sistemde <strong>{personelOzet.personelSayisi} personel</strong> kayıtlı, tahmini aylık işveren maliyeti: <strong>{personelOzet.tahminiIsverenMaliyeti.toLocaleString()} ₺</strong></span>
                <button onClick={personelGideriEkle}>Bu Tutarı Gider Olarak Ekle</button>
              </div>
            )}

            <div className="ump-entry-row">
              <input placeholder="Gider Adı (örn: Kira)" value={giderForm.GiderAdi} onChange={e => setGiderForm({ ...giderForm, GiderAdi: e.target.value })} />
              <input type="number" placeholder="Aylık Tutar (₺)" value={giderForm.AylikTutar} onChange={e => setGiderForm({ ...giderForm, AylikTutar: e.target.value })} />
              <select value={giderForm.Kategori} onChange={e => setGiderForm({ ...giderForm, Kategori: e.target.value })}>
                {KATEGORILER.map(k => <option key={k}>{k}</option>)}
              </select>
              <input placeholder="Açıklama (opsiyonel)" value={giderForm.Aciklama} onChange={e => setGiderForm({ ...giderForm, Aciklama: e.target.value })} />
              <button onClick={giderEkle}>+ Ekle</button>
            </div>

            <table className="ump-table">
              <thead><tr><th>Gider Adı</th><th>Kategori</th><th>Aylık Tutar</th><th>Durum</th><th></th></tr></thead>
              <tbody>
                {giderler.map(g => (
                  <tr key={g.GiderId} style={{ opacity: g.Aktif ? 1 : 0.5 }}>
                    <td>{g.GiderAdi}{g.Aciklama && <div className="ump-mini-not">{g.Aciklama}</div>}</td>
                    <td><span className="ump-kategori-badge">{g.Kategori}</span></td>
                    <td style={{ fontWeight: 700 }}>{Number(g.AylikTutar).toLocaleString()} ₺</td>
                    <td><button className="ump-toggle-btn" onClick={() => giderAktifDegistir(g)}>{g.Aktif ? "Aktif" : "Pasif"}</button></td>
                    <td><button className="ump-sil-btn" onClick={() => giderSil(g.GiderId)}>Sil</button></td>
                  </tr>
                ))}
                {giderler.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "#999", padding: 14 }}>Henüz gider eklenmedi</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* --- PARAMETRELER --- */}
      {tab === "parametre" && (
        <div className="ump-card">
          <div className="ump-card-header"><h3>İşçilik & Üretim Kapasitesi Parametreleri</h3></div>
          <p className="ump-not">
            Bu parametreler, reçete maliyet hesaplamasında adam-saat işçilik ve genel gider payının otomatik
            dağıtılması için kullanılır.
          </p>
          <div className="ump-param-grid">
            <div>
              <label>Saatlik İşçilik Maliyeti (₺/saat)</label>
              <input type="number" value={param.SaatlikIscilikMaliyeti} onChange={e => setParam({ ...param, SaatlikIscilikMaliyeti: e.target.value })} />
              <span className="ump-hint">İşveren SGK primi dahil gerçek saatlik maliyet (bordro modülünden yaklaşık hesaplayabilirsiniz)</span>
            </div>
            <div>
              <label>Aylık Üretim Kapasitesi (saat)</label>
              <input type="number" value={param.AylikUretimKapasitesiSaat} onChange={e => setParam({ ...param, AylikUretimKapasitesiSaat: e.target.value })} />
              <span className="ump-hint">Örn: 3 işçi × 22 gün × 8 saat = 528 saat/ay</span>
            </div>
          </div>
          <div className="ump-hesaplanan-kutu">
            Hesaplanan Saatlik Genel Gider Payı: <strong>{saatlikGenelGider.toLocaleString(undefined, { maximumFractionDigits: 2 })} ₺/saat</strong>
            <span> ({aktifGiderToplam.toLocaleString()} ₺ toplam aktif gider ÷ {param.AylikUretimKapasitesiSaat} saat kapasite)</span>
          </div>
          <button className="ump-save-btn" onClick={paramKaydet}>Kaydet</button>
        </div>
      )}

      {/* --- BAŞABAŞ NOKTASI --- */}
      {tab === "basabas" && (
        <div className="ump-card">
          <div className="ump-card-header"><h3>Başabaş Noktası Hesaplayıcı</h3></div>
          <p className="ump-not">
            Sabit giderler "Gider Kalemleri" sekmesindeki aktif giderlerden otomatik alınır. Birim değişken maliyeti
            reçete maliyet ekranından (malzeme + işçilik + genel gider) alıp buraya girebilirsiniz.
          </p>
          <div className="ump-param-grid">
            <div>
              <label>Satış Fiyatı (₺/adet)</label>
              <input type="number" value={basabasForm.satisFiyati} onChange={e => setBasabasForm({ ...basabasForm, satisFiyati: e.target.value })} />
            </div>
            <div>
              <label>Birim Değişken Maliyet (₺/adet)</label>
              <input type="number" value={basabasForm.birimDegiskenMaliyet} onChange={e => setBasabasForm({ ...basabasForm, birimDegiskenMaliyet: e.target.value })} />
            </div>
          </div>
          <button className="ump-save-btn" onClick={basabasHesapla}>Hesapla</button>

          {basabasSonuc && (
            basabasSonuc.hata ? (
              <div className="ump-basabas-hata">⚠️ {basabasSonuc.hata}</div>
            ) : (
              <div className="ump-basabas-sonuc">
                <div><span>Toplam Aylık Sabit Gider</span><strong>{basabasSonuc.toplamSabitGider.toLocaleString()} ₺</strong></div>
                <div><span>Birim Katkı Payı</span><strong>{basabasSonuc.katkiPayi.toLocaleString(undefined, { maximumFractionDigits: 2 })} ₺ (%{basabasSonuc.katkiPayiOrani})</strong></div>
                <div className="ump-basabas-vurgu"><span>Başabaş Noktası (Adet)</span><strong>{basabasSonuc.basabasAdet.toLocaleString()} adet/ay</strong></div>
                <div className="ump-basabas-vurgu"><span>Başabaş Noktası (Ciro)</span><strong>{basabasSonuc.basabasCiro.toLocaleString()} ₺/ay</strong></div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default UretimMaliyetiPage;
