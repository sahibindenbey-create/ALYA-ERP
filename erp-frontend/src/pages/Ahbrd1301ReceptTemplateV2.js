import React from 'react';
import axios from 'axios';
import Ahbrd1301ReceptTemplateOriginal from './Ahbrd1301ReceptTemplate';

// AHBRD ekranının ürün kartlarını şirket-RLS uyumlu endpoint'ten almasını sağlar.
// Mevcut reçete ekranının geri kalanına dokunmaz.
const originalGet = axios.get.bind(axios);
let patched = false;

if (!patched) {
  patched = true;
  axios.get = (url, ...args) => {
    if (String(url).endsWith('/api/urunler')) {
      const companyId = localStorage.getItem('selectedCompanyId') || '1';
      return originalGet(`${String(url).replace(/\/api\/urunler$/, '')}/api/recete-agaci/urun-kartlari`, ...args)
        .then(response => ({
          ...response,
          data: Array.isArray(response.data) ? response.data : (response.data?.products || [])
        }));
    }
    return originalGet(url, ...args);
  };
}

export default function Ahbrd1301ReceptTemplateV2(props) {
  return <Ahbrd1301ReceptTemplateOriginal {...props} />;
}
