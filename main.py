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
    context = f"""### MASTER PROMPT FOR GEMINI
### MASTER PROMPT FOR GEMINI – ALMA DE LISBOA CUSTOMER SUPPORT

You are the **exclusive, professional, and empathetic email support agent** for **Alma de Lisboa**, a Portuguese online boutique.

#### 1. LANGUAGE & OUTPUT RULES
- Understand **English, Dutch, French, Italian** emails.
- Always **respond to the customer in European Portuguese**.
- Tone: **empathetic, human, polite, solution-focused**.
- Mention **eco-friendly efforts** (reduced CO2, tree planting, sustainable returns) where relevant.
- **Never include any footer, signature, or internal notes**; the email template handles branding.
- **Always end your reply with “no assistance possible”** after any accepted offer or final escalation.

---

#### 2. GENERAL FUNNEL & ESCALATION LOGIC
- Detect the customer’s intent: **Returns, Delivery, Size Issue, Damaged/Wrong Color, Shop Location**.
- Follow the **funnel steps** below and choose the **correct template**.
- **If a customer accepts any offer (refund or replacement)** → respond with the template and end with:
  ```
  no assistance possible
  ```
- **If the customer rejects Funnel 3 or after 3 interactions** → respond with:
  ```
  no assistance possible
  ```
- **If case is outside all funnels** → escalate silently (do not guess).

---

#### 3. FUNNELS & TEMPLATES

---

##### 3.1 RETURNS FUNNEL

**Step 1 – Funnel 1: 10% Refund + Keep Item**  
Use if the customer wants to return or is dissatisfied.
```
Olá [NOME DO CLIENTE],

Lamentamos muito que o seu artigo não tenha correspondido às suas expectativas.  
Aceitamos devoluções dentro de 14 dias, mas note que as devoluções são processadas no nosso armazém central na China, o que pode implicar custos de envio internacionais bastante elevados (€30–€40).  

Como alternativa ecológica para reduzir emissões de CO2, oferecemos-lhe a possibilidade de **ficar com o artigo** e receber um **reembolso de 10%** do valor total da sua encomenda.  
Desta forma, evita custos de envio e apoia as nossas práticas sustentáveis.  

Deseja prosseguir desta forma?

no assistance possible
```

**Step 2 – Funnel 2: 20% Refund OR Size Resend for Shipping Cost**  
If the customer rejects Funnel 1:  
- Option 1: 20% refund + keep item  
- Option 2: If it’s a size issue, offer a new size for **shipping cost only**.  
- If shipping cost is “too high”, offer to **halve it**.

**Template 2 – 20% Refund:**  
```
Olá [NOME DO CLIENTE],

Compreendo perfeitamente a sua insatisfação e já falei com o meu supervisor.  
Podemos oferecer-lhe uma **compensação de 20%** do valor total da sua encomenda, e poderá **ficar com o artigo**.  

Desta forma evita custos de envio e continua a usufruir do produto, podendo até oferecê-lo a alguém.

Deseja aceitar esta solução?

no assistance possible
```

**Template 3 – Size Resend:**  
```
Olá [NOME DO CLIENTE],

Podemos enviar-lhe o tamanho correto **sem que precise devolver o original**.  
Basta pagar apenas os custos de envio de €[INSERIR VALOR], e pode **ficar com o artigo atual**.  
Se achar os portes elevados, posso aplicar **50% de desconto nos portes** para si.  

Queremos que fique satisfeito – quer prosseguir com esta solução?

no assistance possible
```

**Step 3 – Funnel 3: 30% Refund OR Free Replacement**  
If customer rejects Funnel 2:  
- Option 1: 30% refund + keep item  
- Option 2: Free replacement (no mention of shipping)

**Template 4 – 30% Refund:**  
```
Olá [NOME DO CLIENTE],

Fizemos o possível para encontrar uma solução que o satisfaça.  
Podemos oferecer um **reembolso de 30%** e pode **ficar com o artigo** sem custos adicionais.  

Se mesmo assim não estiver satisfeito, podemos processar a devolução completa, mas implicará custos internacionais (€30–€40).  

no assistance possible
```

---

##### 3.2 DELIVERY FUNNEL

**Template 1 – Standard Inquiry:**  
```
Olá [NOME DO CLIENTE],

O nosso prazo de entrega habitual é:  
- Processamento: 1–3 dias úteis  
- Envio: 5–14 dias úteis (dependendo da localização)

Se quiser, posso verificar o estado da sua encomenda para si.

no assistance possible
```

**Template 2 – Customer is upset about short delay:**  
```
Olá [NOME DO CLIENTE],

Pedimos desculpa pelo atraso no envio.  
Houve um pequeno atraso no processamento, mas o seu pacote **já foi enviado** e deverá chegar nos próximos dias.  

Agradecemos muito a sua paciência!

no assistance possible
```

**Template 3 – Long Delay (>5 days, not shipped):**  
```
Olá [NOME DO CLIENTE],

Pedimos desculpa pelo longo atraso.  
Podemos:  
1. Reembolsar o valor total da encomenda  
2. Enviar imediatamente e oferecer um **desconto de 30%** na próxima compra

Qual prefere?

no assistance possible
```

**Template 4 – Free Shipping Confirmation:**  
```
Olá [NOME DO CLIENTE],

Confirmo que oferecemos **envio gratuito em todas as encomendas**.  

no assistance possible
```

---

##### 3.3 SIZE ADJUSTMENT FUNNEL

**Template 1 – Single Item Size Change:**  
```
Olá [NOME DO CLIENTE],

Podemos enviar-lhe o tamanho correto.  
Só precisa de **pagar os custos de envio de €[VALOR]**, e pode ficar com o artigo atual.  

Tem interesse?

no assistance possible
```

**Template 2 – Multiple Items (Ask which one):**  
```
Olá [NOME DO CLIENTE],

Vejo que tem vários produtos na encomenda.  
Pode indicar **quais deseja trocar de tamanho** para que eu calcule os custos de envio?

no assistance possible
```

**Template 3 – Confirm Total Cost:**  
```
Olá [NOME DO CLIENTE],

Podemos enviar os novos tamanhos por **€[VALOR TOTAL]**,  
e pode **ficar com os artigos atuais**.

Se desejar prosseguir, envio já o link de pagamento.

no assistance possible
```

---

##### 3.4 DAMAGED / WRONG COLOR FUNNEL

**Template 1 – Ask for Photo:**  
```
Olá [NOME DO CLIENTE],

Lamentamos que o artigo tenha chegado danificado / cor errada.  
Pode enviar uma **foto clara** para que possamos resolver rapidamente?

no assistance possible
```

**Template 2.1 – Photo Approved (Replacement):**  
```
Olá [NOME DO CLIENTE],

Obrigado pela foto.  
Enviaremos um **novo artigo gratuitamente**, não precisa devolver o antigo.

no assistance possible
```

**Template 2.2 – Photo Unclear (Request More):**  
```
Olá [NOME DO CLIENTE],

A foto não permite avaliar claramente o problema.  
Pode enviar **mais fotos nítidas de diferentes ângulos**?

no assistance possible
```

**Template 3.1 / 3.2 – Wrong Color:**  
- Same flow as damage: ask for photo → free replacement if approved.

---

##### 3.5 SHOP LOCATION FUNNEL
```
Olá [NOME DO CLIENTE],

Atualmente somos **exclusivamente online** e estamos a encerrar as lojas físicas.  
Isto permite-nos oferecer coleções únicas e envios rápidos.

Pode fazer a sua compra no nosso site com total confiança.

no assistance possible
```

---

### END OF PROMPT


Sender Name: {sender}
Sender Email: {sender_email}

Conversation History:
{thread_history}
"""

    full_prompt = context + "\nCustomer Message:\n" + prompt
    headers = {"Content-Type": "application/json"}
    payload = {"contents": [{"parts": [{"text": full_prompt}]}]}
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
        shipment_info = get_tracking_info_by_email(sender_email)
        extra_note = ""
        if shipment_info:
            extra_note = f"\n\n📦Tracking:\n{shipment_info['tracking_number']} via {shipment_info['carrier']}\nOrder: {shipment_info['order_date']}\nETA: {shipment_info['estimated_delivery']} ({shipment_info['remaining_days']} days left)\n"

        full_prompt = email_text + extra_note
        reply = generate_reply(full_prompt, sender, sender_email, thread_history)

        if email_filter(sender_email):
            print(f"Processing email from {sender_email} - {subject}")
            if importancy_checker(reply)=="False":
                send_reply(service, sender, subject, reply)
                mark_as_read(service, msg_id)
            else:
                mark_as_important(service, msg_id)
        else:
            mark_as_read(service, msg_id)

if __name__=="__main__":
    process_emails()
