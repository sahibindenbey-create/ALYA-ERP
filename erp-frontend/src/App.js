import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import MainMenu from "./components/MainMenu";
import CariForm from "./components/CariForm";
import SiparisForm from "./components/SiparisForm";
import UrunForm from "./components/UrunForm";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import KayitlarPage from "./pages/KayitlarPage";
import FasonPage from "./pages/FasonPage";
import KullaniciYonetimi from "./pages/KullaniciYonetimi";
import IrsaliyeForm from "./pages/IrsaliyeForm";
import FaturaForm from "./pages/FaturaForm";
import PersonelForm from "./pages/PersonelForm";
import PlatformImportPage from "./pages/PlatformImportPage";
import TumPlatformlarPage from "./pages/TumPlatformlarPage";
import NumunelerPage from "./pages/NumunelerPage";
import TeklifForm from "./pages/TeklifForm";
import FinansalRaporlarPage from "./pages/FinansalRaporlarPage";
import UretimMaliyetiPage from "./pages/UretimMaliyetiPage";
import IhracatPage from "./pages/IhracatPage";
import KolaybiPage from "./pages/KolaybiPage";
import KolaybiBankaHesaplariPage from "./pages/KolaybiBankaHesaplariPage";
import KolaybiKasalarPage from "./pages/KolaybiKasalarPage";
import KolaybiKrediKartlariPage from "./pages/KolaybiKrediKartlariPage";
import KolaybiOnlineBankaHesaplariPage from "./pages/KolaybiOnlineBankaHesaplariPage";
import KolaybiCeklerPage from "./pages/KolaybiCeklerPage";
import KolaybiSenetlerPage from "./pages/KolaybiSenetlerPage";
import KolaybiFaturalarPage from "./pages/KolaybiFaturalarPage";
import KolaybiIrsaliyelerPage from "./pages/KolaybiIrsaliyelerPage";
import FinansPage from "./pages/FinansPage";
import TeklifTalepleriPage from "./pages/TeklifTalepleriPage";
import ModulePlaceholder from "./pages/ModulePlaceholder";
import StokPanel from "./pages/StokPanel";
import ReceteYonetimPage from "./pages/ReceteYonetimPage";
import PrivateRoute from "./components/PrivateRoute";
import { initializeCompanyContext } from "./companyContext";
import { isAuthenticated } from "./auth";

initializeCompanyContext();

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to={isAuthenticated() ? "/dashboard" : "/login"} replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/menu" element={<PrivateRoute><MainMenu /></PrivateRoute>} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>}>
          <Route path="cari-giris" element={<CariForm mode="giris" />} />
          <Route path="cari-giris/:id" element={<CariForm mode="giris" />} />
          <Route path="cari-listesi" element={<CariForm mode="liste" />} />
          <Route path="siparis-giris" element={<SiparisForm mode="giris" />} />
          <Route path="siparis-listesi" element={<SiparisForm mode="liste" />} />
          <Route path="irsaliye" element={<IrsaliyeForm />} />
          <Route path="numuneler" element={<NumunelerPage />} />
          <Route path="faturalar/satis" element={<FaturaForm defaultYon="Satış" mode="tam" />} />
          <Route path="faturalar/alis" element={<FaturaForm defaultYon="Alış" mode="tam" />} />
          <Route path="faturalar/liste" element={<FaturaForm mode="liste" />} />
          <Route path="finans" element={<FinansPage section="hareketler" />} />
          <Route path="finans/hesaplar" element={<FinansPage section="hesaplar" />} />
          <Route path="kolaybi" element={<KolaybiPage />} />
          <Route path="kolaybi/banka-hesaplari" element={<KolaybiBankaHesaplariPage />} />
          <Route path="kolaybi/kasalar" element={<KolaybiKasalarPage />} />
          <Route path="kolaybi/kredi-kartlari" element={<KolaybiKrediKartlariPage />} />
          <Route path="kolaybi/online-banka-hesaplari" element={<KolaybiOnlineBankaHesaplariPage />} />
          <Route path="kolaybi/cekler" element={<KolaybiCeklerPage />} />
          <Route path="kolaybi/senetler" element={<KolaybiSenetlerPage />} />
          <Route path="kolaybi/faturalar" element={<KolaybiFaturalarPage />} />
          <Route path="kolaybi/irsaliyeler" element={<KolaybiIrsaliyelerPage />} />
          <Route path="platform-import" element={<PlatformImportPage />} />
          <Route path="platform-tumu" element={<TumPlatformlarPage />} />
          <Route path="ihracat" element={<IhracatPage />} />
          <Route path="urun-giris" element={<UrunForm mode="giris" />} />
          <Route path="urun-giris/:id" element={<UrunForm mode="giris" />} />
          <Route path="urun-listesi" element={<UrunForm mode="liste" />} />
          <Route path="urun-stoklar" element={<StokPanel />} />
          <Route path="hizmetler" element={<UrunForm mode="giris" />} />
          <Route path="receteler" element={<ReceteYonetimPage />} />
          <Route path="uretim-maliyeti" element={<UretimMaliyetiPage />} />
          <Route path="fason" element={<FasonPage />} />
          <Route path="teklif/liste" element={<TeklifForm mode="liste" />} />
          <Route path="teklif/satis" element={<TeklifForm defaultYon="Satış" mode="tam" />} />
          <Route path="teklif/alis" element={<TeklifForm defaultYon="Alış" mode="tam" />} />
          <Route path="teklif-talepleri" element={<TeklifTalepleriPage />} />
          <Route path="personel" element={<PersonelForm />} />
          <Route path="raporlar" element={<FinansalRaporlarPage />} />
          <Route path="kullanicilar" element={<KullaniciYonetimi />} />
          <Route path="kayitlar" element={<KayitlarPage />} />
          <Route path="satis" element={<SiparisForm mode="liste" />} />
          <Route path="satinalma" element={<FaturaForm defaultYon="Alış" mode="liste" />} />
          <Route path="sevkiyat-lojistik" element={<IrsaliyeForm />} />
          <Route path="nakit-yonetimi" element={<FinansPage section="hareketler" />} />
          <Route path="kasa" element={<FinansPage section="hareketler" />} />
          <Route path="banka" element={<FinansPage section="hesaplar" />} />
          <Route path="fatura" element={<FaturaForm mode="liste" />} />
          <Route path="cari" element={<CariForm mode="liste" />} />
          <Route path="uretim-planlama" element={<ReceteYonetimPage />} />
          <Route path="uretim" element={<ReceteYonetimPage />} />
          <Route path="maliyet" element={<UretimMaliyetiPage />} />
          <Route path="maliyet-muhasebesi" element={<UretimMaliyetiPage />} />
          <Route path="dis-ticaret" element={<IhracatPage />} />
          <Route path="rapor" element={<FinansalRaporlarPage />} />
          <Route path="fiyat-yonetimi" element={<UrunForm mode="liste" />} />
          <Route path="depo-alan-planlama" element={<StokPanel />} />
          <Route path="platform-siparisleri" element={<TumPlatformlarPage />} />
          <Route path=":modulePath" element={<ModulePlaceholder />} />
        </Route>
        <Route path="/cariler" element={<Navigate to="/dashboard/cari-listesi" replace />} />
        <Route path="/cari-kart" element={<Navigate to="/dashboard/cari-giris" replace />} />
        <Route path="/dashboard/cari-yonetimi" element={<Navigate to="/dashboard/cari-listesi" replace />} />
        <Route path="/dashboard/siparis-yonetimi" element={<Navigate to="/dashboard/siparis-giris" replace />} />
        <Route path="/dashboard/faturalar" element={<Navigate to="/dashboard/faturalar/satis" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
