import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import './index.css';
import './theme.css';
import './professional-ui.css';
import './professional-modules.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Tüm Axios isteklerine aktif şirketi otomatik ekle.
// Böylece mevcut modüllerin tek tek değiştirilmesine gerek kalmaz.
axios.interceptors.request.use((config) => {
  const companyId = localStorage.getItem('selectedCompanyId') || '1';
  config.headers = config.headers || {};
  config.headers['X-Company-Id'] = companyId;
  return config;
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();
