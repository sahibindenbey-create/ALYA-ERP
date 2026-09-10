import React from "react";

export default function BudgetDetailGrid({
  data,
  months,
  drafts,
  setDrafts,
  selectedBudget,
  busy,
  saveLine,
  money,
}) {
  return (
    <section className="bc-grid">
      <div className="bc-card bc-budget">
        <h3>Aylık bütçe ve sapma</h3>
        <div className="bc-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ay</th>
                <th>Tür</th>
                <th>Hesap</th>
                <th>Plan</th>
                <th>Gerçekleşen</th>
                <th>Sapma</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((x) => (
                <tr key={x.KalemId}>
                  <td>{months[x.AyNo - 1]}</td>
                  <td>
                    <i
                      className={
                        x.KalemTipi.includes("GİDER") ||
                        x.KalemTipi.includes("ÇIKIŞ")
                          ? "out"
                          : "in"
                      }
                    >
                      {x.KalemTipi}
                    </i>
                  </td>
                  <td>
                    {x.HesapKodu}
                    <small>{x.HesapAdi}</small>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      disabled={selectedBudget?.Durum !== "Taslak"}
                      value={drafts[x.KalemId] ?? Number(x.PlanlananTutar)}
                      onChange={(e) =>
                        setDrafts({ ...drafts, [x.KalemId]: e.target.value })
                      }
                    />
                  </td>
                  <td>{money(x.GerceklesenTutar)}</td>
                  <td
                    className={
                      Number(x.SapmaTutari) > 0 ? "negative" : "positive"
                    }
                  >
                    {money(x.SapmaTutari)}
                  </td>
                  <td>
                    <button
                      disabled={!!busy || selectedBudget?.Durum !== "Taslak"}
                      onClick={() => saveLine(x)}
                    >
                      Kaydet
                    </button>
                  </td>
                </tr>
              ))}
              {!data.lines.length && (
                <tr>
                  <td colSpan="7" className="bc-empty">
                    Bütçe oluşturun veya seçin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bc-card">
        <h3>Beklenen nakit hareketleri</h3>
        {data.forecastLines.slice(0, 30).map((x) => (
          <article className="bc-cash" key={x.KalemId}>
            <time>{new Date(x.BeklenenTarih).toLocaleDateString("tr-TR")}</time>
            <div>
              <strong>{x.KaynakNo || x.Aciklama}</strong>
              <span>{x.CariAdi || x.KaynakTip}</span>
              <small>
                %{Number(x.OlasilikYuzde)} olasılık · {x.KaynakTip}
              </small>
            </div>
            <b className={x.Yon === "ÇIKIŞ" ? "negative" : "positive"}>
              {x.Yon === "ÇIKIŞ" ? "−" : "+"}
              {money(x.AgirlikliTutar)}
            </b>
          </article>
        ))}
        {!data.forecastLines.length && (
          <p className="bc-empty">
            Nakit tahmini üretildiğinde burada görünecek.
          </p>
        )}
        <h3 className="bc-subtitle">Son tahminler</h3>
        {data.forecasts.slice(0, 5).map((x) => (
          <div className="bc-history" key={x.TahminId}>
            <span>
              {x.TahminNo}
              <small>{new Date(x.TahminTarihi).toLocaleString("tr-TR")}</small>
            </span>
            <b className={Number(x.NetNakit) < 0 ? "negative" : "positive"}>
              {money(x.NetNakit)}
            </b>
          </div>
        ))}
      </div>
    </section>
  );
}
