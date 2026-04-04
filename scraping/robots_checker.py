#!/usr/bin/env python3
"""
robots_checker.py
----------------
Fetch and parse a site's robots.txt, then check whether LLM/AI agents are
permitted to access a given URL.

Usage (standalone):
    python robots_checker.py https://collections.carli.illinois.edu/digital/collection/alp_bib/search
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

# User-agent tokens that represent LLM / AI crawlers.
LLM_AGENT_TOKENS: list[str] = [
    "GPTBot",
    "ChatGPT-User",
    "Claude-Web",
    "ClaudeBot",
    "anthropic-ai",
    "Google-Extended",
    "CCBot",
    "PerplexityBot",
    "Amazonbot",
    "cohere-ai",
    "Bytespider",
]

SCRAPER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/121.0.0.0 Safari/537.36"
)

_ROBOTS_FETCH_TIMEOUT = 10


@dataclass
class RobotsCheckResult:
    url: str
    robots_url: str
    allowed: bool
    blocked_agents: list[str]
    crawl_delay: float | None


def robots_url_for(site_url: str) -> str:
    parsed = urlparse(site_url)
    scheme = parsed.scheme or "https"
    return f"{scheme}://{parsed.netloc}/robots.txt"


def _fetch_robots_txt(robots_url: str) -> str:
    """
    Download robots.txt content.
    Returns empty string if missing/unreachable, which is treated as no rules.
    """
    try:
        req = Request(robots_url, headers={"User-Agent": SCRAPER_AGENT})
        with urlopen(req, timeout=_ROBOTS_FETCH_TIMEOUT) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except HTTPError as exc:
        if exc.code == 404:
            return ""
        return ""
    except URLError:
        return ""


class RobotsChecker:
    """
    Minimal robots.txt parser supporting:
      User-agent, Allow, Disallow, Crawl-delay
    """

    def __init__(self, robots_txt: str) -> None:
        self._rules: dict[str, dict[str, list[str]]] = {}
        self._crawl_delays: dict[str, float | None] = {}
        self._parse(robots_txt)

    def _parse(self, text: str) -> None:
        current_agents: list[str] = []

        for raw_line in text.splitlines():
            line = raw_line.split("#", 1)[0].strip()
            if not line:
                if current_agents:
                    current_agents = []
                continue

            if ":" not in line:
                continue

            field, _, value = line.partition(":")
            field = field.strip().lower()
            value = value.strip()

            if field == "user-agent":
                agent = value.lower()
                current_agents.append(agent)
                if agent not in self._rules:
                    self._rules[agent] = {"allow": [], "disallow": []}

            elif field == "disallow":
                for agent in current_agents:
                    self._rules.setdefault(agent, {"allow": [], "disallow": []})
                    if value:
                        self._rules[agent]["disallow"].append(value)

            elif field == "allow":
                for agent in current_agents:
                    self._rules.setdefault(agent, {"allow": [], "disallow": []})
                    if value:
                        self._rules[agent]["allow"].append(value)

            elif field == "crawl-delay":
                try:
                    delay = float(value)
                except ValueError:
                    delay = None
                for agent in current_agents:
                    self._crawl_delays[agent] = delay

    @staticmethod
    def _path_matches(pattern: str, path: str) -> bool:
        escaped = re.escape(pattern)
        escaped = escaped.replace(r"\*", ".*").replace(r"\$", "$")
        return bool(re.match(escaped, path))

    def _check_agent(self, agent: str, path: str) -> bool | None:
        rules = self._rules.get(agent.lower())
        if rules is None:
            return None

        best_allow_len = -1
        best_disallow_len = -1

        for pattern in rules["allow"]:
            if self._path_matches(pattern, path):
                best_allow_len = max(best_allow_len, len(pattern))

        for pattern in rules["disallow"]:
            if self._path_matches(pattern, path):
                best_disallow_len = max(best_disallow_len, len(pattern))

        if best_allow_len == -1 and best_disallow_len == -1:
            return None

        return best_allow_len >= best_disallow_len

    def is_allowed(self, agent: str, url: str) -> bool:
        path = urlparse(url).path or "/"

        specific = self._check_agent(agent, path)
        if specific is not None:
            return specific

        wildcard = self._check_agent("*", path)
        if wildcard is not None:
            return wildcard

        return True

    def is_allowed_for_llm(self, url: str) -> tuple[bool, list[str]]:
        blocked: list[str] = []
        for token in LLM_AGENT_TOKENS:
            if not self.is_allowed(token, url):
                blocked.append(token)
        return len(blocked) == 0, blocked

    def crawl_delay(self, agent: str) -> float | None:
        delay = self._crawl_delays.get(agent.lower())
        if delay is not None:
            return delay
        return self._crawl_delays.get("*")


@lru_cache(maxsize=64)
def _get_checker(origin: str) -> RobotsChecker:
    txt = _fetch_robots_txt(robots_url_for(origin))
    return RobotsChecker(txt)


def get_checker_for_url(url: str) -> RobotsChecker:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("URL must include http(s) scheme and host for robots.txt checks.")
    origin = f"{parsed.scheme}://{parsed.netloc}"
    return _get_checker(origin)


def is_allowed(url: str, agent: str = "GPTBot") -> bool:
    checker = get_checker_for_url(url)
    return checker.is_allowed(agent, url)


def is_allowed_for_llm(url: str) -> tuple[bool, list[str]]:
    checker = get_checker_for_url(url)
    return checker.is_allowed_for_llm(url)


def get_crawl_delay(url: str) -> float | None:
    checker = get_checker_for_url(url)
    for token in LLM_AGENT_TOKENS:
        delay = checker.crawl_delay(token)
        if delay is not None:
            return delay
    return checker.crawl_delay("*")


def check_url_for_scraping(url: str) -> RobotsCheckResult:
    allowed, blocked_agents = is_allowed_for_llm(url)
    return RobotsCheckResult(
        url=url,
        robots_url=robots_url_for(url),
        allowed=allowed,
        blocked_agents=blocked_agents,
        crawl_delay=get_crawl_delay(url),
    )


def enforce_llm_permissions(url: str, raise_on_block: bool = True) -> None:
    result = check_url_for_scraping(url)
    if result.allowed:
        return

    msg = (
        f"robots.txt on {urlparse(url).netloc} disallows LLM agent(s) for "
        f"'{urlparse(url).path}': {', '.join(result.blocked_agents)}"
    )
    if raise_on_block:
        raise PermissionError(msg)


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python robots_checker.py <url> [agent]")
        sys.exit(1)

    target_url = sys.argv[1]
    agent_token = sys.argv[2] if len(sys.argv) > 2 else None

    print("=" * 60)
    print(f"Checking robots.txt for: {target_url}")
    print("=" * 60)

    checker = get_checker_for_url(target_url)

    if agent_token:
        result = checker.is_allowed(agent_token, target_url)
        status = "ALLOWED" if result else "BLOCKED"
        print(f"Agent '{agent_token}': {status}")
    else:
        summary = check_url_for_scraping(target_url)
        if summary.allowed:
            print("All known LLM agents are permitted.")
        else:
            print(f"Blocked LLM agents: {', '.join(summary.blocked_agents)}")

    delay = get_crawl_delay(target_url)
    print(f"Crawl-delay: {delay if delay is not None else 'not specified'}")
    print("=" * 60)
