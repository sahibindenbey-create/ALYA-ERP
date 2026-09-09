import React,{useEffect,useMemo,useState} from 'react';
import axios from 'axios';
import SearchableSelect from '../components/SearchableSelect';
import './Ahbrd1301ReceptTemplate.css';

const API=process.env.REACT_APP_API_URL||'http://localhost:5000/api';
const STAGES=[
 {key:'TABLA',title:'TABLA GRUBU',output:'Tabla Grubu',note:'Alüminyum levha → kesim → baskı → kanal sacı → delik → kaynak',aliases:['tabla','tabla grubu','üst tabla','ütü masası tabla','tabla sacı','alüminyum tabla']},
 {key:'AYAK',title:'AYAK GRUBU',output:'Ayak Grubu',note:'Kutu profil + yuvarlak profil → delik → kaynak → şapka/demir → galvaniz → perçin/göbek',aliases:['ayak','ayak grubu','ütü masası ayağı','masa ayağı']},
 {key:'KADEME',title:'KADEME MEKANİZMASI',output:'Kademe Mekanizması',note:'Kurt ağzı → 8 mm demir → büküm/kaynak → galvaniz → yay + segman',aliases:['kademe','kademe mekanizması','kademe demiri','mekanizma','ayar mekanizması']},
 {key:'KILIF',title:'KILIF GRUBU',output:'Kılıf Grubu',note:'Kumaş + biye + ip + stoper + uç + keçe → fason dikim',aliases:['kılıf','kılıf grubu','ütü masası kılıfı','masa kılıfı']},
 {key:'AKSESUAR',title:'ÜST AKSESUAR GRUBU',output:'Üst Aksesuar Grubu',note:'Plastik tabla + baskı + silikon + 6/8 mm demir + plastik başlık',aliases:['aksesuar','üst aksesuar','üst aksesuar grubu','plastik tabla']},
 {key:'MONTAJ',title:'SON MONTAJ',output:'Son Montaj',note:'Tabla + ayak + kademe + kılıf + üst aksesuar',aliases:['montaj','son montaj','ütü masası montaj','masa montaj']},
 {key:'PAKET',title:'PAKETLEME',output:'Paketleme',note:'Son montaj + ön etiket + shelling + koli',aliases:['paket','paketleme','ambalaj','ürün paketleme']},
 {key:'MAMUL',title:'AHBRD 1301 MAMUL',output:'AHBRD 1301',note:'Paketleme çıktısı mamul stokuna girer',aliases:['ahbrd 1301','ahbrd1301','1301','ütü masası 1301','ütü masası']}
];
const RAW={
 TABLA:[['Alüminyum levha H1050 1250x2500x1 mm',.2,'Levha','1250x2500 → 5 adet 1250x500 blank'],['Kanal sacı',0,'Adet','Delik + kaynak'],['Kesim hizmeti',0,'Hizmet','Fason kesim'],['Baskı hizmeti',0,'Hizmet','Fason baskı'],['Nakliye',0,'Hizmet','Kesim/baskı taşıması']],
 AYAK:[['20x40x1 mm kutu profil 221 cm',0,'Adet','110 cm kesim'],['254 cm yuvarlak profil 1 mm',0,'Adet','42 cm kesim'],['Şapka',0,'Adet','Fason'],['8 mm dolu demir',0,'Adet','Kaynak + galvaniz'],['Perçin',0,'Adet','4 perçin / ayak'],['Göbek civata',0,'Adet','Plastik parça ile'],['Plastik ayak parçası',0,'Adet','Fason baskı']],
 KADEME:[['Kurt ağzı kademe demiri',0,'Adet','Fason baskı'],['8 mm dolu demir',0,'Adet','Özel büküm'],['Yay',0,'Adet','Satın alma'],['8 mm segman',0,'Adet','Satın alma']],
 KILIF:[['Kumaş',0,'Metre','Fason dikim'],['Biye',0,'Metre','Fason dikim'],['İp',0,'Metre','Fason dikim'],['Stoper',0,'Adet','Fason dikim'],['Uç',0,'Adet','Fason dikim'],['Keçe',0,'Adet','Fason dikim']],
 AKSESUAR:[['Plastik tabla',0,'Adet','Fason baskı'],['Silikon',0,'Adet','9 cm kesim'],['6/8 mm demir',0,'Adet','Tabla üzerine'],['Plastik başlık',0,'Adet','Fason/tedarik']],
 PAKET:[['Ön etiket',0,'Adet','Paketleme'],['Koli',0,'Adet','Paketleme']]
};
const norm=v=>String(v||'').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s').replace(/ö/g,'o').replace(/ç/g,'c').replace(/[×x*.,;:/\\()[\]_-]+/g,' ').replace(/\s+/g,' ').trim();
const ALIAS={'Alüminyum levha H1050 1250x2500x1 mm':['aluminyum','h1050','1250 2500','levha','sac'],'20x40x1 mm kutu profil 221 cm':['20 40','kutu profil','221'],'254 cm yuvarlak profil 1 mm':['254','yuvarlak profil'],'Kurt ağzı kademe demiri':['kurt agzi','kademe'],'Plastik ayak parçası':['plastik','ayak'],'Plastik tabla':['plastik','tabla'],'Plastik başlık':['plastik','baslik'],'Kanal sacı':['kanal','sac'],'Göbek civata':['gobek','civata'],'Ön etiket':['etiket'],'Koli':['koli']};
function scoreProduct(p,aliases,target){
 const text=norm(`${p.UrunKodu||''} ${p.UrunAdi||''}`);
 let score=0;
 const exact=norm(target);
 if(text===exact)score+=180;
 for(const a of aliases||[]){const x=norm(a);if(!x)continue;if(text===x)score+=160;else if(text.includes(x))score+=90;}
 const words=norm(target).split(' ').filter(Boolean);
 score+=words.filter(w=>w.length>1&&text.split(' ').includes(w)).length*14;
 return score;
}
function rankedProducts(list,stage){return list.map(p=>({...p,_score:scoreProduct(p,stage.aliases,stage.output)})).filter(x=>x._score>0).sort((a,b)=>b._score-a._score);}
function best(list,name){const n=norm(name),a=(ALIAS[name]||[]).map(norm);let bestItem=null,bestScore=0;for(const p of list){const t=norm(`${p.UrunKodu||''} ${p.UrunAdi||''}`);let s=t===n?100:0;if(t.includes(n))s+=70;const words=n.split(' ').filter(Boolean);s+=words.filter(w=>t.split(' ').includes(w)).length*12;for(const x of a)if(t.includes(x))s+=18;if(s>bestScore){bestScore=s;bestItem=p;}}return bestScore>=30?bestItem:null;}

export default function Ahbrd1301ReceptTemplate({onDone}){
 const [urunler,setUrunler]=useState([]),[receteler,setReceteler]=useState([]),[outputs,setOutputs]=useState({}),[suggestions,setSuggestions]=useState({}),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const load=async()=>{
  const [u,r]=await Promise.all([axios.get(`${API}/urunler`),axios.get(`${API}/recete-yonetim`)]);
  const products=u.data||[];setUrunler(products);setReceteler(r.data||[]);
  const found={},suggested={};
  for(const s of STAGES){
   const ranked=rankedProducts(products,s);
   suggested[s.key]=ranked.slice(0,3);
   // Sadece güçlü ve açık ara bir eşleşme varsa otomatik seç.
   // Böylece yanlış ürün kartı sessizce seçilmez.
   if(ranked[0] && ranked[0]._score>=90 && (!ranked[1] || ranked[0]._score-ranked[1]._score>=25))found[s.key]=ranked[0].UrunId;
  }
  setSuggestions(suggested);setOutputs(found);
 };
 useEffect(()=>{load().catch(e=>setMessage(e.response?.data?.error||'Ürün kartları alınamadı.'));},[]);
 const options=useMemo(()=>urunler.filter(u=>u.Tur!=='Hizmet').map(u=>({value:u.UrunId,label:u.UrunAdi,sublabel:u.UrunKodu})),[urunler]);
 const existing=useMemo(()=>Object.fromEntries(receteler.map(r=>[r.ReceteKodu,r])),[receteler]);
 const choose=async(stage,id)=>{setOutputs(v=>({...v,[stage.key]:id}));setMessage(`${stage.title}: mevcut ürün kartı eşleştirildi.`);};
 const createItems=key=>(RAW[key]||[]).map(([name,qty,unit,note])=>{const p=best(urunler,name);const service=unit==='Hizmet';return {kalemTipi:service?'Hizmet':'Malzeme',hammaddeUrunId:p?.UrunId||null,hammaddeAdi:p?.UrunAdi||name,miktar:qty,girdiMiktari:qty,girdiBirimi:unit,ciktiMiktari:null,ciktiBirimi:unit,verimOrani:100,fireOrani:0,donusumAciklama:note,tedarikciCariId:null,fasonMu:service,hizmetBirimFiyati:0,nakliyeMaliyeti:0,iscilikDakika:0,makineDakika:0,iscilikBirimMaliyeti:0,makineBirimMaliyeti:0,depo:'Merkez Depo',istasyonAdi:note,aciklama:p?`${name} · gerçek ürün kartı eşlendi`:`${name} · ürün kartı daha sonra seçilecek`};});
 const saveStage=async(s,children)=>{const product=urunler.find(u=>String(u.UrunId)===String(outputs[s.key]));if(!product)throw new Error(`${s.title} için çıktı ürün kartı seçilmemiş.`);const items=createItems(s.key);for(const c of children)items.push({kalemTipi:'Yarı Mamul',hammaddeUrunId:c.productId||null,hammaddeAdi:c.name,miktar:c.qty,girdiMiktari:c.qty,girdiBirimi:'Adet',ciktiMiktari:1,ciktiBirimi:'Adet',verimOrani:100,fireOrani:0,altReceteId:c.id,donusumAciklama:'AHBRD 1301 alt reçete bağlantısı',depo:'Merkez Depo',istasyonAdi:s.title,aciklama:'Alt reçete'});if(!items.length)items.push({kalemTipi:'Malzeme',hammaddeUrunId:null,hammaddeAdi:`${s.title} üretim operasyonu`,miktar:0,girdiMiktari:0,girdiBirimi:'Adet',verimOrani:100,fireOrani:0,donusumAciklama:s.note,aciklama:'Yapı satırı; miktar sonradan girilecek'});const code=`AHBRD1301-${s.key}`;const old=existing[code];const payload={form:{receteKodu:code,receteAdi:s.output,mamulUrunId:product.UrunId,mamulAdi:product.UrunAdi,aciklama:`AHBRD 1301 · ${s.note}`,versiyon:old?.Versiyon||1,uretimBirimi:'Adet',durum:'Aktif',receteTipi:s.key==='MAMUL'?'Mamul':s.key==='MONTAJ'?'Alt Montaj':'Yarı Mamul',ciktiMiktari:1,ciktiBirimi:'Adet',standartFireOrani:0},items,operations:[]};const r=await axios.post(`${API}/recete-agaci`,payload);return{ReceteId:r.data.receteId,name:product.UrunAdi,productId:product.UrunId};};
 const build=async()=>{if(STAGES.some(s=>!outputs[s.key])){setMessage('Güvenli otomatik eşleşme yapılamayan aşamalar var. Önerilen ürün kartlarından seçerek 8 aşamayı tamamla. Ürün ID uydurulmuyor.');return;}setBusy(true);setMessage('AHBRD 1301 gerçek Reçete Yönetimi içine kuruluyor…');try{const made={};for(const s of STAGES){let children=[];if(s.key==='MONTAJ')for(const k of ['TABLA','AYAK','KADEME','KILIF','AKSESUAR']){const r=made[k]||existing[`AHBRD1301-${k}`];if(r?.ReceteId)children.push({id:r.ReceteId,name:r.name||k,productId:outputs[k],qty:1});}if(s.key==='PAKET'){const r=made.MONTAJ||existing['AHBRD1301-MONTAJ'];if(r?.ReceteId)children.push({id:r.ReceteId,name:r.name||'Son Montaj',productId:outputs.MONTAJ,qty:1});}if(s.key==='MAMUL'){const r=made.PAKET||existing['AHBRD1301-PAKET'];if(r?.ReceteId)children.push({id:r.ReceteId,name:r.name||'Paketleme',productId:outputs.PAKET,qty:1});}made[s.key]=await saveStage(s,children);}setMessage('✓ AHBRD 1301 gerçek Reçete Yönetimi içinde 8 reçete kartı olarak oluşturuldu/güncellendi.');await load();if(onDone)onDone(made);setTimeout(()=>setOpen(false),900);}catch(e){setMessage(e.response?.data?.detail||e.response?.data?.error||e.message||'Reçete ağacı kurulamadı.');}finally{setBusy(false);}};
 return <><button className="ahbrd-template-button" onClick={()=>setOpen(true)}>🏗️ AHBRD 1301 Ağacı Kur / Güncelle</button>{open&&<div className="ahbrd-modal-backdrop"><div className="ahbrd-modal"><div className="ahbrd-modal-head"><div><span>GERÇEK REÇETE YÖNETİMİ</span><h2>AHBRD 1301 Üretim Ağacı</h2><p>Demo değil. Kayıtlar mevcut <b>Receteler / ReceteDetay</b> tablolarına yazılır.</p></div><button onClick={()=>setOpen(false)}>×</button></div><div className="ahbrd-real-tree">{STAGES.map((s,i)=>{const top=suggestions[s.key]?.[0];return <div className="ahbrd-real-row" key={s.key}><b>{i+1}</b><div><strong>{s.title}</strong><small>{s.note}</small>{top&&<small style={{display:'block',marginTop:4,color:'#777'}}>Öneri: <b>{top.UrunKodu||'Kod yok'}</b> · {top.UrunAdi}</small>}</div><SearchableSelect options={options} value={outputs[s.key]||''} onChange={id=>choose(s,id)} placeholder={top?`Önerilen: ${top.UrunAdi}`:'Mevcut ürün kartını seç…'}/><em className={outputs[s.key]?'ok':''}>{outputs[s.key]?'✓ Eşlendi':'⚠ Seçilmeli'}</em></div>})}</div>{message&&<div className="ahbrd-real-message">{message}</div>}<div className="ahbrd-modal-foot"><span>Yapı: <b>MAMUL → PAKET → MONTAJ → 5 alt grup</b></span><button className="ahbrd-build" disabled={busy} onClick={build}>{busy?'Kuruluyor…':'⚙ Gerçek Ağacı Kur / Güncelle'}</button></div></div></div>}</>;
}
