import datetime as dt
import unittest

import update_data as updater


class UpdaterTests(unittest.TestCase):
    def test_release_sources_are_consolidated(self):
        items = [
            {"b": "Band", "t": "Record", "isoDate": "2026-07-20", "sources": [{"name": "A", "url": "https://a.test"}]},
            {"b": "BAND", "t": "Record!", "isoDate": "2026-07-20", "sources": [{"name": "B", "url": "https://b.test"}]},
        ]
        merged = updater.dedupe_releases(items)
        self.assertEqual(len(merged), 1)
        self.assertEqual({source["name"] for source in merged[0]["sources"]}, {"A", "B"})

    def test_rumour_gets_status_and_confidence(self):
        now = dt.datetime.now(dt.timezone.utc)
        item = {
            "title": "Band reportedly planning a surprise album",
            "src": "Example",
            "url": "https://example.test/story",
            "timestamp": now.isoformat(),
            "isoDate": now.date().isoformat(),
            "date": updater.short_date(now.date()),
            "d": "Unconfirmed report",
            "sources": [{"name": "Example", "url": "https://example.test/story"}],
        }
        merged = updater.merge_news([item])
        self.assertEqual(merged[0]["status"], "rumor")
        self.assertEqual(merged[0]["confidence"], "low")
        self.assertTrue(merged[0]["isBreaking"])

    def test_non_music_rock_match_is_rejected(self):
        self.assertFalse(updater.music_relevant({"title": "Gas leak closes Rocky Hill road", "d": "Emergency crews responded"}))
        self.assertTrue(updater.music_relevant({"title": "Rush reportedly planning new tour", "d": "The rock band may play the Sphere"}))

    def test_core_genre_has_priority(self):
        self.assertEqual(updater.genre_from(["metalcore", "alternative rock"]), "core")

    def test_english_headline_is_not_translated(self):
        self.assertEqual(updater.translation_language("Hear the new song from the metal band"), "")
        self.assertEqual(updater.translation_language("Hun"), "")


if __name__ == "__main__":
    unittest.main()
