import json, requests, datetime
from bs4 import BeautifulSoup
from datetime import datetime as dt

DATA_FILE = "data.json"

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
        r = requests.get("https://heavymusichq.com/heavy-metal-album-release-calendar/", headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
        soup = BeautifulSoup(r.text, "lxml")
        items = []
        for h in soup.find_all(["h2","h3"]):
            text = h.get_text(strip=True)
            if "2026" in text and any(m in text for m in ["Jul","Aug","Sep","Oct"]):
                items.append({"date": text, "lbl": "Heavy Music HQ", "items": []})
        return items or d.get("future", [])
    except:
        return d.get("future", [])

def scrape_tidal_new():
    try:
        # Busca pública Tidal para metal new releases
        r = requests.get("https://api.tidal.com/v1/search?query=metal%20new%20release&limit=20&type=ALBUMS", headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
        data = r.json()
        items = []
        for item in data.get("items", [])[:10]:
            items.append({
                "b": item.get("artist", {}).get("name", "Unknown"),
                "t": item.get("title", ""),
                "lbl": "Tidal",
                "date": dt.now().strftime("%d %b"),
                "g": "heavy"
            })
        return items
    except:
        return []

def scrape_recent_news():
    try:
        r = requests.get("https://metalinjection.net/", headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
        soup = BeautifulSoup(r.text, "lxml")
        news = []
        for a in soup.find_all("a", href=True)[:15]:
            title = a.get_text(strip=True)
            if len(title) > 25 and any(k in title.lower() for k in ["release", "new", "album"]):
                news.append({
                    "title": title[:140],
                    "src": "Metal Injection",
                    "date": dt.now().strftime("%d %b"),
                    "url": "https://metalinjection.net" + a['href'] if not a['href'].startswith("http") else a['href']
                })
        return news[:12] or d.get("news", [])
    except:
        return d.get("news", [])

d = load_data()
update_generated(d)
d["future"] = scrape_future()
d["news"] = scrape_recent_news()

# Adiciona Tidal new releases ao recent ou fresh
tidal_items = scrape_tidal_new()
if tidal_items:
    if "recent" not in d:
        d["recent"] = []
    d["recent"] = tidal_items + d.get("recent", [])[:10]  # mistura com existentes

save_data(d)
print("✅ data.json atualizado com Tidal + mais conteúdo")
