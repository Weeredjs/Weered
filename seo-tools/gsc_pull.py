#!/usr/bin/env python3
"""
GSC pull for weered.ca — the "is it actually working" half of SEO.

Pulls Google Search Console Search-Analytics performance (last 28d vs prior 28d:
clicks, impressions, CTR, position, top queries, top pages) + sitemap status,
and writes a dated markdown report next to the gap-analysis reports.

ONE-TIME SETUP (James — only you can do these, they need your Google account):
  1. console.cloud.google.com -> create/select a project.
  2. APIs & Services -> Enable APIs -> enable "Google Search Console API".
  3. APIs & Services -> Credentials -> Create credentials -> Service account.
     Name it e.g. "weered-gsc-readonly". Create it (no roles needed).
  4. Open the service account -> Keys -> Add key -> Create new key -> JSON -> download.
  5. search.google.com/search-console -> pick the weered.ca property ->
     Settings -> Users and permissions -> Add user ->
     paste the service-account email (…@….iam.gserviceaccount.com), permission: Full.
  6. Put the JSON at /opt/weered/seo-tools/gsc-sa.json   (this file is gitignored)

RUN:  cd /opt/weered/seo-tools && ./venv/bin/python gsc_pull.py
DEPS: ./venv/bin/pip install google-api-python-client google-auth
"""
import os
import datetime
from pathlib import Path
from google.oauth2 import service_account
from googleapiclient.discovery import build

SA_PATH = os.environ.get("GSC_SA_JSON", str(Path(__file__).parent / "gsc-sa.json"))
SITE = os.environ.get("GSC_SITE", "sc-domain:weered.ca")  # DNS-verified => domain property
SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"]
OUT_DIR = Path(__file__).parent / "output"
OUT_DIR.mkdir(exist_ok=True)

assert Path(SA_PATH).exists(), (
    f"service-account JSON not found at {SA_PATH}. "
    "Create it per the setup steps in this file's docstring, or set GSC_SA_JSON."
)

creds = service_account.Credentials.from_service_account_file(SA_PATH, scopes=SCOPES)
sc = build("searchconsole", "v1", credentials=creds, cache_discovery=False)


def _range(end_offset_days, span_days):
    # GSC data lags ~2-3 days; offset the window end so it isn't half-empty.
    end = datetime.date.today() - datetime.timedelta(days=end_offset_days)
    start = end - datetime.timedelta(days=span_days - 1)
    return start.isoformat(), end.isoformat()


def _q(start, end, dimensions=None, limit=25):
    body = {"startDate": start, "endDate": end, "rowLimit": limit}
    if dimensions:
        body["dimensions"] = dimensions
    return sc.searchanalytics().query(siteUrl=SITE, body=body).execute().get("rows", [])


def _totals(start, end):
    rows = _q(start, end)
    if not rows:
        return {"clicks": 0, "impressions": 0, "ctr": 0.0, "position": 0.0}
    r = rows[0]
    return {
        "clicks": r.get("clicks", 0),
        "impressions": r.get("impressions", 0),
        "ctr": r.get("ctr", 0.0),
        "position": r.get("position", 0.0),
    }


cur_s, cur_e = _range(3, 28)
prev_s, prev_e = _range(31, 28)
cur, prev = _totals(cur_s, cur_e), _totals(prev_s, prev_e)
top_q = _q(cur_s, cur_e, ["query"], 25)
top_p = _q(cur_s, cur_e, ["page"], 25)

try:
    sitemaps = sc.sitemaps().list(siteUrl=SITE).execute().get("sitemap", [])
except Exception as e:  # noqa: BLE001
    sitemaps = []
    print(f"(sitemaps list failed: {e})")

ts = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
out = [f"# GSC report — {SITE} — {ts}", ""]
out.append(f"## Performance — last 28d ({cur_s}..{cur_e}) vs prior 28d")


def _d(a, b):
    diff = a - b
    return f"{a:,.0f}  ({'+' if diff >= 0 else ''}{diff:,.0f} vs prior 28d)"


out += [
    f"- **Clicks:** {_d(cur['clicks'], prev['clicks'])}",
    f"- **Impressions:** {_d(cur['impressions'], prev['impressions'])}",
    f"- **CTR:** {cur['ctr']*100:.2f}%  (prior {prev['ctr']*100:.2f}%)",
    f"- **Avg position:** {cur['position']:.1f}  (prior {prev['position']:.1f})  (lower = better)",
    "",
    "## Top queries (28d)",
    "| clicks | impressions | query |",
    "|---:|---:|---|",
]
out += [f"| {r['clicks']:.0f} | {r['impressions']:.0f} | {r['keys'][0]} |" for r in top_q] or ["| – | – | (no query data yet) |"]
out += ["", "## Top pages (28d)", "| clicks | impressions | page |", "|---:|---:|---|"]
out += [f"| {r['clicks']:.0f} | {r['impressions']:.0f} | {r['keys'][0]} |" for r in top_p] or ["| – | – | (no page data yet) |"]
out += ["", "## Sitemaps"]
if sitemaps:
    for s in sitemaps:
        c = (s.get("contents") or [{}])[0]
        out.append(f"- `{s.get('path')}` — submitted={c.get('submitted', '?')} lastDownloaded={s.get('lastDownloaded', '?')} errors={s.get('errors', 0)} warnings={s.get('warnings', 0)}")
else:
    out.append("- (none returned)")

report = "\n".join(out)
report_path = OUT_DIR / f"gsc-report-{ts}.md"
report_path.write_text(report, encoding="utf-8")
print(report)
print(f"\nWrote {report_path}")
