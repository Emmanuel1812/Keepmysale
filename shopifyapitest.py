
import os
import requests
from datetime import datetime, timedelta

SHOPIFY_ACCESS_TOKEN = os.getenv("SHOPIFY_ACCESS_TOKEN", "your_shopify_token_here")  # Vervang met jouw echte token
SHOPIFY_STORE = os.getenv("SHOPIFY_STORE", "verlaine-avenue.com")  # Vervang met jouw winkelnaam

headers = {
    "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
    "Content-Type": "application/json"
}


def get_orders_by_email():
    email = input("Voer klant e-mailadres in: ").strip()
    url = f"https://{SHOPIFY_STORE}/admin/api/2023-07/orders.json?email={email}"
    r = requests.get(url, headers=headers)
    data = r.json()
    orders = data.get("orders", [])

    if not orders:
        print("❌ Geen bestellingen gevonden voor dit e-mailadres.")
        return

    print(f"✅ {len(orders)} bestelling(en) gevonden voor {email}")
    for i, order in enumerate(orders):
        print(f"--- ORDER #{i+1} ---")
        show_order_info(order)


def get_order_by_number():
    number = input("Voer ordernummer in (zoals 1016): ").strip()
    url = f"https://{SHOPIFY_STORE}/admin/api/2023-07/orders.json?name={number}"
    r = requests.get(url, headers=headers)
    data = r.json()
    orders = data.get("orders", [])

    if not orders:
        print("❌ Geen order gevonden met nummer:", number)
        return

    order = orders[0]
    print(f"✅ Order gevonden: #{order['name']}")
    show_order_info(order)


def show_order_info(order):
    order_name = order.get("name", "onbekend")
    created_at = order.get("created_at", "")
    order_date = datetime.strptime(created_at, "%Y-%m-%dT%H:%M:%S%z")
    est_delivery = order_date + timedelta(days=15)
    print(f"📦 Ordernummer: {order_name}")
    print(f"📅 Besteld op: {order_date.strftime('%d-%m-%Y')}")
    print(f"🚚 Verwachte levering: {est_delivery.strftime('%d-%m-%Y')}")

    fulfillments = order.get("fulfillments", [])
    if not fulfillments:
        print("⚠️  Geen fulfillment info beschikbaar (nog niet verzonden?)")
        return

    for f in fulfillments:
        print("🔹 Tracking:", f.get("tracking_number", "onbekend"))
        print("🔹 Carrier:", f.get("tracking_company", "onbekend"))
        print("🔹 Status:", f.get("shipment_status", "onbekend"))
        print("---")

def view_all_orders():
    url = f"https://{SHOPIFY_STORE}/admin/api/2023-07/orders.json?limit=50&order=created_at desc"
    r = requests.get(url, headers=headers)
    data = r.json()
    orders = data.get("orders", [])

    if not orders:
        print("❌ Geen bestellingen gevonden.")
        return

    print(f"✅ {len(orders)} bestelling(en) gevonden.")
    for i, order in enumerate(orders):
        print(f"--- ORDER #{i+1} ---")
        show_order_info(order)


def menu():
    print("🔍 Shopify API Testmenu")
    print("1. Zoek orders op e-mailadres")
    print("2. Zoek order op ordernummer")
    print("3. Toon alle orders")
    print("4. Afsluiten")

    while True:
        choice = input("\nMaak een keuze (1–4): ").strip()
        if choice == "1":
            get_orders_by_email()
        elif choice == "2":
            get_order_by_number()
        elif choice == "3":
            view_all_orders()
        elif choice == "4":
            print("Tot ziens!")
            break
        else:
            print("❌ Ongeldige keuze. Probeer opnieuw.")



if __name__ == "__main__":
    menu()
