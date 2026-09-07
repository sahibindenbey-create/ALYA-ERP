import React, { useState } from "react";
import * as XLSX from "xlsx";
import axios from "axios";
import "./PlatformImportPage.css";

const API_URL = "http://localhost:5000/api";

const KOLON_ESLESTIRME = {
  siparisNo: ["sipariş no", "siparis no", "order id", "order no", "sipariş numarası"],
  platform: ["platform", "pazaryeri", "kanal"],
  musteri: ["müşteri", "musteri", "alıcı", "alici", "customer"],
  urunAdi: ["ürün", "urun", "ürün adı", "product", "product name"],
  urunKodu: ["ürün kodu", "urun kodu", "sku", "barkod"],
  miktar: ["miktar", "adet", "qty", "quantity"],
  fiyat: ["fiyat", "birim fiyat", "price", "tutar"],
  tarih: ["tarih", "sipariş tarihi", "order date"]
};

const bulKolon = (row, adaylar) => {
  const keys = Object.keys(row);
  for (const aday of adaylar) {
    const found = keys.find((k) => k.toLowerCase().trim() === aday.toLowerCase());
    if (found) return row[found];
  }
  return "";
};

const durumYazisi = (status) => {
  switch ((status || "").toLowerCase()) {
    case "awaiting": return "Bekliyor";
    case "created": return "Oluşturuldu";
    case "picking": return "Hazırlanıyor";
    case "invoiced": return "Faturalandı";
    case "shipped": return "Kargoda";
    case "delivered": return "Teslim Edildi";
    case "cancelled": return "İptal";
    case "unpacked": return "Paket Açıldı";
    default: return status || "-";
  }
};

const durumClass = (status) => {
  switch ((status || "").toLowerCase()) {
    case "delivered": return "pim-status pim-status-success";
    case "shipped": return "pim-status pim-status-info";
    case "picking": return "pim-status pim-status-warning";
    case "cancelled": return "pim-status pim-status-danger";
    default: return "pim-status";
  }
};

const tarihFormatla = (value) => {
  if (!value) return "-";
  const d = new Date(Number(value));
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("tr-TR");
};

const paraFormatla = (value) => {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + " TL";
};

const kargoEtiketiYazdir = (siparis) => {
  const adres = siparis.shipmentAddress || {};
  const adSoyad = (siparis.customerFirstName || "") + " " + (siparis.customerLastName || "");
  const musteri = adSoyad.trim();

  const urunler = (siparis.lines || [])
    .map((line) => (line.quantity || 0) + " x " + (line.productName || line.merchantSku || "-"))
    .join("<br>");

  const takip = siparis.cargoTrackingNumber || siparis.shipmentNumber || "-";
  const kargo = siparis.seciliKargo || siparis.cargoProviderName || "-";

  const etiketWindow = window.open("", "_blank", "width=900,height=700");

  if (!etiketWindow) {
    alert("Yazdırma penceresi açılamadı. Tarayıcı açılır pencereyi engelliyor olabilir.");
    return;
  }

  etiketWindow.document.write(
    "<!DOCTYPE html><html lang='tr'><head><meta charset='UTF-8'>" +
    "<title>Kargo Etiketi - " + (siparis.orderNumber || "") + "</title>" +
    "<style>" +
    "* { box-sizing: border-box; }" +
    "body { margin: 0; padding: 20px; font-family: Arial, Helvetica, sans-serif; background: #fff; color: #111; }" +
    ".etiket { width: 100%; max-width: 800px; margin: 0 auto; border: 3px solid #111; padding: 24px; }" +
    ".baslik { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #111; padding-bottom: 15px; margin-bottom: 18px; }" +
    ".logo { font-size: 28px; font-weight: 800; letter-spacing: 1px; }" +
    ".platform { font-size: 20px; font-weight: 700; }" +
    ".siparis { font-size: 28px; font-weight: 800; margin-bottom: 20px; }" +
    ".kargo { font-size: 20px; font-weight: 700; margin-bottom: 20px; }" +
    ".adres { border: 2px solid #111; padding: 18px; margin-bottom: 20px; }" +
    ".adres-baslik { font-size: 15px; font-weight: 700; margin-bottom: 10px; }" +
    ".musteri { font-size: 24px; font-weight: 800; margin-bottom: 10px; }" +
    ".adres-text { font-size: 18px; line-height: 1.5; }" +
    ".urunler { border-top: 2px solid #111; border-bottom: 2px solid #111; padding: 15px 0; margin-bottom: 20px; font-size: 16px; line-height: 1.6; }" +
    ".takip { text-align: center; border: 3px dashed #111; padding: 18px; margin-top: 20px; }" +
    ".takip-baslik { font-size: 15px; font-weight: 700; }" +
    ".takip-no { font-size: 30px; font-weight: 900; letter-spacing: 2px; margin-top: 8px; }" +
    ".footer { margin-top: 20px; display: flex; justify-content: space-between; font-size: 13px; }" +
    "@media print { body { padding: 0; } .etiket { border: 3px solid #111; max-width: none; } }" +
    "</style></head><body>" +
    "<div class='etiket'>" +
    "<div class='baslik'><div class='logo'>ALYA ERP</div><div class='platform'>TRENDYOL</div></div>" +
    "<div class='siparis'>SİPARİŞ NO: " + (siparis.orderNumber || "-") + "</div>" +
    "<div class='kargo'>KARGO: " + kargo + "</div>" +
    "<div class='adres'>" +
    "<div class='adres-baslik'>TESLİMAT ADRESİ</div>" +
    "<div class='musteri'>" + (musteri || "-") + "</div>" +
    "<div class='adres-text'>" +
    (adres.address1 || "") + "<br>" +
    (adres.address2 || "") + "<br>" +
    (adres.neighborhood || "") + "<br>" +
    (adres.district || "") + " / " + (adres.city || "") + "<br>" +
    (adres.postalCode || "") +
    "</div></div>" +
    "<div class='urunler'><strong>ÜRÜNLER</strong><br><br>" + (urunler || "-") + "</div>" +
    "<div class='takip'><div class='takip-baslik'>KARGO TAKİP NUMARASI</div><div class='takip-no'>" + takip + "</div></div>" +
    "<div class='footer'><span>Fatura: " + (siparis.faturaTipi || "Belirtilmedi") + "</span><span>ALYA ERP</span></div>" +
    "</div>" +
    "<script>window.onload = function() { window.print(); };</script>" +
    "</body></html>"
  );

  etiketWindow.document.close();
};

const PlatformImportPage = () => {
  const [dosyaAdi, setDosyaAdi] = useState("");
  const [onizlemeSatirlari, setOnizlemeSatirlari] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [sonuc, setSonuc] = useState(null);

  const [trendyolSiparisler, setTrendyolSiparisler] = useState([]);
  const [trendyolYukleniyor, setTrendyolYukleniyor] = useState(false);
  const [trendyolHata, setTrendyolHata] = useState("");
  const [trendyolAcik, setTrendyolAcik] = useState(true);

  const [seciliSiparis, setSeciliSiparis] = useState(null);
  const [senkronYukleniyor, setSenkronYukleniyor] = useState(false);

  const trendyolSiparisleriniGetir = async () => {
    setTrendyolYukleniyor(true);
    setTrendyolHata("");
    try {
      const res = await axios.get(API_URL + "/platformlar/trendyol/siparisler", {
        params: { size: 50 }
      });
      const liste = Array.isArray(res.data && res.data.content) ? res.data.content : [];
      setTrendyolSiparisler(
        liste.map((siparis) => ({
          ...siparis,
          faturaTipi: siparis.faturaTipi || "E-Arşiv",
          seciliKargo: siparis.seciliKargo || siparis.cargoProviderName || "PTT Kargo Marketplace"
        }))
      );
    } catch (err) {
      console.error("Trendyol siparişleri alınamadı:", err);
      const mesaj =
        (err.response && err.response.data && (err.response.data.detail || err.response.data.error)) ||
        err.message ||
        "Trendyol siparişleri alınamadı.";
      setTrendyolHata(mesaj);
    } finally {
      setTrendyolYukleniyor(false);
    }
  };

  const faturaTipiDegistir = (shipmentPackageId, tip) => {
    setTrendyolSiparisler((onceki) =>
      onceki.map((siparis) =>
        String(siparis.shipmentPackageId) === String(shipmentPackageId)
          ? { ...siparis, faturaTipi: tip }
          : siparis
      )
    );
    if (seciliSiparis && String(seciliSiparis.shipmentPackageId) === String(shipmentPackageId)) {
      setSeciliSiparis((onceki) => ({ ...onceki, faturaTipi: tip }));
    }
  };

  const kargoDegistir = (shipmentPackageId, kargo) => {
    setTrendyolSiparisler((onceki) =>
      onceki.map((siparis) =>
        String(siparis.shipmentPackageId) === String(shipmentPackageId)
          ? { ...siparis, seciliKargo: kargo }
          : siparis
      )
    );
    if (seciliSiparis && String(seciliSiparis.shipmentPackageId) === String(shipmentPackageId)) {
      setSeciliSiparis((onceki) => ({ ...onceki, seciliKargo: kargo }));
    }
  };

  const trendyolSiparisAktar = async (siparis) => {
    setSenkronYukleniyor(true);
    try {
      await axios.post(API_URL + "/platformlar/trendyol/senkronize", {
        packages: [
          {
            ...siparis,
            faturaTipi: siparis.faturaTipi || "E-Arşiv",
            seciliKargo: siparis.seciliKargo || siparis.cargoProviderName
          }
        ]
      });
      alert("Trendyol " + siparis.orderNumber + " numaralı sipariş ALYA ERP'ye aktarıldı.");
    } catch (err) {
      console.error(err);
      alert(
        "Sipariş aktarılırken hata oluştu: " +
          ((err.response && err.response.data && (err.response.data.detail || err.response.data.error)) || err.message)
      );
    } finally {
      setSenkronYukleniyor(false);
    }
  };

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

      rows.forEach((row) => {
        const siparisNo = String(
          bulKolon(row, KOLON_ESLESTIRME.siparisNo) ||
            "PLT-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6)
        );

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
          birimFiyat: Number(bulKolon(row, KOLON_ESLESTIRME.fiyat)) || 0
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

    const siparisler = onizlemeSatirlari.map((g) => ({
      form: {
        siparisKodu: "PLT-" + g.siparisNo,
        siparisTarihi: normalizeTarih(g.tarih),
        siparisTipi: "YENİ SİPARİŞ",
        siparisVeren: (g.platform || "").toString().toUpperCase(),
        cariAdi: g.musteri
      },
      items: g.items.map((it) => ({
        ...it,
        satirToplam: Number(it.miktar) * Number(it.birimFiyat)
      }))
    }));

    try {
      const res = await axios.post(API_URL + "/siparisler/toplu-import", { siparisler });
      setSonuc(res.data);
      setOnizlemeSatirlari([]);
      setDosyaAdi("");
    } catch (err) {
      alert("İçe aktarma sırasında hata oluştu: " + ((err.response && err.response.data && err.response.data.error) || err.message));
    } finally {
      setYukleniyor(false);
    }
  };

  return (
    <div className="pim-container">
      {/* TRENDYOL CANLI SİPARİŞLER */}
      <div className="pim-card">
        <div
          className="pim-header"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
          onClick={() => setTrendyolAcik(!trendyolAcik)}
        >
          <span>🛒 Trendyol Canlı Siparişler</span>
          <span>{trendyolAcik ? "▲" : "▼"}</span>
        </div>

        {trendyolAcik && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <div>
                <strong>Trendyol Mağazası</strong>
                <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>Canlı API bağlantısı</div>
              </div>
              <button className="pim-btn-import" onClick={trendyolSiparisleriniGetir} disabled={trendyolYukleniyor}>
                {trendyolYukleniyor ? "Siparişler getiriliyor..." : "🔄 Siparişleri Getir"}
              </button>
            </div>

            {trendyolHata && (
              <div style={{ padding: "12px", marginBottom: "15px", borderRadius: "8px", background: "#fee2e2", color: "#991b1b" }}>
                <strong>Trendyol Hatası:</strong> {trendyolHata}
              </div>
            )}

            {trendyolSiparisler.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table className="pim-table">
                  <thead>
                    <tr>
                      <th>Sipariş</th>
                      <th>Müşteri</th>
                      <th>Ürün</th>
                      <th>Tutar</th>
                      <th>Durum</th>
                      <th>Kargo</th>
                      <th>Fatura</th>
                      <th>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trendyolSiparisler.map((siparis) => {
                      const ilkUrun = siparis.lines && siparis.lines[0];
                      const urunSayisi =
                        (siparis.lines &&
                          siparis.lines.reduce((toplam, line) => toplam + Number(line.quantity || 0), 0)) ||
                        0;

                      return (
                        <tr key={siparis.shipmentPackageId}>
                          <td>
                            <strong>{siparis.orderNumber}</strong>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                              {tarihFormatla(siparis.orderDate)}
                            </div>
                          </td>
                          <td>
                            {siparis.customerFirstName} {siparis.customerLastName}
                          </td>
                          <td>
                            <strong>{(ilkUrun && ilkUrun.merchantSku) || "-"}</strong>
                            <div style={{ fontSize: "12px", maxWidth: "240px" }}>{(ilkUrun && ilkUrun.productName) || "-"}</div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{urunSayisi} adet</div>
                          </td>
                          <td>{paraFormatla(siparis.packageTotalPrice || siparis.totalPrice)}</td>
                          <td>
                            <span className={durumClass(siparis.status)}>{durumYazisi(siparis.status)}</span>
                          </td>
                          <td>
                            <select
                              value={siparis.seciliKargo || siparis.cargoProviderName || ""}
                              onChange={(e) => kargoDegistir(siparis.shipmentPackageId, e.target.value)}
                              style={{ minWidth: "160px", padding: "7px", borderRadius: "6px", border: "1px solid #ccc" }}
                            >
                              <option value="PTT Kargo Marketplace">PTT Kargo Marketplace</option>
                              <option value="Yurtiçi Kargo">Yurtiçi Kargo</option>
                              <option value="MNG Kargo">MNG Kargo</option>
                              <option value="Aras Kargo">Aras Kargo</option>
                              <option value="Sürat Kargo">Sürat Kargo</option>
                              <option value="UPS">UPS</option>
                              <option value="DHL">DHL</option>
                            </select>
                          </td>
                          <td>
                            <select
                              value={siparis.faturaTipi || "E-Arşiv"}
                              onChange={(e) => faturaTipiDegistir(siparis.shipmentPackageId, e.target.value)}
                              style={{ minWidth: "110px", padding: "7px", borderRadius: "6px", border: "1px solid #ccc" }}
                            >
                              <option value="E-Fatura">E-Fatura</option>
                              <option value="E-Arşiv">E-Arşiv</option>
                            </select>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                              <button
                                onClick={() => setSeciliSiparis(siparis)}
                                style={{ padding: "7px 10px", borderRadius: "6px", border: "1px solid #ccc", cursor: "pointer" }}
                              >
                                Detay
                              </button>
                              <button
                                onClick={() => kargoEtiketiYazdir(siparis)}
                                style={{ padding: "7px 10px", borderRadius: "6px", border: "1px solid #ccc", cursor: "pointer" }}
                              >
                                🖨️ Etiket
                              </button>
                              <button
                                className="pim-btn-import"
                                onClick={() => trendyolSiparisAktar(siparis)}
                                disabled={senkronYukleniyor}
                                style={{ padding: "7px 10px" }}
                              >
                                ALYA'YA AKTAR
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!trendyolYukleniyor && trendyolSiparisler.length === 0 && !trendyolHata && (
              <div style={{ padding: "25px", textAlign: "center", color: "var(--text-muted)" }}>
                Siparişleri görmek için <strong>Siparişleri Getir</strong> butonuna basın.
              </div>
            )}
          </>
        )}
      </div>

      {/* SİPARİŞ DETAY MODALI */}
      {seciliSiparis && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={() => setSeciliSiparis(null)}
        >
          <div
            style={{ background: "#fff", width: "min(1100px, 95vw)", maxHeight: "90vh", overflowY: "auto", borderRadius: "12px", padding: "25px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ margin: 0 }}>Trendyol Sipariş Detayı</h2>
              <button
                onClick={() => setSeciliSiparis(null)}
                style={{ fontSize: "22px", border: "none", background: "transparent", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "12px", marginBottom: "20px" }}>
              <div>
                <strong>Sipariş No</strong>
                <br />
                {seciliSiparis.orderNumber}
              </div>
              <div>
                <strong>Müşteri</strong>
                <br />
                {seciliSiparis.customerFirstName} {seciliSiparis.customerLastName}
              </div>
              <div>
                <strong>Tutar</strong>
                <br />
                {paraFormatla(seciliSiparis.packageTotalPrice)}
              </div>
              <div>
                <strong>Durum</strong>
                <br />
                {durumYazisi(seciliSiparis.status)}
              </div>
              <div>
                <strong>Fatura</strong>
                <br />
                <select
                  value={seciliSiparis.faturaTipi || "E-Arşiv"}
                  onChange={(e) => faturaTipiDegistir(seciliSiparis.shipmentPackageId, e.target.value)}
                  style={{ padding: "7px", marginTop: "5px" }}
                >
                  <option value="E-Fatura">E-Fatura</option>
                  <option value="E-Arşiv">E-Arşiv</option>
                </select>
              </div>
              <div>
                <strong>Kargo</strong>
                <br />
                <select
                  value={seciliSiparis.seciliKargo || seciliSiparis.cargoProviderName || ""}
                  onChange={(e) => kargoDegistir(seciliSiparis.shipmentPackageId, e.target.value)}
                  style={{ padding: "7px", marginTop: "5px" }}
                >
                  <option value="PTT Kargo Marketplace">PTT Kargo Marketplace</option>
                  <option value="Yurtiçi Kargo">Yurtiçi Kargo</option>
                  <option value="MNG Kargo">MNG Kargo</option>
                  <option value="Aras Kargo">Aras Kargo</option>
                  <option value="Sürat Kargo">Sürat Kargo</option>
                  <option value="UPS">UPS</option>
                  <option value="DHL">DHL</option>
                </select>
              </div>
            </div>

            <hr />
            <h3>Teslimat Adresi</h3>
            <div style={{ background: "#f7f7f7", padding: "15px", borderRadius: "8px", lineHeight: "1.6" }}>
              <strong>{seciliSiparis.shipmentAddress && seciliSiparis.shipmentAddress.fullName}</strong>
              <br />
              {seciliSiparis.shipmentAddress && seciliSiparis.shipmentAddress.address1}
              <br />
              {seciliSiparis.shipmentAddress && seciliSiparis.shipmentAddress.neighborhood}
              <br />
              {seciliSiparis.shipmentAddress && seciliSiparis.shipmentAddress.district} /{" "}
              {seciliSiparis.shipmentAddress && seciliSiparis.shipmentAddress.city}
            </div>

            <h3>Ürünler</h3>
            <table className="pim-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Ürün</th>
                  <th>Adet</th>
                  <th>Birim Fiyat</th>
                  <th>Toplam</th>
                </tr>
              </thead>
              <tbody>
                {(seciliSiparis.lines || []).map((line) => (
                  <tr key={line.lineId}>
                    <td>{line.merchantSku || line.stockCode || "-"}</td>
                    <td>{line.productName || "-"}</td>
                    <td>{line.quantity || 0}</td>
                    <td>{paraFormatla(line.lineUnitPrice || line.price)}</td>
                    <td>{paraFormatla(Number(line.quantity || 0) * Number(line.lineUnitPrice || line.price || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: "20px", display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button onClick={() => kargoEtiketiYazdir(seciliSiparis)} className="pim-btn-import">
                🖨️ Kargo Etiketi Yazdır
              </button>
              <button onClick={() => trendyolSiparisAktar(seciliSiparis)} className="pim-btn-import" disabled={senkronYukleniyor}>
                ALYA'YA AKTAR
              </button>
              <button
                onClick={() => setSeciliSiparis(null)}
                style={{ padding: "10px 18px", borderRadius: "7px", border: "1px solid #ccc", cursor: "pointer" }}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXCEL / CSV AKTARIM */}
      <div className="pim-card">
        <div className="pim-header">📦 Platform Siparişlerini İçe Aktar</div>
        <p className="pim-desc">
          Trendyol, Hepsiburada, N11, Amazon vb. platformlardan indirdiğin sipariş dökümünü Excel/CSV olarak yükleyebilirsin.
        </p>

        <div className="pim-upload-box">
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleDosyaSec} id="pim-file" style={{ display: "none" }} />
          <label htmlFor="pim-file" className="pim-upload-btn">
            📁 Dosya Seç (.xlsx / .csv)
          </label>
          {dosyaAdi && <span className="pim-filename">{dosyaAdi}</span>}
        </div>

        {onizlemeSatirlari.length > 0 && (
          <>
            <div className="pim-subheader">Önizleme — {onizlemeSatirlari.length} sipariş bulundu</div>
            <table className="pim-table">
              <thead>
                <tr>
                  <th>Sipariş No</th>
                  <th>Platform</th>
                  <th>Müşteri</th>
                  <th>Ürün Sayısı</th>
                  <th>Toplam</th>
                </tr>
              </thead>
              <tbody>
                {onizlemeSatirlari.slice(0, 20).map((g, idx) => (
                  <tr key={idx}>
                    <td>{g.siparisNo}</td>
                    <td>{g.platform}</td>
                    <td>{g.musteri}</td>
                    <td>{g.items.length}</td>
                    <td>{g.items.reduce((a, it) => a + it.miktar * it.birimFiyat, 0).toLocaleString("tr-TR")} TL</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {onizlemeSatirlari.length > 20 && (
              <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>...ve {onizlemeSatirlari.length - 20} sipariş daha</p>
            )}
            <div className="pim-form-footer">
              <button className="pim-btn-import" onClick={handleIceAktar} disabled={yukleniyor}>
                {yukleniyor ? "İçe aktarılıyor..." : onizlemeSatirlari.length + " Siparişi İçe Aktar"}
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
          ℹ️ Not: Excel/CSV aktarımı mevcut manuel aktarım sistemini kullanır. Trendyol bölümü ise canlı API üzerinden siparişleri getirir.
        </div>
      </div>
    </div>
  );
};

export default PlatformImportPage;
