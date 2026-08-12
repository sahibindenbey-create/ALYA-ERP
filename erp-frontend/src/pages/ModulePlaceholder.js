import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import menuItems from "../data/menuItems";

const flatMenu = menuItems.flatMap((g) => g.items);

const ModulePlaceholder = () => {
  const { modulePath } = useParams();
  const navigate = useNavigate();
  const current = flatMenu.find((m) => m.path === modulePath);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        textAlign: "center",
        color: "#555",
      }}
    >
      <div style={{ fontSize: 64, marginBottom: 16 }}>{current?.icon || "🛠️"}</div>
      <h2 style={{ margin: "0 0 8px" }}>{current?.name || "Modül"}</h2>
      <p style={{ maxWidth: 420, color: "#888" }}>
        Bu modül henüz geliştirilme aşamasında. Şu an aktif olarak{" "}
        <strong>Cari Kartlar</strong> ve <strong>Sipariş Girişi</strong>{" "}
        modülleri kullanılabilir durumda.
      </p>
      <button
        onClick={() => navigate("/dashboard")}
        style={{
          marginTop: 20,
          padding: "10px 20px",
          background: "#1976d2",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        ⬅️ Panele Dön
      </button>
    </div>
  );
};

export default ModulePlaceholder;
