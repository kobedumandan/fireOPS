"""PhilSMS delivery for the reporter-location link."""
import httpx

from config import PHILSMS_API_TOKEN, PHILSMS_SEND_URL, PHILSMS_SENDER_ID


def _normalize_ph_number(raw: str) -> str:
    """Normalize a Philippine mobile number to +63XXXXXXXXXX (PhilSMS format)."""
    n = "".join(str(raw or "").split()).replace("-", "")
    if n.startswith("+63"):
        return n
    if n.startswith("63"):
        return "+" + n
    if n.startswith("09") and len(n) == 11:
        return "+63" + n[1:]
    raise ValueError("Invalid Philippine number. Use 09XXXXXXXXX or +639XXXXXXXXX.")


async def _send_philsms(recipient: str, message: str) -> dict:
    """Send an SMS via PhilSMS. Raises RuntimeError on failure."""
    if not PHILSMS_API_TOKEN or "PASTE_" in PHILSMS_API_TOKEN:
        raise RuntimeError("PhilSMS API token is not configured (set PHILSMS_API_TOKEN).")
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            PHILSMS_SEND_URL,
            headers={
                "Authorization": f"Bearer {PHILSMS_API_TOKEN}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            json={
                "recipient": recipient,
                "sender_id": PHILSMS_SENDER_ID,
                "type": "plain",
                "message": message,
            },
        )
    try:
        data = resp.json()
    except Exception:
        data = {}
    if resp.status_code >= 400 or (isinstance(data, dict) and data.get("status") == "error"):
        detail = (data.get("message") if isinstance(data, dict) else None) or \
            f"PhilSMS request failed ({resp.status_code}): {resp.text}"
        raise RuntimeError(detail)
    return data
