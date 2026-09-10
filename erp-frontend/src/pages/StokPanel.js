import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import StockOperationsPanel from "./StockOperationsPanel";
import "./StokPanel.css";
const API = process.env.REACT_APP_API_URL || "http://localhost:5000/api";
const n = (v) =>
  Number(v || 0).toLocaleString("tr-TR", { maximumFractionDigits: 4 });
export default function StokPanel() {
  const [data, setData] = useState({
      balances: [],
      warehouses: [],
      locations: [],
      movements: [],
    }),
    [tab, setTab] = useState("overview"),
    [query, setQuery] = useState(""),
    [warehouse, setWarehouse] = useState(""),
    [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const [form, setForm] = useState({
    type: "IN",
    productId: "",
    warehouseId: "",
    locationId: "",
    quantity: "",
    newQuantity: "",
    referenceType: "",
    referenceId: "",
    note: "",
  });
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await axios.get(`${API}/stok/v2/overview`, {
        params: warehouse ? { depoId: warehouse } : {},
      });
      setData(r.data || {});
    } catch (e) {
      setError(
        e.response?.data?.error ||
          "Stok verileri alınamadı. Önce 012 migrationını çalıştırın.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouse]);
  const rows = useMemo(
    () =>
      (data.balances || []).filter((x) =>
        `${x.UrunKodu} ${x.UrunAdi} ${x.DepoAdi} ${x.LokasyonAdi}`
          .toLocaleLowerCase("tr")
          .includes(query.toLocaleLowerCase("tr")),
      ),
    [data.balances, query],
  );
  const products = useMemo(
    () => [
      ...new Map((data.balances || []).map((x) => [x.UrunId, x])).values(),
    ],
    [data.balances],
  );
  const locations = (data.locations || []).filter(
    (x) => !form.warehouseId || String(x.DepoId) === String(form.warehouseId),
  );
  const physical = rows.reduce((s, x) => s + Number(x.Miktar || 0), 0),
    reserved = rows.reduce((s, x) => s + Number(x.RezerveMiktar || 0), 0),
    available = rows.reduce((s, x) => s + Number(x.KullanilabilirStok || 0), 0),
    critical = rows.filter((x) => Number(x.Kritik) === 1).length;
  const change = (k, v) =>
    setForm((f) => ({
      ...f,
      [k]: v,
      ...(k === "warehouseId" ? { locationId: "" } : {}),
    }));
  const selectRow = (x) => {
    setForm((f) => ({
      ...f,
      productId: String(x.UrunId),
      warehouseId: String(x.DepoId),
      locationId: String(x.LokasyonId),
    }));
    setTab("movement");
  };
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (tab === "reservation")
        await axios.post(`${API}/stok/v2/reservations`, {
          productId: Number(form.productId),
          warehouseId: Number(form.warehouseId),
          locationId: Number(form.locationId),
          quantity: Number(form.quantity),
          referenceType: form.referenceType,
          referenceId: form.referenceId,
        });
      else
        await axios.post(`${API}/stok/v2/movement`, {
          productId: Number(form.productId),
          warehouseId: Number(form.warehouseId),
          locationId: Number(form.locationId),
          type: form.type,
          quantity: Number(form.quantity),
          newQuantity:
            form.type === "ADJUST" ? Number(form.newQuantity) : undefined,
          referenceType: form.referenceType || undefined,
          referenceId: form.referenceId || undefined,
          note: form.note,
        });
      setForm((f) => ({
        ...f,
        quantity: "",
        newQuantity: "",
        referenceType: "",
        referenceId: "",
        note: "",
      }));
      await load();
      setTab("overview");
    } catch (e2) {
      setError(e2.response?.data?.error || "İşlem kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="stok-page">
      <header className="stok-head">
        <div>
          <div className="stok-eyebrow">04 · STOK YÖNETİMİ</div>
          <h1>Stok ve Depo Merkezi</h1>
          <p>
            Fiziksel, rezerve, bloke ve kullanılabilir stok tek hareket
            defterinden yönetilir.
          </p>
        </div>
        <button className="stok-refresh" onClick={load} disabled={loading}>
          {loading ? "Yükleniyor…" : "↻ Yenile"}
        </button>
      </header>
      {error && <div className="stok-alert">{error}</div>}
      <section className="stok-kpis">
        <div>
          <span>Fiziksel Stok</span>
          <strong>{n(physical)}</strong>
        </div>
        <div>
          <span>Kullanılabilir</span>
          <strong>{n(available)}</strong>
        </div>
        <div>
          <span>Rezerve</span>
          <strong>{n(reserved)}</strong>
        </div>
        <div className="warning">
          <span>Kritik Kalem</span>
          <strong>{critical}</strong>
        </div>
      </section>
      <nav className="stok-tabs">
        {[
          ["overview", "Stok Durumu"],
          ["movement", "Giriş / Çıkış"],
          ["reservation", "Rezervasyon"],
          ["operations", "Transfer / Sayım"],
          ["history", "Hareket Defteri"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "overview" && (
        <>
          <div className="stok-toolbar">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ürün, depo veya lokasyon ara…"
            />
            <select
              value={warehouse}
              onChange={(e) => setWarehouse(e.target.value)}
            >
              <option value="">Tüm depolar</option>
              {(data.warehouses || []).map((d) => (
                <option key={d.DepoId} value={d.DepoId}>
                  {d.DepoKodu} — {d.DepoAdi}
                </option>
              ))}
            </select>
            <span className="stok-record-count">{rows.length} bakiye</span>
          </div>
          <div className="stok-table-card">
            <table>
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Depo / Lokasyon</th>
                  <th>Fiziksel</th>
                  <th>Rezerve</th>
                  <th>Bloke</th>
                  <th>Kullanılabilir</th>
                  <th>Sipariş Noktası</th>
                  <th>Durum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr
                    key={x.StokBakiyeId}
                    className={Number(x.Kritik) ? "critical-row" : ""}
                  >
                    <td>
                      <b>{x.UrunAdi}</b>
                      <small>{x.UrunKodu}</small>
                    </td>
                    <td>
                      <b>{x.DepoAdi}</b>
                      <small>
                        {x.LokasyonKodu} · {x.LokasyonAdi}
                      </small>
                    </td>
                    <td>
                      {n(x.Miktar)} {x.Birim}
                    </td>
                    <td>{n(x.RezerveMiktar)}</td>
                    <td>{n(x.BlokeMiktar)}</td>
                    <td className="stock-number">{n(x.KullanilabilirStok)}</td>
                    <td>{n(x.YenidenSiparisNoktasi)}</td>
                    <td>
                      <span
                        className={`stock-badge ${Number(x.Kritik) ? "danger" : "ok"}`}
                      >
                        {Number(x.Kritik) ? "KRİTİK" : "NORMAL"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="row-action"
                        onClick={() => selectRow(x)}
                      >
                        İşlem
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <div className="stok-empty">Stok bakiyesi bulunamadı.</div>
            )}
          </div>
        </>
      )}
      {(tab === "movement" || tab === "reservation") && (
        <form className="stok-movement" onSubmit={submit}>
          <div className="movement-title">
            {tab === "reservation"
              ? "Sipariş / üretim rezervasyonu"
              : "Yeni stok hareketi"}
          </div>
          <div className="movement-grid">
            {tab === "movement" && (
              <label>
                İşlem
                <select
                  value={form.type}
                  onChange={(e) => change("type", e.target.value)}
                >
                  <option value="IN">Giriş</option>
                  <option value="OUT">Çıkış</option>
                  <option value="ADJUST">Sayım / Düzeltme</option>
                </select>
              </label>
            )}
            <label>
              Ürün
              <select
                required
                value={form.productId}
                onChange={(e) => change("productId", e.target.value)}
              >
                <option value="">Ürün seçin</option>
                {products.map((x) => (
                  <option key={x.UrunId} value={x.UrunId}>
                    {x.UrunKodu} — {x.UrunAdi}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Depo
              <select
                required
                value={form.warehouseId}
                onChange={(e) => change("warehouseId", e.target.value)}
              >
                <option value="">Depo seçin</option>
                {(data.warehouses || []).map((x) => (
                  <option key={x.DepoId} value={x.DepoId}>
                    {x.DepoAdi}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Lokasyon
              <select
                required
                value={form.locationId}
                onChange={(e) => change("locationId", e.target.value)}
              >
                <option value="">Lokasyon seçin</option>
                {locations.map((x) => (
                  <option key={x.LokasyonId} value={x.LokasyonId}>
                    {x.LokasyonKodu} — {x.LokasyonAdi}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Miktar
              <input
                required
                type="number"
                min="0.0001"
                step="0.0001"
                value={form.quantity}
                onChange={(e) => change("quantity", e.target.value)}
              />
            </label>
            {tab === "movement" && form.type === "ADJUST" && (
              <label>
                Yeni fiziksel stok
                <input
                  required
                  type="number"
                  min="0"
                  step="0.0001"
                  value={form.newQuantity}
                  onChange={(e) => change("newQuantity", e.target.value)}
                />
              </label>
            )}
            <label>
              Referans tipi
              <input
                required={tab === "reservation"}
                value={form.referenceType}
                onChange={(e) => change("referenceType", e.target.value)}
                placeholder="SATIS_SIPARISI"
              />
            </label>
            <label>
              Referans no
              <input
                required={tab === "reservation"}
                value={form.referenceId}
                onChange={(e) => change("referenceId", e.target.value)}
                placeholder="SIP-2026-001"
              />
            </label>
            {tab === "movement" && (
              <label className="wide">
                Açıklama
                <input
                  value={form.note}
                  onChange={(e) => change("note", e.target.value)}
                />
              </label>
            )}
          </div>
          <button className="save-movement" disabled={saving}>
            {saving
              ? "Kaydediliyor…"
              : tab === "reservation"
                ? "Stok Rezerve Et"
                : "Hareketi Kaydet"}
          </button>
        </form>
      )}
      {tab === "operations" && (
        <StockOperationsPanel
          inventory={data}
          onChanged={load}
          onError={setError}
        />
      )}
      {tab === "history" && (
        <div className="stok-table-card">
          <table>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Ürün</th>
                <th>Depo</th>
                <th>Lokasyon</th>
                <th>Tip</th>
                <th>Miktar</th>
                <th>Önceki</th>
                <th>Sonraki</th>
                <th>Referans</th>
              </tr>
            </thead>
            <tbody>
              {(data.movements || []).map((x) => (
                <tr key={x.StokHareketId}>
                  <td>{new Date(x.IslemTarihi).toLocaleString("tr-TR")}</td>
                  <td>
                    <b>{x.UrunAdi}</b>
                    <small>{x.UrunKodu}</small>
                  </td>
                  <td>{x.DepoAdi || "—"}</td>
                  <td>{x.LokasyonAdi || "—"}</td>
                  <td>{x.HareketTipi}</td>
                  <td>{n(x.Miktar)}</td>
                  <td>{n(x.OncekiStok)}</td>
                  <td>
                    <b>{n(x.SonrakiStok)}</b>
                  </td>
                  <td>
                    {x.ReferansTipi
                      ? `${x.ReferansTipi} / ${x.ReferansId || "—"}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
