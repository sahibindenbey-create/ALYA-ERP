import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainMenu from "./components/MainMenu";
import CariForm from "./components/CariForm";

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50 font-sans antialiased text-slate-900">
        
        <Routes>
          <Route path="/" element={<MainMenu />} />
          <Route path="/cariler" element={<CariForm />} />
          <Route path="/cari-kart" element={<CariForm />} />
        </Routes>
        
      </div>
    </Router>
  );
}

export default App;