#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Resend Confirmation Addon (v2) with brand logo + product images
"""
import os, re, base64, requests
from datetime import datetime
from email.mime.text import MIMEText

SHOPIFY_ACCESS_TOKEN = os.getenv("SHOPIFY_ACCESS_TOKEN", "your_shopify_token_here")
SHOPIFY_STORE = "verlaine-avenue.com"

BRAND_LOGO_URL = "https://cdn.shopify.com/s/files/1/0941/9807/1626/files/5_a59792dc-e55e-4945-9f48-8a2221422f06.png?v=1750858077"
BRAND_COLOR = os.environ.get("BRAND_COLOR", "#111827")
SUPPORT_EMAIL = os.environ.get("SUPPORT_EMAIL")

_INTENT_PATTERNS = [
    r"\bno (order )?confirmation\b",
    r"\bdid(?:\s?not|n't)\s+receive\s+(the\s+)?(order\s+)?confirmation\b",
    r"\bmissing\s+(order\s+)?confirmation\b",
    r"\bgeen\s+(bestel)?bevestiging\b",
    r"\bnão\s+recebi(?:\s+a)?\s+confirmação\b",
    r"\bnon ho ricevut[oa]\s+la\s+conferma\b",
    r"\bnon\s+ricevut[oa]\s+conferma\b",
]
def wants_resend_confirmation(text: str) -> bool:
    if not text: return False
    low = text.lower()
    return any(re.search(p, low) for p in _INTENT_PATTERNS)
def find_order_by_number(order_no: str | None):
    """
    Look up an order by its Shopify 'name' (e.g. '#1002').
    We pull a recent window and filter locally; expand/iterate if needed.
    """
    if not order_no:
        return None, "no_order_no"
    normalized = f"#{str(order_no).lstrip('#')}"
    url = (
        f"https://{SHOPIFY_STORE}/admin/api/2025-07/orders.json"
        "?status=any&limit=250"
        "&fields=id,name,email,currency,created_at,shipping_address,billing_address,customer,"
        "line_items,shipping_lines,current_subtotal_price,total_discounts,total_tax,"
        "current_total_price,payment_gateway_names,phone"
    )
    r = requests.get(url, headers=_shopify_headers(), timeout=25)
    r.raise_for_status()
    for o in r.json().get("orders", []):
        if (o.get("name") or "").strip() == normalized:
            return o, "ok"
    return None, "no_order_with_number"

def _shopify_headers():
    if not SHOPIFY_ACCESS_TOKEN:
        raise RuntimeError("Missing SHOPIFY_ACCESS_TOKEN")
    return {"X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN, "Content-Type": "application/json"}

def find_latest_order_by_email(customer_email: str):
    if not customer_email:
        return None, "no_email_inquiry"
    url = f"https://{SHOPIFY_STORE}/admin/api/2025-07/orders.json?status=any&email={customer_email}"
    r = requests.get(url, headers=_shopify_headers(), timeout=20)
    r.raise_for_status()
    orders = r.json().get("orders", [])
    if not orders: return None, "no_orders_for_email"
    orders.sort(key=lambda o: o.get("created_at",""), reverse=True)
    return orders[0], "ok"

_VARIANT_CACHE, _PRODUCT_CACHE = {}, {}
def _get_variant(variant_id: int):
    if not variant_id: return None
    if variant_id in _VARIANT_CACHE: return _VARIANT_CACHE[variant_id]
    url = f"https://{SHOPIFY_STORE}/admin/api/2025-07/variants/{variant_id}.json"
    r = requests.get(url, headers=_shopify_headers(), timeout=20)
    if r.status_code == 200:
        v = r.json().get("variant"); _VARIANT_CACHE[variant_id]=v; return v
    return None

def _get_product(product_id: int):
    if not product_id: return None
    if product_id in _PRODUCT_CACHE: return _PRODUCT_CACHE[product_id]
    url = f"https://{SHOPIFY_STORE}/admin/api/2025-07/products/{product_id}.json"
    r = requests.get(url, headers=_shopify_headers(), timeout=20)
    if r.status_code == 200:
        p = r.json().get("product"); _PRODUCT_CACHE[product_id]=p; return p
    return None

def resolve_line_item_image_url(li: dict) -> str | None:
    img = li.get("image")
    if isinstance(img, dict) and img.get("src"): return img["src"]
    variant_id = li.get("variant_id"); product_id = li.get("product_id")
    variant = _get_variant(variant_id) if variant_id else None
    if variant and not product_id: product_id = variant.get("product_id")
    product = _get_product(product_id) if product_id else None
    if not product: return None
    v_img_id = variant.get("image_id") if variant else None
    images = product.get("images") or []
    if v_img_id:
        for im in images:
            if im.get("id")==v_img_id and im.get("src"): return im["src"]
    if images: return images[0].get("src")
    return None

def _fmt_money(amount, currency):
    try: return f"{float(amount):.2f} {currency or ''}".strip()
    except Exception: return f"{amount} {currency or ''}".strip()

def _address_block(addr: dict) -> str:
    if not addr: return "<em>—</em>"
    lines = []
    name = addr.get("name") or f"{addr.get('first_name','')} {addr.get('last_name','')}".strip()
    lines.append(name or "")
    for k in ("address1","address2"):
        if addr.get(k): lines.append(addr[k])
    city_line = " ".join([x for x in [addr.get("zip"), addr.get("city")] if x])
    if city_line: lines.append(city_line)
    if addr.get("province"): lines.append(addr["province"])
    if addr.get("country"): lines.append(addr["country"])
    return "<br>".join([x for x in lines if x])

def build_confirmation_email_html(order: dict, *, logo_url: str | None = None, brand_color: str = "#111827", support_email: str | None = None, shop_domain: str | None = None, image_size: int = 72) -> str:
    currency = order.get("currency"); name = order.get("name"); created_at = order.get("created_at")
    order_date = "—"
    try:
        order_date = datetime.strptime(created_at, "%Y-%m-%dT%H:%M:%S%z").strftime("%d %b %Y")
    except Exception: pass

    line_items = order.get("line_items", [])
    shipping_address = order.get("shipping_address") or {}
    billing_address = order.get("billing_address") or shipping_address or {}
    customer = order.get("customer") or {}
    email_on_order = order.get("email")

    subtotal = float(order.get("current_subtotal_price") or order.get("subtotal_price") or 0.0)
    shipping_price = sum([float(s.get("price") or 0.0) for s in (order.get("shipping_lines") or [])])
    total_discounts = float(order.get("total_discounts") or 0.0)
    total_tax = float(order.get("total_tax") or 0.0)
    total_price = float(order.get("current_total_price") or order.get("total_price") or 0.0)

    discounts_html = ""
    if total_discounts:
        discounts_html = f"<tr><td style='padding:6px 0;color:#6b7280'>Descontos</td><td style='text-align:right;padding:6px 0;color:#6b7280'>- {subtotal:.2f}</td></tr>"

    rows = []
    for li in line_items:
        title = li.get("title","Item"); variant = li.get("variant_title") or ""; qty = li.get("quantity") or 1
        price = f"{float(li.get('price') or 0):.2f} {currency or ''}".strip()
        img_url = resolve_line_item_image_url(li)
        img_html = f"<img src='{img_url}' alt='{title}' style='width:{image_size}px;height:{image_size}px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb'>" if img_url else f"<div style='width:{image_size}px;height:{image_size}px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px'></div>"
        variant_str = f"<div style='color:#6b7280;font-size:12px'>{variant}</div>" if variant else ""
        rows.append(f"""
          <tr>
            <td style="padding:12px 0; vertical-align:top; width:{image_size+16}px">{img_html}</td>
            <td style="padding:12px 12px 12px 12px; vertical-align:top">
              <div style="font-weight:600">{title}</div>
              {variant_str}
            </td>
            <td style="padding:12px 0; text-align:center; white-space:nowrap">{qty}</td>
            <td style="padding:12px 0; text-align:right; white-space:nowrap">{price}</td>
          </tr>
        """)
    items_html = "\n".join(rows) or "<tr><td colspan='4' style='padding:12px 0'>Sem artigos</td></tr>"

    payments_html = "<div style='color:#6b7280'>Pagamento: " + ", ".join(order.get("payment_gateway_names") or []) + "</div>" if order.get("payment_gateway_names") else ""
    contact_html = ""
    parts = []
    if email_on_order: parts.append(email_on_order)
    if customer.get("phone"): parts.append(customer["phone"])
    if parts: contact_html = "<div style='color:#6b7280'>" + " · ".join(parts) + "</div>"

    html = f"""<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Confirmação de encomenda {name}</title></head>
<body style="margin:0;background:#f3f4f6;padding:20px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:700px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden">
    <tr><td style="background:{brand_color};padding:20px 24px">
      <div style="display:flex;align-items:center;gap:12px;color:#ffffff;">
        {"<img src='"+(logo_url or "")+"' alt='Logo' style='height:36px'>" if logo_url else ""}
        <div style="font-size:18px;font-weight:600">Confirmação de encomenda</div>
      </div>
    </td></tr>
    <tr><td style="padding:24px">
      <div style="font-size:20px;font-weight:700;margin-bottom:4px;">{name or "Encomenda"}</div>
      <div style="color:#6b7280">Data da encomenda: {order_date}</div>
    </td></tr>

    <tr><td style="padding:0 24px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <thead>
          <tr style="border-bottom:1px solid #e5e7eb">
            <th align="left" style="padding:8px 0;text-transform:uppercase;font-size:12px;color:#6b7280;letter-spacing:.04em">Imagem</th>
            <th align="left" style="padding:8px 0;text-transform:uppercase;font-size:12px;color:#6b7280;letter-spacing:.04em">Artigo</th>
            <th align="center" style="padding:8px 0;text-transform:uppercase;font-size:12px;color:#6b7280;letter-spacing:.04em">Qtd</th>
            <th align="right" style="padding:8px 0;text-transform:uppercase;font-size:12px;color:#6b7280;letter-spacing:.04em">Preço</th>
          </tr>
        </thead>
        <tbody>{items_html}</tbody>
      </table>
    </td></tr>

    <tr><td style="padding:0 24px 24px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;padding-top:12px">
        <tr><td style="padding:6px 0;color:#6b7280">Subtotal</td><td style="text-align:right;padding:6px 0;color:#6b7280">{subtotal:.2f} {currency or ""}</td></tr>
        {discounts_html}
        <tr><td style="padding:6px 0;color:#6b7280">Envio</td><td style="text-align:right;padding:6px 0;color:#6b7280">{shipping_price:.2f} {currency or ""}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Impostos</td><td style="text-align:right;padding:6px 0;color:#6b7280">{total_tax:.2f} {currency or ""}</td></tr>
        <tr><td style="padding:10px 0;font-weight:700;border-top:1px solid #e5e7eb">Total</td><td style="text-align:right;padding:10px 0;font-weight:700;border-top:1px solid #e5e7eb">{total_price:.2f} {currency or ""}</td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:0 24px 24px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px">
        <tr>
          <td style="padding:16px;vertical-align:top;width:50%">
            <div style="font-weight:600;margin-bottom:6px">Morada de envio</div>
            <div style="color:#111827">{_address_block(shipping_address)}</div>
            {payments_html}
            {contact_html}
          </td>
          <td style="padding:16px;vertical-align:top;width:50%">
            <div style="font-weight:600;margin-bottom:6px">Morada de faturação</div>
            <div style="color:#111827">{_address_block(billing_address)}</div>
            {"<div style='color:#6b7280'>Loja: "+shop_domain+"</div>" if shop_domain else ""}
            {"<div style='color:#6b7280'>Apoio: "+support_email+"</div>" if support_email else ""}
          </td>
        </tr>
      </table>
    </td></tr>

    <tr><td style="padding:0 24px 28px;color:#6b7280">
      Esta é uma reemissão de confirmação de encomenda enviada a seu pedido. Se algo não estiver correto, responda a este email.
    </td></tr>
  </table>
</body></html>"""
    return html

def gmail_send_html(service, to_email: str, subject: str, html_body: str, thread_id: str | None = None):
    msg = MIMEText(html_body, "html", "utf-8")
    msg["To"] = to_email; msg["Subject"] = subject
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")
    body = {"raw": raw}
    if thread_id: body["threadId"] = thread_id
    return service.users().messages().send(userId='me', body=body).execute()

def gmail_profile_email(service):
    profile = service.users().getProfile(userId='me').execute()
    return profile.get("emailAddress")

def handle_resend_confirmation_flow(
    service,
    customer_email_from_thread: str,
    thread_text: str,
    thread_id: str | None,
    fallback_sender_email: str,
    *,
    assume_intent: bool = False,         # ← new: let caller bypass the addon’s own check
    order_no: str | None = None,         # ← new: prefer lookup by order number if available
):
    # Only re-check intent if the caller didn't explicitly force it
    if not (assume_intent or wants_resend_confirmation(thread_text)):
        return {"acted": False, "reason": "no_intent"}

    # Prefer an explicit order number (e.g. '#1002') if provided
    order = None
    reason = None
    if order_no:
        order, reason = find_order_by_number(order_no)

    # Fallback: use customer email from the thread to find the latest order
    if not order:
        order, reason = find_latest_order_by_email(customer_email_from_thread)

    if not order:
        gmail_send_html(
            service,
            fallback_sender_email,
            "Pedido: reenviar confirmação — não foi possível localizar a encomenda",
            (
                f"<p>O cliente <strong>{customer_email_from_thread}</strong> solicitou reenvio da "
                f"confirmação, mas não encontrámos encomendas por email"
                f"{' nem pelo nº ' + order_no if order_no else ''}.</p>"
            ),
            thread_id,
        )
        return {"acted": True, "result": "not_found_notified_store"}

    target_email = order.get("email")
    has_phone_only = (not target_email) and bool(
        order.get("phone") or (order.get("customer") or {}).get("phone")
    )

    if target_email:
        html = build_confirmation_email_html(
            order,
            logo_url=BRAND_LOGO_URL,
            brand_color=BRAND_COLOR,
            support_email=SUPPORT_EMAIL,
            shop_domain=SHOPIFY_STORE,
        )
        gmail_send_html(
            service,
            target_email,
            f"Confirmação reenviada: {order.get('name','encomenda')}",
            html,
            thread_id,
        )
        return {"acted": True, "result": "resent_to_customer", "email": target_email}

    elif has_phone_only:
        gmail_send_html(
            service,
            fallback_sender_email,
            "Pedido: reenvio de confirmação (apenas telefone no pedido)",
            (
                f"<p>Pedido para reenviar confirmação relativo ao cliente que escreveu de "
                f"<strong>{customer_email_from_thread}</strong>. A encomenda correspondente tem "
                f"apenas número de telefone e não contém email.</p>"
            ),
            thread_id,
        )
        return {"acted": True, "result": "no_email_order_notified_store"}

    else:
        gmail_send_html(
            service,
            fallback_sender_email,
            "Pedido: reenviar confirmação — encomenda sem email",
            (
                f"<p>Encontrámos uma encomenda, mas sem email associado. Cliente: "
                f"{customer_email_from_thread}</p>"
            ),
            thread_id,
        )
        return {"acted": True, "result": "order_without_email_notified_store"}
