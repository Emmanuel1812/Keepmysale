#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os, re, sys, json, time, base64, argparse
from pathlib import Path
from email.mime.text import MIMEText
import requests

from resend_confirmation_addon import build_confirmation_email_html

# Load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=Path(__file__).with_name(".env"))
except Exception:
    pass

SHOPIFY_ACCESS_TOKEN = os.environ.get("SHOPIFY_ACCESS_TOKEN") or globals().get("SHOPIFY_ACCESS_TOKEN")
SHOPIFY_STORE = os.environ.get("SHOPIFY_STORE") or globals().get("SHOPIFY_STORE") or "alma-de-lisboa.com"

SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
]
CREDENTIALS_FILE = Path(os.getenv("GMAIL_CREDENTIALS", Path(__file__).parent.parent / "credentials.json"))
TOKEN_FILE = Path(os.getenv("GMAIL_TOKEN", Path(__file__).parent.parent / "token.json"))

def authenticate_gmail():
    from google.auth.transport.requests import Request
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    from google.auth.exceptions import RefreshError

    creds = None
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)

    try:
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_FILE), SCOPES)
                creds = flow.run_local_server(port=0)
            TOKEN_FILE.write_text(creds.to_json())
    except RefreshError as e:
        if "invalid_scope" in str(e):
            print("Token has wrong scopes; re-authorizing…")
            try: TOKEN_FILE.unlink(missing_ok=True)
            except Exception: pass
            flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_FILE), SCOPES)
            creds = flow.run_local_server(port=0)
            TOKEN_FILE.write_text(creds.to_json())
        else:
            raise

    return build('gmail', 'v1', credentials=creds)

def gmail_profile_email(service):
    profile = service.users().getProfile(userId='me').execute()
    return profile.get("emailAddress")

def gmail_send_html(service, to_email: str, subject: str, html_body: str):
    msg = MIMEText(html_body, "html", "utf-8")
    msg["To"] = to_email; msg["Subject"] = subject
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")
    return service.users().messages().send(userId='me', body={"raw": raw}).execute()

def _shopify_headers():
    if not SHOPIFY_ACCESS_TOKEN:
        raise RuntimeError("Missing SHOPIFY_ACCESS_TOKEN (env var).")
    return {"X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN, "Content-Type": "application/json"}

def fetch_order_by_id(order_id: int):
    url = f"https://{SHOPIFY_STORE}/admin/api/2025-07/orders/{order_id}.json"
    r = requests.get(url, headers=_shopify_headers(), timeout=20)
    r.raise_for_status()
    return r.json().get("order")

def fetch_order_by_name(order_name: str):
    url = f"https://{SHOPIFY_STORE}/admin/api/2025-07/orders.json"
    params = {"status": "any", "limit": 250, "order": "created_at desc"}
    r = requests.get(url, headers=_shopify_headers(), params=params, timeout=20)
    r.raise_for_status()
    orders = r.json().get("orders", [])
    for o in orders:
        if str(o.get("name","")).strip() == order_name.strip():
            return o
    return None

def resolve_order(order_ref: str):
    if re.fullmatch(r"\d+", order_ref):
        return fetch_order_by_id(int(order_ref)), "id"
    return fetch_order_by_name(order_ref), "name"

def main():
    ap = argparse.ArgumentParser(description="Preview or send a confirmation-style email for a given order (to yourself).")
    ap.add_argument("--order", required=True, help="Order ID (digits) or order name (e.g., #1001)")
    ap.add_argument("--send", action="store_true", help="Actually send the email to your own inbox")
    ap.add_argument("--to", default=None, help="Override recipient (defaults to your Gmail profile email)")
    ap.add_argument("--logo", default=None, help="Logo URL to display in the header")
    ap.add_argument("--brand-color", default="#111827", help="Hex color for the header background")
    ap.add_argument("--support", default=None, help="Support email to show in the billing card")
    ap.add_argument("--shop", default=None, help="Shop domain to show (e.g., alma-de-lisboa.com)")
    ap.add_argument("--img-size", default=72, type=int, help="Thumbnail size for product images (px)")
    args = ap.parse_args()

    order, mode = resolve_order(args.order)
    if not order:
        print(f"❌ Order not found by {mode}: {args.order}"); sys.exit(1)

    html = build_confirmation_email_html(
        order,
        logo_url=args.logo or os.getenv("BRAND_LOGO_URL"),
        brand_color=args.brand_color or os.getenv("BRAND_COLOR", "#111827"),
        support_email=args.support or os.getenv("SUPPORT_EMAIL"),
        shop_domain=args.shop or os.getenv("SHOPIFY_STORE"),
        image_size=args.img_size
    )

    previews = Path(__file__).with_name("_previews"); previews.mkdir(exist_ok=True)
    label = str(order.get("id") or order.get("name") or int(time.time()))
    out_path = previews / f"confirmation_preview_{label}.html"
    out_path.write_text(html, encoding="utf-8")
    print(f"✅ Preview saved: {out_path}")

    if args.send:
        service = authenticate_gmail()
        to_email = args.to or gmail_profile_email(service)
        subject = f"Confirmação de encomenda — {order.get('name','sem nº')}"
        gmail_send_html(service, to_email, subject, html)
        print(f"✉️  Sent to: {to_email}")
    else:
        print("ℹ️  Not sent (use --send to email the preview).")

if __name__ == "__main__":
    main()
