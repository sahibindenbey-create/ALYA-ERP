import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { TextField, Button, Container, Box, Typography, Alert } from "@mui/material";
import { loginUser } from "../auth";

const API_URL = "http://localhost:5000/api";

function Login() {
  const [kullaniciAdi, setKullaniciAdi] = useState("");
  const [sifre, setSifre] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { kullaniciAdi, sifre });
      loginUser({ name: res.data.user.name, kullaniciAdi: res.data.user.kullaniciAdi, role: res.data.user.role });
      navigate("/dashboard");
    } catch (err) {
      if (err.code === "ERR_NETWORK") {
        setMessage("Sunucuya bağlanılamadı. Backend (node server.js) çalışıyor mu kontrol et.");
      } else {
        setMessage(err.response?.data?.error || "Giriş sırasında bir hata oluştu.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          mt: 10,
          p: 4,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          bgcolor: "#fff",
          borderRadius: 3,
          boxShadow: "0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)"
        }}
      >
        <Box sx={{
          width: 48, height: 48, borderRadius: 2, bgcolor: "#2563eb",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "white", fontWeight: 800, fontSize: 20, mb: 2
        }}>E</Box>
        <Typography variant="h5" fontWeight={700} mb={0.5}>ERP Sistemi</Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Devam etmek için giriş yapın
        </Typography>

        <Box component="form" onSubmit={handleSubmit} sx={{ width: "100%" }}>
          <TextField
            label="Kullanıcı Adı"
            value={kullaniciAdi}
            onChange={(e) => setKullaniciAdi(e.target.value)}
            fullWidth
            margin="normal"
            required
            autoFocus
          />

          <TextField
            label="Şifre"
            type="password"
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
            fullWidth
            margin="normal"
            required
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading}
            sx={{ mt: 2, py: 1.2, bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8" } }}
          >
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </Button>

          {message && <Alert severity="error" sx={{ mt: 2 }}>{message}</Alert>}

          <Typography variant="caption" display="block" color="text.secondary" mt={2} textAlign="center">
            İlk kurulum sonrası varsayılan giriş: <strong>admin</strong> / <strong>Admin123!</strong>
          </Typography>
        </Box>
      </Box>
    </Container>
  );
}

export default Login;
