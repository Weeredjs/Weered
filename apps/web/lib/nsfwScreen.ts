// Client-side NSFW pre-screen — nsfwjs loaded from a CDN at runtime (the
// embedded model shards break the webpack minifier if bundled, and Function()
// keeps both TS and webpack from statically analyzing the import). This is a
// fast first pass; the server re-screens every upload. Fails open on any
// error, so a screen outage never blocks a legitimate upload.
let _nsfwModel: any = null;

export async function screenImageFile(file: File): Promise<{ ok: boolean }> {
  try {
    if (!_nsfwModel) {
      const dynImport = new Function("u", "return import(u)") as (u: string) => Promise<any>;
      const nsfwjs = await dynImport("https://esm.sh/nsfwjs@4.3.0");
      _nsfwModel = await (nsfwjs.load ? nsfwjs.load() : nsfwjs.default.load());
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("decode"));
        img.src = url;
      });
      const preds: { className: string; probability: number }[] = await _nsfwModel.classify(img);
      const bad = preds.find(
        (p) => (p.className === "Porn" || p.className === "Hentai") && p.probability > 0.7,
      );
      return { ok: !bad };
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return { ok: true }; // screen unavailable — the server re-screens
  }
}
