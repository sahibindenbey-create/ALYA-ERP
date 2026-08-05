import React from "react";
import "./HeaderBar.css";

const HeaderBar = ({ userMenuOpen, toggleUserMenu }) => {
  return (
    <div className="header-bar">
      <div className="header-left">
        <div className="logo">ERP</div>
        <div className="home-icon">🏠</div>
      </div>
      <div className="header-right">
        <div className="user-section" onClick={toggleUserMenu}>
          <span className="user-name">John Doe</span>
          <span className="settings-icon">⚙️</span>
        </div>
        {userMenuOpen && (
          <div className="user-dropdown">
            <ul>
              <li>Profil</li>
              <li>Ayarlar</li>
              <li>Çıkış</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default HeaderBar;
