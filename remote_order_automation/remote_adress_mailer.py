import os
import base64
import requests
from email.mime.text import MIMEText
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials

# -----------------------------
# CONFIGURATION
# -----------------------------
SHOPIFY_ACCESS_TOKEN = os.getenv("SHOPIFY_ACCESS_TOKEN", "your_shopify_token_here")
SHOPIFY_STORE = "qfqvbf-0c.myshopify.com"  # Use the .myshopify.com domain!
SCOPES = ['https://www.googleapis.com/auth/gmail.send']

# -----------------------------
# GMAIL AUTHENTICATION
# -----------------------------
def authenticate_gmail():
    creds = None
    credentials_path = r"C:\Users\eoude\Desktop\PersonalProjects\email automation\credentials.json"
    token_path = r"C:\Users\eoude\Desktop\PersonalProjects\email automation\token.json"

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

# -----------------------------
# SHOPIFY ORDER FETCHING
# -----------------------------
def get_order_info(order_number):
    headers = {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json"
    }
    url = f"https://{SHOPIFY_STORE}/admin/api/2023-07/orders.json?name={order_number}"
    resp = requests.get(url, headers=headers)
    data = resp.json()

    if not data.get("orders"):
        return None

    order = data["orders"][0]
    shipping_address = order.get('shipping_address', {})

    # Build full address
    address_str = f"{shipping_address.get('address1','')}"
    if shipping_address.get('address2'):
        address_str += f", {shipping_address['address2']}"
    address_str += f", {shipping_address.get('zip','')} {shipping_address.get('city','')}, {shipping_address.get('country','')}"

    # Collect line items
    items = [f"{item['quantity']} x {item['name']}" for item in order.get('line_items', [])]

    return {
        "order_number": order_number,
        "email": order.get("email", "No email"),
        "name": f"{shipping_address.get('first_name','')} {shipping_address.get('last_name','')}".strip(),
        "address": address_str,
        "line_items": items
    }

# -----------------------------
# EMAIL SENDING
# -----------------------------
def send_email(service, to_email, subject, body_text):
    message = MIMEText(body_text, 'plain', 'utf-8')
    message['to'] = to_email
    message['subject'] = subject
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    return service.users().messages().send(userId='me', body={'raw': raw}).execute()

# -----------------------------
# PROCESS ORDERS WITH CONFIRMATION
# -----------------------------
def process_orders(file_path):
    service = authenticate_gmail()
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read().strip()
        order_numbers = [o.strip() for o in content.split(',') if o.strip()]

    for order_number in order_numbers:
        info = get_order_info(order_number)
        if not info:
            print(f"⚠️ Order {order_number} not found on Shopify.")
            continue

        # Show all details for confirmation
        print("\n--------------------------------------")
        print(f"Order Number: {info['order_number']}")
        print(f"Customer Name: {info['name']}")
        print(f"Customer Email: {info['email']}")
        print(f"Shipping Address: {info['address']}")
        print("Items:")
        for item in info['line_items']:
            print(f" - {item}")
        print("--------------------------------------\n")

        confirm = input(f"Send email to {info['email']} for order {order_number}? (y/n): ").strip().lower()
        if confirm != 'y':
            print("❌ Skipped sending email for this order.\n")
            continue

        # Email content
        email_body = f"""
Olá {info['name']},

Infelizmente, a nossa transportadora informou-nos que o endereço abaixo é considerado remoto e não podemos efetuar a entrega:

{info['address']}

Poderia, por favor, fornecer-nos um endereço alternativo para que possamos enviar a sua encomenda?

Cumprimentos,
Alma de Lisboa
"""

        send_email(service, info['email'], f"Problema com a sua encomenda {order_number}", email_body)
        print(f"📧 Email enviado para {info['email']} sobre a encomenda {order_number}\n")

# -----------------------------
# MAIN EXECUTION
# -----------------------------
if __name__ == "__main__":
    process_orders("remote_adress_orders.txt")
