#!/usr/bin/env python3
"""
contentdm_scraper.py

CONTENTdm-specific scraping helpers used by scraping/scraper.py.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any, Callable, Protocol
from urllib.parse import urlparse
from urllib.request import Request, urlopen

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from llm.llm import extract_metadata  # noqa: E402

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/121.0.0.0 Safari/537.36"
)


class LoggerLike(Protocol):
    def info(self, message: str) -> None: ...
    def warn(self, message: str) -> None: ...
    def error(self, message: str) -> None: ...


RobotsEnforcer = Callable[[str, str], float | None]


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


def parse_collection_url(raw_url: str) -> tuple[str, str, str]:
    """Return (canonical_search_url, site_base, collection_alias)."""
    parsed = urlparse(raw_url.strip())
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("URL must include http(s) scheme and a valid host.")

    site_base = f"{parsed.scheme}://{parsed.netloc}"
    path = parsed.path.rstrip("/")

    patterns = [
        r"^/digital/collection/([^/]+)/search(?:/.*)?$",
        r"^/digital/collection/([^/]+)$",
        r"^/digital/search/collection/([^/]+)(?:/.*)?$",
        r"^/cdm/search/collection/([^/]+)(?:/.*)?$",
        r"^/cdm/collection/([^/]+)$",
    ]

    alias: str | None = None
    for pattern in patterns:
        match = re.match(pattern, path, flags=re.IGNORECASE)
        if match:
            alias = match.group(1)
            break

    if not alias:
        raise ValueError(
            "Could not determine collection alias from URL. "
            "Expected /digital/collection/<alias>/search"
        )

    canonical_search_url = f"{site_base}/digital/collection/{alias}/search"
    return canonical_search_url, site_base, alias


def is_contentdm_url(url: str) -> bool:
    try:
        parse_collection_url(url)
        return True
    except Exception:
        return False


def build_search_api_url(site_base: str, collection_alias: str, page: int, max_records: int = 50) -> str:
    # Explicitly request collection-natural order so we scrape the first N records.
    return (
        f"{site_base}/digital/api/search/collection/{collection_alias}"
        "/searchterm//field/title/mode/all/conn/and/order/nosort/ad/asc"
        f"/page/{page}/maxRecords/{max_records}"
    )


def build_singleitem_api_url(site_base: str, collection_alias: str, item_id: str) -> str:
    return f"{site_base}/digital/api/singleitem/collection/{collection_alias}/id/{item_id}"


def verify_collection(site_base: str, collection_alias: str) -> int:
    test_payload = fetch_json(build_search_api_url(site_base, collection_alias, page=1, max_records=1))
    if "items" not in test_payload or not isinstance(test_payload.get("items"), list):
        raise RuntimeError("URL does not appear to be a valid CONTENTdm collection search endpoint.")
    total_results = test_payload.get("totalResults")
    if not isinstance(total_results, int):
        raise RuntimeError("Could not read totalResults from CONTENTdm API response.")
    return total_results


def extract_record_id(item_url: str) -> str | None:
    match = re.search(r"/id/(\d+)", item_url)
    return match.group(1) if match else None


def absolutize_contentdm_url(site_base: str, value: str | None) -> str | None:
    if not value:
        return None
    if value.startswith("http://") or value.startswith("https://"):
        return value
    if value.startswith("/api/"):
        return f"{site_base}/digital{value}"
    if value.startswith("/"):
        return f"{site_base}{value}"
    return f"{site_base}/{value.lstrip('/')}"


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


def normalize_iiif_image_uri(image_url: str) -> str:
    """
    Prefer full-resolution IIIF form where possible.
    Example: .../full/!200,200/0/default.jpg -> .../full/full/0/default.jpg
    """
    if "/iiif/2/" not in image_url:
        return image_url

    return re.sub(
        r"/full/[^/]+/0/default\.(jpg|jpeg|png|tif|tiff)$",
        r"/full/full/0/default.\1",
        image_url,
        flags=re.IGNORECASE,
    )


def build_image_candidates(site_base: str, api_item: dict[str, Any]) -> list[str]:
    candidates: list[str] = []

    # Prioritize full image URIs to avoid blurry thumbnail downloads.
    for key in ("imageUri", "thumbnailUri", "downloadUri"):
        value = api_item.get(key)
        if not isinstance(value, str):
            continue
        absolute = absolutize_contentdm_url(site_base, value.strip())
        if not absolute:
            continue
        if key == "imageUri":
            absolute = normalize_iiif_image_uri(absolute)
        if absolute not in candidates:
            candidates.append(absolute)

    return candidates


def build_image_candidate_groups(
    site_base: str, collection_alias: str, item_id: str, api_item: dict[str, Any]
) -> list[list[str]]:
    """
    Returns image candidate groups.
    - For compound objects, returns one group per page.
    - For non-compound objects, returns one main group.
    """
    main_group = build_image_candidates(site_base, api_item)
    object_info = api_item.get("objectInfo")
    page_entries = object_info.get("page") if isinstance(object_info, dict) else None

    groups: list[list[str]] = []
    if isinstance(page_entries, list) and page_entries:
        for page in page_entries:
            if not isinstance(page, dict):
                continue
            page_ptr = str(page.get("pageptr", "")).strip()
            if not page_ptr or page_ptr == item_id:
                continue

            try:
                page_item = fetch_json(build_singleitem_api_url(site_base, collection_alias, page_ptr))
            except Exception:
                continue

            page_group = build_image_candidates(site_base, page_item)
            if page_group:
                groups.append(page_group)

        if not groups and main_group:
            groups.append(main_group)
    else:
        if main_group:
            groups.append(main_group)

    unique_groups: list[list[str]] = []
    seen: set[tuple[str, ...]] = set()
    for group in groups:
        key = tuple(group)
        if key in seen:
            continue
        seen.add(key)
        unique_groups.append(group)

    return unique_groups


def safe_name(value: str, fallback: str = "record") -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]", "_", value).strip("_")
    return cleaned[:80] or fallback


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


def discover_item_links(site_base: str, collection_alias: str, limit: int) -> list[str]:
    links: list[str] = []
    seen_ids: set[str] = set()
    page = 1

    while True:
        payload = fetch_json(build_search_api_url(site_base, collection_alias, page=page))
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
            links.append(f"{site_base}/digital/collection/{collection_alias}/id/{item_id}")
            added_this_page += 1

            if len(links) >= limit:
                return links

        if added_this_page == 0:
            break
        page += 1

    return links


def scrape_item(site_base: str, collection_alias: str, item_url: str) -> dict[str, Any]:
    item_id = extract_record_id(item_url)
    if not item_id:
        raise RuntimeError(f"Could not parse record id from {item_url}")

    api_item = fetch_json(build_singleitem_api_url(site_base, collection_alias, item_id))
    field_map = fields_to_map(api_item.get("fields"))
    image_candidate_groups = build_image_candidate_groups(site_base, collection_alias, item_id, api_item)

    title = field_map.get("title") or f"record_{item_id}"
    description = field_map.get("descri") or field_map.get("subjec") or ""
    text_transcript = str(api_item.get("text", "")).strip()

    llm_document = (
        f"Record ID: {item_id}\n"
        f"Item URL: {item_url}\n"
        f"Collection Alias: {collection_alias}\n"
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
        "_image_candidate_groups": image_candidate_groups,
        "_llm_document": llm_document,
    }


def save_record_folder(
    record: dict[str, Any],
    session_dir: Path,
    logger: LoggerLike,
    robots_enforcer: RobotsEnforcer | None = None,
) -> None:
    record_id = str(record.get("record_id") or "unknown")
    title = str(record.get("title") or "record")
    folder_name = f"{record_id}_{safe_name(title, fallback='record')}"
    record_folder = session_dir / folder_name
    record_folder.mkdir(parents=True, exist_ok=True)

    logger.info(f"Normalizing metadata with LLM for record {record_id}")
    metadata = extract_metadata(
        str(record.get("_llm_document", "")),
        maxTokens=400,
        log_fn=lambda msg: logger.info(f"[llm][{record_id}] {msg}"),
    )

    metadata["Source"] = str(record.get("item_url") or "")

    other = metadata.get("Other") if isinstance(metadata.get("Other"), dict) else {}
    other.setdefault("Record ID", record_id)
    other.setdefault("Source URL", str(record.get("item_url") or ""))
    metadata["Other"] = other

    image_groups = record.get("_image_candidate_groups", [])
    if not isinstance(image_groups, list):
        image_groups = []

    images_saved = 0
    for group_index, group in enumerate(image_groups, start=1):
        if not isinstance(group, list):
            continue

        saved_this_group = False
        for candidate in group:
            if robots_enforcer is not None:
                robots_enforcer(candidate, "image URL")
            ext = Path(urlparse(candidate).path).suffix
            if not ext and "/download" in urlparse(candidate).path.lower():
                ext = ".jp2"
            if not ext:
                ext = ".jpg"
            image_path = record_folder / f"image_{group_index:02d}{ext}"
            if download_image(candidate, image_path):
                images_saved += 1
                saved_this_group = True
                logger.info(f"Saved image for record {record_id} -> {image_path.name}")
                break

        if not saved_this_group:
            logger.warn(f"Could not save image group {group_index} for record {record_id}")

    if images_saved == 0:
        logger.warn(f"No valid image downloaded for record {record_id}")
    elif images_saved == 1:
        logger.info(f"Saved 1 image for record {record_id}")
    else:
        logger.info(f"Saved {images_saved} images for record {record_id}")

    metadata_path = record_folder / "metadata.json"
    metadata_path.write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8")
    logger.info(f"Saved metadata for record {record_id} -> {metadata_path.name}")


def run_contentdm_collection(
    canonical_url: str,
    site_base: str,
    collection_alias: str,
    limit: int,
    session_dir: Path,
    logger: LoggerLike,
    robots_enforcer: RobotsEnforcer | None = None,
) -> tuple[int, int]:
    success_count = 0
    fail_count = 0

    if robots_enforcer is not None:
        robots_enforcer(canonical_url, "submitted collection URL")
        robots_enforcer(
            build_search_api_url(site_base, collection_alias, page=1, max_records=1),
            "collection search API URL",
        )

    logger.info(f"Discovering item links for collection '{collection_alias}'")
    item_links = discover_item_links(site_base, collection_alias, limit=limit)
    if not item_links:
        raise RuntimeError("No item links found.")

    logger.info(f"Found {len(item_links)} item links, processing {len(item_links)}")
    logger.info("Selection strategy: first N records in collection order (nosort, ascending)")

    for idx, link in enumerate(item_links, start=1):
        logger.info(f"({idx}/{len(item_links)}) Scraping {link}")
        try:
            if robots_enforcer is not None:
                robots_enforcer(link, "item URL")
            record = scrape_item(site_base, collection_alias, link)
            save_record_folder(record, session_dir=session_dir, logger=logger, robots_enforcer=robots_enforcer)
            success_count += 1
        except Exception as exc:
            fail_count += 1
            logger.error(f"Failed to process {link}: {exc}")

    return success_count, fail_count
