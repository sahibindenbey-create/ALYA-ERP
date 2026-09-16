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
    koliIci: 1, koliAdedi: 0, listeFiyati: "", iskonto: 0, urunTuru: "Ürün", kdvOrani: 20
  });

  const fetchCompanyProfile = async (companyIdOverride) => {
    try {
      const companyId = Number(companyIdOverride || localStorage.getItem("selectedCompanyId") || 1);
      const res = await axios.get(`${API_URL}/company-profile`, { params: { CompanyId: companyId } });
      if (res.data?.profile) {
        setCompanyProfile(res.data.profile);
        setEntry(en => ({ ...en, urunKodu: "", urunAdi: "", birim: "ADET", listeFiyati: "", kdvOrani: 20 }));
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

  useEffect(() => {
    fetchCompanyProfile();
    fetchCariler();
    fetchUrunler();
    fetchSiparisGecmisi();

    const handleCompanyChanged = (event) => {
      const id = Number(event.detail?.CompanyId || localStorage.getItem("selectedCompanyId") || 1);
      setItems([]);
      setCompanyProfile(null);
      setEntry(en => ({ ...en, urunKodu: "", urunAdi: "", miktar: "", birim: "ADET", listeFiyati: "", kdvOrani: 20 }));
      fetchCompanyProfile(id);
    };

    window.addEventListener("companyChanged", handleCompanyChanged);
    return () => window.removeEventListener("companyChanged", handleCompanyChanged);
  }, []);

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
      const kdvOrani = Number(secilen.KdvOrani ?? 20);
      setEntry(en => ({
        ...en,
        urunKodu: secilen.UrunKodu,
        urunAdi: secilen.UrunAdi,
        urunTuru: tur,
        birim: secilen.Birim || "ADET",
        koliIci: isHizmet ? 1 : (koliIci > 0 ? koliIci : 1),
        listeFiyati: secilen.ListeFiyati ?? "",
        kdvOrani,
        urunKategori: secilen.Kategori || "",
        barkod: secilen.Barkod || "",
        gtipNo: secilen.GtipNo || "",
        mensei: secilen.Mensei || "",
        alisBirimi: secilen.AlisBirimi || "",
        cevrimOrani: secilen.CevrimOrani ?? 1
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
    const kdvOrani = Number(entry.kdvOrani ?? secilenUrun?.KdvOrani ?? 20);
    const koliIci = isHizmet ? 1 : Math.max(Number(entry.koliIci) || 1, 1);
    const iskBirimFiyat = lFiyat * (1 - iskonto / 100);
    const kdvTutari = iskBirimFiyat * (kdvOrani / 100);
    const birimFiyatKdvDahil = iskBirimFiyat + kdvTutari;
    const satirToplam = birimFiyatKdvDahil * miktar;
    const koliAdedi = isHizmet ? 0 : Math.ceil(miktar / koliIci);
    const yeniSatir = {
      ...entry,
      koliIci,
      koliAdedi,
      kdvOrani,
      iskBirimFiyat,
      kdvTutari: kdvTutari * miktar,
      birimFiyatKdvDahil,
      satirToplam,
      id: Date.now()
    };
    setItems(prev => [...prev, yeniSatir]);
    setEntry(en => ({ ...en, urunKodu: "", urunAdi: "", miktar: "", listeFiyati: "", koliIci: 1, urunTuru: "Ürün", birim: "ADET", kdvOrani: 20, urunKategori: "", barkod: "", gtipNo: "", mensei: "", alisBirimi: "", cevrimOrani: 1 }));
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

  const urunOptions = urunlerListesi.map(u => ({
    value: String(u.UrunId),
    label: u.UrunAdi,
    sublabel: `${u.UrunKodu} · ${u.Birim || "Adet"} · ${Number(u.ListeFiyati || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${u.ParaBirimi || "TL"}`
  }));

  const exportColumns = [
    { key: "SiparisKodu", label: "Sipariş Kodu" }, { key: "SiparisTarihi", label: "Tarih" }, { key: "CariAdi", label: "Cari" },
    { key: "SiparisYonu", label: "Yön" }, { key: "SiparisTipi", label: "Tip" }, { key: "SiparisVeren", label: "Kaynak" },
    { key: "Durum", label: "Durum" }, { key: "ToplamTutar", label: "Toplam" }
  ];

  const isListe = mode === "liste";

  if (isListe) {
    return (
      <div className="siparis-container">
        <div className="siparis-card">
          <div className="siparis-header-row">
            <div><div className="siparis-title">Sipariş Listesi</div><div className="siparis-subtitle">Tüm satış ve alış siparişleri</div></div>
            <ExportToolbar data={filteredGecmis} columns={exportColumns} fileName="siparisler" />
          </div>
          <div className="siparis-history-filters">
            <input value={gecmisSearch} onChange={e => setGecmisSearch(e.target.value)} placeholder="Sipariş kodu veya cari ara..." />
            <select value={gecmisYonFiltre} onChange={e => setGecmisYonFiltre(e.target.value)}><option>Hepsi</option><option>Satış</option><option>Alış</option></select>
            <select value={gecmisDurumFiltre} onChange={e => setGecmisDurumFiltre(e.target.value)}><option>Hepsi</option><option>Taslak</option><option>Onaylandı</option><option>Rezervasyon</option><option>İrsaliye</option><option>Faturalandı</option><option>İptal</option></select>
          </div>
          <div className="siparis-table-wrap"><table className="siparis-table"><thead><tr><th>Kod</th><th>Tarih</th><th>Cari</th><th>Yön</th><th>Tip</th><th>Kaynak</th><th>Durum</th><th>Tutar</th></tr></thead><tbody>
            {filteredGecmis.map(s => <tr key={s.SiparisId}><td>{s.SiparisKodu}</td><td>{s.SiparisTarihi ? new Date(s.SiparisTarihi).toLocaleDateString('tr-TR') : "-"}</td><td>{s.CariAdi}</td><td>{s.SiparisYonu}</td><td>{s.SiparisTipi}</td><td>{s.SiparisVeren}</td><td>{s.Durum}</td><td>{Number(s.ToplamTutar || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td></tr>)}
          </tbody></table></div>
        </div>
      </div>
    );
  }

  return (
    <div className="siparis-container">
      <div className="siparis-card">
        <div className="siparis-header-row"><div><div className="siparis-title">Yeni Sipariş</div><div className="siparis-subtitle">Satış / alış siparişi oluşturun</div></div></div>

        <div className="siparis-section">
          <div className="siparis-section-title">Sipariş Bilgileri</div>
          <div className="siparis-grid">
            <div><label>Sipariş Kodu</label><input value={form.siparisKodu} onChange={e => setForm(f => ({ ...f, siparisKodu: e.target.value }))} /></div>
            <div><label>Sipariş Yönü</label><select value={form.siparisYonu} onChange={e => setForm(f => ({ ...f, siparisYonu: e.target.value }))}><option>Satış</option><option>Alış</option></select></div>
            <div><label>Sipariş Tarihi</label><input type="date" value={form.siparisTarihi} onChange={e => setForm(f => ({ ...f, siparisTarihi: e.target.value }))} /></div>
            <div><label>Teslimat Tarihi</label><input type="date" value={form.teslimatTarihi} onChange={e => setForm(f => ({ ...f, teslimatTarihi: e.target.value }))} /></div>
            <div><label>Tahsilat Tarihi</label><input type="date" value={form.tahsilatTarihi} onChange={e => setForm(f => ({ ...f, tahsilatTarihi: e.target.value }))} /></div>
            <div><label>Sipariş Tipi</label><select value={form.siparisTipi} onChange={e => setForm(f => ({ ...f, siparisTipi: e.target.value }))}>{siparisTipleri.map(x => <option key={x}>{x}</option>)}</select></div>
            <div><label>Sipariş Veren</label><select value={form.siparisVeren} onChange={e => setForm(f => ({ ...f, siparisVeren: e.target.value }))}>{siparisVerenler.map(x => <option key={x}>{x}</option>)}</select></div>
            <div><label>Müşteri Temsilcisi</label><select value={form.musteriTemsilcisi} onChange={e => setForm(f => ({ ...f, musteriTemsilcisi: e.target.value }))}>{temsilciler.map(x => <option key={x}>{x}</option>)}</select></div>
          </div>
        </div>

        <div className="siparis-section">
          <div className="siparis-section-title">Cari / Adres</div>
          <div className="siparis-grid">
            <div><label>Cari</label><SearchableSelect value={form.cariKodu} options={cariOptions} onChange={handleCariSecim} placeholder="Cari seçin..." /></div>
            <div><label>Cari Adı</label><input value={form.cariAdi} onChange={e => setForm(f => ({ ...f, cariAdi: e.target.value }))} /></div>
            <div><label>Fatura Ülke</label><input value={form.faturaUlke} onChange={e => setForm(f => ({ ...f, faturaUlke: e.target.value }))} /></div>
            <div><label>Fatura İl</label><input value={form.faturaIl} onChange={e => setForm(f => ({ ...f, faturaIl: e.target.value }))} /></div>
            <div><label>Fatura İlçe</label><input value={form.faturaIlce} onChange={e => setForm(f => ({ ...f, faturaIlce: e.target.value }))} /></div>
            <div className="full"><label>Fatura Adres</label><textarea value={form.faturaAdres} onChange={e => setForm(f => ({ ...f, faturaAdres: e.target.value }))} /></div>
            <div className="full"><label><input type="checkbox" checked={adresAyni} onChange={e => handleAdresSync(e.target.checked)} /> Sevkiyat adresi fatura adresi ile aynı</label></div>
            <div><label>Sevkiyat Ülke</label><input value={form.sevkiyatUlke} onChange={e => setForm(f => ({ ...f, sevkiyatUlke: e.target.value }))} /></div>
            <div><label>Sevkiyat İl</label><input value={form.sevkiyatIl} onChange={e => setForm(f => ({ ...f, sevkiyatIl: e.target.value }))} /></div>
            <div><label>Sevkiyat İlçe</label><input value={form.sevkiyatIlce} onChange={e => setForm(f => ({ ...f, sevkiyatIlce: e.target.value }))} /></div>
            <div className="full"><label>Sevkiyat Adres</label><textarea value={form.sevkiyatAdres} onChange={e => setForm(f => ({ ...f, sevkiyatAdres: e.target.value }))} /></div>
          </div>
        </div>

        {isYamankaya && (
          <div className="siparis-section">
            <div className="siparis-section-title">İnşaat / Sevkiyat Bilgileri</div>
            <div className="siparis-grid">
              <div><label>Proje Adı</label><input value={form.projeAdi} onChange={e => setForm(f => ({ ...f, projeAdi: e.target.value }))} /></div>
              <div><label>Şantiye / Tesis</label><input value={form.santiyeAdi} onChange={e => setForm(f => ({ ...f, santiyeAdi: e.target.value }))} /></div>
              <div><label>Araç / Plaka</label><input value={form.aracPlaka} onChange={e => setForm(f => ({ ...f, aracPlaka: e.target.value }))} /></div>
              <div className="full"><label>Sevkiyat Notu</label><textarea value={form.sevkiyatNotu} onChange={e => setForm(f => ({ ...f, sevkiyatNotu: e.target.value }))} /></div>
            </div>
          </div>
        )}

        <div className="siparis-section">
          <div className="siparis-section-title">Ürün / Hizmet</div>
          <div className="siparis-grid">
            <div><label>Ürün / Hizmet</label><SearchableSelect value={entry.urunKodu ? String(urunlerListesi.find(u => u.UrunKodu === entry.urunKodu)?.UrunId || "") : ""} options={urunOptions} onChange={handleUrunSecim} placeholder="Ürün veya hizmet seçin..." /></div>
            <div><label>Ürün Kodu</label><input value={entry.urunKodu} readOnly /></div>
            <div><label>Ürün Adı</label><input value={entry.urunAdi} readOnly /></div>
            <div><label>Birim</label><select value={entry.birim} onChange={e => setEntry(en => ({ ...en, birim: e.target.value }))}>{unitOptions.map(x => <option key={x}>{x}</option>)}</select></div>
            <div><label>Miktar</label><input type="number" min="0" step="0.01" value={entry.miktar} onChange={e => setEntry(en => ({ ...en, miktar: e.target.value }))} /></div>
            <div><label>Koli İçi Adet</label><input type="number" min="1" step="1" value={entry.koliIci} onChange={e => setEntry(en => ({ ...en, koliIci: e.target.value }) )} disabled={entry.urunTuru === "Hizmet"} /></div>
            <div><label>Liste Fiyatı</label><input type="number" min="0" step="0.01" value={entry.listeFiyati} onChange={e => setEntry(en => ({ ...en, listeFiyati: e.target.value }))} /></div>
            <div><label>İskonto %</label><input type="number" min="0" max="100" step="0.01" value={entry.iskonto} onChange={e => setEntry(en => ({ ...en, iskonto: e.target.value }))} /></div>
            <div><label>KDV %</label><input type="number" min="0" max="100" step="1" value={entry.kdvOrani} onChange={e => setEntry(en => ({ ...en, kdvOrani: e.target.value }))} /></div>
          </div>
          <div className="siparis-actions"><button type="button" onClick={urunEkle} className="primary">+ Ürün Ekle</button></div>
        </div>

        <div className="siparis-section">
          <div className="siparis-section-title">Sipariş Kalemleri</div>
          <div className="siparis-table-wrap"><table className="siparis-table"><thead><tr><th>Ürün</th><th>Kod</th><th>Miktar</th><th>Birim</th><th>Koli İçi</th><th>Koli</th><th>Liste Fiyatı</th><th>İskonto</th><th>KDV</th><th>Satır Toplam</th><th></th></tr></thead><tbody>
            {items.map(it => <tr key={it.id}><td>{it.urunAdi}</td><td>{it.urunKodu}</td><td>{it.miktar}</td><td>{it.birim}</td><td>{it.koliIci}</td><td>{it.koliAdedi}</td><td>{Number(it.listeFiyati || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td><td>%{it.iskonto}</td><td>%{it.kdvOrani}</td><td>{Number(it.satirToplam || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td><td><button type="button" onClick={() => urunSil(it.id)}>Sil</button></td></tr>)}
          </tbody></table></div>
        </div>

        <div className="siparis-section">
          <div className="siparis-section-title">Ödeme / Lojistik</div>
          <div className="siparis-grid">
            <div><label>Ödeme Şekli</label><select value={form.odemeSekli} onChange={e => setForm(f => ({ ...f, odemeSekli: e.target.value }))}>{odemeSekilleri.map(x => <option key={x}>{x}</option>)}</select></div>
            <div><label>Vade</label><select value={form.vade} onChange={e => setForm(f => ({ ...f, vade: e.target.value }))}>{vadeSecenekleri.map(x => <option key={x}>{x}</option>)}</select></div>
            <div><label>Teslimat Şekli</label><input value={form.teslimatSekli} onChange={e => setForm(f => ({ ...f, teslimatSekli: e.target.value }))} /></div>
            <div><label>Paketleme Şekli</label><input value={form.paketlemeSekli} onChange={e => setForm(f => ({ ...f, paketlemeSekli: e.target.value }))} /></div>
            <div><label>Lojistik Detay</label><input value={form.lojistikDetay} onChange={e => setForm(f => ({ ...f, lojistikDetay: e.target.value }))} /></div>
            <div><label>Sipariş Veren Departman</label><input value={form.siparisVerenDepartman} onChange={e => setForm(f => ({ ...f, siparisVerenDepartman: e.target.value }))} /></div>
          </div>
        </div>

        <div className="siparis-actions"><button type="button" onClick={handleKaydet} className="primary" disabled={kaydediliyor}>{kaydediliyor ? "Kaydediliyor..." : "Siparişi Kaydet"}</button></div>
      </div>
    </div>
  );
};

export default SiparisForm;
