import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import menuItems from "../data/menuItems";
import { getCurrentUser, logoutUser } from "../auth";
import CompanySelector from "./CompanySelector";
import "./MainMenu.css";

const ACTIVE_MODULES = [
  "cari-listesi", "cari-giris", "siparis-listesi", "siparis-giris", "irsaliye",
  "faturalar/satis", "faturalar/alis", "finans", "personel",
  "platform-import", "urun-listesi", "urun-giris", "receteler",
  "teklif-talepleri", "fason", "kayitlar"
];

const MainMenu = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const navigate = useNavigate();
  const user = getCurrentUser();

  const handleHomeClick = () => {
    setSearchTerm("");
    setCategoryFilter("all");
  };

  const handleLogout = () => {
    logoutUser();
    navigate("/login");
  };

  const handleItemClick = (item) => {
    navigate(`/dashboard/${item.path}`);
  };

  const groupsToShow = categoryFilter === "all"
    ? menuItems
    : menuItems.filter((group) => group.group.toLowerCase() === categoryFilter);

  const search = searchTerm.trim().toLowerCase();
  const filteredMenu = groupsToShow
    .flatMap((group) => group.items)
    .filter((item) => item.name.toLowerCase().includes(search));

  return (
    <main className="main-menu-wrapper">
      <header className="top-bar">
        <div className="logo" aria-label="ALYA ERP">ALYA ERP</div>

        <button type="button" className="home-button" onClick={handleHomeClick}>
          <span className="home-button-icon" aria-hidden="true">⌂</span>
          Ana Sayfa
        </button>

        <CompanySelector />

        <div className="user-info">
          <div className="user-copy">
            <div className="user-name">{user?.name || "Kullanıcı"}</div>
            <div className="user-role">{user?.role || "Yönetici"}</div>
          </div>
          <button
            type="button"
            className="settings-btn"
            title="Çıkış Yap"
            aria-label="Çıkış Yap"
            onClick={handleLogout}
          >
            <span aria-hidden="true">↪</span>
          </button>
        </div>
      </header>

      <section className="search-bar" aria-label="Modül arama">
        <span className="search-icon" aria-hidden="true">⌕</span>
        <input
          type="search"
          placeholder="Modül veya işlem ara..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          aria-label="Modül veya işlem ara"
        />
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          aria-label="Kategori filtresi"
        >
          <option value="all">Tüm Modüller</option>
          <option value="uygulamalar">Uygulamalar</option>
          <option value="eklentiler">Eklentiler</option>
          <option value="sistem">Sistem</option>
        </select>
      </section>

      <section className="menu-grid" aria-label="ERP modülleri">
        {filteredMenu.map((item, idx) => {
          const isActive = ACTIVE_MODULES.includes(item.path);

          return (
            <button
              type="button"
              key={`${item.path}-${idx}`}
              className={`menu-icon-card${isActive ? " is-active" : ""}`}
              onClick={() => handleItemClick(item)}
            >
              <span className="menu-icon" aria-hidden="true">{item.icon}</span>
              <span className="menu-name">{item.name}</span>
              {isActive && <span className="active-badge">AKTİF</span>}
            </button>
          );
        })}

        {filteredMenu.length === 0 && (
          <div className="empty-menu-state">
            <strong>Modül bulunamadı</strong>
            <span>Arama kriterinizi veya kategori filtresini değiştirin.</span>
          </div>
        )}
      </section>
    </main>
  );
};

export default MainMenu;
