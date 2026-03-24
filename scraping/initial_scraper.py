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
import shutil
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from urllib.request import Request, urlopen

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from llm.llm import extract_metadata  # noqa: E402

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

OUTPUT_ROOT = Path(__file__).resolve().parent / "output"


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


def safe_name(value: str, fallback: str = "record") -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]", "_", value).strip("_")
    return (cleaned[:80] or fallback)


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

    title = field_map.get("title") or f"record_{item_id}"
    description = field_map.get("descri") or field_map.get("subjec") or ""
    text_transcript = str(api_item.get("text", "")).strip()

    llm_document = (
        f"Record ID: {item_id}\n"
        f"Item URL: {item_url}\n"
        f"Title: {title}\n"
        f"Description: {description}\n"
        f"Military/Subject Data: {field_map.get('subjec', '')}\n"
        f"Transcript: {text_transcript}\n"
        f"Publisher: {field_map.get('publis', '')}\n"
    )

    return {
        "record_id": item_id,
        "item_url": item_url,
        "title": title,
        "description": description,
        "api_item": api_item,
        "_image_candidates": image_candidates,
        "_llm_document": llm_document,
    }


def save_record_folder(record: dict[str, Any], download_images: bool) -> None:
    record_id = str(record.get("record_id") or "unknown")
    title = str(record.get("title") or "record")
    folder_name = f"{record_id}_{safe_name(title, fallback='record')}"
    record_folder = OUTPUT_ROOT / folder_name
    record_folder.mkdir(parents=True, exist_ok=True)

    metadata = extract_metadata(str(record.get("_llm_document", "")), maxTokens=400)

    # Add source trace in Other while keeping schema intact.
    other = metadata.get("Other") if isinstance(metadata.get("Other"), dict) else {}
    other.setdefault("Record ID", record_id)
    other.setdefault("Source URL", str(record.get("item_url") or ""))
    metadata["Other"] = other

    if download_images:
        image_saved = False
        image_candidates = list(record.get("_image_candidates", []))
        for candidate in image_candidates:
            ext = Path(urlparse(candidate).path).suffix or ".jpg"
            image_path = record_folder / f"image{ext}"
            if download_image(candidate, image_path):
                image_saved = True
                break

        if not image_saved:
            print(f"[warn] No valid image downloaded for record {record_id}")

    metadata_path = record_folder / "metadata.json"
    metadata_path.write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8")


def run(limit: int, download_images: bool) -> None:
    print(f"[info] Discovering item links for collection '{COLLECTION_ALIAS}'")
    item_links = discover_item_links(limit=limit)
    if not item_links:
        raise RuntimeError("No item links found.")

    selected_links = item_links[:limit] if limit > 0 else item_links
    print(f"[info] Found {len(item_links)} item links, processing {len(selected_links)}")

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

    # Remove legacy aggregate outputs from earlier versions.
    legacy_json = OUTPUT_ROOT / "initial_scrape.json"
    legacy_images = OUTPUT_ROOT / "images"
    if legacy_json.exists():
        try:
            legacy_json.unlink()
        except Exception:
            pass
    if legacy_images.exists():
        try:
            shutil.rmtree(legacy_images)
        except Exception:
            pass

    for idx, link in enumerate(selected_links, start=1):
        print(f"[info] ({idx}/{len(selected_links)}) Scraping {link}")
        try:
            record = scrape_item(link)
            save_record_folder(record, download_images=download_images)
        except Exception as exc:
            print(f"[warn] Failed to process {link}: {exc}")

    print(f"[done] Wrote per-record folders to {OUTPUT_ROOT}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Initial ContentDM scraper for Boys in Blue")
    parser.add_argument("--limit", type=int, default=10, help="Max number of items to scrape (0 = all found)")
    parser.add_argument("--download-images", action="store_true", help="Download item images")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    run(limit=args.limit, download_images=args.download_images)


if __name__ == "__main__":
    main()

