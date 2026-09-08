import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import SearchableSelect from '../components/SearchableSelect';
import './ReceteYonetimPage.css';

const API_URL = 'http://localhost:5000/api';
const emptyForm = { receteKodu: '', receteAdi: '', mamulUrunId: '', mamulAdi: '', aciklama: '', versiyon: 1, uretimBirimi: 'Adet', durum: 'Aktif' };
const emptyItem = { hammaddeUrunId: '', hammaddeAdi: '', miktar: '', birim: 'Adet', fireOrani: 0, istasyon: '', aciklama: '' };
const emptyOp = { istasyonAdi: '', islemAdi: '', tahminiSureDk: '', iscilikDakika: '', makineDakika: '', fasonMu: false, aciklama: '' };
const money = (n) => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ReceteYonetimPage() {
  const [urunler, setUrunler] = useState([]);
  const [receteler, setReceteler] = useState([]);
  const [form, setForm] = useState({ ...emptyForm, receteKodu: `REC-${Date.now().toString().slice(-7)}` });
  const [item, setItem] = useState(emptyItem);
  const [items, setItems] = useState([]);
  const [op, setOp] = useState(emptyOp);
  const [operations, setOperations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [cost, setCost] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([axios.get(`${API_URL}/urunler`), axios.get(`${API_URL}/recete-yonetim`)]);
      setUrunler(u.data || []);
      setReceteler(r.data || []);
    } catch (e) {
      alert(e.response?.data?.error || 'Reçete verileri alınamadı.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const newCode = () => `REC-${Date.now().toString().slice(-7)}`;
  const reset = () => {
    setForm({ ...emptyForm, receteKodu: newCode() });
    setItems([]); setOperations([]); setSelected(null); setCost(null); setItem(emptyItem); setOp(emptyOp);
  };

  const mamulOptions = useMemo(() => urunler.filter(u => u.Tur !== 'Hizmet').map(u => ({ value: u.UrunId, label: u.UrunAdi, sublabel: u.UrunKodu })), [urunler]);
  const materialOptions = useMemo(() => urunler.map(u => ({ value: u.UrunId, label: u.UrunAdi, sublabel: u.UrunKodu })), [urunler]);
  const selectedMaterial = urunler.find(u => String(u.UrunId) === String(item.hammaddeUrunId));

  const addItem = () => {
    if (!item.hammaddeUrunId || Number(item.miktar) <= 0) return alert('Hammadde ve geçerli miktar girin.');
    const u = urunler.find(x => String(x.UrunId) === String(item.hammaddeUrunId));
    setItems(v => [...v, { ...item, hammaddeAdi: u?.UrunAdi || item.hammaddeAdi, id: crypto.randomUUID() }]);
    setItem(emptyItem);
  };

  const addOp = () => {
    if (!op.istasyonAdi) return alert('İstasyon adı girin.');
    setOperations(v => [...v, { ...op, id: crypto.randomUUID() }]);
    setOp(emptyOp);
  };

  const save = async () => {
    if (!form.mamulUrunId) return alert('Mamul ürün seçin.');
    if (!items.length) return alert('En az bir hammadde ekleyin.');
    setSaving(true);
    try {
      const payload = { form, items, operations };
      if (selected?.ReceteId) {
        await axios.put(`${API_URL}/recete-yonetim/${selected.ReceteId}`, payload);
        alert('Reçete güncellendi.');
      } else {
        await axios.post(`${API_URL}/recete-yonetim`, payload);
        alert('Reçete başarıyla kaydedildi.');
      }
      await load();
      reset();
    } catch (e) {
      alert(e.response?.data?.error || 'Reçete kaydedilemedi.');
    } finally { setSaving(false); }
  };

  const createRevision = async () => {
    if (!selected?.ReceteId) return;
    if (!window.confirm(`V${form.versiyon} reçetesinden yeni bir revizyon oluşturulsun mu?`)) return;
    try {
      const { data } = await axios.post(`${API_URL}/recete-yonetim/${selected.ReceteId}/revizyon`);
      alert(data.message || 'Yeni revizyon oluşturuldu.');
      await load();
      if (data.receteId) {
        const fresh = (await axios.get(`${API_URL}/recete-yonetim/${data.receteId}`)).data;
        setSelected(fresh);
        setForm({ receteKodu:fresh.ReceteKodu||'', receteAdi:fresh.ReceteAdi||'', mamulUrunId:fresh.MamulUrunId||'', mamulAdi:fresh.MamulAdi||'', aciklama:fresh.Aciklama||'', versiyon:fresh.Versiyon||1, uretimBirimi:fresh.UretimBirimi||'Adet', durum:fresh.Durum||'Taslak' });
        setItems((fresh.items||[]).map((x,i)=>({...x,id:`db-${i}`})));
        setOperations((fresh.operations||[]).map((x,i)=>({id:`op-${i}`,istasyonAdi:x.IstasyonAdi||'',islemAdi:x.IslemAdi||'',tahminiSureDk:x.TahminiSureDk||'',iscilikDakika:x.IscilikDakika||'',makineDakika:x.MakineDakika||'',fasonMu:!!x.FasonMu,aciklama:x.Aciklama||''})));
        const c = await axios.get(`${API_URL}/recete-yonetim/${data.receteId}/maliyet`); setCost(c.data);
      }
    } catch (e) { alert(e.response?.data?.error || 'Revizyon oluşturulamadı.'); }
  };

  const openRecipe = async (r) => {
    try {
      const { data } = await axios.get(`${API_URL}/recete-yonetim/${r.ReceteId}`);
      setSelected(data);
      setForm({ receteKodu:data.ReceteKodu||'', receteAdi:data.ReceteAdi||'', mamulUrunId:data.MamulUrunId||'', mamulAdi:data.MamulAdi||'', aciklama:data.Aciklama||'', versiyon:data.Versiyon||1, uretimBirimi:data.UretimBirimi||'Adet', durum:data.Durum||'Aktif' });
      setItems((data.items||[]).map((x,i)=>({...x, id:`db-${i}`})));
      setOperations((data.operations||[]).map((x,i)=>({ id:`op-${i}`, istasyonAdi:x.IstasyonAdi||'', islemAdi:x.IslemAdi||'', tahminiSureDk:x.TahminiSureDk||'', iscilikDakika:x.IscilikDakika||'', makineDakika:x.MakineDakika||'', fasonMu:!!x.FasonMu, aciklama:x.Aciklama||'' })));
      const c = await axios.get(`${API_URL}/recete-yonetim/${r.ReceteId}/maliyet`); setCost(c.data);
    } catch (e) { alert(e.response?.data?.error || 'Reçete detayı alınamadı.'); }
  };

  const filtered = receteler.filter(r => `${r.ReceteKodu} ${r.MamulAdi} ${r.ReceteAdi || ''}`.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')));
  const materialTotal = cost?.materialCost || 0;

  return <div className="recete-v2">
    <div className="recete-v2-title">
      <div><span>ÜRETİM</span><h1>Reçete Yönetimi</h1><p>BOM, üretim rotası, revizyon ve güncel hammadde maliyeti</p></div>
      <div className="rv2-title-actions">
        {selected?.ReceteId && <button className="rv2-secondary" onClick={createRevision}>↗ Yeni Revizyon</button>}
        <button className="rv2-primary" onClick={reset}>+ Yeni Reçete</button>
      </div>
    </div>

    <div className="rv2-layout">
      <aside className="rv2-list">
        <div className="rv2-list-head"><strong>Reçete Kartları</strong><span>{receteler.length}</span></div>
        <input className="rv2-search" placeholder="Kod veya mamul ara..." value={search} onChange={e=>setSearch(e.target.value)} />
        <div className="rv2-scroll">
          {loading ? <div className="rv2-empty">Yükleniyor...</div> : filtered.map(r => <button className={`rv2-recipe ${selected?.ReceteId===r.ReceteId?'active':''}`} key={r.ReceteId} onClick={()=>openRecipe(r)}><b>{r.ReceteKodu}</b><span>{r.MamulAdi}</span><small>Rev. {r.Versiyon || 1} · {r.Durum || 'Aktif'}</small></button>)}
          {!filtered.length && <div className="rv2-empty">Reçete bulunamadı.</div>}
        </div>
      </aside>

      <main className="rv2-main">
        <section className="rv2-card">
          <div className="rv2-section-title"><div><span>01</span><h2>Reçete Kartı</h2></div><label className="rv2-status"><input type="checkbox" checked={form.durum==='Aktif'} onChange={e=>setForm({...form,durum:e.target.checked?'Aktif':'Pasif'})}/> Aktif</label></div>
          {selected?.ReceteId && <div className="rv2-edit-banner"><b>Düzenleme modu</b><span>{selected.ReceteKodu} · V{form.versiyon}</span><button onClick={reset}>Düzenlemeyi bırak</button></div>}
          <div className="rv2-grid">
            <label>Reçete Kodu<input value={form.receteKodu} onChange={e=>setForm({...form,receteKodu:e.target.value})}/></label>
            <label>Reçete Adı<input value={form.receteAdi} onChange={e=>setForm({...form,receteAdi:e.target.value})} placeholder="Örn. Ütü Masası Standart Reçete"/></label>
            <label className="wide">Üretilecek Mamul<SearchableSelect options={mamulOptions} value={form.mamulUrunId} onChange={id=>{const u=urunler.find(x=>String(x.UrunId)===String(id));setForm({...form,mamulUrunId:id,mamulAdi:u?.UrunAdi||''})}} placeholder="Mamul ürün seçin..."/></label>
            <label>Revizyon<input type="number" min="1" value={form.versiyon} onChange={e=>setForm({...form,versiyon:e.target.value})}/></label>
            <label>Üretim Birimi<input value={form.uretimBirimi} onChange={e=>setForm({...form,uretimBirimi:e.target.value})}/></label>
            <label className="wide">Açıklama<input value={form.aciklama} onChange={e=>setForm({...form,aciklama:e.target.value})}/></label>
          </div>
        </section>

        <section className="rv2-card">
          <div className="rv2-section-title"><div><span>02</span><h2>Hammadde ve Malzeme</h2></div><b>{items.length} kalem</b></div>
          <div className="rv2-entry">
            <SearchableSelect options={materialOptions} value={item.hammaddeUrunId} onChange={id=>{const u=urunler.find(x=>String(x.UrunId)===String(id));setItem({...item,hammaddeUrunId:id,hammaddeAdi:u?.UrunAdi||'',birim:u?.Birim||'Adet'})}} placeholder="Hammadde seçin..."/>
            <input type="number" min="0" step="0.0001" placeholder="Miktar" value={item.miktar} onChange={e=>setItem({...item,miktar:e.target.value})}/>
            <input placeholder="Birim" value={item.birim} onChange={e=>setItem({...item,birim:e.target.value})}/>
            <input type="number" min="0" step="0.01" placeholder="Fire %" value={item.fireOrani} onChange={e=>setItem({...item,fireOrani:e.target.value})}/>
            <input placeholder="İstasyon" value={item.istasyon} onChange={e=>setItem({...item,istasyon:e.target.value})}/>
            <button className="rv2-add" onClick={addItem}>+ Ekle</button>
          </div>
          {selectedMaterial?.AlisBirimi && <div className="rv2-note">Alış birimi: <b>{selectedMaterial.AlisBirimi}</b> · Reçete birimi: <b>{selectedMaterial.Birim}</b> · Çevrim: <b>{selectedMaterial.CevrimOrani || 1}</b></div>}
          <div className="rv2-table-wrap"><table><thead><tr><th>#</th><th>Malzeme</th><th>Miktar</th><th>Birim</th><th>Fire</th><th>İstasyon</th><th></th></tr></thead><tbody>{items.map((x,i)=><tr key={x.id}><td>{i+1}</td><td><b>{x.hammaddeAdi || x.HammaddeAdi}</b></td><td>{x.miktar ?? x.Miktar}</td><td>{x.birim ?? x.Birim}</td><td>{Number(x.fireOrani ?? x.FireOrani ?? 0).toFixed(2)}%</td><td>{x.istasyon || x.Istasyon || '—'}</td><td><button className="rv2-del" onClick={()=>setItems(v=>v.filter(y=>y.id!==x.id))}>Sil</button></td></tr>)}{!items.length&&<tr><td colSpan="7" className="rv2-empty">Henüz malzeme eklenmedi.</td></tr>}</tbody></table></div>
        </section>

        <section className="rv2-card">
          <div className="rv2-section-title"><div><span>03</span><h2>Üretim Rotası / Operasyonlar</h2></div><b>{operations.length} operasyon</b></div>
          <div className="rv2-entry rv2-op"><input placeholder="İstasyon" value={op.istasyonAdi} onChange={e=>setOp({...op,istasyonAdi:e.target.value})}/><input placeholder="İşlem" value={op.islemAdi} onChange={e=>setOp({...op,islemAdi:e.target.value})}/><input type="number" placeholder="Süre dk" value={op.tahminiSureDk} onChange={e=>setOp({...op,tahminiSureDk:e.target.value})}/><input type="number" placeholder="İşçilik dk" value={op.iscilikDakika} onChange={e=>setOp({...op,iscilikDakika:e.target.value})}/><input type="number" placeholder="Makine dk" value={op.makineDakika} onChange={e=>setOp({...op,makineDakika:e.target.value})}/><button className="rv2-add" onClick={addOp}>+ Ekle</button></div>
          <div className="rv2-route">{operations.map((x,i)=><div className="rv2-op-chip" key={x.id}><strong>{i+1}</strong><span>{x.istasyonAdi || x.IstasyonAdi}</span>{(x.islemAdi || x.IslemAdi)&&<small>{x.islemAdi || x.IslemAdi}</small>}{(x.tahminiSureDk ?? x.TahminiSureDk)&&<em>{x.tahminiSureDk ?? x.TahminiSureDk} dk</em>}<button onClick={()=>setOperations(v=>v.filter(y=>y.id!==x.id))}>×</button></div>)}</div>
        </section>

        <section className="rv2-card rv2-cost">
          <div className="rv2-section-title"><div><span>04</span><h2>Reçete Maliyeti</h2></div><button className="rv2-secondary" disabled={!selected} onClick={()=>selected&&openRecipe(selected)}>↻ Güncelle</button></div>
          <div className="rv2-cost-grid"><div><small>Hammadde Maliyeti</small><strong>{money(materialTotal)} TL</strong></div><div><small>İşçilik Süresi</small><strong>{money(cost?.iscilikDakika)} dk</strong></div><div><small>Makine Süresi</small><strong>{money(cost?.makineDakika)} dk</strong></div><div className="total"><small>Mevcut Hesaplanan Maliyet</small><strong>{money(cost?.totalCost)} TL</strong></div></div>
          <p className="rv2-hint">Hammadde maliyeti, ürün kartındaki güncel <b>Alış Fiyatı</b> üzerinden ve reçetedeki fire oranı dahil edilerek hesaplanır.</p>
        </section>

        <div className="rv2-actions"><button className="rv2-secondary" onClick={reset}>Temizle</button><button className="rv2-primary" disabled={saving} onClick={save}>{saving ? 'Kaydediliyor...' : selected?.ReceteId ? '✓ Değişiklikleri Kaydet' : '✓ Reçeteyi Kaydet'}</button></div>
      </main>
    </div>
  </div>;
}
