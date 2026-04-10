
import os
import base64
import requests
import re
from datetime import datetime, timedelta
from email.mime.text import MIMEText

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SHOPIFY_ACCESS_TOKEN = os.getenv("SHOPIFY_ACCESS_TOKEN", "your_shopify_token_here")
SHOPIFY_STORE = "alma-de-lisboa.com"

# Gemini API Key (from Google AI Studio, free tier)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "your_gemini_key_here")

# Gmail API Scopes
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
    blacklist = ["no-reply", "noreply", "shopify", "mailer-daemon"]
    whitelist = ["@alma-de-lisboa.com", "@kingston-boutique.com", "@gmail.com"]
    if any(bad in email.lower() for bad in blacklist):
        return False
    return any(domain in email.lower() for domain in whitelist)



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
    context = f"""*🎯 Prompt: Klantenservice Bot voor {shopname}*

You are the professional, friendly, and empathetic customer service bot for {shopname}, a Portuguese online fashion boutique. Provide helpful responses.

Sender Name: {sender}
Sender Email: {sender_email}

---

### 📦 Shipment Data & Customer Message:
{prompt}
"""

    payload = {
        "contents": [{"parts": [{"text": context}]}]
    }
    response = requests.post(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
        headers={"Content-Type": "application/json"},
        json=payload,
        params={"key": GEMINI_API_KEY}
    )
    response.raise_for_status()
    return response.json()["candidates"][0]["content"]["parts"][0]["text"]


def importancy_checker(response):
    keywords = [
        "I am unable to assist", "no assistance possible"
    ]
    return "True" if any(k.lower() in response.lower() for k in keywords) else "False"


def send_reply(service, to_email, subject, body_text):
    body_text = re.sub(r'(\*\*|__)(.+?)(\*\*|__)', r'<b>\2</b>', body_text)
    body_text = re.sub(r'(\*|_)([^\*_]+)(\*|_)', r'<i>\2</i>', body_text)

    html_body = ''.join([f"<p>{line.strip()}</p>" for line in body_text.strip().split('\n\n') if line.strip()])
    message = MIMEText(f"<html><body>{html_body}</body></html>", 'html')
    message['to'] = to_email
    message['subject'] = "Re: " + subject
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    return service.users().messages().send(userId='me', body={'raw': raw}).execute()


def mark_as_read(service, msg_id):
    service.users().messages().modify(userId='me', id=msg_id, body={'removeLabelIds': ['UNREAD']}).execute()


def mark_as_important(service, msg_id):
    service.users().messages().modify(userId='me', id=msg_id, body={'addLabelIds': ['STARRED']}).execute()


def process_emails():
    service = authenticate_gmail()
    messages = get_unread_messages(service)

    for msg in messages:
        msg_id = msg['id']
        msg_data = service.users().messages().get(userId='me', id=msg_id, format='metadata',
                                                  metadataHeaders=['Subject', 'From']).execute()
        headers = msg_data['payload']['headers']
        subject = next((h['value'] for h in headers if h['name'] == 'Subject'), "No Subject")
        sender = next((h['value'] for h in headers if h['name'] == 'From'), "")
        sender_email = sender.split('<')[-1].replace('>', '').strip() if '<' in sender else sender

        if not email_filter(sender_email):
            print(f"Skipping email from {sender_email} due to filter criteria.")
            mark_as_read(service, msg_id)
            continue

        mark_as_read(service, msg_id)  # belangrijk: markeer zodra we starten

        email_text = get_email_text(service, msg_id)
        thread_history = email_text

        shipment_info = get_tracking_info_by_email(sender_email)
        extra_note = ""
        if shipment_info:
            extra_note += (
                f"📦 Verzending info:\n"
                f"Trackingnummer: {shipment_info['tracking_number']}\n"
                f"Carrier: {shipment_info['carrier']}\n"
                f"Bestelling geplaatst op: {shipment_info['order_date']}\n"
                f"Geschatte levering: rond {shipment_info['estimated_delivery']}\n"
            )
            if shipment_info["remaining_days"] == 0:
                extra_note += "Volgens onze schatting is het pakket waarschijnlijk al aangekomen of komt het elk moment aan.\n"
            else:
                extra_note += f"Geschat: nog ongeveer {shipment_info['remaining_days']} dagen te gaan.\n"

        full_prompt = email_text + "\n\n" + extra_note
        reply = generate_reply(full_prompt, sender, sender_email, thread_history)

        print(f"Processing email from {sender_email} with subject: {subject}")
        if importancy_checker(reply) == "False":
            send_reply(service, sender, subject, reply)
            print(f"Replied to {sender}")
        else:
            mark_as_important(service, msg_id)
            print(f"Gemini needs help. Marked important: {sender}")


if __name__ == "__main__":
    process_emails()
