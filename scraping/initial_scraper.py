#!/usr/bin/env python3
"""
CONTENTdm scraper for Boys in Blue.

Usage:
python .\initial_scraper.py --limit 5 --download-images
"""

from __future__ import annotations

import argparse
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from urllib.request import Request, urlopen

SEARCH_URL = "https://collections.carli.illinois.edu/digital/collection/alp_bib/search"
COLLECTION_ALIAS = "alp_bib"
SITE_BASE = "https://collections.carli.illinois.edu"
API_SEARCH_URL_BASE = "https://collections.carli.illinois.edu/digital/api/search"
ITEM_PAGE_URL_BASE = "https://collections.carli.illinois.edu/digital/collection"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/121.0.0.0 Safari/537.36"
)

DEFAULT_OUTPUT = Path(__file__).resolve().parent / "output" / "initial_scrape.json"
DEFAULT_IMAGE_DIR = Path(__file__).resolve().parent / "output" / "images"


def fetch_text(url: str, timeout: int = 25) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=timeout) as response:
        body = response.read()
    return body.decode("utf-8", errors="replace")


def fetch_json(url: str, timeout: int = 25) -> dict[str, Any]:
    raw = fetch_text(url, timeout=timeout)
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise RuntimeError(f"Expected JSON object from {url}")
    return parsed


def extract_record_id(item_url: str) -> str | None:
    match = re.search(r"/id/(\d+)", item_url)
    return match.group(1) if match else None


def build_search_api_url(page: int, max_records: int = 50) -> str:
    return (
        f"{API_SEARCH_URL_BASE}/collection/{COLLECTION_ALIAS}"
        "/searchterm//field/title/mode/all/conn/and"
        f"/page/{page}/maxRecords/{max_records}"
    )


def build_singleitem_api_url(item_id: str) -> str:
    return f"{SITE_BASE}/digital/api/singleitem/collection/{COLLECTION_ALIAS}/id/{item_id}"


def absolutize_contentdm_url(value: str | None) -> str | None:
    if not value:
        return None
    if value.startswith("http://") or value.startswith("https://"):
        return value
    if value.startswith("/api/"):
        return f"{SITE_BASE}/digital{value}"
    if value.startswith("/"):
        return f"{SITE_BASE}{value}"
    return f"{SITE_BASE}/{value.lstrip('/')}"


def fields_to_map(fields: list[dict[str, Any]] | None) -> dict[str, str]:
    mapped: dict[str, str] = {}
    if not fields:
        return mapped
    for field in fields:
        if not isinstance(field, dict):
            continue
        key = str(field.get("key", "")).strip()
        value = str(field.get("value", "")).strip()
        if key and value:
            mapped[key] = value
    return mapped


def build_image_candidates(api_item: dict[str, Any]) -> list[str]:
    candidates: list[str] = []
    for key in ("thumbnailUri", "imageUri", "downloadUri"):
        value = api_item.get(key)
        if not isinstance(value, str):
            continue
        absolute = absolutize_contentdm_url(value.strip())
        if absolute and absolute not in candidates:
            candidates.append(absolute)
    return candidates


def safe_filename_from_url(url: str, fallback: str) -> str:
    name = os.path.basename(urlparse(url).path) or fallback
    cleaned = re.sub(r"[^a-zA-Z0-9._-]", "_", name)
    return cleaned[:120]


def download_image(url: str, destination: Path, timeout: int = 25) -> bool:
    try:
        request = Request(url, headers={"User-Agent": USER_AGENT})
        with urlopen(request, timeout=timeout) as response:
            content_type = str(response.headers.get("Content-Type", "")).lower()
            data = response.read()

        if not content_type.startswith("image/"):
            return False
        stripped = data.lstrip()
        if stripped.startswith(b"<!DOCTYPE") or stripped.startswith(b"<html") or stripped.startswith(b"<?xml"):
            return False
        if not data:
            return False

        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
        return True
    except Exception:
        return False


def discover_item_links(limit: int) -> list[str]:
    links: list[str] = []
    seen_ids: set[str] = set()
    page = 1

    while True:
        payload = fetch_json(build_search_api_url(page=page))
        items = payload.get("items", [])
        if not isinstance(items, list) or not items:
            break

        added_this_page = 0
        for item in items:
            if not isinstance(item, dict):
                continue
            item_id = str(item.get("itemId", "")).strip()
            if not item_id or item_id in seen_ids:
                continue

            seen_ids.add(item_id)
            links.append(f"{ITEM_PAGE_URL_BASE}/{COLLECTION_ALIAS}/id/{item_id}")
            added_this_page += 1

            if limit > 0 and len(links) >= limit:
                return links

        if added_this_page == 0:
            break
        page += 1

    return links


def scrape_item(item_url: str) -> dict[str, Any]:
    item_id = extract_record_id(item_url)
    if not item_id:
        raise RuntimeError(f"Could not parse record id from {item_url}")

    api_item = fetch_json(build_singleitem_api_url(item_id))
    field_map = fields_to_map(api_item.get("fields"))
    image_candidates = build_image_candidates(api_item)

    title = field_map.get("title")
    description = field_map.get("descri") or field_map.get("subjec")
    raw_text = str(api_item.get("text", "")).strip()
    if not raw_text:
        raw_text = "\n".join(f"{k}: {v}" for k, v in field_map.items() if v)

    return {
        "record_id": item_id,
        "item_url": item_url,
        "title": title,
        "image_url": image_candidates[0] if image_candidates else None,
        "description": description,
        "raw_text_excerpt": raw_text[:2000],
        "api_item": api_item,
        "normalized": None,
        "_image_candidates": image_candidates,
    }


def run(limit: int, out_path: Path, download_images: bool) -> None:
    print(f"[info] Discovering item links for collection '{COLLECTION_ALIAS}'")
    item_links = discover_item_links(limit=limit)
    if not item_links:
        raise RuntimeError("No item links found.")

    selected_links = item_links[:limit] if limit > 0 else item_links
    print(f"[info] Found {len(item_links)} item links, processing {len(selected_links)}")

    results: list[dict[str, Any]] = []
    if download_images:
        DEFAULT_IMAGE_DIR.mkdir(parents=True, exist_ok=True)

    for idx, link in enumerate(selected_links, start=1):
        print(f"[info] ({idx}/{len(selected_links)}) Scraping {link}")
        try:
            record = scrape_item(link)
        except Exception as exc:
            results.append({"item_url": link, "error": str(exc)})
            print(f"[warn] Failed to scrape {link}: {exc}")
            continue

        if download_images:
            candidates = list(record.pop("_image_candidates", []))
            primary_url = record.get("image_url") or ""
            ext = Path(urlparse(primary_url).path).suffix or ".jpg"
            file_stem = record.get("record_id") or f"item_{idx}"

            success = False
            saved_path: str | None = None
            chosen_image_url: str | None = None

            for candidate_url in candidates:
                candidate_ext = Path(urlparse(candidate_url).path).suffix or ext
                base_name = safe_filename_from_url(candidate_url, f"{file_stem}{candidate_ext}")
                file_name = f"{file_stem}_{base_name}"
                if not Path(file_name).suffix:
                    file_name += candidate_ext
                destination = DEFAULT_IMAGE_DIR / file_name

                if download_image(candidate_url, destination):
                    success = True
                    saved_path = str(destination)
                    chosen_image_url = candidate_url
                    break

            record["local_image_path"] = saved_path
            record["image_downloaded"] = success
            if chosen_image_url:
                record["image_url"] = chosen_image_url
        else:
            record.pop("_image_candidates", None)

        results.append(record)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_search_url": SEARCH_URL,
        "collection_alias": COLLECTION_ALIAS,
        "count": len(results),
        "results": results,
    }
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[done] Wrote {len(results)} records to {out_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Initial ContentDM scraper for Boys in Blue")
    parser.add_argument("--limit", type=int, default=10, help="Max number of items to scrape (0 = all found)")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT, help="Output JSON file path")
    parser.add_argument("--download-images", action="store_true", help="Download item images")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    run(limit=args.limit, out_path=args.out, download_images=args.download_images)


if __name__ == "__main__":
    main()
