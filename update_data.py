"""Build the public Metal Daily edition from resilient, source-linked feeds.

The site is static, so this script is the server-side collection layer.  It is
safe to run repeatedly: sources are consolidated, old windows are trimmed and
data.json is only rewritten when the visible content actually changes.
"""

from __future__ import annotations

import datetime as dt
import email.utils
import hashlib
import json
import re
import time
import unicodedata
from collections import Counter
from pathlib import Path
from urllib.parse import quote_plus, urljoin, urlparse

import requests
from bs4 import BeautifulSoup

try:
    from langdetect import DetectorFactory, detect

    DetectorFactory.seed = 0
except ImportError:  # Optional locally; installed by the Action.
    detect = None

try:
    from deep_translator import GoogleTranslator
except ImportError:  # Optional locally; installed by the Action.
    GoogleTranslator = None


DATA_FILE = Path("data.json")
ARCHIVE_DIR = Path("archive")
NOW = dt.datetime.now(dt.timezone.utc)
TODAY = NOW.date()
HEADERS = {
    "User-Agent": "MetalDaily/2.0 (+https://github.com/bjxm20-max/metal-daily)"
}
SESSION = requests.Session()
SESSION.headers.update(HEADERS)

HEAVY_FEEDS = (
    ("Metal Injection", "https://metalinjection.net/feed"),
    ("Blabbermouth", "https://www.blabbermouth.net/feed"),
    ("Loudwire", "https://loudwire.com/feed/"),
    ("MetalSucks", "https://www.metalsucks.net/feed/"),
    ("ThePRP", "https://www.theprp.com/feed/"),
    ("Revolver", "https://www.revolvermag.com/feed/"),
)
GENERAL_FEEDS = (
    ("NME", "https://www.nme.com/feed"),
    ("Pitchfork", "https://pitchfork.com/rss/news/"),
    ("Stereogum", "https://www.stereogum.com/feed/"),
    ("Consequence", "https://consequence.net/feed/"),
)
PORTUGAL_FEEDS = (
    ("Caminhos Metálicos", "https://www.caminhosmetalicos.com/feed/"),
    ("Arte Sonora", "https://artesonora.pt/feed/"),
)
REVIEW_FEEDS = (
    ("Angry Metal Guy", "https://www.angrymetalguy.com/feed/"),
    ("Metal Injection", "https://metalinjection.net/category/reviews/feed"),
    ("Pitchfork", "https://pitchfork.com/feed/feed-album-reviews/rss"),
)
TRUSTED = {
    "Blabbermouth", "Metal Injection", "Loudwire", "ThePRP", "Revolver",
    "NME", "Pitchfork", "Consequence", "Caminhos Metálicos", "Arte Sonora",
}
RUMOUR_WORDS = (
    "rumor", "rumour", "reportedly", "allegedly", "unconfirmed", "leak",
    "leaked", "tease", "teases", "may be", "could be", "supostamente",
    "alegadamente", "não confirmado", "rumoroso", "fuga de informação",
)
CORE_WORDS = (
    "metalcore", "post-hardcore", "post hardcore", "deathcore", "hardcore",
    "mathcore", "electronicore", "beatdown", "easycore", "hardcore punk",
)
PORTUGAL_WORDS = (
    "portugal", "portuguese", "português", "portuguesa", "lisboa", "porto",
    "braga", "coimbra", "aveiro", "faro", "moonspell", "gaerea", "ramp",
)


def load_json(path: Path, fallback):
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError):
        return fallback


def save_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    temporary.replace(path)


def clean(value) -> str:
    return " ".join(BeautifulSoup(str(value or ""), "html.parser").get_text(" ").split())


def slug(value) -> str:
    text = unicodedata.normalize("NFKD", clean(value)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", text.casefold()).strip()


def canonical_url(value) -> str:
    try:
        parsed = urlparse(str(value or ""))
        if parsed.scheme not in {"http", "https"}:
            return ""
        return parsed._replace(fragment="").geturl()
    except ValueError:
        return ""


def parse_datetime(value) -> dt.datetime | None:
    if not value:
        return None
    value = clean(value)
    try:
        parsed = email.utils.parsedate_to_datetime(value)
        return parsed.astimezone(dt.timezone.utc) if parsed.tzinfo else parsed.replace(tzinfo=dt.timezone.utc)
    except (TypeError, ValueError, OverflowError):
        pass
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.astimezone(dt.timezone.utc) if parsed.tzinfo else parsed.replace(tzinfo=dt.timezone.utc)
    except ValueError:
        return None


def short_date(value: dt.date) -> str:
    months = ("Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez")
    return f"{value.day} {months[value.month - 1]}"


def fetch(url: str, timeout=25) -> requests.Response:
    response = SESSION.get(url, timeout=timeout)
    response.raise_for_status()
    return response


def feed_items(name: str, url: str, category: str) -> list[dict]:
    try:
        response = fetch(url)
        soup = BeautifulSoup(response.content, "xml")
    except (requests.RequestException, ValueError) as error:
        print(f"Warning: {name} feed unavailable: {error}")
        return []
    output = []
    for node in soup.find_all(["item", "entry"]):
        title_node = node.find("title")
        link_node = node.find("link")
        title = clean(title_node.get_text(" ") if title_node else "")
        link = ""
        if link_node:
            link = link_node.get("href") or link_node.get_text(strip=True)
        published = node.find(["pubDate", "published", "updated", "dc:date"])
        when = parse_datetime(published.get_text(strip=True) if published else "")
        if not title or not canonical_url(link) or not when:
            continue
        summary_node = node.find(["description", "summary", "content:encoded", "content"])
        summary = clean(summary_node.get_text(" ") if summary_node else "")[:320]
        source_node = node.find("source")
        source = clean(source_node.get_text(" ")) if source_node and clean(source_node.get_text(" ")) else name
        output.append({
            "title": title[:220], "src": source[:80], "url": canonical_url(link),
            "timestamp": when.isoformat(), "isoDate": when.date().isoformat(),
            "date": short_date(when.date()), "d": summary, "category": category,
            "sources": [{"name": source[:80], "url": canonical_url(link)}],
        })
    return output


def google_feed(query: str, locale="en-US", country="US", category="metal") -> list[dict]:
    language = locale.split("-")[0]
    url = (
        "https://news.google.com/rss/search?q=" + quote_plus(query)
        + f"&hl={locale}&gl={country}&ceid={country}:{language}"
    )
    return feed_items("Google News", url, category)


def merge_news(items: list[dict], days=7, limit=180) -> list[dict]:
    cutoff = NOW - dt.timedelta(days=days)
    merged: dict[str, dict] = {}
    for item in items:
        when = parse_datetime(item.get("timestamp"))
        if not when or when < cutoff:
            continue
        key = slug(re.sub(r"\s+[-–—|]\s+[^-–—|]{2,35}$", "", item.get("title", "")))
        if not key:
            continue
        current = merged.get(key)
        if current:
            known = {(s.get("name"), s.get("url")) for s in current.get("sources", [])}
            for source in item.get("sources", []):
                marker = (source.get("name"), source.get("url"))
                if marker not in known:
                    current["sources"].append(source)
                    known.add(marker)
            if when > parse_datetime(current.get("timestamp")):
                current.update({k: item[k] for k in ("date", "isoDate", "timestamp")})
            continue
        merged[key] = dict(item)

    output = []
    for item in merged.values():
        lower = f"{item.get('title', '')} {item.get('d', '')}".casefold()
        rumour = any(word in lower for word in RUMOUR_WORDS)
        source_count = len({s.get("name") for s in item.get("sources", []) if s.get("name")})
        if source_count >= 3:
            confidence = "high"
        elif source_count >= 2 or item.get("src") in TRUSTED:
            confidence = "medium"
        else:
            confidence = "low"
        when = parse_datetime(item.get("timestamp")) or NOW
        item["status"] = "rumor" if rumour else "official"
        item["confidence"] = confidence if rumour else "confirmed"
        item["sourceCount"] = source_count
        item["isBreaking"] = (NOW - when) <= dt.timedelta(hours=8)
        item["isPT"] = item.get("category") == "pt" or any(word in lower for word in PORTUGAL_WORDS)
        item["isCore"] = item.get("category") == "core" or any(word in lower for word in CORE_WORDS)
        item["star"] = bool(item["isBreaking"] or source_count >= 2)
        output.append(item)
    output.sort(key=lambda item: item.get("timestamp", ""), reverse=True)
    return output[:limit]


def music_relevant(item: dict) -> bool:
    """Reject Google matches where rock/metal/leak are used outside music."""
    text = f" {item.get('title', '')} {item.get('d', '')} {item.get('src', '')} ".casefold()
    positive = (
        " album", " band", " music", " musician", " singer", " vocalist", " guitarist",
        " bassist", " drummer", " song", " single", " ep ", " tour", " concert",
        " festival", " metal", " hardcore", " punk", " rock band", " records",
    )
    negative = (
        " parliament", " stock", " data breach", " gas leak", " landslide", " exam",
        " acquisition", " basketball", " denver nuggets", "bankruptcy", "politic",
        " smart band", " wearable", " battery life", " screenless", " garmin", " xiaomi",
    )
    return any(word in text for word in positive) and not any(word in text for word in negative)


def genre_from(tags, text="") -> str:
    words = " ".join([str(tag) for tag in tags] + [text]).casefold()
    mapping = (
        (("metalcore", "deathcore", "post-hardcore", "mathcore", "hardcore"), "core"),
        (("death metal",), "death"), (("black metal",), "black"),
        (("thrash", "speed metal"), "thrash"), (("doom", "sludge", "stoner"), "doom"),
        (("power metal",), "power"), (("symphonic", "viking metal"), "symph"),
        (("progressive", "post-metal", "avant"), "prog"),
        (("industrial", "darkwave"), "indus"), (("punk",), "punk"),
        (("grind",), "grind"), (("folk",), "folk"),
        (("hip hop", "rap"), "hiphop"), (("r&b", "soul"), "rnb"),
        (("electronic", "dance"), "electro"), (("indie",), "indie"),
        (("pop",), "pop"), (("rock", "alternative"), "rock"),
    )
    for needles, genre in mapping:
        if any(needle in words for needle in needles):
            return genre
    return "heavy"


def mb_query(query: str, start: dt.date, end: dt.date, limit=100) -> list[dict]:
    url = "https://musicbrainz.org/ws/2/release-group/"
    try:
        response = SESSION.get(url, params={"query": query, "fmt": "json", "limit": limit}, timeout=35)
        response.raise_for_status()
        groups = response.json().get("release-groups", [])
    except (requests.RequestException, ValueError) as error:
        print(f"Warning: MusicBrainz unavailable: {error}")
        return []
    output = []
    for group in groups:
        raw_date = group.get("first-release-date", "")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw_date):
            continue
        release_date = dt.date.fromisoformat(raw_date)
        if not start <= release_date <= end:
            continue
        credits = group.get("artist-credit") or []
        artist = clean(credits[0].get("name", "")) if credits else ""
        title = clean(group.get("title", ""))
        if not artist or not title:
            continue
        tags = [tag.get("name", "") for tag in group.get("tags", [])]
        primary = group.get("primary-type") or "Release"
        secondary = group.get("secondary-types") or []
        fmt = "Live" if "Live" in secondary else ("Reissue" if "Compilation" in secondary else primary)
        mb_url = f"https://musicbrainz.org/release-group/{group.get('id')}"
        output.append({
            "b": artist, "t": title, "g": genre_from(tags, f"{artist} {title}"),
            "fmt": fmt, "lbl": "MusicBrainz", "date": short_date(release_date),
            "isoDate": raw_date, "url": mb_url, "d": ", ".join(tags[:5]),
            "sources": [{"name": "MusicBrainz", "url": mb_url}],
            "mbid": group.get("id"), "star": group.get("score", 0) >= 95,
        })
    return output


def parse_alterportal() -> list[dict]:
    months = {"января": 1, "февраля": 2, "марта": 3, "апреля": 4, "мая": 5, "июня": 6,
              "июля": 7, "августа": 8, "сентября": 9, "октября": 10, "ноября": 11, "декабря": 12}
    output = []
    for page in ("https://alterportal.net/", "https://alterportal.net/page/2/"):
        try:
            soup = BeautifulSoup(fetch(page).text, "lxml")
        except requests.RequestException as error:
            print(f"Warning: Alterportal unavailable: {error}")
            break
        for article in soup.select("article.short"):
            anchor = article.select_one(".short_title a[href]")
            if not anchor:
                continue
            raw_title = clean(anchor.get_text(" "))
            if " - " not in raw_title or "(2026)" not in raw_title:
                continue
            artist, title = raw_title.split(" - ", 1)
            title = re.sub(r"\s*[\[(](?:single|ep|album)[^\])]*[\])]", "", title, flags=re.I)
            title = re.sub(r"\s*\(2026\)\s*$", "", title).strip()
            lower = raw_title.casefold()
            fmt = "EP" if re.search(r"[\[(]ep[\])]", lower) else ("Single" if "single" in lower else "Album")
            genre_node = article.select_one(".short_text span")
            genre_text = clean(genre_node.get_text(" ")) if genre_node else ""
            date_text = clean((article.select_one(".fauth span") or {}).get_text(" ") if article.select_one(".fauth span") else "")
            if "сегодня" in date_text.casefold():
                release_date = TODAY
            elif "вчера" in date_text.casefold():
                release_date = TODAY - dt.timedelta(days=1)
            else:
                match = re.search(r"(\d{1,2})\s+([а-яё]+)\s+(\d{4})", date_text.casefold())
                release_date = dt.date(int(match.group(3)), months[match.group(2)], int(match.group(1))) if match and match.group(2) in months else TODAY
            target = canonical_url(urljoin(page, anchor.get("href")))
            output.append({
                "b": clean(artist), "t": clean(title), "g": genre_from([], genre_text),
                "fmt": fmt, "lbl": "Alterportal", "date": short_date(release_date),
                "isoDate": release_date.isoformat(), "url": target, "d": genre_text,
                "sources": [{"name": "Alterportal", "url": target}], "alterportal": True,
            })
    return dedupe_releases(output, limit=100)


def dedupe_releases(items: list[dict], limit=160) -> list[dict]:
    merged: dict[str, dict] = {}
    for item in items:
        key = f"{slug(item.get('b'))}|{slug(item.get('t'))}"
        if key == "|":
            continue
        current = merged.get(key)
        if current:
            known = {(s.get("name"), s.get("url")) for s in current.get("sources", [])}
            for source in item.get("sources", []):
                marker = (source.get("name"), source.get("url"))
                if marker not in known:
                    current.setdefault("sources", []).append(source)
                    known.add(marker)
            if item.get("d") and not current.get("d"):
                current["d"] = item["d"]
            if item.get("alterportal"):
                current["alterportal"] = True
            continue
        merged[key] = dict(item)
    output = list(merged.values())
    output.sort(key=lambda item: (item.get("isoDate", ""), item.get("b", "").casefold()), reverse=True)
    return output[:limit]


def split_future(items: list[dict]) -> list[dict]:
    days: dict[str, list] = {}
    for item in items:
        days.setdefault(item["isoDate"], []).append(item)
    return [
        {"date": short_date(dt.date.fromisoformat(day)), "lbl": "Lançamentos anunciados", "isoDate": day, "items": values}
        for day, values in sorted(days.items())
    ]


def parse_reviews() -> list[dict]:
    items = []
    for name, url in REVIEW_FEEDS:
        for article in feed_items(name, url, "review"):
            title = article["title"]
            cleaned = re.sub(r"^(?:album\s+)?review\s*[:—-]\s*", "", title, flags=re.I)
            parts = re.split(r"\s+[—–-]\s+|:\s+", cleaned, maxsplit=1)
            artist, release = (parts + [cleaned])[:2] if len(parts) > 1 else (name, cleaned)
            score_match = re.search(r"\b(\d(?:\.\d)?)/(?:10|5)\b", article.get("d", ""))
            items.append({
                "b": artist[:100], "t": release[:150], "src": article["src"],
                "date": article["date"], "isoDate": article["isoDate"],
                "timestamp": article["timestamp"], "url": article["url"],
                "d": article.get("d", "")[:260], "score": score_match.group(0) if score_match else "",
                "cat": "metal" if name != "Pitchfork" else "general",
                "releaseKey": f"{slug(artist)}|{slug(release)}",
            })
    cutoff = (TODAY - dt.timedelta(days=14)).isoformat()
    unique = {item["url"]: item for item in items if item["isoDate"] >= cutoff}
    return sorted(unique.values(), key=lambda item: item["timestamp"], reverse=True)[:100]


def translation_language(title: str) -> str:
    words = slug(title).split()
    if len(words) < 6 or not detect:
        return ""
    english_markers = {
        "a", "an", "and", "at", "band", "bassist", "died", "for", "from", "has",
        "acquires", "after", "alleged", "emerges", "form", "hear", "in", "launch",
        "music", "new", "of", "on", "out", "protocol", "release", "releases",
        "reportedly", "review", "single", "song", "stream", "the", "to", "tour", "video", "with",
    }
    portuguese_markers = {"a", "as", "com", "da", "de", "do", "em", "lança", "música", "novo", "nova", "o", "os", "para", "por", "uma"}
    if len(english_markers.intersection(words)) >= 2 or len(portuguese_markers.intersection(words)) >= 2:
        return ""
    try:
        language = detect(title)
    except Exception:
        return ""
    return "" if language in {"pt", "en"} else language


def maybe_translate(items: list[dict], previous: dict) -> dict:
    cache = dict(previous or {})
    next_cache = {}
    if not detect or not GoogleTranslator:
        return cache
    translated = 0
    for item in items:
        title = item.get("title", "")
        key = hashlib.sha1(title.encode("utf-8")).hexdigest()[:16]
        language = translation_language(title)
        if not title or not language:
            continue
        if key in cache:
            item["titleOriginal"] = cache[key].get("original", title)
            item["title"] = cache[key].get("pt", title)
            next_cache[key] = cache[key]
            continue
        try:
            next_cache[key] = {"original": title, "pt": GoogleTranslator(source="auto", target="pt").translate(title), "lang": language}
            item["titleOriginal"] = title
            item["title"] = next_cache[key]["pt"]
            translated += 1
            if translated >= 12:
                break
            time.sleep(0.15)
        except Exception as error:
            print(f"Warning: translation skipped: {error}")
            break
    return dict(list(next_cache.items())[-300:])


def build_watch(releases: list[dict]) -> list[dict]:
    established = {"metallica", "iron maiden", "slipknot", "sleep token", "dream theater", "linkin park", "ghost"}
    candidates = []
    for item in releases:
        if slug(item.get("b")) in established:
            continue
        source_names = [source.get("name") for source in item.get("sources", [])]
        if "Alterportal" not in source_names and not item.get("country") == "PT":
            continue
        reason = "Novo lançamento detetado numa fonte independente"
        if item.get("country") == "PT":
            reason = "Projeto português com atividade recente"
        candidates.append({
            "b": item.get("b"), "g": item.get("g"), "reason": reason,
            "release": item.get("t"), "url": item.get("url"),
            "sources": source_names, "score": min(95, 55 + 10 * len(source_names)),
        })
    seen = set()
    output = []
    for item in candidates:
        key = slug(item["b"])
        if key and key not in seen:
            seen.add(key)
            output.append(item)
    return output[:16]


def update_archive(data: dict):
    current = []
    for key in ("recent", "main", "alter"):
        current.extend({**item, "kind": "release", "section": key} for item in data.get(key, []))
    for key in ("news", "buzz", "pt", "core", "rev"):
        current.extend({**item, "kind": "review" if key == "rev" else "news", "section": key} for item in data.get(key, []))
    cutoff = TODAY - dt.timedelta(days=183)
    months = sorted({item.get("isoDate", "")[:7] for item in current if re.fullmatch(r"\d{4}-\d{2}-\d{2}", item.get("isoDate", ""))})
    for month in months:
        path = ARCHIVE_DIR / f"{month}.json"
        previous = load_json(path, [])
        combined = previous + [item for item in current if item.get("isoDate", "").startswith(month)]
        unique = {}
        for item in combined:
            if dt.date.fromisoformat(item["isoDate"]) < cutoff:
                continue
            key = item.get("url") or f"{item.get('kind')}|{slug(item.get('b') or item.get('title'))}|{slug(item.get('t'))}"
            unique[key] = item
        save_json(path, sorted(unique.values(), key=lambda item: item.get("isoDate", ""), reverse=True))
    valid_files = []
    if ARCHIVE_DIR.exists():
        for path in ARCHIVE_DIR.glob("????-??.json"):
            try:
                month_date = dt.date.fromisoformat(path.stem + "-01")
            except ValueError:
                continue
            if month_date >= cutoff.replace(day=1):
                valid_files.append(path.stem)
    save_json(ARCHIVE_DIR / "index.json", {"months": sorted(valid_files, reverse=True), "updatedAt": NOW.isoformat()})


def validate(data: dict):
    required = ("fresh", "recent", "alter", "main", "future", "news", "buzz", "pt", "core", "mc", "rev", "dt", "st", "watch")
    for key in required:
        if not isinstance(data.get(key), list):
            raise ValueError(f"data.json field {key!r} must be a list")
    if not all(isinstance(day, dict) and isinstance(day.get("items"), list) for day in data["future"]):
        raise ValueError("Every future entry must contain an items list")


def content_signature(data: dict) -> str:
    ignored = {"generated", "generatedAt", "lastCheckedAt", "range"}
    stable = {key: value for key, value in data.items() if key not in ignored}
    return hashlib.sha256(json.dumps(stable, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()


def main():
    previous = load_json(DATA_FILE, {})
    if not isinstance(previous, dict):
        raise ValueError("data.json must contain an object")

    recent_start = TODAY - dt.timedelta(days=14)
    friday = TODAY - dt.timedelta(days=(TODAY.weekday() - 4) % 7)
    future_end = TODAY + dt.timedelta(days=30)
    heavy_query = (
        f"firstreleasedate:[{recent_start} TO {TODAY}] AND "
        "(tag:metal OR tag:rock OR tag:metalcore OR tag:hardcore OR tag:post-hardcore OR tag:deathcore OR tag:punk)"
    )
    future_query = (
        f"firstreleasedate:[{TODAY} TO {future_end}] AND "
        "(tag:metal OR tag:rock OR tag:metalcore OR tag:hardcore OR tag:post-hardcore OR tag:deathcore OR tag:punk)"
    )
    pop_query = (
        f"firstreleasedate:[{friday} TO {friday}] AND "
        "(tag:pop OR tag:hip-hop OR tag:electronic OR tag:r&b OR tag:indie)"
    )
    portugal_query = f"firstreleasedate:[{recent_start} TO {TODAY}] AND artistcountry:PT"

    recent_mb = mb_query(heavy_query, recent_start, TODAY)
    time.sleep(1.05)
    pt_mb = mb_query(portugal_query, recent_start, TODAY)
    for item in pt_mb:
        item["country"] = "PT"
    time.sleep(1.05)
    mainstream = mb_query(pop_query, friday, friday)
    time.sleep(1.05)
    future = mb_query(future_query, TODAY, future_end)
    alter = parse_alterportal()
    recent = dedupe_releases(recent_mb + pt_mb + alter)

    raw_heavy = []
    for name, url in HEAVY_FEEDS:
        raw_heavy.extend(feed_items(name, url, "metal"))
    raw_general = []
    for name, url in GENERAL_FEEDS:
        raw_general.extend(feed_items(name, url, "general"))
    raw_pt = []
    for name, url in PORTUGAL_FEEDS:
        raw_pt.extend(feed_items(name, url, "pt"))
    raw_heavy.extend(filter(music_relevant, google_feed('metal music OR rock band when:7d', category="metal")))
    raw_general.extend(google_feed('music release OR tour OR interview when:7d', category="general"))
    raw_pt.extend(google_feed('música Portugal OR metal português when:7d', "pt-PT", "PT", "pt"))
    raw_core = google_feed('metalcore OR post-hardcore OR deathcore OR hardcore punk when:7d', category="core")
    raw_dt = google_feed('"Dream Theater" when:7d', category="band")
    raw_st = google_feed('"Sleep Token" when:7d', category="band")
    raw_metal_rumours = list(filter(music_relevant, google_feed('(metal band OR rock band OR metalcore OR hardcore) (rumor OR rumour OR leak OR reportedly) when:7d', category="metal")))
    raw_general_rumours = google_feed('music (rumor OR rumour OR leak OR reportedly) when:7d', category="general")

    combined_heavy = merge_news(raw_heavy + raw_pt + raw_core + raw_metal_rumours, limit=220)
    combined_general = merge_news(raw_general + raw_general_rumours, limit=160)
    translations = maybe_translate(combined_heavy + combined_general, previous.get("translations", {}))
    news = [item for item in combined_heavy if not item.get("isPT")][:180]
    buzz = combined_general[:130]
    pt_news = merge_news(raw_pt + [item for item in combined_heavy if item.get("isPT")], limit=120)
    core = merge_news(raw_core + [item for item in combined_heavy if item.get("isCore")], limit=130)
    dream_theater = merge_news(raw_dt + [item for item in combined_heavy if "dream theater" in item.get("title", "").casefold()], limit=80)
    sleep_token = merge_news(raw_st + [item for item in combined_heavy if "sleep token" in item.get("title", "").casefold()], limit=80)
    reviews = parse_reviews()

    data = dict(previous)
    data.update({
        "schemaVersion": 3,
        "fresh": previous.get("fresh", []),
        "recent": recent if len(recent) >= 5 else previous.get("recent", []),
        "alter": alter if len(alter) >= 5 else previous.get("alter", []),
        "main": mainstream if mainstream else previous.get("main", []),
        "future": split_future(future) if future else previous.get("future", []),
        "news": news if len(news) >= 10 else previous.get("news", []),
        "buzz": buzz if len(buzz) >= 10 else previous.get("buzz", []),
        "pt": pt_news if pt_news else previous.get("pt", []),
        "core": core if core else previous.get("core", previous.get("mc", [])),
        "mc": core if core else previous.get("mc", []),
        "rev": reviews if reviews else previous.get("rev", []),
        "dt": dream_theater if dream_theater else previous.get("dt", []),
        "st": sleep_token if sleep_token else previous.get("st", []),
        "watch": build_watch(recent),
        "translations": translations,
        "stats": {
            "genres": dict(Counter(item.get("g", "other") for item in recent)),
            "sources": dict(Counter(item.get("src", "") for item in news + buzz if item.get("src"))),
            "official": sum(item.get("status") == "official" for item in news + buzz),
            "rumours": sum(item.get("status") == "rumor" for item in news + buzz),
        },
        "sourceHealth": {
            "releaseSources": 2, "newsFeeds": len(HEAVY_FEEDS + GENERAL_FEEDS + PORTUGAL_FEEDS),
            "searchFeeds": 7, "reviewFeeds": len(REVIEW_FEEDS),
        },
    })
    validate(data)
    before = content_signature(previous) if previous else ""
    after = content_signature(data)
    if before == after:
        print("No new or changed content; data.json left untouched")
        return
    data["generated"] = TODAY.isoformat()
    data["generatedAt"] = NOW.isoformat()
    data["lastCheckedAt"] = NOW.isoformat()
    data["range"] = f"{short_date(recent_start)} – {short_date(TODAY)} {TODAY.year}"
    save_json(DATA_FILE, data)
    update_archive(data)
    print(
        f"Updated {DATA_FILE}: {len(data['recent'])} releases, {len(data['news'])} metal news, "
        f"{len(data['buzz'])} general news, {len(data['core'])} core items"
    )


if __name__ == "__main__":
    main()
