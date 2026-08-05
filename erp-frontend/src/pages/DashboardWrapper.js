import React from 'react';
import CariForm from '../components/CariForm'; // yolu düzelttik
// import '../components/DashboardWrapper.css'; // CSS dosyan yoksa silebilirsin

const DashboardWrapper = () => {
  return (
    <div className="dashboard-wrapper" style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Dashboard</h1>
      <p>Buradan cari kart işlemlerini yapabilirsiniz:</p>

      <div className="dashboard-content" style={{ marginTop: '20px' }}>
        <CariForm />
      </div>
    </div>
  );
};

export default DashboardWrapper;
