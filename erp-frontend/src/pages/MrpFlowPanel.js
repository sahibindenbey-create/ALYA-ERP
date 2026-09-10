import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./MrpFlowPanel.css";

const API = `${process.env.REACT_APP_API_URL || "http://localhost:5000/api"}/mrp-flow`;
const today = new Date().toISOString().slice(0, 10);

export default function MrpFlowPanel() {
  const [data, setData] = useState({
    requests: [],
    plans: [],
    purchaseRequests: [],
    recipes: [],
  });
  const [form, setForm] = useState({
    recipeId: "",
    quantity: "",
    dueDate: today,
    priority: "Normal",
    description: "",
  });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setError("");
      const result = await axios.get(`${API}/overview`);
      setData(result.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const stats = useMemo(
    () => ({
      requests: data.requests.length,
      shortages: data.plans.reduce(
        (sum, p) => sum + Number(p.EksikKalem || 0),
        0,
      ),
      ready: data.plans.filter((p) => p.Durum === "Üretime Hazır").length,
      purchasing: data.purchaseRequests.length,
    }),
    [data],
  );
  const createRequest = async () => {
    try {
      setBusy("create");
      setError("");
      const { data: result } = await axios.post(`${API}/requests`, {
        ...form,
        recipeId: Number(form.recipeId),
        quantity: Number(form.quantity),
      });
      window.alert(`${result.requestNo} numaralı üretim talebi oluşturuldu.`);
      setForm((x) => ({ ...x, quantity: "", description: "" }));
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy("");
    }
  };
  const run = async (path, key, success) => {
    try {
      setBusy(key);
      setError("");
      const { data: result } = await axios.post(`${API}${path}`);
      window.alert(success(result));
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="mrp-page">
      <header className="mrp-hero">
        <div>
          <small>ÜRETİM PLANLAMA MERKEZİ</small>
          <h2>Üretim Talebi → MRP → Satın Alma Talebi</h2>
          <p>
            Çok seviyeli reçete, fire, verim ve kullanılabilir stok birlikte
            hesaplanır.
          </p>
        </div>
        <button onClick={load}>Yenile</button>
      </header>
      {error && <div className="mrp-error">{error}</div>}
      <section className="mrp-kpis">
        <article>
          <span>Üretim talebi</span>
          <b>{stats.requests}</b>
        </article>
        <article>
          <span>Eksik malzeme</span>
          <b>{stats.shortages}</b>
        </article>
        <article>
          <span>Üretime hazır</span>
          <b>{stats.ready}</b>
        </article>
        <article>
          <span>Satın alma talebi</span>
          <b>{stats.purchasing}</b>
        </article>
      </section>
      <section className="mrp-create">
        <div>
          <h3>Yeni üretim talebi</h3>
          <p>Aktif reçete ve hedef üretim miktarını seçin.</p>
        </div>
        <label>
          Reçete
          <select
            value={form.recipeId}
            onChange={(e) => setForm({ ...form, recipeId: e.target.value })}
          >
            <option value="">Seçin</option>
            {data.recipes.map((r) => (
              <option key={r.ReceteId} value={r.ReceteId}>
                {r.MamulAdi} · #{r.ReceteId}
              </option>
            ))}
          </select>
        </label>
        <label>
          Miktar
          <input
            type="number"
            min="0.0001"
            step="0.01"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          />
        </label>
        <label>
          İhtiyaç tarihi
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />
        </label>
        <label>
          Öncelik
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
          >
            <option>Düşük</option>
            <option>Normal</option>
            <option>Yüksek</option>
            <option>Acil</option>
          </select>
        </label>
        <button
          disabled={!!busy || !form.recipeId || !form.quantity}
          onClick={createRequest}
        >
          Talep Oluştur
        </button>
      </section>
      <section className="mrp-grid">
        <div className="mrp-card">
          <div className="mrp-title">
            <h3>Üretim talepleri</h3>
            <span>{data.requests.length} kayıt</span>
          </div>
          {data.requests.map((x) => (
            <article className="mrp-row" key={x.TalepId}>
              <div>
                <strong>{x.TalepNo}</strong>
                <span>
                  {x.UrunKodu} · {x.UrunAdi}
                </span>
                <small>
                  {Number(x.TalepMiktari)} birim · {x.Oncelik} ·{" "}
                  {new Date(x.IhtiyacTarihi).toLocaleDateString("tr-TR")}
                </small>
              </div>
              <i>{x.Durum}</i>
              <button
                disabled={!!busy || x.Durum !== "Yeni"}
                onClick={() =>
                  run(
                    `/requests/${x.TalepId}/plan`,
                    `plan-${x.TalepId}`,
                    (r) =>
                      `${r.planNo}: ${r.itemCount} ihtiyaç, ${r.shortageCount} eksik.`,
                  )
                }
              >
                MRP Çalıştır
              </button>
            </article>
          ))}
          {!data.requests.length && (
            <div className="mrp-empty">Üretim talebi yok.</div>
          )}
        </div>
        <div className="mrp-card">
          <div className="mrp-title">
            <h3>MRP planları</h3>
            <span>{data.plans.length} plan</span>
          </div>
          {data.plans.map((p) => (
            <article className="mrp-plan" key={p.PlanId}>
              <div className="mrp-plan-head">
                <div>
                  <strong>{p.PlanNo}</strong>
                  <span>{p.TalepNo}</span>
                </div>
                <i className={p.EksikKalem ? "short" : "ready"}>{p.Durum}</i>
              </div>
              <div className="mrp-plan-stats">
                <span>
                  Kalem <b>{p.ToplamKalem}</b>
                </span>
                <span>
                  Eksik <b>{p.EksikKalem}</b>
                </span>
                <span>
                  Miktar <b>{Number(p.PlanlananMiktar)}</b>
                </span>
              </div>
              <details>
                <summary>Malzeme ihtiyaçları</summary>
                <table>
                  <thead>
                    <tr>
                      <th>Malzeme</th>
                      <th>Brüt</th>
                      <th>Mevcut</th>
                      <th>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.needs.map((n) => (
                      <tr key={n.IhtiyacId}>
                        <td>
                          {n.UrunAdi}
                          <small>{n.DepoAdi}</small>
                        </td>
                        <td>{Number(n.BrutIhtiyac).toFixed(2)}</td>
                        <td>
                          {Number(n.MevcutStok - n.RezerveStok).toFixed(2)}
                        </td>
                        <td
                          className={
                            Number(n.NetIhtiyac) > 0 ? "danger" : "success"
                          }
                        >
                          {Number(n.NetIhtiyac).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
              <button
                disabled={
                  !!busy ||
                  !p.EksikKalem ||
                  p.Durum === "Satın Alma Talebi Oluştu"
                }
                onClick={() =>
                  run(
                    `/plans/${p.PlanId}/purchase-request`,
                    `buy-${p.PlanId}`,
                    (r) =>
                      `${r.purchaseRequestNo}: ${r.itemCount} satın alma kalemi oluşturuldu.`,
                  )
                }
              >
                Satın Alma Talebi Oluştur
              </button>
            </article>
          ))}
          {!data.plans.length && (
            <div className="mrp-empty">Henüz MRP planı yok.</div>
          )}
        </div>
      </section>
    </div>
  );
}
