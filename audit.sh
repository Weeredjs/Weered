#!/bin/bash
# Save as: audit.sh
# Run from your project root: bash audit.sh

echo "=== PROJECT AUDIT ===" > audit.txt
echo "Date: $(date)" >> audit.txt
echo "" >> audit.txt

echo "=== DIRECTORY STRUCTURE (2 levels) ===" >> audit.txt
find . -maxdepth 2 -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/.next/*' >> audit.txt

echo "" >> audit.txt
echo "=== PACKAGE.JSON (root) ===" >> audit.txt
cat package.json 2>/dev/null >> audit.txt || echo "No root package.json" >> audit.txt

echo "" >> audit.txt
echo "=== ALL PACKAGE.JSON FILES (non-node_modules) ===" >> audit.txt
find . -name "package.json" -not -path '*/node_modules/*' -exec echo "--- {} ---" \; -exec cat {} \; >> audit.txt 2>/dev/null

echo "" >> audit.txt
echo "=== FILE COUNT BY TYPE ===" >> audit.txt
find . -not -path '*/node_modules/*' -not -path '*/.git/*' -type f | sed 's/.*\.//' | sort | uniq -c | sort -rn | head -30 >> audit.txt

echo "" >> audit.txt
echo "=== TOTAL FILE COUNT (excl. node_modules, git) ===" >> audit.txt
find . -not -path '*/node_modules/*' -not -path '*/.git/*' -type f | wc -l >> audit.txt

echo "" >> audit.txt
echo "=== ENV FILES (names only, no values) ===" >> audit.txt
find . -name ".env*" -not -path '*/node_modules/*' | xargs -I{} echo {} >> audit.txt

echo "" >> audit.txt
echo "=== CONFIG FILES ===" >> audit.txt
find . -maxdepth 3 -name "*.config.*" -not -path '*/node_modules/*' -exec echo "--- {} ---" \; -exec cat {} \; >> audit.txt 2>/dev/null

echo "" >> audit.txt
echo "=== GIT REMOTES ===" >> audit.txt
git remote -v >> audit.txt 2>/dev/null

echo "" >> audit.txt
echo "=== RECENT GIT LOG (last 10) ===" >> audit.txt
git log --oneline -10 >> audit.txt 2>/dev/null

echo "Done! Upload audit.txt to Claude."