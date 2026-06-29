#!/usr/bin/env bash
# Mint the HOST link for the ECEB office (host powers: see knocks, admit, lock/open rooms).
# Usage: host-link.sh [hoursValid]   (default 12h — an office-hours block)
set -e
cd /opt/weered/apps/api
SECRET=$(sed -n 's/^JWT_SECRET=//p' .env | head -1 | sed -e 's/^"//' -e 's/"$//')
HRS="${1:-12}"
HOST="office.eastcoastemployeebenefits.com"
TOKEN=$(node -e "const jwt=require('jsonwebtoken'); console.log(jwt.sign({sub:'eceb-host', name:'James Stirling', host:true, scope:{office:'mtg-eceb', foyer:'mtg-eceb-foyer'}}, process.argv[1], {algorithm:'HS256', expiresIn: process.argv[2]}))" "$SECRET" "${HRS}h")
echo "HOST link (you, the advisor) · valid ${HRS}h · keep private"
echo "https://$HOST/foyer?host=$TOKEN"
