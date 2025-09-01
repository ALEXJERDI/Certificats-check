# --- top of file ---
from pathlib import Path
from datetime import datetime, timedelta, timezone
import sqlite3

from decouple import Config, RepositoryEnv
from flask import Flask, request, jsonify, abort

# ---- config from .env (repo root) ----
ENV_FILE = Path(__file__).resolve().parents[1] / ".env"
env = Config(RepositoryEnv(str(ENV_FILE)))  # <— use ONE env object

DB_PATH      = env('ENGINE_DB_PATH', default=r"C:\sslmonitor\data\sslmon.sqlite3")
ENGINE_TOKEN = env('ENGINE_TOKEN',   default="super_secret_token")
ENGINE_PORT  = int(env('ENGINE_PORT', default=8080))

app = Flask(__name__)

def is_pro():
    # Presence of LICENSE_KEY in .env => Pro
    return bool(env('LICENSE_KEY', default=''))

def _require_token():
    tok = request.headers.get("X-Engine-Token")
    if tok != ENGINE_TOKEN:
        abort(401)

# ... keep the rest ...

@app.get("/plan/status")
def plan_status():
    _require_token()
    if is_pro():
        return jsonify({
            "ok": True,
            "plan": "PRO",
            "limit": 999999,
            "remaining": None,
            "expires_at": env('LICENSE_EXPIRES', default=None),
        })
    # FREE branch: compute remaining from app_state (limit = 1)
    con = _connect_rw()
    ensure_state_table(con)
    row = con.execute("SELECT free_used FROM app_state WHERE id = 1").fetchone()
    used = (row[0] if row else 0) or 0
    remaining = max(0, 1 - used)
    con.close()
    return jsonify({"ok": True, "plan": "FREE", "limit": 1, "remaining": remaining, "expires_at": None})



def _require_token():
    tok = request.headers.get("X-Engine-Token")
    if tok != ENGINE_TOKEN:
        abort(401)

def _parse_date(s):
    # accept "YYYY-MM-DD" or ISO; return "YYYY-MM-DD"
    if not s: 
        return None
    try:
        return datetime.fromisoformat(str(s).replace("Z","+00:00")).date().isoformat()
    except Exception:
        return str(s)[:10]

def _next_check_at(freq: str) -> str:
    now = datetime.now(timezone.utc)
    mapping = {
        "1h": timedelta(hours=1),
        "2h": timedelta(hours=2),
        "4h": timedelta(hours=4),
        "8h": timedelta(hours=8),
        "12h": timedelta(hours=12),
        "daily": timedelta(days=1),
        "weekly": timedelta(weeks=1),
        "monthly": timedelta(days=30),
    }
    delta = mapping.get((freq or "daily").lower(), timedelta(days=1))
    return (now + delta).isoformat(timespec="seconds")

def _connect_rw():
    con = sqlite3.connect(DB_PATH)
    con.execute("PRAGMA journal_mode=DELETE")
    return con
# en haut du fichier tu as déjà:
# from decouple import Config, RepositoryEnv
# ENV_FILE = Path(__file__).resolve().parents[1] / ".env"
# config = Config(RepositoryEnv(str(ENV_FILE)))



@app.post("/run")
def run():
    _require_token()

    payload = request.get_json(force=True, silent=False) or {}
    domain  = payload.get("domain") or payload.get("url")
    if not domain:
        return jsonify(ok=False, error="MISSING_DOMAIN"), 400

    # accept values computed by Node (preferred)
    cn             = payload.get("cn")
    start_date     = _parse_date(payload.get("start_date"))
    end_date       = _parse_date(payload.get("end_date"))
    days_remaining = payload.get("days_remaining")
    status         = payload.get("status")

    team_id            = payload.get("team") or payload.get("team_id")
    custom_alert_days  = payload.get("custom_alert_days")
    custom_emails      = payload.get("custom_emails")
    check_frequency    = payload.get("check_frequency") or "daily"
    # add this near other parsed fields
    notified = as_bool(payload.get("notified"), default=False)  # default False


    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    next_check_at = _next_check_at(check_frequency)
    

    # Table/columns below assume Django app label "certificates" & model "Certificate"
    # => table name "certificates_certificate"
    # If your table differs, adjust TABLE and column names accordingly.
    TABLE = "certificates_certificate"

    # Upsert-by-domain (domain isn’t necessarily unique; so do a manual select/update-or-insert)
    try:
        con = _connect_rw()
        cur = con.cursor()
        con.execute("BEGIN IMMEDIATE")
        
        # ---------- FREE LIMIT CHECK (1.3) ----------
        # Is this domain already in DB?
        existing = cur.execute(
            f"SELECT id FROM {TABLE} WHERE LOWER(domain)=LOWER(?) LIMIT 1",
            (domain,)
        ).fetchone()

        # Read state and total certs
        free_used = cur.execute(
            "SELECT free_used FROM app_state WHERE id=1"
        ).fetchone()[0]

        total_certs = cur.execute(
            f"SELECT COUNT(*) FROM {TABLE}"
        ).fetchone()[0]

        # If FREE: allow updates to the SAME domain, but block adding a 2nd NEW domain
        if not is_pro():
            is_new_domain = (existing is None)
            if is_new_domain and (free_used == 1 or total_certs >= 1):
                con.rollback()
                return jsonify(ok=False, code="FREE_LIMIT_REACHED",
                               message="Free plan allows only 1 domain on this machine."), 403
        # ---------- END FREE LIMIT CHECK ----------

        row = cur.execute(f"SELECT id FROM {TABLE} WHERE domain = ?", (domain,)).fetchone()

        if row:
            cert_id = row[0]
            cur.execute(
                f"""
                UPDATE {TABLE}
                   SET cn = ?,
                       start_date = ?,
                       end_date = ?,
                       days_remaining = ?,
                       status = ?,
                       last_checked = ?,
                       check_frequency = ?,
                       next_check_at = ?,
                       custom_alert_days = ?,
                       custom_emails = ?,
                       team_id = ?
                       int(notified), 
                 WHERE id = ?
                """,
                (
                    cn,
                    start_date,
                    end_date,
                    int(days_remaining) if days_remaining is not None else None,
                    status,
                    now,
                    check_frequency,
                    next_check_at,
                    int(custom_alert_days) if custom_alert_days not in (None, "") else None,
                    custom_emails,
                    int(team_id) if team_id not in (None, "") else None,
                    int(notified),   # <— added
                    cert_id,
                ),
            )
        else:
            cur.execute(
                f"""
                INSERT INTO {TABLE}
                    (domain, cn, start_date, end_date, days_remaining, status,
                     last_checked, check_frequency, next_check_at,
                     custom_alert_days, custom_emails, team_id, notified)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    domain,
                    cn,
                    start_date,
                    end_date,
                    int(days_remaining) if days_remaining is not None else None,
                    status,
                    now,
                    check_frequency,
                    next_check_at,
                    int(custom_alert_days) if custom_alert_days not in (None, "") else None,
                    custom_emails,
                    int(team_id) if team_id not in (None, "") else None,
                    int(notified),   # <— added
                ),
            )
            cert_id = cur.lastrowid
              # ---------- FLIP FLAG AFTER FIRST SUCCESS (1.4) ----------
            if not is_pro() and free_used == 0:
                cur.execute("UPDATE app_state SET free_used = 1 WHERE id = 1")
            # ---------- END FLIP ----------

        con.commit()
        return jsonify(ok=True, id=cert_id, domain=domain)

    except sqlite3.OperationalError as e:
        # Most common cause: table/column mismatch or file permissions
        return jsonify(ok=False, error="SQL_ERROR", detail=str(e)), 400
    except Exception as e:
        return jsonify(ok=False, error="ENGINE_EXCEPTION", detail=str(e)), 500
    finally:
        try:
            con.close()
        except Exception:
            pass

def as_bool(v, default=False):
    if v in (None, "", "null"):
        return default
    if isinstance(v, bool):
        return v
    s = str(v).strip().lower()
    return s in ("1", "true", "yes", "on")

def ensure_state_table(con):
    con.execute("""
      CREATE TABLE IF NOT EXISTS app_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        free_used INTEGER NOT NULL DEFAULT 0
      )
    """)
    con.execute("INSERT OR IGNORE INTO app_state (id, free_used) VALUES (1, 0)")
    con.commit()


if __name__ == "__main__":
    # Ensure state table exists
    try:
        con0 = sqlite3.connect(DB_PATH)
        ensure_state_table(con0)
        con0.close()
    except Exception as e:
        print("Failed to ensure app_state table:", e)

    print(f"Engine starting on http://127.0.0.1:{ENGINE_PORT} ...")
    app.run(host="127.0.0.1", port=ENGINE_PORT)

