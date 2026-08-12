import React, { useState } from "react";
import * as XLSX from "xlsx";
import axios from "axios";
import "./PlatformImportPage.css";

const API_URL = "http://localhost:5000/api";

// Beklenen Excel kolonları (esnek: büyük/küçük harf ve boşluk farkını tolere eder)
const KOLON_ESLESTIRME = {
  siparisNo: ["sipariş no", "siparis no", "order id", "order no", "sipariş numarası"],
  platform: ["platform", "pazaryeri", "kanal"],
  musteri: ["müşteri", "musteri", "alıcı", "alici", "customer"],
  urunAdi: ["ürün", "urun", "ürün adı", "product", "product name"],
  urunKodu: ["ürün kodu", "urun kodu", "sku", "barkod"],
  miktar: ["miktar", "adet", "qty", "quantity"],
  fiyat: ["fiyat", "birim fiyat", "price", "tutar"],
  tarih: ["tarih", "sipariş tarihi", "order date"],
};

const bulKolon = (row, adaylar) => {
  const keys = Object.keys(row);
  for (const aday of adaylar) {
    const found = keys.find(k => k.toLowerCase().trim() === aday);
    if (found) return row[found];
  }
  return "";
};

const PlatformImportPage = () => {
  const [dosyaAdi, setDosyaAdi] = useState("");
  const [onizlemeSatirlari, setOnizlemeSatirlari] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [sonuc, setSonuc] = useState(null);

  const normalizeTarih = (val) => {
    if (!val) return new Date().toISOString().split("T")[0];
    const d = new Date(val);
    if (isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
    return d.toISOString().split("T")[0];
  };

  const handleDosyaSec = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setDosyaAdi(file.name);
    setSonuc(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

      const gruplar = {};
      rows.forEach(row => {
        const siparisNo = String(bulKolon(row, KOLON_ESLESTIRME.siparisNo) || `PLT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
        if (!gruplar[siparisNo]) {
          gruplar[siparisNo] = {
            siparisNo,
            platform: bulKolon(row, KOLON_ESLESTIRME.platform) || "PLATFORM",
            musteri: bulKolon(row, KOLON_ESLESTIRME.musteri) || "Platform Müşterisi",
            tarih: bulKolon(row, KOLON_ESLESTIRME.tarih) || new Date().toISOString().split("T")[0],
            items: []
          };
        }
        gruplar[siparisNo].items.push({
          urunAdi: bulKolon(row, KOLON_ESLESTIRME.urunAdi) || "Bilinmeyen Ürün",
          urunKodu: bulKolon(row, KOLON_ESLESTIRME.urunKodu) || "",
          miktar: Number(bulKolon(row, KOLON_ESLESTIRME.miktar)) || 1,
          birimFiyat: Number(bulKolon(row, KOLON_ESLESTIRME.fiyat)) || 0,
        });
      });

      setOnizlemeSatirlari(Object.values(gruplar));
    };
    reader.readAsBinaryString(file);
  };

  const handleIceAktar = async () => {
    if (onizlemeSatirlari.length === 0) return;
    setYukleniyor(true);
    setSonuc(null);

    const siparisler = onizlemeSatirlari.map(g => ({
      form: {
        siparisKodu: `PLT-${g.siparisNo}`,
        siparisTarihi: normalizeTarih(g.tarih),
        siparisTipi: "YENİ SİPARİŞ",
        siparisVeren: (g.platform || "").toString().toUpperCase(),
        cariAdi: g.musteri,
      },
      items: g.items.map(it => ({
        ...it,
        satirToplam: Number(it.miktar) * Number(it.birimFiyat)
      }))
    }));

    try {
      const res = await axios.post(`${API_URL}/siparisler/toplu-import`, { siparisler });
      setSonuc(res.data);
      setOnizlemeSatirlari([]);
      setDosyaAdi("");
    } catch (err) {
      alert("İçe aktarma sırasında hata oluştu: " + (err.response?.data?.error || err.message));
    } finally {
      setYukleniyor(false);
    }
  };

  return (
    <div className="pim-container">
      <div className="pim-card">
        <div className="pim-header">🔗 Platform Siparişlerini İçe Aktar</div>
        <p className="pim-desc">
          Trendyol, Hepsiburada, N11, Amazon vb. platformlardan indirdiğin sipariş dökümünü (Excel/CSV)
          buraya yükle — sistem otomatik olarak Sipariş kaydına dönüştürür. Kolon başlıkları
          "Sipariş No, Platform, Müşteri, Ürün, Ürün Kodu, Miktar, Fiyat, Tarih" gibi isimleri
          otomatik tanır (Türkçe/İngilizce varyasyonlarını da).
        </p>

        <div className="pim-upload-box">
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleDosyaSec} id="pim-file" style={{ display: "none" }} />
          <label htmlFor="pim-file" className="pim-upload-btn">📁 Dosya Seç (.xlsx / .csv)</label>
          {dosyaAdi && <span className="pim-filename">{dosyaAdi}</span>}
        </div>

        {onizlemeSatirlari.length > 0 && (
          <>
            <div className="pim-subheader">Önizleme — {onizlemeSatirlari.length} sipariş bulundu</div>
            <table className="pim-table">
              <thead>
                <tr><th>Sipariş No</th><th>Platform</th><th>Müşteri</th><th>Ürün Sayısı</th><th>Toplam</th></tr>
              </thead>
              <tbody>
                {onizlemeSatirlari.slice(0, 20).map((g, idx) => (
                  <tr key={idx}>
                    <td>{g.siparisNo}</td>
                    <td>{g.platform}</td>
                    <td>{g.musteri}</td>
                    <td>{g.items.length}</td>
                    <td>{g.items.reduce((a, it) => a + it.miktar * it.birimFiyat, 0).toLocaleString()} ₺</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {onizlemeSatirlari.length > 20 && (
              <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                ...ve {onizlemeSatirlari.length - 20} sipariş daha
              </p>
            )}
            <div className="pim-form-footer">
              <button className="pim-btn-import" onClick={handleIceAktar} disabled={yukleniyor}>
                {yukleniyor ? "İçe aktarılıyor..." : `${onizlemeSatirlari.length} Siparişi İçe Aktar`}
              </button>
            </div>
          </>
        )}

        {sonuc && (
          <div className="pim-result">
            ✅ {sonuc.basarili} sipariş başarıyla eklendi.
            {sonuc.hatali > 0 && <span style={{ color: "var(--danger)" }}> {sonuc.hatali} sipariş hata verdi.</span>}
          </div>
        )}

        <div className="pim-note">
          ℹ️ Not: Bu, platformların canlı API'lerine bağlı otomatik senkronizasyon değildir (o, her
          platformun kendi API anahtarlarını gerektirir). Şimdilik platformdan indirdiğin dosyayı
          manuel yüklüyorsun. İleride API anahtarlarınız olursa gerçek zamanlı entegrasyona geçebiliriz.
        </div>
      </div>
    </div>
  );
};

export default PlatformImportPage;
