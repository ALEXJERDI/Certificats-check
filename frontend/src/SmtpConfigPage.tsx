// src/SmtpConfigPage.tsx
import { useEffect, useState } from "react";
import axios from "axios";
import {
    Container, Typography, TextField, Grid, Alert,
    AppBar, Toolbar
} from "@mui/material";
import { useParams, Link } from "react-router-dom"; // ✅ Import du Link
import attijariLogo from "./assets/attijari-logo.png"; // ✅ Assure-toi que le chemin est correct

export default function SmtpConfigPage() {
    const { teamId } = useParams();
    const [config, setConfig] = useState<any>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (teamId) {
            axios
                .get(`http://localhost:8000/api/smtp/team/${teamId}/`)
                .then((res) => setConfig(res.data))
                .catch((err) => {
                    console.error(err);
                    setError("Impossible de charger la configuration SMTP.");
                });
        }
    }, [teamId]);

    if (error) return <Alert severity="error">{error}</Alert>;
    if (!config) return <Typography>Chargement...</Typography>;

    return (
        <>
            <AppBar
                position="static"
                sx={{ background: "#fff", color: "#000", borderBottom: "1px solid #ddd" }}
            >
                <Toolbar>
                    {/* ✅ Logo cliquable vers la racine "/" */}
                    <Link to="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
                        <img src={attijariLogo} alt="Attijari Logo" style={{ height: 40, marginRight: 16 }} />
                    </Link>
                    <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: "bold" }}>
                        SSL MONITOR – AttijariWafa Bank
                    </Typography>
                </Toolbar>
            </AppBar>

            <Container maxWidth="sm" sx={{ mt: 4 }}>
                <Typography variant="h5" gutterBottom>
                    Configuration SMTP pour l’équipe
                </Typography>

                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <TextField fullWidth label="Nom du serveur" value={config.server_name} disabled />
                    </Grid>
                    <Grid item xs={6}>
                        <TextField fullWidth label="Adresse IP" value={config.host} disabled />
                    </Grid>
                    <Grid item xs={6}>
                        <TextField fullWidth label="Port" value={config.port} disabled />
                    </Grid>
                    <Grid item xs={6}>
                        <TextField fullWidth label="TLS activé" value={config.use_tls ? "Oui" : "Non"} disabled />
                    </Grid>
                    <Grid item xs={6}>
                        <TextField fullWidth label="SSL activé" value={config.use_ssl ? "Oui" : "Non"} disabled />
                    </Grid>
                </Grid>
            </Container>
        </>
    );
}
