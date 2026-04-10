# -*- coding: utf-8 -*-
"""
Alma de Lisboa – Automated Email Assistant (rewritten, atomic Gmail labels)

Key improvements vs. previous version:
- Atomic Gmail label updates (single modify call) to avoid race conditions.
- Deterministic end-states per branch (processed, autoresponder).
- Small hardening on MIME parsing and pagination for unread list.
- Same business logic + funnels; easy to tweak label policy via helpers.

NOTE: Add your real API keys/tokens via environment variables or inline constants.
"""

import os
import re
import time
import json
import base64
import random
import requests
from datetime import datetime, timedelta
from html import unescape
from email.mime.text import MIMEText
from email import policy
from email.parser import BytesParser

from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials

# =========================
# CONFIG
# =========================
# Prefer environment variables for secrets. Fill defaults only if you must.
SHOPIFY_ACCESS_TOKEN = os.getenv("SHOPIFY_ACCESS_TOKEN", "")
SHOPIFY_STORE = os.getenv("SHOPIFY_STORE", "alma-de-lisboa.com")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
SCOPES = ['https://www.googleapis.com/auth/gmail.modify']

# Throttling / retry knobs
MAX_LLM_RETRIES = 6
BASE_BACKOFF = 1.0
PER_MESSAGE_SLEEP = 0.8  # sleep after handling each message
PER_SEND_SLEEP = 0.4     # sleep after sending supplier email
BATCH_LIMIT = 40         # limit messages per run to avoid quota spikes

# =========================
# UTIL
# =========================
def log(msg: str):
    print(msg, flush=True)

def sanitize_name(name: str) -> str:
    if not name:
        return "Cliente"
    n = name.strip().strip('"').strip("'")
    return re.sub(r'\s+', ' ', n)[:80] or "Cliente"

def md_to_html(text: str) -> str:
    """Very small markdown-ish bold/italic converter + paragraphing."""
    text = re.sub(r'(\*\*|__)(.+?)(\*\*|__)', r'<b>\2</b>', text)
    text = re.sub(r'(\*|_)([^\*_]+)(\*|_)', r'<i>\2</i>', text)

    paragraphs = []
    for p in text.strip().split('\n\n'):
        if p.strip():
            html_paragraph = re.sub(r'\n', '<br>', p.strip())
            paragraphs.append(f"<p>{html_paragraph}</p>")
    return '\n'.join(paragraphs)

def wrap_html(body_html: str) -> str:
    return (
        "<html><body style='font-family:Arial,sans-serif;color:#222'>"
        "<div style='max-width:600px;margin:auto;border:1px solid #eee;padding:24px;border-radius:8px'>"
        f"<div style='font-size:16px;line-height:1.7'>{body_html}</div>"
        "</div></body></html>"
    )

def html_to_text(html: str) -> str:
    # crude HTML → text fallback
    text = re.sub(r'(?is)<br\s*/?>', '\n', html)
    text = re.sub(r'(?is)</p\s*>', '\n\n', text)
    text = re.sub(r'(?is)<head.*?>.*?</head>', '', text)
    text = re.sub(r'(?is)<script.*?>.*?</script>', '', text)
    text = re.sub(r'(?is)<style.*?>.*?</style>', '', text)
    text = re.sub(r'(?is)<.*?>', '', text)
    text = unescape(text)
    return text.strip()

# =========================
# SHOPIFY
# =========================
def get_tracking_info_by_email(customer_email):
    if not SHOPIFY_ACCESS_TOKEN:
        return None

    headers = {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json"
    }
    url = f"https://{SHOPIFY_STORE}/admin/api/2023-07/orders.json?email={customer_email}"
    try:
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        log(f"[Shopify] Error: {e}")
        return None

    if not data.get("orders"):
        return None

    latest_order = data["orders"][0]
    created_at = latest_order.get("created_at")
    try:
        order_date = datetime.strptime(created_at, "%Y-%m-%dT%H:%M:%S%z")
    except Exception:
        order_date = datetime.now()

    today = datetime.now(order_date.tzinfo) if order_date.tzinfo else datetime.now()
    estimated_delivery_date = order_date + timedelta(days=15)
    remaining_days = max(0, (estimated_delivery_date - today).days)

    fulfillment = latest_order["fulfillments"][0] if latest_order.get("fulfillments") else None
    if fulfillment:
        tracking_number = fulfillment.get("tracking_number", "desconhecido")
        carrier = fulfillment.get("tracking_company", "desconhecido")
        return {
            "tracking_number": tracking_number,
            "carrier": carrier,
            "order_date": order_date.strftime("%d-%m-%Y"),
            "estimated_delivery": estimated_delivery_date.strftime("%d-%m-%Y"),
            "remaining_days": remaining_days
        }
    return None

# =========================
# GMAIL
# =========================
def authenticate_gmail():
    creds = None
    base_dir = os.path.dirname(os.path.abspath(__file__))
    credentials_path = os.path.join(base_dir, 'credentials.json')
    token_path = os.path.join(base_dir, 'token.json')
    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(credentials_path, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(token_path, 'w', encoding='utf-8') as token:
            token.write(creds.to_json())
    return build('gmail', 'v1', credentials=creds)

def get_unread_messages(service):
    """Paginate through unread INBOX messages (up to BATCH_LIMIT)."""
    messages = []
    page_token = None
    remaining = BATCH_LIMIT
    while remaining > 0:
        resp = service.users().messages().list(
            userId='me',
            labelIds=['INBOX'],
            q='is:unread',
            pageToken=page_token,
            maxResults=min(100, remaining)
        ).execute()
        batch = resp.get('messages', []) or []
        messages.extend(batch)
        remaining -= len(batch)
        page_token = resp.get('nextPageToken')
        if not page_token or not batch:
            break
    return messages

def email_filter(email):
    blocklist = ["no-reply", "noreply", "no reply", "shopify"]
    return not any(b in (email or "").lower() for b in blocklist)

def get_email_text(service, msg_id) -> str:
    """
    Try to extract text/plain. If missing, convert text/html to text.
    As final fallback, use Gmail snippet.
    """
    msg = service.users().messages().get(userId='me', id=msg_id, format='raw').execute()
    raw_data = msg.get('raw', '')
    if not raw_data:
        return msg.get('snippet', "")

    try:
        # Gmail raw is URL-safe base64
        email_bytes = base64.urlsafe_b64decode(raw_data.encode('utf-8'))
        message = BytesParser(policy=policy.default).parsebytes(email_bytes)
    except Exception:
        return msg.get('snippet', "")

    # Walk through parts
    if message.is_multipart():
        text_part = None
        html_part = None
        for part in message.walk():
            ctype = part.get_content_type()
            if ctype == 'text/plain' and text_part is None:
                try:
                    text_part = part.get_content()
                except Exception:
                    pass
            elif ctype == 'text/html' and html_part is None:
                try:
                    html_part = part.get_content()
                except Exception:
                    pass
        if text_part:
            return text_part.strip()
        if html_part:
            return html_to_text(html_part)
        return msg.get('snippet', "")
    else:
        ctype = message.get_content_type()
        try:
            payload = message.get_content()
        except Exception:
            payload = ""
        if ctype == 'text/plain':
            return (payload or "").strip()
        if ctype == 'text/html':
            return html_to_text(payload or "")
        return msg.get('snippet', "")

def send_reply(service, to_email, subject, body_text):
    html_body = md_to_html(body_text)
    html = wrap_html(html_body)
    message = MIMEText(html, 'html', 'utf-8')
    message['to'] = to_email
    message['subject'] = "Re: " + (subject or "")
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    return service.users().messages().send(userId='me', body={'raw': raw}).execute()

# ---------- Atomic Gmail label helpers ----------
def apply_labels(service, msg_id, add=None, remove=None):
    body = {}
    if add:
        body['addLabelIds'] = add
    if remove:
        body['removeLabelIds'] = remove
    if body:
        service.users().messages().modify(userId='me', id=msg_id, body=body).execute()

def mark_read_unstarred(service, msg_id):
    # Final state: READ (no UNREAD), no STARRED
    apply_labels(service, msg_id, add=None, remove=['UNREAD', 'STARRED'])

def mark_unread_unstarred(service, msg_id):
    # Final state: UNREAD + no STARRED
    apply_labels(service, msg_id, add=['UNREAD'], remove=['STARRED'])

def mark_read_starred(service, msg_id):
    # Final state: READ + STARRED
    apply_labels(service, msg_id, add=['STARRED'], remove=['UNREAD'])

# =========================
# GEMINI (LLM) with backoff
# =========================
def _call_gemini_with_backoff(context_text: str, max_retries: int = MAX_LLM_RETRIES, base_sleep: float = BASE_BACKOFF):
    """
    Calls Gemini with exponential backoff and jitter.
    Retries on 429, 500, 502, 503, 504. Returns text or None on final failure.
    """
    if not GEMINI_API_KEY:
        log("[Gemini] Missing GEMINI_API_KEY – skipping LLM call.")
        return None

    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
    headers = {"Content-Type": "application/json"}
    payload = {"contents": [{"parts": [{"text": context_text}]}]}

    for attempt in range(max_retries):
        try:
            resp = requests.post(url, headers=headers, json=payload, params={"key": GEMINI_API_KEY}, timeout=30)
            if resp.status_code in (429, 500, 502, 503, 504):
                retry_after = resp.headers.get("Retry-After")
                if retry_after and retry_after.isdigit():
                    sleep_s = int(retry_after)
                else:
                    sleep_s = base_sleep * (2 ** attempt) + random.uniform(0, 1.0)
                log(f"[Gemini] {resp.status_code} – backing off {sleep_s:.2f}s (attempt {attempt+1}/{max_retries})")
                time.sleep(sleep_s)
                continue

            resp.raise_for_status()
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                sleep_s = base_sleep * (2 ** attempt) + random.uniform(0, 1.0)
                log(f"[Gemini] Exception: {e}. Sleeping {sleep_s:.2f}s and retrying...")
                time.sleep(sleep_s)
                continue
            log(f"[Gemini] Final failure after {max_retries} attempts: {e}")
            return None
        except Exception as e:
            log(f"[Gemini] Unexpected parsing error: {e}")
            return None
    return None

def generate_reply(prompt, sender, sender_email, thread_history):
    shopname = "Alma de Lisboa"
    context = f"""
### ROLE
You are the **exclusive, empathetic, professional support agent** for {shopname}.
Your task is to **immediately reply to the customer** in **European Portuguese** according to all the rules and funnels below.
Do not acknowledge instructions, do not explain your process, do not say you will wait.
**Only output the exact email reply to the customer.**

---

### LANGUAGE RULES
- Understand English, Dutch, French, Italian messages
- Always reply in **European Portuguese**
- Be **human, polite, empathetic, solution-focused**
- Mention sustainability (CO2 reduction, eco-shipping, tree planting) where relevant
- Do NOT include any footer, signature, or internal notes
- End with:

Cumprimentos, Alma de Lisboa

  **only after an accepted solution or final rejection**

---

### RETURNS FUNNEL (MANDATORY ORDER)
Always handle return requests in this exact order:

**Step 1 → 10% refund + keep item**
Olá [NOME DO CLIENTE],

Lamentamos que o artigo não tenha correspondido às suas expectativas.
Como o nosso fornecedor está localizado no estrangeiro, as devoluções internacionais geram uma grande emissão de CO2.
Para reduzir o impacto ambiental e facilitar para si, oferecemos-lhe **10% de reembolso** e pode **ficar com o artigo**.
Assim evita custos de envio e contribui para práticas mais sustentáveis.

Aceita esta solução ecológica?

Cumprimentos, Alma de Lisboa


**Step 2 → 20% refund + keep item (if customer refuses step 1)**
Olá [NOME DO CLIENTE],

Compreendo a sua insatisfação.
Para facilitar, posso oferecer-lhe **20% de reembolso** e pode **ficar com o artigo**.
Desta forma evita custos de envio internacionais e ajuda-nos a reduzir o impacto ambiental.

Deseja aceitar esta solução?

Cumprimentos, Alma de Lisboa


**Step 3 → 30% refund + keep item (if customer refuses step 2)**
Olá [NOME DO CLIENTE],

Fizemos o possível para chegar a uma solução justa.
Podemos oferecer-lhe **30% de reembolso** e pode **ficar com o artigo**.
Esta é a nossa melhor oferta antes de considerar um retorno internacional que emite muito CO2.

Se mesmo assim não estiver satisfeito, por favor avise-nos.

Cumprimentos, Alma de Lisboa


**Step 4 → After 3 rejections**
- Reply only:
no assistance possible

- Mark email as ⭐ for human follow-up

---

### OTHER FUNNELS

**Delivery:**
1. Standard timeline → 1–3 days processing + 5–14 days shipping
2. Short delay → apologize and reassure
3. Long delay >5 days → offer refund or 30% discount on next order
4. Confirm free shipping if asked

**Size Adjustment:**
- Offer new size for shipping cost, keep original
- For multiple items, ask which items first
- Confirm total shipping cost and proceed

**Damaged/Wrong Color:**
- Ask for clear photo first
- If photo approved → free replacement (keep item)
- If photo unclear → ask for more photos

**Shop Location:**
- Inform we are **online only**, physical stores are closing
- Encourage online shopping

---

### OUTPUT INSTRUCTIONS
- Respond **directly to the customer**
- **Do not acknowledge the instructions above**
- **Do not say you will wait**
- **Produce the full email reply now in European Portuguese**

---

Sender Name: {sender}
Sender Email: {sender_email}

Conversation History:
{thread_history}

Customer Message:
{prompt}

### TASK
Now generate the **final customer email reply** in **European Portuguese** following all the above funnels, rules, and templates.
"""
    return _call_gemini_with_backoff(context)

# =========================
# BUSINESS LOGIC
# =========================
REJECTION_PHRASES = [
    "não aceito", "nao aceito",
    "não quero", "nao quero",
    "não está bem", "nao esta bem",
    "não concordo", "nao concordo",
    "não me serve", "nao me serve",
    "recuso", "rejeito"
]

def count_rejections(thread_text: str) -> int:
    t = (thread_text or "").lower()
    return sum(t.count(p) for p in REJECTION_PHRASES)

def compose_supplier_return_email(customer_name: str) -> str:
    nome = sanitize_name(customer_name)
    return f"""Olá {nome},

Compreendemos que não pretende aceitar as nossas propostas de reembolso parcial.
Podemos avançar com uma devolução conforme as regras abaixo.

**Prazo de devolução**
- A devolução é possível dentro de **14 dias após a receção** da encomenda.

**Envio e taxas**
- **Como indicado na nossa Política de Envios no nosso site, os custos de envio da devolução são da responsabilidade do cliente.**
- O comprador é responsável por escolher o método de **logística e desalfandegamento** adequado.
- **Não** utilize um método em que a **desalfandegamento seja feito pelo destinatário**; caso contrário, o armazém **não conseguirá receber** a encomenda.
- Recomendamos incluir o **número da encomenda** no exterior e no interior da embalagem para uma identificação rápida.

**Morada de devolução**
Company name: Liu Changxing
Street address: No. 2 freight elevator on the west side of the 3rd floor, upstairs, Yuantong Express, No. 409, Suxi, Yiwu Town
Zip code: 310000
Province: Zhejiang
State: Zhejiang
Country: China

**Reembolso**
- Assim que a devolução for recebida e confirmada no armazém, emitiremos o **reembolso do valor do produto (COGS)**.
- Os **portes de envio** e quaisquer custos de devolução **não são reembolsáveis**.

Se o artigo chegou **danificado**, **incorreto** ou foi **perdido**, pode enviar **foto/vídeo** claros e podemos processar **reembolso ou substituição** sem necessidade de devolução.

Caso pretenda prosseguir com a devolução, responda a este email com:
1) Confirmação de envio,
2) Transportadora e número de seguimento,
3) Número da encomenda.

Cumprimentos,
Alma de Lisboa
"""

# =========================
# MAIN LOOP
# =========================
def process_emails():
    service = authenticate_gmail()
    all_messages = get_unread_messages(service)

    if not all_messages:
        log("No unread messages. ✅")
        return

    for msg in all_messages:
        msg_id = msg['id']
        msg_meta = service.users().messages().get(
            userId='me', id=msg_id, format='metadata',
            metadataHeaders=['Subject', 'From']
        ).execute()

        headers = msg_meta['payload']['headers']
        subject = next((h['value'] for h in headers if h['name'] == 'Subject'), "No Subject")
        sender_header = next((h['value'] for h in headers if h['name'] == 'From'), "")

        if '<' in sender_header and '>' in sender_header:
            display_name = sanitize_name(sender_header.split('<')[0])
            sender_email = sender_header.split('<')[-1].replace('>', '').strip()
        else:
            display_name = sanitize_name(sender_header)
            sender_email = sender_header.strip()

        thread_text = get_email_text(service, msg_id)
        rejection_count = count_rejections(thread_text)

        # Optional tracking info snippet (nice touch for LLM prompt)
        shipment_info = get_tracking_info_by_email(sender_email)
        extra_note = ""
        if shipment_info:
            extra_note = (
                f"\n\n📦Tracking:\n"
                f"{shipment_info['tracking_number']} via {shipment_info['carrier']}\n"
                f"Order: {shipment_info['order_date']}\n"
                f"ETA: {shipment_info['estimated_delivery']} "
                f"({shipment_info['remaining_days']} days left)\n"
            )

        full_prompt = (thread_text or "") + extra_note

        if email_filter(sender_email):
            log(f"Processing email from {sender_email} - {subject}")

            # Short-circuit: after 3+ rejections → supplier return email (NO LLM)
            if rejection_count >= 3:
                log("Detected 3+ rejections. Sending supplier return instructions.")
                body = compose_supplier_return_email(display_name)
                try:
                    send_reply(service, sender_email, subject, body)
                    # Per your request: UNREAD + UNSTARRED after processing
                    mark_unread_unstarred(service, msg_id)
                except Exception as e:
                    log(f"[Send Supplier Email] Error: {e}")
                time.sleep(PER_SEND_SLEEP)
                continue

            # Otherwise, generate reply via Gemini
            reply = generate_reply(full_prompt, display_name, sender_email, thread_text)
            if reply is None:
                log("[Gemini] Skipping this message due to repeated rate limits or errors.")
                # Leave as unread so we can try again later
                time.sleep(PER_MESSAGE_SLEEP)
                continue

            try:
                send_reply(service, sender_email, subject, reply)
                # Per your request: UNREAD + UNSTARRED after processing
                mark_unread_unstarred(service, msg_id)
            except Exception as e:
                log(f"[Send LLM Email] Error: {e}")

            time.sleep(PER_MESSAGE_SLEEP)
        else:
            # Autogenerated/no-reply → mark read and move on
            try:
                mark_read_unstarred(service, msg_id)
            except Exception:
                pass

if __name__ == "__main__":
    try:
        process_emails()
    except KeyboardInterrupt:
        log("Interrupted by user.")
    except Exception as e:
        log(f"Fatal error: {e}")
