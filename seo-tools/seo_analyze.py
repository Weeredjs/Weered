#!/usr/bin/env python3
"""
SEO gap analyzer: Brave SERP -> content fetch -> Haiku topic extract -> coverage scoring.

For each (query, our_page) pair, identifies the topics top-10 competitors cover that
our page does not, ranked by competitor coverage.

v1: Haiku-only semantics (no embeddings). Can layer sentence-transformers later for
true clustering. Haiku handles the "are these two topics actually the same" decision
inline during dedup.
"""

import json
import os
import sys
import time
import requests
from bs4 import BeautifulSoup
from anthropic import Anthropic
from pathlib import Path

BRAVE_KEY = os.environ.get("BRAVE_SEARCH_API_KEY", "")
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
assert BRAVE_KEY, "BRAVE_SEARCH_API_KEY missing"
assert ANTHROPIC_KEY, "ANTHROPIC_API_KEY missing"

CLAUDE = Anthropic(api_key=ANTHROPIC_KEY)
MODEL = "claude-haiku-4-5-20251001"
UA = "Weered-SEO-Bot/1.0 (+https://weered.ca; contact: james@weered.ca)"
HTTP_HEADERS = {"User-Agent": UA, "Accept": "text/html,application/xhtml+xml"}
MAX_PAGE_CHARS = 6000
MAX_RESULTS_PER_QUERY = 10

OUT_DIR = Path("/opt/weered/seo-tools/output")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def brave_serp(query: str, count: int = 10) -> list:
    """Return list of {title, url, description} for top results."""
    r = requests.get(
        "https://api.search.brave.com/res/v1/web/search",
        headers={"X-Subscription-Token": BRAVE_KEY, "Accept": "application/json"},
        params={"q": query, "count": count, "country": "CA"},
        timeout=20,
    )
    r.raise_for_status()
    data = r.json()
    return data.get("web", {}).get("results", [])[:count]


def fetch_page_text(url: str) -> str | None:
    """Fetch a URL and extract readable text. Returns None on failure."""
    try:
        r = requests.get(url, headers=HTTP_HEADERS, timeout=15, allow_redirects=True)
        if r.status_code != 200 or not r.text:
            return None
        soup = BeautifulSoup(r.text, "html.parser")
        # Strip nav/footer/script/style
        for tag in soup(["script", "style", "nav", "footer", "noscript", "form"]):
            tag.decompose()
        # Prefer <main> or <article>, fall back to body
        main = soup.find("main") or soup.find("article") or soup.body or soup
        text = main.get_text(separator=" ", strip=True)
        # Collapse whitespace
        text = " ".join(text.split())
        return text[:MAX_PAGE_CHARS] if text else None
    except Exception:
        return None


def haiku(system: str, user: str, max_tokens: int = 600) -> str:
    """Single Haiku call returning the assistant text. Retries once on transient errors."""
    for attempt in (1, 2):
        try:
            r = CLAUDE.messages.create(
                model=MODEL,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            return r.content[0].text.strip()
        except Exception as e:
            if attempt == 2:
                raise
            time.sleep(2)
    return ""


def extract_topics(query: str, page_text: str) -> list[str]:
    """Ask Haiku to extract 8-12 specific topics this page covers about the query."""
    if not page_text:
        return []
    sys_prompt = (
        "You are an SEO content analyst. Given a search query and the text of a top-ranking "
        "page, extract 8 to 12 SPECIFIC topics that page covers about the query. Topics "
        "should be concrete (eg 'cross-platform fireteam matching' not 'features'). Return "
        "one topic per line, no numbering, no preamble, no explanation."
    )
    user_prompt = f"Query: {query}\n\nPage text:\n{page_text}"
    raw = haiku(sys_prompt, user_prompt, max_tokens=400)
    topics = [line.strip("- *•").strip() for line in raw.split("\n") if line.strip()]
    return [t for t in topics if 4 <= len(t) <= 120][:12]


def dedup_topics(query: str, all_topics: list[str]) -> list[str]:
    """Ask Haiku to merge near-synonyms across all topics from all competitors."""
    if not all_topics:
        return []
    joined = "\n".join(f"- {t}" for t in all_topics)
    sys_prompt = (
        "You are an SEO content analyst. Given a list of topics extracted from multiple "
        "competing pages about a search query, merge near-synonyms into a single canonical "
        "form. Preserve all distinct ideas; only merge true duplicates. Return one canonical "
        "topic per line, no numbering, no preamble. Aim for 15 to 25 final topics."
    )
    user_prompt = f"Query: {query}\n\nTopics (from {len(all_topics)} extractions):\n{joined}"
    raw = haiku(sys_prompt, user_prompt, max_tokens=800)
    deduped = [line.strip("- *•").strip() for line in raw.split("\n") if line.strip()]
    return [t for t in deduped if 4 <= len(t) <= 120][:30]


def score_coverage(query: str, page_text: str, topics: list[str]) -> dict[str, float]:
    """Score 0-1 how well our page covers each topic. Returns {topic: score}."""
    if not page_text or not topics:
        return {}
    topics_block = "\n".join(f"{i+1}. {t}" for i, t in enumerate(topics))
    sys_prompt = (
        "You are an SEO content analyst. Given the text of OUR page and a list of topics "
        "competitor pages cover, score how thoroughly our page covers EACH topic on a 0.0 to "
        "1.0 scale (0 = absent, 0.5 = mentioned, 1.0 = thoroughly covered). Return strict "
        "JSON: an object mapping the topic number (as string) to a float score. No prose."
    )
    user_prompt = f"Query: {query}\n\nOur page text:\n{page_text}\n\nTopics:\n{topics_block}"
    raw = haiku(sys_prompt, user_prompt, max_tokens=600)
    # Try to parse JSON object
    try:
        # Strip any code-fence wrapping
        if raw.startswith("```"):
            raw = raw.split("```")[1].strip()
            if raw.startswith("json"):
                raw = raw[4:].strip()
        scores = json.loads(raw)
        return {topics[int(k) - 1]: float(v) for k, v in scores.items() if 0 < int(k) <= len(topics)}
    except Exception:
        return {t: 0.0 for t in topics}


def analyze_query(query: str, our_page_url: str) -> dict:
    """End-to-end gap analysis for one query."""
    print(f"\n=== {query!r} -> {our_page_url} ===", flush=True)
    print("  fetching SERP...", flush=True)
    serp = brave_serp(query, MAX_RESULTS_PER_QUERY)
    print(f"  got {len(serp)} results", flush=True)
    competitor_topics = []
    competitor_pages_fetched = 0
    for r in serp:
        url = r.get("url", "")
        if url == our_page_url:
            continue
        print(f"  fetching {url[:70]}...", flush=True)
        text = fetch_page_text(url)
        if not text:
            print(f"    -> skip (fetch failed)", flush=True)
            continue
        topics = extract_topics(query, text)
        if topics:
            competitor_pages_fetched += 1
            competitor_topics.extend(topics)
            print(f"    -> {len(topics)} topics extracted", flush=True)
    print(f"  pooling + deduping {len(competitor_topics)} topics...", flush=True)
    deduped = dedup_topics(query, competitor_topics)
    print(f"  {len(deduped)} canonical topics", flush=True)
    # Now score our page
    print(f"  fetching our page {our_page_url}...", flush=True)
    our_text = fetch_page_text(our_page_url)
    if not our_text:
        print(f"    -> WARN: our page failed to fetch", flush=True)
        return {
            "query": query,
            "our_page_url": our_page_url,
            "competitor_count": competitor_pages_fetched,
            "topics": deduped,
            "coverage": {},
            "error": "our_page_fetch_failed",
        }
    coverage = score_coverage(query, our_text, deduped)
    print(f"  done. avg coverage: {sum(coverage.values()) / max(len(coverage), 1):.2f}", flush=True)
    return {
        "query": query,
        "our_page_url": our_page_url,
        "competitor_count": competitor_pages_fetched,
        "topics": deduped,
        "coverage": coverage,
    }


def main():
    queries_file = sys.argv[1] if len(sys.argv) > 1 else "/opt/weered/seo-tools/queries.json"
    queries = json.loads(Path(queries_file).read_text())
    results = []
    for entry in queries:
        try:
            res = analyze_query(entry["query"], entry["our_page"])
            results.append(res)
        except Exception as e:
            print(f"  !!! error for {entry['query']!r}: {e}", flush=True)
            results.append({"query": entry["query"], "our_page_url": entry["our_page"], "error": str(e)})
    ts = time.strftime("%Y%m%d-%H%M%S")
    json_out = OUT_DIR / f"gap-report-{ts}.json"
    md_out = OUT_DIR / f"gap-report-{ts}.md"
    json_out.write_text(json.dumps(results, indent=2))
    # Generate markdown summary
    md_lines = ["# SEO gap analysis report", f"\nGenerated {ts}\n"]
    for r in results:
        md_lines.append(f"\n## `{r['query']}` -> {r['our_page_url']}\n")
        if r.get("error"):
            md_lines.append(f"**ERROR:** {r['error']}\n")
            continue
        md_lines.append(f"Competitors analyzed: {r['competitor_count']}\n")
        coverage = r.get("coverage", {})
        if not coverage:
            md_lines.append("(no coverage scored — likely fetch failure)\n")
            continue
        avg = sum(coverage.values()) / len(coverage)
        md_lines.append(f"\n**Average coverage of competitor topics: {avg:.2f}**\n")
        # Sort by gap (low coverage = high priority to add)
        ranked = sorted(coverage.items(), key=lambda x: x[1])
        md_lines.append("\n### Gaps (topics our page covers least)\n")
        md_lines.append("| Coverage | Topic |")
        md_lines.append("|---|---|")
        for topic, score in ranked[:15]:
            md_lines.append(f"| {score:.2f} | {topic} |")
    md_out.write_text("\n".join(md_lines))
    print(f"\nWrote {json_out} + {md_out}")


if __name__ == "__main__":
    main()
