import json, requests, datetime
from bs4 import BeautifulSoup
from datetime import datetime as dt

DATA_FILE = "data.json"

print("🚀 Iniciando update ULTRA AGRESSIVO...")

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
    print("📅 Data:", today)

def scrape_future():
    print("🔍 Future from Heavy Music HQ...")
    try:
        r = requests.get("https://heavymusichq.com/heavy-metal-album-release-calendar/", headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
        soup = BeautifulSoup(r.text, "lxml")
        items = []
        for h in soup.find_all(["h2","h3","strong"]):
            text = h.get_text(strip=True)
            if "2026" in text:
                items.append({"date": text, "lbl": "Heavy Music HQ", "items": []})
        print("Future items:", len(items))
        return items or d.get("future", [])
    except Exception as e:
        print("Erro future:", e)
        return d.get("future", [])

def scrape_news():
    print("🔍 News from multiple sources...")
    news = []
    sources = [
        "https://metalinjection.net/",
        "https://loudwire.com/",
        "https://www.blabbermouth.net/"
    ]
    for url in sources:
        try:
            r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
            soup = BeautifulSoup(r.text, "lxml")
            for a in soup.find_all("a", href=True)[:15]:
                title = a.get_text(strip=True)
                if len(title) > 30 and any(k in title.lower() for k in ["release", "new", "album", "tour", "announce"]):
                    news.append({
                        "title": title[:150],
                        "src": url.split("//")[1].split(".")[0].title(),
                        "date": dt.now().strftime("%d %b"),
                        "url": a['href'] if a['href'].startswith("http") else url + a['href']
                    })
        except:
            pass
    print("Notícias totais:", len(news))
    return news[:30] or d.get("news", [])

d = load_data()
update_generated(d)
d["future"] = scrape_future()
d["news"] = scrape_news()
save_data(d)
print("✅ data.json atualizado ULTRA!")
