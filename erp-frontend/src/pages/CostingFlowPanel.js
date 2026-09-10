import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./CostingFlowPanel.css";

const API = `${process.env.REACT_APP_API_URL || "http://localhost:5000/api"}/costing-flow`;
const money = (x) =>
  `${Number(x || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`;

export default function CostingFlowPanel() {
  const [data, setData] = useState({
    completions: [],
    productCosts: [],
    valuations: [],
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
      pending: data.completions.filter((x) => !x.MaliyetFisId).length,
      inventory: data.productCosts.reduce(
        (sum, x) => sum + Number(x.StokDegeri || 0),
        0,
      ),
      variance: data.completions.reduce(
        (sum, x) => sum + Number(x.SapmaTutari || 0),
        0,
      ),
      valued: data.productCosts.filter((x) => Number(x.OrtalamaMaliyet) > 0)
        .length,
    }),
    [data],
  );
  const recalculate = async () => {
    try {
      setBusy("recalculate");
      setError("");
      const { data: result } = await axios.post(
        `${API}/purchase-costs/recalculate`,
      );
      window.alert(`${result.productCount} ürünün alış maliyeti güncellendi.`);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy("");
    }
  };
  const costCompletion = async (completion) => {
    const laborText = window.prompt("Direkt işçilik toplamı", "0");
    if (laborText === null) return;
    const overheadText = window.prompt("Genel üretim gideri toplamı", "0");
    if (overheadText === null) return;
    const laborCost = Number(String(laborText).replace(",", "."));
    const overheadCost = Number(String(overheadText).replace(",", "."));
    const postAccounting = window.confirm(
      "Dengeli maliyet muhasebesi fişi de oluşturulsun mu?",
    );
    try {
      setBusy(`cost-${completion.GerceklesmeId}`);
      setError("");
      const { data: result } = await axios.post(
        `${API}/completions/${completion.GerceklesmeId}/cost`,
        { laborCost, overheadCost, postAccounting },
      );
      window.alert(
        `${result.costNo}: birim maliyet ${money(result.unitCost)}, sapma ${money(result.variance)}.`,
      );
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy("");
    }
  };
  const valuation = async () => {
    try {
      setBusy("valuation");
      setError("");
      const { data: result } = await axios.post(`${API}/valuations`, {
        operationKey: crypto.randomUUID(),
      });
      window.alert(
        `${result.valuationNo}: ${result.itemCount} kalem, ${money(result.totalValue)} stok değeri.`,
      );
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="cf-page">
      <header className="cf-hero">
        <div>
          <small>MALİYET VE DEĞERLEME MERKEZİ</small>
          <h2>Üretim → Fiili Maliyet → Sapma → Stok Değerleme</h2>
          <p>
            Malzeme, işçilik ve genel üretim giderlerini mamul maliyetine ve
            muhasebeye bağlar.
          </p>
        </div>
        <button onClick={load}>Yenile</button>
      </header>
      {error && <div className="cf-error">{error}</div>}
      <section className="cf-kpis">
        <article>
          <span>Maliyet bekleyen üretim</span>
          <b>{stats.pending}</b>
        </article>
        <article>
          <span>Değerlenen ürün</span>
          <b>{stats.valued}</b>
        </article>
        <article>
          <span>Tahmini stok değeri</span>
          <b>{money(stats.inventory)}</b>
        </article>
        <article>
          <span>Toplam üretim sapması</span>
          <b className={stats.variance > 0 ? "danger" : "success"}>
            {money(stats.variance)}
          </b>
        </article>
      </section>
      <section className="cf-toolbar">
        <div>
          <h3>Maliyet işlemleri</h3>
          <p>
            Önce mal kabul fiyatlarından hammadde ortalamalarını güncelleyin.
          </p>
        </div>
        <button disabled={!!busy} onClick={recalculate}>
          Alış Maliyetlerini Güncelle
        </button>
        <button className="blue" disabled={!!busy} onClick={valuation}>
          Stok Değerleme Al
        </button>
      </section>
      <section className="cf-grid">
        <div className="cf-card">
          <h3>Üretim gerçekleşmeleri</h3>
          {data.completions.map((x) => (
            <article className="cf-completion" key={x.GerceklesmeId}>
              <div className="cf-head">
                <div>
                  <strong>{x.GerceklesmeNo}</strong>
                  <span>
                    {x.UrunKodu} · {x.UrunAdi}
                  </span>
                  <small>
                    {Number(x.UretilenMiktar)} mamul · {Number(x.FireMiktari)}{" "}
                    fire
                  </small>
                </div>
                <i className={x.MaliyetFisId ? "done" : "waiting"}>
                  {x.MaliyetFisNo || "Maliyet Bekliyor"}
                </i>
              </div>
              {x.MaliyetFisId && (
                <div className="cf-breakdown">
                  <span>
                    Malzeme <b>{money(x.MalzemeMaliyeti)}</b>
                  </span>
                  <span>
                    İşçilik <b>{money(x.DirektIscilikMaliyeti)}</b>
                  </span>
                  <span>
                    GÜG <b>{money(x.GenelUretimGideri)}</b>
                  </span>
                  <span>
                    Birim <b>{money(x.FiiliBirimMaliyet)}</b>
                  </span>
                  <span>
                    Sapma{" "}
                    <b
                      className={
                        Number(x.SapmaTutari) > 0 ? "danger" : "success"
                      }
                    >
                      {money(x.SapmaTutari)}
                    </b>
                  </span>
                </div>
              )}
              <footer>
                <button
                  disabled={!!busy || x.MaliyetFisId}
                  onClick={() => costCompletion(x)}
                >
                  {x.MaliyetFisId ? "Maliyetlendirildi" : "Maliyetlendir"}
                </button>
              </footer>
            </article>
          ))}
          {!data.completions.length && (
            <p className="cf-empty">Üretim gerçekleşmesi bulunamadı.</p>
          )}
        </div>
        <div className="cf-card">
          <h3>Ürün maliyetleri ve stok değeri</h3>
          <div className="cf-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Stok</th>
                  <th>Standart</th>
                  <th>Ortalama</th>
                  <th>Değer</th>
                </tr>
              </thead>
              <tbody>
                {data.productCosts.map((x) => (
                  <tr key={x.UrunId}>
                    <td>
                      {x.UrunKodu}
                      <small>{x.UrunAdi}</small>
                    </td>
                    <td>{Number(x.StokMiktari).toFixed(2)}</td>
                    <td>{money(x.StandartMaliyet)}</td>
                    <td>{money(x.OrtalamaMaliyet)}</td>
                    <td>
                      <b>{money(x.StokDegeri)}</b>
                    </td>
                  </tr>
                ))}
                {!data.productCosts.length && (
                  <tr>
                    <td colSpan="5" className="cf-empty">
                      Maliyet kaydı yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <h3 className="cf-subtitle">Son değerlemeler</h3>
          {data.valuations.slice(0, 6).map((x) => (
            <div className="cf-line" key={x.DegerlemeId}>
              <span>
                {x.DegerlemeNo}
                <small>
                  {new Date(x.DegerlemeTarihi).toLocaleString("tr-TR")}
                </small>
              </span>
              <b>{money(x.ToplamDeger)}</b>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
