// A game's official news from Steam: the developer's own posts on its Steam
// community page. Without the feeds filter Steam mixes in press it syndicates
// (PlayGround.ru and Gamemag.ru in Russian, Rock Paper Shotgun), which then
// sat under "Official announcements" on the modules. Every GetNewsForApp call
// goes through here (test/unit/steamNews.test.ts holds the routes to that).
export function steamNewsUrl(
  appId: string | number,
  opts: { count: number; maxlength: number },
): string {
  return (
    `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${appId}` +
    `&count=${opts.count}&maxlength=${opts.maxlength}&format=json` +
    `&feeds=steam_community_announcements`
  );
}
