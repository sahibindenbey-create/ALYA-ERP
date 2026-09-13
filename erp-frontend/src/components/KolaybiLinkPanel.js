import React, { useState } from "react";
import axios from "axios";
const ROOT = process.env.REACT_APP_API_URL || "http:" + "//localhost:5000/api",
  API = `${ROOT}/kolaybi-live/link`;
export default function KolaybiLinkPanel({ enabled }) {
  const [plan, setPlan] = useState(null),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const load = async () => {
    try {
      setBusy("plan");
      setError("");
      const { data } = await axios.get(`${API}/plan`);
      setPlan(data.metrics);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy("");
    }
  };
  const run = async () => {
    if (!window.confirm("Aktarılan KolayBi kayıtları cari, ürün, belge ve finans ilişkileriyle bağlansın mı?")) return;
    try {
      setBusy("run");
      setError("");
      const { data } = await axios.post(`${API}/run`, { confirmation: "YAMANKAYA_LINK_DATA" });
      setMessage(data.message);
      setPlan(data.metrics);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy("");
    }
  };
  return (
    <article className="klive-card">
      <div className="klive-title">
        <div>
          <h2>Verileri birbirine bağla</h2>
          <p>Cari–belge, ürün–satır, kasa/banka–hareket ve fatura–cari defter ilişkilerini kurar; eşleşmeyenleri raporlar.</p>
        </div>
        <div className="klive-actions">
          <button disabled={!enabled || busy} onClick={load}>Bağlantı planı</button>
          <button className="activate" disabled={!plan || busy} onClick={run}>{busy === "run" ? "Bağlanıyor…" : "VERİLERİ BİRBİRİNE BAĞLA"}</button>
        </div>
      </div>
      {error && <div className="klive-error">{/KolaybiLinkRuns|CariId/i.test(error) ? "035_KOLAYBI_RELATION_RECONCILIATION.sql migrationını çalıştırın." : error}</div>}
      {message && <div className="klive-success">{message}</div>}
      {plan && <div className="klive-table"><table><thead><tr><th>İlişki</th><th>Toplam</th><th>Bağlı</th><th>Eşleşmeyen</th></tr></thead><tbody>{Object.entries(plan).map(([key, value]) => <tr key={key}><td>{key}</td><td>{value.total}</td><td>{value.linked}</td><td>{Math.max(0, value.total - value.linked)}</td></tr>)}</tbody></table></div>}
    </article>
  );
}
