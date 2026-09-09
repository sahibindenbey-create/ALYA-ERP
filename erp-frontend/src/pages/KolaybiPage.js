import React, { useState, useEffect } from "react";
import axios from "axios";
import "./KolaybiPage.css";

const API_URL = "http://localhost:5000/api";

const formatTurkeyDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "medium" }).format(date);
};

const KolaybiPage = () => {
  const [ayarlar, setAyarlar] = useState({ Channel:"", BaseUrl:"https://ofis-sandbox-api.kolaybi.com", ApiKeyTanimli:false, SonSenkronTarihi:null });
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [channelInput, setChannelInput] = useState("");
  const [baseUrlInput, setBaseUrlInput] = useState("https://ofis-sandbox-api.kolaybi.com");
  const [testSonuc, setTestSonuc] = useState(null);
  const [testYukleniyor, setTestYukleniyor] = useState(false);
  const [senkronSonuc, setSenkronSonuc] = useState(null);
  const [irsaliyeSonuc, setIrsaliyeSonuc] = useState(null);
  const [senkronYukleniyor, setSenkronYukleniyor] = useState(false);
  const [irsaliyeYukleniyor, setIrsaliyeYukleniyor] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const fetchAyarlar = async () => {
    try { const res=await axios.get(`${API_URL}/kolaybi/ayarlar`); setAyarlar(res.data); setChannelInput(res.data.Channel||""); setBaseUrlInput(res.data.BaseUrl||"https://ofis-sandbox-api.kolaybi.com"); }
    catch(err){ console.error(err); }
  };
  useEffect(()=>{fetchAyarlar();},[]);

  const ayarlariKaydet = async () => {
    setKaydediliyor(true);
    try { await axios.put(`${API_URL}/kolaybi/ayarlar`,{ApiKey:apiKeyInput||undefined,Channel:channelInput,BaseUrl:baseUrlInput}); setApiKeyInput(""); setTestSonuc(null); fetchAyarlar(); alert("Ayarlar kaydedildi."); }
    catch(err){ alert("Kaydedilirken hata oluştu: "+(err.response?.data?.error||err.message)); }
    finally{setKaydediliyor(false);}
  };

  const baglantiTestEt = async () => {
    setTestYukleniyor(true); setTestSonuc(null);
    try { const res=await axios.post(`${API_URL}/kolaybi/test-baglanti`); setTestSonuc({basarili:true,mesaj:res.data.message}); }
    catch(err){setTestSonuc({basarili:false,mesaj:err.response?.data?.error||err.message});}
    finally{setTestYukleniyor(false);}
  };

  const senkronizeEt = async () => {
    if(!window.confirm("KolayBi'deki tüm satış ve alış faturaları çekilip sisteme aktarılacak. Devam edilsin mi?")) return;
    setSenkronYukleniyor(true); setSenkronSonuc(null);
    try {
      const res=await axios.post(`${API_URL}/kolaybi/fatura-senkronize`); const data=res.data||{};
      setSenkronSonuc({hata:data.success===false?(data.error||"Fatura senkronizasyonu başarısız."):null,eklenen:Number(data.created||0),guncellenen:Number(data.updated||0),atlanan:Number(data.skipped||0),hatali:Number(data.errors||0),detaylar:data.details||data.detaylar||[]});
      fetchAyarlar();
    } catch(err){setSenkronSonuc({hata:err.response?.data?.error||err.message});}
    finally{setSenkronYukleniyor(false);}
  };

  const irsaliyeleriSenkronizeEt = async () => {
    if(!window.confirm("KolayBi'deki tüm satış ve alış irsaliyeleri çekilip sisteme aktarılacak. Devam edilsin mi?")) return;
    setIrsaliyeYukleniyor(true); setIrsaliyeSonuc(null);
    try {
      const res=await axios.post(`${API_URL}/kolaybi/irsaliye-senkronize`); const data=res.data||{};
      setIrsaliyeSonuc({hata:data.success===false?(data.error||"İrsaliye senkronizasyonu başarısız."):null,eklenen:Number(data.created||0),guncellenen:Number(data.updated||0),atlanan:Number(data.skipped||0),hatali:Number(data.errors||0)});
    } catch(err){setIrsaliyeSonuc({hata:err.response?.data?.error||err.message});}
    finally{setIrsaliyeYukleniyor(false);}
  };

  return (
    <div className="klb-container">
      <div className="klb-card">
        <div className="klb-card-header"><h3>KolayBi Bağlantı Ayarları</h3></div>
        <p className="klb-not">API Key'inizi KolayBi hesabınızdan <strong>Ayarlar → Profil Hesabı → API Anahtarları</strong> bölümünden oluşturabilirsiniz. Channel bilgisini almak için <strong>api.support@kolaybi.com</strong> adresine e-posta göndermeniz gerekir. Canlı ortama geçtiğinizde Base URL'i KolayBi'nin production adresiyle değiştirin.</p>
        <div className="klb-form-grid">
          <div><label>API Key {ayarlar.ApiKeyTanimli&&<span className="klb-tanimli">✓ Tanımlı</span>}</label><input type="password" placeholder={ayarlar.ApiKeyTanimli?"•••••••• (değiştirmek için yeni değer girin)":"API Key'inizi girin"} value={apiKeyInput} onChange={e=>setApiKeyInput(e.target.value)}/></div>
          <div><label>Channel</label><input value={channelInput} onChange={e=>setChannelInput(e.target.value)} placeholder="KolayBi destek ekibinden alınan Channel"/></div>
          <div><label>Base URL</label><input value={baseUrlInput} onChange={e=>setBaseUrlInput(e.target.value)}/></div>
        </div>
        <div className="klb-btn-row">
          <button className="klb-save-btn" onClick={ayarlariKaydet} disabled={kaydediliyor}>{kaydediliyor?"Kaydediliyor...":"Ayarları Kaydet"}</button>
          <button className="klb-test-btn" onClick={baglantiTestEt} disabled={testYukleniyor}>{testYukleniyor?"Test Ediliyor...":"Bağlantıyı Test Et"}</button>
        </div>
        {testSonuc&&<div className={`klb-test-sonuc ${testSonuc.basarili?"basarili":"basarisiz"}`}>{testSonuc.basarili?"✅":"❌"} {testSonuc.mesaj}</div>}
      </div>

      <div className="klb-card">
        <div className="klb-card-header"><h3>KolayBi Belge Senkronizasyonu</h3></div>
        <p className="klb-not">Seçili şirket için KolayBi'deki satış/alış faturalarını ve satış/alış irsaliyelerini ALYA-ERP'ye aktarır. Kod + CompanyId üzerinden idempotent çalışır; aynı belge ikinci kez çoğaltılmaz.</p>
        {ayarlar.SonSenkronTarihi&&<div className="klb-son-senkron">Son senkronizasyon: {formatTurkeyDateTime(ayarlar.SonSenkronTarihi)}</div>}
        <div className="klb-btn-row">
          <button className="klb-sync-btn" onClick={senkronizeEt} disabled={senkronYukleniyor||!ayarlar.ApiKeyTanimli}>{senkronYukleniyor?"Faturalar çekiliyor...":"🔄 Faturaları Çek"}</button>
          <button className="klb-sync-btn" onClick={irsaliyeleriSenkronizeEt} disabled={irsaliyeYukleniyor||!ayarlar.ApiKeyTanimli}>{irsaliyeYukleniyor?"İrsaliyeler çekiliyor...":"🚚 İrsaliyeleri Çek"}</button>
        </div>
        {!ayarlar.ApiKeyTanimli&&<p className="klb-uyari">Önce yukarıdan API Key ve Channel bilgilerini kaydedin.</p>}

        {senkronSonuc&&(senkronSonuc.hata?<div className="klb-sonuc-kutu hata">❌ {senkronSonuc.hata}</div>:<div className={`klb-sonuc-kutu ${senkronSonuc.hatali>0?"hata":"basarili"}`}><div>✅ <strong>{senkronSonuc.eklenen}</strong> yeni fatura eklendi</div><div>🔄 <strong>{senkronSonuc.guncellenen}</strong> mevcut fatura güncellendi</div><div>⏭️ <strong>{senkronSonuc.atlanan}</strong> fatura atlandı</div>{senkronSonuc.hatali>0&&<div>⚠️ <strong>{senkronSonuc.hatali}</strong> faturada hata oluştu</div>}</div>)}
        {irsaliyeSonuc&&(irsaliyeSonuc.hata?<div className="klb-sonuc-kutu hata">❌ {irsaliyeSonuc.hata}</div>:<div className={`klb-sonuc-kutu ${irsaliyeSonuc.hatali>0?"hata":"basarili"}`}><div>🚚 <strong>{irsaliyeSonuc.eklenen}</strong> yeni irsaliye eklendi</div><div>🔄 <strong>{irsaliyeSonuc.guncellenen}</strong> irsaliye güncellendi</div><div>⏭️ <strong>{irsaliyeSonuc.atlanan}</strong> irsaliye atlandı</div>{irsaliyeSonuc.hatali>0&&<div>⚠️ <strong>{irsaliyeSonuc.hatali}</strong> irsaliyede hata oluştu</div>}</div>)}
      </div>
    </div>
  );
};
export default KolaybiPage;
