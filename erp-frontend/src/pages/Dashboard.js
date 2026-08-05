import React from "react";
import { useNavigate, Outlet, Link, useLocation } from "react-router-dom";
import { 
  Box, Typography, Button, Grid, Paper, List, 
  ListItem, ListItemButton, ListItemIcon, ListItemText 
} from "@mui/material";

// İkonlar (Daha önce hata aldığın için importları kontrol et)
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AssessmentIcon from '@mui/icons-material/Assessment';

function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    navigate("/");
  };

  // Sadece /dashboard dizinindeyken özet kartlarını göster
  const isMainDashboard = location.pathname === "/dashboard" || location.pathname === "/dashboard/";

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#f5f5f5" }}>
      
      {/* Sidebar - Sol Menü */}
      <Box sx={{ width: 260, bgcolor: "#1976d2", color: "#fff", p: 2, display: "flex", flexDirection: "column", position: "fixed", height: "100vh" }}>
        <Typography variant="h5" sx={{ mb: 4, fontWeight: "bold", textAlign: "center", pt: 2 }}>
          ERP SİSTEMİ
        </Typography>

        <List sx={{ flexGrow: 1 }}>
          <ListItem disablePadding>
            {/* to="/dashboard" ana özet ekranına döndürür */}
            <ListItemButton component={Link} to="/dashboard">
              <ListItemIcon sx={{ color: "white" }}><DashboardIcon /></ListItemIcon>
              <ListItemText primary="Panel Özet" />
            </ListItemButton>
          </ListItem>

          <ListItem disablePadding>
            {/* App.js'deki alt rota ile tam uyumlu path: /dashboard/cari-yonetimi */}
            <ListItemButton component={Link} to="/dashboard/cari-yonetimi">
              <ListItemIcon sx={{ color: "white" }}><PeopleIcon /></ListItemIcon>
              <ListItemText primary="Cari Kartlar" />
            </ListItemButton>
          </ListItem>

          <ListItem disablePadding>
            <ListItemButton component={Link} to="/dashboard/siparis-yonetimi">
              <ListItemIcon sx={{ color: "white" }}><ShoppingCartIcon /></ListItemIcon>
              <ListItemText primary="Sipariş Girişi" />
            </ListItemButton>
          </ListItem>

          <ListItem disablePadding>
            <ListItemButton>
              <ListItemIcon sx={{ color: "white" }}><AssessmentIcon /></ListItemIcon>
              <ListItemText primary="Raporlar" />
            </ListItemButton>
          </ListItem>
        </List>

        <Button
          variant="contained"
          color="error"
          onClick={handleLogout}
          sx={{ mb: 2, borderRadius: 2 }}
          fullWidth
        >
          Çıkış Yap
        </Button>
      </Box>

      {/* Ana İçerik Alanı - Sidebar sabit olduğu için sol marjin ekledik */}
      <Box sx={{ flexGrow: 1, p: 4, ml: "260px", width: "calc(100% - 260px)" }}>
        
        {isMainDashboard ? (
          <>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: "bold", color: "#333" }}>
              Hoşgeldiniz ERP Dashboard 🚀
            </Typography>

            <Grid container spacing={3} sx={{ mt: 2 }}>
              <Grid item xs={12} sm={6} md={4}>
                <Paper elevation={3} sx={{ p: 3, textAlign: "center", borderTop: "5px solid #1976d2" }}>
                  <Typography variant="h6" color="textSecondary">Toplam Kullanıcı</Typography>
                  <Typography variant="h4" sx={{ fontWeight: "bold", mt: 1 }}>120</Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Paper elevation={3} sx={{ p: 3, textAlign: "center", borderTop: "5px solid #2e7d32" }}>
                  <Typography variant="h6" color="textSecondary">Satışlar</Typography>
                  <Typography variant="h4" sx={{ fontWeight: "bold", mt: 1 }}>45.000₺</Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Paper elevation={3} sx={{ p: 3, textAlign: "center", borderTop: "5px solid #ed6c02" }}>
                  <Typography variant="h6" color="textSecondary">Stok Durumu</Typography>
                  <Typography variant="h4" sx={{ fontWeight: "bold", mt: 1 }}>320 Ürün</Typography>
                </Paper>
              </Grid>
            </Grid>
          </>
        ) : (
          /* Menüden bir şeye basıldığında (Cari/Sipariş) burası çalışır */
          <Outlet />
        )}

      </Box>
    </Box>
  );
}

export default Dashboard;