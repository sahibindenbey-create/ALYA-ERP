import React, { useState } from "react";
import CariForm from "../components/CariForm"; // Cari form componenti

const CarilerPage = () => {
  // formVisible state: Cari Kart butonuna tıklayınca form gösterilecek
  const [formVisible, setFormVisible] = useState(false);

  return (
    <div className="cariler-page-container" style={{ padding: "20px" }}>
      <h1>Cariler</h1>

      {/* Cari Kart Butonu */}
      <button
        onClick={() => setFormVisible(!formVisible)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 15px",
          fontSize: "16px",
          cursor: "pointer",
          marginTop: "20px"
        }}
      >
        <span role="img" aria-label="cari">📝</span> {/* Cari Kart ikonu */}
        Cari Kart
      </button>

      {/* Cari Formu göster/gizle */}
      {formVisible && (
        <div style={{ marginTop: "20px" }}>
          <CariForm />
        </div>
      )}
    </div>
  );
};

export default CarilerPage;
