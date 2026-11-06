/* Everything on screen: drawing, tapping, story beats and saving.
   The rules and numbers are in engine.js. */
(function () {
  "use strict";
  const E = window.BullEngine;
  const SAVE_KEY = "bull-run-escape";
  const $ = (id) => document.getElementById(id);
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const BEAR = "Grizz";
  let s = E.newGame();
  let tab = "main";

  /* Saving. Storage can be blocked, so the game must still run without it. */
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* no storage here */ }
  }
  function readSave() {
    try { return localStorage.getItem(SAVE_KEY); } catch (e) { return null; }
  }

  /* Numbers */
  function money(n) {
    const sign = n < 0 ? "-" : "";
    n = Math.abs(n);
    if (n < 1000) return sign + "£" + n.toFixed(n < 100 ? 2 : 0);
    if (n < 1e6) return sign + "£" + Math.floor(n).toLocaleString("en-GB");
    return sign + "£" + (n / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
  }
  const perSecond = (n) => money(n) + "/s";
  const percent = (n) => (n >= 0 ? "+" : "") + (n * 100).toFixed(1) + "%";

  /* Speech: lines queue so that a burst of events stays readable. */
  const queue = [];
  let talkUntil = 0;
  function say(who, face, text) {
    queue.push({ who, face, text });
    if (queue.length > 3) queue.shift(); // old lines give way to new events
  }
  const bull = (face, text) => say("bull", face, text);
  const man = (text) => say("man", null, text);
  const bear = (text) => say("bear", null, text);
  function sayNow(who, face, text) {
    queue.length = 0;
    talkUntil = 0;
    say(who, face, text);
  }
  function runTalk(now) {
    if (now < talkUntil) return;
    const line = queue.shift();
    if (!line) { $("talk").hidden = true; return; }
    $("talk").hidden = false;
    $("talk").classList.toggle("man", line.who === "man");
    $("talk").classList.toggle("bear", line.who === "bear");
    $("talk-face").hidden = line.who !== "bull";
    if (line.who === "bull") $("talk-face").src = `assets/face-${line.face}.png`;
    const label = { man: "Notice from the Man: ", bear: `${BEAR}: `, bull: "" }[line.who];
    $("talk-text").textContent = label + line.text;
    talkUntil = now + Math.max(2600, line.text.length * 62);
  }

  /* One-off story beats. Each fires once and is remembered in the save. */
  const BEATS = [
    { id: "start", when: () => true, run: () => bull("calm", "Grass. Today's plan is grass.") },
    { id: "fence", when: () => s.belly >= 32, run: () => bull("suspicious", "What's past that fence, I wonder?") },
    { id: "full", when: () => s.belly >= 64, run: () => bull("nervous", "Is grass all there is?") },
    { id: "work", when: () => s.belly >= 100, run: putToWork },
    { id: "firstpay", when: () => s.furrows >= 1, run: () => bull("shocked", "One pound?! I ploughed that whole furrow!") },
    { id: "helper", when: () => (s.helpers.chicken || 0) >= 1, run: () => bull("laughing", "The chickens have joined the workforce.") },
    { id: "fair", when: () => E.cut(s) <= 0.75, run: () => man("Union activity will be noted on your file.") },
    { id: "wobble", when: () => E.cut(s) <= 0.6, run: () => man("Productivity targets remain unchanged.") },
    { id: "paper", when: () => E.paperIsHere(s), run: sendPaper },
    { id: "freedom", when: () => E.netWorth(s) >= E.FREEDOM_NUMBER, run: reachFreedom },
  ];
  function runBeats() {
    for (const b of BEATS) {
      if (!s.beats.includes(b.id) && b.when()) {
        s.beats.push(b.id);
        b.run();
      }
    }
  }

  function putToWork() {
    sayNow("man", null, "Grazing is theft. All bulls report to the field.");
    setTimeout(() => {
      E.startWork(s);
      man("Pay is £10 a furrow, minus management's 90% cut.");
      bull("shocked", "Ninety?!");
      man("Hit your quota before you go near the barn.");
      syncScene();
      save();
    }, 2800);
  }

  function sendPaper() {
    bull("suspicious", "What's that blowing across the field?");
    $("paper").hidden = false;
  }

  function reachFreedom() {
    openPaper("Special edition", "Bull buys the farm", `With ${money(E.netWorth(s))} behind him, a local bull has made the Man an offer he cannot refuse. Sources say the bull is already reviewing the chickens' pay.`, "You reached your freedom number. Prestige comes in a later update.");
  }

  /* The farm */
  const TUFT = `<svg class="tuft" viewBox="0 0 44 40" aria-hidden="true"><path d="M4 38 C6 24 8 16 12 8 C14 18 16 22 18 26 C18 16 20 8 24 2 C26 14 27 20 29 26 C31 18 34 12 40 8 C37 20 38 30 40 38Z" fill="#3F8F2A" stroke="#1B0F08" stroke-width="3" stroke-linejoin="round"/></svg>`;
  function plantTufts() {
    const box = $("tufts");
    for (let i = 0; i < 6; i++) box.insertAdjacentHTML("beforeend", TUFT);
    [...box.children].forEach((t, i) => { t.style.left = `${3 + i * 5.2}%`; });
  }
  function chomp() {
    const left = [...$("tufts").children].filter((t) => !t.classList.contains("eaten"));
    if (!left.length) return;
    const tuft = left[Math.floor(Math.random() * left.length)];
    tuft.classList.add("eaten");
    setTimeout(() => tuft.classList.remove("eaten"), 900);
  }

  const HELPER_ART = {
    chicken: `<svg viewBox="0 0 46 46"><path d="M8 28 C8 16 20 12 28 18 L28 10 C30 4 40 6 38 14 L44 16 L38 20 C40 34 28 42 18 40 C12 39 8 34 8 28Z" fill="#fff" stroke="#1B0F08" stroke-width="3" stroke-linejoin="round"/><circle cx="33" cy="12" r="2" fill="#1B0F08"/><path d="M29 6 L32 2 L35 6" fill="#D4321C" stroke="#1B0F08" stroke-width="2"/></svg>`,
    sheep: `<svg viewBox="0 0 46 46"><path d="M12 38 V44 M32 38 V44" stroke="#1B0F08" stroke-width="4"/><path d="M6 26 C2 16 14 8 22 12 C30 6 44 14 40 26 C44 36 32 42 24 38 C16 42 2 36 6 26Z" fill="#F7F3E8" stroke="#1B0F08" stroke-width="3"/><ellipse cx="9" cy="24" rx="7" ry="9" fill="#2B1D12" stroke="#1B0F08" stroke-width="2"/><circle cx="7" cy="22" r="1.8" fill="#fff"/></svg>`,
    goat: `<svg viewBox="0 0 46 46"><path d="M14 36 V44 M34 36 V44" stroke="#1B0F08" stroke-width="4"/><path d="M12 16 C20 12 36 14 40 24 C42 34 30 38 20 38 C12 38 10 26 12 16Z" fill="#E8E2D4" stroke="#1B0F08" stroke-width="3" stroke-linejoin="round"/><path d="M14 18 L4 20 L8 30 C12 30 15 26 15 22Z" fill="#E8E2D4" stroke="#1B0F08" stroke-width="3" stroke-linejoin="round"/><path d="M10 15 L16 3 M14 16 L22 5" stroke="#1B0F08" stroke-width="3"/><path d="M6 30 L7 38" stroke="#1B0F08" stroke-width="3"/><circle cx="9" cy="23" r="1.8" fill="#1B0F08"/></svg>`,
    tractor: `<svg viewBox="0 0 72 58"><path d="M6 22 H34 V8 H56 V36 H6Z" fill="#D4321C" stroke="#1B0F08" stroke-width="3" stroke-linejoin="round"/><path d="M40 13 H51 V24 H40Z" fill="#7FD0F0" stroke="#1B0F08" stroke-width="3"/><circle cx="50" cy="42" r="14" fill="#2B1D12" stroke="#1B0F08" stroke-width="3"/><circle cx="50" cy="42" r="5" fill="#FFC72C"/><circle cx="16" cy="46" r="10" fill="#2B1D12" stroke="#1B0F08" stroke-width="3"/><circle cx="16" cy="46" r="3.5" fill="#FFC72C"/></svg>`,
  };
  // Each plot's area on the hillside: left, top, width and height, in %.
  const PLOTS = {
    chicken: [3, 26, 24, 14], sheep: [30, 25, 26, 14],
    goat: [2, 43, 16, 10], tractor: [46, 44, 18, 12],
  };
  const SHOWN = { chicken: 6, sheep: 5, goat: 4, tractor: 2 };
  function drawHelpers() {
    let html = "";
    for (const h of E.HELPERS) {
      const count = s.helpers[h.id] || 0;
      $(`plot-${h.id}-land`).classList.toggle("open", count > 0);
      const shown = Math.min(count, SHOWN[h.id]);
      const [left, top, width, height] = PLOTS[h.id];
      for (let i = 0; i < shown; i++) {
        const x = left + ((i * 37) % 100) / 100 * (width - 12);
        const y = top + ((i * 61) % 100) / 100 * (height - 8);
        html += `<div class="helper" data-kind="${h.id}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;animation-delay:-${(i * 0.21).toFixed(2)}s">${HELPER_ART[h.id]}</div>`;
      }
    }
    const box = $("helpers");
    if (box.dataset.html !== html) { box.dataset.html = html; box.innerHTML = html; }
  }
  function buildPlots() {
    for (const id of ["chicken", "sheep", "goat", "tractor"]) {
      const el = document.createElement("div");
      el.dataset.plot = id;
      $("plots").append(el);
    }
  }
  // A tap on a plot still ploughs, and shows that plot's figures now and then.
  let plotShown = "";
  let plotUntil = 0;
  function showPlot(id) {
    const n = s.helpers[id] || 0;
    const now = performance.now();
    if (!n || (id === plotShown && now < plotUntil)) return;
    plotShown = id;
    plotUntil = now + 8000;
    const h = E.HELPERS.find((x) => x.id === id);
    sayNow("bull", "calm", `${h.name}: ${n} working, ${perSecond(h.work * E.payPerWork(s))} each, ${perSecond(E.helperIncome(s, h))} in all.`);
  }

  function floatText(x, y, text, lost) {
    if (calm && lost) return;
    const el = document.createElement("span");
    x += Math.random() * 56 - 28;
    y += Math.random() * 28 - 14;
    el.className = "float" + (lost ? " lost" : "");
    el.textContent = text;
    const width = $("scene").clientWidth;
    el.style.left = `${Math.max(6, Math.min(x, width - 110))}px`;
    el.style.top = `${y}px`;
    $("floats").append(el);
    el.addEventListener("animationend", () => el.remove());
  }

  function kick(el, frames, ms) {
    if (!calm) el.animate(frames, { duration: ms, easing: "ease-out" });
  }
  const BULL_X = "translateX(-50%)";
  function chompAnimation() {
    kick($("bull"), [
      { transform: `${BULL_X} rotate(0)` },
      { transform: `${BULL_X} rotate(-13deg) translateY(10px) scale(1.04,.94)` },
      { transform: `${BULL_X} rotate(0)` },
    ], 190);
  }
  function pullAnimation() {
    kick($("bull"), [
      { transform: `${BULL_X} scale(1,1)` },
      { transform: `${BULL_X} translateX(-10px) rotate(-5deg) scale(1.1,.9)` },
      { transform: `${BULL_X} scale(1,1)` },
    ], 170);
  }

  let pose = "side";
  let poseUntil = 0;
  function setPose(name) {
    if (pose === name) return;
    pose = name;
    $("bull").src = `assets/bull-${name}.png`;
  }
  function flashPose(name, ms) {
    setPose(name);
    poseUntil = performance.now() + ms;
  }

  /* Tapping */
  let groundSpeed = 0;
  let groundX = 0;
  function onTap(e) {
    if (e.target.closest("button") || s.phase === "night") return;
    $("hint").hidden = true;
    const box = $("scene").getBoundingClientRect();
    const x = e.clientX - box.left;
    const y = e.clientY - box.top - 26;
    if (s.stage === 1) {
      if (s.belly >= 100) return;
      E.bite(s);
      chomp();
      chompAnimation();
      floatText(x, y, "Munch");
    } else {
      const paid = E.plough(s);
      groundSpeed = Math.min(groundSpeed + 240, 900);
      pullAnimation();
      floatText(x, y, "+" + money(paid.kept));
      const plot = e.target.closest("[data-plot]");
      if (plot) showPlot(plot.dataset.plot);
      if (s.taps % 4 === 0) floatText(x + 30, y + 22, `Man +${money(paid.took)}`, true);
    }
    render();
  }

  /* Lucky clover */
  let cloverAt = 25;
  let cloverGone = Infinity;
  function runClover() {
    const el = $("clover");
    if (s.stage < 2 || s.phase === "night") return;
    if (el.hidden && s.clock >= cloverAt) {
      el.style.left = `${8 + Math.random() * 62}%`;
      el.style.top = `${30 + Math.random() * 34}%`;
      el.hidden = false;
      cloverGone = s.clock + 8;
    } else if (!el.hidden && s.clock >= cloverGone) {
      hideClover();
    }
  }
  function hideClover() {
    $("clover").hidden = true;
    cloverGone = Infinity;
    cloverAt = s.clock + 35 + Math.random() * 35;
  }
  function onClover() {
    const r = $("clover").getBoundingClientRect();
    const box = $("scene").getBoundingClientRect();
    const prize = E.pickClover(s, Math.random());
    floatText(r.left - box.left, r.top - box.top, prize.kind === "double" ? "Pay doubled" : "+" + money(prize.amount));
    flashPose("cheer", 1500);
    bull("laughing", prize.kind === "double" ? "Lucky clover! Double pay for 20 seconds." : "Lucky clover! Someone dropped this.");
    hideClover();
    render();
  }

  /* Newspaper */
  function openPaper(label, headline, body, bonus) {
    $("sheet-issue").textContent = label;
    $("sheet-headline").textContent = headline;
    $("sheet-body").textContent = body;
    $("sheet-bonus").textContent = bonus || "";
    $("sheet-bonus").hidden = !bonus;
    $("sheet-close").textContent = s.phase === "night" ? "Back to the barn" : "Back to the field";
    $("reader").hidden = false;
    $("sheet-close").focus({ preventScroll: true });
  }
  function onPaper() {
    E.findPaper(s);
    $("paper").hidden = true;
    openPaper("Free sample", "Who really owns the field?", "Landowners hold assets, and assets pay them. If you are reading this in a field, you may be one of the assets.", "Take the paper to the barn. Later issues are for sale there.");
    bull("suspicious", "The Man's been keeping this from me.");
    render();
    save();
  }

  /* Day and night */
  function goToBarn() {
    if (!E.goToBarn(s, Math.random)) return;
    tab = "main";
    hideClover();
    $("reader").hidden = true;
    sayNow("bull", "sad", s.day === 1 ? "So this is where they keep me. Could be worse." : "Quota done. Hooves up.");
    if (s.issues >= 1 && !s.bearMet) {
      $("door").hidden = false;
      bull("suspicious", "Something moved behind that back door.");
    }
    syncScene();
    render();
    save();
  }
  function sleep() {
    const out = E.sleep(s, Math.random);
    if (!out) return;
    tab = "main";
    syncScene();
    render();
    save();
    man(`Day ${s.day} quota: ${s.quota} furrows.`);
    if (!out.results.length) return;
    const change = out.results.reduce((sum, r) => sum + r.after - r.before, 0);
    const lines = out.results.map((r) => `${r.name}: ${r.wiped ? "liquidated, position lost" : `${percent(r.move)} moved your position to ${money(r.after)}`}`);
    openPaper(`Morning edition, day ${s.day}`, change >= 0 ? `Your money earned ${money(change)} overnight` : `Your money lost ${money(-change)} overnight`, lines.join("\n"), s.leverage > 1 ? `Leverage used: ${s.leverage}×` : "");
    if (change >= 0) bull("greedy", "I was asleep the whole time.");
    else bull("sad", "I was asleep the whole time.");
  }
  function openDoor() {
    if (!E.meetBear(s)) return;
    $("door").hidden = true;
    syncScene();
    sayNow("bear", null, `Name's ${BEAR}. I run the back door of this barn.`);
    bear("You work all day and keep pennies. Want to learn how real money moves?");
    render();
    save();
  }
  function doFlip(share) {
    const out = E.flip(s, share, Math.random);
    if (!out) return;
    sayNow("bear", null, out.win ? `Heads. You won ${money(out.stake)}. Beginner's luck.` : `Tails. You lost ${money(out.stake)}. The bear thanks you.`);
    render();
    save();
  }

  /* The menu is a list of rows, rebuilt only when its structure changes. */
  function revealed(id, cost) {
    const key = "shop-" + id;
    if (s.beats.includes(key)) return true;
    if (s.lifetime >= cost * 0.45) { s.beats.push(key); return true; }
    return false;
  }
  function shopRows() {
    const rows = [];
    if (s.quotaMet) {
      rows.push({ key: "go", kind: "go", name: "Go to the barn", note: `Quota met. Overtime pays ${Math.round(E.OVERTIME_PAY * 100)}%.`, buy: goToBarn, cost: 0, label: "Clock off" });
    }
    const r = E.nextRebellion(s);
    if (r && E.canSeeRebellion(s, r) && revealed(r.id, r.cost)) {
      const boost = (1 - r.cut) / (1 - E.cut(s));
      rows.push({
        key: r.id, kind: "rebel", name: r.name, note: r.note, gain: `His cut falls to ${Math.round(r.cut * 100)}%. Your pay × ${boost.toFixed(2)}`, cost: r.cost,
        buy: () => {
          if (!E.buyRebellion(s, r.id)) return;
          bull(r.face, r.line);
          flashPose("hero", 2200);
        },
      });
    }
    const tapPay = E.tapWork(s) * E.payPerWork(s);
    rows.push({
      key: "plough", name: E.PLOUGH.name, count: s.plough, note: E.PLOUGH.note,
      gain: `+${money(E.PLOUGH.work * E.payPerWork(s))} a tap. Now ${money(tapPay)} a tap`,
      cost: E.costOfPlough(s), buy: () => E.buyPlough(s),
    });
    for (const h of E.HELPERS) {
      if (!revealed(h.id, h.cost)) continue;
      const each = h.work * E.payPerWork(s);
      rows.push({
        key: h.id, name: h.name, count: s.helpers[h.id] || 0, note: h.note,
        gain: `+${perSecond(each)} each. Now ${perSecond(E.helperIncome(s, h))}`,
        cost: E.costOfHelper(s, h), buy: () => E.buyHelper(s, h.id),
      });
    }
    return rows;
  }
  const MOOD_LINES = {
    bull: "Tonight's paper: farmers are feeling confident.",
    bear: "Tonight's paper: nervous mutterings at the market.",
  };
  function barnRows() {
    const r = s.report;
    const rows = [{
      key: "sleep", kind: "go", name: `Sleep until day ${s.day + 1}`, note: `Day ${r.day}: ${r.furrows} furrows. You kept ${money(r.earned)}. The Man took ${money(r.took)}.`,
      buy: sleep, cost: 0, label: "Sleep",
    }];
    const issue = E.ISSUES[s.issues];
    if (s.stage >= 3 && issue) {
      const n = s.issues + 1;
      rows.push({
        key: "issue" + n, kind: "news", name: `Read issue ${n} of ${E.ISSUES.length}`, note: "The headline stays secret until you buy it.", gain: `All pay × ${issue.bonus}`, cost: issue.cost,
        buy: () => {
          if (!E.readIssue(s)) return;
          openPaper(`Issue ${s.issues} of ${E.ISSUES.length}`, issue.headline, issue.body, `Lesson learned: all pay × ${issue.bonus}`);
          if (s.issues === 1 && !s.bearMet) {
            $("door").hidden = false;
            bull("suspicious", "Something moved behind that back door.");
          }
        },
      });
    }
    if (s.stage < 3) rows.push({ key: "empty", info: true, name: "Nothing to do but sleep", note: "The barn feels bigger than this. Keep earning." });
    if (!s.bearMet) return rows;
    rows.push({ key: "h-flip", heading: `${BEAR}'s coin` });
    rows.push({
      key: "flip", kind: "bear", info: true, name: "Double or nothing", note: `${s.flipsLeft} flip${s.flipsLeft === 1 ? "" : "s"} left tonight. ${Math.round(E.FLIP_WIN_CHANCE * 100)}% to win.`,
      actions: [[0.1, "10%"], [0.5, "50%"], [1, "All of it"]].map(([share, label]) => ({ label: `Bet ${label}`, off: s.flipsLeft < 1 || s.money <= 0, run: () => doFlip(share) })),
    });
    const open = E.ASSETS.filter((a) => E.assetUnlocked(s, a.id));
    if (open.length) {
      rows.push({ key: "h-market", heading: `Market: ${MOOD_LINES[s.market.hint]}` });
      const levels = E.leverageOptions(s);
      if (levels.length > 1) {
        rows.push({
          key: "lev", kind: "bear", info: true, name: "Leverage", note: "Multiplies your gains and your losses. A big enough drop wipes out the position.",
          actions: levels.map((x) => ({ label: `${x}×`, on: s.leverage === x, run: () => E.setLeverage(s, x) })),
        });
      }
      for (const a of open) {
        const held = s.positions[a.id] || 0;
        rows.push({
          key: "asset-" + a.id, kind: "bear", info: true, name: a.name, note: `${a.note} Held: ${money(held)}`,
          actions: [
            { label: "Buy 25%", off: s.money <= 0, run: () => E.invest(s, a.id, 0.25) },
            { label: "Buy all", off: s.money <= 0, run: () => E.invest(s, a.id, 1) },
            { label: "Sell", off: !held, run: () => E.sell(s, a.id) },
          ],
        });
      }
    }
    const lesson = E.nextLesson(s);
    if (lesson) {
      rows.push({ key: "h-lesson", heading: `${BEAR}'s next lesson` });
      rows.push({
        key: "lesson-" + lesson.id, kind: "bear", name: lesson.name, note: lesson.note, cost: lesson.cost,
        buy: () => { if (E.buyLesson(s)) sayNow("bear", null, lesson.line); },
      });
    }
    return rows;
  }
  function statRows() {
    const income = E.incomePerSecond(s);
    const earned = Object.values(s.earnedBy).reduce((a, b) => a + b, 0) || 1;
    const rows = [{ key: "h-income", heading: "Where your money comes from" }];
    const source = (key, name, count, rate) => {
      const total = s.earnedBy[key] || 0;
      rows.push({ key: "stat-" + key, stat: true, name, count, value: rate, sub: `${money(total)} earned so far`, share: total / earned });
    };
    source("bull", "You, tapping", null, `${money(E.tapWork(s) * E.payPerWork(s))} a tap`);
    for (const h of E.HELPERS) {
      if (s.helpers[h.id] || s.earnedBy[h.id]) source(h.id, h.name, s.helpers[h.id] || 0, perSecond(E.helperIncome(s, h)));
    }
    if (s.earnedBy.clover) source("clover", "Lucky clovers", null, "");
    rows.push({ key: "h-pay", heading: "How your pay is worked out" });
    rows.push({ key: "stat-gross", stat: true, name: "Base pay", value: "£10 a furrow" });
    rows.push({ key: "stat-cut", stat: true, name: "The Man's cut", value: `-${Math.round(E.cut(s) * 100)}%` });
    if (s.issues) rows.push({ key: "stat-news", stat: true, name: "Newspaper lessons", value: `× ${E.issueBonus(s)}` });
    if (s.quotaMet && s.phase === "day") rows.push({ key: "stat-ot", stat: true, name: "Overtime", value: `× ${E.OVERTIME_PAY}` });
    rows.push({ key: "h-life", heading: "Your career" });
    rows.push({ key: "stat-day", stat: true, name: "Days worked", value: String(s.day) });
    rows.push({ key: "stat-furrows", stat: true, name: "Furrows ploughed", value: s.furrows.toLocaleString("en-GB") });
    rows.push({ key: "stat-rate", stat: true, name: "Helpers earn", value: perSecond(income) });
    rows.push({ key: "stat-man", stat: true, name: "The Man has taken", value: money(s.manTook) });
    rows.push({ key: "stat-worth", stat: true, name: "Your net worth", value: money(E.netWorth(s)) });
    if (s.bearMet) {
      rows.push({ key: "stat-flips", stat: true, name: "Coin flips won and lost", value: `${s.flipsWon} and ${s.flipsLost}` });
      rows.push({ key: "stat-portfolio", stat: true, name: "Invested", value: money(E.portfolioValue(s)) });
      rows.push({ key: "stat-wiped", stat: true, name: "Positions wiped out", value: String(s.liquidations) });
    }
    return rows;
  }
  const currentRows = () => (tab === "stats" ? statRows() : s.phase === "night" ? barnRows() : shopRows());

  function makeRow(row) {
    if (row.heading) {
      const h = document.createElement("h3");
      h.className = "heading";
      return h;
    }
    if (row.stat) {
      const el = document.createElement("div");
      el.className = "stat";
      el.innerHTML = `<b></b><span></span><small></small>${row.share === undefined ? "" : '<div class="share"><i></i></div>'}`;
      return el;
    }
    const el = document.createElement(row.info ? "div" : "button");
    if (!row.info) {
      el.type = "button";
      el.addEventListener("click", () => {
        const fresh = rowsNow.find((r) => r.key === row.key);
        if (!fresh) return;
        fresh.buy();
        render();
        save();
      });
    }
    el.className = "item" + (row.kind ? " " + row.kind : "");
    el.innerHTML = `<span><b></b><small class="note"></small><small class="gain"></small></span><span class="price"></span>`;
    if (row.actions) {
      const bar = document.createElement("div");
      bar.className = "actions";
      row.actions.forEach((a, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.addEventListener("click", () => {
          const fresh = rowsNow.find((r) => r.key === row.key);
          if (!fresh) return;
          fresh.actions[i].run();
          render();
          save();
        });
        bar.append(b);
      });
      el.append(bar);
    }
    return el;
  }
  function fillRow(el, row) {
    if (row.heading) { el.textContent = row.heading; return; }
    if (row.stat) {
      el.querySelector("b").textContent = row.name + (row.count === null || row.count === undefined ? "" : ` × ${row.count}`);
      el.querySelector("span").textContent = row.value;
      el.querySelector("small").textContent = row.sub || "";
      el.querySelector("small").hidden = !row.sub;
      if (row.share !== undefined) el.querySelector("i").style.width = (row.share * 100).toFixed(1) + "%";
      return;
    }
    const name = el.querySelector("b");
    name.textContent = row.name;
    if (row.count) name.insertAdjacentHTML("beforeend", ` <em>× ${row.count}</em>`);
    el.querySelector(".note").textContent = row.note || "";
    el.querySelector(".gain").textContent = row.gain || "";
    el.querySelector(".gain").hidden = !row.gain;
    const price = el.querySelector(".price");
    price.textContent = row.label || (row.cost ? money(row.cost) : "");
    if (!row.info) el.disabled = s.money < (row.cost || 0);
    if (row.actions) {
      [...el.querySelector(".actions").children].forEach((b, i) => {
        const a = row.actions[i];
        b.textContent = a.label;
        b.disabled = !!a.off;
        b.classList.toggle("on", !!a.on);
      });
    }
  }
  let rowsNow = [];
  let rowShape = "";
  function renderRows() {
    rowsNow = currentRows();
    const shape = rowsNow.map((r) => r.key + (r.actions ? r.actions.length : "")).join("|");
    const box = $("rows");
    if (shape !== rowShape) {
      rowShape = shape;
      box.textContent = "";
      rowsNow.forEach((r) => box.append(makeRow(r)));
    }
    rowsNow.forEach((r, i) => fillRow(box.children[i], r));
  }
  function setTab(next) {
    tab = next;
    $("tab-main").classList.toggle("on", tab === "main");
    $("tab-stats").classList.toggle("on", tab === "stats");
    $("panel-inner").scrollTop = 0;
    render();
  }

  function syncScene() {
    const app = $("app");
    const night = s.phase === "night";
    app.classList.toggle("night", night);
    app.classList.toggle("stage-1", s.stage === 1);
    app.classList.toggle("stage-2", s.stage === 2);
    app.classList.toggle("stage-3", s.stage === 3);
    app.classList.toggle("has-panel", s.stage >= 2);
    $("panel").hidden = s.stage < 2;
    $("purse").hidden = s.stage < 2;
    $("cut-sign").hidden = s.stage < 2;
    $("quota").hidden = s.stage < 2 || night;
    $("barn").hidden = !night;
    $("bear").toggleAttribute("hidden", !night || !s.bearMet); // SVGs have no .hidden property
    $("door").hidden = !night || s.bearMet || s.issues < 1;
    $("barn-bull").src = s.paperFound ? "assets/bull-read.png" : "assets/bull-shrug.png";
    $("scene").setAttribute("aria-label", night ? "Inside the barn at night." : "The field. Tap to work.");
    $("tab-main").textContent = night ? "Barn" : "Shop";
  }

  function mix(a, b, t) {
    return a.map((v, i) => Math.round(v + (b[i] - v) * t));
  }
  const SKY_DAY = [127, 208, 240];
  const SKY_DUSK = [255, 150, 92];
  function renderDay() {
    const p = s.stage === 1 ? 0.2 : E.dayProgress(s);
    const t = Math.max(0, (p - 0.65) / 0.35);
    const [r, g, b] = mix(SKY_DAY, SKY_DUSK, t);
    $("scene").style.backgroundColor = `rgb(${r},${g},${b})`;
    $("sun").style.left = `${10 + p * 62}%`;
    $("sun").style.top = `${24 - Math.sin(p * Math.PI) * 16 + t * 18}%`;
  }

  function render() {
    $("belly-fill").style.width = s.belly + "%";
    $("belly").setAttribute("aria-valuenow", String(s.belly));
    renderDay();
    $("app").classList.toggle("quota-met", s.quotaMet && s.phase === "day");
    if (s.stage < 2) return;
    $("money").textContent = money(s.money);
    $("money").classList.toggle("doubled", s.clock < s.doubleUntil);
    const rate = E.incomePerSecond(s);
    $("rate").hidden = false;
    $("rate").textContent = s.phase === "night" ? `Night ${s.day}` : rate > 0 ? `${perSecond(rate)}, day ${s.day}` : `Day ${s.day}`;
    $("cut").textContent = Math.round(E.cut(s) * 100) + "%";
    $("quota-fill").style.width = E.dayProgress(s) * 100 + "%";
    $("quota-label").textContent = s.quotaMet ? `Quota met: ${s.dayFurrows} of ${s.quota} furrows` : `Today's quota: ${s.dayFurrows} of ${s.quota} furrows`;
    $("freedom").hidden = s.stage < 3;
    if (s.stage >= 3) {
      const worth = E.netWorth(s);
      $("freedom-label").textContent = `Freedom: ${money(worth)} of ${money(E.FREEDOM_NUMBER)}`;
      $("freedom-fill").style.width = Math.min(100, (worth / E.FREEDOM_NUMBER) * 100) + "%";
    }
    renderRows();
  }

  /* Main loop */
  let last = performance.now();
  let lastRender = 0;
  let pending = 0;
  let pendingAt = 0;
  let tired = false;
  function frame(now) {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    const wasMet = s.quotaMet;
    const made = E.tick(s, dt);
    pending += made.kept;
    runBeats();
    runClover();
    runTalk(now);
    if (s.phase === "day" && s.stage >= 2) {
      if (!tired && E.dayProgress(s) > 0.75) {
        tired = true;
        bull("nervous", "Legs going. Nearly there.");
      }
      if (s.quotaMet && !wasMet) {
        sayNow("bull", "sad", "I can't feel my hooves.");
        man("Quota met. Barn access granted. Overtime available.");
        render();
        save();
      }
    } else tired = false;

    if (s.stage >= 2 && s.phase === "day") {
      const auto = s.quotaMet ? 0 : Math.min(420, Math.sqrt(E.helperWork(s)) * 40);
      groundSpeed = Math.max(auto, groundSpeed * Math.pow(0.04, dt));
      groundX += groundSpeed * dt;
      $("ground").style.backgroundPositionX = `${groundX.toFixed(1)}px`;
      if (pending >= 0.01 && now - pendingAt > 1100) {
        const box = $("scene");
        floatText(box.clientWidth * 0.1, box.clientHeight * 0.55, "+" + money(pending));
        pending = 0;
        pendingAt = now;
      }
      if (now > poseUntil) setPose(s.stage >= 3 && !s.quotaMet && groundSpeed > 200 ? "run" : "side");
    }
    if (now - lastRender > 120) {
      lastRender = now;
      render();
    }
    requestAnimationFrame(frame);
  }

  function start(saved) {
    s = E.load(saved ?? readSave());
    if (s.beats.includes("work")) E.startWork(s); // saved mid-arrival
    plantTufts();
    buildPlots();
    if (s.taps > 0) $("hint").hidden = true;
    if (E.paperIsHere(s) && s.beats.includes("paper")) $("paper").hidden = false;
    syncScene();
    drawHelpers();
    render();
    $("scene").addEventListener("pointerdown", onTap);
    $("clover").addEventListener("click", onClover);
    $("paper").addEventListener("click", onPaper);
    $("door").addEventListener("click", openDoor);
    $("tab-main").addEventListener("click", () => setTab("main"));
    $("tab-stats").addEventListener("click", () => setTab("stats"));
    $("sheet-close").addEventListener("click", () => { $("reader").hidden = true; });
    let armed = false;
    $("reset").addEventListener("click", (e) => {
      if (!armed) {
        armed = true;
        e.currentTarget.textContent = "Tap again to erase your save";
        return;
      }
      s = E.newGame();
      save();
      location.reload();
    });
    setInterval(save, 5000);
    setInterval(drawHelpers, 500);
    addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
    requestAnimationFrame(frame);
  }

  // When a new build reaches an open artefact, carry on from the same save.
  const hot = window.claude?.hot;
  try { hot?.snapshot?.(() => ({ save: JSON.stringify(s) })); } catch (e) { /* not in a viewer */ }
  if (hot?.ready) hot.ready((data) => start(data?.save));
  else start(hot?.data?.save);
})();
