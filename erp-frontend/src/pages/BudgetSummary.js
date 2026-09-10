import React from "react";

export default function BudgetSummary({ totals, latestForecast, money }) {
  return (
    <section className="bc-kpis">
      <article>
        <span>Planlanan gelir</span>
        <b>{money(totals.plannedRevenue)}</b>
        <small>Gerçekleşen {money(totals.actualRevenue)}</small>
      </article>
      <article>
        <span>Planlanan gider</span>
        <b>{money(totals.plannedExpense)}</b>
        <small>Gerçekleşen {money(totals.actualExpense)}</small>
      </article>
      <article>
        <span>Bütçe faaliyet sonucu</span>
        <b>{money(totals.plannedRevenue - totals.plannedExpense)}</b>
        <small>
          Gerçekleşen {money(totals.actualRevenue - totals.actualExpense)}
        </small>
      </article>
      <article>
        <span>Son tahmin net nakit</span>
        <b
          className={
            Number(latestForecast.NetNakit) < 0 ? "negative" : "positive"
          }
        >
          {money(latestForecast.NetNakit)}
        </b>
        <small>{latestForecast.TahminNo || "Henüz tahmin yok"}</small>
      </article>
    </section>
  );
}
