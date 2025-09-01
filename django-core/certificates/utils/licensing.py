# django-core/sslmonitor/licensing.py
import os
import json
import base64
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from nacl.signing import VerifyKey
from nacl.exceptions import BadSignatureError


@dataclass
class Limits:
    tier: str                 # "free" or "pro"
    max_sites: int            # cap how many sites can be checked per run
    expires_at: Optional[datetime] = None


def _b64d(s: str) -> bytes:
    return base64.b64decode(s.encode("utf-8"))


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _verify_and_parse(license_b64: str, pubkey_b64: str) -> dict:
    """
    License format (base64 JSON):
      {"payload":"<b64(json)>","sig":"<b64(signature bytes)>"}
    payload JSON example:
      {"tier":"pro","max_sites":100,"exp":"2026-01-01T00:00:00+00:00","name":"Buyer"}
    """
    blob = json.loads(_b64d(license_b64).decode("utf-8"))

    payload_b64 = blob["payload"]
    sig_b64 = blob["sig"]

    payload_bytes = _b64d(payload_b64)
    sig_bytes = _b64d(sig_b64)

    vk = VerifyKey(base64.b64decode(pubkey_b64))
    # verify() raises BadSignatureError if invalid
    vk.verify(payload_bytes, sig_bytes)

    return json.loads(payload_bytes.decode("utf-8"))


def resolve_limits() -> Limits:
    """
    Decide if we are Free or Pro based on SSL_MONITOR_LICENSE.
    - No/invalid/expired license  -> Free (1 site)
    - Valid signed license        -> Pro (values from payload)
    Public key is provided via SSL_MONITOR_PUBKEY (base64).
    """
    license_b64 = os.getenv("SSL_MONITOR_LICENSE", "").strip()
    pubkey_b64 = os.getenv("SSL_MONITOR_PUBKEY", "").strip()

    # Default Free limits
    default_free = Limits(tier="free", max_sites=1, expires_at=None)

    # If no license provided, stay Free
    if not license_b64 or not pubkey_b64:
        return default_free

    try:
        payload = _verify_and_parse(license_b64, pubkey_b64)

        tier = str(payload.get("tier", "pro")).lower()
        max_sites = int(payload.get("max_sites", 100))

        exp_str = payload.get("exp")
        expires_at = datetime.fromisoformat(exp_str) if exp_str else None
        if expires_at and _now() > expires_at:
            # expired license -> Free
            return default_free

        # Clamp just in case someone puts 0 or negative
        if max_sites < 1:
            max_sites = 1

        return Limits(
            tier="pro" if tier == "pro" else "free",
            max_sites=max_sites if tier == "pro" else 1,
            expires_at=expires_at,
        )

    except (KeyError, ValueError, BadSignatureError, json.JSONDecodeError):
        # Any problem -> treat as Free
        return default_free
