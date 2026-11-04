/** A count with its word: "1 room", "2 rooms". The site printed "1 rooms",
 *  "1 members" and "1 viewers" wherever a count could be one (the lobby
 *  header, found 2026-11-04 on a place with one room); every count label now
 *  goes through here. Irregular words pass their plural: plural(n, "lobby",
 *  "lobbies"). A missing count reads as 0. */
export function plural(n: number | null | undefined, one: string, many = `${one}s`): string {
  return `${n ?? 0} ${noun(n, one, many)}`;
}

/** Just the word, for a count drawn on its own (a stat chip, a big number
 *  with its label under it, a count formatted with toLocaleString). */
export function noun(n: number | null | undefined, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}
