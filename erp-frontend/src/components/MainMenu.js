import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import menuItems from "../data/menuItems";
import { getCurrentUser, logoutUser } from "../auth";
import "./MainMenu.css";

const ACTIVE_MODULES = [
  "cari-yonetimi", "siparis-yonetimi", "irsaliye", "faturalar", "finans", "personel",
  "platform-import", "urun-stoklar", "receteler", "fason", "kayitlar"
];

const MainMenu = () => {
  const [activeGroup, setActiveGroup] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const navigate = useNavigate();
  const user = getCurrentUser();

  const handleHomeClick = () => setActiveGroup(null);

  const handleLogout = () => {
    logoutUser();
    navigate("/login");
  };

  const handleItemClick = (item) => {
    navigate(`/dashboard/${item.path}`);
  };

  const groupsToShow = categoryFilter === "all"
    ? menuItems
    : menuItems.filter((g) => g.group.toLowerCase() === categoryFilter);

  const flatMenu = groupsToShow.flatMap((group) => group.items);
  const filteredMenu = flatMenu.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="main-menu-wrapper">
      {/* --- Üst Bar --- */}
      <div className="top-bar">
        <div className="logo">ERP LOGO</div>
        <div className="home-button" onClick={handleHomeClick}>
          🏠 Ana Sayfa
        </div>
        <div className="user-info">
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: "bold" }}>{user?.name || "Kullanıcı"}</div>
            <div style={{ fontSize: 11, opacity: 0.75 }}>{user?.role || "Yönetici"}</div>
          </div>
          <button className="settings-btn" title="Çıkış Yap" onClick={handleLogout}>
            🚪
          </button>
        </div>
      </div>

      {/* --- Arama ve Filtreleme --- */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="Modül veya işlem ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="all">Tümü</option>
          <option value="uygulamalar">Uygulamalar</option>
          <option value="eklentiler">Eklentiler</option>
          <option value="sistem">Sistem</option>
        </select>
      </div>

      {/* --- Ana Menü Grid --- */}
      <div className="menu-grid">
        {filteredMenu.map((item, idx) => (
          <div
            key={idx}
            className="menu-icon-card"
            onClick={() => handleItemClick(item)}
            style={ACTIVE_MODULES.includes(item.path) ? { border: "2px solid #27ae60" } : undefined}
          >
            <span className="menu-icon">{item.icon}</span>
            <span className="menu-name">{item.name}</span>
            {ACTIVE_MODULES.includes(item.path) && (
              <span style={{ fontSize: 9, color: "#27ae60", fontWeight: "bold", marginTop: 4 }}>
                AKTİF
              </span>
            )}
          </div>
        ))}
        {filteredMenu.length === 0 && (
          <p style={{ color: "#888" }}>Aramanızla eşleşen modül bulunamadı.</p>
        )}
      </div>
    </div>
  );
};

export default MainMenu;
