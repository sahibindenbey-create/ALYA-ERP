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
            <Route path="cari-yonetimi" element={<CariForm />} />
            <Route path="siparis-yonetimi" element={<SiparisForm />} />
            <Route path="irsaliye" element={<IrsaliyeForm />} />
            <Route path="faturalar" element={<FaturaForm />} />
            <Route path="personel" element={<PersonelForm />} />
            <Route path="platform-import" element={<PlatformImportPage />} />
            <Route path="urun-stoklar" element={<UrunForm />} />
            <Route path="hizmetler" element={<UrunForm />} />
            <Route path="receteler" element={<ReceteForm />} />
            <Route path="fason" element={<FasonPage />} />
            <Route path="kullanicilar" element={<KullaniciYonetimi />} />
            <Route path="kayitlar" element={<KayitlarPage />} />
            <Route path=":modulePath" element={<ModulePlaceholder />} />
          </Route>

          {/* Eski path'lerle geriye dönük uyumluluk */}
          <Route path="/cariler" element={<Navigate to="/dashboard/cari-yonetimi" replace />} />
          <Route path="/cari-kart" element={<Navigate to="/dashboard/cari-yonetimi" replace />} />

          {/* Bilinmeyen adresler */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
