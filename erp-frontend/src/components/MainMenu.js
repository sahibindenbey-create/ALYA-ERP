import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import menuItems from "../data/menuItems";

const MainMenu = () => {
  const [activeMenu, setActiveMenu] = useState(null);
  const [activeSubMenu, setActiveSubMenu] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  const handleMenuClick = (item) => {
    if (item.subMenu) {
      setActiveMenu(item);
    } else if (item.path) {
      navigate(item.path);
    }
  };

  const handleHomeClick = () => {
    setActiveMenu(null);
    setActiveSubMenu(null);
  };

  // Filtreleme mantığı
  const flatMenu = menuItems.flatMap((group) => group.items);
  const filteredMenu = flatMenu.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* --- Üst Bar --- */}
      <div className="flex items-center justify-between bg-slate-800 px-6 py-3 text-white shadow-lg">
        <div className="text-xl font-bold tracking-tight">ERP LOGO</div>
        
        <div 
          className="flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 transition-colors hover:bg-slate-700"
          onClick={handleHomeClick}
        >
          <span>🏠</span>
          <span className="font-medium">Ana Sayfa</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-semibold">Ahmet Yılmaz</p>
            <p className="text-xs text-slate-400">Yönetici</p>
          </div>
          <button className="rounded-full p-2 hover:bg-slate-700 transition-colors text-xl">⚙️</button>
        </div>
      </div>

      {/* --- Arama ve Filtreleme --- */}
      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-8 flex flex-wrap gap-4 rounded-xl bg-white p-4 shadow-sm border border-slate-200">
          <input
            type="text"
            placeholder="Modül veya işlem ara..."
            className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select className="rounded-lg border border-slate-200 bg-white px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">Tümü</option>
            <option value="uygulamalar">Uygulamalar</option>
            <option value="sistem">Sistem</option>
          </select>
        </div>

        {/* --- Ana Menü Grid --- */}
        {!activeMenu && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
            {filteredMenu.map((item, idx) => (
              <div
                key={idx}
                onClick={() => handleMenuClick(item)}
                className="group flex flex-col items-center justify-center rounded-2xl bg-white p-4 shadow-sm border border-slate-100 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:border-blue-400 hover:shadow-md hover:bg-blue-50/30"
              >
                <span className="mb-3 text-4xl transition-transform group-hover:scale-110">{item.icon}</span>
                <span className="text-center text-xs font-bold text-slate-700 group-hover:text-blue-600 leading-tight">
                  {item.name}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* --- Alt Menü Görünümü --- */}
        {activeMenu && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="mb-6 flex items-center gap-4">
              <button 
                onClick={() => setActiveMenu(null)}
                className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                ⬅️ Geri Dön
              </button>
              <h2 className="text-xl font-bold text-slate-800">{activeMenu.name} Modülleri</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6">
              {activeMenu.subMenu?.map((sub, idx) => (
                <div
                  key={idx}
                  onClick={() => sub.path ? navigate(sub.path) : setActiveSubMenu(sub)}
                  className="flex flex-col items-center justify-center rounded-xl bg-white p-6 shadow-sm border border-blue-100 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
                >
                  <span className="mb-2 text-3xl">{sub.icon}</span>
                  <span className="text-center text-sm font-semibold text-slate-700">{sub.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MainMenu;