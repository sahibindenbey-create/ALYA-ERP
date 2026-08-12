import React from "react";
import * as XLSX from "xlsx";

/**
 * props:
 *  - data: [{...}] ham obje dizisi
 *  - columns: [{ key, label }] excel'e hangi kolonların hangi başlıkla çıkacağı
 *  - filename: dosya adı (uzantısız)
 *  - printTargetId: yazdırılacak alanın DOM id'si (opsiyonel, verilmezse tüm sayfa yazdırılır)
 */
const ExportToolbar = ({ data = [], columns = [], filename = "kayitlar" }) => {
  const handleExcel = () => {
    const rows = data.map(row => {
      const obj = {};
      columns.forEach(col => { obj[col.label] = row[col.key]; });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kayıtlar");
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="erp-toolbar">
      <button className="erp-btn-icon" onClick={handleExcel}>📊 Excel'e Aktar</button>
      <button className="erp-btn-icon" onClick={handlePrint}>🖨️ Yazdır / PDF</button>
    </div>
  );
};

export default ExportToolbar;
