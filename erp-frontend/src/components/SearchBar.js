import React, { useState } from "react";
import "./SearchBar.css";

const SearchBar = () => {
  const [category, setCategory] = useState("Tüm Kategoriler");

  const handleCategoryChange = (e) => {
    setCategory(e.target.value);
  };

  return (
    <div className="search-bar">
      <input type="text" placeholder="Ara..." className="search-input" />
      <select value={category} onChange={handleCategoryChange} className="category-select">
        <option value="Tüm Kategoriler">Tüm Kategoriler</option>
        <option value="Cariler">Cariler</option>
        <option value="Ürün ve Stoklar">Ürün ve Stoklar</option>
        <option value="Satış">Satış</option>
        <option value="Muhasebe">Muhasebe</option>
      </select>
    </div>
  );
};

export default SearchBar;
