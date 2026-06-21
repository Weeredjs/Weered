#!/usr/bin/env bash
# Weekly GSC capture for both properties. Persistent (droplet cron), no Claude
# dependency. Writes a dated gsc-report-*.md per site + appends drill output to
# cron.log, so the week-over-week history accrues for later analysis.
cd /opt/weered/seo-tools || exit 1
{
  echo "================ weekly GSC run $(date -u +%FT%TZ) ================"
  for S in sc-domain:weered.ca sc-domain:eastcoastemployeebenefits.com; do
    echo "---- $S : pull ----"
    GSC_SITE="$S" ./venv/bin/python gsc_pull.py 2>&1 | sed -n '1,12p'
    echo "---- $S : drill ----"
    GSC_SITE="$S" ./venv/bin/python gsc_drill.py 2>&1 | sed -n '1,40p'
  done
} >> output/cron.log 2>&1
