import React, { useState } from 'react';
import { Mail, Upload, Send, CheckCircle, AlertCircle, Code, Download } from 'lucide-react';

export default function AbandonedCheckoutEmailer() {
  const [shopifyUrl, setShopifyUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [storeName, setStoreName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [emailService, setEmailService] = useState('sendgrid');
  const [emailApiKey, setEmailApiKey] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [status, setStatus] = useState('');
  const [showBackendCode, setShowBackendCode] = useState(false);

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogoUrl(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const sendToBackend = async (endpoint, data) => {
    try {
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
      }

      return await response.json();
    } catch (error) {
      throw new Error(error.message || 'Failed to connect to backend server');
    }
  };

  const sendTestEmail = async () => {
    if (!testEmail || !storeName || !supportEmail) {
      setStatus('error:Please fill in required fields');
      return;
    }

    if (!emailApiKey || !fromEmail) {
      setStatus('error:Please configure email service settings');
      return;
    }

    setSendingTest(true);
    setStatus('info:Sending test email...');

    try {
      const result = await sendToBackend('/send-test-email', {
        to_email: testEmail,
        from_email: fromEmail,
        subject: `${storeName} - Complete Your Order`,
        store_name: storeName,
        support_email: supportEmail,
        logo_url: logoUrl,
        email_service: emailService,
        api_key: emailApiKey,
      });

      setStatus(`success:${result.message}`);
    } catch (error) {
      setStatus(`error:${error.message}`);
    } finally {
      setSendingTest(false);
    }
  };

  const sendEmails = async () => {
    if (!shopifyUrl || !apiKey || !emailApiKey || !fromEmail) {
      setStatus('error:Please fill in all required fields');
      return;
    }

    setSending(true);
    setStatus('info:Fetching abandoned checkouts from Shopify...');

    try {
      const result = await sendToBackend('/send-abandoned-cart-emails', {
        shopify_url: shopifyUrl,
        shopify_api_key: apiKey,
        email_service: emailService,
        email_api_key: emailApiKey,
        from_email: fromEmail,
        store_name: storeName,
        support_email: supportEmail,
        logo_url: logoUrl,
      });

      setStatus(`success:${result.message}. Sent ${result.emails_sent} emails successfully!`);
    } catch (error) {
      setStatus(`error:${error.message}`);
    } finally {
      setSending(false);
    }
  };

  const pythonBackendCode = `# backend.py - Python Flask Backend for Shopify Abandoned Cart Emails
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from datetime import datetime

app = Flask(__name__)
CORS(app)

def generate_email_html(customer_name, checkout_url, items, total, store_name, support_email, logo_url=''):
    items_html = ''.join([
        f"""
        <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
                <p style="margin: 0; color: #1a1a1a; font-size: 15px; font-weight: 500;">{item['title']}</p>
                <p style="margin: 4px 0 0; color: #6a6a6a; font-size: 14px;">Quantity: {item['quantity']} × ${item['price']}</p>
            </td>
        </tr>
        """ for item in items
    ])
    
    logo_section = f'<img src="{logo_url}" alt="{store_name}" style="max-width: 200px; height: auto;">' if logo_url else f'<h1 style="margin: 0; color: #1a1a1a; font-size: 28px;">{store_name}</h1>'
    
    return f"""
<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px;">
                    <tr><td align="center" style="padding: 40px;">{logo_section}</td></tr>
                    <tr>
                        <td style="padding: 0 40px;">
                            <h2 style="color: #1a1a1a; font-size: 24px; margin: 0 0 16px;">Hi {customer_name},</h2>
                            <p style="color: #4a4a4a; font-size: 16px;">You left some items in your cart!</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 40px 30px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                {items_html}
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 40px 30px;">
                            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 20px; text-align: center;">
                                <p style="color: #ffffff; font-size: 18px; margin: 0;">Special Offer!</p>
                                <p style="color: #ffffff; font-size: 14px;">Use code <strong>VERLAINE-10</strong> for 10% off</p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 0 40px 40px;">
                            <a href="{checkout_url}?discount=VERLAINE-10" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 6px; font-size: 16px; font-weight: 600;">
                                COMPLETE YOUR ORDER
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f9f9f9; padding: 30px 40px;">
                            <p style="color: #8a8a8a; font-size: 12px; text-align: center; margin: 0;">
                                Questions? <a href="mailto:{support_email}">{support_email}</a><br>
                                © {datetime.now().year} {store_name}
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    """

def send_email_sendgrid(api_key, from_email, to_email, subject, html_content):
    url = "https://api.sendgrid.com/v3/mail/send"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    data = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": from_email},
        "subject": subject,
        "content": [{"type": "text/html", "value": html_content}]
    }
    response = requests.post(url, json=data, headers=headers)
    response.raise_for_status()
    return response

@app.route('/send-test-email', methods=['POST'])
def send_test_email():
    try:
        data = request.json
        
        mock_items = [
            {'title': 'Premium Leather Wallet', 'quantity': 1, 'price': '89.99'},
            {'title': 'Designer Sunglasses', 'quantity': 2, 'price': '129.99'}
        ]
        
        html = generate_email_html(
            'Test Customer',
            'https://yourstore.myshopify.com/checkout/test123',
            mock_items,
            '$349.97',
            data['store_name'],
            data['support_email'],
            data.get('logo_url', '')
        )
        
        send_email_sendgrid(
            data['api_key'],
            data['from_email'],
            data['to_email'],
            data['subject'],
            html
        )
        
        return jsonify({"message": f"Test email sent to {data['to_email']}"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/send-abandoned-cart-emails', methods=['POST'])
def send_abandoned_cart_emails():
    try:
        data = request.json
        
        shopify_url = f"https://{data['shopify_url']}/admin/api/2024-01/checkouts.json"
        headers = {"X-Shopify-Access-Token": data['shopify_api_key']}
        
        response = requests.get(shopify_url, headers=headers)
        response.raise_for_status()
        
        checkouts = response.json().get('checkouts', [])
        emails_sent = 0
        
        for checkout in checkouts:
            if checkout.get('abandoned_checkout_url') and checkout.get('email'):
                items = [{
                    'title': item['title'],
                    'quantity': item['quantity'],
                    'price': item['price']
                } for item in checkout.get('line_items', [])]
                
                html = generate_email_html(
                    checkout.get('customer', {}).get('first_name', 'Customer'),
                    checkout['abandoned_checkout_url'],
                    items,
                    checkout.get('total_price', '0.00'),
                    data['store_name'],
                    data['support_email'],
                    data.get('logo_url', '')
                )
                
                send_email_sendgrid(
                    data['email_api_key'],
                    data['from_email'],
                    checkout['email'],
                    f"{data['store_name']} - Complete Your Order",
                    html
                )
                
                emails_sent += 1
        
        return jsonify({
            "message": "Emails sent successfully",
            "emails_sent": emails_sent
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
`;

  const requirementsTxt = `Flask==3.0.0
flask-cors==4.0.0
requests==2.31.0`;

  const downloadFile = (filename, content) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <Mail className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-900">Abandoned Checkout Email System</h1>
          </div>
          <p className="text-gray-600">Full-stack integration with Python backend and React frontend</p>
        </div>

        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl shadow-lg p-6 border-2 border-green-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Code className="w-6 h-6 text-green-600" />
              Python Backend Setup
            </h2>
            <button
              onClick={() => setShowBackendCode(!showBackendCode)}
              className="text-sm text-green-700 hover:text-green-900 font-semibold"
            >
              {showBackendCode ? 'Hide Code' : 'Show Code'}
            </button>
          </div>
          
          <div className="space-y-3 mb-4">
            <div className="flex items-start gap-2">
              <span className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">1</span>
              <p className="text-gray-700">Download the Python backend files below</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">2</span>
              <p className="text-gray-700">Install dependencies: <code className="bg-gray-100 px-2 py-1 rounded text-sm">pip install -r requirements.txt</code></p>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">3</span>
              <p className="text-gray-700">Run the server: <code className="bg-gray-100 px-2 py-1 rounded text-sm">python backend.py</code></p>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">4</span>
              <p className="text-gray-700">Backend will run on <code className="bg-gray-100 px-2 py-1 rounded text-sm">http://localhost:5000</code></p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => downloadFile('backend.py', pythonBackendCode)}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download backend.py
            </button>
            <button
              onClick={() => downloadFile('requirements.txt', requirementsTxt)}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download requirements.txt
            </button>
          </div>

          {showBackendCode && (
            <div className="mt-4 bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-green-400 text-xs">{pythonBackendCode}</pre>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Configuration</h2>
          
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-700">Store Information</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Store Name *</label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Your Store Name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">From Email Address *</label>
                <input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="noreply@yourstore.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Support Email *</label>
                <input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  placeholder="support@yourstore.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Store Logo</label>
                <div className="flex items-center gap-4">
                  <label className="cursor-pointer bg-white px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    <span className="text-sm">Upload Logo</span>
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                  {logoUrl && <img src={logoUrl} alt="Logo" className="h-12 object-contain" />}
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold text-gray-700">Shopify API</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Shopify Store URL *</label>
                <input
                  type="text"
                  value={shopifyUrl}
                  onChange={(e) => setShopifyUrl(e.target.value)}
                  placeholder="yourstore.myshopify.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Shopify Admin API Key *</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="shpat_xxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold text-gray-700">Email Service</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Provider *</label>
                <select
                  value={emailService}
                  onChange={(e) => setEmailService(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="sendgrid">SendGrid</option>
                  <option value="mailgun">Mailgun</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email API Key *</label>
                <input
                  type="password"
                  value={emailApiKey}
                  onChange={(e) => setEmailApiKey(e.target.value)}
                  placeholder={emailService === 'sendgrid' ? 'SG.xxxxxxxxxxxxxxxx' : 'key-xxxxxxxxxxxxxxxx'}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-6 border border-indigo-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Discount Code Applied</h3>
          <p className="text-gray-600 mb-2">
            Code <span className="font-mono font-bold text-indigo-600">VERLAINE-10</span> automatically applied to all checkout links
          </p>
          <p className="text-sm text-gray-500">Customers receive an extra 10% off their order</p>
        </div>

        <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Send Test Email</h3>
          <p className="text-sm text-gray-600 mb-4">
            Test the email template by sending to your own email address
          </p>
          <div className="flex gap-3">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="your-email@example.com"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={sendTestEmail}
              disabled={sendingTest || !testEmail || !storeName || !supportEmail || !emailApiKey || !fromEmail}
              className="bg-blue-600 text-white py-2 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {sendingTest ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Send Test
                </>
              )}
            </button>
          </div>
        </div>

        {status && (
          <div className={`rounded-lg p-4 flex items-start gap-3 ${
            status.startsWith('success') ? 'bg-green-50 border border-green-200' :
            status.startsWith('error') ? 'bg-red-50 border border-red-200' :
            'bg-blue-50 border border-blue-200'
          }`}>
            {status.startsWith('success') ? (
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            ) : status.startsWith('error') ? (
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            )}
            <span className={`text-sm ${
              status.startsWith('success') ? 'text-green-800' :
              status.startsWith('error') ? 'text-red-800' :
              'text-blue-800'
            }`}>
              {status.split(':')[1]}
            </span>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-6">
          <button
            onClick={sendEmails}
            disabled={sending || !shopifyUrl || !apiKey || !emailApiKey || !fromEmail || !storeName || !supportEmail}
            className="w-full bg-indigo-600 text-white py-4 px-6 rounded-lg font-bold text-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {sending ? (
              <>
                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                Sending Campaign...
              </>
            ) : (
              <>
                <Send className="w-6 h-6" />
                Send Abandoned Cart Emails
              </>
            )}
          </button>
          <p className="text-center text-sm text-gray-500 mt-3">
            Make sure Python backend is running on localhost:5000
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-semibold text-yellow-900 mb-3">Complete Setup Checklist:</h3>
          <div className="space-y-2 text-sm text-yellow-800">
            <div className="flex items-start gap-2">
              <span className="mt-1">✓</span>
              <span>Download and run the Python backend (backend.py)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1">✓</span>
              <span>Create Shopify custom app with checkout read permissions</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1">✓</span>
              <span>Sign up for SendGrid or Mailgun and get API key</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1">✓</span>
              <span>Fill in all configuration fields above</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1">✓</span>
              <span>Send a test email to verify everything works</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1">✓</span>
              <span>Launch your email campaign!</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}