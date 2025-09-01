// App.tsx
import { useEffect, useState } from "react";
import axios from "axios";
import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  CssBaseline,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Typography,
  Alert,
  CircularProgress,
} from "@mui/material";
import attijariLogo from "./assets/attijari-logo.png";

type Certificate = {
  id: number;
  domain: string;
  cn: string;
  status: string;
  end_date: string;
  days_remaining: number;
  last_checked: string;
};

function App() {
  const [url, setUrl] = useState("");
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCertificates = async () => {
    try {
      const res = await axios.get("http://localhost:8000/api/certificates/list/");
      setCertificates(res.data);
    } catch (err) {
      console.error("Erreur lors du fetch :", err);
    }
  };

  const handleAdd = async () => {
    setError(null);
    setSuccess(false);
    setLoading(true);

    if (!url.startsWith("http")) {
      setError("⛔️ L'URL doit commencer par http:// ou https://");
      setLoading(false);
      return;
    }

    try {
      await axios.post("http://localhost:3000/check-cert", { url });
      setSuccess(true);
      setUrl("");
      await fetchCertificates();
    } catch (err: any) {
      console.error("Erreur ajout :", err);
      if (err.response?.status === 500) {
        setError("⛔️ Erreur côté serveur (certificat introuvable ou invalide)");
      } else if (err.response?.status === 404) {
        setError("⛔️ URL introuvable sur le serveur Node.js");
      } else {
        setError("⛔️ Une erreur s'est produite. Vérifiez l'URL.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertificates();
  }, []);

  return (
    <>
      <CssBaseline />
      <AppBar position="static" sx={{ background: "#fff", color: "#000", borderBottom: "1px solid #ddd" }}>
        <Toolbar>
          <img src={attijariLogo} alt="Attijari Logo" style={{ height: 40, marginRight: 16 }} />
          <Typography variant="h6" sx={{ fontWeight: "bold" }}>
            SSL MONITOR – AttijariWafa Bank
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h5" gutterBottom>
              Suivi de certificats SSL
            </Typography>

            <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <Grid item xs={12} sm={9}>
                <TextField
                  fullWidth
                  label="Domaine"
                  placeholder="https://exemple.com"
                  variant="outlined"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  onClick={handleAdd}
                  disabled={loading}
                  sx={{ height: "100%" }}
                >
                  {loading ? <CircularProgress size={24} /> : "Vérifier"}
                </Button>
              </Grid>
            </Grid>

            {success && <Alert severity="success">✅ Certificat analysé avec succès</Alert>}
            {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
          </CardContent>
        </Card>

        <Box mt={4}>
          <Typography variant="h6" gutterBottom>
            Certificats analysés
          </Typography>

          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Domaine</TableCell>
                <TableCell>CN</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell>Expire le</TableCell>
                <TableCell>Jours restants</TableCell>
                <TableCell>Dernière vérification</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {certificates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>Aucun certificat enregistré.</TableCell>
                </TableRow>
              ) : (
                certificates.map((cert) => (
                  <TableRow key={cert.id}>
                    <TableCell>{cert.domain}</TableCell>
                    <TableCell>{cert.cn || "-"}</TableCell>
                    <TableCell>{cert.status}</TableCell>
                    <TableCell>{new Date(cert.end_date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>{cert.days_remaining}</TableCell>
                    <TableCell>{new Date(cert.last_checked).toLocaleString("fr-FR")}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Box>
      </Container>
    </>
  );
}

export default App;
