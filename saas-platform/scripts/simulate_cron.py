import requests
import time
import sys

# Configuration
LOCAL_API_URL = "http://localhost:3000/api/cron/check-gmail"
INTERVAL_SECONDS = 60  # Poll every minute

def run_sync():
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] 🔄 Triggering local Gmail sync...")
    try:
        response = requests.get(LOCAL_API_URL)
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
