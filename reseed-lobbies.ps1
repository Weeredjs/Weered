$API = "https://api.weered.ca"
$Token = Read-Host "Paste your weered_token"
$H = @{ "Authorization" = "Bearer $Token"; "Content-Type" = "application/json" }

$lobbies = @'
[
  {
    "id": "destiny2",
    "name": "Destiny 2",
    "description": "Eyes up, Guardian. Raids, Crucible, loot, and lore.",
    "pinned": true,
    "moduleType": "BUNGIE",
    "moduleConfig": { "subreddit": "r/DestinyTheGame" },
    "keywords": ["destiny","destiny2","bungie","guardian","raids","crucible","gambit"],
    "accentColor": "#4F88C6",
    "bannerUrl": "https://cdn.akamai.steamstatic.com/steam/apps/1085660/header.jpg",
    "logoUrl": "https://www.bungie.net/img/logos/bungie-saber-logo.png"
  },
  {
    "id": "fortnite",
    "name": "Fortnite",
    "description": "Drop in. 100 players. Last one standing.",
    "pinned": true,
    "moduleType": "TWITCH",
    "moduleConfig": { "twitchCategory": "Fortnite", "subreddit": "r/FortNiteBR" },
    "keywords": ["fortnite","epic","battleroyale","fortnitebr","fn"],
    "accentColor": "#0042FF",
    "bannerUrl": "https://cdn2.unrealengine.com/social-image-chapter4-s3-3840x2160-d35912cc25ad.jpg",
    "logoUrl": null
  },
  {
    "id": "valorant",
    "name": "Valorant",
    "description": "Tactical shooter. Agents, abilities, and aim.",
    "pinned": true,
    "moduleType": "TWITCH",
    "moduleConfig": { "twitchCategory": "VALORANT", "subreddit": "r/VALORANT" },
    "keywords": ["valorant","riot","valo","val","tac-shooter"],
    "accentColor": "#FF4655",
    "bannerUrl": "https://cmsassets.rgpub.io/sanity/images/dsfx7636/news/5bee1779b82eb72e0e2013b73dcb03934abf0795-1920x1080.jpg",
    "logoUrl": null
  },
  {
    "id": "league-of-legends",
    "name": "League of Legends",
    "description": "The MOBA. 150+ champions. Infinite salt.",
    "pinned": true,
    "moduleType": "TWITCH",
    "moduleConfig": { "twitchCategory": "League of Legends", "subreddit": "r/leagueoflegends" },
    "keywords": ["league","lol","leagueoflegends","riot","moba","ranked"],
    "accentColor": "#C89B3C",
    "bannerUrl": "https://cmsassets.rgpub.io/sanity/images/dsfx7636/news/c4e40d8d530fc49e53e85aa1f47e0bc80dfbcb16-1920x1080.jpg",
    "logoUrl": null
  },
  {
    "id": "apex-legends",
    "name": "Apex Legends",
    "description": "Squad up. Fast-paced battle royale from Respawn.",
    "pinned": true,
    "moduleType": "TWITCH",
    "moduleConfig": { "twitchCategory": "Apex Legends", "subreddit": "r/apexlegends" },
    "keywords": ["apex","apexlegends","respawn","battleroyale","br"],
    "accentColor": "#CD3333",
    "bannerUrl": "https://cdn.akamai.steamstatic.com/steam/apps/1172470/header.jpg",
    "logoUrl": null
  },
  {
    "id": "call-of-duty",
    "name": "Call of Duty",
    "description": "Warzone, multiplayer, zombies. The franchise.",
    "pinned": true,
    "moduleType": "TWITCH",
    "moduleConfig": { "twitchCategory": "Call of Duty: Warzone", "subreddit": "r/CODWarzone" },
    "keywords": ["cod","callofduty","warzone","modernwarfare","blackops","zombies","mw","bo"],
    "accentColor": "#4CAF50",
    "bannerUrl": "https://cdn.akamai.steamstatic.com/steam/apps/1962663/header.jpg",
    "logoUrl": null
  },
  {
    "id": "warframe",
    "name": "Warframe",
    "description": "Space ninjas. Free-to-play co-op at its finest.",
    "pinned": true,
    "moduleType": "TWITCH",
    "moduleConfig": { "twitchCategory": "Warframe", "subreddit": "r/Warframe" },
    "keywords": ["warframe","tenno","digitalextremes","de"],
    "accentColor": "#87CEEB",
    "bannerUrl": "https://cdn.akamai.steamstatic.com/steam/apps/230410/header.jpg",
    "logoUrl": null
  },
  {
    "id": "helldivers2",
    "name": "Helldivers 2",
    "description": "Spread democracy. Bugs and bots don't stand a chance.",
    "pinned": true,
    "moduleType": "TWITCH",
    "moduleConfig": { "twitchCategory": "Helldivers 2", "subreddit": "r/Helldivers" },
    "keywords": ["helldivers","helldivers2","hd2","democracy","arrowhead"],
    "accentColor": "#FFD700",
    "bannerUrl": "https://cdn.akamai.steamstatic.com/steam/apps/553850/header.jpg",
    "logoUrl": null
  },
  {
    "id": "path-of-exile",
    "name": "Path of Exile",
    "description": "ARPG endgame. Builds, maps, currency, and chaos.",
    "pinned": true,
    "moduleType": "TWITCH",
    "moduleConfig": { "twitchCategory": "Path of Exile", "subreddit": "r/pathofexile" },
    "keywords": ["poe","pathofexile","ggg","arpg","poe2"],
    "accentColor": "#AF6025",
    "bannerUrl": "https://cdn.akamai.steamstatic.com/steam/apps/238960/header.jpg",
    "logoUrl": null
  },
  {
    "id": "gta-online",
    "name": "GTA Online",
    "description": "Los Santos never sleeps. Heists, races, chaos.",
    "pinned": true,
    "moduleType": "TWITCH",
    "moduleConfig": { "twitchCategory": "Grand Theft Auto V", "subreddit": "r/gtaonline" },
    "keywords": ["gta","gtaonline","gtav","gta5","gta6","rockstar","lossantos"],
    "accentColor": "#80B840",
    "bannerUrl": "https://cdn.akamai.steamstatic.com/steam/apps/271590/header.jpg",
    "logoUrl": null
  },
  {
    "id": "rocket-league",
    "name": "Rocket League",
    "description": "Supersonic acrobatic rocket-powered car soccer.",
    "pinned": true,
    "moduleType": "TWITCH",
    "moduleConfig": { "twitchCategory": "Rocket League", "subreddit": "r/RocketLeague" },
    "keywords": ["rocketleague","rl","psyonix","carsoccer"],
    "accentColor": "#005BBB",
    "bannerUrl": "https://cdn.akamai.steamstatic.com/steam/apps/252950/header.jpg",
    "logoUrl": null
  },
  {
    "id": "hiphop",
    "name": "Hip Hop / Rap",
    "description": "Bars, beats, and culture. New drops and classics.",
    "pinned": true,
    "moduleType": "TWITCH",
    "moduleConfig": { "twitchCategory": "Music", "subreddit": "r/hiphopheads" },
    "keywords": ["hiphop","rap","music","bars","beats","trap","drill","rnb"],
    "accentColor": "#E91E63",
    "bannerUrl": "https://images.unsplash.com/photo-1571609860754-1d43be3e93fc?w=800&q=80",
    "logoUrl": null
  },
  {
    "id": "ufc-mma",
    "name": "UFC / MMA",
    "description": "Fight night every night. Cards, picks, and drama.",
    "pinned": true,
    "moduleType": "TWITCH",
    "moduleConfig": { "twitchCategory": "UFC", "subreddit": "r/MMA" },
    "keywords": ["ufc","mma","boxing","fights","dana","octagon","bellator"],
    "accentColor": "#D4AF37",
    "bannerUrl": "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=800&q=80",
    "logoUrl": null
  },
  {
    "id": "nhl",
    "name": "NHL",
    "description": "Playoffs incoming. Watch parties and hockey talk.",
    "pinned": true,
    "moduleType": "TWITCH",
    "moduleConfig": { "twitchCategory": "Hockey", "subreddit": "r/hockey" },
    "keywords": ["nhl","hockey","playoffs","stanleycup","hockeynight"],
    "accentColor": "#009CDE",
    "bannerUrl": "https://images.unsplash.com/photo-1580692475446-c2fabbbbf835?w=800&q=80",
    "logoUrl": null
  },
  {
    "id": "anime",
    "name": "Anime",
    "description": "Seasonal drops, classics, and manga talk.",
    "pinned": true,
    "moduleType": "TWITCH",
    "moduleConfig": { "twitchCategory": "Just Chatting", "subreddit": "r/anime" },
    "keywords": ["anime","manga","weeb","otaku","crunchyroll","seasonal"],
    "accentColor": "#9C27B0",
    "bannerUrl": "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&q=80",
    "logoUrl": null
  },
  {
    "id": "crypto",
    "name": "Crypto",
    "description": "Charts, alpha, and degen plays.",
    "pinned": true,
    "moduleType": "TWITCH",
    "moduleConfig": { "twitchCategory": "Crypto", "subreddit": "r/CryptoCurrency" },
    "keywords": ["crypto","bitcoin","btc","eth","defi","web3","nft","altcoin"],
    "accentColor": "#F7931A",
    "bannerUrl": "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&q=80",
    "logoUrl": null
  },
  {
    "id": "sneakers-streetwear",
    "name": "Sneakers and Streetwear",
    "description": "Drops, fits, and heat checks.",
    "pinned": true,
    "moduleType": "TWITCH",
    "moduleConfig": { "twitchCategory": "Just Chatting", "subreddit": "r/Sneakers" },
    "keywords": ["sneakers","streetwear","kicks","nike","jordan","yeezy","newbalance","fashion"],
    "accentColor": "#FF5722",
    "bannerUrl": "https://images.unsplash.com/photo-1556906781-9a412961c28c?w=800&q=80",
    "logoUrl": null
  },
  {
    "id": "lobby",
    "name": "The Lobby",
    "description": "General hangout. Everyone starts here.",
    "pinned": true,
    "moduleType": "TWITCH",
    "moduleConfig": { "twitchCategory": "Just Chatting", "subreddit": "r/all" },
    "keywords": ["lobby","general","home","chill"],
    "accentColor": "#FFFFFF",
    "bannerUrl": null,
    "logoUrl": null
  },
  {
    "id": "mlb",
    "name": "MLB",
    "description": "America's pastime. Live scores, standings, stats, and streams.",
    "pinned": true,
    "moduleType": "MLB",
    "moduleConfig": { "twitchCategory": "MLB The Show 25", "subreddit": "r/baseball" },
    "keywords": ["mlb","baseball","yankees","dodgers","mets","astros","braves","phillies","padres","cubs","redsox","homerun"],
    "accentColor": "#C41E3A",
    "bannerUrl": "https://img.mlbstatic.com/mlb-images/image/upload/t_16x9/t_w1536/mlb/wbhdxjhxlrsqnnb1ivkp.jpg",
    "logoUrl": "https://www.mlbstatic.com/team-logos/league-on-dark/1.svg"
  },
  {
    "id": "pga",
    "name": "PGA Tour",
    "description": "Leaderboards, field intel, news, and streams. Every tournament.",
    "pinned": true,
    "moduleType": "PGA",
    "moduleConfig": { "twitchCategory": "Golf", "subreddit": "r/golf" },
    "keywords": ["pga","golf","masters","pgatour","usopen","theopen","pga championship","ryder cup","tiger","scottie","rory"],
    "accentColor": "#003B2F",
    "bannerUrl": "https://a.espncdn.com/photo/2025/0410/r1310123_1296x729_16-9.jpg",
    "logoUrl": null
  },
  {
    "id": "weered.ca",
    "name": "Weered HQ",
    "description": "Platform news, beta feedback, and announcements.",
    "pinned": true,
    "moduleType": "NONE",
    "moduleConfig": null,
    "keywords": ["weered","meta","official","beta","feedback"],
    "accentColor": "#00E676",
    "bannerUrl": null,
    "logoUrl": null
  }
]
'@ | ConvertFrom-Json

Write-Host ""
Write-Host "WEERED FULL RESEED - $($lobbies.Count) lobbies" -ForegroundColor Cyan
Write-Host ""

$ok = 0
$fail = 0

foreach ($L in $lobbies) {
    $json = $L | ConvertTo-Json -Depth 5

    try {
        $r = Invoke-RestMethod -Uri "$API/lobbies" -Method POST -Headers $H -Body $json -ErrorAction Stop
        Write-Host "[OK] $($L.name)" -ForegroundColor Green
        $ok++
    }
    catch {
        Write-Host "[FAIL] $($L.id) - $($_.Exception.Message)" -ForegroundColor Red
        $fail++
    }
}

Write-Host ""
Write-Host "Done. $ok ok, $fail failed." -ForegroundColor Cyan
