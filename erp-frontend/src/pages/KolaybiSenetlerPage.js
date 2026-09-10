import React from "react";
import KolaybiFinansListPage, { cekSenetColumns } from "./KolaybiFinansListPage";

const KolaybiSenetlerPage = () => (
  <KolaybiFinansListPage
    title="KolayBi Senetler"
    description="KolayBi'de tanımlı senetlerin listesi (5 dakikada bir otomatik güncellenir)."
    apiPath="/kolaybi/finans/senetler"
    columns={cekSenetColumns}
    tip="bond"
  />
);

export default KolaybiSenetlerPage;
