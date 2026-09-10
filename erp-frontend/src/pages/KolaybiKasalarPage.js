import React from "react";
import KolaybiFinansListPage, { kasalarColumns } from "./KolaybiFinansListPage";

const KolaybiKasalarPage = () => (
  <KolaybiFinansListPage
    title="KolayBi Kasalar"
    description="KolayBi'de tanımlı nakit kasalarının listesi (5 dakikada bir otomatik güncellenir)."
    apiPath="/kolaybi/finans/kasalar"
    columns={kasalarColumns}
    tip="safe_deposit"
  />
);

export default KolaybiKasalarPage;
