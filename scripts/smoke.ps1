$ErrorActionPreference="Stop"
$api="http://127.0.0.1:4000"
"== /health =="
irm "$api/health"
"== /rooms =="
irm "$api/rooms"
"== create room =="
irm -Method Post "$api/rooms" -ContentType "application/json" -Body '{"name":"Smoke Room"}'
"OK"
