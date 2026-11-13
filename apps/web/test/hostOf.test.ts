import { describe, expect, it } from "vitest";
import { isHostOf, isUrlOf } from "../lib/hostOf";
import { spotifyEmbed, youTubeEmbed } from "../components/lobby-design/LobbyHomeCanvas";
import { youtubeId } from "../app/foyer/OfficeWall";

// Where a link points (hardening pass 2026-11-12). Nine places asked with
// endsWith or includes, which call "evilyoutube.com" YouTube and
// "reddit.com.example.net" Reddit. None of them handed the look-alike address
// on to a player, but the question now has one honest answer.
describe("whose host is this", () => {
  it("is the domain itself or a name under it", () => {
    expect(isHostOf("youtube.com", "youtube.com")).toBe(true);
    expect(isHostOf("www.youtube.com", "youtube.com")).toBe(true);
    expect(isHostOf("Music.YouTube.com", "youtube.com")).toBe(true);
  });

  it("is never a look-alike", () => {
    expect(isHostOf("evilyoutube.com", "youtube.com")).toBe(false);
    expect(isHostOf("youtube.com.example.net", "youtube.com")).toBe(false);
    expect(isHostOf("", "youtube.com")).toBe(false);
    expect(isUrlOf("https://reddit.com.example.net/r/all", "reddit.com")).toBe(false);
    expect(isUrlOf("https://old.reddit.com/r/all", "reddit.com")).toBe(true);
    expect(isUrlOf("not a link", "reddit.com")).toBe(false);
  });
});

describe("a pasted YouTube or Spotify link", () => {
  it("becomes our own player address", () => {
    expect(youTubeEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    expect(youTubeEmbed("https://youtu.be/dQw4w9WgXcQ?t=4")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    expect(youTubeEmbed("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    expect(youTubeEmbed("https://www.youtube.com/playlist?list=PL1234567890abcdef")).toBe(
      "https://www.youtube-nocookie.com/embed/videoseries?list=PL1234567890abcdef",
    );
    expect(youTubeEmbed("https://www.youtube.com/embed/videoseries?list=PL1234567890abcdef")).toBe(
      "https://www.youtube-nocookie.com/embed/videoseries?list=PL1234567890abcdef",
    );
    expect(spotifyEmbed("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=x")).toBe(
      "https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M",
    );
  });

  it("is refused from a look-alike site, or with anything odd in the id", () => {
    expect(youTubeEmbed("https://evilyoutube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(youTubeEmbed("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(youTubeEmbed("https://youtu.be.example.net/dQw4w9WgXcQ")).toBeNull();
    expect(youTubeEmbed("https://www.youtube.com/watch?v=abc%2F..%2Fx")).toBeNull();
    expect(youTubeEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=a%26b")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    expect(spotifyEmbed("https://evilspotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M")).toBeNull();
    expect(youtubeId("https://evilyoutube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(youtubeId("https://music.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
});
