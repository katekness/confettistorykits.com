# Confetti Story Kits

Where crafting meets storytelling. Printable story adventures for kids, with a phone **Quest Master** that tells the story, reads each clue aloud, gives hints, and throws the confetti at the finish.

Static site, hosted free on GitHub Pages. No build step, no accounts, no tracking.

## Structure

```
index.html              Home page (generated)
kits/<id>/index.html    One page per kit (generated)
faq/index.html          FAQ with structured data (generated)
sitemap.xml, robots.txt, llms.txt   Search + AI discovery files (generated)
tools/build_site.py     Generates all of the above from quests/*.json
play/index.html         The Quest Master (one engine; opens only with a kit key from the PDF)
assets/css/site.css     Shared styles
assets/js/engine.js     Quest engine
assets/img/             Brand art (logo, background, favicon, share image)
quests/index.json       Catalog: which kits show on the home page, and in what order
quests/<id>/quest.json  Everything about one kit: story, characters, clues, hints, finale, colors
quests/<id>/img/        That kit's art
```

## Links

- Play a kit: `/play/?q=birthday-cake`
- Jump to a clue (what the QR codes use): `/play/?q=birthday-cake&c=4`
- QR sticker sheet: `/play/qr.html?q=birthday-cake`

## Adding a new party theme

1. Copy `quests/birthday-cake/` to `quests/<new-id>/` (for example `pirate-treasure`).
2. Replace the art in `img/` (transparent PNG or WebP, about 500 to 900px wide).
3. Edit `quest.json`:
   - `characters`: any number, each with a name, image and voice pitch/rate
   - `intro.lines`, `steps` (riddle, hint, hiding spot, which character speaks), `found` reactions, `finale`
   - `theme`: four colors that re-skin the buttons and confetti
   - `{name}` anywhere in text is replaced with the child's name
4. In `quests/index.json`, set that kit's `status` to `"live"`.
5. Run `python3 tools/build_site.py` to regenerate the homepage, kit page, sitemap and llms.txt.

No code changes needed.

## Publishing

Settings → Pages → Deploy from branch → `main` / root. For the custom domain, add `confettistorykits.com` under Pages → Custom domain and point DNS at GitHub Pages.
