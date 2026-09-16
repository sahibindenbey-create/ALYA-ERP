import React, { useState, useEffect } from "react";
import axios from "axios";
import SearchableSelect from "./SearchableSelect";
import ExportToolbar from "./ExportToolbar";
import "./SiparisForm.css";

const API_URL = "http://localhost:5000/api";

const SiparisForm = ({ mode = "giris" }) => {
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
  const [gecmisSearch, setGecmisSearch] = useState("");
  const [gecmisYonFiltre, setGecmisYonFiltre] = useState("Hepsi");
  const [gecmisDurumFiltre, setGecmisDurumFiltre] = useState("Hepsi");
  const [companyProfile, setCompanyProfile] = useState(null);

  const isYamankaya = companyProfile?.FirmaTipi === "INSAAT" || companyProfile?.SiparisSablonu === "INSAAT_SEVKIYAT";
  const unitOptions = isYamankaya ? ["PALET", "RULO", "KG", "TON", "ADET", "METRE"] : ["ADET", "KG", "KOLİ", "METRE", "TAKIM", "SET"];

  const [form, setForm] = useState({
    siparisKodu: "SIP-" + Date.now(), siparisYonu: "Satış",
    siparisTarihi: new Date().toISOString().split('T')[0],
    teslimatTarihi: "", tahsilatTarihi: "",
    siparisTipi: "YENİ SİPARİŞ", siparisVeren: "BAYİ", musteriTemsilcisi: "ERKAN DALGIN",
    cariKodu: "", cariAdi: "",
    faturaUlke: "TÜRKİYE", faturaIl: "", faturaIlce: "", faturaAdres: "",
    sevkiyatUlke: "TÜRKİYE", sevkiyatIl: "", sevkiyatIlce: "", sevkiyatAdres: "",
    odemeSekli: "HAVALE/EFT", vade: "PEŞİN / HAVALE",
    teslimatSekli: "", paketlemeSekli: "", lojistikDetay: "", siparisVerenDepartman: "",
    projeAdi: "", santiyeAdi: "", aracPlaka: "", sevkiyatNotu: ""
  });

  const [entry, setEntry] = useState({
    urunKodu: "", urunAdi: "", miktar: "", birim: "ADET",
    koliIci: 1, koliAdedi: 0, listeFiyati: "", iskonto: 0, urunTuru: "Ürün"
  });

  const fetchCompanyProfile = async () => {
    try {
      const res = await axios.get(`${API_URL}/company-profile`);
      if (res.data?.profile) {
        const profile = res.data.profile;
        setCompanyProfile(profile);
        setEntry(en => ({ ...en, birim: profile.VarsayilanBirim || en.birim }));
      }
    } catch (err) {
      console.error("Şirket profili alınamadı:", err);
    }
  };

  const fetchCariler = async () => {
    try { const res = await axios.get(`${API_URL}/cariler`); setCarilerListesi(res.data); }
    catch (err) { console.error("Cari listesi alınamadı:", err); }
  };
  const fetchUrunler = async () => {
    try { const res = await axios.get(`${API_URL}/urunler`); setUrunlerListesi(res.data); }
    catch (err) { console.error("Ürün listesi alınamadı:", err); }
  };
  const fetchSiparisGecmisi = async () => {
    try { const res = await axios.get(`${API_URL}/siparisler`); setSiparisGecmisi(res.data); }
    catch (err) { console.error("Sipariş geçmişi alınamadı:", err); }
  };

  useEffect(() => { fetchCompanyProfile(); fetchCariler(); fetchUrunler(); fetchSiparisGecmisi(); }, []);

  useEffect(() => {
    if (companyProfile?.VarsayilanBirim && !entry.urunKodu) {
      setEntry(en => ({ ...en, birim: companyProfile.VarsayilanBirim }));
    }
  }, [companyProfile, entry.urunKodu]);

  const handleCariSecim = (cariKodu) => {
    const normalize = value => String(value || "").toLocaleLowerCase('tr-TR').trim();
    const secilen = carilerListesi.find(c => normalize(c.CariKodu) === normalize(cariKodu));
    if (secilen) {
      const faturaIl = secilen.FaturaIl || "";
      const faturaIlce = secilen.FaturaIlce || "";
      const faturaAdres = secilen.FaturaAdresDetay || "";
      const sevkiyatIl = secilen.SevkiyatIl || faturaIl;
      const sevkiyatIlce = secilen.SevkiyatIlce || faturaIlce;
      const sevkiyatAdres = secilen.SevkiyatAdresDetay || faturaAdres;
      setForm(f => ({ ...f, cariKodu: secilen.CariKodu, cariAdi: secilen.CariAdi, faturaIl, faturaIlce, faturaAdres, sevkiyatIl, sevkiyatIlce, sevkiyatAdres }));
    } else setForm(f => ({ ...f, cariKodu, cariAdi: "" }));
  };

  const handleUrunSecim = (urunId) => {
    const secilen = urunlerListesi.find(u => String(u.UrunId) === String(urunId));
    if (secilen) {
      const tur = secilen.Tur || "Ürün";
      const isHizmet = tur === "Hizmet";
      const koliIci = Number(secilen.KoliIci ?? secilen.KoliIciAdet ?? secilen.KoliIciMiktar ?? 1);
      setEntry(en => ({
        ...en,
        urunKodu: secilen.UrunKodu,
        urunAdi: secilen.UrunAdi,
        urunTuru: tur,
        birim: secilen.Birim || companyProfile?.VarsayilanBirim || "ADET",
        koliIci: isHizmet ? 1 : (koliIci > 0 ? koliIci : 1),
        listeFiyati: secilen.ListeFiyati || ""
      }));
    }
  };

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

  const handleAdresSync = (val) => {
    setAdresAyni(val);
    if (val) setForm(f => ({ ...f, sevkiyatUlke: f.faturaUlke, sevkiyatIl: f.faturaIl, sevkiyatIlce: f.faturaIlce, sevkiyatAdres: f.faturaAdres }));
  };
  useEffect(() => {
    if (adresAyni) setForm(f => ({ ...f, sevkiyatUlke: f.faturaUlke, sevkiyatIl: f.faturaIl, sevkiyatIlce: f.faturaIlce, sevkiyatAdres: f.faturaAdres }));
  }, [adresAyni, form.faturaUlke, form.faturaIl, form.faturaIlce, form.faturaAdres]);

  const urunSil = id => setItems(prev => prev.filter(it => it.id !== id));

  const urunEkle = () => {
    if (!entry.urunAdi || !entry.miktar) return alert("Ürün/hizmet ve miktar girmelisiniz.");
    const isHizmet = entry.urunTuru === "Hizmet";
    const lFiyat = parseFloat(entry.listeFiyati || 0);
    const miktar = parseFloat(entry.miktar || 0);
    const iskonto = parseFloat(entry.iskonto || 0);
    const secilenUrun = urunlerListesi.find(u => u.UrunKodu === entry.urunKodu);
    const kdvOrani = secilenUrun ? Number(secilenUrun.KdvOrani ?? 20) : 20;
    const koliIci = isHizmet ? 1 : Math.max(Number(entry.koliIci) || 1, 1);
    const iskBirimFiyat = lFiyat * (1 - iskonto / 100);
    const kdvTutari = iskBirimFiyat * (kdvOrani / 100);
    const birimFiyatKdvDahil = iskBirimFiyat + kdvTutari;
    const satirToplam = birimFiyatKdvDahil * miktar;
    const koliAdedi = isHizmet ? 0 : Math.ceil(miktar / koliIci);
    const yeniSatir = { ...entry, koliIci, koliAdedi, kdvOrani, iskBirimFiyat, kdvTutari: kdvTutari * miktar, birimFiyatKdvDahil, satirToplam, id: Date.now() };
    setItems(prev => [...prev, yeniSatir]);
    setEntry(en => ({ ...en, urunKodu: "", urunAdi: "", miktar: "", listeFiyati: "", koliIci: 1, urunTuru: "Ürün", birim: companyProfile?.VarsayilanBirim || en.birim }));
  };

  const resetForm = () => {
    setForm(f => ({ siparisKodu: "SIP-" + Date.now(), siparisYonu: f.siparisYonu, siparisTarihi: new Date().toISOString().split('T')[0], teslimatTarihi: "", tahsilatTarihi: "", siparisTipi: "YENİ SİPARİŞ", siparisVeren: "BAYİ", musteriTemsilcisi: "ERKAN DALGIN", cariKodu: "", cariAdi: "", faturaUlke: "TÜRKİYE", faturaIl: "", faturaIlce: "", faturaAdres: "", sevkiyatUlke: "TÜRKİYE", sevkiyatIl: "", sevkiyatIlce: "", sevkiyatAdres: "", odemeSekli: "HAVALE/EFT", vade: "PEŞİN / HAVALE", teslimatSekli: "", paketlemeSekli: "", lojistikDetay: "", siparisVerenDepartman: "", projeAdi: "", santiyeAdi: "", aracPlaka: "", sevkiyatNotu: "" }));
    setItems([]); setAdresAyni(false);
  };

  const handleKaydet = async () => {
    if (!form.cariKodu || !form.cariAdi) return alert("Lütfen bir cari seçin veya cari kodu/adı girin.");
    if (items.length === 0) return alert("En az bir ürün satırı eklemelisiniz.");
    setKaydediliyor(true);
    try { await axios.post(`${API_URL}/siparisler`, { form, items }); alert(`Sipariş kaydedildi: ${form.siparisKodu}`); resetForm(); fetchSiparisGecmisi(); }
    catch (err) { console.error("Sipariş kaydı hatası:", err); alert("Sipariş kaydedilirken bir hata oluştu: " + (err.response?.data?.error || err.message)); }
    finally { setKaydediliyor(false); }
  };

  const filteredGecmis = siparisGecmisi
    .filter(s => gecmisYonFiltre === "Hepsi" || s.SiparisYonu === gecmisYonFiltre)
    .filter(s => gecmisDurumFiltre === "Hepsi" || s.Durum === gecmisDurumFiltre)
    .filter(s => (s.CariAdi || "").toLocaleLowerCase('tr-TR').includes(gecmisSearch.toLocaleLowerCase('tr-TR')) || (s.SiparisKodu || "").toLocaleLowerCase('tr-TR').includes(gecmisSearch.toLocaleLowerCase('tr-TR')));

  const cariOptions = carilerListesi.map(c => ({
    value: c.CariKodu,
    label: c.CariAdi,
    sublabel: `${c.CariKodu} · ${c.CariTipi === 1 ? "Müşteri" : c.CariTipi === 2 ? "Tedarikçi" : "Müşteri + Tedarikçi"}`
  }));

  return (
    <div className="vba-container">
      {mode === "giris" && <>
        <div className="vba-header">SİPARİŞ KAYIT FORMU</div>
        <div className="vba-body">
          <div className="vba-panel siparis-yon-panel">
            <label className="vba-label-sm" style={{ marginBottom: 10, display: "block" }}>SİPARİŞ YÖNÜ *</label>
            <div className="siparis-yon-toggle">
              <button type="button" className={form.siparisYonu === "Satış" ? "active" : ""} onClick={() => setForm({ ...form, siparisYonu: "Satış", cariKodu: "", cariAdi: "" })}>🛒 Satış Siparişi<small>Müşteriye satış</small></button>
              <button type="button" className={form.siparisYonu === "Alış" ? "active" : ""} onClick={() => setForm({ ...form, siparisYonu: "Alış", cariKodu: "", cariAdi: "" })}>📥 Alış Siparişi<small>Tedarikçiden alış</small></button>
            </div>
          </div>
        </div>
        <div className="vba-body">
          <div className="vba-panel">
            <div className="vba-row">
              <div className="vba-f"><label>SİPARİŞ NO</label><input value={form.siparisKodu} readOnly className="vba-read" /></div>
              <div className="vba-f"><label>TARİH</label><input type="date" value={form.siparisTarihi} onChange={e=>setForm({...form, siparisTarihi:e.target.value})} /></div>
              <div className="vba-f"><label>SİPARİŞ TİPİ</label><select value={form.siparisTipi} onChange={e=>setForm({...form,siparisTipi:e.target.value})}>{siparisTipleri.map(t=><option key={t}>{t}</option>)}</select></div>
              <div className="vba-f"><label>SİPARİŞ VEREN</label><select value={form.siparisVeren} onChange={e=>setForm({...form,siparisVeren:e.target.value})}>{siparisVerenler.map(v=><option key={v}>{v}</option>)}</select></div>
              <div className="vba-f"><label>MÜŞTERİ TEMSİLCİSİ</label><select value={form.musteriTemsilcisi} onChange={e=>setForm({...form,musteriTemsilcisi:e.target.value})}>{temsilciler.map(m=><option key={m}>{m}</option>)}</select></div>
            </div>
            {form.siparisYonu === "Alış" && <div className="vba-row" style={{marginTop:14}}>
              <div className="vba-f"><label>TESLİMAT ŞEKLİ</label><input value={form.teslimatSekli} onChange={e=>setForm({...form,teslimatSekli:e.target.value})}/></div>
              <div className="vba-f"><label>PAKETLEME ŞEKLİ</label><input value={form.paketlemeSekli} onChange={e=>setForm({...form,paketlemeSekli:e.target.value})}/></div>
              <div className="vba-f"><label>LOJİSTİK DETAY</label><input value={form.lojistikDetay} onChange={e=>setForm({...form,lojistikDetay:e.target.value})}/></div>
              <div className="vba-f"><label>SİPARİŞ VEREN DEPARTMAN</label><input value={form.siparisVerenDepartman} onChange={e=>setForm({...form,siparisVerenDepartman:e.target.value})}/></div>
            </div>}
            {isYamankaya && form.siparisYonu === "Satış" && <div className="vba-row" style={{marginTop:14}}>
              <div className="vba-f"><label>PROJE ADI</label><input value={form.projeAdi} onChange={e=>setForm({...form,projeAdi:e.target.value})} placeholder="Proje / iş adı"/></div>
              <div className="vba-f"><label>ŞANTİYE / TESİS</label><input value={form.santiyeAdi} onChange={e=>setForm({...form,santiyeAdi:e.target.value})} placeholder="Şantiye veya tesis"/></div>
              <div className="vba-f"><label>ARAÇ / PLAKA</label><input value={form.aracPlaka} onChange={e=>setForm({...form,aracPlaka:e.target.value})} placeholder="Araç / plaka"/></div>
              <div className="vba-f"><label>SEVKİYAT NOTU</label><input value={form.sevkiyatNotu} onChange={e=>setForm({...form,sevkiyatNotu:e.target.value})} placeholder="Yükleme / sevkiyat notu"/></div>
            </div>}
          </div>
          <div className="vba-panel">
            <div className="vba-row"><div className="vba-f" style={{flex:0.9}}><label>{form.siparisYonu === "Alış" ? "TEDARİKÇİ" : "MÜŞTERİ"} KODU / ADI</label><SearchableSelect options={cariOptions} value={form.cariKodu} onChange={val=>handleCariSecim(val)} placeholder={form.siparisYonu === "Alış" ? "Tedarikçi seçin..." : "Müşteri seçin..."}/></div><div className="vba-f"><label>CARİ ADI</label><input value={form.cariAdi} onChange={e=>setForm({...form,cariAdi:e.target.value})}/></div></div>
            <div className="vba-address-grid">
              <div className="vba-addr-col"><label className="vba-label-sm">FATURA ADRES BİLGİLERİ</label><input placeholder="Ülke" value={form.faturaUlke} onChange={e=>setForm({...form,faturaUlke:e.target.value})}/><div className="vba-row-sm"><input placeholder="İl" value={form.faturaIl} onChange={e=>setForm({...form,faturaIl:e.target.value})}/><input placeholder="İlçe" value={form.faturaIlce} onChange={e=>setForm({...form,faturaIlce:e.target.value})}/></div><textarea placeholder="Adres Detay" value={form.faturaAdres} onChange={e=>setForm({...form,faturaAdres:e.target.value})}/></div>
              <div className="vba-addr-col"><div className="vba-row-sm" style={{justifyContent:'space-between'}}><label className="vba-label-sm">SEVKİYAT ADRES BİLGİLERİ</label><label style={{fontSize:'9px'}}><input type="checkbox" checked={adresAyni} onChange={e=>handleAdresSync(e.target.checked)}/> Fatura ile Aynı</label></div><input placeholder="Ülke" value={form.sevkiyatUlke} disabled={adresAyni} onChange={e=>setForm({...form,sevkiyatUlke:e.target.value})}/><div className="vba-row-sm"><input placeholder="İl" value={form.sevkiyatIl} disabled={adresAyni} onChange={e=>setForm({...form,sevkiyatIl:e.target.value})}/><input placeholder="İlçe" value={form.sevkiyatIlce} disabled={adresAyni} onChange={e=>setForm({...form,sevkiyatIlce:e.target.value})}/></div><textarea placeholder="Adres Detay" value={form.sevkiyatAdres} disabled={adresAyni} onChange={e=>setForm({...form,sevkiyatAdres:e.target.value})}/></div>
            </div>
          </div>
          <div className="vba-product-bar">
            <div className="vba-pb-labels"><span>ÜRÜN / HİZMET</span><span>MİKTAR</span><span>BİRİM</span><span>{isYamankaya ? "AMBALAJ / İÇERİK" : "KOLİ İÇİ"}</span><span>LİSTE FİYAT</span><span>İSK %</span><span>İŞLEM</span></div>
            <div className="vba-pb-inputs">
              <div className="vba-product-select"><SearchableSelect options={urunlerListesi.map(u=>({value:u.UrunId,label:u.UrunAdi,sublabel:`${u.UrunKodu} · ${u.Tur || "Ürün"}`}))} value={urunlerListesi.find(u=>u.UrunKodu===entry.urunKodu)?.UrunId || ""} onChange={val=>handleUrunSecim(val)} placeholder="Ürün / hizmet seçin..."/></div>
              <input style={{minWidth:0}} type="number" value={entry.miktar} onChange={e=>setEntry({...entry,miktar:e.target.value})}/>
              <select style={{minWidth:0}} value={entry.birim} onChange={e=>setEntry({...entry,birim:e.target.value})}>{unitOptions.map(unit=><option key={unit}>{unit}</option>)}</select>
              {entry.urunTuru === "Hizmet" ? <div className="vba-service-placeholder" aria-hidden="true">—</div> : <input style={{minWidth:0}} value={entry.koliIci} readOnly title="Üründen otomatik gelir"/>}
              <input style={{minWidth:0}} value={entry.listeFiyati} onChange={e=>setEntry({...entry,listeFiyati:e.target.value})}/>
              <input style={{minWidth:0}} value={entry.iskonto} onChange={e=>setEntry({...entry,iskonto:e.target.value})}/>
              <button type="button" className="vba-add-btn" onClick={urunEkle}>EKLE</button>
            </div>
            {isYamankaya && <div className="siparis-cevrim-note">Yamankaya profili: palet / rulo / KG / ton bazlı sipariş girişi aktif. Ürün kartındaki birim korunur.</div>}
            {entry.urunTuru === "Hizmet" && <div className="siparis-cevrim-note">Hizmet kalemlerinde koli içi adet ve koli hesabı uygulanmaz.</div>}
            {form.siparisYonu === "Alış" && entry.urunTuru !== "Hizmet" && urunlerListesi.find(u=>u.UrunKodu===entry.urunKodu)?.AlisBirimi && <div className="siparis-cevrim-note">ℹ️ Bu malzeme tedarikçiden <strong>{urunlerListesi.find(u=>u.UrunKodu===entry.urunKodu).AlisBirimi}</strong> olarak alınıyor, stokta <strong>{urunlerListesi.find(u=>u.UrunKodu===entry.urunKodu).Birim}</strong> olarak takip ediliyor.</div>}
          </div>
          <div className="vba-grid"><table><thead><tr><th>NO</th><th>ÜRÜN KODU</th><th>ÜRÜN ADI</th><th>MİKTAR</th><th>BİRİM</th><th>KOLİ ADET</th><th>İSK. FİYAT</th><th>KDV</th><th>TOPLAM</th><th></th></tr></thead><tbody>
            {items.map((it,idx)=><tr key={it.id}><td>{idx+1}</td><td>{it.urunKodu}</td><td>{it.urunAdi}</td><td>{it.miktar}</td><td>{it.birim}</td><td>{it.urunTuru === "Hizmet" ? "—" : it.koliAdedi}</td><td>{it.iskBirimFiyat.toFixed(2)}</td><td>{it.kdvTutari.toFixed(2)}</td><td style={{fontWeight:'bold'}}>{it.satirToplam.toLocaleString()} ₺</td><td><button type="button" onClick={()=>urunSil(it.id)} className="vba-del-btn">Sil</button></td></tr>)}
            {items.length===0 && <tr><td colSpan={10} style={{textAlign:'center',color:'#999',padding:'12px'}}>Henüz ürün eklenmedi</td></tr>}
          </tbody></table></div>
          <div className="vba-panel" style={{marginTop:'auto'}}><div className="vba-row"><div className="vba-f"><label>ÖDEME ŞEKLİ</label><select value={form.odemeSekli} onChange={e=>setForm({...form,odemeSekli:e.target.value})}>{odemeSekilleri.map(o=><option key={o}>{o}</option>)}</select></div><div className="vba-f"><label>KK / ÇEK VADE</label><select value={form.vade} onChange={e=>setForm({...form,vade:e.target.value})}>{vadeSecenekleri.map(v=><option key={v}>{v}</option>)}</select></div><div className="vba-f"><label>TAHSİLAT TARİHİ</label><input type="date" value={form.tahsilatTarihi} onChange={e=>setForm({...form,tahsilatTarihi:e.target.value})}/></div><div className="vba-f"><label>TESLİMAT TARİHİ</label><input type="date" value={form.teslimatTarihi} onChange={e=>setForm({...form,teslimatTarihi:e.target.value})}/></div><div className="vba-totals"><div className="vba-total-breakdown"><div>Ara Toplam: <strong>{items.reduce((a,b)=>a+(b.satirToplam-b.kdvTutari),0).toLocaleString()} ₺</strong></div><div>KDV: <strong>{items.reduce((a,b)=>a+b.kdvTutari,0).toLocaleString()} ₺</strong></div></div><div className="vba-total-row">GENEL TOPLAM: <span>{items.reduce((a,b)=>a+b.satirToplam,0).toLocaleString()} ₺</span></div><button className="vba-save-btn" onClick={handleKaydet} disabled={kaydediliyor}>{kaydediliyor?"KAYDEDİLİYOR...":"SİPARİŞİ KAYDET (YENİ DURUM)"}</button></div></div></div>
        </div>
      </>}
      {mode === "liste" && <div className="vba-panel" style={{marginTop:20}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}><h3 style={{margin:0}}>Sipariş Listesi ({filteredGecmis.length})</h3></div><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12,marginBottom:12}}><input type="text" placeholder="Cari adı veya sipariş no ara..." value={gecmisSearch} onChange={e=>setGecmisSearch(e.target.value)} style={{flex:2,minWidth:220,padding:'8px 12px',borderRadius:6,border:'1px solid #ccc'}}/><select value={gecmisYonFiltre} onChange={e=>setGecmisYonFiltre(e.target.value)}><option value="Hepsi">Tüm Yönler</option><option value="Satış">🛒 Satış</option><option value="Alış">📥 Alış</option></select><select value={gecmisDurumFiltre} onChange={e=>setGecmisDurumFiltre(e.target.value)}><option value="Hepsi">Tüm Durumlar</option><option value="YENİ">YENİ</option><option value="ONAYLANDI">ONAYLANDI</option><option value="TAMAMLANDI">TAMAMLANDI</option><option value="İPTAL">İPTAL</option></select></div><ExportToolbar data={filteredGecmis} columns={[{key:'SiparisKodu',label:'Sipariş No'},{key:'SiparisYonu',label:'Yön'},{key:'CariAdi',label:'Cari'},{key:'SiparisTipi',label:'Tip'},{key:'Durum',label:'Durum'},{key:'ToplamTutar',label:'Toplam'}]} filename="siparis-listesi"/><div className="vba-grid" style={{marginTop:12}}><table><thead><tr><th>SİPARİŞ NO</th><th>YÖN</th><th>TARİH</th><th>CARİ</th><th>TİP</th><th>DURUM</th><th>TOPLAM</th></tr></thead><tbody>{filteredGecmis.map(s=><tr key={s.SiparisId}><td>{s.SiparisKodu}</td><td><span className={`erp-badge ${s.SiparisYonu === "Alış" ? "orange" : "blue"}`}>{s.SiparisYonu === "Alış" ? "📥 Alış" : "🛒 Satış"}</span></td><td>{s.SiparisTarihi ? new Date(s.SiparisTarihi).toLocaleDateString('tr-TR') : ''}</td><td>{s.CariAdi}</td><td>{s.SiparisTipi}</td><td>{s.Durum}</td><td style={{fontWeight:'bold'}}>{Number(s.ToplamTutar||0).toLocaleString()} ₺</td></tr>)}{filteredGecmis.length===0&&<tr><td colSpan={7} style={{textAlign:'center',color:'#999',padding:'12px'}}>Kayıt bulunamadı</td></tr>}</tbody></table></div></div>}
    </div>
  );
};

export default SiparisForm;
