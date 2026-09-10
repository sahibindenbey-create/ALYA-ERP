import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
const API = process.env.REACT_APP_API_URL || "http://localhost:5000/api";
const num = (v) =>
  Number(v || 0).toLocaleString("tr-TR", { maximumFractionDigits: 4 });
export default function StockOperationsPanel({
  inventory,
  onChanged,
  onError,
}) {
  const [mode, setMode] = useState("transfer"),
    [ops, setOps] = useState({ reservations: [], transfers: [], counts: [] }),
    [saving, setSaving] = useState(false),
    [form, setForm] = useState({
      productId: "",
      sourceWarehouseId: "",
      targetWarehouseId: "",
      sourceLocationId: "",
      targetLocationId: "",
      warehouseId: "",
      locationId: "",
      quantity: "",
      countedQuantity: "",
      minimum: "",
      maximum: "",
      reorderPoint: "",
      note: "",
    });
  const products = useMemo(
    () => [
      ...new Map((inventory.balances || []).map((x) => [x.UrunId, x])).values(),
    ],
    [inventory.balances],
  );
  const sourceLocations = (inventory.locations || []).filter(
      (x) => String(x.DepoId) === String(form.sourceWarehouseId),
    ),
    targetLocations = (inventory.locations || []).filter(
      (x) => String(x.DepoId) === String(form.targetWarehouseId),
    ),
    locations = (inventory.locations || []).filter(
      (x) => String(x.DepoId) === String(form.warehouseId),
    );
  const load = async () => {
    try {
      const r = await axios.get(`${API}/stok/v2/operations`);
      setOps(r.data || {});
    } catch (e) {
      onError(e.response?.data?.error || "Operasyon kayıtları alınamadı.");
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const set = (k, v) =>
    setForm((f) => ({
      ...f,
      [k]: v,
      ...(k === "sourceWarehouseId" ? { sourceLocationId: "" } : {}),
      ...(k === "targetWarehouseId" ? { targetLocationId: "" } : {}),
      ...(k === "warehouseId" ? { locationId: "" } : {}),
    }));
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    onError("");
    try {
      if (mode === "transfer")
        await axios.post(`${API}/stok/v2/operations/transfers`, {
          ...form,
          productId: Number(form.productId),
          sourceWarehouseId: Number(form.sourceWarehouseId),
          targetWarehouseId: Number(form.targetWarehouseId),
          sourceLocationId: Number(form.sourceLocationId),
          targetLocationId: Number(form.targetLocationId),
          quantity: Number(form.quantity),
        });
      if (mode === "count")
        await axios.post(`${API}/stok/v2/operations/counts`, {
          productId: Number(form.productId),
          warehouseId: Number(form.warehouseId),
          locationId: Number(form.locationId),
          countedQuantity: Number(form.countedQuantity),
          note: form.note,
        });
      if (mode === "policy")
        await axios.put(`${API}/stok/v2/operations/policies`, {
          productId: Number(form.productId),
          warehouseId: Number(form.warehouseId),
          locationId: Number(form.locationId),
          minimum: Number(form.minimum || 0),
          maximum: form.maximum === "" ? null : Number(form.maximum),
          reorderPoint: Number(form.reorderPoint || 0),
        });
      await Promise.all([load(), onChanged()]);
      setForm((f) => ({ ...f, quantity: "", countedQuantity: "", note: "" }));
    } catch (e2) {
      onError(e2.response?.data?.error || "Operasyon tamamlanamadı.");
    } finally {
      setSaving(false);
    }
  };
  const release = async (id) => {
    if (!window.confirm("Rezervasyon serbest bırakılsın mı?")) return;
    try {
      await axios.post(`${API}/stok/v2/operations/reservations/${id}/release`);
      await Promise.all([load(), onChanged()]);
    } catch (e) {
      onError(e.response?.data?.error || "Rezervasyon çözülemedi.");
    }
  };
  const Product = () => (
    <label>
      Ürün
      <select
        required
        value={form.productId}
        onChange={(e) => set("productId", e.target.value)}
      >
        <option value="">Ürün seçin</option>
        {products.map((x) => (
          <option key={x.UrunId} value={x.UrunId}>
            {x.UrunKodu} — {x.UrunAdi}
          </option>
        ))}
      </select>
    </label>
  );
  const Warehouse = ({ field = "warehouseId", title = "Depo" }) => (
    <label>
      {title}
      <select
        required
        value={form[field]}
        onChange={(e) => set(field, e.target.value)}
      >
        <option value="">Depo seçin</option>
        {(inventory.warehouses || []).map((x) => (
          <option key={x.DepoId} value={x.DepoId}>
            {x.DepoAdi}
          </option>
        ))}
      </select>
    </label>
  );
  const Location = ({
    field = "locationId",
    list = locations,
    title = "Lokasyon",
  }) => (
    <label>
      {title}
      <select
        required
        value={form[field]}
        onChange={(e) => set(field, e.target.value)}
      >
        <option value="">Lokasyon seçin</option>
        {list.map((x) => (
          <option key={x.LokasyonId} value={x.LokasyonId}>
            {x.LokasyonKodu} — {x.LokasyonAdi}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="stock-ops">
      <div className="ops-mode">
        {[
          ["transfer", "Depolar Arası Transfer"],
          ["count", "Sayım Fişi"],
          ["policy", "Min / Max Politikası"],
          ["reservations", "Aktif Rezervasyonlar"],
        ].map(([id, label]) => (
          <button
            type="button"
            key={id}
            className={mode === id ? "active" : ""}
            onClick={() => setMode(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {mode !== "reservations" && (
        <form className="stok-movement" onSubmit={submit}>
          <div className="movement-title">
            {mode === "transfer"
              ? "Yeni stok transferi"
              : mode === "count"
                ? "Sayım sonucu kaydet"
                : "Stok politikasını güncelle"}
          </div>
          <div className="movement-grid">
            <Product />
            {mode === "transfer" ? (
              <>
                <Warehouse field="sourceWarehouseId" title="Kaynak depo" />
                <Location
                  field="sourceLocationId"
                  title="Kaynak lokasyon"
                  list={sourceLocations}
                />
                <Warehouse field="targetWarehouseId" title="Hedef depo" />
                <Location
                  field="targetLocationId"
                  title="Hedef lokasyon"
                  list={targetLocations}
                />
                <label>
                  Miktar
                  <input
                    required
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={form.quantity}
                    onChange={(e) => set("quantity", e.target.value)}
                  />
                </label>
              </>
            ) : (
              <>
                <Warehouse />
                <Location />
                {mode === "count" ? (
                  <label>
                    Sayılan miktar
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.0001"
                      value={form.countedQuantity}
                      onChange={(e) => set("countedQuantity", e.target.value)}
                    />
                  </label>
                ) : (
                  <>
                    <label>
                      Minimum
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={form.minimum}
                        onChange={(e) => set("minimum", e.target.value)}
                      />
                    </label>
                    <label>
                      Maksimum
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={form.maximum}
                        onChange={(e) => set("maximum", e.target.value)}
                      />
                    </label>
                    <label>
                      Yeniden sipariş noktası
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={form.reorderPoint}
                        onChange={(e) => set("reorderPoint", e.target.value)}
                      />
                    </label>
                  </>
                )}
              </>
            )}{" "}
            {mode !== "policy" && (
              <label className="wide">
                Açıklama
                <input
                  value={form.note}
                  onChange={(e) => set("note", e.target.value)}
                />
              </label>
            )}
          </div>
          <button className="save-movement" disabled={saving}>
            {saving ? "Kaydediliyor…" : "İşlemi Tamamla"}
          </button>
        </form>
      )}
      {mode === "reservations" && (
        <div className="stok-table-card">
          <table>
            <thead>
              <tr>
                <th>Referans</th>
                <th>Ürün</th>
                <th>Depo/Lokasyon</th>
                <th>Miktar</th>
                <th>Karşılanan</th>
                <th>Durum</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(ops.reservations || []).map((x) => (
                <tr key={x.RezervasyonId}>
                  <td>
                    {x.ReferansTipi}
                    <small>{x.ReferansId}</small>
                  </td>
                  <td>
                    {x.UrunAdi}
                    <small>{x.UrunKodu}</small>
                  </td>
                  <td>
                    {x.DepoAdi}
                    <small>{x.LokasyonAdi}</small>
                  </td>
                  <td>{num(x.Miktar)}</td>
                  <td>{num(x.KarsilananMiktar)}</td>
                  <td>{x.Durum}</td>
                  <td>
                    {x.Durum === "ACTIVE" && (
                      <button
                        className="row-action"
                        onClick={() => release(x.RezervasyonId)}
                      >
                        Serbest Bırak
                      </button>
                    )}
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
