import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { getCurrentUser } from "../auth";
import "./KullaniciYonetimi.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";
const emptyUser = {
  kullaniciAdi: "",
  sifre: "",
  adSoyad: "",
  rol: "Kullanıcı",
};
const emptyPeriod = {
  periodCode: String(new Date().getFullYear()),
  periodName: `${new Date().getFullYear()} Mali Yılı`,
  startDate: `${new Date().getFullYear()}-01-01`,
  endDate: `${new Date().getFullYear()}-12-31`,
  status: "Open",
};
const emptySeries = {
  documentType: "",
  prefix: "",
  suffix: "",
  padding: 6,
  resetYearly: true,
  isActive: true,
};

function KullaniciYonetimi() {
  const currentUser = getCurrentUser();
  const [tab, setTab] = useState("users");
  const [data, setData] = useState({
    roles: [],
    permissions: [],
    users: [],
    periods: [],
    numberSeries: [],
    auditLogs: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userForm, setUserForm] = useState(emptyUser);
  const [periodForm, setPeriodForm] = useState(emptyPeriod);
  const [seriesForm, setSeriesForm] = useState(emptySeries);
  const selectedCompanyId = Number(
    localStorage.getItem("selectedCompanyId") || 1,
  );

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get(`${API_URL}/core/admin/overview`);
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.error || "Yönetim verileri alınamadı.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const roleOptions = useMemo(
    () => data.roles.filter((r) => r.IsActive),
    [data.roles],
  );

  const createUser = async () => {
    if (!userForm.kullaniciAdi || !userForm.sifre)
      return setError("Kullanıcı adı ve şifre zorunludur.");
    if (userForm.sifre.length < 8)
      return setError("Şifre en az 8 karakter olmalıdır.");
    try {
      await axios.post(`${API_URL}/auth/register`, userForm);
      setUserForm(emptyUser);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "Kullanıcı oluşturulamadı.");
    }
  };

  const changeAccess = async (userId, roleId, isActive = true) => {
    try {
      await axios.put(`${API_URL}/core/admin/users/${userId}/access`, {
        roleId: Number(roleId),
        isActive,
      });
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "Yetki güncellenemedi.");
    }
  };

  const resetPassword = async (user) => {
    const value = window.prompt(
      `${user.KullaniciAdi} için yeni şifre (en az 8 karakter):`,
    );
    if (!value) return;
    if (value.length < 8) return setError("Şifre en az 8 karakter olmalıdır.");
    try {
      await axios.put(
        `${API_URL}/auth/kullanicilar/${user.KullaniciId}/sifre`,
        { yeniSifre: value },
      );
    } catch (err) {
      setError(err.response?.data?.error || "Şifre değiştirilemedi.");
    }
  };

  const savePeriod = async () => {
    try {
      await axios.post(`${API_URL}/core/admin/fiscal-periods`, periodForm);
      setPeriodForm(emptyPeriod);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "Mali dönem kaydedilemedi.");
    }
  };

  const editPeriod = (p) =>
    setPeriodForm({
      periodCode: p.PeriodCode,
      periodName: p.PeriodName,
      startDate: String(p.StartDate).slice(0, 10),
      endDate: String(p.EndDate).slice(0, 10),
      status: p.Status,
    });

  const saveSeries = async () => {
    try {
      await axios.post(`${API_URL}/core/admin/number-series`, seriesForm);
      setSeriesForm(emptySeries);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "Numara serisi kaydedilemedi.");
    }
  };

  const editSeries = (s) =>
    setSeriesForm({
      documentType: s.DocumentType,
      prefix: s.Prefix || "",
      suffix: s.Suffix || "",
      padding: s.Padding,
      resetYearly: s.ResetYearly,
      isActive: s.IsActive,
    });

  if (currentUser?.role !== "Yönetici")
    return (
      <div className="kul-card kul-denied">
        🔒 Bu alan için Yönetici rolü gerekir.
      </div>
    );

  return (
    <div className="kul-container">
      <div className="kul-heading">
        <div>
          <h2>ERP Çekirdek Yönetimi</h2>
          <p>
            Şirket #{selectedCompanyId} için yetki, dönem, belge numarası ve
            işlem geçmişi.
          </p>
        </div>
        <button className="kul-btn secondary" onClick={load}>
          Yenile
        </button>
      </div>
      <div className="kul-tabs">
        <button
          className={tab === "users" ? "active" : ""}
          onClick={() => setTab("users")}
        >
          Kullanıcı & Yetki
        </button>
        <button
          className={tab === "periods" ? "active" : ""}
          onClick={() => setTab("periods")}
        >
          Mali Dönemler
        </button>
        <button
          className={tab === "series" ? "active" : ""}
          onClick={() => setTab("series")}
        >
          Numara Serileri
        </button>
        <button
          className={tab === "audit" ? "active" : ""}
          onClick={() => setTab("audit")}
        >
          Audit Kayıtları
        </button>
      </div>
      {error && (
        <div className="kul-alert">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}
      {loading ? (
        <div className="kul-card">Yükleniyor…</div>
      ) : (
        <>
          {tab === "users" && (
            <UsersTab
              data={data}
              roles={roleOptions}
              form={userForm}
              setForm={setUserForm}
              createUser={createUser}
              changeAccess={changeAccess}
              resetPassword={resetPassword}
            />
          )}
          {tab === "periods" && (
            <PeriodsTab
              periods={data.periods}
              form={periodForm}
              setForm={setPeriodForm}
              save={savePeriod}
              edit={editPeriod}
            />
          )}
          {tab === "series" && (
            <SeriesTab
              rows={data.numberSeries}
              form={seriesForm}
              setForm={setSeriesForm}
              save={saveSeries}
              edit={editSeries}
            />
          )}
          {tab === "audit" && <AuditTab rows={data.auditLogs} />}
        </>
      )}
    </div>
  );
}

function UsersTab({
  data,
  roles,
  form,
  setForm,
  createUser,
  changeAccess,
  resetPassword,
}) {
  return (
    <>
      <section className="kul-card">
        <h3>Yeni kullanıcı</h3>
        <div className="kul-grid">
          <Field label="Kullanıcı adı">
            <input
              value={form.kullaniciAdi}
              onChange={(e) =>
                setForm({ ...form, kullaniciAdi: e.target.value })
              }
            />
          </Field>
          <Field label="Ad soyad">
            <input
              value={form.adSoyad}
              onChange={(e) => setForm({ ...form, adSoyad: e.target.value })}
            />
          </Field>
          <Field label="Geçici şifre">
            <input
              type="password"
              value={form.sifre}
              onChange={(e) => setForm({ ...form, sifre: e.target.value })}
            />
          </Field>
          <Field label="Başlangıç rolü">
            <select
              value={form.rol}
              onChange={(e) => setForm({ ...form, rol: e.target.value })}
            >
              <option>Yönetici</option>
              <option>Kullanıcı</option>
              <option>Sadece Görüntüleme</option>
            </select>
          </Field>
        </div>
        <div className="kul-actions">
          <button className="kul-btn primary" onClick={createUser}>
            Kullanıcı oluştur
          </button>
        </div>
      </section>
      <section className="kul-card">
        <div className="kul-card-title">
          <h3>Seçili şirket erişimleri</h3>
          <span>{data.users.length} kullanıcı</span>
        </div>
        <div className="kul-table-wrap">
          <table className="kul-table">
            <thead>
              <tr>
                <th>Kullanıcı</th>
                <th>Rol</th>
                <th>Şirket erişimi</th>
                <th>Durum</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user) => (
                <tr key={user.KullaniciId}>
                  <td>
                    <strong>{user.AdSoyad || user.KullaniciAdi}</strong>
                    <small>{user.KullaniciAdi}</small>
                  </td>
                  <td>
                    <select
                      value={user.RoleId || ""}
                      onChange={(e) =>
                        changeAccess(user.KullaniciId, e.target.value, true)
                      }
                    >
                      <option value="" disabled>
                        Rol seçin
                      </option>
                      {roles.map((role) => (
                        <option key={role.RoleId} value={role.RoleId}>
                          {role.RoleName}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span
                      className={`kul-badge ${user.CompanyAccess ? "green" : "red"}`}
                    >
                      {user.CompanyAccess ? "Yetkili" : "Erişim yok"}
                    </span>
                  </td>
                  <td>{user.IsActive ? "Aktif" : "Pasif"}</td>
                  <td>
                    <button
                      className="kul-link"
                      onClick={() => resetPassword(user)}
                    >
                      Şifre yenile
                    </button>
                    {user.CompanyAccess && (
                      <button
                        className="kul-link danger"
                        onClick={() =>
                          changeAccess(user.KullaniciId, user.RoleId, false)
                        }
                      >
                        Erişimi kaldır
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function PeriodsTab({ periods, form, setForm, save, edit }) {
  return (
    <>
      <section className="kul-card">
        <h3>Mali dönem tanımı</h3>
        <div className="kul-grid">
          <Field label="Dönem kodu">
            <input
              value={form.periodCode}
              onChange={(e) => setForm({ ...form, periodCode: e.target.value })}
            />
          </Field>
          <Field label="Dönem adı">
            <input
              value={form.periodName}
              onChange={(e) => setForm({ ...form, periodName: e.target.value })}
            />
          </Field>
          <Field label="Başlangıç">
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </Field>
          <Field label="Bitiş">
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </Field>
          <Field label="Durum">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="Open">Açık</option>
              <option value="Locked">Kilitli</option>
              <option value="Closed">Kapalı</option>
            </select>
          </Field>
        </div>
        <div className="kul-actions">
          <button className="kul-btn primary" onClick={save}>
            Dönemi kaydet
          </button>
        </div>
      </section>
      <section className="kul-card">
        <h3>Dönemler</h3>
        <div className="kul-table-wrap">
          <table className="kul-table">
            <thead>
              <tr>
                <th>Kod</th>
                <th>Ad</th>
                <th>Tarih aralığı</th>
                <th>Durum</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.PeriodId}>
                  <td>
                    <strong>{p.PeriodCode}</strong>
                  </td>
                  <td>{p.PeriodName}</td>
                  <td>
                    {fmtDate(p.StartDate)} — {fmtDate(p.EndDate)}
                  </td>
                  <td>
                    <span
                      className={`kul-badge ${p.Status === "Open" ? "green" : p.Status === "Locked" ? "amber" : "red"}`}
                    >
                      {p.Status}
                    </span>
                  </td>
                  <td>
                    <button className="kul-link" onClick={() => edit(p)}>
                      Düzenle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function SeriesTab({ rows, form, setForm, save, edit }) {
  return (
    <>
      <section className="kul-card">
        <h3>Belge numara serisi</h3>
        <div className="kul-grid">
          <Field label="Belge türü">
            <input
              value={form.documentType}
              onChange={(e) =>
                setForm({ ...form, documentType: e.target.value.toUpperCase() })
              }
              placeholder="SIPARIS"
            />
          </Field>
          <Field label="Önek">
            <input
              value={form.prefix}
              onChange={(e) => setForm({ ...form, prefix: e.target.value })}
              placeholder="SPR-"
            />
          </Field>
          <Field label="Sonek">
            <input
              value={form.suffix}
              onChange={(e) => setForm({ ...form, suffix: e.target.value })}
            />
          </Field>
          <Field label="Hane">
            <input
              type="number"
              min="1"
              max="18"
              value={form.padding}
              onChange={(e) =>
                setForm({ ...form, padding: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Yıllık sıfırla">
            <select
              value={form.resetYearly ? "1" : "0"}
              onChange={(e) =>
                setForm({ ...form, resetYearly: e.target.value === "1" })
              }
            >
              <option value="1">Evet</option>
              <option value="0">Hayır</option>
            </select>
          </Field>
        </div>
        <div className="kul-actions">
          <button className="kul-btn primary" onClick={save}>
            Seriyi kaydet
          </button>
        </div>
      </section>
      <section className="kul-card">
        <h3>Tanımlı seriler</h3>
        <div className="kul-table-wrap">
          <table className="kul-table">
            <thead>
              <tr>
                <th>Belge türü</th>
                <th>Biçim</th>
                <th>Son numara</th>
                <th>Yıl</th>
                <th>Durum</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.NumberSeriesId}>
                  <td>
                    <strong>{s.DocumentType}</strong>
                  </td>
                  <td>
                    {s.Prefix}
                    {"0".repeat(Math.min(s.Padding, 10))}
                    {s.Suffix}
                  </td>
                  <td>{s.LastNumber}</td>
                  <td>{s.CurrentYear}</td>
                  <td>{s.IsActive ? "Aktif" : "Pasif"}</td>
                  <td>
                    <button className="kul-link" onClick={() => edit(s)}>
                      Düzenle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function AuditTab({ rows }) {
  return (
    <section className="kul-card">
      <div className="kul-card-title">
        <h3>Son 100 yönetim işlemi</h3>
        <span>Salt okunur</span>
      </div>
      <div className="kul-table-wrap">
        <table className="kul-table">
          <thead>
            <tr>
              <th>Zaman</th>
              <th>Kullanıcı</th>
              <th>İşlem</th>
              <th>Varlık</th>
              <th>Kayıt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.AuditLogId}>
                <td>{fmtDateTime(a.CreatedAt)}</td>
                <td>{a.KullaniciAdi || "Sistem"}</td>
                <td>
                  <code>{a.ActionCode}</code>
                </td>
                <td>{a.EntityType}</td>
                <td>{a.EntityId || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="kul-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function fmtDate(value) {
  return value ? new Date(value).toLocaleDateString("tr-TR") : "—";
}
function fmtDateTime(value) {
  return value ? new Date(value).toLocaleString("tr-TR") : "—";
}
export default KullaniciYonetimi;
