import json, requests, datetime
from bs4 import BeautifulSoup
from datetime import datetime as dt

DATA_FILE = "data.json"
CALENDAR_URL = "https://heavymusichq.com/heavy-metal-album-release-calendar/"

def load_data():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_data(d):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)

def update_generated(d):
    today = dt.now().strftime("%Y-%m-%d")
    d["generated"] = today
    d["generatedAt"] = dt.now().isoformat()
    d["range"] = f"{dt.now().strftime('%d %b')} – {(dt.now() + datetime.timedelta(days=1)).strftime('%d %b %Y')}"

def scrape_future():
    try:
        r = requests.get(CALENDAR_URL, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
        soup = BeautifulSoup(r.text, "lxml")
        items = []
        for h in soup.find_all(["h2","h3"]):
            text = h.get_text(strip=True)
            if "2026" in text and any(m in text for m in ["Jul","Aug","Sep"]):
                items.append({"date": text, "lbl": "Heavy Music HQ", "items": []})
        return items or d.get("future", [])
    except:
        return d.get("future", [])

d = load_data()
update_generated(d)
d["future"] = scrape_future()
save_data(d)
print("✅ data.json atualizado com foco Tidal")
