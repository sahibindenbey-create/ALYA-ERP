import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./ProcurementFlowPanel.css";

const API = `${process.env.REACT_APP_API_URL || "http://localhost:5000/api"}/procurement-flow`;
const money = (x) =>
  `${Number(x || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`;

export default function ProcurementFlowPanel() {
  const [data, setData] = useState({
    purchaseRequests: [],
    quotes: [],
    orders: [],
    receipts: [],
    locations: [],
  });
  const [locationKey, setLocationKey] = useState("");
  const [qualityStatus, setQualityStatus] = useState("Onaylı");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setError("");
      const response = await axios.get(`${API}/overview`);
      setData(response.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const stats = useMemo(
    () => ({
      requests: data.purchaseRequests.filter(
        (x) => x.Durum !== "Sipariş Oluştu",
      ).length,
      quotes: data.quotes.filter((x) => x.Durum === "Bekliyor").length,
      orders: data.orders.filter((x) => x.Durum !== "Tamamlandı").length,
      receipts: data.receipts.length,
    }),
    [data],
  );
  const createQuote = async (request) => {
    const supplierCode = window.prompt("Tedarikçi kodu");
    if (!supplierCode) return;
    const supplierName = window.prompt("Tedarikçi adı");
    if (!supplierName) return;
    const priceText = window.prompt(
      "Tüm açık kalemler için varsayılan birim fiyat",
      "0",
    );
    if (priceText === null) return;
    const defaultUnitPrice = Number(String(priceText).replace(",", "."));
    try {
      setBusy(`quote-${request.SatinAlmaTalepId}`);
      setError("");
      const { data: result } = await axios.post(
        `${API}/purchase-requests/${request.SatinAlmaTalepId}/quotes`,
        {
          supplierCode,
          supplierName,
          defaultUnitPrice,
          vatRate: 20,
          currency: "TRY",
        },
      );
      window.alert(
        `${result.quoteNo} oluşturuldu. Toplam ${money(result.total)}`,
      );
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy("");
    }
  };
  const approve = async (quote) => {
    if (
      !window.confirm(`${quote.TeklifNo} onaylanıp siparişe dönüştürülsün mü?`)
    )
      return;
    try {
      setBusy(`approve-${quote.TeklifId}`);
      setError("");
      const { data: result } = await axios.post(
        `${API}/quotes/${quote.TeklifId}/approve`,
      );
      window.alert(`${result.orderNo} satın alma siparişi oluşturuldu.`);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy("");
    }
  };
  const receive = async (order) => {
    const selected = data.locations.find(
      (x) => `${x.DepoId}:${x.LokasyonId}` === locationKey,
    );
    if (!selected) return setError("Mal kabul için depo/lokasyon seçin.");
    const waybillNo =
      window.prompt("Tedarikçi irsaliye numarası (opsiyonel)", "") || "";
    if (
      !window.confirm(
        `${order.SiparisNo} siparişinin tüm açık miktarları teslim alınsın mı?`,
      )
    )
      return;
    try {
      setBusy(`receive-${order.SiparisId}`);
      setError("");
      const { data: result } = await axios.post(
        `${API}/orders/${order.SiparisId}/receipts`,
        {
          warehouseId: selected.DepoId,
          locationId: selected.LokasyonId,
          waybillNo,
          qualityStatus,
          operationKey: crypto.randomUUID(),
        },
      );
      window.alert(
        `${result.receiptNo}: ${result.itemCount} kalem stoka alındı.`,
      );
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="pf-page">
      <header className="pf-hero">
        <div>
          <small>SATIN ALMA OPERASYON MERKEZİ</small>
          <h2>Talep → Teklif → Sipariş → Mal Kabul → Stok</h2>
          <p>
            MRP eksiklerinden başlayıp depo/lokasyon stok girişine uzanan
            kontrollü zincir.
          </p>
        </div>
        <button onClick={load}>Yenile</button>
      </header>
      {error && <div className="pf-error">{error}</div>}
      <section className="pf-kpis">
        <article>
          <span>Açık talep</span>
          <b>{stats.requests}</b>
        </article>
        <article>
          <span>Bekleyen teklif</span>
          <b>{stats.quotes}</b>
        </article>
        <article>
          <span>Açık sipariş</span>
          <b>{stats.orders}</b>
        </article>
        <article>
          <span>Mal kabul</span>
          <b>{stats.receipts}</b>
        </article>
      </section>
      <section className="pf-toolbar">
        <label>
          Mal kabul depo/lokasyonu
          <select
            value={locationKey}
            onChange={(e) => setLocationKey(e.target.value)}
          >
            <option value="">Seçin</option>
            {data.locations.map((x) => (
              <option
                key={`${x.DepoId}:${x.LokasyonId}`}
                value={`${x.DepoId}:${x.LokasyonId}`}
              >
                {x.DepoKodu} · {x.DepoAdi} / {x.LokasyonKodu}
              </option>
            ))}
          </select>
        </label>
        <label>
          Kalite durumu
          <select
            value={qualityStatus}
            onChange={(e) => setQualityStatus(e.target.value)}
          >
            <option>Onaylı</option>
            <option>Beklemede</option>
          </select>
        </label>
        <span>Beklemede seçilen mallar stokta bloke edilir.</span>
      </section>
      <section className="pf-columns">
        <div className="pf-card">
          <h3>Satın alma talepleri</h3>
          {data.purchaseRequests.map((x) => (
            <article className="pf-item" key={x.SatinAlmaTalepId}>
              <div>
                <strong>{x.TalepNo}</strong>
                <span>
                  {x.PlanNo} · {x.Durum}
                </span>
                <small>{x.lines.length} malzeme kalemi</small>
              </div>
              <button
                disabled={!!busy || x.Durum === "Sipariş Oluştu"}
                onClick={() => createQuote(x)}
              >
                Teklif Gir
              </button>
            </article>
          ))}
          {!data.purchaseRequests.length && (
            <p className="pf-empty">Talep bulunamadı.</p>
          )}
        </div>
        <div className="pf-card">
          <h3>Tedarikçi teklifleri</h3>
          {data.quotes.map((x) => (
            <article className="pf-item" key={x.TeklifId}>
              <div>
                <strong>{x.TeklifNo}</strong>
                <span>{x.TedarikciAdi}</span>
                <small>
                  {money(x.GenelToplam)} · {x.Durum}
                </small>
              </div>
              <button
                className="blue"
                disabled={!!busy || x.Durum !== "Bekliyor"}
                onClick={() => approve(x)}
              >
                Onayla
              </button>
            </article>
          ))}
          {!data.quotes.length && (
            <p className="pf-empty">Teklif bulunamadı.</p>
          )}
        </div>
      </section>
      <section className="pf-card pf-orders">
        <h3>Satın alma siparişleri</h3>
        {data.orders.map((o) => (
          <article className="pf-order" key={o.SiparisId}>
            <div className="pf-order-head">
              <div>
                <strong>{o.SiparisNo}</strong>
                <span>
                  {o.TedarikciAdi} · {money(o.GenelToplam)}
                </span>
              </div>
              <i className={o.Durum === "Tamamlandı" ? "done" : "open"}>
                {o.Durum}
              </i>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Malzeme</th>
                  <th>Sipariş</th>
                  <th>Alınan</th>
                  <th>Kalan</th>
                </tr>
              </thead>
              <tbody>
                {o.lines.map((x) => (
                  <tr key={x.KalemId}>
                    <td>
                      {x.UrunAdi}
                      <small>{x.HedefDepo}</small>
                    </td>
                    <td>{Number(x.SiparisMiktari)}</td>
                    <td>{Number(x.TeslimAlinanMiktar)}</td>
                    <td>{Number(x.SiparisMiktari - x.TeslimAlinanMiktar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <footer>
              <button
                disabled={!!busy || o.Durum === "Tamamlandı"}
                onClick={() => receive(o)}
              >
                Mal Kabul Yap
              </button>
            </footer>
          </article>
        ))}
        {!data.orders.length && <p className="pf-empty">Sipariş bulunamadı.</p>}
      </section>
    </div>
  );
}
