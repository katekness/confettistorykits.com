/*
 * Confetti Story Kits: Quest Master engine
 * One engine for every kit. Each kit lives in /quests/<id>/quest.json with its art.
 * URL: /play/?q=<id>          start or resume a quest
 *      /play/?q=<id>&c=<n>    jump to clue n (used by QR codes printed on clue cards)
 */
(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const questId = (params.get("q") || "").replace(/[^a-z0-9-]/gi, "");
  const jumpTo = parseInt(params.get("c"), 10);
  const view = document.getElementById("view");
  const toastEl = document.getElementById("toast");
  const voiceBtn = document.getElementById("voiceBtn");
  const menuBtn = document.getElementById("menuBtn");

  if (!questId) { location.replace("../"); return; }
  const base = `../quests/${questId}/`;

  /* ---------- Storage (safe) ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } }
  };
  const KEY = `cs:${questId}`;
  let state = store.get(KEY, { name: "", step: "setup" });
  let voiceOn = store.get("cs:voice", true);
  let quest;

  const save = () => store.set(KEY, state);

  /* ---------- Tiny DOM helper ---------- */
  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
    return el;
  }
  const fill = (s) => String(s).replaceAll("{name}", state.name || quest.setup.defaultName);
  const asset = (p) => base + p;

  /* ---------- Sound (Web Audio, no files) ---------- */
  let ctx;
  function audio() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function tone(freq, start, dur, type = "sine", vol = 0.18) {
    const a = audio(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, a.currentTime + start);
    g.gain.linearRampToValueAtTime(vol, a.currentTime + start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + start + dur);
    o.connect(g).connect(a.destination);
    o.start(a.currentTime + start); o.stop(a.currentTime + start + dur + 0.05);
  }
  const sfx = {
    tap() { tone(880, 0, 0.08, "triangle", 0.08); },
    chime() { [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, i * 0.08, 0.35, "triangle", 0.14)); },
    hint() { [784, 988].forEach((f, i) => tone(f, i * 0.1, 0.25, "sine", 0.12)); },
    fanfare() {
      [[523, 0], [659, .15], [784, .3], [1047, .45], [784, .7], [1047, .85]].forEach(([f, t]) => tone(f, t, 0.4, "square", 0.07));
      [1568, 2093, 2637].forEach((f, i) => tone(f, 1.1 + i * 0.07, 0.6, "triangle", 0.1));
    }
  };

  /* ---------- Voice (speech synthesis) ---------- */
  let voices = [];
  const loadVoices = () => { try { voices = speechSynthesis.getVoices(); } catch { voices = []; } };
  if ("speechSynthesis" in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
  function pickVoice() {
    const en = voices.filter(v => /^en(-|_)/i.test(v.lang));
    const pref = ["Samantha", "Google US English", "Karen", "Moira", "Tessa", "Microsoft Aria", "Microsoft Jenny"];
    for (const p of pref) { const v = en.find(x => x.name.includes(p)); if (v) return v; }
    return en[0] || null;
  }
  function say(text, speakerKey) {
    if (!voiceOn || !("speechSynthesis" in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice(); if (v) u.voice = v;
      const cfg = quest.characters[speakerKey]?.voice || {};
      u.pitch = cfg.pitch ?? 1.1; u.rate = cfg.rate ?? 0.95;
      speechSynthesis.speak(u);
    } catch { /* ignore */ }
  }
  function setVoice(on) {
    voiceOn = on; store.set("cs:voice", on);
    voiceBtn.setAttribute("aria-pressed", String(on));
    voiceBtn.textContent = on ? "🔊" : "🔈";
    if (!on && "speechSynthesis" in window) speechSynthesis.cancel();
  }
  voiceBtn.addEventListener("click", () => { audio(); setVoice(!voiceOn); sfx.tap(); });

  /* ---------- Toast + confetti ---------- */
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1600);
  }

  const canvas = document.getElementById("confetti");
  const c2d = canvas.getContext("2d");
  let bits = [], raf;
  function burst(count = 140) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    const t = quest?.theme || {};
    const colors = [t.accent || "#f0468e", t.primary || "#8e3fa8", t.gold || "#f4c542", "#5fc8e8", "#ff9ec7", "#b48cf0"];
    for (let i = 0; i < count; i++) {
      bits.push({
        x: innerWidth / 2 + (Math.random() - .5) * innerWidth * .4, y: innerHeight * .35,
        vx: (Math.random() - .5) * 12, vy: -Math.random() * 13 - 4,
        r: Math.random() * 6 + 4, rot: Math.random() * 6, vr: (Math.random() - .5) * .3,
        c: colors[(Math.random() * colors.length) | 0], shape: Math.random() < .3 ? "star" : "rect", life: 0
      });
    }
    cancelAnimationFrame(raf); tick();
  }
  function star(x, y, r) {
    c2d.beginPath();
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r / 2.2 : r; c2d.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c2d.closePath(); c2d.fill();
  }
  function tick() {
    c2d.clearRect(0, 0, innerWidth, innerHeight);
    bits = bits.filter(b => b.y < innerHeight + 30 && b.life < 400);
    for (const b of bits) {
      b.vy += .28; b.vx *= .99; b.x += b.vx; b.y += b.vy; b.rot += b.vr; b.life++;
      c2d.save(); c2d.translate(b.x, b.y); c2d.rotate(b.rot); c2d.fillStyle = b.c;
      if (b.shape === "star") star(0, 0, b.r); else c2d.fillRect(-b.r / 2, -b.r / 3, b.r, b.r * .66);
      c2d.restore();
    }
    if (bits.length) raf = requestAnimationFrame(tick); else c2d.clearRect(0, 0, innerWidth, innerHeight);
  }

  /* ---------- Pieces ---------- */
  function speakerBlock(key, text, right = false) {
    const ch = quest.characters[key];
    return h("div", { class: "speaker" + (right ? " right" : "") },
      h("img", { class: "char", src: asset(ch.img), alt: ch.name }),
      h("div", { class: "bubble" }, h("span", { class: "who" }, ch.name), text));
  }
  function progress(current) {
    const total = quest.steps.length;
    return h("div", { class: "progress", "aria-label": `Clue ${current} of ${total}` },
      quest.steps.map(s => h("span", { class: s.n < current ? "done" : s.n === current ? "now" : "" }, s.final ? "★" : String(s.n))));
  }
  function go(step) {
    state.step = step; save();
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    render(); scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- Screens ---------- */
  function renderSetup() {
    const s = quest.setup;
    const input = h("input", { class: "text", id: "name", type: "text", autocomplete: "off", maxlength: "24", placeholder: s.namePlaceholder, value: state.name || "" });
    return h("section", { class: "screen" },
      h("img", { class: "title-art", src: asset(quest.titleArt), alt: quest.title }),
      h("div", { class: "card panel" },
        h("h2", {}, "Host setup"),
        h("label", { class: "field", for: "name" }, s.nameLabel),
        input,
        h("p", { class: "note" }, "Their name gets woven into the story.")),
      h("div", { class: "card panel" },
        h("h2", {}, "Before you start"),
        h("ul", { class: "checklist" }, s.checklist.map((item, i) =>
          h("li", {}, h("label", {}, h("input", { type: "checkbox", id: "chk" + i }), h("span", {}, item))))),
        h("p", { class: "note" }, "Keep your phone in your hand. You read the story, the kids do the hunting.")),
      h("div", { class: "actions" },
        h("button", { class: "btn", onclick: () => { audio(); sfx.chime(); state.name = input.value.trim(); go("intro"); } }, "Start the story ✨")));
  }

  function renderIntro() {
    const i = quest.intro;
    const text = i.lines.map(fill);
    const bubble = speakerBlock(i.speaker, h("div", {}, text.map(t => h("p", { style: "margin:0 0 10px" }, t))));
    setTimeout(() => say(text.join(" "), i.speaker), 350);
    return h("section", { class: "screen" },
      i.art ? h("img", { class: "title-art", src: asset(i.art), alt: "" }) : null,
      bubble,
      h("div", { class: "actions" },
        h("button", { class: "btn", onclick: () => { sfx.chime(); go(1); } }, i.button),
        h("button", { class: "btn secondary small", onclick: () => say(text.join(" "), i.speaker) }, "🔊 Read it again")));
  }

  function renderStep(n) {
    const step = quest.steps.find(s => s.n === n);
    if (!step) { go("setup"); return h("div"); }
    const hintEl = h("p", { class: "hint", id: "hint" }, "💡 " + step.hint);
    const right = n % 2 === 0;
    const intro = n === 1 ? `Read Clue #1 together, ${state.name || "brave explorers"}!` : `Clue #${n}! Let's read it together.`;
    setTimeout(() => say(`${intro} ${step.riddle}`, step.speaker), 350);

    const next = () => {
      sfx.chime(); burst(60);
      if (step.final) { go("done"); return; }
      toast(quest.found[(n - 1) % quest.found.length]);
      setTimeout(() => go(n + 1), 900);
    };

    return h("section", { class: "screen" },
      progress(n),
      speakerBlock(step.speaker, intro, right),
      h("div", { class: "clue" },
        h("span", { class: "tagline" }, step.final ? "Final Clue" : `Clue #${n}`),
        h("p", { class: "riddle" }, step.riddle),
        hintEl),
      h("div", { class: "row" },
        h("button", { class: "btn secondary small", onclick: () => say(step.riddle, step.speaker) }, "🔊 Read again"),
        h("button", { class: "btn secondary small", onclick: () => { sfx.hint(); hintEl.classList.add("show"); say(step.hint, step.speaker); } }, "💡 Hint")),
      h("div", { class: "spacer" }),
      h("div", { class: "actions" },
        h("button", { class: "btn", onclick: next }, step.final ? "We found the cake! 🎂" : `We found Clue #${n + 1}!`),
        n > 1 ? h("button", { class: "btn secondary small", onclick: () => go(n - 1) }, "← Back a clue") : null));
  }

  function renderDone() {
    const f = quest.finale;
    const lines = f.lines.map(fill);
    setTimeout(() => { sfx.fanfare(); burst(220); setTimeout(() => burst(140), 900); }, 200);
    setTimeout(() => say(lines.join(" "), quest.intro.speaker), 1200);
    return h("section", { class: "screen" },
      h("h1", { style: "text-align:center;font-size:2.2rem;color:var(--pink)" }, f.title),
      h("img", { class: "finale-art", src: asset(f.art), alt: "The knight and princess celebrating with the cake" }),
      h("div", { class: "card panel", style: "text-align:center" }, lines.map(t => h("p", { style: "margin:0 0 8px;font-size:1.15rem" }, t))),
      f.badge ? h("p", { class: "badge-out" }, "🏅 " + (state.name || "Our explorer"), h("small", {}, `is now an official ${f.badge}!`)) : null,
      h("div", { class: "actions" },
        h("button", { class: "btn", onclick: () => { burst(200); sfx.fanfare(); } }, "More confetti! 🎉"),
        h("button", { class: "btn secondary small", onclick: () => { state.step = "setup"; save(); render(); } }, "Play again"),
        h("a", { class: "btn secondary small", href: "../" }, "See more story kits")));
  }

  /* ---------- Host menu ---------- */
  function openMenu() {
    const dlg = h("dialog", { class: "card", style: "border:0;padding:20px;max-width:440px;width:92vw;border-radius:22px" });
    const jump = h("select", { class: "text", "aria-label": "Jump to a clue" },
      h("option", { value: "setup" }, "Host setup"), h("option", { value: "intro" }, "Story intro"),
      quest.steps.map(s => h("option", { value: s.n, selected: s.n === state.step }, `Clue #${s.n}`)),
      h("option", { value: "done" }, "Finale"));
    dlg.append(
      h("h2", { style: "margin-bottom:12px" }, "Host menu"),
      h("label", { class: "field" }, "Jump to"), jump,
      h("div", { class: "row", style: "margin:14px 0" },
        h("button", { class: "btn small", onclick: () => { const v = jump.value; dlg.close(); go(isNaN(v) ? v : +v); } }, "Go"),
        h("button", { class: "btn secondary small", onclick: () => { dlg.close(); state = { name: state.name, step: "setup" }; go("setup"); } }, "Restart")),
      h("details", {}, h("summary", { style: "cursor:pointer;font-weight:700" }, "Hiding spot guide"),
        h("ul", { style: "padding-left:20px;line-height:1.6" },
          h("li", {}, h("b", {}, "Clue #1: "), "keep in your hand to start"),
          quest.steps.map(s => h("li", {}, h("b", {}, s.final ? "Quest Complete card: " : `Clue #${s.n + 1}: `), s.spot)))),
      h("p", { class: "note" }, h("a", { href: `qr.html?q=${questId}`, target: "_blank" }, "Print QR stickers for the clue cards")),
      h("div", { class: "row", style: "margin-top:10px" }, h("button", { class: "btn secondary small", onclick: () => dlg.close() }, "Close")));
    dlg.addEventListener("close", () => dlg.remove());
    document.body.append(dlg); dlg.showModal();
  }
  menuBtn.addEventListener("click", () => { sfx.tap(); quest && openMenu(); });

  /* ---------- Render ---------- */
  function render() {
    view.replaceChildren();
    let el;
    if (state.step === "setup") el = renderSetup();
    else if (state.step === "intro") el = renderIntro();
    else if (state.step === "done") el = renderDone();
    else el = renderStep(+state.step);
    view.append(el);
  }

  function applyTheme(t = {}) {
    const r = document.documentElement.style;
    if (t.primary) r.setProperty("--purple", t.primary);
    if (t.accent) r.setProperty("--pink", t.accent);
    if (t.soft) r.setProperty("--soft", t.soft);
    if (t.gold) r.setProperty("--gold", t.gold);
  }

  fetch(base + "quest.json", { cache: "no-cache" })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(q => {
      quest = q;
      document.title = `${q.title} | Quest Master`;
      applyTheme(q.theme);
      setVoice(voiceOn);
      if (jumpTo && q.steps.some(s => s.n === jumpTo)) {
        state.step = jumpTo; save();
        history.replaceState(null, "", `?q=${questId}`);
      }
      render();
    })
    .catch(() => {
      view.replaceChildren(h("section", { class: "screen" },
        h("div", { class: "card panel" }, h("h2", {}, "Hmm, we couldn't find that quest."),
          h("p", {}, h("a", { href: "../" }, "Back to all story kits")))));
    });
})();
