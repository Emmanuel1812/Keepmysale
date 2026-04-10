# -*- coding: utf-8 -*-
"""
Alma de Lisboa – Automated Email Assistant (rewritten)

Key features:
- Robust Gmail fetch & MIME parsing (text/plain + html fallback)
- Shopify tracking lookup (latest order ETA snippet)
- Refund funnel via Gemini with exponential backoff + jitter
- Short-circuit after 3+ refusals → send supplier return email (PT-PT)
- Explicit note: return shipping fees are customer’s responsibility (per policy)
- Throttling between API calls to avoid 429
- Graceful handling: never crash on LLM hiccups
"""

import os
import re
import time
import json
import base64
import random
import hashlib
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
from resend_confirmation.resend_confirmation_addon import (
    wants_resend_confirmation,
    handle_resend_confirmation_flow,
    gmail_profile_email,
)

# =========================
# CONFIG
# =========================
SHOPIFY_ACCESS_TOKEN = os.getenv("SHOPIFY_ACCESS_TOKEN", "your_shopify_token_here")
SHOPIFY_STORE = "https://verlaine-avenue.com"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "your_gemini_key_here")
SCOPES = [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send',
]

STEP3_OFFER_MARKERS = [
    "30% de reembolso", "30% reembolso",
    "30% refund", "30% discount",
    "30% desconto", "30% korting",
]
# Throttling / retry knobs
MAX_LLM_RETRIES = 6
BASE_BACKOFF = 1.0
PER_MESSAGE_SLEEP = 0.8  # sleep after handling each message
PER_SEND_SLEEP = 0.4     # sleep after sending supplier email
BATCH_LIMIT = 40         # limit messages per run to avoid quota spikes
# === Resend confirmation add-on ===
# Order number like:
# - encomenda #1002, pedido #1002, order #1002
# - encomenda n.º 1002 / nº 1002 / n° 1002 / n. 1002 / nr 1002
ORDER_RX = re.compile(
    r"(?:order|ordernummer|pedido|encomenda|bestel(?:ling)?|bestelnummer|commande|"
    r"n[.\sº°o]*[:\-]?|nr\.?|nº|n°)\s*#?\s*(\d{2,10})\b",
    re.IGNORECASE,
)

# Fallback: a lone '#1234' anywhere
ALT_ORDER_RX = re.compile(r"(?:^|\s)#\s*(\d{2,10})\b")

def _debug_addon_signature():
    try:
        from inspect import signature
        log(f"[Resend] addon file: {handle_resend_confirmation_flow.__code__.co_filename}")
        log(f"[Resend] addon signature: {signature(handle_resend_confirmation_flow)}")
    except Exception as e:
        log(f"[Resend] Could not introspect addon: {e}")

# =========================
# UTIL
# =========================
def log(msg: str):
    print(msg, flush=True)

def sanitize_name(name: str) -> str:
    if not name:
        return "Cliente"
    n = name.strip().strip('"').strip("'")
    # Some From headers carry quotes or emojis—strip whitespace safely.
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
def offered_step3_then_rejected(service, thread_id: str, my_email: str | None) -> bool:
    """Returns True if we (the store) sent a 30% offer in the thread and the customer later rejected."""
    if not thread_id:
        return False
    th = service.users().threads().get(userId='me', id=thread_id, format='full').execute()
    offer_seen = False
    for m in th.get("messages", []):
        headers = {h["name"].lower(): h["value"] for h in m.get("payload", {}).get("headers", [])}
        from_addr = headers.get("from", "")
        text = (get_email_text(service, m["id"]) or "").lower()

        # Our own outgoing message?
        if my_email and my_email.lower() in from_addr.lower():
            if any(k in text for k in STEP3_OFFER_MARKERS):
                offer_seen = True
        else:
            # Customer message after we offered 30%: look for refusal or full-refund intent
            if offer_seen and (
                any(p in text for p in REJECTION_PHRASES) or
                "reembolso total" in text or "full refund" in text or "reembolso 100%" in text
            ):
                return True
    return False
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
    results = service.users().messages().list(
        userId='me', labelIds=['INBOX'], q='is:unread'
    ).execute()
    return results.get('messages', [])

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

def mark_as_read(service, msg_id):
    service.users().messages().modify(userId='me', id=msg_id, body={'removeLabelIds': ['UNREAD']}).execute()

def mark_as_important(service, msg_id):
    service.users().messages().modify(userId='me', id=msg_id, body={'addLabelIds': ['STARRED']}).execute()


# Detect "30%" in multiple phrasings/languages
THIRTY_PERCENT_REGEX = re.compile(
    r"(?:30\s*%|30\s*percent|30\s*por\s*cento|trinta\s*%)",
    re.IGNORECASE,
)

def mentions_thirty_percent_anywhere(service, thread_id: str | None, current_text: str = "") -> bool:
    """True if '30%' (or localized equivalents) appear in the current message OR anywhere in the thread."""
    if THIRTY_PERCENT_REGEX.search(current_text or ""):
        return True
    if not thread_id:
        return False
    try:
        th = service.users().threads().get(userId='me', id=thread_id, format='full').execute()
        for m in th.get("messages", []):
            txt = get_email_text(service, m["id"]) or ""
            if THIRTY_PERCENT_REGEX.search(txt):
                return True
    except Exception:
        # If thread fetch fails, be conservative and do not trigger on history
        pass
    return False


# =========================
# GEMINI (LLM) with backoff
# =========================
def _call_gemini_with_backoff(context_text: str, max_retries: int = MAX_LLM_RETRIES, base_sleep: float = BASE_BACKOFF):
    """
    Calls Gemini with exponential backoff and jitter.
    Retries on 429, 500, 502, 503, 504. Returns text or None on final failure.
    """
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
    # PT
    "não aceito", "nao aceito",
    "não quero", "nao quero",
    "não está bem", "nao esta bem",
    "não concordo", "nao concordo",
    "não me serve", "nao me serve",
    "recuso", "rejeito",
    "quero reembolso total", "reembolso total",
    "prefiro devolução", "quero devolver", "quero devoluçao", "quero devolução",
    "não quero desconto", "nao quero desconto",
]


def count_rejections(text: str) -> int:
    t = (text or "").lower()
    return sum(t.count(p) for p in REJECTION_PHRASES)


def compose_supplier_return_email(customer_name: str) -> str:
    nome = sanitize_name(customer_name)
    return f"""Olá {nome},

Compreendemos que prefere não aceitar os nossos reembolsos parciais.
Podemos avançar com a devolução, seguindo as regras abaixo.

**Prazo de devolução**
- A devolução é possível dentro de **14 dias após a receção** da encomenda.

**Envio e taxas**
- **Como indicado na nossa Política de Envios no nosso site, os custos de envio da devolução são da responsabilidade do cliente.**
- O comprador é responsável por escolher o método de **logística e desalfandegamento** adequado.
- **Não** utilize um método em que a **desalfandegamento seja feito pelo destinatário**; caso contrário, o armazém **não conseguirá receber** a encomenda.
- Oferecemos **descontos parciais** exatamente para evitar estes custos e reduzir o impacto ambiental, mas respeitamos a sua decisão de devolver.

**Morada de devolução**
Company name: Liu Changxing
Street address: No. 2 freight elevator on the west side of the 3rd floor, upstairs, Yuantong Express, No. 409, Suxi, Yiwu Town
Zip code: 310000
Province: Zhejiang
State: Zhejiang
Country: China

**Reembolso**
- Assim que a devolução for **recebida e confirmada no armazém**, processaremos o **reembolso do valor do produto** no prazo de **até 3 dias úteis**.
- Os **portes de envio** e quaisquer custos de devolução **não são reembolsáveis**.

Se o artigo chegou **danificado**, **incorreto** ou foi **perdido**, pode enviar **foto/vídeo** claros e podemos processar **reembolso ou substituição** sem necessidade de devolução.

Se concordar com a devolução, responda por favor com:
1) Confirmação de envio,
2) Transportadora e número de seguimento,
3) Número da encomenda.

Cumprimentos,
Alma de Lisboa
"""


# =========================
# MAIN LOOP
# =========================

def gather_thread_text(service, thread_id: str, my_email: str | None = None) -> str:
    """Concateneert de teksten van alle klantberichten in de thread."""
    if not thread_id:
        return ""
    th = service.users().threads().get(userId='me', id=thread_id, format='full').execute()
    parts = []
    for m in th.get("messages", []):
        headers = {h["name"].lower(): h["value"] for h in m.get("payload", {}).get("headers", [])}
        from_addr = headers.get("from", "")
        # sla eigen replies over
        if my_email and my_email.lower() in from_addr.lower():
            continue
        # hergebruik je bestaande parser
        parts.append(get_email_text(service, m["id"]))
    return "\n\n---\n\n".join([p for p in parts if p])


def normalize_text(s: str) -> str:
    if not s:
        return ""
    # lower, collapse whitespace, strip quotes/brackets
    s = s.lower()
    s = s.replace("’", "'").replace("“", '"').replace("”", '"')
    s = re.sub(r'[\[\]\(\)<>]', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def likely_resend_request(text: str) -> dict:
    """
    Heuristic detector for 'resend order confirmation' intents across EN/PT/NL.
    Returns {'match': bool, 'order_no': '1002' or None}
    """
    if not text:
        return {"match": False, "order_no": None}

    raw = text
    t = normalize_text(text)

    # Core intent words by language
    keywords_any = [
        # EN
        "resend confirmation", "resend the confirmation", "send confirmation", "confirmation email",
        "confirmation of my order", "send me confirmation",
        # PT (PT-PT)
        "reenviar confirmação", "reenviar a confirmação", "enviar confirmação",
        "confirmacao da encomenda", "confirmação da encomenda",
        "email de confirmação", "comprovativo da encomenda",
        "número da encomenda", "nº da encomenda", "nº encomenda", "número do pedido",
        # NL
        "bevestiging opnieuw", "opnieuw bevestiging", "bevestigingsmail", "bevestiging mail",
        "bestelbevestiging", "bevestiging van mijn bestelling",
        "ordernummer", "bestelnummer",
        # Generic
        "receive a confirmation", "get a confirmation",
    ]

    # Quick presence test
    has_intent = any(k in t for k in keywords_any)

    # Tolerate looser phrasing
    if not has_intent:
        if (("confirm" in t) or ("confirma" in t) or ("bevestig" in t)) and \
           (("order" in t) or ("encomenda" in t) or ("pedido" in t) or ("bestel" in t) or ("bestelling" in t) or ("commande" in t)):
            has_intent = True

    # Try to extract order number
    order_no = None
    m = ORDER_RX.search(t)
    if not m:
        # Use RAW text for the fallback so '#' stays intact
        m = ALT_ORDER_RX.search(raw)
    if m:
        order_no = m.group(1)

    return {"match": has_intent, "order_no": order_no}

def partial_refund_accepted_in_thread(service, thread_id: str, my_email: str | None) -> bool:
    """
    Returns True if a partial refund offer (10%, 20%, 30%) was made and accepted by the customer in the thread.
    """
    if not thread_id:
        return False
    th = service.users().threads().get(userId='me', id=thread_id, format='full').execute()
    offer_seen = None  # None, 10, 20, 30
    for m in th.get("messages", []):
        headers = {h["name"].lower(): h["value"] for h in m.get("payload", {}).get("headers", [])}
        from_addr = headers.get("from", "")
        text = (get_email_text(service, m["id"]) or "").lower()
        # Our outgoing message?
        if my_email and my_email.lower() in from_addr.lower():
            if "10% de reembolso" in text or "10% refund" in text or "10% desconto" in text:
                offer_seen = 10
            elif "20% de reembolso" in text or "20% refund" in text or "20% desconto" in text:
                offer_seen = 20
            elif any(k in text for k in STEP3_OFFER_MARKERS):
                offer_seen = 30
        else:
            # Customer reply after offer
            if offer_seen:
                if any(p in text for p in [
                    "aceito", "aceitei", "aceito sim", "aceito a solução", "ok", "obrigado",
                    "thank you", "accept", "yes", "sim", "sounds good", "deal", "concordo",
                    "está bem", "estou de acordo"
                ]):
                    return True
    return False

def thirty_percent_accepted_after_rejection(service, thread_id: str, my_email: str | None) -> bool:
    """
    Returns True if after a 30% offer was rejected and refund instructions sent, the customer later accepted 30%.
    """
    if not thread_id:
        return False
    th = service.users().threads().get(userId='me', id=thread_id, format='full').execute()
    offer_seen = False
    refund_instructions_sent = False
    for m in th.get("messages", []):
        headers = {h["name"].lower(): h["value"] for h in m.get("payload", {}).get("headers", [])}
        from_addr = headers.get("from", "")
        text = (get_email_text(service, m["id"]) or "").lower()
        if my_email and my_email.lower() in from_addr.lower():
            if any(k in text for k in STEP3_OFFER_MARKERS):
                offer_seen = True
            elif "morada de devolução" in text and offer_seen:
                refund_instructions_sent = True
        else:
            if refund_instructions_sent:
                if any(p in text for p in [
                    "aceito", "aceitei", "aceito sim", "aceito a solução", "ok", "obrigado",
                    "thank you", "accept", "yes", "sim", "sounds good", "deal", "concordo",
                    "está bem", "estou de acordo"
                ]):
                    return True
    return False

def resend_confirmation_already_sent(service, thread_id: str, my_email: str | None) -> bool:
    """
    Returns True if a resend confirmation acknowledgement has already been sent in this thread.
    """
    if not thread_id:
        return False
    th = service.users().threads().get(userId='me', id=thread_id, format='full').execute()
    for m in th.get("messages", []):
        headers = {h["name"].lower(): h["value"] for h in m.get("payload", {}).get("headers", [])}
        from_addr = headers.get("from", "")
        text = (get_email_text(service, m["id"]) or "").lower()
        if my_email and my_email.lower() in from_addr.lower():
            if "reenviámos agora a confirmação" in text or "reenviamos agora a confirmação" in text:
                return True
    return False


def process_emails():
    service = authenticate_gmail()
    all_messages = get_unread_messages(service)[:BATCH_LIMIT]

    if not all_messages:
        log("No unread messages. ✅")
        return

    for msg in all_messages:
        msg_id = msg['id']
        msg_meta = service.users().messages().get(
            userId='me', id=msg_id, format='metadata',
            metadataHeaders=['Subject', 'From']
        ).execute()

        # Only proceed if the message is still unread — skip otherwise.
        label_ids = msg_meta.get('labelIds', []) or []
        if 'UNREAD' not in label_ids:
            log(f"Skipping message {msg_id} — not UNREAD anymore.")
            continue

        headers = msg_meta['payload']['headers']
        subject = next((h['value'] for h in headers if h['name'] == 'Subject'), "No Subject")
        sender_header = next((h['value'] for h in headers if h['name'] == 'From'), "")

        if '<' in sender_header and '>' in sender_header:
            display_name = sanitize_name(sender_header.split('<')[0])
            sender_email = sender_header.split('<')[-1].replace('>', '').strip()
        else:
            display_name = sanitize_name(sender_header)
            sender_email = sender_header.strip()

        # Pull text + context
        thread_text = get_email_text(service, msg_id) or ""
        my_address = gmail_profile_email(service)
        thread_id = msg_meta.get('threadId', None)

        # === IGNORE EMAILS FROM OWN ADDRESS ===
        if my_address and sender_email.lower() == my_address.lower():
            log(f"Skipping email from own address: {sender_email}")
            mark_as_read(service, msg_id)
            continue

        # =========================
        # 30% MENTION → IMMEDIATE RETURN INSTRUCTIONS (skip Gemini)
        # =========================
        if mentions_thirty_percent_anywhere(service, thread_id, current_text=thread_text):
            log("30% mention detected in email/thread → sending supplier return instructions (skip Gemini).")
            body = compose_supplier_return_email(display_name)
            try:
                send_reply(service, sender_email, subject, body)
                mark_as_read(service, msg_id)
                mark_as_important(service, msg_id)
            except Exception as e:
                log(f"[30% hard switch] Error: {e}")
            time.sleep(PER_MESSAGE_SLEEP)
            continue

        # =========================
        # 1) RESEND-CONFIRMATION (PRIORITY)
        # =========================
        intent = likely_resend_request(thread_text)
        if (intent.get("match") or wants_resend_confirmation(thread_text)):
            # Check if resend already sent in this thread
            if resend_confirmation_already_sent(service, thread_id, my_address):
                log("[Resend] Resend confirmation already sent in this thread, skipping resend and continuing normal flow.")
                # Do NOT continue, fall through to normal handling (Gemini etc)
            else:
                log("[Resend] Detected 'resend confirmation' intent → using addon first.")
                log(f"[Resend] parsed intent: {intent}")  # e.g. {'match': True, 'order_no': '1002'}
                _debug_addon_signature()

                try:
                    outcome = handle_resend_confirmation_flow(
                        service=service,
                        customer_email_from_thread=sender_email,
                        thread_text=thread_text,
                        thread_id=thread_id,
                        fallback_sender_email=my_address,
                        assume_intent=True,  # <— force act
                        order_no=intent.get("order_no"),  # <— pass the # if we found one
                    )
                except Exception as e:
                    log(f"[Resend] Unexpected error: {e}")
                    outcome = {"acted": False, "reason": "error"}

                # Always log what the addon returned
                try:
                    log(f"[Resend] addon outcome: {json.dumps(outcome, ensure_ascii=False)}")
                except Exception:
                    log(f"[Resend] addon outcome (repr): {repr(outcome)}")

                if outcome.get("acted"):
                    result = outcome.get("result")

                    if result == "resent_to_customer":
                        customer_email = outcome.get("email", sender_email)
                        ack = (
                            f"Olá! ✅ Reenviámos agora a confirmação da sua encomenda para {customer_email}. "
                            "Se não aparecer nos próximos minutos, verifique o spam/promotions."
                        )
                        try:
                            send_reply(service, sender_email, subject, ack)
                        except Exception as e:
                            log(f"[Resend ack] send_reply error: {e}")
                        mark_as_read(service, msg_id)
                        mark_as_important(service, msg_id)
                        time.sleep(PER_MESSAGE_SLEEP)
                        continue

                    elif result in ("no_email_order_notified_store", "order_without_email_notified_store"):
                        ack = (
                            "Olá! Encontrámos a sua encomenda mas sem email associado para envio direto. "
                            "A nossa equipa foi avisada e entrará em contacto, se necessário. Obrigado!"
                        )
                        try:
                            send_reply(service, sender_email, subject, ack)
                        except Exception as e:
                            log(f"[Resend ack] send_reply error: {e}")
                        mark_as_read(service, msg_id)
                        mark_as_important(service, msg_id)
                        time.sleep(PER_MESSAGE_SLEEP)
                        continue

                    elif result == "not_found_notified_store":
                        ack = (
                            "Olá! Não conseguimos localizar uma encomenda com este email. "
                            "Pode indicar o **nº da encomenda** (ex.: #1234) ou o email usado na compra?"
                        )
                        try:
                            send_reply(service, sender_email, subject, ack)
                        except Exception as e:
                            log(f"[Resend ack] send_reply error: {e}")
                        mark_as_read(service, msg_id)
                        time.sleep(PER_MESSAGE_SLEEP)
                        continue

                    # 👇 NEW: number present but not found — tell the customer right away
                    elif result == "order_number_not_found":
                        ack = (
                            "Olá! Não conseguimos localizar a encomenda com o nº indicado. "
                            "Pode confirmar o **nº exato** (ex.: #1002) ou o **email usado na compra**? "
                            "Assim reenviamos a confirmação correta de imediato."
                        )
                        try:
                            send_reply(service, sender_email, subject, ack)
                        except Exception as e:
                            log(f"[Resend ack] send_reply error: {e}")
                        mark_as_read(service, msg_id)
                        mark_as_important(service, msg_id)
                        time.sleep(PER_MESSAGE_SLEEP)
                        continue

                # If the addon truly didn’t act, do NOT fall through to Gemini.
                log("[Resend] Intent detected but addon did not act; leaving UNREAD for manual follow-up.")
                time.sleep(PER_MESSAGE_SLEEP)
                continue

        # =========================
        # 2) AUTO-FILTER: no-reply / system emails
        # =========================
        if not email_filter(sender_email):
            try:
                mark_as_read(service, msg_id)
            except Exception:
                pass
            time.sleep(PER_MESSAGE_SLEEP)
            continue

        # =========================
        # 3) THREAD CONTEXT & REJECTIONS
        # =========================
        thread_corpus = gather_thread_text(service, thread_id, my_email=my_address) or thread_text
        rejection_count = count_rejections(thread_corpus)

        # Als 30% is aangeboden en daarna geweigerd → stuur return instructies.
        if offered_step3_then_rejected(service, thread_id, my_email=my_address):
            log("Detected rejection after 30% offer → sending return instructions.")
            body = compose_supplier_return_email(display_name)
            try:
                send_reply(service, sender_email, subject, body)
                mark_as_read(service, msg_id)
                mark_as_important(service, msg_id)
            except Exception as e:
                log(f"[Return after 30% offer] Error: {e}")
            time.sleep(PER_MESSAGE_SLEEP)
            continue

        # Short-circuit: after 3+ rejections → supplier return email (NO LLM)
        if rejection_count >= 3:
            log("Detected 3+ rejections. Sending supplier return instructions.")
            body = compose_supplier_return_email(display_name)
            try:
                send_reply(service, sender_email, subject, body)
                mark_as_read(service, msg_id)
                mark_as_important(service, msg_id)
            except Exception as e:
                log(f"[Send Supplier Email] Error: {e}")
            time.sleep(PER_MESSAGE_SLEEP)
            continue

        # =========================
        # 4) OPTIONAL: tracking snippet (for LLM context only)
        # =========================
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

        # =========================
        # 5) DEFAULT → GEMINI
        # =========================
        log(f"Processing email from {sender_email} - {subject}")
        reply = generate_reply(full_prompt, display_name, sender_email, thread_text)
        if reply is None:
            log("[Gemini] Skipping this message due to repeated rate limits or errors.")
            # Leave unread so we can try again later
            time.sleep(PER_MESSAGE_SLEEP)
            continue

        try:
            send_reply(service, sender_email, subject, reply)
            mark_as_read(service, msg_id)
            # Mark as important if partial refund accepted, or if 30% accepted after initial rejection/refund instructions
            if partial_refund_accepted_in_thread(service, thread_id, my_address):
                mark_as_important(service, msg_id)
            elif thirty_percent_accepted_after_rejection(service, thread_id, my_address):
                mark_as_important(service, msg_id)
            # Star for visibility unless special "no assistance possible" with <3 rejections
            elif "no assistance possible" in (reply or "").lower() and rejection_count < 3:
                pass  # don’t star
            else:
                mark_as_important(service, msg_id)
        except Exception as e:
            log(f"[Send LLM Email] Error: {e}")

        time.sleep(PER_MESSAGE_SLEEP)


if __name__ == "__main__":
    try:
        process_emails()
    except KeyboardInterrupt:
        log("Interrupted by user.")
    except Exception as e:
        log(f"Fatal error: {e}")
