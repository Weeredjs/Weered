#!/usr/bin/env python3
"""
GSC period-over-period drill: which queries/pages gained or lost position,
impressions, and clicks between the last 28d and the prior 28d. Tells you
whether a decline is concentrated (a few terms tanked -> page/content issue)
or broad (many small drops -> Google update / sitewide signal).

Usage: GSC_SITE="sc-domain:eastcoastemployeebenefits.com" ./venv/bin/python gsc_drill.py
"""
import os
import datetime
from pathlib import Path
from google.oauth2 import service_account
from googleapiclient.discovery import build

SA_PATH = os.environ.get("GSC_SA_JSON", str(Path(__file__).parent / "gsc-sa.json"))
SITE = os.environ.get("GSC_SITE", "sc-domain:weered.ca")
SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"]

creds = service_account.Credentials.from_service_account_file(SA_PATH, scopes=SCOPES)
sc = build("searchconsole", "v1", credentials=creds, cache_discovery=False)


def _range(end_offset, span):
    end = datetime.date.today() - datetime.timedelta(days=end_offset)
    start = end - datetime.timedelta(days=span - 1)
    return start.isoformat(), end.isoformat()


def _rows(start, end, dim):
    body = {"startDate": start, "endDate": end, "dimensions": [dim], "rowLimit": 1000}
    out = sc.searchanalytics().query(siteUrl=SITE, body=body).execute().get("rows", [])
    return {r["keys"][0]: r for r in out}


cur_s, cur_e = _range(3, 28)
prev_s, prev_e = _range(31, 28)


def _diff(dim, min_impr=10):
    cur, prev = _rows(cur_s, cur_e, dim), _rows(prev_s, prev_e, dim)
    items = []
    for k in set(cur) | set(prev):
        c, p = cur.get(k), prev.get(k)
        ci, pi = (c["impressions"] if c else 0), (p["impressions"] if p else 0)
        if max(ci, pi) < min_impr:
            continue
        cpos, ppos = (c["position"] if c else None), (p["position"] if p else None)
        dpos = (cpos - ppos) if (cpos is not None and ppos is not None) else None
        items.append({"k": k, "ci": ci, "pi": pi, "di": ci - pi,
                      "cpos": cpos, "ppos": ppos, "dpos": dpos,
                      "dclk": (c["clicks"] if c else 0) - (p["clicks"] if p else 0)})
    return items


def _show(title, dim):
    items = _diff(dim)
    losers = sorted([x for x in items if x["dpos"] and x["dpos"] > 0], key=lambda x: -x["dpos"])[:15]
    gainers = sorted([x for x in items if x["dpos"] and x["dpos"] < 0], key=lambda x: x["dpos"])[:8]
    dropped = sorted([x for x in items if x["ci"] == 0 and x["pi"] > 0], key=lambda x: -x["pi"])[:8]
    print(f"\n===== {title} — biggest POSITION LOSSES (pos number up = worse rank) =====")
    print(f"{'dPos':>6} {'prev->cur':>13} {'dImpr':>7}  key")
    for x in losers:
        print(f"{x['dpos']:>+6.1f} {x['ppos']:>5.1f}->{x['cpos']:<5.1f} {x['di']:>+7.0f}  {x['k'][:62]}")
    if dropped:
        print(f"\n  -- {title} that DROPPED OUT (had impressions last period, 0 now) --")
        for x in dropped:
            print(f"     was {x['pi']:.0f} impr @ pos {x['ppos']:.1f}   {x['k'][:62]}")
    if gainers:
        print(f"\n  -- {title} biggest GAINS --")
        for x in gainers:
            print(f"{x['dpos']:>+6.1f} {x['ppos']:>5.1f}->{x['cpos']:<5.1f} {x['di']:>+7.0f}  {x['k'][:62]}")


print(f"GSC drill — {SITE}")
print(f"current {cur_s}..{cur_e}  vs  prior {prev_s}..{prev_e}")
_show("QUERIES", "query")
_show("PAGES", "page")
