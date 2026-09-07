import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import MainMenu from "./components/MainMenu";
import CariForm from "./components/CariForm";
import SiparisForm from "./components/SiparisForm";
import UrunForm from "./components/UrunForm";
import ReceteForm from "./components/ReceteForm";
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
import FinansPage from "./pages/FinansPage";
import TeklifTalepleriPage from "./pages/TeklifTalepleriPage";
import ModulePlaceholder from "./pages/ModulePlaceholder";
import PrivateRoute from "./components/PrivateRoute";
import { isAuthenticated } from "./auth";

function App() {
  return (
    <Router>
      <div>
        <Routes>
          {/* Kök: giriş yapılmışsa panele, yapılmamışsa login'e yönlendir */}
          <Route
            path="/"
            element={<Navigate to={isAuthenticated() ? "/dashboard" : "/login"} replace />}
          />

          <Route path="/login" element={<Login />} />

          {/* Tüm modül launcher'ı (arama + grid) */}
          <Route
            path="/menu"
            element={
              <PrivateRoute>
                <MainMenu />
              </PrivateRoute>
            }
          />

          {/* Sidebar'lı çalışma alanı */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          >
            <Route path="cari-giris" element={<CariForm mode="giris" />} />
            <Route path="cari-giris/:id" element={<CariForm mode="giris" />} />
            <Route path="cari-listesi" element={<CariForm mode="liste" />} />
            <Route path="siparis-giris" element={<SiparisForm mode="giris" />} />
            <Route path="siparis-listesi" element={<SiparisForm mode="liste" />} />
            <Route path="irsaliye" element={<IrsaliyeForm />} />
            <Route path="numuneler" element={<NumunelerPage />} />
            <Route path="teklif/liste" element={<TeklifForm mode="liste" />} />
            <Route path="teklif/satis" element={<TeklifForm defaultYon="Satış" mode="tam" />} />
            <Route path="teklif/alis" element={<TeklifForm defaultYon="Alış" mode="tam" />} />
            <Route path="raporlar" element={<FinansalRaporlarPage />} />
            <Route path="uretim-maliyeti" element={<UretimMaliyetiPage />} />
            <Route path="ihracat" element={<IhracatPage />} />
            <Route path="kolaybi" element={<KolaybiPage />} />
            <Route path="faturalar/satis" element={<FaturaForm defaultYon="Satış" mode="tam" />} />
            <Route path="faturalar/alis" element={<FaturaForm defaultYon="Alış" mode="tam" />} />
            <Route path="faturalar/liste" element={<FaturaForm mode="liste" />} />
            <Route path="personel" element={<PersonelForm />} />
            <Route path="platform-import" element={<PlatformImportPage />} />
            <Route path="platform-tumu" element={<TumPlatformlarPage />} />
            <Route path="finans" element={<FinansPage section="hareketler" />} />
            <Route path="finans/hesaplar" element={<FinansPage section="hesaplar" />} />
            <Route path="teklif-talepleri" element={<TeklifTalepleriPage />} />
            <Route path="urun-giris" element={<UrunForm mode="giris" />} />
            <Route path="urun-giris/:id" element={<UrunForm mode="giris" />} />
            <Route path="urun-listesi" element={<UrunForm mode="liste" />} />
            <Route path="hizmetler" element={<UrunForm mode="giris" />} />
            <Route path="receteler" element={<ReceteForm />} />
            <Route path="fason" element={<FasonPage />} />
            <Route path="kullanicilar" element={<KullaniciYonetimi />} />
            <Route path="kayitlar" element={<KayitlarPage />} />
            <Route path=":modulePath" element={<ModulePlaceholder />} />
          </Route>

          {/* Eski path'lerle geriye dönük uyumluluk */}
          <Route path="/cariler" element={<Navigate to="/dashboard/cari-listesi" replace />} />
          <Route path="/cari-kart" element={<Navigate to="/dashboard/cari-giris" replace />} />
          <Route path="/dashboard/cari-yonetimi" element={<Navigate to="/dashboard/cari-listesi" replace />} />
          <Route path="/dashboard/siparis-yonetimi" element={<Navigate to="/dashboard/siparis-giris" replace />} />
          <Route path="/dashboard/urun-stoklar" element={<Navigate to="/dashboard/urun-listesi" replace />} />
          <Route path="/dashboard/faturalar" element={<Navigate to="/dashboard/faturalar/satis" replace />} />

          {/* Bilinmeyen adresler */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
