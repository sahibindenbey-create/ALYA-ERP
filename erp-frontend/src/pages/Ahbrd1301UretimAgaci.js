import React,{useEffect,useMemo,useState} from 'react';
import axios from 'axios';
import SearchableSelect from '../components/SearchableSelect';
import './Ahbrd1301UretimAgaci.css';

const API_URL='http://localhost:5000/api';
const STAGES=[
 {key:'TABLA',title:'TABLA GRUBU',output:'Tabla Grubu',type:'Alt Montaj',note:'1250×2500×1 mm H1050 alüminyum levha → 1250×500 mm tabla blankı. 1 levha = 5 blank.'},
 {key:'AYAK',title:'AYAK GRUBU',output:'Ayak Grubu',type:'Alt Montaj',note:'20×40×1 mm profil, 110 cm kesim; 254 cm yuvarlak profil, 42 cm kesim; delik, kaynak, şapka, galvaniz, perçin ve göbek civata.'},
 {key:'KADEME',title:'KADEME MEKANİZMASI',output:'Kademe Mekanizması',type:'Alt Montaj',note:'Kurt ağzı kademe demiri + özel bükümlü 8 mm dolu demir + kaynak + galvaniz + yay + 8 mm segman.'},
 {key:'KILIF',title:'KILIF GRUBU',output:'Kılıf Grubu',type:'Alt Montaj',note:'Kumaş, biye, ip, stoper, uç ve keçe → fason dikim → hazır kılıf.'},
 {key:'AKSESUAR',title:'ÜST AKSESUAR GRUBU',output:'Üst Aksesuar Grubu',type:'Alt Montaj',note:'Plastik tabla + fason baskı + 9 cm silikon parçaları + 6/8 mm demir + plastik başlık.'},
 {key:'MONTAJ',title:'SON MONTAJ',output:'Son Montaj',type:'Alt Montaj',note:'Tabla + ayak + kademe + kılıf + üst aksesuar birleşir.'},
 {key:'PAKET',title:'PAKETLEME',output:'Paketleme',type:'Alt Montaj',note:'Ön etiket + shelling + koli.'},
 {key:'MAMUL',title:'AHBRD 1301 MAMUL',output:'AHBRD 1301',type:'Mamul',note:'Son montaj ve paketleme çıktısı mamul stokuna girer.'}
];
const RAW=[
 ['Alüminyum levha H1050 1250x2500x1 mm','TABLA','0.20','Levha','1 levha = 5 adet 1250x500 blank'],
 ['Kanal sacı','TABLA','','Adet','Delik + kaynak ile tabla gövdesine bağlanır'],
 ['Kesim hizmeti','TABLA','','Hizmet','Fason kesim'],
 ['Baskı hizmeti','TABLA','','Hizmet','Fason baskı'],
 ['Nakliye','TABLA','','Hizmet','Kesim/baskı sonrası taşıma'],
 ['20x40x1 mm kutu profil 221 cm','AYAK','','Adet','110 cm kesim'],
 ['254 cm yuvarlak profil 1 mm','AYAK','','Adet','42 cm kesim'],
 ['Şapka','AYAK','','Adet','Fason üretim'],
 ['8 mm dolu demir','AYAK','','Adet','Şapka ile kaynak + galvaniz'],
 ['Perçin','AYAK','','Adet','4 perçin / ayak'],
 ['Göbek civata','AYAK','','Adet','Plastik parça ile birlikte'],
 ['Plastik ayak parçası','AYAK','','Adet','Fason baskı'],
 ['Kurt ağzı kademe demiri','KADEME','','Adet','Fason baskı'],
 ['8 mm dolu demir','KADEME','','Adet','Özel büküm'],
 ['Yay','KADEME','','Adet','Satın alma'],
 ['8 mm segman','KADEME','','Adet','Satın alma'],
 ['Kumaş','KILIF','','Metre','Fason dikim'],
 ['Biye','KILIF','','Metre','Fason dikim'],
 ['İp','KILIF','','Metre','Fason dikim'],
 ['Stoper','KILIF','','Adet','Fason dikim'],
 ['Uç','KILIF','','Adet','Fason dikim'],
 ['Keçe','KILIF','','Adet','Fason dikim'],
 ['Plastik tabla','AKSESUAR','','Adet','Fason baskı'],
 ['Silikon','AKSESUAR','','Adet','Fabrikada 9 cm kesim'],
 ['6/8 mm demir','AKSESUAR','','Adet','Tabla üzerine bağlanır'],
 ['Plastik başlık','AKSESUAR','','Adet','Fason/tedarik'],
 ['Ön etiket','PAKET','','Adet','Paketleme'],
 ['Koli','PAKET','','Adet','Paketleme'],
];
const blankInputs=()=>RAW.map((r,i)=>({id:i,name:r[0],stage:r[1],qty:r[2],unit:r[3],note:r[4],urunId:'',cost:0,fason:false}));
const money=n=>Number(n||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});

export default function Ahbrd1301UretimAgaci(){
 const [urunler,setUrunler]=useState([]),[receteler,setReceteler]=useState([]),[inputs,setInputs]=useState(blankInputs),[outputs,setOutputs]=useState({}),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [active,setActive]=useState('TABLA');
 useEffect(()=>{(async()=>{try{const [u,r]=await Promise.all([axios.get(`${API_URL}/urunler`),axios.get(`${API_URL}/recete-yonetim`)]);setUrunler(u.data||[]);setReceteler(r.data||[]);const all=u.data||[];const initial={};for(const s of STAGES){const hit=all.find(x=>`${x.UrunKodu||''} ${x.UrunAdi||''}`.toLocaleLowerCase('tr-TR').includes(s.key==='MAMUL'?'ahbrd 1301':s.output.toLocaleLowerCase('tr-TR')));if(hit)initial[s.key]=hit.UrunId;}setOutputs(initial);}catch(e){setMessage(e.response?.data?.error||'Ürün/reçete listesi alınamadı.');}})();},[]);
 const productOptions=useMemo(()=>urunler.filter(u=>u.Tur!=='Hizmet').map(u=>({value:u.UrunId,label:u.UrunAdi,sublabel:u.UrunKodu})),[urunler]);
 const serviceOptions=useMemo(()=>urunler.map(u=>({value:u.UrunId,label:u.UrunAdi,sublabel:u.UrunKodu})),[urunler]);
 const recipeByCode=useMemo(()=>{const m={};for(const r of receteler)m[r.ReceteKodu]=r;return m;},[receteler]);
 const stageInputs=inputs.filter(x=>x.stage===active);
 const setInput=(id,key,value)=>setInputs(v=>v.map(x=>x.id===id?{...x,[key]:value}:x));
 const buildItems=(stageKey)=>inputs.filter(x=>x.stage===stageKey).map(x=>({kalemTipi:x.unit==='Hizmet'?'Hizmet':'Malzeme',hammaddeUrunId:x.urunId||'',hammaddeAdi:x.name,girdiMiktari:Number(x.qty||0),girdiBirimi:x.unit,ciktiMiktari:'',ciktiBirimi:x.unit,verimOrani:100,fireOrani:0,donusumAciklama:x.note,tedarikciCariId:'',fasonMu:x.fason,hizmetBirimFiyati:Number(x.cost||0),nakliyeMaliyeti:0,iscilikDakika:0,makineDakika:0,iscilikBirimMaliyeti:0,makineBirimMaliyeti:0,depo:'Merkez Depo',operasyonSira:'',istasyonAdi:'',aciklama:x.note,stageKey:x.stage}));
 const createOne=async(stage,childIds)=>{const outputId=outputs[stage.key];if(!outputId)throw new Error(`${stage.title}: çıktı ürünü seçilmedi.`);const code=`AHBRD1301-${stage.key}`;const existing=recipeByCode[code];const form={receteKodu:code,receteAdi:stage.output,mamulUrunId:outputId,mamulAdi:urunler.find(u=>String(u.UrunId)===String(outputId))?.UrunAdi||stage.output,aciklama:`AHBRD 1301 üretim ağacı · ${stage.note}`,versiyon:existing?.Versiyon||1,uretimBirimi:'Adet',durum:'Aktif',receteTipi:stage.type,ciktiMiktari:1,ciktiBirimi:'Adet',standartFireOrani:0};
 let items=buildItems(stage.key);
 for(const child of childIds||[])items.push({kalemTipi:'Yarı Mamul',hammaddeUrunId:'',hammaddeAdi:child.name,altReceteId:child.id,girdiMiktari:Number(child.qty||1),girdiBirimi:'Adet',ciktiMiktari:1,ciktiBirimi:'Adet',verimOrani:100,fireOrani:0,donusumAciklama:'AHBRD 1301 üretim ağacı alt reçetesi',depo:'Merkez Depo',istasyonAdi:'Son Montaj'});
 const payload={form,items,operations:[]};
 if(existing)await axios.put(`${API_URL}/recete-yonetim/${existing.ReceteId}`,payload);else await axios.post(`${API_URL}/recete-yonetim`,payload);
 return {code,outputId};};
 const apply=async()=>{setBusy(true);setMessage('');try{const created={};for(const stage of STAGES){const children=[];if(stage.key==='MONTAJ'){for(const k of ['TABLA','AYAK','KADEME']){const r=recipeByCode[`AHBRD1301-${k}`]||created[k];if(r)children.push({id:r.ReceteId||r.id,name:r.name||k,qty:1});}}if(stage.key==='MAMUL'){const r=recipeByCode['AHBRD1301-MONTAJ']||created.MONTAJ;if(r)children.push({id:r.ReceteId||r.id,name:r.name||'Son Montaj',qty:1});}if(stage.key==='PAKET'){const r=recipeByCode['AHBRD1301-MONTAJ']||created.MONTAJ;if(r)children.push({id:r.ReceteId||r.id,name:r.name||'Son Montaj',qty:1});}const result=await createOne(stage,children);created[stage.key]={...result,id:(await axios.get(`${API_URL}/recete-yonetim`)).data.find(x=>x.ReceteKodu===result.code)?.ReceteId,name:stage.output};}
 const fresh=(await axios.get(`${API_URL}/recete-yonetim`)).data||[];setReceteler(fresh);setMessage(`AHBRD 1301 üretim ağacı kuruldu/güncellendi. ${STAGES.length} reçete kartı hazır.`);}catch(e){setMessage(e.response?.data?.detail||e.response?.data?.error||e.message||'Kurulum sırasında hata oluştu.');}finally{setBusy(false);}};
 return <div className="ahbrd-wizard"><header><div><span>ÜRETİM ŞABLONU</span><h1>AHBRD 1301 · Üretim Ağacı</h1><p>Tabla → Ayak → Kademe → Kılıf → Aksesuar → Son Montaj → Paketleme → Mamul</p></div><button onClick={apply} disabled={busy}>{busy?'Kuruluyor…':'⚙ Ağacı Kur / Güncelle'}</button></header>
 <div className="ahbrd-alert">Bu sihirbaz <b>gerçek ürün kartlarını</b> kullanır; ürün ID'si uydurmaz. Miktarı bilinmeyen kalemleri boş bırakabilir, gerçek ürün kartını eşleyebilirsin. 1 levha → 5 adet 1250×500 mm blank dönüşümü not olarak korunur.</div>
 <div className="ahbrd-stagebar">{STAGES.map(s=><button key={s.key} className={active===s.key?'active':''} onClick={()=>setActive(s.key)}><b>{s.key}</b><span>{s.title}</span></button>)}</div>
 <main><section className="ahbrd-card"><div className="ahbrd-card-head"><div><span>ÇIKTI</span><h2>{STAGES.find(s=>s.key===active)?.title}</h2></div><label>Çıktı ürünü<SearchableSelect options={productOptions} value={outputs[active]||''} onChange={id=>setOutputs(v=>({...v,[active]:id}))} placeholder="Mevcut ürün kartını seç…"/></label></div><p className="ahbrd-note">{STAGES.find(s=>s.key===active)?.note}</p><div className="ahbrd-table"><div className="ahbrd-tr ahbrd-th"><span>Girdi</span><span>Miktar</span><span>Birim</span><span>Ürün kartı</span><span>Fason</span><span>Maliyet</span></div>{stageInputs.map(x=><div className="ahbrd-tr" key={x.id}><span><b>{x.name}</b><small>{x.note}</small></span><input type="number" step="0.0001" value={x.qty} onChange={e=>setInput(x.id,'qty',e.target.value)} placeholder="Miktar"/><input value={x.unit} onChange={e=>setInput(x.id,'unit',e.target.value)}/><SearchableSelect options={serviceOptions} value={x.urunId} onChange={id=>setInput(x.id,'urunId',id)} placeholder="Ürün / hizmet eşleştir…"/><label className="check"><input type="checkbox" checked={x.fason} onChange={e=>setInput(x.id,'fason',e.target.checked)}/> Fason</label><input type="number" step="0.01" value={x.cost} onChange={e=>setInput(x.id,'cost',e.target.value)} placeholder="0.00"/></div>)}</div></section>
 <aside className="ahbrd-side"><div><span>BAĞLANTI</span><h3>Üretim sırası</h3></div>{STAGES.map((s,i)=><div className={`ahbrd-link ${active===s.key?'active':''}`} key={s.key}><b>{i+1}</b><span>{s.title}</span><small>{outputs[s.key]?'✓ Ürün eşlendi':'⚠ Ürün seç'}</small></div>)}<div className="ahbrd-cost"><span>ŞABLON</span><strong>8 seviye</strong><small>Alt reçeteler gerçek ürün kartlarına bağlanır.</small></div></aside></main>{message&&<div className="ahbrd-message">{message}</div>}
 <div className="ahbrd-footer"><span>{receteler.filter(r=>String(r.ReceteKodu||'').startsWith('AHBRD1301-')).length} / 8 AHBRD reçete kartı mevcut</span><span>Sevkiyat maliyeti üretim reçetesinden ayrı tutulur.</span></div></div>;
}
