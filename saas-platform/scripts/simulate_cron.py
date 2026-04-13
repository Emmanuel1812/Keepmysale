import requests
import time
import sys

# Load CRON_SECRET from .env.local if possible
def get_cron_secret():
    try:
        with open(".env.local", "r") as f:
            for line in f:
                if line.startswith("CRON_SECRET="):
                    return line.split("=")[1].strip()
    except:
        pass
    return "your-secret-here" # Fallback

CRON_SECRET = get_cron_secret()

def run_sync():
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] 🔄 Triggering local Gmail sync...")
    try:
        headers = {"Authorization": f"Bearer {CRON_SECRET}"}
        response = requests.get(LOCAL_API_URL, headers=headers)
        if response.status_code == 200:
            data = response.json()
            processed = data.get('processedCount', 0)
            merchants = data.get('merchantsChecked', 0)
            print(f"✅ Success! Processed {processed} emails across {merchants} merchants.")
        else:
            print(f"❌ Failed! Status Code: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"⚠️ Error reaching local server: {e}")
        print("   Make sure your Next.js app is running on http://localhost:3000")

def main():
    print("🚀 Local Cron Simulator Started")
    print(f"Target: {LOCAL_API_URL}")
    print(f"Interval: {INTERVAL_SECONDS} seconds")
    print("Press Ctrl+C to stop.")
    
    try:
        while True:
            run_sync()
            time.sleep(INTERVAL_SECONDS)
    except KeyboardInterrupt:
        print("\n👋 Local cron simulator stopped.")
        sys.exit(0)

if __name__ == "__main__":
    main()
