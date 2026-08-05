import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TextField, Button, Container, Box, Typography, Alert } from "@mui/material";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();

    if (email === "admin@example.com" && password === "1234") {
      navigate("/dashboard");
    } else {
      setMessage("Email veya şifre yanlış");
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
          bgcolor: "#f5f5f5",
          borderRadius: 2
        }}
      >
        <Typography variant="h4" mb={3}>ERP Login</Typography>

        <Box component="form" onSubmit={handleSubmit} sx={{ width: "100%" }}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            margin="normal"
            required
          />

          <TextField
            label="Şifre"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            margin="normal"
            required
          />

          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            sx={{ mt: 2 }}
          >
            Giriş Yap
          </Button>

          {message && <Alert severity="error" sx={{ mt: 2 }}>{message}</Alert>}
        </Box>
      </Box>
    </Container>
  );
}

export default Login;
