import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import BudgetSummary from "./BudgetSummary";
import BudgetDetailGrid from "./BudgetDetailGrid";
import "./BudgetControlPanel.css";

const API = `${process.env.REACT_APP_API_URL || "http://localhost:5000/api"}/budget-flow`;
const months = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];
const money = (x) =>
  `${Number(x || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`;

export default function BudgetControlPanel() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [budgetId, setBudgetId] = useState("");
  const [data, setData] = useState({
    budgets: [],
    lines: [],
    forecasts: [],
    forecastLines: [],
    manualLines: [],
  });
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(
    async (selected = budgetId) => {
      try {
        setError("");
        const response = await axios.get(`${API}/overview`, {
          params: { year, budgetId: selected || undefined },
        });
        setData(response.data);
        if (!selected && response.data.budgets[0])
          setBudgetId(String(response.data.budgets[0].ButceId));
      } catch (e) {
        setError(e.response?.data?.error || e.message);
      }
    },
    [budgetId, year],
  );
  useEffect(() => {
    load();
  }, [year]);
  const selectedBudget =
    data.budgets.find((x) => String(x.ButceId) === String(budgetId)) ||
    data.budgets[0];
  const totals = useMemo(
    () =>
      data.lines.reduce(
        (a, x) => {
          const planned = Number(x.PlanlananTutar),
            actual = Number(x.GerceklesenTutar);
          if (x.KalemTipi === "GELİR") {
            a.plannedRevenue += planned;
            a.actualRevenue += actual;
          }
          if (x.KalemTipi === "GİDER") {
            a.plannedExpense += planned;
            a.actualExpense += actual;
          }
          return a;
        },
        {
          plannedRevenue: 0,
          actualRevenue: 0,
          plannedExpense: 0,
          actualExpense: 0,
        },
      ),
    [data.lines],
  );
  const latestForecast = data.forecasts[0] || {};
  const createBudget = async () => {
    const name = window.prompt("Bütçe adı", `${year} Bütçesi`);
    if (!name) return;
    const scenario = window.prompt(
      "Senaryo: Baz, İyimser veya Kötümser",
      "Baz",
    );
    if (!scenario) return;
    try {
      setBusy("create");
      const { data: r } = await axios.post(`${API}/budgets`, {
        year,
        name,
        scenario,
      });
      setBudgetId(String(r.budgetId));
      await load(r.budgetId);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy("");
    }
  };
  const saveLine = async (line) => {
    const amount = Number(drafts[line.KalemId] ?? line.PlanlananTutar);
    try {
      setBusy(`line-${line.KalemId}`);
      await axios.put(`${API}/budgets/${line.ButceId}/lines`, {
        month: line.AyNo,
        type: line.KalemTipi,
        accountCode: line.HesapKodu,
        accountName: line.HesapAdi,
        amount,
      });
      await load(line.ButceId);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy("");
    }
  };
  const approve = async () => {
    if (
      !selectedBudget ||
      !window.confirm(`${selectedBudget.ButceAdi} onaylansın mı?`)
    )
      return;
    try {
      setBusy("approve");
      await axios.post(`${API}/budgets/${selectedBudget.ButceId}/approve`);
      await load(selectedBudget.ButceId);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy("");
    }
  };
  const forecast = async () => {
    const days = Number(window.prompt("Tahmin ufku (gün)", "90"));
    if (!days) return;
    try {
      setBusy("forecast");
      const { data: r } = await axios.post(`${API}/cash-forecasts`, {
        days,
        operationKey: crypto.randomUUID(),
      });
      window.alert(`${r.forecastNo}: net nakit ${money(r.NetNakit)}.`);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy("");
    }
  };
  const addManual = async () => {
    const title = window.prompt("Nakit kalemi açıklaması");
    if (!title) return;
    const direction = window.prompt("Yön: GİRİŞ veya ÇIKIŞ", "ÇIKIŞ");
    if (!direction) return;
    const date = window.prompt(
      "Beklenen tarih (YYYY-MM-DD)",
      new Date().toISOString().slice(0, 10),
    );
    if (!date) return;
    const amount = Number(
      String(window.prompt("Tutar", "0") || "0").replace(",", "."),
    );
    if (!(amount > 0)) return;
    const probability = Number(
      window.prompt("Gerçekleşme olasılığı (%)", "100"),
    );
    try {
      setBusy("manual");
      await axios.post(`${API}/manual-cash-lines`, {
        title,
        direction: direction.toUpperCase(),
        date,
        amount,
        probability,
      });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="bc-page">
      <header className="bc-hero">
        <div>
          <small>BÜTÇE VE NAKİT KONTROL MERKEZİ</small>
          <h2>Plan → Gerçekleşen → Sapma → Nakit Tahmini</h2>
          <p>
            Muhasebe gerçekleşmelerini bütçe ve ileri tarihli nakit
            yükümlülükleriyle karşılaştırır.
          </p>
        </div>
        <button onClick={() => load()}>Yenile</button>
      </header>
      {error && <div className="bc-error">{error}</div>}
      <section className="bc-controls">
        <label>
          Yıl
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>
        <label>
          Bütçe
          <select
            value={budgetId}
            onChange={(e) => {
              setBudgetId(e.target.value);
              load(e.target.value);
            }}
          >
            <option value="">Bütçe seçin</option>
            {data.budgets.map((x) => (
              <option value={x.ButceId} key={x.ButceId}>
                {x.ButceNo} · {x.Senaryo} · {x.Durum}
              </option>
            ))}
          </select>
        </label>
        <button disabled={!!busy} onClick={createBudget}>
          Yeni Bütçe
        </button>
        <button
          className="approve"
          disabled={!!busy || selectedBudget?.Durum !== "Taslak"}
          onClick={approve}
        >
          Bütçeyi Onayla
        </button>
        <button className="forecast" disabled={!!busy} onClick={forecast}>
          Nakit Tahmini Üret
        </button>
        <button className="manual" disabled={!!busy} onClick={addManual}>
          Manuel Nakit Kalemi
        </button>
      </section>
      <BudgetSummary
        totals={totals}
        latestForecast={latestForecast}
        money={money}
      />
      <BudgetDetailGrid
        data={data}
        months={months}
        drafts={drafts}
        setDrafts={setDrafts}
        selectedBudget={selectedBudget}
        busy={busy}
        saveLine={saveLine}
        money={money}
      />
    </div>
  );
}
