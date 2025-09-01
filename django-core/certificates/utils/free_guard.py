# django-core/sslmonitor/free_guard.py
import os
import tempfile
from pathlib import Path

# We write a small "fuse" file after the first successful FREE run.
# If it exists, Free cannot run again on this machine.
HOME_FUSE = Path.home() / ".sslmonitor_free_fuse"
TMP_FUSE = Path(tempfile.gettempdir()) / ".sslmonitor_free_fuse"

def _fuse_paths():
    return [HOME_FUSE, TMP_FUSE]

def free_run_available() -> bool:
    """True if the free run has NOT been used yet."""
    return not any(p.exists() for p in _fuse_paths())

def consume_free_run() -> None:
    """Burn the fuse after a successful Free run."""
    for p in _fuse_paths():
        try:
            p.write_text("used\n", encoding="utf-8")
        except Exception:
            # Ignore write errors on secondary location
            pass

def require_free_available():
    """Raise an error if the free run is already used."""
    if not free_run_available():
        raise RuntimeError("Free run already used on this machine. Please upgrade to Pro.")
