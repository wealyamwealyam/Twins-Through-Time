#!/usr/bin/env python3
"""
scraper.py

Universal Civil War image scraper entrypoint.
- If URL is CONTENTdm, uses contentdm_scraper.py flow.
- Otherwise, uses generic HTML image extraction + LLM metadata extraction.

Run:
python .\scraper.py
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urljoin, urlparse

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from llm.llm import extract_metadata  # noqa: E402
from robots_checker import check_url_for_scraping  # noqa: E402
from contentdm_scraper import (  # noqa: E402
    fetch_text,
    is_contentdm_url,
    parse_collection_url,
    run_contentdm_collection,
    safe_name,
    download_image,
    verify_collection,
)
from scraping_js import get_best_html_for_non_contentdm  # noqa: E402

OUTPUT_ROOT = Path(__file__).resolve().parent / "output"

# Hard-reject obvious non-content images.
REJECT_IMAGE_TOKENS = {
    "logo",
    "favicon",
    "icon",
    "sprite",
    "pixel",
    "spacer",
    "placeholder",
    "blank",
    "loader",
    "tracking",
    "analytics",
    "avatar-default",
    "social",
    "share",
}

# Tokens that hint the image is about people / Civil War content.
PERSON_HINT_TOKENS = {
    "soldier",
    "officer",
    "major",
    "captain",
    "general",
    "lieutenant",
    "sergeant",
    "private",
    "portrait",
    "uniform",
    "regiment",
    "infantry",
    "cavalry",
    "army",
    "civil war",
    "union",
    "confederate",
}

CONTENT_HINT_TOKENS = {
    "battle",
    "camp",
    "cemetery",
    "memorial",
    "history",
    "archive",
    "photograph",
    "photo",
    "artillery",
    "brigade",
}


class SessionLogger:
    def __init__(self, log_path: Path) -> None:
        self.log_path = log_path
        log_path.parent.mkdir(parents=True, exist_ok=True)
        self._file = log_path.open("a", encoding="utf-8")

    def _write(self, level: str, message: str) -> None:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        line = f"[{timestamp}] [{level}] {message}"
        print(line)
        self._file.write(line + "\n")
        self._file.flush()

    def info(self, message: str) -> None:
        self._write("INFO", message)

    def warn(self, message: str) -> None:
        self._write("WARN", message)

    def error(self, message: str) -> None:
        self._write("ERROR", message)

    def close(self) -> None:
        self._file.close()


def create_session_folder() -> Path:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    base_name = datetime.now().strftime("session_%m_%d_%H-%M")
    session_dir = OUTPUT_ROOT / base_name
    counter = 1
    while session_dir.exists():
        session_dir = OUTPUT_ROOT / f"{base_name}_{counter:02d}"
        counter += 1
    session_dir.mkdir(parents=True, exist_ok=True)
    return session_dir


def enforce_robots(url: str, context: str, logger: SessionLogger | None = None) -> float | None:
    result = check_url_for_scraping(url)
    msg = f"robots.txt check for {context}: {url}"

    if result.allowed:
        if logger:
            logger.info(msg + " -> ALLOWED")
        else:
            print(msg + " -> ALLOWED")
        if result.crawl_delay is not None:
            delay_msg = f"robots crawl-delay for host is {result.crawl_delay}s"
            if logger:
                logger.info(delay_msg)
            else:
                print(delay_msg)
        return result.crawl_delay

    blocked = ", ".join(result.blocked_agents)
    err = (
        f"robots.txt BLOCKED scraping for {context}: {url}. "
        f"Blocked LLM agents: {blocked}"
    )
    if logger:
        logger.error(err)
    raise PermissionError(err)


def clean_html_text(fragment: str) -> str:
    no_script = re.sub(r"<script[\s\S]*?</script>", " ", fragment, flags=re.IGNORECASE)
    no_style = re.sub(r"<style[\s\S]*?</style>", " ", no_script, flags=re.IGNORECASE)
    no_tags = re.sub(r"<[^>]+>", " ", no_style)
    text = re.sub(r"\s+", " ", no_tags).strip()
    return text


def extract_page_title(html: str) -> str:
    match = re.search(r"<title[^>]*>(.*?)</title>", html, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        return ""
    return clean_html_text(match.group(1))


def parse_attr(tag: str, attr_name: str) -> str | None:
    pattern = rf"\b{re.escape(attr_name)}\s*=\s*(?:\"([^\"]*)\"|'([^']*)'|([^\s>]+))"
    match = re.search(pattern, tag, flags=re.IGNORECASE)
    if not match:
        return None
    return (match.group(1) or match.group(2) or match.group(3) or "").strip()


def contains_any(text: str, tokens: set[str]) -> bool:
    lowered = text.lower()
    return any(token in lowered for token in tokens)


def parse_dimension(value: str | None) -> int | None:
    if not value:
        return None
    match = re.search(r"\d+", value)
    if not match:
        return None
    try:
        return int(match.group(0))
    except ValueError:
        return None


def query_dimensions(image_url: str) -> tuple[int | None, int | None]:
    parsed = urlparse(image_url)
    q = parse_qs(parsed.query)
    width = None
    height = None
    for key in ("w", "width"):
        if key in q and q[key]:
            width = parse_dimension(q[key][0])
            if width is not None:
                break
    for key in ("h", "height"):
        if key in q and q[key]:
            height = parse_dimension(q[key][0])
            if height is not None:
                break
    return width, height


def parse_srcset_best(srcset: str | None) -> str | None:
    if not srcset:
        return None

    best_url: str | None = None
    best_weight = -1.0
    for entry in srcset.split(","):
        part = entry.strip()
        if not part:
            continue
        bits = part.split()
        candidate_url = bits[0].strip()
        descriptor = bits[1].strip().lower() if len(bits) > 1 else ""

        weight = 1.0
        if descriptor.endswith("w"):
            width = parse_dimension(descriptor)
            if width is not None:
                weight = float(width)
        elif descriptor.endswith("x"):
            try:
                weight = float(descriptor[:-1])
            except ValueError:
                weight = 1.0

        if weight > best_weight:
            best_weight = weight
            best_url = candidate_url

    return best_url


def extract_img_source(tag: str) -> str | None:
    # Prefer explicit lazy-load/source-set fields over placeholder src values.
    for attr in ("data-src", "data-lazy-src", "data-original"):
        value = parse_attr(tag, attr)
        if value:
            return value

    srcset_best = parse_srcset_best(parse_attr(tag, "srcset"))
    if srcset_best:
        return srcset_best

    return parse_attr(tag, "src")


def find_content_spans(html: str) -> list[tuple[int, int]]:
    patterns = [
        r"<article\b[\s\S]*?</article>",
        r"<main\b[\s\S]*?</main>",
        r"<(?:section|div)\b[^>]*(?:id|class)\s*=\s*['\"][^'\"]*(?:post|entry|article|content|blog-body|story-body)[^'\"]*['\"][^>]*>[\s\S]*?</(?:section|div)>",
    ]
    spans: list[tuple[int, int]] = []

    for pattern in patterns:
        for match in re.finditer(pattern, html, flags=re.IGNORECASE):
            spans.append((match.start(), match.end()))

    if not spans:
        return []

    spans.sort(key=lambda item: item[0])
    merged: list[tuple[int, int]] = [spans[0]]
    for start, end in spans[1:]:
        prev_start, prev_end = merged[-1]
        if start <= prev_end:
            merged[-1] = (prev_start, max(prev_end, end))
        else:
            merged.append((start, end))
    return merged


def in_spans(position: int, spans: list[tuple[int, int]]) -> bool:
    for start, end in spans:
        if start <= position < end:
            return True
    return False


def score_generic_image_candidate(
    image_url: str,
    alt_text: str,
    context_text: str,
    tag: str,
    is_content_image: bool,
) -> tuple[int, bool, str]:
    class_name = parse_attr(tag, "class") or ""
    elem_id = parse_attr(tag, "id") or ""

    combined = " ".join([image_url, alt_text, class_name, elem_id]).lower()
    context_lower = context_text.lower()

    ext = Path(urlparse(image_url).path).suffix.lower()

    width = parse_dimension(parse_attr(tag, "width"))
    height = parse_dimension(parse_attr(tag, "height"))
    q_width, q_height = query_dimensions(image_url)
    if width is None:
        width = q_width
    if height is None:
        height = q_height

    if contains_any(combined, REJECT_IMAGE_TOKENS):
        return -999, True, "rejected token match"

    if ext in {".svg", ".ico"}:
        return -999, True, "icon/vector extension"

    if width is not None and height is not None and width <= 64 and height <= 64:
        return -999, True, "tiny dimensions"

    score = 0
    if is_content_image:
        score += 5
    else:
        score -= 1

    if contains_any(combined + " " + context_lower, PERSON_HINT_TOKENS):
        score += 4

    if contains_any(combined + " " + context_lower, CONTENT_HINT_TOKENS):
        score += 2

    if alt_text.strip():
        score += 1

    if len(context_text) >= 80:
        score += 1

    if width is not None and height is not None:
        smallest = min(width, height)
        if smallest <= 120:
            score -= 3
        elif smallest >= 280:
            score += 1

    if ext == ".gif":
        score -= 1

    return score, False, ""


def extract_non_contentdm_images(page_url: str, html: str) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    seen: set[str] = set()
    content_spans = find_content_spans(html)

    for idx, match in enumerate(re.finditer(r"<img\b[^>]*>", html, flags=re.IGNORECASE), start=1):
        tag = match.group(0)
        src = extract_img_source(tag)
        if not src:
            continue
        if src.startswith("data:"):
            continue

        image_url = urljoin(page_url, src).split("#", 1)[0]
        if image_url in seen:
            continue
        seen.add(image_url)

        alt_text = parse_attr(tag, "alt") or ""
        left = max(0, match.start() - 1200)
        right = min(len(html), match.end() + 1200)
        context_html = html[left:right]
        context_text = clean_html_text(context_html)

        is_content_image = in_spans(match.start(), content_spans)

        score, rejected, reject_reason = score_generic_image_candidate(
            image_url=image_url,
            alt_text=alt_text,
            context_text=context_text,
            tag=tag,
            is_content_image=is_content_image,
        )
        if rejected:
            continue

        entries.append(
            {
                "index": idx,
                "image_url": image_url,
                "alt_text": alt_text,
                "context_text": context_text,
                "score": score,
                "in_content": is_content_image,
                "reject_reason": reject_reason,
            }
        )

    entries.sort(key=lambda e: (int(e.get("score", 0)), bool(e.get("in_content", False))), reverse=True)
    return entries


def save_generic_record(
    record_index: int,
    image_url: str,
    alt_text: str,
    context_text: str,
    page_url: str,
    page_title: str,
    session_dir: Path,
    logger: SessionLogger,
) -> bool:
    base_name = alt_text.strip() or Path(urlparse(image_url).path).stem or f"image_{record_index}"
    record_folder = session_dir / f"{record_index:03d}_{safe_name(base_name, fallback='image')}"
    record_folder.mkdir(parents=True, exist_ok=True)

    enforce_robots(image_url, "image URL", logger=logger)

    ext = Path(urlparse(image_url).path).suffix or ".jpg"
    image_path = record_folder / f"image{ext}"
    image_ok = download_image(image_url, image_path)
    if image_ok:
        logger.info(f"Saved image -> {image_path.name}")
    else:
        logger.warn(f"Could not download image from {image_url}")

    llm_document = (
        f"Source Page URL: {page_url}\n"
        f"Page Title: {page_title}\n"
        f"Image URL: {image_url}\n"
        f"Image Alt Text: {alt_text}\n"
        f"Context Around Image: {context_text}\n"
    )

    logger.info("Normalizing metadata with LLM")
    metadata = extract_metadata(
        llm_document,
        maxTokens=400,
        log_fn=lambda msg: logger.info(f"[llm][generic-{record_index:03d}] {msg}"),
    )

    metadata["Source"] = page_url

    other = metadata.get("Other") if isinstance(metadata.get("Other"), dict) else {}
    other.setdefault("Source URL", page_url)
    other.setdefault("Image URL", image_url)
    if alt_text:
        other.setdefault("Image Alt Text", alt_text)
    metadata["Other"] = other

    metadata_path = record_folder / "metadata.json"
    metadata_path.write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8")
    logger.info(f"Saved metadata -> {metadata_path.name}")

    return image_ok


def run_generic_site(url: str, limit: int, session_dir: Path, logger: SessionLogger) -> tuple[int, int]:
    enforce_robots(url, "submitted URL", logger=logger)

    logger.info(f"Fetching HTML: {url}")
    raw_html = fetch_text(url)
    html, used_js_renderer = get_best_html_for_non_contentdm(url, raw_html, logger)
    page_title = extract_page_title(html)

    images = extract_non_contentdm_images(url, html)
    if not images and not used_js_renderer:
        logger.info("No usable images from raw HTML. Trying forced JS rendering fallback.")
        rendered_html, rendered_used = get_best_html_for_non_contentdm(
            url,
            raw_html,
            logger,
            force_js=True,
        )
        if rendered_used:
            html = rendered_html
            page_title = extract_page_title(html) or page_title
            images = extract_non_contentdm_images(url, html)

    if not images:
        raise RuntimeError("No usable content images found on the submitted page.")

    high_conf = [entry for entry in images if int(entry.get("score", 0)) >= 4]
    if not high_conf:
        raise RuntimeError(
            "No high-confidence content/person images found on the submitted page. "
            "Try a page with article-level image content."
        )

    selected = high_conf[:limit]
    if len(selected) < limit:
        logger.warn(
            f"Only {len(selected)} high-confidence content/person images were found "
            f"(requested {limit})."
        )

    logger.info(
        "Generic candidate summary: "
        f"usable={len(images)}, high-confidence={len(high_conf)}, selected={len(selected)}"
    )

    for pos, entry in enumerate(selected[:5], start=1):
        logger.info(
            f"Candidate {pos}: score={entry.get('score')} in_content={entry.get('in_content')} "
            f"url={entry.get('image_url')}"
        )

    success_count = 0
    fail_count = 0

    for i, entry in enumerate(selected, start=1):
        image_url = str(entry["image_url"])
        alt_text = str(entry.get("alt_text", ""))
        context_text = str(entry.get("context_text", ""))

        logger.info(f"({i}/{len(selected)}) Processing image URL: {image_url}")
        try:
            saved = save_generic_record(
                record_index=i,
                image_url=image_url,
                alt_text=alt_text,
                context_text=context_text,
                page_url=url,
                page_title=page_title,
                session_dir=session_dir,
                logger=logger,
            )
            if saved:
                success_count += 1
            else:
                fail_count += 1
        except Exception as exc:
            fail_count += 1
            logger.error(f"Failed image {image_url}: {exc}")

    return success_count, fail_count


def prompt_url_and_limit() -> tuple[str, int, bool, tuple[str, str, str] | None]:
    while True:
        raw_url = input("Enter URL to scrape: ").strip()
        if not raw_url:
            print("Please enter a URL.")
            continue

        is_contentdm = is_contentdm_url(raw_url)
        contentdm_config: tuple[str, str, str] | None = None

        if is_contentdm:
            try:
                canonical_url, site_base, collection_alias = parse_collection_url(raw_url)
                enforce_robots(canonical_url, "submitted CONTENTdm URL")
                total = verify_collection(site_base, collection_alias)
                print(f"Detected CONTENTdm collection '{collection_alias}' with {total} items.")
                contentdm_config = (canonical_url, site_base, collection_alias)
            except Exception as exc:
                print(f"CONTENTdm URL check failed: {exc}")
                continue
        else:
            try:
                enforce_robots(raw_url, "submitted non-CONTENTdm URL")
                print("Detected non-CONTENTdm URL. Generic HTML image scraping will be used.")
            except Exception as exc:
                print(f"robots.txt check failed: {exc}")
                continue

        while True:
            limit_input = input("How many images/records do you want to scrape? ").strip()
            try:
                limit = int(limit_input)
                if limit <= 0:
                    raise ValueError
            except ValueError:
                print("Please enter a positive whole number.")
                continue
            return raw_url, limit, is_contentdm, contentdm_config


def main() -> None:
    submitted_url, limit, is_contentdm, contentdm_config = prompt_url_and_limit()

    session_dir = create_session_folder()
    logger = SessionLogger(session_dir / "session.log")

    logger.info(f"Session started: {session_dir.name}")
    logger.info(f"Output folder: {session_dir}")
    logger.info(f"Submitted URL: {submitted_url}")
    logger.info(f"Requested limit: {limit}")

    success_count = 0
    fail_count = 0

    try:
        if is_contentdm and contentdm_config is not None:
            canonical_url, site_base, collection_alias = contentdm_config
            logger.info("Mode: CONTENTdm")
            success_count, fail_count = run_contentdm_collection(
                canonical_url=canonical_url,
                site_base=site_base,
                collection_alias=collection_alias,
                limit=limit,
                session_dir=session_dir,
                logger=logger,
                robots_enforcer=lambda url, ctx: enforce_robots(url, ctx, logger=logger),
            )
        else:
            logger.info("Mode: Generic HTML image scraping")
            success_count, fail_count = run_generic_site(
                url=submitted_url,
                limit=limit,
                session_dir=session_dir,
                logger=logger,
            )

        logger.info(f"Run complete. Success: {success_count}, Failed: {fail_count}")
        logger.info(f"Session artifacts written to: {session_dir}")
    finally:
        logger.close()


if __name__ == "__main__":
    main()
