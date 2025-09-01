import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, Route, Routes } from "react-router-dom";
import SmtpConfigPage from "./SmtpConfigPage";

import SettingsIcon from "@mui/icons-material/Settings";
import DownloadIcon from "@mui/icons-material/Download";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelIcon from "@mui/icons-material/Cancel";
import SearchIcon from "@mui/icons-material/Search";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import LockClockIcon from "@mui/icons-material/LockClock";

import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  CssBaseline,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  Alert,
  createTheme,
  ThemeProvider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Switch,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Autocomplete
} from "@mui/material";
import { green, red, orange } from "@mui/material/colors";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import EmailIcon from "@mui/icons-material/Email";
import GroupsIcon from "@mui/icons-material/Groups";

/* ---------------- Types ---------------- */

type Certificate = {
  id: number;
  domain: string;
  cn: string;
  status: string;
  end_date: string;
  days_remaining: number;
  last_checked: string;
};

type Team = {
  id: number;
  name: string;
  default_emails: string;
};

type PlanStatus = {
  tier: "free" | "pro";
  max_sites: number;
  free_run_available: boolean | null; // null when pro
  license_expires_at: string | null;  // null when free
};

type SmtpForm = {
  provider: "gmail" | "outlook" | "yahoo" | "custom";
  host: string;
  port: number | "";
  use_tls: boolean;
  use_ssl: boolean;
  username: string;   // sender email
  password: string;   // "********" when masked
  from_email: string; // optional display/sender
  test_to: string;    // optional test recipient
};

type TeamRow = {
  id: number;
  name: string;
  default_alert_days: number;
  default_emails: string; // comma-separated
};


const SMTP_PRESETS: Record<string, Partial<SmtpForm>> = {
  gmail: { host: "smtp.gmail.com", port: 587, use_tls: true, use_ssl: false },
  outlook: { host: "smtp.office365.com", port: 587, use_tls: true, use_ssl: false },
  yahoo: { host: "smtp.mail.yahoo.com", port: 465, use_tls: false, use_ssl: true },
};


/* ---- helpers ---- */
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmailList(raw: string | string[]): string[] {
  const arr = Array.isArray(raw) ? raw : String(raw || "").split(",");
  const clean = arr.map(s => s.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of clean) {
    const k = e.toLowerCase();
    if (emailRegex.test(e) && !seen.has(k)) { seen.add(k); out.push(e); }
  }
  return out;
}

/* ---- add/edit form ---- */
function TeamFormDialog({
  open,
  initial,
  onCancel,
  onSaved,
}: {
  open: boolean;
  initial?: TeamRow | null;
  onCancel: () => void;
  onSaved: (saved: TeamRow) => void;
}) {
  const isEdit = !!initial?.id;
  const [name, setName] = useState(initial?.name || "");
  const [days, setDays] = useState<number>(initial?.default_alert_days ?? 15);
  const [emails, setEmails] = useState<string[]>(
    parseEmailList(initial?.default_emails || "")
  );
  const [preset, setPreset] = useState<"" | "gmail" | "outlook" | "autre">("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initial?.name || "");
      setDays(initial?.default_alert_days ?? 15);
      setEmails(parseEmailList(initial?.default_emails || ""));
      setPreset("");
      setErr(null);
      setSaving(false);
    }
  }, [open, initial]);

  const handleSave = async () => {
    setErr(null);
    if (!name.trim()) { setErr("Le nom de l’équipe est requis."); return; }
    if (!Number.isFinite(days) || days < 1 || days > 3650) {
      setErr("Les jours d’alerte doivent être entre 1 et 3650."); return;
    }
    if (emails.length === 0) { setErr("Ajoutez au moins un email."); return; }

    const payload = {
      name: name.trim(),
      default_alert_days: Math.floor(days),
      default_emails: emails.join(","),
    };

    try {
      setSaving(true);
      const url = "http://localhost:8000/api/teams/" + (isEdit ? `${initial!.id}/` : "");
      const { data } = isEdit ? await axios.put(url, payload) : await axios.post(url, payload);
      onSaved(data);
    } catch (e: any) {
      setErr(e?.response?.data ? JSON.stringify(e.response.data) : "Erreur lors de l’enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? "Modifier l’équipe" : "Ajouter une équipe"}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField label="Nom de l’équipe" fullWidth value={name}
              onChange={(e) => setName(e.target.value)} />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Jours avant alerte"
              type="number"
              fullWidth
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value || "0", 10))}
              inputProps={{ min: 1, max: 3650 }}
              helperText="Ex: 15"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              select fullWidth label="Preset emails"
              value={preset}
              onChange={(e) => {
                const v = e.target.value as "gmail" | "outlook" | "autre" | "";
                setPreset(v);
                if (v === "gmail")
                  setEmails(prev => Array.from(new Set([...prev, "admin@gmail.com"])));
                if (v === "outlook")
                  setEmails(prev => Array.from(new Set([...prev, "admin@outlook.com"])));
              }}
              helperText="Optionnel, pré-remplit un email type"
            >
              <MenuItem value="">—</MenuItem>
              <MenuItem value="gmail">Gmail</MenuItem>
              <MenuItem value="outlook">Outlook</MenuItem>
              <MenuItem value="autre">Autre</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12}>
            <Autocomplete
              multiple freeSolo options={[]}
              value={emails}
              onChange={(_, val) => setEmails(parseEmailList(val))}
              filterSelectedOptions
              renderTags={(value: readonly string[], getTagProps) =>
                value.map((option: string, index: number) => (
                  <Chip variant="outlined" label={option} {...getTagProps({ index })} />
                ))
              }
              renderInput={(params) => (
                <TextField {...params}
                  label="Emails de notification"
                  placeholder="tapez un email puis Entrée…"
                  helperText="Les emails sont validés et dédupliqués."
                />
              )}
            />
          </Grid>

          {err && (
            <Grid item xs={12}><Alert severity="error">{err}</Alert></Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={saving}>Annuler</Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? "Enregistrement…" : (isEdit ? "Enregistrer" : "Ajouter")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---- teams manager ---- */
function TeamsDialog({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(10);
  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState<TeamRow | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(r =>
      r.name.toLowerCase().includes(t) ||
      (r.default_emails || "").toLowerCase().includes(t)
    );
  }, [q, rows]);

  const paginated = useMemo(() => {
    const start = page * rpp;
    return filtered.slice(start, start + rpp);
  }, [filtered, page, rpp]);

  const fetchRows = async () => {
    try {
      setLoading(true); setErr(null);
      const { data } = await axios.get("http://localhost:8000/api/teams/");
      setRows(data);
    } catch {
      setErr("Impossible de charger les équipes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) fetchRows(); }, [open]);

  const handleCreate = () => { setEditRow(null); setFormOpen(true); };
  const handleEdit = (row: TeamRow) => { setEditRow(row); setFormOpen(true); };
  const handleDelete = async (row: TeamRow) => {
    if (!confirm(`Supprimer l’équipe “${row.name}” ?`)) return;
    try {
      await axios.delete(`http://localhost:8000/api/teams/${row.id}/`);
      setRows(prev => prev.filter(r => r.id !== row.id));
      onChanged?.();
    } catch {
      alert("Suppression impossible.");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <GroupsIcon color="primary" /> Gérer les équipes
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          <TextField
            size="small" placeholder="Rechercher…"
            value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
              )
            }}
            sx={{ flex: 1 }}
          />
          <Button variant="contained" onClick={handleCreate}>Nouvelle équipe</Button>
        </Box>

        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nom</TableCell>
                <TableCell>Jours alerte</TableCell>
                <TableCell>Emails</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4}><LinearProgress /></TableCell></TableRow>
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4, opacity: .7 }}>
                    Aucune équipe
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map(row => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{row.name}</TableCell>
                    <TableCell>{row.default_alert_days}</TableCell>
                    <TableCell sx={{ maxWidth: 420 }}>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: .5 }}>
                        {parseEmailList(row.default_emails).map(e => (
                          <Chip key={e} size="small" label={e} />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => handleEdit(row)}>Modifier</Button>
                      <Button size="small" color="error" onClick={() => handleDelete(row)}>Supprimer</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <Box sx={{ display: "flex", justifyContent: "flex-end", px: 1 }}>
            <TablePagination
              component="div"
              count={filtered.length}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rpp}
              onRowsPerPageChange={(e) => { setRpp(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[5, 10, 25, 50, 100]}
            />
          </Box>
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fermer</Button>
      </DialogActions>

      <TeamFormDialog
        open={formOpen}
        initial={editRow}
        onCancel={() => setFormOpen(false)}
        onSaved={(saved) => {
          setFormOpen(false);
          setRows(prev => {
            const i = prev.findIndex(r => r.id === saved.id);
            if (i === -1) return [saved, ...prev];
            const copy = prev.slice(); copy[i] = saved; return copy;
          });
          onChanged?.();
        }}
      />
    </Dialog>
  );
}
/* Normalize various /api/plan/status/ shapes */
function normalizePlan(raw: any): PlanStatus {
  if (raw && typeof raw === "object" && "tier" in raw) {
    return raw as PlanStatus;
  }
  if (raw && typeof raw === "object" && "plan" in raw) {
    const tier = String(raw.plan).toLowerCase() === "pro" ? "pro" : "free";
    const remaining = typeof raw.remaining === "number" ? raw.remaining : null;
    return {
      tier,
      max_sites: Number(raw.limit ?? 1),
      free_run_available: tier === "free" ? (remaining ?? 0) > 0 : null,
      license_expires_at: raw.expires_at ?? null,
    };
  }
  return {
    tier: "free",
    max_sites: 1,
    free_run_available: true,
    license_expires_at: null,
  };
}

/* ---------------- Main Page ---------------- */

function MainPage() {
  // original business states
  const [url, setUrl] = useState("");
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<number | "">("");
  const [customEmails, setCustomEmails] = useState("");
  const [customAlertDays, setCustomAlertDays] = useState("");
  const [checkFrequency, setCheckFrequency] = useState("1h");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchingResults, setMatchingResults] = useState<{ [key: number]: boolean | null }>({});
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  // UI-only states
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");
  const [filterText, setFilterText] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "valid" | "expired" | "expiring-soon">("");
  const [isFetching, setIsFetching] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // plan/trial states
  const [plan, setPlan] = useState<PlanStatus | null>(null);
  const [planLoading, setPlanLoading] = useState(false);


  const [teamsOpen, setTeamsOpen] = useState(false);


  /* ---------- Constants ---------- */

  const STATUS_LABEL: Record<string, string> = {
    "": "Tous les statuts",
    "valid": "Valide",
    "expiring-soon": "Bientôt expiré",
    "expired": "Expiré",
  };

  // --- SMTP state (put near other useState) ---
  const [smtpForm, setSmtpForm] = useState<SmtpForm>({
    provider: "gmail",
    host: SMTP_PRESETS.gmail.host!,
    port: SMTP_PRESETS.gmail.port as number,
    use_tls: true,
    use_ssl: false,
    username: "",
    password: "",
    from_email: "",
    test_to: "",
  });
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpMsg, setSmtpMsg] = useState<{ ok?: boolean; text?: string }>({});

  // Helper: apply preset when provider changes
  const applySmtpPreset = (provider: SmtpForm["provider"]) => {
    if (provider in SMTP_PRESETS) {
      const p = SMTP_PRESETS[provider];
      setSmtpForm((f) => ({
        ...f,
        provider,
        host: p.host || f.host,
        port: (p.port as number) ?? f.port,
        use_tls: p.use_tls ?? f.use_tls,
        use_ssl: p.use_ssl ?? f.use_ssl,
      }));
    } else {
      // custom
      setSmtpForm((f) => ({ ...f, provider }));
    }
  };

  const isCustomProvider = smtpForm.provider === "custom";

  // Load saved SMTP config from backend
  const fetchEmailConfig = async () => {
    try {
      setSmtpLoading(true);
      const { data } = await axios.get("http://localhost:8000/api/email/config/");
      if (data?.exists) {
        const provider = (data.provider || "custom") as SmtpForm["provider"];
        setSmtpForm({
          provider,
          host: data.host || "",
          port: data.port ?? "",
          use_tls: !!data.use_tls,
          use_ssl: !!data.use_ssl,
          username: data.username || "",
          password: data.password || "", // "********" masked from backend
          from_email: data.from_email || data.username || "",
          test_to: "",
        });
      }
    } catch {
      // ignore
    } finally {
      setSmtpLoading(false);
    }
  };

  // Save to backend (optionally send a test email)
  const saveEmailConfig = async () => {
    setSmtpSaving(true);
    setSmtpMsg({});
    try {
      const payload: any = {
        provider: smtpForm.provider,
        username: smtpForm.username,
        password: smtpForm.password,  // if "********", backend keeps old one
        from_email: smtpForm.from_email,
        test_to: smtpForm.test_to?.trim() || undefined,
      };
      if (isCustomProvider) {
        payload.host = smtpForm.host;
        payload.port = Number(smtpForm.port || 0);
        payload.use_tls = smtpForm.use_tls;
        payload.use_ssl = smtpForm.use_ssl;
      }
      const { data } = await axios.post("http://localhost:8000/api/email/config/", payload);
      setSmtpMsg({
        ok: data?.test_sent ? true : data?.test_sent === false ? true : true,
        text:
          data?.test_sent === true
            ? "Sauvegardé et email de test envoyé ✅"
            : data?.test_sent === false
              ? `Sauvegardé. ⚠️ Test email échec: ${data?.test_error || "inconnu"}`
              : "Sauvegardé ✅",
      });
      // keep masked pw
      setSmtpForm((f) => ({ ...f, password: data?.password || "********" }));
    } catch (e: any) {
      setSmtpMsg({ ok: false, text: e?.response?.data || "Erreur lors de l’enregistrement" });
    } finally {
      setSmtpSaving(false);
    }
  };

  // also fetch SMTP config on mount
  useEffect(() => {
    fetchPlanStatus();
    fetchCertificates();
    fetchTeams();
    fetchEmailConfig(); // <--- add this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  /* ---------- Data fetch ---------- */

  const fetchPlanStatus = async () => {
    try {
      setPlanLoading(true);
      const { data } = await axios.get("http://localhost:8000/api/plan/status/");
      setPlan(normalizePlan(data));
    } catch (e) {
      console.error("Plan status fetch failed:", e);
      setPlan({
        tier: "free",
        max_sites: 1,
        free_run_available: true,
        license_expires_at: null,
      });
    } finally {
      setPlanLoading(false);
    }
  };

  const fetchCertificates = async () => {
    try {
      setIsFetching(true);
      const res = await axios.get("http://localhost:8000/api/certificates/list/");
      setCertificates(res.data);
    } catch (err) {
      console.error("Erreur lors du fetch :", err);
    } finally {
      setIsFetching(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const res = await axios.get("http://localhost:8000/api/teams/");
      setTeams(res.data);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchPlanStatus();
    fetchCertificates();
    fetchTeams();
  }, []);

  /* ---------- Derived / gating ---------- */

  // Gate the button if:
  // - plan says no free run (free_run_available === false), OR
  // - already at least one cert on free tier (front safety), OR
  // - plan still loading (prevents early click before we know limits)
  const hasFreeTrialUsed = useMemo(() => {
    if (!plan) return false;                 // while unknown, don’t flag here
    if (plan.tier === "pro") return false;   // pro not gated
    return plan.free_run_available === false || certificates.length >= 1;
  }, [plan, certificates.length]);

  const disableAdd =
    loading || planLoading || (plan?.tier === "free" && hasFreeTrialUsed);

  /* ---------- Add domain ---------- */

  const handleAdd = async () => {
    setError(null);

    // Hard block on click too (defense in depth)
    if (planLoading || (plan && plan.tier === "free" && hasFreeTrialUsed)) {
      setError("⛔️ Essai gratuit utilisé sur cette machine. Passez à Pro pour continuer.");
      return;
    }

    if (!url.startsWith("http")) {
      setError("⛔️ L'URL doit commencer par http:// ou https://");
      return;
    }

    setLoading(true);
    try {
      await axios.post("http://localhost:3000/check-cert", {
        url,
        team: selectedTeam || null,
        custom_emails: customEmails,
        custom_alert_days: customAlertDays ? parseInt(customAlertDays) : undefined,
        check_frequency: checkFrequency,
      });

      setSnackbarOpen(true);
      setUrl("");
      setSelectedTeam("");
      setCustomEmails("");
      setCustomAlertDays("");
      setCheckFrequency("1h");

      await fetchCertificates();
      await fetchPlanStatus(); // free fuse may have been burned
    } catch (err: any) {
      console.error("Erreur ajout :", err);
      if (err?.response?.status === 403 && err?.response?.data?.code === "FREE_ALREADY_USED") {
        setError("⛔️ Essai gratuit utilisé sur cette machine. Passez à Pro pour continuer.");
        await fetchPlanStatus();
      } else if (err?.response?.status === 500) {
        setError("⛔️ Erreur côté serveur (certificat introuvable ou invalide)");
      } else if (err?.response?.status === 404) {
        setError("⛔️ URL introuvable sur le serveur Node.js");
      } else {
        setError("⛔️ Une erreur s'est produite. Vérifiez l'URL.");
      }
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Filtering / Pagination ---------- */

  const filtered = useMemo(() => {
    let data = certificates;
    if (filterText.trim()) {
      const t = filterText.trim().toLowerCase();
      data = data.filter(
        (c) =>
          c.domain.toLowerCase().includes(t) ||
          (c.cn || "").toLowerCase().includes(t)
      );
    }
    const getNormalizedStatus = (c: Certificate) => {
      if (c.days_remaining <= 0) return "expired";
      if (c.days_remaining <= 30) return "expiring-soon";
      return "valid";
    };

    if (statusFilter) {
      data = data.filter((c) => getNormalizedStatus(c) === statusFilter);
    }

    return data;
  }, [certificates, filterText, statusFilter]);

  const paginated = useMemo(() => {
    const start = page * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  useEffect(() => {
    setPage(0);
  }, [filterText, statusFilter]);

  /* ---------- Visual helpers ---------- */

  const renderStatusChip = (status: string) => {
    const s = status.toLowerCase();
    if (s === "valid") {
      return (
        <Chip
          icon={<VerifiedUserIcon />}
          label="Valide"
          sx={{
            bgcolor: green[100],
            color: green[800],
            fontWeight: 700,
            borderRadius: 2,
          }}
        />
      );
    }
    if (s === "expired") {
      return (
        <Chip
          icon={<CancelIcon />}
          label="Expiré"
          sx={{
            bgcolor: red[100],
            color: red[800],
            fontWeight: 700,
            borderRadius: 2,
          }}
        />
      );
    }

    return (
      <Chip
        icon={<WarningAmberIcon />}
        label="Bientôt expiré"
        sx={{
          bgcolor: orange[100],
          color: orange[800],
          fontWeight: 700,
        }}
      />
    );
  };

  /* ---------- Theme ---------- */

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: themeMode,
          primary: { main: "#ff8f00" },
          secondary: { main: "#6C63FF" },
          background: {
            default: themeMode === "dark" ? "#0b0f16" : "#f6f7fb",
            paper: themeMode === "dark" ? "#111827" : "#ffffff",
          },
        },
        shape: { borderRadius: 14 },
        typography: {
          fontFamily: '"Inter","Segoe UI", Roboto, Arial, sans-serif',
          h4: { fontWeight: 800, letterSpacing: 0.5 },
          h5: { fontWeight: 700 },
          button: { textTransform: "none", fontWeight: 700 },
        },
        components: {
          MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
          MuiCard: {
            styleOverrides: {
              root: {
                backdropFilter: "blur(10px)",
                boxShadow:
                  themeMode === "dark"
                    ? "0 8px 30px rgba(0,0,0,0.45)"
                    : "0 10px 30px rgba(0,0,0,0.08)",
              },
            },
          },
          MuiTableRow: {
            styleOverrides: {
              root: {
                transition: "all .25s ease",
                "&:hover": {
                  transform: "translateY(-1px)",
                  background:
                    themeMode === "dark" ? "rgba(255,255,255,0.04)" : "#fffdf7",
                },
              },
            },
          },
        },
      }),
    [themeMode]
  );

  /* ---------- UI ---------- */

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      {/* Sticky premium header */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          background:
            themeMode === "dark"
              ? "linear-gradient(90deg,#0b0f16,#131a24)"
              : "linear-gradient(90deg,#fff,#fff)",
          borderBottom: themeMode === "dark" ? "1px solid #1f2937" : "1px solid #eee",
        }}
      >
        <Toolbar sx={{ py: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <LockClockIcon color="primary" />
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              SSL Monitor <Box component="span" sx={{ color: "primary.main" }}>Pro+</Box>
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* Trial/Plan chip */}
          {planLoading ? (
            <Chip
              icon={<LockClockIcon />}
              label="Vérification du plan…"
              sx={{ mr: 2, fontWeight: 700 }}
            />
          ) : plan && (
            <Chip
              icon={
                plan.tier === "pro"
                  ? <VerifiedUserIcon />
                  : hasFreeTrialUsed
                    ? <WarningAmberIcon />
                    : <LockClockIcon />
              }
              color={
                plan.tier === "pro" ? "success" :
                  hasFreeTrialUsed ? "error" : "warning"
              }
              label={
                plan.tier === "pro"
                  ? `Pro${plan.license_expires_at ? ` · expire le ${new Date(plan.license_expires_at).toLocaleDateString("fr-FR")}` : ""}`
                  : hasFreeTrialUsed
                    ? "Essai utilisé"
                    : "Essai gratuit : 1 exécution restante"
              }
              sx={{ mr: 2, fontWeight: 700 }}
            />
          )}

          {/* Search */}
          <TextField
            size="small"
            placeholder="Rechercher domaine ou CN…"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            sx={{
              mr: 1.5,
              minWidth: 280,
              "& .MuiOutlinedInput-root": { borderRadius: 999 },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />


          {/* Status filter */}
          <TextField
            size="small"
            select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            SelectProps={{
              displayEmpty: true,
              renderValue: (v) => STATUS_LABEL[(v as string) ?? ""] || "Tous les statuts",
            }}
            sx={{ mr: 2, minWidth: 170, "& .MuiOutlinedInput-root": { borderRadius: 999 } }}
          >
            <MenuItem value="">Tous les statuts</MenuItem>
            <MenuItem value="valid">Valide</MenuItem>
            <MenuItem value="expiring-soon">Bientôt expiré</MenuItem>
            <MenuItem value="expired">Expiré</MenuItem>
          </TextField>

          {/* theme toggle */}
          <Tooltip title={themeMode === "dark" ? "Mode clair" : "Mode sombre"}>
            <IconButton
              onClick={() => setThemeMode(themeMode === "dark" ? "light" : "dark")}
              size="small"
              sx={{ border: "1px solid", borderColor: themeMode === "dark" ? "#1f2937" : "#eee", ml: 1 }}
            >
              {themeMode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>

          {/* settings shortcut */}
          {selectedTeam && (
            <Tooltip title="Configurer SMTP">
              <Link to={`/smtp-config/${selectedTeam}`} style={{ color: "inherit", marginLeft: 8 }}>
                <SettingsIcon />
              </Link>
            </Tooltip>
          )}

          <Tooltip title="Gérer les équipes">
            <IconButton onClick={() => setTeamsOpen(true)}>
              <GroupsIcon />
            </IconButton>
          </Tooltip>

        </Toolbar>
        {isFetching && <LinearProgress color="primary" />}
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Add domain */}
        <Card
          sx={{
            p: 3,
            mb: 4,
            border: themeMode === "dark" ? "1px solid #1f2937" : "1px solid #eee",
            background:
              themeMode === "dark"
                ? "linear-gradient(180deg, rgba(17,24,39,.9), rgba(17,24,39,.6))"
                : "linear-gradient(180deg, rgba(255,255,255,.9), rgba(255,255,255,.7))",
          }}
        >
          <CardContent sx={{ p: 0 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
              Ajouter un domaine à surveiller
            </Typography>

            <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <Grid item xs={12} md={7}>
                <TextField
                  fullWidth
                  sx={{ "& .MuiInputBase-root": { width: 500 } }}
                  label="Domaine"
                  placeholder="https://exemple.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={5}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      sx={{ "& .MuiInputBase-root": { width: 150 } }}
                      select
                      label="Équipe"
                      value={selectedTeam}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "") {
                          setSelectedTeam("");
                          setCustomEmails("");
                        } else {
                          const teamId = parseInt(value);
                          setSelectedTeam(teamId);
                          const team = teams.find((t) => t.id === teamId);
                          if (team) setCustomEmails(team.default_emails);
                        }
                      }}
                    >
                      <MenuItem value=""><em>— Aucune —</em></MenuItem>
                      {teams.map((team) => (
                        <MenuItem key={team.id} value={team.id}>{team.name}</MenuItem>
                      ))}
                    </TextField>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      sx={{ "& .MuiInputBase-root": { width: 150 } }}
                      select
                      label="Fréquence"
                      value={checkFrequency}
                      onChange={(e) => setCheckFrequency(e.target.value)}
                    >
                      <MenuItem value="1h">1 h</MenuItem>
                      <MenuItem value="2h">2 h</MenuItem>
                      <MenuItem value="4h">4 h</MenuItem>
                      <MenuItem value="8h">8 h</MenuItem>
                      <MenuItem value="12h">12 h</MenuItem>
                      <MenuItem value="daily">Quotidien</MenuItem>
                      <MenuItem value="weekly">Hebdomadaire</MenuItem>
                      <MenuItem value="monthly">Mensuel</MenuItem>
                    </TextField>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  sx={{ "& .MuiInputBase-root": { width: 300 } }}
                  label="Emails d’alerte personnalisés"
                  value={customEmails}
                  onChange={(e) => setCustomEmails(e.target.value)}
                  placeholder="email1@x.com,email2@y.com"
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Jours avant alerte"
                  type="number"
                  value={customAlertDays}
                  onChange={(e) => setCustomAlertDays(e.target.value)}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <Tooltip
                  title={
                    planLoading
                      ? "Vérification du plan en cours…"
                      : (plan?.tier === "free" && hasFreeTrialUsed
                        ? "Essai gratuit utilisé. Passez à Pro pour ajouter d'autres domaines."
                        : "")
                  }
                  disableHoverListener={!(planLoading || (plan?.tier === "free" && hasFreeTrialUsed))}
                  arrow
                >
                  {/* span wrapper to allow tooltip on disabled button */}
                  <span style={{ display: "block" }}>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={handleAdd}
                      disabled={disableAdd}
                      sx={{
                        height: "56px",
                        fontWeight: 800,
                        borderRadius: 3,
                        background: "linear-gradient(90deg,#ff8f00,#ffc107)",
                        boxShadow:
                          themeMode === "dark"
                            ? "0 10px 30px rgba(255,143,0,.25)"
                            : "0 8px 20px rgba(255,143,0,.35)",
                        "&:hover": { background: "linear-gradient(90deg,#ff9800,#ffd54f)" },
                      }}
                    >
                      {loading ? <CircularProgress size={24} color="inherit" /> : "Ajouter"}
                    </Button>
                  </span>
                </Tooltip>
              </Grid>
            </Grid>

            {plan?.tier === "free" && hasFreeTrialUsed && (
              <Alert severity="warning" sx={{ mt: 1.5 }}>
                Votre essai gratuit a été utilisé sur cette machine. Passez à <strong>Pro</strong> pour continuer.
              </Alert>
            )}

            {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
          </CardContent>
        </Card>
        {/* ---------- SMTP SETUP (inline) ---------- */}
        <Accordion sx={{ mb: 4, border: themeMode === "dark" ? "1px solid #1f2937" : "1px solid #eee", borderRadius: 3 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <EmailIcon color="primary" />
              <Typography sx={{ fontWeight: 800 }}>Paramètres d’email (SMTP)</Typography>
            </Box>
          </AccordionSummary>

          <AccordionDetails>
            {smtpLoading ? (
              <Typography>Chargement…</Typography>
            ) : (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select fullWidth label="Fournisseur"
                    value={smtpForm.provider}
                    onChange={(e) => applySmtpPreset(e.target.value as SmtpForm["provider"])}
                  >
                    <MenuItem value="gmail">Gmail</MenuItem>
                    <MenuItem value="outlook">Outlook / Office365</MenuItem>
                    <MenuItem value="yahoo">Yahoo</MenuItem>
                    <MenuItem value="custom">Personnalisé</MenuItem>
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth label="Email expéditeur"
                    placeholder="ex: mon.email@gmail.com"
                    value={smtpForm.username}
                    onChange={(e) => setSmtpForm({ ...smtpForm, username: e.target.value })}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    type="password"
                    fullWidth label="Mot de passe (app password)"
                    placeholder="********"
                    value={smtpForm.password}
                    onChange={(e) => setSmtpForm({ ...smtpForm, password: e.target.value })}
                    helperText="Idéalement un mot de passe d’application"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth label="From (optionnel)"
                    placeholder="Nom d’affichage ou email"
                    value={smtpForm.from_email}
                    onChange={(e) => setSmtpForm({ ...smtpForm, from_email: e.target.value })}
                  />
                </Grid>

                {/* Custom-only params */}
                <Grid item xs={12} sm={7}>
                  <TextField
                    fullWidth label="Hôte SMTP"
                    value={smtpForm.host}
                    onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })}
                    disabled={!isCustomProvider}
                  />
                </Grid>
                <Grid item xs={12} sm={5}>
                  <TextField
                    fullWidth label="Port" type="number"
                    value={smtpForm.port}
                    onChange={(e) => setSmtpForm({ ...smtpForm, port: Number(e.target.value) })}
                    disabled={!isCustomProvider}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={smtpForm.use_tls}
                        onChange={(e) => setSmtpForm({ ...smtpForm, use_tls: e.target.checked })}
                        disabled={!isCustomProvider}
                      />
                    }
                    label="TLS"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={smtpForm.use_ssl}
                        onChange={(e) => setSmtpForm({ ...smtpForm, use_ssl: e.target.checked })}
                        disabled={!isCustomProvider}
                      />
                    }
                    label="SSL"
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth label="Envoyer un email de test à (optionnel)"
                    placeholder="destinataire@test.com"
                    value={smtpForm.test_to}
                    onChange={(e) => setSmtpForm({ ...smtpForm, test_to: e.target.value })}
                  />
                </Grid>

                {smtpMsg.text && (
                  <Grid item xs={12}>
                    <Alert severity={smtpMsg.ok ? "success" : "error"}>{smtpMsg.text}</Alert>
                  </Grid>
                )}

                <Grid item xs={12} sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
                  <Button
                    variant="outlined"
                    onClick={fetchEmailConfig}
                    disabled={smtpSaving}
                  >
                    Recharger
                  </Button>
                  <Button
                    variant="contained"
                    onClick={saveEmailConfig}
                    disabled={smtpSaving}
                  >
                    {smtpSaving ? "Enregistrement…" : "Enregistrer (et tester)"}
                  </Button>
                </Grid>
              </Grid>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Table card */}
        <Paper
          elevation={0}
          sx={{
            borderRadius: 3,
            overflow: "hidden",
            border: themeMode === "dark" ? "1px solid #1f2937" : "1px solid #eee",
          }}
        >
          <Box
            sx={{
              px: 3,
              py: 2,
              background:
                themeMode === "dark"
                  ? "linear-gradient(180deg, #0f172a, #0b1220)"
                  : "linear-gradient(180deg, #fff7e6, #ffffff)",
              borderBottom: themeMode === "dark" ? "1px solid #1f2937" : "1px solid #eee",
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Certificats analysés
            </Typography>
          </Box>

          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Domaine</TableCell>
                <TableCell>CN</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell>Expire le</TableCell>
                <TableCell>Jours restants</TableCell>
                <TableCell>Dernière vérif</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <Typography sx={{ opacity: 0.7 }}>
                      Aucun certificat ne correspond à vos filtres.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((cert) => (
                  <TableRow key={cert.id} hover>
                    <TableCell>{cert.domain}</TableCell>
                    <TableCell>{cert.cn || "-"}</TableCell>
                    <TableCell>{renderStatusChip(cert.status)}</TableCell>
                    <TableCell>{new Date(cert.end_date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>{cert.days_remaining}</TableCell>
                    <TableCell>{new Date(cert.last_checked).toLocaleString("fr-FR")}</TableCell>
                    <TableCell>
                      <Tooltip title="Télécharger le certificat">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<DownloadIcon />}
                          onClick={() =>
                            window.open(
                              `http://localhost:8000/api/certificates/download/${cert.id}/`,
                              "_blank"
                            )
                          }
                          sx={{ mr: 1 }}
                        >
                          Télécharger
                        </Button>
                      </Tooltip>

                      <Tooltip title="Vérifier le matching de clé">
                        <Button
                          size="small"
                          variant="outlined"
                          color="secondary"
                          startIcon={<VpnKeyIcon />}
                          onClick={async () => {
                            try {
                              const res = await fetch(`http://localhost:3000/api/match-key/${cert.id}`);
                              const data = await res.json();
                              setMatchingResults((prev) => ({ ...prev, [cert.id]: data.match }));
                            } catch {
                              setMatchingResults((prev) => ({ ...prev, [cert.id]: false }));
                            }
                          }}
                        >
                          Matching
                        </Button>
                      </Tooltip>

                      {matchingResults[cert.id] === true && (
                        <CheckCircleOutlineIcon sx={{ color: green[600], ml: 1 }} />
                      )}
                      {matchingResults[cert.id] === false && (
                        <CancelIcon sx={{ color: red[600], ml: 1 }} />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <Box sx={{ display: "flex", justifyContent: "flex-end", px: 2 }}>
            <TablePagination
              component="div"
              count={filtered.length}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </Box>
        </Paper>
      </Container>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3500}
        onClose={() => setSnackbarOpen(false)}
        message="✅ Certificat bien analysé"
      />
      <TeamsDialog
        open={teamsOpen}
        onClose={() => setTeamsOpen(false)}
        onChanged={async () => { await fetchTeams(); }}  // refresh the Équipe select
      />

    </ThemeProvider>
  );
}

/* ---------------- Router Wrapper ---------------- */

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainPage />} />
      <Route path="/smtp-config/:teamId" element={<SmtpConfigPage />} />
    </Routes>
  );
}
