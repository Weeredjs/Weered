# deploy.ps1
$ErrorActionPreference="Stop"

$host = "root@weered.ca"   # or ubuntu@...
$remotePath = "/opt/weered"

# 1) push code (assumes you're already on the right branch)
git push

# 2) deploy on server
ssh $host "cd $remotePath && git pull && weered-compose build --no-cache && weered-compose up -d"

# 3) quick checks (optional)
ssh $host "cd $remotePath && weered-compose ps"
ssh $host "curl -fsS http://127.0.0.1:4000/health && echo 'API OK'"