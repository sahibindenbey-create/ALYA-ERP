import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import menuItems from "../data/menuItems";
import "./Sidebar.css";

const Sidebar = ({ collapsed, onToggle }) => {
  const location = useLocation();
  const [popupOpen, setPopupOpen] = useState(false);

  const handleToggleSidebar = () => {
    onToggle(!collapsed);
    setPopupOpen(false); // Popup kapansın sidebar genişleyince
  };

  const openPopup = () => {
    if (collapsed) setPopupOpen(true);
  };

  const closePopup = () => setPopupOpen(false);

  return (
    <>
      {/* Dar sidebar */}
      <div className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          <h3>{collapsed ? "ERP" : "ERP Panel"}</h3>
          <button className="toggle-btn" onClick={handleToggleSidebar}>
            {collapsed ? "➡️" : "⬅️"}
          </button>
        </div>

        {/* Menü dar halde sadece ikonlar, tıklanınca popup açılır */}
        <div className="menu-groups">
          {menuItems.map((group, i) => (
            <div key={i} className="menu-group">
              {!collapsed && <div className="group-title">{group.group}</div>}
              <ul>
                {group.items.map((item, j) => (
                  <li
                    key={j}
                    className="menu-item"
                    onClick={openPopup}
                    // sadece collapsed ise popup aç
                    style={{ cursor: collapsed ? "pointer" : "default" }}
                  >
                    <Link
                      to={`/${item.path}`}
                      className={`menu-link ${
                        location.pathname === `/${item.path}` ? "active" : ""
                      }`}
                    >
                      <span
                        className="menu-icon"
                        aria-label={item.name}
                        role="img"
                      >
                        {item.icon || "📌"}
                      </span>
                      {!collapsed && (
                        <span className="menu-text">{item.name}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Popup overlay (sadece collapsed && popupOpen ise) */}
      {collapsed && popupOpen && (
        <div className="sidebar-popup-overlay" onClick={closePopup}>
          <div
            className="sidebar-popup"
            onClick={(e) => e.stopPropagation()} // overlay dışında tıklama kapatır
          >
            <button className="popup-close-btn" onClick={closePopup}>
              ✖
            </button>
            <h2>Applications</h2>
            <div className="popup-grid">
              {menuItems[0].items.map((item, idx) => (
                <Link
                  to={`/${item.path}`}
                  key={idx}
                  className="popup-grid-item"
                  onClick={closePopup}
                >
                  <div className="popup-icon">{item.icon}</div>
                  <div className="popup-text">{item.name}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
