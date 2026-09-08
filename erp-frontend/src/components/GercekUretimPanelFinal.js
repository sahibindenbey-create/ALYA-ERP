import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

export default function GercekUretimPanelFinal() {
  const [open, setOpen] = useState(false);
  const [recipes, setRecipes] = useState([]);
  const [recipeId, setRecipeId] = useState('');
  const [miktar, setMiktar] = useState(1);
  const [depo, setDepo] = useState('Merkez Depo');
  const [notlar, setNotlar] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) return;
    axios.get(`${API_URL}/recete-yonetim`)
      .then(({ data }) => setRecipes(Array.isArray(data) ? data.filter(r => r.Durum === 'Aktif') : []))
      .catch(e => alert(e.response?.data?.error || 'Reçeteler alınamadı.'));
  }, [open]);

  const selected = useMemo(() => recipes.find(r => String(r.ReceteId) === String(recipeId)), [recipes, recipeId]);

  const produce = async () => {
    const q = Number(miktar);
    if (!recipeId) return alert('Reçete seçin.');
    if (!Number.isFinite(q) || q <= 0) return alert('Üretim miktarı sıfırdan büyük olmalıdır.');
    if (!window.confirm(`${selected?.MamulAdi || 'Mamul'} için ${q} üretim yapılacak. Hammadde stokları düşülecek. Devam edilsin mi?`)) return;
    setBusy(true); setResult(null);
    try {
      const { data } = await axios.post(`${API_URL}/recete-uretim/${recipeId}/uret`, { miktar: q, depo, notlar: notlar || null });
      setResult(data);
      alert(`Üretim tamamlandı. Üretim No: ${data.uretimId}`);
    } catch (e) {
      alert(e.response?.data?.error || e.response?.data?.detail || 'Üretim gerçekleştirilemedi.');
    } finally { setBusy(false); }
  };

  return <>
    <button type="button" onClick={() => setOpen(true)} style={{ position: 'fixed', right: 24, bottom: 88, zIndex: 2100, border: 0, borderRadius: 12, padding: '12px 18px', background: '#111827', color: '#fff', fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,.2)' }}>⚙ Gerçek Üretim</button>
    {open && <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 'min(600px,100%)', background: '#fff', borderRadius: 18, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 style={{ margin: 0 }}>Gerçek Üretim</h2><button type="button" onClick={() => setOpen(false)}>✕</button></div>
        <label style={{ display: 'block', marginTop: 18 }}>Reçete<select value={recipeId} onChange={e => setRecipeId(e.target.value)} disabled={busy} style={{ display: 'block', width: '100%', marginTop: 6, padding: 10 }}><option value="">Reçete seçin...</option>{recipes.map(r => <option key={r.ReceteId} value={r.ReceteId}>{r.ReceteKodu} · {r.MamulAdi}</option>)}</select></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}><label>Üretim Miktarı<input type="number" min="0.0001" step="0.0001" value={miktar} onChange={e => setMiktar(e.target.value)} disabled={busy} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, padding: 10 }} /></label><label>Depo<input value={depo} onChange={e => setDepo(e.target.value)} disabled={busy} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, padding: 10 }} /></label></div>
        <label style={{ display: 'block', marginTop: 12 }}>Notlar<textarea value={notlar} onChange={e => setNotlar(e.target.value)} disabled={busy} rows={3} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, padding: 10 }} /></label>
        {selected && <p style={{ padding: 12, background: '#f8fafc', borderRadius: 10 }}>Mamul: <b>{selected.MamulAdi}</b>. İşlemde stok yeterliliği kontrol edilir ve tüm hareketler transaction ile kaydedilir.</p>}
        {result && <p style={{ padding: 12, background: '#ecfdf5', color: '#166534', borderRadius: 10 }}>Üretim #{result.uretimId} tamamlandı.</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button type="button" onClick={() => setOpen(false)} disabled={busy}>Kapat</button><button type="button" onClick={produce} disabled={busy}>{busy ? 'Üretiliyor...' : 'Üretimi Gerçekleştir'}</button></div>
      </div>
    </div>}
  </>;
}
