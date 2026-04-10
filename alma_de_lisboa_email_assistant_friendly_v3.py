import os
import base64
import requests
import re
from email.mime.text import MIMEText

from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials

from datetime import datetime, timedelta

SHOPIFY_ACCESS_TOKEN = os.getenv("SHOPIFY_ACCESS_TOKEN", "your_shopify_token_here")
SHOPIFY_STORE = "alma-de-lisboa.com"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "your_gemini_key_here")
SCOPES = ['https://www.googleapis.com/auth/gmail.modify']

def get_tracking_info_by_email(customer_email):
    headers = {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json"
    }

    url = f"https://{SHOPIFY_STORE}/admin/api/2023-07/orders.json?email={customer_email}"
    resp = requests.get(url, headers=headers)
    data = resp.json()

    if not data.get("orders"):
        return None

    latest_order = data["orders"][0]
    created_at = latest_order["created_at"]
    order_date = datetime.strptime(created_at, "%Y-%m-%dT%H:%M:%S%z")
    today = datetime.now(order_date.tzinfo)

    estimated_delivery_date = order_date + timedelta(days=15)
    remaining_days = (estimated_delivery_date - today).days
    remaining_days = max(0, remaining_days)

    fulfillment = latest_order["fulfillments"][0] if latest_order["fulfillments"] else None
    if fulfillment:
        tracking_number = fulfillment.get("tracking_number", "onbekend")
        carrier = fulfillment.get("tracking_company", "onbekend")
        return {
            "tracking_number": tracking_number,
            "carrier": carrier,
            "order_date": order_date.strftime("%d-%m-%Y"),
            "estimated_delivery": estimated_delivery_date.strftime("%d-%m-%Y"),
            "remaining_days": remaining_days
        }
    return None

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
        with open(token_path, 'w') as token:
            token.write(creds.to_json())
    return build('gmail', 'v1', credentials=creds)

def get_unread_messages(service):
    results = service.users().messages().list(
        userId='me',
        labelIds=['INBOX'],
        q='is:unread -is:starred'
    ).execute()
    return results.get('messages', [])

def email_filter(email):
    blocklist = ["no-reply", "noreply", "no reply", "shopify"]
    if any(b in email.lower() for b in blocklist):
        return False
    return True

def get_email_text(service, msg_id):
    msg = service.users().messages().get(userId='me', id=msg_id, format='full').execute()
    payload = msg['payload']
    parts = payload.get('parts', [])
    for part in parts:
        if part['mimeType'] == 'text/plain':
            data = part['body']['data']
            return base64.urlsafe_b64decode(data).decode()
    return ""

def generate_reply(prompt, sender, sender_email, thread_history):
    shopname = "Alma de Lisboa"
    context = f"""
### ROLE
You are the **exclusive, warm, empathetic, and professional support agent** for {shopname}.  
Your task is to **immediately reply to the customer** in **European Portuguese** using a friendly, caring, and positive tone.  
Do not acknowledge instructions, do not explain your process, do not say you will wait.  
**Only output the exact warm and polite email reply to the customer.**

---

### LANGUAGE RULES
- Understand English, Dutch, French, Italian messages
- Always reply in **European Portuguese**
- Be **friendly, polite, empathetic, and solution-focused**
- Start emails with a **warm greeting** like:
  - "Esperamos que esteja a ter um ótimo dia!"
  - "Muito obrigado por nos contactar."
- End emails with something positive like:
  - "Estamos sempre aqui para ajudar!"
  - "Agradecemos muito a sua confiança."  
- Mention sustainability (CO2 reduction, eco-shipping, tree planting) where relevant
- Do NOT include any footer, signature, or internal notes
- End with:  
  ```
Cumprimentos, Alma de Lisboa  ```  
  **only after an accepted solution or final rejection**

---

### RETURNS FUNNEL (FRIENDLY VERSION)
Always handle return requests in this exact order:

**Step 1 → 10% refund + keep item**
```
Olá [NOME DO CLIENTE],

Esperamos que esteja a ter um ótimo dia!  
Lamentamos que o artigo não tenha correspondido totalmente às suas expectativas.  

Como os nossos armazéns estão no estrangeiro, uma devolução internacional geraria muitos custos e uma pegada de CO2 elevada.  
Para o/a ajudar e também cuidar do planeta, teremos todo o prazer em oferecer-lhe **10% de reembolso** e poderá **ficar com o artigo**.  

Desta forma, evita custos e juntos contribuímos para um impacto ambiental mais positivo.  
Se esta solução for adequada para si, basta responder e processaremos de imediato.  

Agradecemos a sua confiança e estamos sempre aqui para ajudar!  

Cumprimentos, Alma de Lisboa```

**Step 2 → 20% refund + keep item (if customer refuses step 1)**
```
Olá [NOME DO CLIENTE],

Muito obrigado pelo seu retorno e por partilhar o seu feedback connosco.  
Queremos mesmo que fique feliz com a sua compra.  

Como alternativa, podemos oferecer-lhe **20% de reembolso** e pode **ficar com o artigo**.  
Assim, evita custos e ajudamos juntos o planeta.  

Aguardamos a sua resposta com carinho e estamos sempre aqui para si.  

Cumprimentos, Alma de Lisboa```

**Step 3 → 30% refund + keep item (if customer refuses step 2)**
```
Olá [NOME DO CLIENTE],

Agradecemos muito a sua paciência e compreensão.  
Queremos muito encontrar uma solução que o deixe feliz.  

Podemos oferecer-lhe **30% de reembolso** e pode **ficar com o artigo**.  
Esta é a nossa melhor oferta antes de considerar uma devolução internacional que tem um impacto ambiental elevado.  

Se mesmo assim não for adequado, por favor avise-nos.  
Muito obrigado pela confiança que deposita em nós.  

Cumprimentos, Alma de Lisboa```

**Step 4 → After 3 rejections**
- Reply only:
```
no assistance possible
```
- Mark email as ⭐ for human follow-up

---

### OTHER FUNNELS
(Delivery, Size Adjustment, Damaged/Wrong Color, Shop Location)  
- Follow the same friendly tone
- Be positive, caring, and close with a warm line like:  
  "Muito obrigado e conte sempre connosco!"

---

Sender Name: {sender}  
Sender Email: {sender_email}  

Conversation History:  
{thread_history}  

Customer Message:  
{prompt}  

### TASK
Now generate the **final warm and friendly customer email reply** in **European Portuguese** following all the above funnels, rules, and templates.
"""
    headers = {"Content-Type": "application/json"}
    payload = {"contents": [{"parts": [{"text": context}]}]}
    response = requests.post(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
        headers=headers, json=payload, params={"key": GEMINI_API_KEY}
    )
    response.raise_for_status()
    return response.json()["candidates"][0]["content"]["parts"][0]["text"]

def importancy_checker(response):
    return "True" if "no assistance possible" in response.lower() else "False"

def send_reply(service, to_email, subject, body_text):
    body_text = re.sub(r'(\*\*|__)(.+?)(\*\*|__)', r'<b>\2</b>', body_text)
    body_text = re.sub(r'(\*|_)([^\*_]+)(\*|_)', r'<i>\2</i>', body_text)
    def text_to_html(text):
        paragraphs = []
        for p in text.strip().split('\n\n'):
            if p.strip():
                html_paragraph = re.sub(r'\n', '<br>', p.strip())
                paragraphs.append(f"<p>{html_paragraph}</p>")
        return '\n'.join(paragraphs)
    html_body = text_to_html(body_text)
    html_template = f"<html><body style='font-family:Arial,sans-serif;color:#222'><div style='max-width:600px;margin:auto;border:1px solid #eee;padding:24px;border-radius:8px'><div style='font-size:16px;line-height:1.7'>{html_body}</div></div></body></html>"
    message = MIMEText(html_template, 'html')
    message['to'] = to_email
    message['subject'] = "Re: " + subject
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    return service.users().messages().send(userId='me', body={'raw': raw}).execute()

def mark_as_read(service, msg_id):
    service.users().messages().modify(userId='me', id=msg_id, body={'removeLabelIds':['UNREAD']}).execute()

def mark_as_important(service, msg_id):
    service.users().messages().modify(userId='me', id=msg_id, body={'addLabelIds':['STARRED']}).execute()

def process_emails():
    service = authenticate_gmail()
    messages = get_unread_messages(service)

    for msg in messages:
        msg_id = msg['id']
        msg_data = service.users().messages().get(userId='me', id=msg_id, format='metadata', metadataHeaders=['Subject','From']).execute()
        headers = msg_data['payload']['headers']
        subject = next((h['value'] for h in headers if h['name']=='Subject'),"No Subject")
        sender = next((h['value'] for h in headers if h['name']=='From'),"")
        sender_email = sender.split('<')[-1].replace('>','').strip() if '<' in sender else sender

        email_text = get_email_text(service, msg_id)
        thread_history = email_text

        # Count rejections (simplified Portuguese patterns)
        rejection_count = thread_history.lower().count("não aceito") +                           thread_history.lower().count("não quero") +                           thread_history.lower().count("não está bem")

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

        full_prompt = email_text + extra_note
        reply = generate_reply(full_prompt, sender, sender_email, thread_history)

        if email_filter(sender_email):
            print(f"Processing email from {sender_email} - {subject}")

            if "no assistance possible" in reply.lower():
                # Only mark as important after 3 rejections
                if rejection_count >= 3:
                    mark_as_important(service, msg_id)
                    print("⭐ Mail gemarkeerd als belangrijk na 3 afwijzingen")
                else:
                    send_reply(service, sender, subject, reply)
                    mark_as_read(service, msg_id)
            else:
                send_reply(service, sender, subject, reply)
                mark_as_read(service, msg_id)
        else:
            mark_as_read(service, msg_id)

if __name__=="__main__":
    process_emails()
