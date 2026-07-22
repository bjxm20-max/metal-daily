import datetime
import json
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup


DATA_FILE = Path("data.json")
HEADERS = {"User-Agent": "MetalDaily/1.0 (+https://github.com/bjxm20-max/metal-daily)"}
NEWS_SOURCES = (
    ("Metal Injection", "https://metalinjection.net/"),
    ("Loudwire", "https://loudwire.com/"),
    ("Blabbermouth", "https://www.blabbermouth.net/"),
)
NEWS_WORDS = ("release", "new", "album", "tour", "announce", "single", "video")


def load_data():
    with DATA_FILE.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise ValueError("data.json must contain an object")
    return data


def save_data(data):
    temporary = DATA_FILE.with_suffix(".json.tmp")
    with temporary.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    temporary.replace(DATA_FILE)


def update_generated(data, now):
    data["generated"] = now.strftime("%Y-%m-%d")
    data["generatedAt"] = now.astimezone(datetime.timezone.utc).isoformat()
    data["range"] = f"{now.strftime('%d %b')} – {(now + datetime.timedelta(days=1)).strftime('%d %b %Y')}"


def fetch_news(previous):
    collected = []
    seen = set()
    for source, base_url in NEWS_SOURCES:
        try:
            response = requests.get(base_url, headers=HEADERS, timeout=20)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "lxml")
            for link in soup.select("a[href]"):
                title = " ".join(link.get_text(" ", strip=True).split())
                if len(title) < 30 or not any(word in title.lower() for word in NEWS_WORDS):
                    continue
                target = urljoin(base_url, link["href"])
                if urlparse(target).scheme not in {"http", "https"}:
                    continue
                key = (title.casefold(), target)
                if key in seen:
                    continue
                seen.add(key)
                collected.append({
                    "title": title[:150],
                    "src": source,
                    "date": datetime.datetime.now().strftime("%d %b"),
                    "url": target,
                })
                if len(collected) >= 50:
                    break
        except requests.RequestException as error:
            print(f"Warning: {source} unavailable: {error}")

    # A partial scrape is worse than the last known-good edition.
    return collected if len(collected) >= 5 else previous


def validate(data):
    required_lists = ("fresh", "recent", "alter", "main", "future", "news", "buzz", "pt", "mc", "rev", "dt", "st")
    for key in required_lists:
        if not isinstance(data.get(key), list):
            raise ValueError(f"data.json field {key!r} must be a list")
    for day in data["future"]:
        if not isinstance(day, dict) or not isinstance(day.get("items"), list):
            raise ValueError("Every future entry must contain an items list")


def main():
    data = load_data()
    validate(data)
    now = datetime.datetime.now().astimezone()
    data["news"] = fetch_news(data.get("news", []))
    # Keep the curated future timeline until a source parser can return full releases.
    update_generated(data, now)
    validate(data)
    save_data(data)
    print(f"Updated {DATA_FILE}: {len(data['news'])} news, {sum(len(day['items']) for day in data['future'])} future releases")


if __name__ == "__main__":
    main()
