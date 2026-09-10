import React from "react";
import KolaybiFinansListPage, { bankaHesaplariColumns } from "./KolaybiFinansListPage";

const KolaybiOnlineBankaHesaplariPage = () => (
  <KolaybiFinansListPage
    title="KolayBi Online Banka Hesapları"
    description="KolayBi'de tanımlı online banka hesaplarının listesi (5 dakikada bir otomatik güncellenir). Not: KolayBi dokümantasyonunda bu verinin ayrı bir uç noktadan mı geldiği net olmadığı için henüz veri gelmiyorsa KolayBi destek ekibinden 'online_bank' uç noktası bilgisini talep etmemiz gerekebilir."
    apiPath="/kolaybi/finans/online-banka-hesaplari"
    columns={bankaHesaplariColumns}
    tip="online_bank"
  />
);

export default KolaybiOnlineBankaHesaplariPage;
