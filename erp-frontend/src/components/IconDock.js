import React, { useState } from "react";
import { Link } from "react-router-dom";
import menuItems from "../data/menuItems";
import "./IconDock.css";

const IconDock = () => {
  const [popupOpen, setPopupOpen] = useState(false);

  const handleMouseEnter = () => setPopupOpen(true);
  const handleMouseLeave = () => setPopupOpen(false);
  const togglePopup = () => setPopupOpen(!popupOpen);

  return (
    <>
      {/* Soldaki dock */}
      <div
        className="icon-dock"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {menuItems.map((group, gi) =>
          group.items.slice(0, 5).map((item, idx) => (
            <div
              key={`${gi}-${idx}`}
              className="dock-icon"
              title={item.name}
              onClick={togglePopup} // mobile tıklama için
            >
              {item.icon || "📌"}
            </div>
          ))
        )}
      </div>

      {/* Popup */}
      {popupOpen && (
        <div className="icon-popup-overlay" onClick={togglePopup}>
          <div
            className="icon-popup"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="popup-close-btn" onClick={togglePopup}>
              ✖
            </button>

            {menuItems.map((group, gi) => (
              <div key={gi} className="popup-group">
                <h3>{group.group}</h3>
                <div className="popup-grid">
                  {group.items.map((item, idx) => (
                    <Link
                      key={idx}
                      to={`/${item.path}`}
                      className="popup-grid-item"
                      onClick={togglePopup}
                    >
                      <div className="popup-icon">{item.icon}</div>
                      <div className="popup-text">{item.name}</div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default IconDock;
