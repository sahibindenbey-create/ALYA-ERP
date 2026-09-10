import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "./KolaybiPage.css";

const API_URL = "http://localhost:5000/api";

const formatTurkeyDateTime = (value) => {
  if (!value) return "";
  let raw = String(value).trim();
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) raw = raw.replace(" ", "T") + "+03:00";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    dateStyle: "short",
    timeStyle: "medium"
  }).format(date);
};

const formatTutar = (n, currency) =>
  `${Number(n || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || "TRY"}`;

/**
 * Tek bir bileşen, 6 farklı KolayBi finans listesi için kullanılıyor
 * (Banka Hesapları, Kasalar, Kredi Kartları, Online Banka Hesapları,
 * Çekler, Senetler). Hangi API uç noktasının ve hangi kolonların
 * kullanılacağı `apiPath` ve `columns` prop'larıyla belirleniyor.
 */
const KolaybiFinansListPage = ({ title, description, apiPath, columns, tip }) => {
  const [kayitlar, setKayitlar] = useState([]);
  const [sonSenkron, setSonSenkron] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState(null);
  const [tumunuCekYukleniyor, setTumunuCekYukleniyor] = useState(false);
  const [tumunuCekSonuc, setTumunuCekSonuc] = useState(null);

  const veriyiGetir = useCallback(async () => {
    setYukleniyor(true);
    setHata(null);
    try {
      const res = await axios.get(`${API_URL}${apiPath}`);
      setKayitlar(res.data?.kayitlar || []);
      setSonSenkron(res.data?.sonSenkronizasyon || null);
    } catch (err) {
      setHata(err.response?.data?.error || err.message);
    } finally {
      setYukleniyor(false);
    }
  }, [apiPath]);

  useEffect(() => { veriyiGetir(); }, [veriyiGetir]);

  const tumunuCek = async () => {
    setTumunuCekYukleniyor(true);
    setTumunuCekSonuc(null);
    try {
      const res = await axios.post(`${API_URL}/kolaybi/full-senkronize`);
      setTumunuCekSonuc({ basarili: res.data?.success !== false, mesaj: res.data?.message || "Senkronizasyon tamamlandı." });
      await veriyiGetir();
    } catch (err) {
      setTumunuCekSonuc({ basarili: false, mesaj: err.response?.data?.error || err.message });
    } finally {
      setTumunuCekYukleniyor(false);
    }
  };

  return (
    <div className="klb-container">
      <div className="klb-card">
        <div className="klb-card-header"><h3>{title}</h3></div>
        {description && <p className="klb-not">{description}</p>}
        {sonSenkron && <div className="klb-son-senkron">Son senkronizasyon: {formatTurkeyDateTime(sonSenkron)}</div>}
        <div className="klb-btn-row">
          <button className="klb-sync-btn" onClick={tumunuCek} disabled={tumunuCekYukleniyor}>
            {tumunuCekYukleniyor ? "Tüm veriler çekiliyor..." : "🔄 Tümünü Çek"}
          </button>
        </div>
        <p className="klb-not" style={{ marginTop: 10 }}>
          "Tümünü Çek", KolayBi'deki fatura/irsaliye/cari/ürün/çek/senet/banka/kasa verilerinin
          tamamını tek seferde günceller. Ayrıca sistem her 5 dakikada bir bu veriyi otomatik olarak
          arka planda tazeler; bu butonu sadece hemen görmek istediğinizde kullanmanız yeterli.
        </p>
        {tumunuCekSonuc && (
          <div className={`klb-test-sonuc ${tumunuCekSonuc.basarili ? "basarili" : "basarisiz"}`}>
            {tumunuCekSonuc.basarili ? "✅" : "❌"} {tumunuCekSonuc.mesaj}
          </div>
        )}
      </div>

      <div className="klb-card">
        {yukleniyor && <p className="klb-not">Yükleniyor...</p>}
        {hata && <div className="klb-sonuc-kutu hata">❌ {hata}</div>}
        {!yukleniyor && !hata && kayitlar.length === 0 && (
          <p className="klb-not">
            Henüz veri yok. Yukarıdan "Tümünü Çek" ile senkronize edin{tip ? ` (KolayBi tarafında "${tip}" tipinde kayıt yoksa liste boş kalır)` : ""}.
          </p>
        )}
        {!yukleniyor && kayitlar.length > 0 && (
          <table className="klb-table">
            <thead>
              <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {kayitlar.map((row, i) => (
                <tr key={row.id ?? i}>
                  {columns.map((c) => (
                    <td key={c.key}>{c.render ? c.render(row) : (row[c.key] ?? "-")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export const bankaHesaplariColumns = [
  { key: "ad", label: "Hesap Adı" },
  { key: "banka", label: "Banka" },
  { key: "iban", label: "IBAN" },
  { key: "bakiye", label: "Bakiye", render: (r) => formatTutar(r.bakiye, r.paraBirimi) }
];

export const kasalarColumns = [
  { key: "ad", label: "Kasa Adı" },
  { key: "bakiye", label: "Bakiye", render: (r) => formatTutar(r.bakiye, r.paraBirimi) }
];

export const krediKartlariColumns = [
  { key: "ad", label: "Kart Adı" },
  { key: "banka", label: "Banka" },
  { key: "kartNo", label: "Kart No" },
  { key: "bakiye", label: "Bakiye", render: (r) => formatTutar(r.bakiye, r.paraBirimi) }
];

export const cekSenetColumns = [
  { key: "seriNo", label: "Seri No" },
  { key: "cari", label: "Cari" },
  { key: "yon", label: "Yön" },
  { key: "vadeTarihi", label: "Vade Tarihi", render: (r) => r.vadeTarihi ? formatTurkeyDateTime(r.vadeTarihi) : "-" },
  { key: "durum", label: "Durum" },
  { key: "tutar", label: "Tutar", render: (r) => formatTutar(r.tutar, r.paraBirimi) }
];

export default KolaybiFinansListPage;
