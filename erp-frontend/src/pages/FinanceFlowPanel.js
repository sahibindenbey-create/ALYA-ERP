import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./FinanceFlowPanel.css";

const API = `${process.env.REACT_APP_API_URL || "http://localhost:5000/api"}/finance-flow`;

const money = (value) =>
  `${Number(value || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`;

export default function FinanceFlowPanel() {
  const [data, setData] = useState({
    invoices: [],
    balances: [],
    payments: [],
  });
  const [dispatchId, setDispatchId] = useState("");
  const [vatRate, setVatRate] = useState(20);
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
      invoiced: data.invoices.reduce(
        (sum, x) => sum + Number(x.GenelToplam || 0),
        0,
      ),
      open: data.invoices.reduce(
        (sum, x) => sum + Number(x.KalanTutar || 0),
        0,
      ),
      collected: data.invoices.reduce(
        (sum, x) => sum + Number(x.TahsilEdilenTutar || 0),
        0,
      ),
    }),
    [data.invoices],
  );

  const createInvoice = async () => {
    if (!dispatchId) return setError("Faturalanacak irsaliye kimliğini girin.");
    try {
      setBusy("invoice");
      setError("");
      const { data: result } = await axios.post(
        `${API}/dispatches/${dispatchId}/invoice`,
        { vatRate: Number(vatRate) },
      );
      window.alert(`${result.invoiceNo} numaralı fatura oluşturuldu.`);
      setDispatchId("");
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy("");
    }
  };

  const postInvoice = async (invoice) => {
    if (!window.confirm(`${invoice.FaturaKodu} muhasebeleştirilsin mi?`))
      return;
    try {
      setBusy(`post-${invoice.FaturaId}`);
      setError("");
      const { data: result } = await axios.post(
        `${API}/invoices/${invoice.FaturaId}/post`,
      );
      window.alert(
        `${result.journalNo} numaralı dengeli muhasebe fişi oluşturuldu.`,
      );
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy("");
    }
  };

  const collect = async (invoice) => {
    const remaining = Number(invoice.KalanTutar || 0);
    const amountText = window.prompt("Tahsilat tutarı", remaining.toFixed(2));
    if (amountText === null) return;
    const amount = Number(String(amountText).replace(",", "."));
    const channel = window.confirm(
      "Banka tahsilatı için Tamam, kasa için İptal seçin.",
    )
      ? "Banka"
      : "Kasa";
    try {
      setBusy(`pay-${invoice.FaturaId}`);
      setError("");
      const { data: result } = await axios.post(
        `${API}/invoices/${invoice.FaturaId}/payments`,
        { amount, channel },
      );
      window.alert(
        `${result.paymentNo} tahsilatı ve ${result.journalNo} muhasebe fişi oluşturuldu.`,
      );
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="ff-page">
      <header className="ff-hero">
        <div>
          <small>FİNANS VE MUHASEBE OPERASYON MERKEZİ</small>
          <h2>İrsaliye → Fatura → Cari → Tahsilat → Muhasebe</h2>
          <p>
            Her işlem kaynak belgesiyle bağlı, dönem kontrollü ve çift taraflı
            kaydedilir.
          </p>
        </div>
        <button onClick={load}>Yenile</button>
      </header>
      {error && <div className="ff-error">{error}</div>}
      <section className="ff-kpis">
        <article>
          <span>Faturalanan</span>
          <b>{money(stats.invoiced)}</b>
        </article>
        <article>
          <span>Açık alacak</span>
          <b>{money(stats.open)}</b>
        </article>
        <article>
          <span>Tahsil edilen</span>
          <b>{money(stats.collected)}</b>
        </article>
        <article>
          <span>Cari hesap</span>
          <b>{data.balances.length}</b>
        </article>
      </section>
      <section className="ff-create">
        <div>
          <h3>İrsaliyeden fatura oluştur</h3>
          <p>Aynı irsaliye ikinci kez faturalanamaz.</p>
        </div>
        <label>
          İrsaliye ID
          <input
            type="number"
            min="1"
            value={dispatchId}
            onChange={(e) => setDispatchId(e.target.value)}
          />
        </label>
        <label>
          KDV %
          <input
            type="number"
            min="0"
            value={vatRate}
            onChange={(e) => setVatRate(e.target.value)}
          />
        </label>
        <button disabled={!!busy} onClick={createInvoice}>
          Fatura Oluştur
        </button>
      </section>
      <section className="ff-card">
        <div className="ff-title">
          <h3>Satış faturaları</h3>
          <span>{data.invoices.length} kayıt</span>
        </div>
        <div className="ff-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fatura</th>
                <th>Cari</th>
                <th>Toplam</th>
                <th>Tahsil</th>
                <th>Kalan</th>
                <th>Muhasebe</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((f) => (
                <tr key={f.FaturaId}>
                  <td>
                    <strong>{f.FaturaKodu}</strong>
                    <small>
                      {f.FaturaTarihi
                        ? new Date(f.FaturaTarihi).toLocaleDateString("tr-TR")
                        : ""}
                    </small>
                  </td>
                  <td>
                    {f.CariAdi}
                    <small>{f.CariKodu}</small>
                  </td>
                  <td>{money(f.GenelToplam)}</td>
                  <td className="success">{money(f.TahsilEdilenTutar)}</td>
                  <td
                    className={Number(f.KalanTutar) > 0 ? "danger" : "success"}
                  >
                    {money(f.KalanTutar)}
                  </td>
                  <td>
                    <i
                      className={
                        f.MuhasebeDurumu === "Kesinleşti" ? "posted" : "waiting"
                      }
                    >
                      {f.MuhasebeDurumu}
                    </i>
                  </td>
                  <td>
                    <div className="ff-actions">
                      <button
                        disabled={!!busy || f.MuhasebeDurumu === "Kesinleşti"}
                        onClick={() => postInvoice(f)}
                      >
                        Muhasebeleştir
                      </button>
                      <button
                        className="primary"
                        disabled={
                          !!busy ||
                          f.MuhasebeDurumu !== "Kesinleşti" ||
                          Number(f.KalanTutar) <= 0
                        }
                        onClick={() => collect(f)}
                      >
                        Tahsilat
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!data.invoices.length && (
                <tr>
                  <td colSpan="7" className="ff-empty">
                    Satış faturası bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="ff-grid">
        <article className="ff-card">
          <div className="ff-title">
            <h3>Cari bakiyeler</h3>
          </div>
          {data.balances.map((x) => (
            <div className="ff-line" key={x.CariKodu}>
              <span>{x.CariKodu}</span>
              <b>{money(x.Bakiye)}</b>
            </div>
          ))}
        </article>
        <article className="ff-card">
          <div className="ff-title">
            <h3>Son tahsilatlar</h3>
          </div>
          {data.payments.slice(0, 8).map((x) => (
            <div className="ff-line" key={x.TahsilatId}>
              <span>
                {x.TahsilatNo}
                <small>
                  {x.CariKodu} · {x.OdemeKanali}
                </small>
              </span>
              <b className="success">{money(x.Tutar)}</b>
            </div>
          ))}
        </article>
      </section>
    </div>
  );
}
