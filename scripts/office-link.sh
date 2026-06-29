#!/usr/bin/env bash
# Mint a CLIENT link to the ECEB office (lands in the foyer/waiting room; knock to consult).
# Usage: office-link.sh "Client Name — Benefits Review" [hoursValid] [maxUses]
# Targets the office namespace prefix "mtg-eceb" (foyer = mtg-eceb-foyer, office = mtg-eceb-office).
exec bash /opt/weered/scripts/foyer-link.sh "mtg-eceb" "${1:-ECEB Meeting}" "${2:-72}" "${3:-20}"
