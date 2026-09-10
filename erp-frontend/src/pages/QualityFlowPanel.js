import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./QualityFlowPanel.css";

const API = `${process.env.REACT_APP_API_URL || "http://localhost:5000/api"}/quality-flow`;

export default function QualityFlowPanel() {
  const [data, setData] = useState({
    pendingReceipts: [],
    inspections: [],
    returns: [],
  });
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
      pending: data.pendingReceipts.length,
      inspection: data.inspections.filter((x) => x.Durum === "Kontrol Bekliyor")
        .length,
      rejected: data.inspections.reduce(
        (sum, x) =>
          sum +
          x.lines.reduce(
            (a, l) =>
              a + Number(l.RedMiktari || 0) - Number(l.IadeMiktari || 0),
            0,
          ),
        0,
      ),
      returns: data.returns.length,
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
  const openInspection = (receipt) =>
    run(
      `/receipts/${receipt.MalKabulId}/inspections`,
      `open-${receipt.MalKabulId}`,
      {},
      (r) =>
        `${r.inspectionNo}: ${r.itemCount} kalem kalite kontrolüne alındı.`,
    );
  const decide = (inspection, mode) => {
    const text =
      mode === "ACCEPT_ALL"
        ? "tüm miktarlar kabul edilsin"
        : "tüm miktarlar reddedilsin";
    if (!window.confirm(`${inspection.KontrolNo}: ${text} mi?`)) return;
    const reason =
      mode === "REJECT_ALL"
        ? window.prompt("Red nedeni", "Kalite kriteri karşılanmadı")
        : "";
    return run(
      `/inspections/${inspection.KaliteKontrolId}/decision`,
      `decision-${inspection.KaliteKontrolId}`,
      { mode, reason },
      (r) => `${r.decision}: ${r.acceptedTotal} kabul, ${r.rejectedTotal} red.`,
    );
  };
  const createReturn = (inspection) => {
    if (
      !window.confirm(
        `${inspection.KontrolNo} reddedilen malları tedarikçiye iade etsin mi?`,
      )
    )
      return;
    const waybillNo =
      window.prompt("İade irsaliye numarası (opsiyonel)", "") || "";
    return run(
      `/inspections/${inspection.KaliteKontrolId}/supplier-return`,
      `return-${inspection.KaliteKontrolId}`,
      { waybillNo, operationKey: crypto.randomUUID() },
      (r) => `${r.returnNo}: ${r.itemCount} kalem stoktan çıkarıldı.`,
    );
  };
  return (
    <div className="qf-page">
      <header className="qf-hero">
        <div>
          <small>KALİTE GÜVENCE MERKEZİ</small>
          <h2>Mal Kabul → Kalite Kontrol → Serbest Bırakma / İade</h2>
          <p>
            Onaylanan stok kullanılabilir olur; reddedilen stok iade edilene
            kadar blokede kalır.
          </p>
        </div>
        <button onClick={load}>Yenile</button>
      </header>
      {error && <div className="qf-error">{error}</div>}
      <section className="qf-kpis">
        <article>
          <span>Kontrol bekleyen kabul</span>
          <b>{stats.pending}</b>
        </article>
        <article>
          <span>Açık kontrol</span>
          <b>{stats.inspection}</b>
        </article>
        <article>
          <span>Blokeli red miktarı</span>
          <b>{stats.rejected}</b>
        </article>
        <article>
          <span>Tedarikçi iadesi</span>
          <b>{stats.returns}</b>
        </article>
      </section>
      <section className="qf-grid">
        <div className="qf-card">
          <h3>Kalite bekleyen mal kabuller</h3>
          {data.pendingReceipts.map((x) => (
            <article className="qf-item" key={x.MalKabulId}>
              <div>
                <strong>{x.MalKabulNo}</strong>
                <span>
                  {x.TedarikciAdi} · {x.SiparisNo}
                </span>
                <small>
                  {x.lines.length} kalem · {x.KaliteDurumu}
                </small>
              </div>
              <button
                disabled={!!busy || x.KaliteKontrolId}
                onClick={() => openInspection(x)}
              >
                Kontrol Aç
              </button>
            </article>
          ))}
          {!data.pendingReceipts.length && (
            <p className="qf-empty">Kalite bekleyen mal kabul yok.</p>
          )}
        </div>
        <div className="qf-card">
          <h3>Kalite kontrolleri</h3>
          {data.inspections.map((x) => {
            const rejected = x.lines.reduce(
              (a, l) =>
                a + Number(l.RedMiktari || 0) - Number(l.IadeMiktari || 0),
              0,
            );
            return (
              <article className="qf-inspection" key={x.KaliteKontrolId}>
                <div className="qf-head">
                  <div>
                    <strong>{x.KontrolNo}</strong>
                    <span>
                      {x.MalKabulNo} · {x.TedarikciAdi}
                    </span>
                  </div>
                  <i className={x.Durum === "Tamamlandı" ? "done" : "waiting"}>
                    {x.Karar || x.Durum}
                  </i>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Malzeme</th>
                      <th>Kontrol</th>
                      <th>Kabul</th>
                      <th>Red</th>
                    </tr>
                  </thead>
                  <tbody>
                    {x.lines.map((l) => (
                      <tr key={l.KalemId}>
                        <td>
                          {l.UrunKodu} · {l.UrunAdi}
                          <small>{l.LotNo || "Lotsuz"}</small>
                        </td>
                        <td>{Number(l.KontrolMiktari)}</td>
                        <td className="success">{Number(l.KabulMiktari)}</td>
                        <td className="danger">
                          {Number(l.RedMiktari) - Number(l.IadeMiktari)} açık
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <footer>
                  {x.Durum === "Kontrol Bekliyor" && (
                    <>
                      <button
                        disabled={!!busy}
                        onClick={() => decide(x, "ACCEPT_ALL")}
                      >
                        Tümünü Kabul Et
                      </button>
                      <button
                        className="reject"
                        disabled={!!busy}
                        onClick={() => decide(x, "REJECT_ALL")}
                      >
                        Tümünü Reddet
                      </button>
                    </>
                  )}
                  {x.Durum === "Tamamlandı" && rejected > 0 && (
                    <button
                      className="return"
                      disabled={!!busy}
                      onClick={() => createReturn(x)}
                    >
                      Tedarikçiye İade
                    </button>
                  )}
                </footer>
              </article>
            );
          })}
          {!data.inspections.length && (
            <p className="qf-empty">Kalite kontrol kaydı yok.</p>
          )}
        </div>
      </section>
    </div>
  );
}
