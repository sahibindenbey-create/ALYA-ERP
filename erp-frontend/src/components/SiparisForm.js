import React, { useState, useEffect } from "react";
import "./SiparisForm.css";

const SiparisForm = () => {
  // --- VBA'DAN GELEN SABİT LİSTELER ---
  const siparisTipleri = ["YENİ SİPARİŞ", "İADE", "DEĞİŞİM", "NUMUNE"];
  const siparisVerenler = ["BAYİ", "ŞAHIS", "HEPSİBURADA", "TRENDYOL", "PAZARAMA", "N11", "AMAZON", "PTTAVM", "ÇİÇEK SEPETİ"];
  const temsilciler = ["ERKAN DALGIN", "ALYA HOMES"];
  const odemeSekilleri = ["HAVALE/EFT", "KREDİ KARTI", "ÇEK"];

  const [items, setItems] = useState([]);
  const [vadeSecenekleri, setVadeSecenekleri] = useState(["PEŞİN / HAVALE"]);
  const [adresAyni, setAdresAyni] = useState(false);

  const [form, setForm] = useState({
    siparisKodu: "SIP-" + Date.now(),
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

  const urunEkle = () => {
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

  return (
    <div className="vba-container">
      <div className="vba-header">SİPARİŞ KAYIT FORMU (VBA REVİZE)</div>
      
      <div className="vba-body">
        {/* BÖLÜM 1: GENEL BİLGİLER */}
        <div className="vba-panel">
          <div className="vba-row">
            <div className="vba-f"><label>SİPARİŞ NO</label><input value={form.siparisKodu} readOnly className="vba-read" /></div>
            <div className="vba-f"><label>TARİH</label><input type="date" value={form.siparisTarihi} /></div>
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
            <div className="vba-f" style={{flex:0.5}}><label>CARİ KODU</label><input value={form.cariKodu} onChange={e=>setForm({...form, cariKodu:e.target.value})} /></div>
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
              <input placeholder="Ülke" value={form.sevkiyatUlke} disabled={adresAyni} />
              <div className="vba-row-sm">
                <input placeholder="İl" value={form.sevkiyatIl} disabled={adresAyni} />
                <input placeholder="İlçe" value={form.sevkiyatIlce} disabled={adresAyni} />
              </div>
              <textarea placeholder="Adres Detay" value={form.sevkiyatAdres} disabled={adresAyni} />
            </div>
          </div>
        </div>

        {/* BÖLÜM 3: ÜRÜN GİRİŞ BARI (VBA Sütun 16-27) */}
        <div className="vba-product-bar">
          <div className="vba-pb-labels">
            <span style={{flex:1.5}}>ÜRÜN KODU</span><span style={{flex:3}}>ÜRÜN ADI</span><span>MİKTAR</span><span>BİRİM</span><span>KOLİ İÇİ</span><span>LİSTE FİYAT</span><span>İSK %</span>
          </div>
          <div className="vba-pb-inputs">
            <input style={{flex:1.5}} value={entry.urunKodu} onChange={e=>setEntry({...entry, urunKodu:e.target.value})} />
            <input style={{flex:3}} value={entry.urunAdi} onChange={e=>setEntry({...entry, urunAdi:e.target.value})} />
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
                <th>NO</th><th>ÜRÜN KODU</th><th>ÜRÜN ADI</th><th>MİKTAR</th><th>BİRİM</th><th>KOLİ ADET</th><th>İSK. FİYAT</th><th>KDV</th><th>TOPLAM</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={it.id}>
                  <td>{idx+1}</td><td>{it.urunKodu}</td><td>{it.urunAdi}</td>
                  <td>{it.miktar}</td><td>{it.birim}</td><td>{it.koliAdedi}</td>
                  <td>{it.iskBirimFiyat.toFixed(2)}</td><td>{it.kdvTutari.toFixed(2)}</td>
                  <td style={{fontWeight:'bold'}}>{it.satirToplam.toLocaleString()} ₺</td>
                </tr>
              ))}
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
               <button className="vba-save-btn">SİPARİŞİ KAYDET (YENİ DURUM)</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SiparisForm;