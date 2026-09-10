import React from "react";
import KolaybiFinansListPage, { irsaliyeColumns } from "./KolaybiFinansListPage";

const KolaybiIrsaliyelerPage = () => (
  <KolaybiFinansListPage
    title="KolayBi İrsaliyeleri"
    description="KolayBi'den senkronize edilmiş satış ve alış irsaliyelerinin listesi."
    apiPath="/kolaybi/finans/irsaliyeler"
    columns={irsaliyeColumns}
  />
);

export default KolaybiIrsaliyelerPage;
