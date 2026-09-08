import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

export default function GercekUretimPanelFixed() {
  const [open, setOpen] = useState(false);
  const [recipes, setRecipes] = useState([]);
  const [recipeId, setRecipeId] = useState('');
  const [miktar, setMiktar] = useState(1);
  const [notlar, setNotlar] = useState('');
  const [depo, setDepo] = useState('Merkez Depo');
  const [loading, setLoading] = useState(false);
  const [producing, setProducing] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    axios.get(`${API_URL}/recete-yonetim`)
      .then(({ data }) => setRecipes(Array.isArray(data) ? data.filter(r => r.Durum === 'Aktif') : []))
      .catch(e => alert(e.response?.data?.error || 'Reçeteler alınamadı.'))
      .finally(() => setLoading(false));
  }, [open]);

  const selected = useMemo(() => recipes.find(r => String(r.ReceteId) === String(recipeId)), [recipes, recipeId]);

  const produce = async () => {
    const q = Number(miktar);
    if (!recipeId) return alert('Üretilecek reçeteyi seçin.');
    if (!Number.isFinite(q) || q <= 0) return alert('Üretim miktarı sıfırdan büyük olmalıdır.');
    if (!window.confirm(`${selected?.MamulAdi || 'Mamul'} için ${q} adet üretim başlatılsın mı?\n\nHammaddeler stoktan düşülecek ve mamul stoğa girecek.`)) return;

    setProducing(true);
    setResult(null);
    try {
      const { data } = await axios.post(`${API_URL}/recete-uretim/${recipeId}/uret`, { miktar: q, notlar: notlar || null, depo });
      setResult(data);
      alert(`Üretim tamamlandı. Üretim No: ${data.uretimId}`);
    } catch (e) {
      alert(e.response?.data?.error || e.response?.data?.detail || 'Üretim gerçekleştirilemedi.');
    } finally {
      setProducing(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={{ position: 'fixed', right: 24, bottom: 88, zIndex: 2100, border: 0, borderRadius: 12, padding: '12px 18px', background: '#111827', color: '#fff', fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,.2)', cursor: 'pointer' }}>
        ⚙ Gerçek Üretim
      </button>

      {open && <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ width: 'min(620px, 100%)', background: '#fff', borderRadius: 18, padding: 24, boxShadow: '0 24px 70px rgba(0,0,0,.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div><div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', letterSpacing: 1 }}>ÜRETİM İŞLEMİ</div><h2 style={{ margin: '4px 0 0' }}>Gerçek Üretim</h2></div>
            <button type="button" onClick={() => setOpen(false)} style={{ border: 0, background: '#f1f5f9', borderRadius: 10, padding: '8px 12px', cursor: 'pointer' }}>✕</button>
          </div>

          <label style={{ display: 'block', marginBottom: 12, fontWeight: 600 }}>Reçete
            <select value={recipeId} onChange={e => setRecipeId(e.target.value)} disabled={loading || producing} style={{ width: '100%', marginTop: 6, padding: 11, border: '1px solid #cbd5e1', borderRadius: 10 }}>
              <option value="">{loading ? 'Reçeteler yükleniyor...' : 'Reçete seçin...'}</option>
              {recipes.map(r => <option key={r.ReceteId} value={r.ReceteId}>{r.ReceteKodu} · {r.MamulAdi} · {r.CiktiMiktari || 1} {r.CiktiBirimi || r.UretimBirimi || 'Adet'}</option>)}
            </select>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ fontWeight: 600 }}>Üretim Miktarı<input type="number" min="0.0001" step="0.0001" value={miktar} onChange={e => setMiktar(e.target.value)} disabled={producing} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, padding: 11, border: '1px solid #cbd5e1', borderRadius: 10 }} /></label>
            <label style={{ fontWeight: 600 }}>Depo<input value={depo} onChange={e => setDepo(e.target.value)} disabled={producing} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, padding: 11, border: '1px solid #cbd5e1', borderRadius: 10 }} /></label>
          </div>

          <label style={{ display: 'block', marginTop: 12, fontWeight: 600 }}>Notlar<textarea value={notlar} onChange={e => setNotlar(e.target.value)} disabled={producing} rows={3} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, padding: 11, border: '1px solid #cbd5e1', borderRadius: 10, resize: 'vertical' }} /></label>

          {selected && <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: '#f8fafc', color: '#475569' }}><b>{selected.MamulAdi}</b> üretilecek. Yeterli hammadde kontrolü yapılır; stok çıkışı ve mamul girişi aynı transaction içinde tamamlanır.</div>}
          {result && <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: '#ecfdf5', color: '#166534' }}>Üretim #{result.uretimId} tamamlandı. {(result.tuketi lenHammaddeler || result.tuketilenHammaddeler || []).length} hammadde hareketi işlendi.</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" onClick={() => setOpen(false)} disabled={producing} style={{ padding: '11px 16px', border: '1px solid #cbd5e1', borderRadius: 10, background: '#fff', cursor: 'pointer' }}>Kapat</button>
            <button type="button" onClick={produce} disabled={producing} style={{ padding: '11px 18px', border: 0, borderRadius: 10, background: '#16a34a', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>{producing ? 'Üretiliyor...' : 'Üretimi Gerçekleştir'}</button>
          </div>
        </div>
      </div>}
    </>
  );
}
