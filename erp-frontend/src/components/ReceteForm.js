import React, { useState, useEffect } from "react";
import axios from "axios";
import SearchableSelect from "./SearchableSelect";
import ExportToolbar from "./ExportToolbar";
import "./ReceteForm.css";

const API_URL = "http://localhost:5000/api";

const emptyForm = { receteKodu: "", mamulUrunId: "", mamulAdi: "", aciklama: "" };
const emptyEntry = { hammaddeUrunId: "", hammaddeAdi: "", miktar: "", birim: "Adet", istasyon: "" };
const emptyIstasyon = { istasyonAdi: "", tahminiSureDk: "" };

const ReceteForm = () => {
  const [form, setForm] = useState(emptyForm);
  const [entry, setEntry] = useState(emptyEntry);
  const [items, setItems] = useState([]);
  const [istasyonEntry, setIstasyonEntry] = useState(emptyIstasyon);
  const [istasyonlar, setIstasyonlar] = useState([]);
  const [urunler, setUrunler] = useState([]);
  const [receteler, setReceteler] = useState([]);
  const [uretimGecmisi, setUretimGecmisi] = useState([]);
  const [loading, setLoading] = useState(false);
  const [maliyetRecete, setMaliyetRecete] = useState(null);

  const fetchUrunler = async () => {
    try {
      const res = await axios.get(`${API_URL}/urunler`);
      setUrunler(res.data);
    } catch (err) {
      console.error("Ürün listesi alınamadı:", err);
    }
  };

  const fetchReceteler = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/receteler`);
      setReceteler(res.data);
    } catch (err) {
      console.error("Reçete listesi alınamadı:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUretimGecmisi = async () => {
    try {
      const res = await axios.get(`${API_URL}/uretim`);
      setUretimGecmisi(res.data);
    } catch (err) {
      console.error("Üretim geçmişi alınamadı:", err);
    }
  };

  useEffect(() => { fetchUrunler(); fetchReceteler(); fetchUretimGecmisi(); }, []);

  useEffect(() => {
    if (form.receteKodu) return;
    setForm(f => ({ ...f, receteKodu: `REC-${Date.now().toString().slice(-6)}` }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const secilenHammadde = urunler.find(u => String(u.UrunId) === String(entry.hammaddeUrunId));

  const handleMamulSecim = (id) => {
    const secilen = urunler.find(u => String(u.UrunId) === String(id));
    setForm(f => ({ ...f, mamulUrunId: id, mamulAdi: secilen ? secilen.UrunAdi : "" }));
  };

  const handleHammaddeSecim = (id) => {
    const secilen = urunler.find(u => String(u.UrunId) === String(id));
    setEntry(e => ({ ...e, hammaddeUrunId: id, hammaddeAdi: secilen ? secilen.UrunAdi : "", birim: secilen?.Birim || "Adet" }));
  };

  const satirEkle = () => {
    if (!entry.hammaddeUrunId || !entry.miktar) {
      return alert("Hammadde seçin ve miktar girin.");
    }
    setItems(prev => [...prev, { ...entry, id: Date.now() }]);
    setEntry(emptyEntry);
  };

  const satirSil = (id) => setItems(prev => prev.filter(it => it.id !== id));

  const istasyonEkle = () => {
    if (!istasyonEntry.istasyonAdi) return alert("İstasyon adı girin.");
    setIstasyonlar(prev => [...prev, { ...istasyonEntry, id: Date.now() }]);
    setIstasyonEntry(emptyIstasyon);
  };

  const istasyonSil = (id) => setIstasyonlar(prev => prev.filter(it => it.id !== id));

  const resetForm = () => {
    setForm({ ...emptyForm, receteKodu: `REC-${Date.now().toString().slice(-6)}` });
    setItems([]);
    setIstasyonlar([]);
  };

  const handleKaydet = async () => {
    if (!form.mamulUrunId) return alert("Lütfen üretilecek mamul ürünü seçin.");
    if (items.length === 0) return alert("En az bir hammadde satırı eklemelisiniz.");

    try {
      await axios.post(`${API_URL}/receteler`, { form, items, istasyonlar });
      alert(`Reçete kaydedildi: ${form.receteKodu}`);
      resetForm();
      fetchReceteler();
    } catch (err) {
      console.error(err);
      alert("Reçete kaydedilirken hata oluştu: " + (err.response?.data?.error || err.message));
    }
  };

  const handleSil = async (id) => {
    if (!window.confirm("Bu reçeteyi silmek istediğinize emin misiniz?")) return;
    try {
      await axios.delete(`${API_URL}/receteler/${id}`);
      fetchReceteler();
    } catch (err) {
      alert("Silinirken hata oluştu.");
    }
  };

  const handleUret = async (recete) => {
    const miktarStr = window.prompt(`"${recete.MamulAdi}" için kaç adet üretim yapılacak? (Hammaddeler stoktan otomatik düşülür)`, "1");
    if (!miktarStr) return;
    const miktar = Number(miktarStr);
    if (!miktar || miktar <= 0) return alert("Geçerli bir miktar girin.");

    try {
      const res = await axios.post(`${API_URL}/uretim`, { receteId: recete.ReceteId, miktar });
      alert(res.data.message);
      fetchUretimGecmisi();
      fetchUrunler();
    } catch (err) {
      alert("Üretim işlenirken hata oluştu: " + (err.response?.data?.error || err.message));
    }
  };

  const receteExcelCols = [
    { key: "ReceteKodu", label: "Kod" }, { key: "MamulAdi", label: "Mamul" }, { key: "Aciklama", label: "Açıklama" }
  ];

  return (
    <div className="recete-container">
      <div className="recete-form-card">
        <div className="recete-form-header">🧪 Yeni Üretim Reçetesi (BOM)</div>

        <div className="recete-top-grid">
          <div className="recete-field">
            <label>Reçete Kodu</label>
            <input value={form.receteKodu} readOnly />
          </div>
          <div className="recete-field" style={{ flex: 2 }}>
            <label>Üretilecek Mamul (Ürün) *</label>
            <SearchableSelect
              options={urunler.filter(u => u.Tur !== "Hizmet").map(u => ({ value: u.UrunId, label: u.UrunAdi, sublabel: u.UrunKodu }))}
              value={form.mamulUrunId}
              onChange={handleMamulSecim}
              placeholder="Mamul ürün seçin..."
            />
          </div>
          <div className="recete-field" style={{ flex: 2 }}>
            <label>Açıklama</label>
            <input value={form.aciklama} onChange={e => setForm({ ...form, aciklama: e.target.value })} placeholder="Opsiyonel not" />
          </div>
        </div>

        <div className="recete-subheader">Hammadde / Malzeme Satırları (istasyon bazlı)</div>
        <div className="recete-entry-row">
          <div style={{ flex: 2 }}>
            <SearchableSelect
              options={urunler.map(u => ({ value: u.UrunId, label: u.UrunAdi, sublabel: u.UrunKodu }))}
              value={entry.hammaddeUrunId}
              onChange={handleHammaddeSecim}
              placeholder="Hammadde seçin..."
            />
          </div>
          <input
            type="number" placeholder="Miktar" style={{ width: 100 }}
            value={entry.miktar} onChange={e => setEntry({ ...entry, miktar: e.target.value })}
          />
          <input
            placeholder="Birim" style={{ width: 80 }}
            value={entry.birim} onChange={e => setEntry({ ...entry, birim: e.target.value })}
          />
          <input
            placeholder="İstasyon (örn: Kaynak)" style={{ width: 140 }}
            value={entry.istasyon} onChange={e => setEntry({ ...entry, istasyon: e.target.value })}
          />
          <button className="recete-btn-add" onClick={satirEkle}>+ Ekle</button>
        </div>
        {secilenHammadde?.AlisBirimi && (
          <div className="recete-cevrim-note">
            ℹ️ Bu malzeme <strong>{secilenHammadde.AlisBirimi}</strong> olarak satın alınıyor ama reçetede{" "}
            <strong>{secilenHammadde.Birim}</strong> cinsinden takip ediliyor — 1 {secilenHammadde.AlisBirimi} ={" "}
            {secilenHammadde.CevrimOrani} {secilenHammadde.Birim}
          </div>
        )}

        <table className="recete-table">
          <thead>
            <tr><th>Hammadde</th><th>Miktar</th><th>Birim</th><th>İstasyon</th><th></th></tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id}>
                <td>{it.hammaddeAdi}</td>
                <td>{it.miktar}</td>
                <td>{it.birim}</td>
                <td>{it.istasyon ? <span className="erp-badge blue">{it.istasyon}</span> : "—"}</td>
                <td><button className="recete-btn-del-sm" onClick={() => satirSil(it.id)}>Sil</button></td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "#999", padding: 10 }}>Henüz hammadde eklenmedi</td></tr>
            )}
          </tbody>
        </table>

        <div className="recete-subheader">Üretim Rotası (opsiyonel — genel akış sırası)</div>
        <div className="recete-entry-row">
          <input
            placeholder="İstasyon adı (örn: Kesme/Bükme, Kaynak/Montaj, Boyahane...)"
            style={{ flex: 2 }}
            value={istasyonEntry.istasyonAdi}
            onChange={e => setIstasyonEntry({ ...istasyonEntry, istasyonAdi: e.target.value })}
          />
          <input
            type="number" placeholder="Tahmini süre (dk)" style={{ width: 150 }}
            value={istasyonEntry.tahminiSureDk}
            onChange={e => setIstasyonEntry({ ...istasyonEntry, tahminiSureDk: e.target.value })}
          />
          <button className="recete-btn-add" onClick={istasyonEkle}>+ Ekle</button>
        </div>

        {istasyonlar.length > 0 && (
          <div className="recete-istasyon-flow">
            {istasyonlar.map((ist, idx) => (
              <React.Fragment key={ist.id}>
                {idx > 0 && <span className="recete-flow-arrow">→</span>}
                <div className="recete-flow-chip">
                  <span>{ist.istasyonAdi}</span>
                  {ist.tahminiSureDk && <small>{ist.tahminiSureDk} dk</small>}
                  <button onClick={() => istasyonSil(ist.id)}>✕</button>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}

        <div className="recete-form-footer">
          <button className="recete-btn-save" onClick={handleKaydet}>Reçeteyi Kaydet</button>
        </div>
      </div>

      <div className="recete-list-card">
        <h3>Kayıtlı Reçeteler ({receteler.length})</h3>
        <ExportToolbar data={receteler} columns={receteExcelCols} filename="uretim-receteleri" />
        {loading ? <p style={{ color: "#888" }}>Yükleniyor...</p> : (
          <table className="recete-table">
            <thead>
              <tr><th>Kod</th><th>Mamul</th><th>Açıklama</th><th>İşlem</th></tr>
            </thead>
            <tbody>
              {receteler.map(r => (
                <tr key={r.ReceteId}>
                  <td><strong>{r.ReceteKodu}</strong></td>
                  <td>{r.MamulAdi}</td>
                  <td>{r.Aciklama}</td>
                  <td>
                    <button className="recete-btn-maliyet" onClick={() => setMaliyetRecete(r)}>💰 Maliyet Hesapla</button>
                    <button className="recete-btn-uret" onClick={() => handleUret(r)}>⚙️ Üret</button>
                    <button className="recete-btn-del-sm" onClick={() => handleSil(r.ReceteId)}>Sil</button>
                  </td>
                </tr>
              ))}
              {receteler.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: "center", color: "#999", padding: 10 }}>Henüz kayıtlı reçete yok</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="recete-list-card">
        <h3>Son Üretim Hareketleri ({uretimGecmisi.length})</h3>
        <table className="recete-table">
          <thead>
            <tr><th>Tarih</th><th>Mamul</th><th>Üretilen Miktar</th><th>Not</th></tr>
          </thead>
          <tbody>
            {uretimGecmisi.slice(0, 15).map(u => (
              <tr key={u.UretimId}>
                <td>{u.UretimTarihi ? new Date(u.UretimTarihi).toLocaleString("tr-TR") : ""}</td>
                <td>{u.MamulAdi}</td>
                <td>{u.UretilenMiktar}</td>
                <td>{u.Notlar}</td>
              </tr>
            ))}
            {uretimGecmisi.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: "center", color: "#999", padding: 10 }}>Henüz üretim yapılmadı</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {maliyetRecete && (
        <MaliyetModal recete={maliyetRecete} onClose={() => setMaliyetRecete(null)} />
      )}
    </div>
  );
};

/* ================= MALİYET HESAPLAMA MODALI ================= */
const MaliyetModal = ({ recete, onClose }) => {
  const [miktar, setMiktar] = useState(1);
  const [sonuc, setSonuc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [kurForm, setKurForm] = useState({ USD: "", EUR: "" });
  const [cariler, setCariler] = useState([]);
  const [aksiyonSatir, setAksiyonSatir] = useState(null);

  const hesapla = async (m = miktar) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/receteler/${recete.ReceteId}/maliyet`, { params: { miktar: m } });
      setSonuc(res.data);
      setKurForm({ USD: res.data.kurlar.USD || "", EUR: res.data.kurlar.EUR || "" });
    } catch (err) {
      alert("Maliyet hesaplanırken hata oluştu: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    hesapla(1);
    axios.get(`${API_URL}/cariler`).then(r => setCariler(r.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kurGuncelle = async () => {
    try {
      if (kurForm.USD) await axios.post(`${API_URL}/kurlar`, { ParaBirimi: "USD", Deger: kurForm.USD });
      if (kurForm.EUR) await axios.post(`${API_URL}/kurlar`, { ParaBirimi: "EUR", Deger: kurForm.EUR });
      hesapla();
    } catch (err) {
      alert("Kur güncellenirken hata oluştu.");
    }
  };

  return (
    <div className="recete-modal-backdrop" onClick={onClose}>
      <div className="recete-modal" onClick={e => e.stopPropagation()}>
        <div className="recete-modal-header">
          <div>
            <h2>💰 Maliyet Hesabı — {recete.MamulAdi}</h2>
            <span>{recete.ReceteKodu}</span>
          </div>
          <button onClick={onClose}>✕</button>
        </div>

        <div className="recete-modal-body">
          <div className="recete-maliyet-toolbar">
            <div>
              <label>Üretilecek Miktar</label>
              <input type="number" min="1" value={miktar} onChange={e => setMiktar(e.target.value)} style={{ width: 90 }} />
              <button className="recete-btn-add" onClick={() => hesapla(miktar)}>Hesapla</button>
            </div>
            <div className="recete-kur-form">
              <label>USD/TL</label><input type="number" step="0.01" placeholder="Örn: 34.20" value={kurForm.USD} onChange={e => setKurForm({ ...kurForm, USD: e.target.value })} style={{ width: 90 }} />
              <label>EUR/TL</label><input type="number" step="0.01" placeholder="Örn: 37.10" value={kurForm.EUR} onChange={e => setKurForm({ ...kurForm, EUR: e.target.value })} style={{ width: 90 }} />
              <button className="recete-btn-add" onClick={kurGuncelle}>Kur Güncelle</button>
            </div>
          </div>

          {loading ? <p style={{ color: "#888" }}>Hesaplanıyor...</p> : sonuc && (
            <>
              <table className="recete-table">
                <thead>
                  <tr><th>Hammadde</th><th>İstasyon</th><th>Gerekli</th><th>Mevcut Stok</th><th>Durum</th><th>Birim Fiyat</th><th>Satır Maliyeti (TL)</th><th></th></tr>
                </thead>
                <tbody>
                  {sonuc.satirlar.map((s, idx) => (
                    <React.Fragment key={idx}>
                      <tr className={s.eksikMi ? "recete-row-eksik" : ""}>
                        <td>{s.hammaddeAdi}</td>
                        <td>{s.istasyon ? <span className="erp-badge blue">{s.istasyon}</span> : "—"}</td>
                        <td>{s.gerekliMiktar} {s.birim}{s.alisBirimi && <div className="recete-cevrim-mini">({(s.gerekliMiktar / s.cevrimOrani).toFixed(2)} {s.alisBirimi})</div>}</td>
                        <td>{s.mevcutStok} {s.birim}</td>
                        <td>
                          {s.eksikMi
                            ? <span className="erp-badge red">Eksik: {s.eksikMiktar.toFixed(2)} {s.birim}</span>
                            : <span className="erp-badge green">Yeterli</span>}
                        </td>
                        <td>{s.birimFiyat.toLocaleString()} {s.paraBirimi}</td>
                        <td style={{ fontWeight: 700 }}>{s.satirMaliyetTL.toLocaleString(undefined, { maximumFractionDigits: 2 })} ₺</td>
                        <td>
                          {s.eksikMi && (
                            <button className="recete-btn-add" style={{ height: 28, fontSize: "0.75rem" }} onClick={() => setAksiyonSatir(aksiyonSatir === idx ? null : idx)}>
                              {aksiyonSatir === idx ? "Kapat" : "Tedarik Et"}
                            </button>
                          )}
                        </td>
                      </tr>
                      {aksiyonSatir === idx && (
                        <tr>
                          <td colSpan={8}>
                            <EksikMalzemeAksiyon satir={s} cariler={cariler} onDone={() => setAksiyonSatir(null)} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>

              <div className="recete-maliyet-ozet">
                <div><label>Malzeme Maliyeti</label><div>{sonuc.malzemeMaliyetiTL.toLocaleString(undefined, { maximumFractionDigits: 2 })} ₺</div></div>
                <div><label>İşçilik ({(sonuc.toplamSureDk / 60).toFixed(2)} saat)</label><div>{sonuc.iscilikMaliyetiTL.toLocaleString(undefined, { maximumFractionDigits: 2 })} ₺</div></div>
                <div><label>Genel Gider Payı</label><div>{sonuc.genelGiderMaliyetiTL.toLocaleString(undefined, { maximumFractionDigits: 2 })} ₺</div></div>
                <div><label>Toplam Maliyet</label><div className="tl">{sonuc.toplamMaliyetTL.toLocaleString(undefined, { maximumFractionDigits: 2 })} ₺</div></div>
                <div><label>Birim Maliyet (1 adet)</label><div>{sonuc.birimMaliyetTL.toLocaleString(undefined, { maximumFractionDigits: 2 })} ₺</div></div>
                <div><label>USD Karşılığı</label><div>{sonuc.toplamMaliyetUSD ? `$${sonuc.toplamMaliyetUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}</div></div>
                <div><label>EUR Karşılığı</label><div>{sonuc.toplamMaliyetEUR ? `€${sonuc.toplamMaliyetEUR.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}</div></div>
              </div>

              {sonuc.satisKarsilastirma && (
                <div className={`recete-kar-kutusu ${sonuc.satisKarsilastirma.kazandiriyorMu ? "kazanc" : "zarar"}`}>
                  <div>Satış Fiyatı: <strong>{sonuc.satisKarsilastirma.satisFiyati.toLocaleString()} ₺</strong></div>
                  <div>Birim Kar/Zarar: <strong>{sonuc.satisKarsilastirma.birimKar.toLocaleString(undefined, { maximumFractionDigits: 2 })} ₺</strong></div>
                  <div>Kar Oranı: <strong>%{sonuc.satisKarsilastirma.karOrani}</strong></div>
                  {!sonuc.satisKarsilastirma.kazandiriyorMu && <div className="recete-kar-uyari">⚠️ Bu ürün mevcut satış fiyatıyla zarar ediyor!</div>}
                </div>
              )}
              {!sonuc.satisKarsilastirma && (
                <p style={{ fontSize: "0.78rem", color: "#888", marginTop: 10 }}>
                  Bu mamul ürün kartında bir "Liste Fiyatı" tanımlı değil, satış karşılaştırması yapılamıyor.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* --- Eksik malzeme için Sipariş Ver / Teklif Al mini formu --- */
const EksikMalzemeAksiyon = ({ satir, cariler, onDone }) => {
  const [mod, setMod] = useState("siparis");
  const [cariKodu, setCariKodu] = useState("");
  const [miktar, setMiktar] = useState(Math.ceil(satir.eksikMiktar));
  const [notlar, setNotlar] = useState("");
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const cariOptions = cariler.filter(c => c.CariTipi !== 1).map(c => ({ value: c.CariKodu, label: c.CariAdi, sublabel: c.CariKodu }));

  const siparisVer = async () => {
    const secilenCari = cariler.find(c => c.CariKodu === cariKodu);
    if (!secilenCari) return alert("Lütfen bir tedarikçi seçin.");
    setKaydediliyor(true);
    try {
      await axios.post(`${API_URL}/siparisler`, {
        form: {
          siparisKodu: `SIP-${Date.now().toString().slice(-6)}`,
          siparisYonu: "Alış",
          siparisTarihi: new Date().toISOString().split("T")[0],
          siparisTipi: "YENİ SİPARİŞ",
          siparisVeren: "BAYİ",
          cariKodu: secilenCari.CariKodu,
          cariAdi: secilenCari.CariAdi,
        },
        items: [{
          urunKodu: null, urunAdi: satir.hammaddeAdi, miktar, birim: satir.birim,
          birimFiyatKdvDahil: satir.birimFiyat, satirToplam: miktar * satir.birimFiyat
        }]
      });
      alert("Alış siparişi oluşturuldu (Sipariş Girişi ekranından görebilirsin).");
      onDone();
    } catch (err) {
      alert("Sipariş oluşturulurken hata: " + (err.response?.data?.error || err.message));
    } finally {
      setKaydediliyor(false);
    }
  };

  const teklifIste = async () => {
    const secilenCari = cariler.find(c => c.CariKodu === cariKodu);
    setKaydediliyor(true);
    try {
      await axios.post(`${API_URL}/teklif-talepleri`, {
        UrunKodu: null, UrunAdi: satir.hammaddeAdi,
        CariKodu: secilenCari?.CariKodu || null, CariAdi: secilenCari?.CariAdi || null,
        Miktar: miktar, Birim: satir.birim, Notlar: notlar
      });
      alert("Teklif talebi kaydedildi.");
      onDone();
    } catch (err) {
      alert("Teklif talebi kaydedilirken hata oluştu.");
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <div className="recete-aksiyon-box">
      <div className="recete-aksiyon-toggle">
        <button className={mod === "siparis" ? "active" : ""} onClick={() => setMod("siparis")}>📥 Sipariş Ver</button>
        <button className={mod === "teklif" ? "active" : ""} onClick={() => setMod("teklif")}>💬 Teklif Al</button>
      </div>
      <div className="recete-aksiyon-row">
        <div style={{ flex: 2 }}>
          <SearchableSelect options={cariOptions} value={cariKodu} onChange={setCariKodu} placeholder="Tedarikçi seçin..." />
        </div>
        <input type="number" value={miktar} onChange={e => setMiktar(e.target.value)} style={{ width: 90 }} />
        <span className="recete-aksiyon-birim">{satir.birim}</span>
        {mod === "teklif" && <input placeholder="Not (opsiyonel)" value={notlar} onChange={e => setNotlar(e.target.value)} style={{ flex: 1 }} />}
        <button className="recete-btn-save" style={{ padding: "8px 16px" }} disabled={kaydediliyor} onClick={mod === "siparis" ? siparisVer : teklifIste}>
          {kaydediliyor ? "Kaydediliyor..." : (mod === "siparis" ? "Siparişi Oluştur" : "Talebi Kaydet")}
        </button>
      </div>
    </div>
  );
};

export default ReceteForm;
