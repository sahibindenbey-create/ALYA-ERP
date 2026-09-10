import React from "react";
import KolaybiFinansListPage, { faturaColumns } from "./KolaybiFinansListPage";

const KolaybiFaturalarPage = () => (
  <KolaybiFinansListPage
    title="KolayBi Faturaları"
    description="KolayBi'den senkronize edilmiş satış ve alış faturalarının listesi."
    apiPath="/kolaybi/finans/faturalar"
    columns={faturaColumns}
  />
);

export default KolaybiFaturalarPage;
