import React, { useState, useEffect } from "react";
import axios from "axios";
import ExportToolbar from "../components/ExportToolbar";
import "./FinansalRaporlarPage.css";

const API_URL = "http://localhost:5000/api";

const TABS = [
  { key: "vadesi-gecmis", label: "Vadesi Geçmiş Borç/Alacak" },
  { key: "yaslandirma", label: "Yaşlandırılmış Nakit Akışı" },
  { key: "karlilik", label: "Ürün Karlılığı" },
];

const FinansalRaporlarPage = () => {
  const [tab, setTab] = useState("vadesi-gecmis");
  const [vadesiVeri, setVadesiVeri] = useState(null);
  const [yaslandirmaVeri, setYaslandirmaVeri] = useState(null);
  const [karlilikVeri, setKarlilikVeri] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchVadesi = async () => {
    setLoading(true);
    try { const res = await axios.get(`${API_URL}/raporlar/vadesi-gecmis`); setVadesiVeri(res.data); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };
  const fetchYaslandirma = async () => {
    setLoading(true);
    try { const res = await axios.get(`${API_URL}/raporlar/yaslandirma`); setYaslandirmaVeri(res.data); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };
  const fetchKarlilik = async () => {
    setLoading(true);
    try { const res = await axios.get(`${API_URL}/raporlar/urun-karliligi`); setKarlilikVeri(res.data); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (tab === "vadesi-gecmis" && !vadesiVeri) fetchVadesi();
    if (tab === "yaslandirma" && !yaslandirmaVeri) fetchYaslandirma();
    if (tab === "karlilik" && karlilikVeri.length === 0) fetchKarlilik();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const gunRozet = (gun) => {
    if (gun <= 0) return <span className="rapor-rozet yakinda">Vadesi bugün/yakın</span>;
    if (gun <= 30) return <span className="rapor-rozet hafif">{gun} gün gecikti</span>;
    if (gun <= 60) return <span className="rapor-rozet orta">{gun} gün gecikti</span>;
    return <span className="rapor-rozet agir">{gun} gün gecikti</span>;
  };

  const maxBucketTutar = (bucketArr) => Math.max(1, ...bucketArr.map(b => b.tutar));

  return (
    <div className="rapor-container">
      <div className="rapor-tabs">
        {TABS.map(t => (
          <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {loading && <p style={{ color: "#888" }}>Yükleniyor...</p>}

      {/* --- VADESİ GEÇMİŞ --- */}
      {tab === "vadesi-gecmis" && vadesiVeri && (
        <>
          <div className="rapor-ozet-grid">
            <div className="rapor-ozet-kart yesil">
              <span>Toplam Bekleyen Alacak</span>
              <strong>{vadesiVeri.ozet.toplamAlacak.toLocaleString()} ₺</strong>
            </div>
            <div className="rapor-ozet-kart kirmizi">
              <span>Vadesi Geçen Alacak</span>
              <strong>{vadesiVeri.ozet.vadesiGecenAlacak.toLocaleString()} ₺</strong>
            </div>
            <div className="rapor-ozet-kart turuncu">
              <span>Toplam Bekleyen Borç</span>
              <strong>{vadesiVeri.ozet.toplamBorc.toLocaleString()} ₺</strong>
            </div>
            <div className="rapor-ozet-kart kirmizi">
              <span>Vadesi Geçen Borç</span>
              <strong>{vadesiVeri.ozet.vadesiGecenBorc.toLocaleString()} ₺</strong>
            </div>
          </div>

          <div className="rapor-card">
            <div className="rapor-card-header"><h3>Alacaklarımız (Satış Faturaları) — {vadesiVeri.alacaklar.length}</h3></div>
            <ExportToolbar
              data={vadesiVeri.alacaklar}
              columns={[{ key: "FaturaKodu", label: "Fatura No" }, { key: "CariAdi", label: "Müşteri" }, { key: "VadeTarihi", label: "Vade" }, { key: "GenelToplam", label: "Tutar" }, { key: "GecikmeGunSayisi", label: "Gecikme (gün)" }]}
              filename="vadesi-gecmis-alacaklar"
            />
            <table className="rapor-table">
              <thead><tr><th>Fatura No</th><th>Müşteri</th><th>Fatura Tarihi</th><th>Vade</th><th>Tutar</th><th>Durum</th></tr></thead>
              <tbody>
                {vadesiVeri.alacaklar.map(r => (
                  <tr key={r.FaturaId}>
                    <td>{r.FaturaKodu}</td><td>{r.CariAdi}</td>
                    <td>{new Date(r.FaturaTarihi).toLocaleDateString("tr-TR")}</td>
                    <td>{new Date(r.VadeTarihi).toLocaleDateString("tr-TR")}</td>
                    <td style={{ fontWeight: 700 }}>{Number(r.GenelToplam).toLocaleString()} ₺</td>
                    <td>{gunRozet(r.GecikmeGunSayisi)}</td>
                  </tr>
                ))}
                {vadesiVeri.alacaklar.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "#999", padding: 14 }}>Bekleyen alacak yok</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="rapor-card">
            <div className="rapor-card-header"><h3>Borçlarımız (Alış Faturaları) — {vadesiVeri.borclar.length}</h3></div>
            <ExportToolbar
              data={vadesiVeri.borclar}
              columns={[{ key: "FaturaKodu", label: "Fatura No" }, { key: "CariAdi", label: "Tedarikçi" }, { key: "VadeTarihi", label: "Vade" }, { key: "GenelToplam", label: "Tutar" }, { key: "GecikmeGunSayisi", label: "Gecikme (gün)" }]}
              filename="vadesi-gecmis-borclar"
            />
            <table className="rapor-table">
              <thead><tr><th>Fatura No</th><th>Tedarikçi</th><th>Fatura Tarihi</th><th>Vade</th><th>Tutar</th><th>Durum</th></tr></thead>
              <tbody>
                {vadesiVeri.borclar.map(r => (
                  <tr key={r.FaturaId}>
                    <td>{r.FaturaKodu}</td><td>{r.CariAdi}</td>
                    <td>{new Date(r.FaturaTarihi).toLocaleDateString("tr-TR")}</td>
                    <td>{new Date(r.VadeTarihi).toLocaleDateString("tr-TR")}</td>
                    <td style={{ fontWeight: 700 }}>{Number(r.GenelToplam).toLocaleString()} ₺</td>
                    <td>{gunRozet(r.GecikmeGunSayisi)}</td>
                  </tr>
                ))}
                {vadesiVeri.borclar.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "#999", padding: 14 }}>Bekleyen borç yok</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* --- YAŞLANDIRMA --- */}
      {tab === "yaslandirma" && yaslandirmaVeri && (
        <>
          <div className="rapor-card">
            <div className="rapor-card-header"><h3>Alacak Yaşlandırması (Satış)</h3></div>
            {yaslandirmaVeri.alacakYaslandirma.map(b => (
              <div className="yas-bar-row" key={b.bucket}>
                <span className="yas-bar-label">{b.bucket}</span>
                <div className="yas-bar-track">
                  <div className="yas-bar-fill mavi" style={{ width: `${(b.tutar / maxBucketTutar(yaslandirmaVeri.alacakYaslandirma)) * 100}%` }} />
                </div>
                <span className="yas-bar-deger">{b.tutar.toLocaleString()} ₺ ({b.adet})</span>
              </div>
            ))}
          </div>

          <div className="rapor-card">
            <div className="rapor-card-header"><h3>Borç Yaşlandırması (Alış)</h3></div>
            {yaslandirmaVeri.borcYaslandirma.map(b => (
              <div className="yas-bar-row" key={b.bucket}>
                <span className="yas-bar-label">{b.bucket}</span>
                <div className="yas-bar-track">
                  <div className="yas-bar-fill turuncu" style={{ width: `${(b.tutar / maxBucketTutar(yaslandirmaVeri.borcYaslandirma)) * 100}%` }} />
                </div>
                <span className="yas-bar-deger">{b.tutar.toLocaleString()} ₺ ({b.adet})</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* --- ÜRÜN KARLILIĞI --- */}
      {tab === "karlilik" && (
        <div className="rapor-card">
          <div className="rapor-card-header"><h3>Ürün Karlılık Analizi — {karlilikVeri.length} ürün</h3></div>
          <p className="rapor-not">
            Maliyet, ürün kartındaki "Alış Fiyatı" alanına göre hesaplanır. Reçeteli üretim maliyeti (işçilik + genel gider dahil)
            için Faz 4'te eklenecek olan üretim maliyeti modülü daha kesin sonuç verecektir.
          </p>
          <ExportToolbar
            data={karlilikVeri}
            columns={[{ key: "UrunAdi", label: "Ürün" }, { key: "ToplamAdet", label: "Satış Adedi" }, { key: "ToplamCiro", label: "Ciro" }, { key: "ToplamMaliyet", label: "Maliyet" }, { key: "ToplamKar", label: "Kar" }, { key: "KarOrani", label: "Kar %" }]}
            filename="urun-karliligi"
          />
          <table className="rapor-table">
            <thead><tr><th>Ürün</th><th>Satış Adedi</th><th>Ciro</th><th>Maliyet</th><th>Kar</th><th>Kar Oranı</th></tr></thead>
            <tbody>
              {karlilikVeri.map(r => (
                <tr key={r.UrunKodu}>
                  <td>{r.UrunAdi}</td>
                  <td>{Number(r.ToplamAdet).toLocaleString()}</td>
                  <td>{Number(r.ToplamCiro).toLocaleString()} ₺</td>
                  <td>{Number(r.ToplamMaliyet).toLocaleString()} ₺</td>
                  <td style={{ fontWeight: 700, color: r.ToplamKar >= 0 ? "#16a34a" : "#dc2626" }}>{Number(r.ToplamKar).toLocaleString()} ₺</td>
                  <td>
                    <span className={`rapor-rozet ${r.KarOrani >= 30 ? "yesil-rozet" : r.KarOrani >= 10 ? "hafif" : "agir"}`}>%{r.KarOrani}</span>
                  </td>
                </tr>
              ))}
              {karlilikVeri.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "#999", padding: 14 }}>Henüz satış faturası yok</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FinansalRaporlarPage;
