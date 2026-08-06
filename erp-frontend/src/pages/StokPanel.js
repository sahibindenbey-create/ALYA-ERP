import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './StokPanel.css';

const StokPanel = () => {
  const [stok, setStok] = useState([]);
  const [filter, setFilter] = useState('');

  const fetchStok = async () => {
    try {
      const resp = await axios.get('http://localhost:5000/api/stok');
      setStok(resp.data || []);
    } catch (err) {
      console.error('Stok getirme hatasi', err);
      setStok([]);
    }
  };

  useEffect(() => { fetchStok(); }, []);

  const filtered = stok.filter(s =>
    (s.UrunKodu || '').toLowerCase().includes(filter.toLowerCase()) ||
    (s.UrunAdi || '').toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div style={{padding:20}}>
      <h1>Stok Paneli</h1>
      <div style={{marginTop:10, marginBottom:10}}>
        <input placeholder="Ürün kodu/adı ara..." value={filter} onChange={e=>setFilter(e.target.value)} />
        <button onClick={fetchStok} style={{marginLeft:8}}>Yenile</button>
      </div>

      <table className="modern-table">
        <thead>
          <tr><th>UrunId</th><th>UrunKodu</th><th>UrunAdi</th><th>Mevcut</th></tr>
        </thead>
        <tbody>
          {filtered.map(row => (
            <tr key={row.UrunId}>
              <td>{row.UrunId}</td>
              <td>{row.UrunKodu}</td>
              <td>{row.UrunAdi}</td>
              <td>{row.Mevcut}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StokPanel;
