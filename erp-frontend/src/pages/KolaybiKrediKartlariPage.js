import React from "react";
import KolaybiFinansListPage, { krediKartlariColumns } from "./KolaybiFinansListPage";

const KolaybiKrediKartlariPage = () => (
  <KolaybiFinansListPage
    title="KolayBi Kredi Kartları"
    description="KolayBi'de tanımlı kredi kartlarının listesi (5 dakikada bir otomatik güncellenir)."
    apiPath="/kolaybi/finans/kredi-kartlari"
    columns={krediKartlariColumns}
    tip="credit_card"
  />
);

export default KolaybiKrediKartlariPage;
