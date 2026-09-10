import React from "react";
import KolaybiFinansListPage, { bankaHesaplariColumns } from "./KolaybiFinansListPage";

const KolaybiBankaHesaplariPage = () => (
  <KolaybiFinansListPage
    title="KolayBi Banka Hesapları"
    description="KolayBi'de tanımlı banka hesaplarının listesi (5 dakikada bir otomatik güncellenir)."
    apiPath="/kolaybi/finans/banka-hesaplari"
    columns={bankaHesaplariColumns}
    tip="bank_account"
  />
);

export default KolaybiBankaHesaplariPage;
