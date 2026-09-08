import React,{useMemo,useState} from 'react';
import axios from 'axios';

const API_URL='http://localhost:5000/api';

export default function ReceteGercekUretimPanelV2({receteler=[]}){
  const aktif=useMemo(()=>receteler.filter(r=>String(r.Durum||'Aktif')==='Aktif'),[receteler]);
  const [receteId,setReceteId]=useState('');
  const [miktar,setMiktar]=useState(1);
  const [depo,setDepo]=useState('Merkez Depo');
  const [notlar,setNotlar]=useState('');
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState(null);

  const uret=async()=>{
    const q=Number(miktar);
    if(!receteId)return alert('Üretilecek reçeteyi seçin.');
    if(!Number.isFinite(q)||q<=0)return alert('Üretim miktarı 0’dan büyük olmalıdır.');
    const r=aktif.find(x=>String(x.ReceteId)===String(receteId));
    if(!r)return alert('Aktif reçete bulunamadı.');
    if(!window.confirm(`${r.MamulAdi||r.ReceteAdi} için ${q} ${r.CiktiBirimi||r.UretimBirimi||'Adet'} gerçek üretim yapılsın mı?\n\nHammadde stokları reçete satırındaki depolardan tüketilir, mamul stokuna seçilen depoda giriş hareketi işlenir.`))return;
    const islemAnahtari=(window.crypto&&typeof window.crypto.randomUUID==='function')?window.crypto.randomUUID():`URETIM-${Date.now()}-${Math.random().toString(36).slice(2,12)}`;
    setBusy(true);setResult(null);
    try{
      const {data}=await axios.post(`${API_URL}/recete-uretim/${receteId}/uret`,{miktar:q,depo,notlar:notlar||null,islemAnahtari});
      setResult(data);setMiktar(1);setNotlar('');
    }catch(e){alert(e.response?.data?.error||e.response?.data?.detail||'Üretim gerçekleştirilemedi.');}
    finally{setBusy(false);}
  };

  return <section style={{margin:'18px 0',padding:18,border:'1px solid #d8dee8',borderRadius:14,background:'#fff',boxShadow:'0 4px 18px rgba(20,30,50,.06)'}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',marginBottom:14}}>
      <div><div style={{fontSize:12,fontWeight:700,letterSpacing:'.08em',opacity:.6}}>GERÇEK ÜRETİM</div><h3 style={{margin:'3px 0 0'}}>Reçeteden Stok Üret</h3></div>
      <span style={{fontSize:12,padding:'6px 9px',borderRadius:999,background:'#eef7ee'}}>Transaction + stok kontrolü</span>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'minmax(260px,2fr) 130px 160px',gap:10}}>
      <label style={{fontSize:12,fontWeight:600}}>Reçete<select value={receteId} onChange={e=>setReceteId(e.target.value)} style={{width:'100%',marginTop:5,padding:9,borderRadius:8,border:'1px solid #cfd6e0'}}><option value="">Reçete seçin...</option>{aktif.map(r=><option key={r.ReceteId} value={r.ReceteId}>{r.ReceteKodu} · {r.MamulAdi||r.ReceteAdi} · V{r.Versiyon||1}</option>)}</select></label>
      <label style={{fontSize:12,fontWeight:600}}>Miktar<input type="number" min="0.0001" step="0.0001" value={miktar} onChange={e=>setMiktar(e.target.value)} style={{width:'100%',boxSizing:'border-box',marginTop:5,padding:9,borderRadius:8,border:'1px solid #cfd6e0'}}/></label>
      <label style={{fontSize:12,fontWeight:600}}>Mamul Giriş Deposu<select value={depo} onChange={e=>setDepo(e.target.value)} style={{width:'100%',marginTop:5,padding:9,borderRadius:8,border:'1px solid #cfd6e0'}}><option>Merkez Depo</option><option>Üretim</option><option>Hammadde Deposu</option></select></label>
    </div>
    <div style={{marginTop:9,fontSize:11,opacity:.68}}>Urunler.StokMiktari şirket toplam stoğudur. Depo bilgisi stok hareketinin fiziksel deposunu gösterir; reçete satırlarında tanımlı hammadde depoları korunur.</div>
    <div style={{display:'flex',gap:10,marginTop:10}}><input value={notlar} onChange={e=>setNotlar(e.target.value)} placeholder="Üretim notu (opsiyonel)" style={{flex:1,padding:9,borderRadius:8,border:'1px solid #cfd6e0'}}/><button disabled={busy} onClick={uret} style={{padding:'9px 18px',border:0,borderRadius:8,fontWeight:700,cursor:busy?'wait':'pointer',opacity:busy?.65:1}}>{busy?'Üretiliyor...':'▶ Gerçek Üretimi Başlat'}</button></div>
    {result&&<div style={{marginTop:14,padding:12,borderRadius:10,background:'#f4fbf5',border:'1px solid #cfe8d2'}}><b>{result.duplicate?'Üretim isteği daha önce işlendi':'Üretim tamamlandı'} · #{result.uretimId}</b><div style={{marginTop:5,fontSize:13}}>Üretilen: {result.uretilenMiktar} · Mamul stok: {result.mamulStok?.OncekiStok ?? '—'} → {result.mamulStok?.SonrakiStok ?? '—'}</div>{!result.duplicate&&<div style={{marginTop:5,fontSize:12,opacity:.75}}>Tüketilen hammadde kalemi: {result.tuketilenHammaddeler?.length||0} · Mamul giriş deposu: {result.depo||depo}</div>}{result.duplicate&&<div style={{marginTop:5,fontSize:12,opacity:.75}}>{result.message}</div>}</div>}
  </section>;
}
