import React, { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, Outlet, Link, useLocation } from "react-router-dom";
import axios from "axios";
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import ScienceIcon from '@mui/icons-material/Science';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import FactoryIcon from '@mui/icons-material/Factory';
import ListAltIcon from '@mui/icons-material/ListAlt';
import AppsIcon from '@mui/icons-material/Apps';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import BadgeIcon from '@mui/icons-material/Badge';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import LogoutIcon from '@mui/icons-material/Logout';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CalculateIcon from '@mui/icons-material/Calculate';
import PublicIcon from '@mui/icons-material/Public';
import { logoutUser, getCurrentUser } from "../auth";
import CompanySelector from "../components/CompanySelector";
import "./Dashboard.css";

const NAV_GROUPS = [
  {
    title: "GENEL BAKIŞ",
    items: [{ to: "/dashboard", label: "Panel Özet", icon: <DashboardIcon fontSize="small" />, exact: true }],
  },
  {
    title: "KOLAYBI ENTEGRASYONU",
    items: [
      {
        label: "Bağlantı & Senkronizasyon", icon: <SyncAltIcon fontSize="small" />, base: "/dashboard/kolaybi",
        children: [
          { to: "/dashboard/kolaybi", label: "Genel Ayarlar", icon: <SyncAltIcon fontSize="small" />, exact: true },
          { to: "/dashboard/kolaybi/faturalar", label: "Faturalar", icon: <ReceiptLongIcon fontSize="small" /> },
          { to: "/dashboard/kolaybi/irsaliyeler", label: "İrsaliyeler", icon: <LocalShippingIcon fontSize="small" /> },
          { to: "/dashboard/kolaybi/banka-hesaplari", label: "Banka Hesapları", icon: <AccountBalanceIcon fontSize="small" /> },
          { to: "/dashboard/kolaybi/kasalar", label: "Kasalar", icon: <AccountBalanceIcon fontSize="small" /> },
          { to: "/dashboard/kolaybi/kredi-kartlari", label: "Kredi Kartları", icon: <AccountBalanceIcon fontSize="small" /> },
          { to: "/dashboard/kolaybi/online-banka-hesaplari", label: "Online Banka Hesapları", icon: <AccountBalanceIcon fontSize="small" /> },
          { to: "/dashboard/kolaybi/cekler", label: "Çekler", icon: <ReceiptLongIcon fontSize="small" /> },
          { to: "/dashboard/kolaybi/senetler", label: "Senetler", icon: <ReceiptLongIcon fontSize="small" /> },
        ],
      },
    ],
  },
  {
    title: "SATIŞ / SATINALMA",
    items: [
      {
        label: "Cariler", icon: <PeopleIcon fontSize="small" />, base: "/dashboard/cari-",
        children: [
          { to: "/dashboard/cari-listesi", label: "Cari Listesi", icon: <ListAltIcon fontSize="small" /> },
          { to: "/dashboard/cari-giris", label: "Cari Kart Giriş", icon: <AddCircleOutlineIcon fontSize="small" /> },
        ],
      },
      {
        label: "Sipariş Yönetimi", icon: <ShoppingCartIcon fontSize="small" />, base: "/dashboard/siparis-",
        children: [
          { to: "/dashboard/siparis-listesi", label: "Sipariş Listesi", icon: <ListAltIcon fontSize="small" /> },
          { to: "/dashboard/siparis-giris", label: "Yeni Sipariş Girişi", icon: <AddCircleOutlineIcon fontSize="small" /> },
        ],
      },
      { to: "/dashboard/irsaliye", label: "İrsaliye", icon: <LocalShippingIcon fontSize="small" /> },
      { to: "/dashboard/numuneler", label: "Numune Takip", icon: <Inventory2Icon fontSize="small" /> },
      {
        label: "Faturalar", icon: <ReceiptLongIcon fontSize="small" />, base: "/dashboard/faturalar",
        children: [
          { to: "/dashboard/faturalar/liste", label: "Fatura Listesi", icon: <ListAltIcon fontSize="small" /> },
          { to: "/dashboard/faturalar/satis", label: "Satış Faturaları", icon: <ReceiptLongIcon fontSize="small" /> },
          { to: "/dashboard/faturalar/alis", label: "Alış Faturaları", icon: <ReceiptLongIcon fontSize="small" /> },
        ],
      },
      {
        label: "Finans (Kasa/Banka)", icon: <AccountBalanceIcon fontSize="small" />, base: "/dashboard/finans",
        children: [
          { to: "/dashboard/finans", label: "Hareketler (Tahsilat/Ödeme)", icon: <SyncAltIcon fontSize="small" />, exact: true },
          { to: "/dashboard/finans/hesaplar", label: "Banka Hesapları", icon: <AccountBalanceIcon fontSize="small" /> },
        ],
      },
      {
        label: "Platform Siparişleri", icon: <SyncAltIcon fontSize="small" />, base: "/dashboard/platform-",
        children: [
          { to: "/dashboard/platform-tumu", label: "Tüm Platformlar", icon: <ListAltIcon fontSize="small" /> },
          { to: "/dashboard/platform-import", label: "Excel İçe Aktar", icon: <SyncAltIcon fontSize="small" /> },
        ],
      },
      { to: "/dashboard/ihracat", label: "İhracat Modülü", icon: <PublicIcon fontSize="small" /> },
    ],
  },
  {
    title: "OPERASYON",
    items: [
      {
        label: "Ürün ve Hizmetler", icon: <Inventory2Icon fontSize="small" />, base: "/dashboard/urun-",
        children: [
          { to: "/dashboard/urun-listesi", label: "Ürün Listesi", icon: <ListAltIcon fontSize="small" /> },
          { to: "/dashboard/urun-giris", label: "Ürün Kart Giriş", icon: <AddCircleOutlineIcon fontSize="small" /> },
        ],
      },
      { to: "/dashboard/receteler", label: "Üretim Reçeteleri", icon: <ScienceIcon fontSize="small" /> },
      { to: "/dashboard/uretim-maliyeti", label: "Üretim Maliyeti / Başabaş", icon: <CalculateIcon fontSize="small" /> },
      {
        label: "Teklif Yönetimi", icon: <RequestQuoteIcon fontSize="small" />, base: "/dashboard/teklif",
        children: [
          { to: "/dashboard/teklif/liste", label: "Teklif Listesi", icon: <ListAltIcon fontSize="small" /> },
          { to: "/dashboard/teklif/satis", label: "Satış Teklifleri", icon: <RequestQuoteIcon fontSize="small" /> },
          { to: "/dashboard/teklif/alis", label: "Alış Teklifleri", icon: <RequestQuoteIcon fontSize="small" /> },
          { to: "/dashboard/teklif-talepleri", label: "Malzeme Teklif Talepleri", icon: <RequestQuoteIcon fontSize="small" /> },
        ],
      },
      { to: "/dashboard/fason", label: "Fason Takip", icon: <FactoryIcon fontSize="small" /> },
      { to: "/dashboard/personel", label: "Personel", icon: <BadgeIcon fontSize="small" /> },
    ],
  },
  {
    title: "RAPORLAR",
    items: [
      { to: "/dashboard/raporlar", label: "Finansal Raporlar", icon: <AssessmentIcon fontSize="small" /> },
    ],
  },
  {
    title: "KAYITLAR",
    items: [
      { to: "/dashboard/kayitlar", label: "Tüm Kayıtlar", icon: <ListAltIcon fontSize="small" /> },
      { to: "/menu", label: "Tüm Modüller", icon: <AppsIcon fontSize="small" /> },
    ],
  },
];

const YONETIM_GROUP = {
  title: "YÖNETİM",
  items: [
    { to: "/dashboard/kullanicilar", label: "Kullanıcılar", icon: <ManageAccountsIcon fontSize="small" /> },
  ],
};

const PAGE_TITLES = {
  "/dashboard": "Panel Özet",
  "/dashboard/cari-listesi": "Cari Listesi",
  "/dashboard/cari-giris": "Cari Kart Giriş",
  "/dashboard/siparis-listesi": "Sipariş Listesi",
  "/dashboard/siparis-giris": "Yeni Sipariş Girişi",
  "/dashboard/irsaliye": "İrsaliye",
  "/dashboard/numuneler": "Numune Takip",
  "/dashboard/faturalar/liste": "Fatura Listesi",
  "/dashboard/faturalar/satis": "Satış Faturaları",
  "/dashboard/faturalar/alis": "Alış Faturaları",
  "/dashboard/kolaybi": "KolayBi Entegrasyonu",
  "/dashboard/kolaybi/faturalar": "KolayBi Faturaları",
  "/dashboard/kolaybi/irsaliyeler": "KolayBi İrsaliyeleri",
  "/dashboard/kolaybi/banka-hesaplari": "KolayBi Banka Hesapları",
  "/dashboard/kolaybi/kasalar": "KolayBi Kasalar",
  "/dashboard/kolaybi/kredi-kartlari": "KolayBi Kredi Kartları",
  "/dashboard/kolaybi/online-banka-hesaplari": "KolayBi Online Banka Hesapları",
  "/dashboard/kolaybi/cekler": "KolayBi Çekler",
  "/dashboard/kolaybi/senetler": "KolayBi Senetler",
  "/dashboard/finans": "Finans (Kasa/Banka)",
  "/dashboard/ihracat": "İhracat Modülü",
  "/dashboard/finans/hesaplar": "Banka Hesapları",
  "/dashboard/personel": "Personel",
  "/dashboard/platform-import": "Excel İçe Aktar",
  "/dashboard/platform-tumu": "Tüm Platformlar",
  "/dashboard/urun-listesi": "Ürün Listesi",
  "/dashboard/urun-giris": "Ürün Kart Giriş",
  "/dashboard/receteler": "Üretim Reçeteleri",
  "/dashboard/uretim-maliyeti": "Üretim Maliyeti / Başabaş",
  "/dashboard/teklif/liste": "Teklif Listesi",
  "/dashboard/teklif/satis": "Satış Teklifleri",
  "/dashboard/teklif/alis": "Alış Teklifleri",
  "/dashboard/teklif-talepleri": "Malzeme Teklif Talepleri",
  "/dashboard/fason": "Fason Takip",
  "/dashboard/raporlar": "Finansal Raporlar",
  "/dashboard/kayitlar": "Tüm Kayıtlar",
  "/dashboard/kullanicilar": "Kullanıcılar",
};

function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getCurrentUser();
  const isMainDashboard = location.pathname === "/dashboard" || location.pathname === "/dashboard/";
  const pageTitle = PAGE_TITLES[location.pathname] || "Modül";

  const handleLogout = () => {
    logoutUser();
    navigate("/login");
  };

  const isActive = (item) =>
    item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);

  const isGroupActive = (item) => item.children.some(c => location.pathname.startsWith(c.to));

  const [openGroups, setOpenGroups] = useState(() => {
    const initial = {};
    NAV_GROUPS.forEach(g => g.items.forEach(item => {
      if (item.children) initial[item.label] = item.children.some(c => location.pathname.startsWith(c.to));
    }));
    return initial;
  });

  const toggleGroup = (label) => setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));

  const navGroups = useMemo(
    () => (user?.role === "Yönetici" ? [...NAV_GROUPS, YONETIM_GROUP] : NAV_GROUPS),
    [user?.role]
  );

  // --- Bildirimler (kritik stok, vadesi geçmiş fatura, süresi dolan teklif) ---
  // --- Menü arama (Ctrl+K) ---
  const searchInputRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const searchIndex = useMemo(() => {
    const flat = [];
    navGroups.forEach((group) => {
      group.items.forEach((item) => {
        if (item.children) {
          item.children.forEach((child) => flat.push({ label: child.label, to: child.to, group: group.title }));
        } else {
          flat.push({ label: item.label, to: item.to, group: group.title });
        }
      });
    });
    return flat;
  }, [navGroups]);

  const searchResults = useMemo(() => {
    const q = searchTerm.trim().toLocaleLowerCase("tr-TR");
    if (!q) return [];
    return searchIndex.filter((r) => r.label.toLocaleLowerCase("tr-TR").includes(q)).slice(0, 8);
  }, [searchTerm, searchIndex]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const goToSearchResult = (to) => {
    setSearchTerm("");
    setSearchOpen(false);
    navigate(to);
  };

  const [bildirimler, setBildirimler] = useState(null);
  const [bildirimAcik, setBildirimAcik] = useState(false);

  useEffect(() => {
    const fetchBildirimler = () => {
      axios.get("http://localhost:5000/api/bildirimler")
        .then(res => setBildirimler(res.data))
        .catch(() => {});
    };
    fetchBildirimler();
    const interval = setInterval(fetchBildirimler, 5 * 60 * 1000); // 5 dakikada bir yenile
    return () => clearInterval(interval);
  }, []);

  const bildirimeGit = (path) => {
    setBildirimAcik(false);
    navigate(path);
  };

  return (
    <div className="db-layout">
      {/* SIDEBAR */}
      <aside className="db-sidebar">
        <div className="db-logo">
          <div className="db-logo-icon">E</div>
          <div>
            <div className="db-logo-title">ERP Sistemi</div>
            <div className="db-logo-sub">{user?.name || "Kullanıcı"}</div>
          </div>
        </div>

        <nav className="db-nav">
          {navGroups.map((group) => (
            <div key={group.title} className="db-nav-group">
              <div className="db-nav-group-title">{group.title}</div>
              {group.items.map((item) => (
                item.children ? (
                  <div key={item.label} className="db-nav-parent">
                    <div
                      className={`db-nav-item db-nav-parent-toggle ${isGroupActive(item) ? "active" : ""}`}
                      onClick={() => toggleGroup(item.label)}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                      <ExpandMoreIcon
                        fontSize="small"
                        className="db-nav-caret"
                        style={{ transform: openGroups[item.label] ? "rotate(180deg)" : "rotate(0deg)" }}
                      />
                    </div>
                    {openGroups[item.label] && (
                      <div className="db-nav-children">
                        {item.children.map((child) => (
                          <Link
                            key={child.to}
                            to={child.to}
                            className={`db-nav-item db-nav-child ${isActive(child) ? "active" : ""}`}
                          >
                            {child.icon}
                            <span>{child.label}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`db-nav-item ${isActive(item) ? "active" : ""}`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                )
              ))}
            </div>
          ))}
        </nav>

        <button className="db-logout" onClick={handleLogout}>
          <LogoutIcon fontSize="small" />
          Çıkış Yap
        </button>
      </aside>

      {/* MAIN */}
      <div className="db-main">
        <header className="db-topbar">
          <div className="db-breadcrumb">
            ERP Sistemi <span>/</span> <strong>{pageTitle}</strong>
          </div>
          <div className="db-topbar-search">
            <input
              ref={searchInputRef}
              placeholder="Menü, sayfa ara..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
            />
            <kbd>Ctrl K</kbd>
            {searchOpen && searchTerm.trim() && (
              <div className="db-search-results">
                {searchResults.length === 0 && <div className="db-search-empty">Sonuç bulunamadı</div>}
                {searchResults.map((r) => (
                  <div key={r.to} className="db-search-result" onMouseDown={() => goToSearchResult(r.to)}>
                    <span className="db-search-result-label">{r.label}</span>
                    <span className="db-search-result-group">{r.group}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="db-topbar-right">
            <CompanySelector />
            <div className="db-bildirim-wrapper">
              <button className="db-icon-btn" onClick={() => setBildirimAcik(!bildirimAcik)}>
                <NotificationsNoneIcon fontSize="small" />
                {bildirimler && bildirimler.toplamSayi > 0 && (
                  <span className="db-bildirim-badge">{bildirimler.toplamSayi > 99 ? "99+" : bildirimler.toplamSayi}</span>
                )}
              </button>
              {bildirimAcik && (
                <div className="db-bildirim-panel">
                  <div className="db-bildirim-panel-header">Bildirimler</div>
                  {(!bildirimler || bildirimler.toplamSayi === 0) && (
                    <div className="db-bildirim-bos">Şu an bekleyen bildirim yok 👍</div>
                  )}
                  {bildirimler && bildirimler.kritikStok.length > 0 && (
                    <div className="db-bildirim-grup">
                      <div className="db-bildirim-grup-baslik">📦 Kritik Stok ({bildirimler.kritikStok.length})</div>
                      {bildirimler.kritikStok.slice(0, 5).map(u => (
                        <div key={u.UrunId} className="db-bildirim-item" onClick={() => bildirimeGit("/dashboard/urun-listesi")}>
                          <strong>{u.UrunAdi}</strong>
                          <span>{u.StokMiktari} / kritik: {u.KritikStokSeviyesi}</span>
                        </div>
                      ))}
                      {bildirimler.kritikStok.length > 5 && <div className="db-bildirim-daha">+{bildirimler.kritikStok.length - 5} ürün daha</div>}
                    </div>
                  )}
                  {bildirimler && bildirimler.vadesiGecmisFaturalar.length > 0 && (
                    <div className="db-bildirim-grup">
                      <div className="db-bildirim-grup-baslik">⏰ Vadesi Geçmiş Fatura ({bildirimler.vadesiGecmisFaturalar.length})</div>
                      {bildirimler.vadesiGecmisFaturalar.slice(0, 5).map(f => (
                        <div key={f.FaturaId} className="db-bildirim-item" onClick={() => bildirimeGit("/dashboard/raporlar")}>
                          <strong>{f.CariAdi}</strong>
                          <span>{f.FaturaKodu} — {f.GecikmeGunSayisi} gün gecikti — {Number(f.GenelToplam).toLocaleString()} ₺</span>
                        </div>
                      ))}
                      {bildirimler.vadesiGecmisFaturalar.length > 5 && <div className="db-bildirim-daha">+{bildirimler.vadesiGecmisFaturalar.length - 5} fatura daha</div>}
                    </div>
                  )}
                  {bildirimler && bildirimler.sureBitenTeklifler.length > 0 && (
                    <div className="db-bildirim-grup">
                      <div className="db-bildirim-grup-baslik">📋 Süresi Dolan/Dolacak Teklif ({bildirimler.sureBitenTeklifler.length})</div>
                      {bildirimler.sureBitenTeklifler.slice(0, 5).map(t => (
                        <div key={t.TeklifId} className="db-bildirim-item" onClick={() => bildirimeGit("/dashboard/teklif/liste")}>
                          <strong>{t.CariAdi}</strong>
                          <span>{t.TeklifKodu} — {t.KalanGun >= 0 ? `${t.KalanGun} gün kaldı` : `${Math.abs(t.KalanGun)} gün önce doldu`}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="db-avatar">{(user?.name || "K").charAt(0)}</div>
          </div>
        </header>

        <div className="db-content">
          {isMainDashboard ? (
            <DashboardHome user={user} navigate={navigate} />
          ) : (
            <Outlet />
          )}
        </div>
      </div>
    </div>
  );
}

function DashboardHome({ user, navigate }) {
  const today = new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const [stats, setStats] = useState({ cariler: null, urunler: null, siparisler: null });
  const [trend, setTrend] = useState([]);

  useEffect(() => {
    const API_URL = "http://localhost:5000/api";
    Promise.all([
      axios.get(`${API_URL}/cariler`).then(r => r.data.length).catch(() => 0),
      axios.get(`${API_URL}/urunler`).then(r => r.data.length).catch(() => 0),
      axios.get(`${API_URL}/siparisler`).then(r => r.data.filter(s => s.Durum === "YENİ").length).catch(() => 0),
    ]).then(([cariler, urunler, siparisler]) => setStats({ cariler, urunler, siparisler }));

    axios.get(`${API_URL}/raporlar/aylik-trend`).then(r => setTrend(r.data)).catch(() => setTrend([]));
  }, []);

  const maxTutar = Math.max(1, ...trend.map(t => Math.max(t.satis, t.alis)));

  return (
    <div>
      <div className="db-greeting">
        <div className="db-greeting-date">{today.toUpperCase()}</div>
        <h1>Hoş geldin, {(user?.name || "Kullanıcı").split(" ")[0]}</h1>
        <p>İşletmenin bugününü tek ekrandan yönet.</p>
      </div>

      <div className="erp-stat-grid">
        <div className="erp-stat-card">
          <div className="erp-stat-icon"><PeopleIcon fontSize="small" style={{ color: "#2563eb" }} /></div>
          <div>
            <div className="erp-stat-label">Kayıtlı Cariler</div>
            <div className="erp-stat-value">{stats.cariler ?? "—"}</div>
          </div>
        </div>
        <div className="erp-stat-card">
          <div className="erp-stat-icon success"><Inventory2Icon fontSize="small" style={{ color: "#16a34a" }} /></div>
          <div>
            <div className="erp-stat-label">Ürün Çeşidi</div>
            <div className="erp-stat-value">{stats.urunler ?? "—"}</div>
          </div>
        </div>
        <div className="erp-stat-card">
          <div className="erp-stat-icon warn"><ShoppingCartIcon fontSize="small" style={{ color: "#d97706" }} /></div>
          <div>
            <div className="erp-stat-label">Açık Siparişler</div>
            <div className="erp-stat-value">{stats.siparisler ?? "—"}</div>
          </div>
        </div>
      </div>

      {trend.length > 0 && (
        <>
          <div className="db-section-title">Son 6 Ay — Satış / Alış / Net Kâr</div>
          <div className="db-trend-card">
            <div className="db-trend-legend">
              <span><i className="db-trend-dot satis" /> Satış</span>
              <span><i className="db-trend-dot alis" /> Alış</span>
              <span><i className="db-trend-dot net" /> Net (Satış - Alış)</span>
            </div>
            <div className="db-trend-chart">
              {trend.map(t => (
                <div className="db-trend-ay" key={t.label}>
                  <div className="db-trend-bars">
                    <div className="db-trend-bar satis" style={{ height: `${(t.satis / maxTutar) * 100}%` }} title={`Satış: ${t.satis.toLocaleString()} ₺`} />
                    <div className="db-trend-bar alis" style={{ height: `${(t.alis / maxTutar) * 100}%` }} title={`Alış: ${t.alis.toLocaleString()} ₺`} />
                  </div>
                  <div className={`db-trend-net ${t.net >= 0 ? "pozitif" : "negatif"}`}>
                    {t.net >= 0 ? "+" : ""}{(t.net / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}k
                  </div>
                  <div className="db-trend-label">{t.label}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="db-section-title">Hızlı Erişim</div>
      <div className="db-quick-grid">
        <QuickCard icon={<PeopleIcon />} title="Cari Listesi" desc="Kayıtlı müşteri / tedarikçileri görüntüle" onClick={() => navigate("/dashboard/cari-listesi")} />
        <QuickCard icon={<PeopleIcon />} title="Cari Kart Giriş" desc="Yeni müşteri / tedarikçi ekle" onClick={() => navigate("/dashboard/cari-giris")} />
        <QuickCard icon={<ShoppingCartIcon />} title="Sipariş Listesi" desc="Siparişleri görüntüle ve filtrele" onClick={() => navigate("/dashboard/siparis-listesi")} />
        <QuickCard icon={<ShoppingCartIcon />} title="Yeni Sipariş Girişi" desc="Alış / satış siparişi oluştur" onClick={() => navigate("/dashboard/siparis-giris")} />
        <QuickCard icon={<LocalShippingIcon />} title="İrsaliye" desc="Alış / satış irsaliyesi düzenle" onClick={() => navigate("/dashboard/irsaliye")} />
        <QuickCard icon={<Inventory2Icon />} title="Numune Takip" desc="Kime, ne zaman numune verildiğini gör" onClick={() => navigate("/dashboard/numuneler")} />
        <QuickCard icon={<RequestQuoteIcon />} title="Teklif Listesi" desc="Tüm alış/satış tekliflerini süreleriyle gör" onClick={() => navigate("/dashboard/teklif/liste")} />
        <QuickCard icon={<RequestQuoteIcon />} title="Satış Teklifi Oluştur" desc="Müşteriye ürün/firma bazlı teklif hazırla" onClick={() => navigate("/dashboard/teklif/satis")} />
        <QuickCard icon={<RequestQuoteIcon />} title="Alış Teklifi Oluştur" desc="Tedarikçiden teklif kaydı oluştur" onClick={() => navigate("/dashboard/teklif/alis")} />
        <QuickCard icon={<AssessmentIcon />} title="Finansal Raporlar" desc="Vadesi geçmiş, yaşlandırma, ürün karlılığı" onClick={() => navigate("/dashboard/raporlar")} />
        <QuickCard icon={<ReceiptLongIcon />} title="Fatura Listesi" desc="Tüm alış / satış faturalarını görüntüle" onClick={() => navigate("/dashboard/faturalar/liste")} />
        <QuickCard icon={<ReceiptLongIcon />} title="Satış Faturaları" desc="Satış faturası düzenle" onClick={() => navigate("/dashboard/faturalar/satis")} />
        <QuickCard icon={<ReceiptLongIcon />} title="Alış Faturaları" desc="Alış faturası düzenle" onClick={() => navigate("/dashboard/faturalar/alis")} />
        <QuickCard icon={<AccountBalanceIcon />} title="Finans (Kasa/Banka)" desc="Tahsilat, ödeme, bakiye takibi" onClick={() => navigate("/dashboard/finans")} />
        <QuickCard icon={<PublicIcon />} title="İhracat Modülü" desc="İhracat müşterileri, gümrük/nakliye evrakları, döviz bozum" onClick={() => navigate("/dashboard/ihracat")} />
        <QuickCard icon={<AccountBalanceIcon />} title="Banka Hesapları" desc="Kasa / banka hesaplarını yönet" onClick={() => navigate("/dashboard/finans/hesaplar")} />
        <QuickCard icon={<BadgeIcon />} title="Personel" desc="Özlük, izin, puantaj, maaş/prim" onClick={() => navigate("/dashboard/personel")} />
        <QuickCard icon={<SyncAltIcon />} title="Tüm Platformlar" desc="Trendyol, Hepsiburada, N11 vb. siparişleri gör" onClick={() => navigate("/dashboard/platform-tumu")} />
        <QuickCard icon={<SyncAltIcon />} title="Platform Siparişi İçe Aktar" desc="Excel içe aktar + Trendyol canlı siparişler" onClick={() => navigate("/dashboard/platform-import")} />
        <QuickCard icon={<Inventory2Icon />} title="Ürün Listesi" desc="Stok ve hizmet kartlarını görüntüle" onClick={() => navigate("/dashboard/urun-listesi")} />
        <QuickCard icon={<Inventory2Icon />} title="Ürün Kart Giriş" desc="Yeni ürün / hizmet ekle" onClick={() => navigate("/dashboard/urun-giris")} />
        <QuickCard icon={<ScienceIcon />} title="Üretim Reçeteleri" desc="BOM / reçete tanımla, üretim yap" onClick={() => navigate("/dashboard/receteler")} />
        <QuickCard icon={<CalculateIcon />} title="Üretim Maliyeti / Başabaş" desc="İşçilik, genel gider, başabaş noktası" onClick={() => navigate("/dashboard/uretim-maliyeti")} />
        <QuickCard icon={<FactoryIcon />} title="Fason Takip" desc="Dışarıya gönderilen malları izle" onClick={() => navigate("/dashboard/fason")} />
        <QuickCard icon={<ListAltIcon />} title="Tüm Kayıtlar" desc="Her şeyi tek ekranda gör" onClick={() => navigate("/dashboard/kayitlar")} />
      </div>
    </div>
  );
}

function QuickCard({ icon, title, desc, onClick }) {
  return (
    <div className="db-quick-card" onClick={onClick}>
      <div className="db-quick-icon">{icon}</div>
      <div className="db-quick-title">{title}</div>
      <div className="db-quick-desc">{desc}</div>
    </div>
  );
}

export default Dashboard;
