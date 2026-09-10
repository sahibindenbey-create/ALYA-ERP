import React from "react";
import KolaybiFinansListPage, { cekSenetColumns } from "./KolaybiFinansListPage";

const KolaybiCeklerPage = () => (
  <KolaybiFinansListPage
    title="KolayBi Çekler"
    description="KolayBi'de tanımlı çeklerin listesi (5 dakikada bir otomatik güncellenir)."
    apiPath="/kolaybi/finans/cekler"
    columns={cekSenetColumns}
    tip="cheque"
  />
);

export default KolaybiCeklerPage;
