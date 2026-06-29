#!/usr/bin/env bash
# Mint a white-label meeting link (scoped, expiring GUEST invite) for a meeting room id.
# The room auto-creates on first join. Private meeting rooms use the 'mtg-' prefix, which
# is hidden from Weered's in-app room browser (presence rooms:list filter) and is never a
# Lobby, so it can't appear in /lobbies, /explore, or the public sitemap.
# Usage: foyer-link.sh <roomId> [label] [hoursValid] [maxUses]
set -e
cd /opt/weered/apps/api
DB=$(sed -n 's/^DATABASE_URL=//p' .env | head -1 | sed -e 's/^"//' -e 's/"$//')
ROOM="$1"; LABEL="${2:-Meeting}"; HRS="${3:-72}"; MAX="${4:-20}"
HOST="office.eastcoastemployeebenefits.com"
CREATED_BY="cmmgisqb70000zzfhh3k9e069"  # weered account — Invite.createdBy
[ -z "$ROOM" ] && { echo "usage: foyer-link.sh <roomId> [label] [hoursValid] [maxUses]"; exit 1; }
TOK="m_$(openssl rand -hex 12)"
psql "$DB" -c "insert into \"Invite\"(id,token,type,\"targetId\",\"createdBy\",\"maxUses\",uses,\"expiresAt\",\"createdAt\") values (gen_random_uuid()::text,'$TOK','GUEST','$ROOM','$CREATED_BY',$MAX,0,now()+interval '$HRS hours',now());" >/dev/null
ENC=$(printf '%s' "$LABEL" | sed 's/ /%20/g')
echo "Meeting link  ·  \"$LABEL\"  ·  room $ROOM  ·  valid ${HRS}h  ·  ${MAX} guests"
echo "https://$HOST/foyer?invite=$TOK&title=$ENC"
