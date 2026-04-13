import os
import base64
import json
import time
from email.message import EmailMessage
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# If modifying these scopes, delete the file token.json.
SCOPES = ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly']

# --- CONFIGURATION (FILL THIS IN) ---
TARGET_SUPPORT_EMAIL = "eo.commerces@gmail.com"  # The email connected to your SaaS
POLL_INTERVAL = 30  # Seconds to wait between checking for replies
MAX_POLLS = 10      # How many times to check for a reply before giving up
# ------------------------------------

TEST_CASES = [
    {
        "id": "wismo",
        "subject": "Status van mijn bestelling #1004",
        "body": "Hallo, ik heb een paar dagen geleden bestelling #1004 geplaatst maar nog niks gehoord. Waar blijft mijn pakket?"
    },
    {
        "id": "faq",
        "subject": "Vraag over de Multi-managed Snowboard",
        "body": "Hoi, ik zie dat ik de Multi-managed Snowboard heb besteld. Is deze ook geschikt voor beginners of moet ik een andere hebben?"
    },
    {
        "id": "return_negotiation",
        "subject": "Retour aanvraag order #1004",
        "body": "Goedenavond, ik wil graag mijn snowboard retourneren. Hij bevalt toch niet zo goed als ik dacht. Hoe stuur ik dit terug?"
    }
]

# Path to the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

def authenticate_gmail():
    creds = None
    token_path = os.path.join(SCRIPT_DIR, 'token.json')
    creds_path = os.path.join(SCRIPT_DIR, 'credentials.json')

    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(creds_path):
                import webbrowser
                print("\n❌ ERROR: 'credentials.json' is missing.")
                print("Google requires this file to identify this test script.")
                print("\nOpening the Google Cloud Console for you now...")
                webbrowser.open("https://console.cloud.google.com/apis/credentials")
                print("\nSTEPS TO FIX:")
                print("1. Click 'Create Credentials' -> 'OAuth client ID'")
                print("2. Select 'Desktop App' as Application Type.")
                print("3. Give it a name, click 'Create'.")
                print("4. Click 'Download JSON', rename it to 'credentials.json' and save it in this folder.")
                exit(1)
            flow = InstalledAppFlow.from_client_secrets_file(creds_path, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(token_path, 'w') as token:
            token.write(creds.to_json())
    return build('gmail', 'v1', credentials=creds)

def send_message(service, to, subject, body):
    try:
        message = EmailMessage()
        message.set_content(body)
        message['To'] = to
        message['Subject'] = subject
        encoded_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
        create_message = {'raw': encoded_message}
        send_message = (service.users().messages().send(userId="me", body=create_message).execute())
        print(f"Sent message to {to}. ID: {send_message['id']}")
        return send_message['id'], send_message['threadId']
    except HttpError as error:
        print(f"An error occurred: {error}")
        return None, None

def check_for_reply(service, target_email, subject, sent_time_ms):
    try:
        # Search for messages from the target email with the search-friendly subject
        # Re: [Subject] is the standard reply format
        query = f"from:{target_email} subject:({subject})"
        results = service.users().messages().list(userId="me", q=query).execute()
        messages = results.get('messages', [])
        
        if not messages:
            return None

        for msg_summary in messages:
            msg = service.users().messages().get(userId="me", id=msg_summary['id']).execute()
            msg_date = int(msg['internalDate'])
            
            # Only consider messages that arrived AFTER we sent ours
            if msg_date <= sent_time_ms + 1000:
                continue
            
            # This is a reply!
            payload = msg.get('payload', {})
            headers = payload.get('headers', [])
            msg_subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), "No Subject")
            
            # Simple body extraction
            body = ""
            if 'parts' in payload:
                for part in payload['parts']:
                    if part['mimeType'] == 'text/plain':
                        if 'data' in part['body']:
                            body = base64.urlsafe_b64decode(part['body']['data']).decode()
            elif 'body' in payload:
                if 'data' in payload['body']:
                    body = base64.urlsafe_b64decode(payload['body']['data']).decode()
            
            if body:
                return {
                    "id": msg['id'],
                    "subject": msg_subject,
                    "body": body
                }
        return None
    except HttpError as error:
        print(f"An error occurred during polling: {error}")
        return None

def main():
    if TARGET_SUPPORT_EMAIL == "your-support-email@example.com":
        print("!!! WARNING: You need to set TARGET_SUPPORT_EMAIL in the script configuration block.")
        # return

    service = authenticate_gmail()
    results = []

    print(f"\n🚀 Starting E2E AI Response Test Suite...")
    print(f"Target Support Email: {TARGET_SUPPORT_EMAIL}\n")

    for case in TEST_CASES:
        print(f"--- Testing: {case['id']} ---")
        
        # Grab timestamp BEFORE sending
        start_time_ms = int(time.time() * 1000)
        
        msg_id, thread_id = send_message(service, TARGET_SUPPORT_EMAIL, case['subject'], case['body'])
        
        if not msg_id:
            continue

        print(f"Waiting for AI reply to '{case['subject']}'...")
        reply = None
        for attempt in range(MAX_POLLS):
            time.sleep(POLL_INTERVAL)
            reply = check_for_reply(service, TARGET_SUPPORT_EMAIL, case['subject'], start_time_ms)
            if reply:
                print(f"✅ Received reply for {case['id']}!")
                break
            
            print(f"  (Attempt {attempt+1}/{MAX_POLLS}) No reply found in search yet. Still waiting...")

        results.append({
            "test_case": case,
            "ai_response": reply if reply else "TIMED OUT"
        })

    # Save results
    with open("scripts/test_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    with open("scripts/test_results.md", "w", encoding="utf-8") as f:
        f.write("# AI E2E Test Results\n\n")
        f.write(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        for res in results:
            f.write(f"## Test Case: {res['test_case']['id']}\n")
            f.write(f"**Subject:** {res['test_case']['subject']}\n")
            f.write(f"**Customer Message:**\n> {res['test_case']['body']}\n\n")
            if res['ai_response'] == "TIMED OUT":
                f.write("**AI Response:** ❌ TIMED OUT\n\n")
            else:
                f.write(f"**AI Response (Subject: {res['ai_response']['subject']}):**\n```\n{res['ai_response']['body']}\n```\n\n")

    print("\n✨ Test suite complete. Results saved to scripts/test_results.md and scripts/test_results.json")

if __name__ == '__main__':
    main()
