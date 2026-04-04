#!/usr/bin/env python3
"""
scraping_js.py

JS-heavy page helpers for the universal scraper.
- Detect likely JS-rendered pages
- Fetch rendered HTML using crawl4ai (if installed)
"""

from __future__ import annotations

import asyncio
import re
from typing import Protocol


class LoggerLike(Protocol):
    def info(self, message: str) -> None: ...
    def warn(self, message: str) -> None: ...
    def error(self, message: str) -> None: ...


JS_FRAMEWORK_MARKERS = (
    "__next",
    "id=\"root\"",
    "id='root'",
    "id=\"app\"",
    "id='app'",
    "window.__nuxt__",
    "data-reactroot",
    "webpack",
    "hydration",
    "astro-island",
)


def is_js_heavy_html(html: str) -> bool:
    lowered = html.lower()

    if "please enable javascript" in lowered:
        return True

    # Strong marker-based detection.
    if any(marker in lowered for marker in JS_FRAMEWORK_MARKERS):
        return True

    # Heuristic: script-heavy page with little meaningful text.
    script_count = len(re.findall(r"<script\b", lowered))
    style_count = len(re.findall(r"<style\b", lowered))
    text_only = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.IGNORECASE)
    text_only = re.sub(r"<style[\s\S]*?</style>", " ", text_only, flags=re.IGNORECASE)
    text_only = re.sub(r"<[^>]+>", " ", text_only)
    text_only = re.sub(r"\s+", " ", text_only).strip()

    low_text = len(text_only) < 900
    many_assets = (script_count + style_count) >= 18

    return low_text and many_assets


def _run_async(coro):
    try:
        return asyncio.run(coro)
    except RuntimeError:
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()


def _extract_html_from_crawl4ai_result(result: object) -> str | None:
    for attr in ("cleaned_html", "html", "raw_html", "fit_html"):
        value = getattr(result, attr, None)
        if isinstance(value, str) and value.strip():
            return value

    if isinstance(result, dict):
        for key in ("cleaned_html", "html", "raw_html", "fit_html"):
            value = result.get(key)
            if isinstance(value, str) and value.strip():
                return value

    return None


def render_with_crawl4ai(url: str, logger: LoggerLike) -> str | None:
    try:
        from crawl4ai import AsyncWebCrawler  # type: ignore
    except Exception as exc:
        logger.warn(f"crawl4ai is not available: {exc}")
        return None

    async def _crawl() -> object:
        async with AsyncWebCrawler() as crawler:
            try:
                return await crawler.arun(url=url, bypass_cache=True)
            except TypeError:
                # Compatibility fallback for versions with different arun signature.
                return await crawler.arun(url=url)

    try:
        result = _run_async(_crawl())
    except Exception as exc:
        logger.warn(f"crawl4ai render failed: {exc}")
        return None

    success = getattr(result, "success", None)
    if success is False:
        error_message = getattr(result, "error_message", "unknown crawl4ai error")
        logger.warn(f"crawl4ai returned unsuccessful result: {error_message}")
        return None

    rendered_html = _extract_html_from_crawl4ai_result(result)
    if not rendered_html:
        logger.warn("crawl4ai returned no usable HTML")
        return None

    logger.info("Rendered page HTML using crawl4ai")
    return rendered_html


def get_best_html_for_non_contentdm(
    url: str, raw_html: str, logger: LoggerLike, force_js: bool = False
) -> tuple[str, bool]:
    """
    Returns (html, used_js_renderer).
    Uses crawl4ai rendering when page appears JS-heavy.
    """
    if not force_js and not is_js_heavy_html(raw_html):
        return raw_html, False

    if force_js:
        logger.info("Forcing JS rendering pipeline for page")
    else:
        logger.info("Detected JS-heavy page structure; trying JS rendering pipeline")
    rendered_html = render_with_crawl4ai(url, logger)
    if rendered_html:
        return rendered_html, True

    logger.warn("JS rendering unavailable or failed; falling back to raw HTML")
    return raw_html, False
