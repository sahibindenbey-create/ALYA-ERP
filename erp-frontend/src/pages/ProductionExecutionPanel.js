import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./ProductionExecutionPanel.css";

const API = `${process.env.REACT_APP_API_URL || "http://localhost:5000/api"}/production-execution`;

export default function ProductionExecutionPanel() {
  const [data, setData] = useState({
    plans: [],
    orders: [],
    locations: [],
    completions: [],
  });
  const [locationKey, setLocationKey] = useState("");
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
      available: data.plans.filter(
        (x) => !data.orders.some((o) => o.MRPPlanId === x.PlanId),
      ).length,
      released: data.orders.filter((x) => x.Durum === "Serbest").length,
      active: data.orders.filter((x) => x.Durum === "Üretimde").length,
      complete: data.orders.filter((x) => x.Durum === "Tamamlandı").length,
    }),
    [data],
  );
  const run = async (path, key, body, success) => {
    try {
      setBusy(key);
      setError("");
      const { data: result } = await axios.post(`${API}${path}`, body);
      window.alert(success(result));
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy("");
    }
  };
  const release = (plan) => {
    const location = data.locations.find(
      (x) => `${x.DepoId}:${x.LokasyonId}` === locationKey,
    );
    if (!location)
      return setError("Mamul girişi için hedef depo/lokasyon seçin.");
    return run(
      `/plans/${plan.PlanId}/orders`,
      `release-${plan.PlanId}`,
      {
        targetWarehouseId: location.DepoId,
        targetLocationId: location.LokasyonId,
      },
      (r) => `${r.orderNo}: ${r.materialCount} hammadde kalemi rezerve edildi.`,
    );
  };
  const complete = (order) => {
    const quantityText = window.prompt(
      "Sağlam üretilen mamul miktarı",
      Number(order.PlanlananMiktar).toString(),
    );
    if (quantityText === null) return;
    const producedQty = Number(String(quantityText).replace(",", "."));
    const lotNo = window.prompt("Mamul lot numarası (opsiyonel)", "") || "";
    const qualityStatus = window.confirm(
      "Mamul kalite kontrol beklesin mi? Beklemesi için Tamam, doğrudan onay için İptal.",
    )
      ? "Beklemede"
      : "Onaylı";
    return run(
      `/orders/${order.EmirId}/complete`,
      `complete-${order.EmirId}`,
      { producedQty, lotNo, qualityStatus, operationKey: crypto.randomUUID() },
      (r) =>
        `${r.completionNo}: ${r.producedQty} mamul, ${r.scrapQty} fire kaydedildi.`,
    );
  };
  return (
    <div className="pe-page">
      <header className="pe-hero">
        <div>
          <small>ÜRETİM YÜRÜTME MERKEZİ</small>
          <h2>MRP → Üretim Emri → Sarf → Mamul Stok</h2>
          <p>
            Hammadde rezervasyonundan mamul depo girişine kadar tek işlem
            zinciri.
          </p>
        </div>
        <button onClick={load}>Yenile</button>
      </header>
      {error && <div className="pe-error">{error}</div>}
      <section className="pe-kpis">
        <article>
          <span>Emre hazır plan</span>
          <b>{stats.available}</b>
        </article>
        <article>
          <span>Serbest emir</span>
          <b>{stats.released}</b>
        </article>
        <article>
          <span>Üretimde</span>
          <b>{stats.active}</b>
        </article>
        <article>
          <span>Tamamlanan</span>
          <b>{stats.complete}</b>
        </article>
      </section>
      <section className="pe-toolbar">
        <label>
          Mamul hedef depo/lokasyonu
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
        <span>
          Hammaddeler uygun stok bakiye satırlarından otomatik rezerve edilir.
        </span>
      </section>
      <section className="pe-grid">
        <div className="pe-card">
          <h3>MRP planları</h3>
          {data.plans.map((p) => {
            const order = data.orders.find((o) => o.MRPPlanId === p.PlanId);
            return (
              <article className="pe-item" key={p.PlanId}>
                <div>
                  <strong>{p.PlanNo}</strong>
                  <span>
                    {p.UrunKodu} · {p.UrunAdi}
                  </span>
                  <small>
                    {Number(p.TalepMiktari)} birim · {p.Durum}
                  </small>
                </div>
                <button disabled={!!busy || !!order} onClick={() => release(p)}>
                  {order ? "Emir Açıldı" : "Üretim Emri Aç"}
                </button>
              </article>
            );
          })}
          {!data.plans.length && (
            <p className="pe-empty">MRP planı bulunamadı.</p>
          )}
        </div>
        <div className="pe-card">
          <h3>Üretim emirleri</h3>
          {data.orders.map((o) => (
            <article className="pe-order" key={o.EmirId}>
              <div className="pe-head">
                <div>
                  <strong>{o.EmirNo}</strong>
                  <span>
                    {o.UrunKodu} · {o.UrunAdi}
                  </span>
                </div>
                <i
                  className={
                    o.Durum === "Tamamlandı"
                      ? "done"
                      : o.Durum === "Üretimde"
                        ? "active"
                        : "released"
                  }
                >
                  {o.Durum}
                </i>
              </div>
              <div className="pe-facts">
                <span>
                  Plan <b>{Number(o.PlanlananMiktar)}</b>
                </span>
                <span>
                  Üretilen <b>{Number(o.UretilenMiktar)}</b>
                </span>
                <span>
                  Fire <b>{Number(o.FireMiktari)}</b>
                </span>
                <span>
                  Malzeme <b>{o.materials.length}</b>
                </span>
              </div>
              <details>
                <summary>Hammadde rezervasyonları</summary>
                <table>
                  <thead>
                    <tr>
                      <th>Malzeme</th>
                      <th>Gerekli</th>
                      <th>Rezerve</th>
                      <th>Tüketilen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.materials.map((m) => (
                      <tr key={m.MalzemeId}>
                        <td>{m.UrunAdi}</td>
                        <td>{Number(m.GerekliMiktar)}</td>
                        <td>{Number(m.RezerveMiktar)}</td>
                        <td>{Number(m.TuketilenMiktar)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
              <footer>
                {o.Durum === "Serbest" && (
                  <button
                    disabled={!!busy}
                    onClick={() =>
                      run(
                        `/orders/${o.EmirId}/start`,
                        `start-${o.EmirId}`,
                        {},
                        (r) => `${r.EmirNo} üretime başlatıldı.`,
                      )
                    }
                  >
                    Üretimi Başlat
                  </button>
                )}
                {o.Durum === "Üretimde" && (
                  <button
                    className="complete"
                    disabled={!!busy}
                    onClick={() => complete(o)}
                  >
                    Üretimi Tamamla
                  </button>
                )}
              </footer>
            </article>
          ))}
          {!data.orders.length && (
            <p className="pe-empty">Üretim emri bulunamadı.</p>
          )}
        </div>
      </section>
    </div>
  );
}
