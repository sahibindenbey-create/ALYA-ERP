import React from "react";
import axios from "axios";
import ReceteYonetimPageV3 from "./ReceteYonetimPageV3";
import Ahbrd1301ReceptTemplate from "./Ahbrd1301ReceptTemplateV2";
import ReceteGercekUretimPanel from "../components/ReceteGercekUretimPanelV2";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

export default function ReceteYonetimPage() {
  const [version, setVersion] = React.useState(0);
  const [receteler, setReceteler] = React.useState([]);

  React.useEffect(() => {
    let alive = true;
    axios
      .get(`${API_URL}/recete-yonetim`)
      .then(({ data }) => {
        if (alive) setReceteler(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (alive) setReceteler([]);
      });
    return () => {
      alive = false;
    };
  }, [version]);

  return (
    <div className="recete-page-shell" key={version}>
      <ReceteYonetimPageV3 />
      <div className="recete-page-tools">
        <Ahbrd1301ReceptTemplate onDone={() => setVersion((v) => v + 1)} />
      </div>
      <ReceteGercekUretimPanel receteler={receteler} />
    </div>
  );
}
