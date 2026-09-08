import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import menuItems from "../data/menuItems";
import AppsIcon from "@mui/icons-material/Apps";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ConstructionIcon from "@mui/icons-material/Construction";
import "./ModulePlaceholder.css";

const flatMenu = menuItems.flatMap((group) => group.items.map((item) => ({ ...item, group: group.group })));

const ModulePlaceholder = () => {
  const { modulePath } = useParams();
  const navigate = useNavigate();
  const current = flatMenu.find((item) => item.path === modulePath);

  return (
    <section className="module-cockpit">
      <div className="module-cockpit-head">
        <div>
          <div className="module-eyebrow">{current?.group || "ERP MODÜLÜ"}</div>
          <h1>{current?.name || "Modül"}</h1>
          <p>Bu alan ALYA-ERP modül yapısına hazırlandı. İşlevler modül bazında kademeli olarak devreye alınacaktır.</p>
        </div>
        <div className="module-big-icon">{current?.icon || "🛠️"}</div>
      </div>
      <div className="module-status-card">
        <div className="module-status-icon"><ConstructionIcon /></div>
        <div><strong>Geliştirme alanı</strong><span>Modül menüde tanımlı ve ERP yönlendirmesi hazır. Gerçek veri işlemleri ilgili backend servisi tamamlandığında aktif olacaktır.</span></div>
      </div>
      <div className="module-action-grid">
        <button onClick={() => navigate("/dashboard")}><AppsIcon /><span><b>Panel Özeti</b><small>Ana dashboard'a dön</small></span></button>
        <button onClick={() => navigate("/menu")}><AppsIcon /><span><b>Tüm Modüller</b><small>ERP modül kataloğunu aç</small></span></button>
        <button onClick={() => navigate(-1)}><ArrowBackIcon /><span><b>Önceki Ekran</b><small>Son ziyaret edilen sayfaya dön</small></span></button>
      </div>
    </section>
  );
};

export default ModulePlaceholder;
