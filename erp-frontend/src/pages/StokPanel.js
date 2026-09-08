import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './StokPanel.css';

const API_URL = 'http://localhost:5000/api';

const StokPanel = () => {
  const [stok, setStok] = useState([]);
  const [hareketler, setHareketler] = useState([]);
  const [urunler, setUrunler] = useState([]);
  const [filter, setFilter] = useState('');
  const [durum, setDurum] = useState('Hepsi');
  const [depo, setDepo] = useState('Merkez Depo');
  const [activeTab, setActiveTab] = useState('ozet');
  const [selectedUrun, setSelectedUrun] = useState(null);
  const [form, setForm] = useState({ HareketTipi: 'Giriş', UrunId: '', Miktar: '', Depo: 'Merkez Depo', Aciklama: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [stokRes, hareketRes, urunRes] = await Promise.all([
        axios.get(`${API_URL}/stok`),
        axios.get(`${API_URL}/stok/hareketler`),
        axios.get(`${API_URL}/urunler`)
      ]);
      setStok(stokRes.data || []);
      setHareketler(hareketRes.data || []);
      setUrunler((urunRes.data || []).filter(x => x.Tur !== 'Hizmet'));
    } catch (err) {
      console.error('Stok verileri alınamadı:', err);
      setStok([]); setHareketler([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => stok.filter(s => {
    const text = `${s.UrunKodu || ''} ${s.UrunAdi || ''} ${s.Kategori || ''}`.toLowerCase();
    const matchesText = text.includes(filter.toLowerCase());
    const matchesStatus = durum === 'Hepsi' || (durum === 'Kritik' ? Number(s.Kritik) === 1 : Number(s.Kritik) === 0);
    return matchesText && matchesStatus;
  }), [stok, filter, durum]);

  const toplamStok = stok.reduce((a, s) => a + Number(s.Mevcut || 0), 0);
  const kritik = stok.filter(s => Number(s.Kritik) === 1).length;
  const bugun = hareketler.filter(h => new Date(h.CreatedAt).toDateString() === new Date().toDateString()).length;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.UrunId || Number(form.Miktar) <= 0) return alert('Ürün ve pozitif miktar seçiniz.');
    if ((form.HareketTipi === 'Sayım' || form.HareketTipi === 'Düzeltme') && form.SonrakiStok === '') return alert('Yeni stok miktarını giriniz.');
    setSaving(true);
    try {
      await axios.post(`${API_URL}/stok/hareket`, form);
      alert('Stok hareketi kaydedildi.');
      setForm({ HareketTipi: 'Giriş', UrunId: '', Miktar: '', Depo: 'Merkez Depo', Aciklama: '' });
      await load();
      setActiveTab('hareketler');
    } catch (err) {
      alert(err.response?.data?.error || 'Stok hareketi kaydedilemedi.');
    } finally { setSaving(false); }
  };

  const selectUrun = (u) => {
    setSelectedUrun(u);
    setForm(f => ({ ...f, UrunId: String(u.UrunId) }));
    setActiveTab('hareket');
  };

  return (
    <div className="stok-page">
      <div className="stok-head">
        <div>
          <div className="stok-eyebrow">STOK YÖNETİMİ</div>
          <h1>Stok Merkezi</h1>
          <p>Seçili şirkete ait stokları, depoları ve tüm stok hareketlerini tek ekrandan yönetin.</p>
        </div>
        <button className="stok-refresh" onClick={load} disabled={loading}>{loading ? 'Yükleniyor…' : '↻ Yenile'}</button>
      </div>

      <div className="stok-kpis">
        <div><span>Ürün</span><strong>{stok.length}</strong></div>
        <div><span>Toplam Miktar</span><strong>{toplamStok.toLocaleString('tr-TR')}</strong></div>
        <div className="warning"><span>Kritik Stok</span><strong>{kritik}</strong></div>
        <div><span>Bugünkü Hareket</span><strong>{bugun}</strong></div>
      </div>

      <div className="stok-tabs">
        <button className={activeTab === 'ozet' ? 'active' : ''} onClick={() => setActiveTab('ozet')}>Stok Özeti</button>
        <button className={activeTab === 'hareket' ? 'active' : ''} onClick={() => setActiveTab('hareket')}>Stok Hareketi</button>
        <button className={activeTab === 'hareketler' ? 'active' : ''} onClick={() => setActiveTab('hareketler')}>Hareket Geçmişi</button>
      </div>

      {activeTab === 'ozet' && <>
        <div className="stok-toolbar">
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Ürün kodu, adı veya kategori ara…" />
          <select value={durum} onChange={e => setDurum(e.target.value)}><option>Hepsi</option><option>Kritik</option><option>Normal</option></select>
          <select value={depo} onChange={e => setDepo(e.target.value)}><option>Merkez Depo</option><option>Üretim</option><option>Sevkiyat</option></select>
        </div>
        <div className="stok-table-card">
          <table>
            <thead><tr><th>Kod</th><th>Ürün</th><th>Kategori</th><th>Depo</th><th>Mevcut</th><th>Min.</th><th>Durum</th><th></th></tr></thead>
            <tbody>{filtered.map(row => <tr key={row.UrunId} className={Number(row.Kritik) ? 'critical-row' : ''}>
              <td className="mono">{row.UrunKodu}</td><td><b>{row.UrunAdi}</b></td><td>{row.Kategori || '—'}</td><td>{depo}</td>
              <td className="stock-number">{Number(row.Mevcut || 0).toLocaleString('tr-TR')} {row.Birim}</td>
              <td>{Number(row.KritikStokSeviyesi || 0).toLocaleString('tr-TR')}</td>
              <td><span className={`stock-badge ${Number(row.Kritik) ? 'danger' : 'ok'}`}>{Number(row.Kritik) ? 'KRİTİK' : 'NORMAL'}</span></td>
              <td><button className="row-action" onClick={() => selectUrun(row)}>Hareket</button></td>
            </tr>)}</tbody>
          </table>
          {!filtered.length && <div className="stok-empty">Kriterlere uygun stok bulunamadı.</div>}
        </div>
      </>}

      {activeTab === 'hareket' && <form className="stok-movement" onSubmit={submit}>
        <div className="movement-title">Yeni Stok Hareketi</div>
        <div className="movement-grid">
          <label>Hareket Tipi<select value={form.HareketTipi} onChange={e => setForm({...form, HareketTipi:e.target.value})}><option>Giriş</option><option>Çıkış</option><option>Sayım</option><option>Düzeltme</option></select></label>
          <label>Ürün<select value={form.UrunId} onChange={e => { const u=urunler.find(x=>String(x.UrunId)===e.target.value); setSelectedUrun(u); setForm({...form,UrunId:e.target.value}); }}><option value="">Ürün seçiniz</option>{urunler.map(u=><option key={u.UrunId} value={u.UrunId}>{u.UrunKodu} — {u.UrunAdi}</option>)}</select></label>
          <label>Miktar<input type="number" min="0.0001" step="0.0001" value={form.Miktar} onChange={e=>setForm({...form,Miktar:e.target.value})} /></label>
          {(form.HareketTipi === 'Sayım' || form.HareketTipi === 'Düzeltme') && <label>Yeni Stok<input type="number" min="0" step="0.0001" value={form.SonrakiStok || ''} onChange={e=>setForm({...form,SonrakiStok:e.target.value})} /></label>}
          <label>Depo<select value={form.Depo} onChange={e=>setForm({...form,Depo:e.target.value})}><option>Merkez Depo</option><option>Üretim</option><option>Sevkiyat</option></select></label>
          <label className="wide">Açıklama<input value={form.Aciklama} onChange={e=>setForm({...form,Aciklama:e.target.value})} placeholder="İrsaliye, sayım, satın alma vb." /></label>
        </div>
        {selectedUrun && <div className="movement-current"><span>Seçili ürün</span><b>{selectedUrun.UrunKodu} — {selectedUrun.UrunAdi}</b><strong>Mevcut: {Number(selectedUrun.Mevcut ?? selectedUrun.StokMiktari ?? 0).toLocaleString('tr-TR')}</strong></div>}
        <button className="save-movement" disabled={saving}>{saving ? 'Kaydediliyor…' : 'Stok Hareketini Kaydet'}</button>
      </form>}

      {activeTab === 'hareketler' && <div className="stok-table-card">
        <div className="history-head"><b>Son 500 Hareket</b><span>{hareketler.length} kayıt</span></div>
        <table><thead><tr><th>Tarih</th><th>Kod</th><th>Ürün</th><th>Depo</th><th>Tip</th><th>Miktar</th><th>Önceki</th><th>Sonraki</th><th>Açıklama</th></tr></thead>
          <tbody>{hareketler.map(h=><tr key={h.StokHareketId}><td>{new Date(h.CreatedAt).toLocaleString('tr-TR')}</td><td className="mono">{h.UrunKodu}</td><td>{h.UrunAdi}</td><td>{h.Depo}</td><td><span className={`movement-badge ${h.HareketTipi === 'Çıkış' ? 'out' : 'in'}`}>{h.HareketTipi}</span></td><td>{Number(h.Miktar).toLocaleString('tr-TR')}</td><td>{Number(h.OncekiStok).toLocaleString('tr-TR')}</td><td><b>{Number(h.SonrakiStok).toLocaleString('tr-TR')}</b></td><td>{h.Aciklama || '—'}</td></tr>)}</tbody>
        </table>
      </div>}
    </div>
  );
};

export default StokPanel;
