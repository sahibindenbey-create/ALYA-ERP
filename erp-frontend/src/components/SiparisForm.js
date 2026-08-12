import React, { useState, useEffect } from "react";
import axios from "axios";
import SearchableSelect from "./SearchableSelect";
import ExportToolbar from "./ExportToolbar";
import "./SiparisForm.css";

const API_URL = "http://localhost:5000/api";

const SiparisForm = () => {
  // --- VBA'DAN GELEN SABİT LİSTELER ---
  const siparisTipleri = ["YENİ SİPARİŞ", "İADE", "DEĞİŞİM", "NUMUNE"];
  const siparisVerenler = ["BAYİ", "ŞAHIS", "HEPSİBURADA", "TRENDYOL", "PAZARAMA", "N11", "AMAZON", "PTTAVM", "ÇİÇEK SEPETİ"];
  const temsilciler = ["ERKAN DALGIN", "ALYA HOMES"];
  const odemeSekilleri = ["HAVALE/EFT", "KREDİ KARTI", "ÇEK"];

  const [items, setItems] = useState([]);
  const [vadeSecenekleri, setVadeSecenekleri] = useState(["PEŞİN / HAVALE"]);
  const [adresAyni, setAdresAyni] = useState(false);
  const [carilerListesi, setCarilerListesi] = useState([]);
  const [urunlerListesi, setUrunlerListesi] = useState([]);
  const [siparisGecmisi, setSiparisGecmisi] = useState([]);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [gecmisAcik, setGecmisAcik] = useState(false);

  const [form, setForm] = useState({
    siparisKodu: "SIP-" + Date.now(),
    siparisYonu: "Satış",
    siparisTarihi: new Date().toISOString().split('T')[0],
    teslimatTarihi: "", tahsilatTarihi: "",
    siparisTipi: "YENİ SİPARİŞ", siparisVeren: "BAYİ", musteriTemsilcisi: "ERKAN DALGIN",
    cariKodu: "", cariAdi: "",
    faturaUlke: "TÜRKİYE", faturaIl: "", faturaIlce: "", faturaAdres: "",
    sevkiyatUlke: "TÜRKİYE", sevkiyatIl: "", sevkiyatIlce: "", sevkiyatAdres: "",
    odemeSekli: "HAVALE/EFT", vade: "PEŞİN / HAVALE"
  });

  const [entry, setEntry] = useState({
    urunKodu: "", urunAdi: "", miktar: "", birim: "ADET", 
    koliIci: 24, koliAdedi: 0, listeFiyati: "", iskonto: 0
  });

  // --- Cari listesini ve sipariş geçmişini yükle ---
  const fetchCariler = async () => {
    try {
      const res = await axios.get(`${API_URL}/cariler`);
      setCarilerListesi(res.data);
    } catch (err) {
      console.error("Cari listesi alınamadı:", err);
    }
  };

  const fetchUrunler = async () => {
    try {
      const res = await axios.get(`${API_URL}/urunler`);
      setUrunlerListesi(res.data);
    } catch (err) {
      console.error("Ürün listesi alınamadı:", err);
    }
  };

  const fetchSiparisGecmisi = async () => {
    try {
      const res = await axios.get(`${API_URL}/siparisler`);
      setSiparisGecmisi(res.data);
    } catch (err) {
      console.error("Sipariş geçmişi alınamadı:", err);
    }
  };

  useEffect(() => {
    fetchCariler();
    fetchUrunler();
    fetchSiparisGecmisi();
  }, []);

  // Cari seçilince adı ve fatura adresini otomatik doldur
  const handleCariSecim = (cariKodu) => {
    const secilen = carilerListesi.find(c => c.CariKodu === cariKodu);
    if (secilen) {
      setForm(f => ({
        ...f,
        cariKodu: secilen.CariKodu,
        cariAdi: secilen.CariAdi,
        faturaIl: secilen.FaturaIl || f.faturaIl,
        faturaIlce: secilen.FaturaIlce || f.faturaIlce,
        faturaAdres: secilen.FaturaAdresDetay || f.faturaAdres
      }));
    } else {
      setForm(f => ({ ...f, cariKodu, cariAdi: "" }));
    }
  };

  // Ürün seçilince adı, birimi ve fiyatı otomatik doldur
  const handleUrunSecim = (urunId) => {
    const secilen = urunlerListesi.find(u => String(u.UrunId) === String(urunId));
    if (secilen) {
      setEntry(en => ({
        ...en,
        urunKodu: secilen.UrunKodu,
        urunAdi: secilen.UrunAdi,
        birim: secilen.Birim || "ADET",
        listeFiyati: secilen.ListeFiyati || ""
      }));
    }
  };

  // --- VBA cmbOdemeSekli_Change MANTIĞI ---
  useEffect(() => {
    let secenekler = [];
    if (form.odemeSekli === "KREDİ KARTI") {
      secenekler = ["TEK ÇEKİM", ...Array.from({ length: 11 }, (_, i) => `${i + 2} TAKSİT`)];
      setForm(f => ({ ...f, vade: "TEK ÇEKİM" }));
    } else if (form.odemeSekli === "ÇEK") {
      secenekler = Array.from({ length: 7 }, (_, i) => `${30 + (i * 15)} GÜN VADE`);
      setForm(f => ({ ...f, vade: "30 GÜN VADE" }));
    } else {
      secenekler = ["PEŞİN / HAVALE"];
      setForm(f => ({ ...f, vade: "PEŞİN / HAVALE" }));
    }
    setVadeSecenekleri(secenekler);
  }, [form.odemeSekli]);

  // --- ADRES EŞİTLEME (Fatura -> Sevkiyat) ---
  const handleAdresSync = (val) => {
    setAdresAyni(val);
    if (val) {
      setForm(f => ({
        ...f,
        sevkiyatUlke: f.faturaUlke, sevkiyatIl: f.faturaIl,
        sevkiyatIlce: f.faturaIlce, sevkiyatAdres: f.faturaAdres
      }));
    }
  };

  useEffect(() => {
    if (adresAyni) {
      setForm(f => ({
        ...f,
        sevkiyatUlke: f.faturaUlke, sevkiyatIl: f.faturaIl,
        sevkiyatIlce: f.faturaIlce, sevkiyatAdres: f.faturaAdres
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adresAyni, form.faturaUlke, form.faturaIl, form.faturaIlce, form.faturaAdres]);

  const urunSil = (id) => {
    setItems(prev => prev.filter(it => it.id !== id));
  };

  const urunEkle = () => {
    if (!entry.urunAdi || !entry.miktar) {
      return alert("Ürün adı ve miktar girmelisiniz.");
    }
    const lFiyat = parseFloat(entry.listeFiyati || 0);
    const miktar = parseFloat(entry.miktar || 0);
    const iskonto = parseFloat(entry.iskonto || 0);
    
    const iskBirimFiyat = lFiyat * (1 - iskonto / 100);
    const kdvTutari = iskBirimFiyat * 0.20;
    const birimFiyatKdvDahil = iskBirimFiyat + kdvTutari;
    const satirToplam = birimFiyatKdvDahil * miktar;
    const koliAdedi = Math.ceil(miktar / entry.koliIci);

    const yeniSatir = {
      ...entry,
      koliAdedi,
      iskBirimFiyat,
      kdvTutari,
      birimFiyatKdvDahil,
      satirToplam,
      id: Date.now()
    };

    setItems([...items, yeniSatir]);
    setEntry({ ...entry, urunKodu: "", urunAdi: "", miktar: "", listeFiyati: "" });
  };

  const resetForm = () => {
    setForm(f => ({
      siparisKodu: "SIP-" + Date.now(),
      siparisYonu: f.siparisYonu,
      siparisTarihi: new Date().toISOString().split('T')[0],
      teslimatTarihi: "", tahsilatTarihi: "",
      siparisTipi: "YENİ SİPARİŞ", siparisVeren: "BAYİ", musteriTemsilcisi: "ERKAN DALGIN",
      cariKodu: "", cariAdi: "",
      faturaUlke: "TÜRKİYE", faturaIl: "", faturaIlce: "", faturaAdres: "",
      sevkiyatUlke: "TÜRKİYE", sevkiyatIl: "", sevkiyatIlce: "", sevkiyatAdres: "",
      odemeSekli: "HAVALE/EFT", vade: "PEŞİN / HAVALE"
    }));
    setItems([]);
    setAdresAyni(false);
  };

  const handleKaydet = async () => {
    if (!form.cariKodu || !form.cariAdi) {
      return alert("Lütfen bir cari seçin veya cari kodu/adı girin.");
    }
    if (items.length === 0) {
      return alert("En az bir ürün satırı eklemelisiniz.");
    }

    setKaydediliyor(true);
    try {
      await axios.post(`${API_URL}/siparisler`, { form, items });
      alert(`Sipariş kaydedildi: ${form.siparisKodu}`);
      resetForm();
      fetchSiparisGecmisi();
    } catch (err) {
      console.error("Sipariş kaydı hatası:", err);
      alert("Sipariş kaydedilirken bir hata oluştu: " + (err.response?.data?.error || err.message));
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <div className="vba-container">
      <div className="vba-header">SİPARİŞ KAYIT FORMU</div>

      {/* SİPARİŞ YÖNÜ SEÇİCİ - EN BAŞTA */}
      <div className="vba-body">
        <div className="vba-panel siparis-yon-panel">
          <label className="vba-label-sm" style={{ marginBottom: 10, display: "block" }}>SİPARİŞ YÖNÜ *</label>
          <div className="siparis-yon-toggle">
            <button
              type="button"
              className={form.siparisYonu === "Satış" ? "active" : ""}
              onClick={() => setForm({ ...form, siparisYonu: "Satış", cariKodu: "", cariAdi: "" })}
            >🛒 Satış Siparişi<small>Müşteriye satış</small></button>
            <button
              type="button"
              className={form.siparisYonu === "Alış" ? "active" : ""}
              onClick={() => setForm({ ...form, siparisYonu: "Alış", cariKodu: "", cariAdi: "" })}
            >📥 Alış Siparişi<small>Tedarikçiden alış</small></button>
          </div>
        </div>
      </div>

      <div className="vba-body">
        {/* BÖLÜM 1: GENEL BİLGİLER */}
        <div className="vba-panel">
          <div className="vba-row">
            <div className="vba-f"><label>SİPARİŞ NO</label><input value={form.siparisKodu} readOnly className="vba-read" /></div>
            <div className="vba-f"><label>TARİH</label><input type="date" value={form.siparisTarihi} onChange={e=>setForm({...form, siparisTarihi:e.target.value})} /></div>
            <div className="vba-f"><label>SİPARİŞ TİPİ</label>
              <select value={form.siparisTipi} onChange={e => setForm({...form, siparisTipi: e.target.value})}>
                {siparisTipleri.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="vba-f"><label>SİPARİŞ VEREN</label>
              <select value={form.siparisVeren} onChange={e => setForm({...form, siparisVeren: e.target.value})}>
                {siparisVerenler.map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div className="vba-f"><label>MÜŞTERİ TEMSİLCİSİ</label>
              <select value={form.musteriTemsilcisi} onChange={e => setForm({...form, musteriTemsilcisi: e.target.value})}>
                {temsilciler.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* BÖLÜM 2: CARİ VE ADRES (VBA Sütun 8-15) */}
        <div className="vba-panel">
          <div className="vba-row">
            <div className="vba-f" style={{flex:0.9}}>
              <label>{form.siparisYonu === "Alış" ? "TEDARİKÇİ" : "MÜŞTERİ"} KODU / ADI</label>
              <SearchableSelect
                options={carilerListesi
                  .filter(c => form.siparisYonu === "Alış" ? c.CariTipi !== 1 : c.CariTipi !== 2)
                  .map(c => ({ value: c.CariKodu, label: c.CariAdi, sublabel: c.CariKodu }))}
                value={form.cariKodu}
                onChange={(val) => handleCariSecim(val)}
                placeholder={form.siparisYonu === "Alış" ? "Tedarikçi seçin..." : "Müşteri seçin..."}
              />
            </div>
            <div className="vba-f"><label>CARİ ADI</label><input value={form.cariAdi} onChange={e=>setForm({...form, cariAdi:e.target.value})} /></div>
          </div>
          
          <div className="vba-address-grid">
            <div className="vba-addr-col">
              <label className="vba-label-sm">FATURA ADRES BİLGİLERİ</label>
              <input placeholder="Ülke" value={form.faturaUlke} onChange={e=>setForm({...form, faturaUlke:e.target.value})} />
              <div className="vba-row-sm">
                <input placeholder="İl" value={form.faturaIl} onChange={e=>setForm({...form, faturaIl:e.target.value})} />
                <input placeholder="İlçe" value={form.faturaIlce} onChange={e=>setForm({...form, faturaIlce:e.target.value})} />
              </div>
              <textarea placeholder="Adres Detay" value={form.faturaAdres} onChange={e=>setForm({...form, faturaAdres:e.target.value})} />
            </div>
            
            <div className="vba-addr-col">
              <div className="vba-row-sm" style={{justifyContent:'space-between'}}>
                <label className="vba-label-sm">SEVKİYAT ADRES BİLGİLERİ</label>
                <label style={{fontSize:'9px'}}><input type="checkbox" checked={adresAyni} onChange={e=>handleAdresSync(e.target.checked)} /> Fatura ile Aynı</label>
              </div>
              <input placeholder="Ülke" value={form.sevkiyatUlke} disabled={adresAyni} onChange={e=>setForm({...form, sevkiyatUlke:e.target.value})} />
              <div className="vba-row-sm">
                <input placeholder="İl" value={form.sevkiyatIl} disabled={adresAyni} onChange={e=>setForm({...form, sevkiyatIl:e.target.value})} />
                <input placeholder="İlçe" value={form.sevkiyatIlce} disabled={adresAyni} onChange={e=>setForm({...form, sevkiyatIlce:e.target.value})} />
              </div>
              <textarea placeholder="Adres Detay" value={form.sevkiyatAdres} disabled={adresAyni} onChange={e=>setForm({...form, sevkiyatAdres:e.target.value})} />
            </div>
          </div>
        </div>

        {/* BÖLÜM 3: ÜRÜN GİRİŞ BARI (VBA Sütun 16-27) */}
        <div className="vba-product-bar">
          <div className="vba-pb-labels">
            <span style={{flex:2.5}}>ÜRÜN / HİZMET</span><span>MİKTAR</span><span>BİRİM</span><span>KOLİ İÇİ</span><span>LİSTE FİYAT</span><span>İSK %</span>
          </div>
          <div className="vba-pb-inputs">
            <div style={{flex:2.5}}>
              <SearchableSelect
                options={urunlerListesi.map(u => ({ value: u.UrunId, label: u.UrunAdi, sublabel: u.UrunKodu }))}
                value={urunlerListesi.find(u => u.UrunKodu === entry.urunKodu)?.UrunId || ""}
                onChange={(val) => handleUrunSecim(val)}
                placeholder="Ürün / hizmet seçin..."
              />
            </div>
            <input type="number" value={entry.miktar} onChange={e=>setEntry({...entry, miktar:e.target.value})} />
            <select value={entry.birim} onChange={e=>setEntry({...entry, birim:e.target.value})}><option>ADET</option><option>KG</option></select>
            <input value={entry.koliIci} onChange={e=>setEntry({...entry, koliIci:e.target.value})} />
            <input value={entry.listeFiyati} onChange={e=>setEntry({...entry, listeFiyati:e.target.value})} />
            <input value={entry.iskonto} onChange={e=>setEntry({...entry, iskonto:e.target.value})} />
            <button className="vba-add-btn" onClick={urunEkle}>EKLE</button>
          </div>
        </div>

        {/* BÖLÜM 4: TABLO */}
        <div className="vba-grid">
          <table>
            <thead>
              <tr>
                <th>NO</th><th>ÜRÜN KODU</th><th>ÜRÜN ADI</th><th>MİKTAR</th><th>BİRİM</th><th>KOLİ ADET</th><th>İSK. FİYAT</th><th>KDV</th><th>TOPLAM</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={it.id}>
                  <td>{idx+1}</td><td>{it.urunKodu}</td><td>{it.urunAdi}</td>
                  <td>{it.miktar}</td><td>{it.birim}</td><td>{it.koliAdedi}</td>
                  <td>{it.iskBirimFiyat.toFixed(2)}</td><td>{it.kdvTutari.toFixed(2)}</td>
                  <td style={{fontWeight:'bold'}}>{it.satirToplam.toLocaleString()} ₺</td>
                  <td><button type="button" onClick={() => urunSil(it.id)} className="vba-del-btn">Sil</button></td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={10} style={{textAlign:'center', color:'#999', padding:'12px'}}>Henüz ürün eklenmedi</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* BÖLÜM 5: ÖDEME VE TARİHLER (VBA Sütun 28-31) */}
        <div className="vba-panel" style={{marginTop:'auto'}}>
          <div className="vba-row">
            <div className="vba-f"><label>ÖDEME ŞEKLİ</label>
              <select value={form.odemeSekli} onChange={e=>setForm({...form, odemeSekli:e.target.value})}>
                {odemeSekilleri.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="vba-f"><label>KK / ÇEK VADE</label>
              <select value={form.vade} onChange={e=>setForm({...form, vade:e.target.value})}>
                {vadeSecenekleri.map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div className="vba-f"><label>TAHSİLAT TARİHİ</label><input type="date" value={form.tahsilatTarihi} onChange={e=>setForm({...form, tahsilatTarihi:e.target.value})} /></div>
            <div className="vba-f"><label>TESLİMAT TARİHİ</label><input type="date" value={form.teslimatTarihi} onChange={e=>setForm({...form, teslimatTarihi:e.target.value})} /></div>
            
            <div className="vba-totals">
               <div className="vba-total-row">TOPLAM: <span>{items.reduce((a,b)=>a+b.satirToplam,0).toLocaleString()} ₺</span></div>
               <button className="vba-save-btn" onClick={handleKaydet} disabled={kaydediliyor}>
                 {kaydediliyor ? "KAYDEDİLİYOR..." : "SİPARİŞİ KAYDET (YENİ DURUM)"}
               </button>
            </div>
          </div>
        </div>

        {/* BÖLÜM 6: SİPARİŞ GEÇMİŞİ */}
        <div className="vba-panel" style={{ marginTop: 20 }}>
          <div
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
            onClick={() => setGecmisAcik(!gecmisAcik)}
          >
            <h3 style={{ margin: 0 }}>Sipariş Geçmişi ({siparisGecmisi.length})</h3>
            <span>{gecmisAcik ? "▲ Gizle" : "▼ Göster"}</span>
          </div>
          {gecmisAcik && (
            <>
            <ExportToolbar
              data={siparisGecmisi}
              columns={[
                { key: "SiparisKodu", label: "Sipariş No" }, { key: "SiparisYonu", label: "Yön" },
                { key: "CariAdi", label: "Cari" }, { key: "SiparisTipi", label: "Tip" },
                { key: "Durum", label: "Durum" }, { key: "ToplamTutar", label: "Toplam" }
              ]}
              filename="siparis-gecmisi"
            />
            <div className="vba-grid" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>SİPARİŞ NO</th><th>YÖN</th><th>TARİH</th><th>CARİ</th><th>TİP</th><th>DURUM</th><th>TOPLAM</th>
                  </tr>
                </thead>
                <tbody>
                  {siparisGecmisi.map((s) => (
                    <tr key={s.SiparisId}>
                      <td>{s.SiparisKodu}</td>
                      <td>
                        <span className={`erp-badge ${s.SiparisYonu === "Alış" ? "orange" : "blue"}`}>
                          {s.SiparisYonu === "Alış" ? "📥 Alış" : "🛒 Satış"}
                        </span>
                      </td>
                      <td>{s.SiparisTarihi ? new Date(s.SiparisTarihi).toLocaleDateString('tr-TR') : ''}</td>
                      <td>{s.CariAdi}</td>
                      <td>{s.SiparisTipi}</td>
                      <td>{s.Durum}</td>
                      <td style={{fontWeight:'bold'}}>{Number(s.ToplamTutar || 0).toLocaleString()} ₺</td>
                    </tr>
                  ))}
                  {siparisGecmisi.length === 0 && (
                    <tr><td colSpan={7} style={{textAlign:'center', color:'#999', padding:'12px'}}>Henüz kayıtlı sipariş yok</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SiparisForm;