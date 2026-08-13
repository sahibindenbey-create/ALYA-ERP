import React, { useEffect, useState } from "react";
import { useNavigate, Outlet, Link, useLocation } from "react-router-dom";
import axios from "axios";
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import ScienceIcon from '@mui/icons-material/Science';
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
import { logoutUser, getCurrentUser } from "../auth";
import "./Dashboard.css";

const NAV_GROUPS = [
  {
    title: "GENEL BAKIŞ",
    items: [{ to: "/dashboard", label: "Panel Özet", icon: <DashboardIcon fontSize="small" />, exact: true }],
  },
  {
    title: "SATIŞ / SATINALMA",
    items: [
      { to: "/dashboard/cari-yonetimi", label: "Cari Kartlar", icon: <PeopleIcon fontSize="small" /> },
      { to: "/dashboard/siparis-yonetimi", label: "Sipariş Girişi", icon: <ShoppingCartIcon fontSize="small" /> },
      { to: "/dashboard/irsaliye", label: "İrsaliye", icon: <LocalShippingIcon fontSize="small" /> },
      { to: "/dashboard/faturalar", label: "Faturalar", icon: <ReceiptLongIcon fontSize="small" /> },
      { to: "/dashboard/finans", label: "Finans (Kasa/Banka)", icon: <AccountBalanceIcon fontSize="small" /> },
      { to: "/dashboard/platform-import", label: "Platform Siparişleri", icon: <SyncAltIcon fontSize="small" /> },
    ],
  },
  {
    title: "OPERASYON",
    items: [
      { to: "/dashboard/urun-stoklar", label: "Ürün ve Hizmetler", icon: <Inventory2Icon fontSize="small" /> },
      { to: "/dashboard/receteler", label: "Üretim Reçeteleri", icon: <ScienceIcon fontSize="small" /> },
      { to: "/dashboard/fason", label: "Fason Takip", icon: <FactoryIcon fontSize="small" /> },
      { to: "/dashboard/personel", label: "Personel", icon: <BadgeIcon fontSize="small" /> },
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
  "/dashboard/cari-yonetimi": "Cari Kartlar",
  "/dashboard/siparis-yonetimi": "Sipariş Girişi",
  "/dashboard/irsaliye": "İrsaliye",
  "/dashboard/faturalar": "Faturalar",
  "/dashboard/finans": "Finans (Kasa/Banka)",
  "/dashboard/personel": "Personel",
  "/dashboard/platform-import": "Platform Siparişleri",
  "/dashboard/urun-stoklar": "Ürün ve Hizmetler",
  "/dashboard/receteler": "Üretim Reçeteleri",
  "/dashboard/fason": "Fason Takip",
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

  const navGroups = user?.role === "Yönetici" ? [...NAV_GROUPS, YONETIM_GROUP] : NAV_GROUPS;

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
                <Link
                  key={item.to}
                  to={item.to}
                  className={`db-nav-item ${isActive(item) ? "active" : ""}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
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
          <div className="db-topbar-right">
            <button className="db-icon-btn"><NotificationsNoneIcon fontSize="small" /></button>
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

  useEffect(() => {
    const API_URL = "http://localhost:5000/api";
    Promise.all([
      axios.get(`${API_URL}/cariler`).then(r => r.data.length).catch(() => 0),
      axios.get(`${API_URL}/urunler`).then(r => r.data.length).catch(() => 0),
      axios.get(`${API_URL}/siparisler`).then(r => r.data.filter(s => s.Durum === "YENİ").length).catch(() => 0),
    ]).then(([cariler, urunler, siparisler]) => setStats({ cariler, urunler, siparisler }));
  }, []);

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

      <div className="db-section-title">Hızlı Erişim</div>
      <div className="db-quick-grid">
        <QuickCard icon={<PeopleIcon />} title="Cari Kartlar" desc="Müşteri / tedarikçi yönetimi" onClick={() => navigate("/dashboard/cari-yonetimi")} />
        <QuickCard icon={<ShoppingCartIcon />} title="Sipariş Girişi" desc="Alış / satış siparişi oluştur" onClick={() => navigate("/dashboard/siparis-yonetimi")} />
        <QuickCard icon={<LocalShippingIcon />} title="İrsaliye" desc="Alış / satış irsaliyesi düzenle" onClick={() => navigate("/dashboard/irsaliye")} />
        <QuickCard icon={<ReceiptLongIcon />} title="Faturalar" desc="Alış / satış faturası düzenle" onClick={() => navigate("/dashboard/faturalar")} />
        <QuickCard icon={<AccountBalanceIcon />} title="Finans (Kasa/Banka)" desc="Tahsilat, ödeme, bakiye takibi" onClick={() => navigate("/dashboard/finans")} />
        <QuickCard icon={<BadgeIcon />} title="Personel" desc="Özlük, izin, puantaj, maaş/prim" onClick={() => navigate("/dashboard/personel")} />
        <QuickCard icon={<SyncAltIcon />} title="Platform Siparişleri" desc="Excel ile toplu içe aktar" onClick={() => navigate("/dashboard/platform-import")} />
        <QuickCard icon={<Inventory2Icon />} title="Ürün ve Hizmetler" desc="Stok ve hizmet kartlarını yönet" onClick={() => navigate("/dashboard/urun-stoklar")} />
        <QuickCard icon={<ScienceIcon />} title="Üretim Reçeteleri" desc="BOM / reçete tanımla, üretim yap" onClick={() => navigate("/dashboard/receteler")} />
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
