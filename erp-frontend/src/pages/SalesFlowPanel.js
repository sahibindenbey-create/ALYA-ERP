import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import "./SalesFlowPanel.css";

const API = `${process.env.REACT_APP_API_URL || "http://localhost:5000/api"}/sales-flow`;

export default function SalesFlowPanel() {
  const [orders, setOrders] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setError("");
      const { data } = await axios.get(`${API}/orders`);
      setOrders(data.orders || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const run = async (id, action) => {
    if (action === "reserve" && !warehouseId)
      return setError("Rezervasyon için depo kimliği girin.");
    try {
      setBusy(`${id}-${action}`);
      setError("");
      const body =
        action === "reserve" ? { warehouseId: Number(warehouseId) } : {};
      const { data } = await axios.post(`${API}/orders/${id}/${action}`, body);
      window.alert(
        action === "reserve"
          ? `${data.reserved} birim rezerve edildi.`
          : `${data.dispatchNo} numaralı irsaliye oluşturuldu.`,
      );
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy("");
    }
  };
  const total = orders.reduce((a, o) => a + Number(o.ToplamTutar || 0), 0);
  return (
    <div className="sf-page">
      <header>
        <div>
          <small>SATIŞ OPERASYON MERKEZİ</small>
          <h2>Sipariş → Rezervasyon → Sevkiyat</h2>
          <p>Kaynak belge bağlantılı, şirket ve dönem kontrollü süreç.</p>
        </div>
        <button onClick={load}>Yenile</button>
      </header>
      {error && <div className="sf-error">{error}</div>}
      <section className="sf-kpis">
        <article>
          <span>Açık sipariş</span>
          <b>{orders.length}</b>
        </article>
        <article>
          <span>Toplam tutar</span>
          <b>{total.toLocaleString("tr-TR")} ₺</b>
        </article>
        <article>
          <span>Sevk bekleyen</span>
          <b>
            {
              orders.filter(
                (o) => Number(o.SevkEdilenMiktar) < Number(o.SiparisMiktari),
              ).length
            }
          </b>
        </article>
      </section>
      <section className="sf-toolbar">
        <label>
          Çıkış deposu kimliği{" "}
          <input
            type="number"
            min="1"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            placeholder="Örn. 1"
          />
        </label>
        <span>Rezervasyon uygun lokasyonlara otomatik dağıtılır.</span>
      </section>
      <section className="sf-list">
        {orders.map((o) => {
          const pct = Number(o.SiparisMiktari)
            ? Math.round(
                (Number(o.SevkEdilenMiktar) / Number(o.SiparisMiktari)) * 100,
              )
            : 0;
          return (
            <article className="sf-order" key={o.SiparisId}>
              <div className="sf-order-head">
                <div>
                  <strong>{o.SiparisKodu}</strong>
                  <span>{o.CariAdi}</span>
                </div>
                <div className="sf-badges">
                  <i>{o.Durum || "YENİ"}</i>
                  <i>{o.RezervasyonDurumu}</i>
                </div>
              </div>
              <div className="sf-progress">
                <span style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
              <div className="sf-meta">
                <span>
                  Sipariş: <b>{Number(o.SiparisMiktari)}</b>
                </span>
                <span>
                  Rezerve: <b>{Number(o.RezerveMiktar)}</b>
                </span>
                <span>
                  Sevk: <b>{Number(o.SevkEdilenMiktar)}</b>
                </span>
                <span>
                  Tutar:{" "}
                  <b>{Number(o.ToplamTutar || 0).toLocaleString("tr-TR")} ₺</b>
                </span>
              </div>
              <details>
                <summary>{o.lines.length} ürün satırı</summary>
                <table>
                  <thead>
                    <tr>
                      <th>Ürün</th>
                      <th>Sipariş</th>
                      <th>Rezerve</th>
                      <th>Sevk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.lines.map((l) => (
                      <tr key={l.SiparisDetayId}>
                        <td>
                          {l.UrunKodu} · {l.UrunAdi}
                        </td>
                        <td>{Number(l.Miktar)}</td>
                        <td>{Number(l.RezerveMiktar)}</td>
                        <td>{Number(l.SevkEdilenMiktar)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
              <footer>
                <button
                  disabled={!!busy || o.RezervasyonDurumu === "Tam"}
                  onClick={() => run(o.SiparisId, "reserve")}
                >
                  Stok Rezerve Et
                </button>
                <button
                  className="primary"
                  disabled={!!busy || !Number(o.RezerveMiktar)}
                  onClick={() => run(o.SiparisId, "dispatch")}
                >
                  İrsaliye Oluştur
                </button>
              </footer>
            </article>
          );
        })}
        {!orders.length && (
          <div className="sf-empty">Açık satış siparişi bulunamadı.</div>
        )}
      </section>
    </div>
  );
}
