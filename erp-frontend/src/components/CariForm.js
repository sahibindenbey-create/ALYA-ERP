import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { TAX_OFFICES } from "../data/taxOffices";
import * as LocationSource from "../data/turkiyeIlIlce"; 
import "./CariForm.css";

const CariForm = () => {
  const source = LocationSource.ilIlceData || [];
  const illerListesi = Array.isArray(source) ? source : (source.cities || source.iller || []);

  const [formData, setFormData] = useState({
    companyId: 1,
    cariKodu: "", cariTipi: "", musteriTuru: "", cariAdi: "", segment: "",
    vergiDairesi: "", vergiNo: "", tcNo: "", faturaIl: "", faturaIlce: "",
    faturaAdresDetay: "", sevkiyatIl: "", sevkiyatIlce: "", sevkiyatAdresDetay: "",
    yetkili1Ad: "", yetkili1Gorev: "", yetkili1Cep: "", yetkili1Mail: "",
    yetkili2Ad: "", yetkili2Gorev: "", yetkili2Cep: "", yetkili2Mail: "",
    dosyalar: [], riskLimiti: "0", vadeGunu: "0", paraBirimi: "TL"
  });

  const [savedData, setSavedData] = useState([]);
  const [listSearch, setListSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [ayniAdres, setAyniAdres] = useState(false);
  const dropdownRef = useRef(null);

  const fetchCariler = async () => {
    try {
      const response = await axios.get("http://localhost:5000/api/cariler");
      setSavedData(response.data);
    } catch (err) {
      console.error("Veri çekme hatası:", err);
    }
  };

  useEffect(() => {
    fetchCariler();
  }, []);

  useEffect(() => {
    if (formData.cariTipi) {
      const prefix = formData.cariTipi.substring(0, 3).toUpperCase();
      const usedNumbers = savedData
        .filter(item => (item.CariKodu || "").startsWith(prefix))
        .map(item => parseInt((item.CariKodu).split("-")[1]))
        .filter(num => !isNaN(num)).sort((a, b) => a - b);
      
      let nextNum = 1001;
      for (let i = 0; i < usedNumbers.length; i++) {
        if (usedNumbers[i] === nextNum) nextNum++;
        else if (usedNumbers[i] > nextNum) break;
      }
      setFormData(prev => ({ ...prev, cariKodu: `${prefix}-${nextNum}` }));
    } else {
      setFormData(prev => ({ ...prev, cariKodu: "" }));
    }
  }, [formData.cariTipi, savedData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (["tcNo", "vergiNo", "yetkili1Cep", "yetkili2Cep", "riskLimiti", "vadeGunu"].includes(name)) {
      if (!/^\d*$/.test(value)) return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const fileNames = files.map(f => f.name);
    setFormData(prev => ({ ...prev, dosyalar: [...prev.dosyalar, ...fileNames] }));
  };

  useEffect(() => {
    if (ayniAdres) {
      setFormData(prev => ({
        ...prev,
        sevkiyatIl: prev.faturaIl,
        sevkiyatIlce: prev.faturaIlce,
        sevkiyatAdresDetay: prev.faturaAdresDetay
      }));
    }
  }, [ayniAdres, formData.faturaIl, formData.faturaIlce, formData.faturaAdresDetay]);

  const handleSave = async () => {
    if (!formData.cariTipi || !formData.cariAdi || !formData.musteriTuru) {
      return alert("Lütfen Cari Türü, Müşteri Türü ve Ünvanı doldurunuz!");
    }
    const identityValue = formData.musteriTuru === "Gerçek Kişi" ? formData.tcNo : formData.vergiNo;
    const isDuplicate = savedData.some(item => 
      (item.MusteriTuru === "Gerçek Kişi" ? item.TCNo : item.VergiNo) === identityValue && identityValue !== ""
    );
    if (isDuplicate) return alert(`HATA: ${identityValue} numaralı kayıt zaten mevcut!`);
    
    try {
      await axios.post("http://localhost:5000/api/cariler", {
        CompanyId: formData.companyId,
        CariKodu: formData.cariKodu,
        CariAdi: formData.cariAdi,
        CariTipi: formData.cariTipi === "Müşteri" ? 1 : formData.cariTipi === "Tedarikçi" ? 2 : 3,
        VergiDairesi: formData.vergiDairesi,
        VergiNo: formData.vergiNo,
        TCNo: formData.tcNo
      });
      alert("Cari SQL Server'a Kaydedildi.");
      fetchCariler();
    } catch (error) {
      console.error("SQL Kayıt Hatası:", error);
      alert("Kayıt sırasında bir hata oluştu.");
    }
  };

  const handleDelete = async (cariId) => {
    if (!window.confirm("Bu cariyi silmek istediğinizden emin misiniz?")) return;
    
    try {
      await axios.delete(`http://localhost:5000/api/cariler/${cariId}`);
      alert("Cari silindi!");
      fetchCariler();
    } catch (error) {
      console.error("Silme hatası:", error);
      alert("Silme sırasında bir hata oluştu.");
    }
  };

  const filteredList = savedData.filter(item => 
    (item.CariAdi || "").toLowerCase().includes(listSearch.toLowerCase()) || 
    (item.VergiNo || item.TCNo || item.CariKodu || "").includes(listSearch)
  );

  return (
    <div className="cari-master-container">
      <div className="dashboard-summary">
        <div className="summary-card">
          <span className="summary-label">Toplam Cari</span>
          <span className="summary-value">{savedData.length}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Müşteri</span>
          <span className="summary-value">{savedData.filter(x => x.CariTipi === 1).length}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Tedarikçi</span>
          <span className="summary-value">{savedData.filter(x => x.CariTipi === 2).length}</span>
        </div>
        <div className="summary-card highlight">
          <span className="summary-label">Toplam Risk</span>
          <span className="summary-value">
            {savedData.reduce((acc, curr) => acc + Number(curr.RiskLimiti || 0), 0).toLocaleString()} TL
          </span>
        </div>
      </div>

      <div className="top-search-section">
        <div className="search-wrapper">
          <input 
            type="text" 
            placeholder="Kayıtlı carilerde ara..." 
            value={listSearch} 
            onChange={(e) => setListSearch(e.target.value)} 
          />
          <span className="search-count">Filtrelenen: {filteredList.length}</span>
        </div>
      </div>

      <div className="cari-card">
        <div className="cari-header">
          <div className="header-left">
            <h2>Cari Kart Tanımlama</h2>
            <div className="code-display-box">
               <span className="code-label">Cari Kodu:</span>
               <span className="code-value">{formData.cariKodu || "SEÇİM BEKLENİYOR..."}</span>
            </div>
          </div>
          <div className="header-right">
             <select name="cariTipi" value={formData.cariTipi} onChange={handleChange} className="type-select">
                <option value="">Cari Türü Seçiniz...</option>
                <option value="Müşteri">Müşteri</option>
                <option value="Tedarikçi">Tedarikçi</option>
                <option value="Her İkisi">Müşteri + Tedarikçi</option>
             </select>
          </div>
        </div>

        <div className="cari-body">
          <section className="form-section">
            <h3 className="section-title">Kimlik Bilgileri</h3>
            <div className="grid-2">
              <div className="field">
                <label>Müşteri Türü</label>
                <select name="musteriTuru" value={formData.musteriTuru} onChange={handleChange}>
                  <option value="">Seçiniz...</option>
                  <option value="Gerçek Kişi">Gerçek Kişi</option>
                  <option value="Tüzel Kişi">Tüzel Kişi</option>
                  <option value="Kamu Kurumu">Kamu Kurumu</option>
                  <option value="Yurtdışı Müşteri">Yurtdışı Müşteri</option>
                </select>
              </div>
              <div className="field">
                <label>Segment</label>
                <select name="segment" value={formData.segment} onChange={handleChange}>
                  <option value="">Seçiniz</option>
                  <option value="Küçük">Küçük</option>
                  <option value="Orta">Orta</option>
                  <option value="Büyük">Büyük</option>
                </select>
              </div>
            </div>
            <div className="field full">
              <label>Cari Ünvanı</label>
              <input name="cariAdi" value={formData.cariAdi} onChange={handleChange} placeholder="Örn: Teknoloji Ltd. Şti." />
            </div>
            <div className="grid-3">
              <div className="field">
                <label>Vergi No</label>
                <input name="vergiNo" value={formData.vergiNo} maxLength={10} disabled={formData.musteriTuru === "Gerçek Kişi"} onChange={handleChange} />
              </div>
              <div className="field">
                <label>TC No</label>
                <input name="tcNo" value={formData.tcNo} maxLength={11} disabled={formData.musteriTuru !== "Gerçek Kişi"} onChange={handleChange} />
              </div>
              <div className="field search-container" ref={dropdownRef}>
                <label>Vergi Dairesi</label>
                <div className="custom-input" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                  {formData.vergiDairesi || "Daire Seç..."}
                </div>
                {isDropdownOpen && (
                  <div className="dropdown-list">
                    <input type="text" placeholder="Ara..." onChange={(e) => setSearchTerm(e.target.value)} />
                    <div className="scroll-area">
                      {TAX_OFFICES.filter(x => x.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 30).map(office => (
                        <div key={office} className="item" onClick={() => { setFormData({...formData, vergiDairesi: office}); setIsDropdownOpen(false); }}>{office}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="form-section">
            <h3 className="section-title">Adres Bilgileri</h3>
            <div className="grid-2">
              <select name="faturaIl" value={formData.faturaIl} onChange={handleChange}>
                <option value="">Fatura İli</option>
                {illerListesi.map(il => <option key={il.name} value={il.name}>{il.name}</option>)}
              </select>
              <select name="faturaIlce" value={formData.faturaIlce} onChange={handleChange}>
                <option value="">Fatura İlçesi</option>
                {(illerListesi.find(x => x.name === formData.faturaIl)?.districts || []).map(ilce => <option key={ilce} value={ilce}>{ilce}</option>)}
              </select>
            </div>
            <textarea name="faturaAdresDetay" value={formData.faturaAdresDetay} onChange={handleChange} placeholder="Fatura Adresi..." className="mt-10" />
            <div className="copy-option" onClick={() => setAyniAdres(!ayniAdres)}>
              <input type="checkbox" checked={ayniAdres} readOnly />
              <label>Sevkiyat adresi aynı</label>
            </div>
            {!ayniAdres && (
              <div className="address-sub-card">
                <div className="grid-2">
                  <select name="sevkiyatIl" value={formData.sevkiyatIl} onChange={handleChange}>
                    <option value="">Sevkiyat İli</option>
                    {illerListesi.map(il => <option key={il.name} value={il.name}>{il.name}</option>)}
                  </select>
                  <select name="sevkiyatIlce" value={formData.sevkiyatIlce} onChange={handleChange}>
                    <option value="">Sevkiyat İlçesi</option>
                    {(illerListesi.find(x => x.name === formData.sevkiyatIl)?.districts || []).map(ilce => <option key={ilce} value={ilce}>{ilce}</option>)}
                  </select>
                </div>
                <textarea name="sevkiyatAdresDetay" value={formData.sevkiyatAdresDetay} onChange={handleChange} placeholder="Sevkiyat Adresi..." className="mt-10" />
              </div>
            )}
          </section>

          <section className="form-section">
            <h3 className="section-title">Yetkililer</h3>
            <div className="grid-2">
              <div className="yetkili-box">
                <label>Yetkili 1</label>
                <input name="yetkili1Ad" value={formData.yetkili1Ad} onChange={handleChange} placeholder="Ad Soyad" />
                <input name="yetkili1Cep" value={formData.yetkili1Cep} maxLength={11} onChange={handleChange} placeholder="Cep No" className="mt-5" />
                <input name="yetkili1Mail" value={formData.yetkili1Mail} onChange={handleChange} placeholder="E-posta" className="mt-5" />
              </div>
              <div className="yetkili-box">
                <label>Yetkili 2</label>
                <input name="yetkili2Ad" value={formData.yetkili2Ad} onChange={handleChange} placeholder="Ad Soyad" />
                <input name="yetkili2Cep" value={formData.yetkili2Cep} maxLength={11} onChange={handleChange} placeholder="Cep No" className="mt-5" />
                <input name="yetkili2Mail" value={formData.yetkili2Mail} onChange={handleChange} placeholder="E-posta" className="mt-5" />
              </div>
            </div>
          </section>

          <section className="form-section">
            <h3 className="section-title">Finansal Parametreler</h3>
            <div className="grid-3">
              <div className="field"><label>Risk Limiti</label><input name="riskLimiti" value={formData.riskLimiti} onChange={handleChange} /></div>
              <div className="field"><label>Vade Günü</label><input name="vadeGunu" value={formData.vadeGunu} onChange={handleChange} /></div>
              <div className="field">
                <label>Para Birimi</label>
                <select name="paraBirimi" value={formData.paraBirimi} onChange={handleChange}>
                  <option value="TL">TL (₺)</option><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option>
                </select>
              </div>
            </div>
          </section>

          <section className="form-section">
            <h3 className="section-title">Evrak Arşivi</h3>
            <div className="file-upload-container">
              <div className="file-drop-zone">
                <input type="file" multiple onChange={handleFileChange} id="fileInput" className="hidden-file-input" />
                <label htmlFor="fileInput" className="file-label"><strong>Dosya Seçin</strong></label>
              </div>
              {formData.dosyalar.length > 0 && (
                <div className="file-list">
                  {formData.dosyalar.map((name, index) => (
                    <div key={index} className="file-item">
                      📄 {name} <button type="button" onClick={() => setFormData(prev => ({...prev, dosyalar: prev.dosyalar.filter((_, i) => i !== index)}))}>x</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="cari-footer">
          <button className="btn-save" onClick={handleSave}>Cariyi Kaydet</button>
        </div>
      </div>

      {listSearch && (
        <div className="cari-list-section mt-20">
          <table className="modern-table">
            <thead>
              <tr><th>Kod</th><th>Ünvan</th><th>TC/Vergi</th><th>Tür</th><th>İşlem</th></tr>
            </thead>
            <tbody>
              {filteredList.map((item) => (
                <tr key={item.CariId}>
                  <td><strong>{item.CariKodu}</strong></td>
                  <td>{item.CariAdi}</td>
                  <td>{item.VergiNo || item.TCNo}</td>
                  <td>{item.CariTipi === 1 ? 'Müşteri' : item.CariTipi === 2 ? 'Tedarikçi' : 'Her İkisi'}</td>
                  <td>
                    <button className="btn-del" onClick={() => handleDelete(item.CariId)}>Sil</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CariForm;
