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
  let tab = "farm";
  let chart = "worth";

  /* Saving. Storage can be blocked, so the game must still run without it. */
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* no storage here */ }
  }
  function readSave() {
    try { return localStorage.getItem(SAVE_KEY); } catch (e) { return null; }
  }

  /* Numbers */
  function short(n, digits) {
    return n.toFixed(digits).replace(/\.?0+$/, "");
  }
  function money(n) {
    const sign = n < 0 ? "-" : "";
    n = Math.abs(n);
    if (n < 1000) return sign + "£" + (n < 100 ? n.toFixed(2) : n.toFixed(0));
    if (n < 1e6) return sign + "£" + short(n / 1e3, n < 1e4 ? 2 : n < 1e5 ? 1 : 0) + "k";
    if (n < 1e9) return sign + "£" + short(n / 1e6, 2) + "M";
    return sign + "£" + short(n / 1e9, 2) + "B";
  }
  const count = (n) => (n < 1000 ? String(n) : n < 1e6 ? short(n / 1e3, 1) + "k" : short(n / 1e6, 2) + "M");
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

  /* The farm */
  const TUFT = `<span class="tuft">🌿</span>`;
  function plantTufts() {
    const box = $("tufts");
    for (let i = 0; i < 6; i++) box.insertAdjacentHTML("beforeend", TUFT);
    [...box.children].forEach((t, i) => { t.style.left = `${4 + i * 9}%`; });
  }
  function chomp() {
    const left = [...$("tufts").children].filter((t) => !t.classList.contains("eaten"));
    if (!left.length) return;
    const tuft = left[Math.floor(Math.random() * left.length)];
    tuft.classList.add("eaten");
    setTimeout(() => tuft.classList.remove("eaten"), 900);
  }

  const EMOJI = { chicken: "🐔", sheep: "🐑", goat: "🐐", tractor: "🚜" };
  // Up to three show as a row. After that it reads as a count, such as 4🐑.
  function herd(id) {
    const n = s.helpers[id] || 0;
    return n <= 3 ? EMOJI[id].repeat(n) : count(n) + EMOJI[id];
  }
  function drawHelpers() {
    for (const h of E.HELPERS) {
      $(`plot-${h.id}-land`).classList.toggle("open", (s.helpers[h.id] || 0) > 0);
      const el = $("plots").querySelector(`[data-plot="${h.id}"]`);
      const text = herd(h.id);
      if (el.textContent !== text) el.innerHTML = text ? `<span style="animation-delay:-${E.HELPERS.indexOf(h) * 0.2}s">${text}</span>` : "";
    }
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
  let moodTimer = 0;
  function setMood(mood, ms) {
    clearTimeout(moodTimer);
    $("bear").setAttribute("data-mood", mood);
    if (ms) moodTimer = setTimeout(() => $("bear").setAttribute("data-mood", "neutral"), ms);
  }
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
    tab = "barn";
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
    tab = "farm";
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
  let flipping = false;
  function doFlip(share) {
    if (flipping) return;
    flipping = true;
    setMood("lean");
    sayNow("bear", null, "Heads or tails, kid. Coin's in the air.");
    setTimeout(() => {
      flipping = false;
      const out = E.flip(s, share, Math.random);
      if (!out) { setMood("neutral"); return; }
      if (out.win) {
        setMood("shock", 1800);
        flashBarnBull("cheer");
        sayNow("bear", null, `Heads. You won ${money(out.stake)}. Beginner's luck.`);
      } else {
        setMood("gloat", 1800);
        flashBarnBull("shrug");
        sayNow("bear", null, `Tails. You lost ${money(out.stake)}. The bear thanks you.`);
      }
      render();
      save();
    }, 800);
  }
  let barnBullTimer = 0;
  function barnBull() { return s.paperFound ? "read" : "shrug"; }
  function flashBarnBull(pose) {
    clearTimeout(barnBullTimer);
    $("barn-bull").src = `assets/bull-${pose}.png`;
    barnBullTimer = setTimeout(() => { $("barn-bull").src = `assets/bull-${barnBull()}.png`; }, 1800);
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
    bull: "📈 Farmers are feeling confident. Markets look likely to rise.",
    bear: "📉 Nervous mutterings at the market. Prices look likely to fall.",
  };
  const tipRow = () => ({ key: "tip", kind: "tip", info: true, name: "🗞️ Tonight's paper", note: `${MOOD_LINES[s.market.hint]} It's right about four times in five.` });
  function barnRows() {
    if (s.phase === "day") {
      const r = s.report;
      const rows = [{ key: "locked", info: true, name: "🔒 Locked until you meet the quota", note: `${count(s.dayFurrows)} of ${count(s.quota)} furrows done today.` }];
      if (r) rows.push({ key: "last", info: true, name: `Day ${r.day} report`, note: `You kept ${money(r.earned)}. The Man took ${money(r.took)}.` });
      return rows;
    }
    const r = s.report;
    const rows = [{ key: "report", info: true, name: `Day ${r.day} report`, note: `${count(r.furrows)} furrows. You kept ${money(r.earned)}. The Man took ${money(r.took)}.` }];
    if (s.paperFound) rows.push(tipRow());
    const issue = E.ISSUES[s.issues];
    if (s.stage >= 3 && issue) {
      const n = s.issues + 1;
      rows.push({
        key: "issue" + n, kind: "news", name: `📰 Read issue ${n} of ${E.ISSUES.length}`, note: "The headline stays secret until you buy it.", gain: `All pay × ${issue.bonus}`, cost: issue.cost,
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
    rows.push({
      key: "flip", kind: "bear", info: true, name: "🪙 Grizz's coin", note: `${s.flipsLeft} flip${s.flipsLeft === 1 ? "" : "s"} left tonight. ${Math.round(E.FLIP_WIN_CHANCE * 100)}% to win double.`,
      actions: [[0.1, "10%"], [0.5, "50%"], [1, "All"]].map(([share, label]) => ({ label: `Bet ${label}`, off: s.flipsLeft < 1 || s.money <= 0 || flipping, run: () => doFlip(share) })),
    });
    const lesson = E.nextLesson(s);
    if (lesson) {
      rows.push({
        key: "lesson-" + lesson.id, kind: "bear", name: `🐻 ${lesson.name}`, note: lesson.note, cost: lesson.cost,
        buy: () => { if (E.buyLesson(s)) { setMood("smug", 2200); sayNow("bear", null, lesson.line); syncScene(); } },
      });
    }
    return rows;
  }
  const ASSET_COLOURS = { index: "#3F8CEB", moo: "#BA861A", hay: "#E8528C" };
  function marketRows() {
    const night = s.phase === "night";
    const rows = [night ? tipRow() : { key: "closed", info: true, name: "🌙 Trading opens at night", note: "Prices update while you sleep." }];
    const open = E.ASSETS.filter((a) => E.assetUnlocked(s, a.id));
    if (!open.length) rows.push({ key: "none", info: true, name: "Nothing to trade yet", note: "Buy lessons from Grizz in the barn." });
    const levels = E.leverageOptions(s);
    if (levels.length > 1) {
      rows.push({
        key: "lev", kind: "bear", info: true, name: "Leverage", note: "Multiplies gains and losses. A big enough drop wipes out a position.",
        actions: levels.map((x) => ({ label: `${x}×`, on: s.leverage === x, cls: s.leverage === x ? "" : "off", off: !night, run: () => E.setLeverage(s, x) })),
      });
    }
    for (const a of open) {
      const held = s.positions[a.id] || 0;
      const net = s.assetNet[a.id] || 0;
      rows.push({
        key: "asset-" + a.id, info: true, name: `${a.name}`, note: `${a.note} Price ${s.assetPrice[a.id].toFixed(1)}.`,
        gain: held || net ? `Held ${money(held)}. Total return ${net >= 0 ? "+" : ""}${money(net)}` : "",
        actions: [
          { label: "Buy 25%", off: !night || s.money <= 0, run: () => E.invest(s, a.id, 0.25) },
          { label: "Buy all", off: !night || s.money <= 0, run: () => E.invest(s, a.id, 1) },
          { label: "Sell", off: !night || !held, run: () => E.sell(s, a.id) },
        ],
      });
    }
    if (open.length) {
      rows.push({ key: "h-px", heading: "Prices over time" });
      rows.push({ key: "chart-px", chart: "prices" });
    }
    return rows;
  }
  function chartOptions(id) {
    const h = s.history;
    const days = h.map((d) => d.d);
    const open = E.ASSETS.filter((a) => E.assetUnlocked(s, a.id) || h.some((d) => d.pos[a.id]));
    const one = (name, values, extra) => ({ days, format: money, series: [{ name, color: "#49D17D", values }], ...extra });
    if (id === "income") return one("You kept", h.map((d) => d.earned));
    if (id === "flips") return one("Flip returns", h.map((d) => d.flip), { zero: true });
    if (id === "portfolio") return one("Portfolio value", h.map((d) => d.port));
    if (id === "positions") {
      return { days, format: money, zero: true, series: open.map((a) => ({ name: a.name, color: ASSET_COLOURS[a.id], values: h.map((d) => d.pos[a.id] || 0) })) };
    }
    if (id === "prices") {
      return { days, format: (v) => v.toFixed(0), series: open.map((a) => ({ name: a.name, color: ASSET_COLOURS[a.id], values: h.map((d) => d.px[a.id]) })) };
    }
    return one("Net worth", h.map((d) => d.worth));
  }
  function statRows() {
    const earned = Object.values(s.earnedBy).reduce((a, b) => a + b, 0) || 1;
    const picks = [["worth", "Worth"], ["income", "Income"]];
    if (s.bearMet) picks.push(["flips", "Flips"]);
    if (s.lessons.includes("index")) picks.push(["positions", "Positions"], ["portfolio", "Portfolio"]);
    if (!picks.some(([id]) => id === chart)) chart = "worth";
    const rows = [
      { key: "chart-picks", kind: "picks", info: true, actions: picks.map(([id, label]) => ({ label, on: chart === id, cls: chart === id ? "" : "off", run: () => { chart = id; } })) },
      { key: "chart-stats-" + chart, chart },
      { key: "h-income", heading: "Where your money comes from" },
    ];
    const source = (key, name, n, rate) => {
      const total = s.earnedBy[key] || 0;
      rows.push({ key: "stat-" + key, stat: true, name, count: n, value: rate, sub: `${money(total)} earned so far`, share: total / earned });
    };
    source("bull", "🐂 You, tapping", null, `${money(E.tapWork(s) * E.payPerWork(s))} a tap`);
    for (const h of E.HELPERS) {
      if (s.helpers[h.id] || s.earnedBy[h.id]) source(h.id, `${EMOJI[h.id]} ${h.name}`, s.helpers[h.id] || 0, perSecond(E.helperIncome(s, h)));
    }
    if (s.earnedBy.clover) source("clover", "🍀 Lucky clovers", null, "");
    rows.push({ key: "h-pay", heading: "How your pay is worked out" });
    rows.push({ key: "stat-gross", stat: true, name: "Base pay", value: "£10 a furrow" });
    rows.push({ key: "stat-cut", stat: true, name: "👨‍🌾 The Man's cut", value: `-${Math.round(E.cut(s) * 100)}%` });
    if (s.issues) rows.push({ key: "stat-news", stat: true, name: "📰 Newspaper lessons", value: `× ${E.issueBonus(s)}` });
    if (s.quotaMet && s.phase === "day") rows.push({ key: "stat-ot", stat: true, name: "Overtime", value: `× ${E.OVERTIME_PAY}` });
    rows.push({ key: "h-life", heading: "Your career" });
    rows.push({ key: "stat-day", stat: true, name: "Days worked", value: String(s.day) });
    rows.push({ key: "stat-furrows", stat: true, name: "Furrows ploughed", value: count(s.furrows) });
    rows.push({ key: "stat-man", stat: true, name: "The Man has taken", value: money(s.manTook) });
    rows.push({ key: "stat-worth", stat: true, name: "Net worth", value: money(E.netWorth(s)) });
    if (s.bearMet) {
      rows.push({ key: "stat-flips", stat: true, name: "Coin flips won and lost", value: `${s.flipsWon} and ${s.flipsLost}` });
      rows.push({ key: "stat-flipnet", stat: true, name: "Coin flip returns", value: money(s.flipNet) });
      rows.push({ key: "stat-portfolio", stat: true, name: "Invested", value: money(E.portfolioValue(s)) });
      rows.push({ key: "stat-wiped", stat: true, name: "Positions wiped out", value: String(s.liquidations) });
    }
    return rows;
  }
  const currentRows = () => ({ farm: shopRows, barn: barnRows, markets: marketRows, stats: statRows })[tab]();

  function makeRow(row) {
    if (row.heading) {
      const h = document.createElement("h3");
      h.className = "heading";
      return h;
    }
    if (row.chart) {
      const el = document.createElement("div");
      el.className = "chart";
      return el;
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
    if (row.chart) {
      const stamp = row.chart + ":" + s.history.length;
      if (el.dataset.stamp !== stamp) {
        el.dataset.stamp = stamp;
        BullCharts.draw(el, chartOptions(row.chart));
      }
      return;
    }
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
        b.classList.toggle("off", a.cls === "off");
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
    $("panel-inner").scrollTop = 0;
    render();
  }

  function onCta() {
    if (s.phase === "night") sleep(); else goToBarn();
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
    $("tabs").hidden = s.stage < 2;
    $("status-top").hidden = s.stage < 2;
    $("barn").hidden = !night;
    $("bear").toggleAttribute("hidden", !night || !s.bearMet); // SVGs have no .hidden property
    $("door").hidden = !night || s.bearMet || s.issues < 1;
    $("barn-bull").src = `assets/bull-${barnBull()}.png`;
    $("scene").setAttribute("aria-label", night ? "Inside the barn at night." : "The field. Tap to work.");
    $("tab-barn").hidden = !(s.report || night);
    $("tab-markets").hidden = !s.bearMet;
    $("foot").hidden = false;
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
    $("sun").style.left = `${8 + p * 84}%`;
    $("sun").style.top = `${22 - Math.sin(p * Math.PI) * 16 + t * 12}%`;
  }

  function renderStatus() {
    const night = s.phase === "night";
    const rate = E.incomePerSecond(s);
    if (s.stage === 1) {
      $("activity-text").textContent = "🌿 Grazing";
      $("activity-side").textContent = `Belly ${s.belly}%`;
      $("activity-fill").style.width = s.belly + "%";
      return;
    }
    $("money").textContent = money(s.money);
    $("money").classList.toggle("doubled", s.clock < s.doubleUntil);
    $("cut").textContent = Math.round(E.cut(s) * 100) + "%";
    const quota = `${count(s.dayFurrows)} of ${count(s.quota)} furrows`;
    if (night) {
      $("activity-text").textContent = `🌙 Night ${s.day}: in the barn`;
      $("activity-side").textContent = s.bearMet ? `${s.flipsLeft} flip${s.flipsLeft === 1 ? "" : "s"} left` : "";
      $("activity-fill").style.width = "100%";
    } else {
      $("activity-text").textContent = s.quotaMet ? `🌇 Day ${s.day}: overtime, ${quota}` : `☀️ Day ${s.day}: ${quota}`;
      $("activity-side").textContent = rate > 0 ? perSecond(rate) : "";
      $("activity-fill").style.width = E.dayProgress(s) * 100 + "%";
    }
    const history = s.history.map((d) => d.worth);
    $("worth").hidden = history.length < 2;
    if (history.length >= 2) {
      $("worth-text").textContent = `Worth ${money(E.netWorth(s))}`;
      const lo = Math.min(...history);
      const hi = Math.max(...history);
      const span = hi - lo || 1;
      const d = history.map((v, i) => `${i ? "L" : "M"}${(1 + (i / (history.length - 1)) * 78).toFixed(1)} ${(22 - ((v - lo) / span) * 20).toFixed(1)}`).join("");
      $("spark").querySelector("path").setAttribute("d", d);
    }
  }

  function renderCta() {
    const night = s.phase === "night";
    const show = s.stage >= 2 && (night || s.quotaMet);
    $("cta").hidden = !show;
    if (!show) return;
    $("cta-title").textContent = night ? `😴 Sleep until day ${s.day + 1}` : "🏚️ Clock off and go to the barn";
    $("cta-note").textContent = night ? "Trades settle while you sleep." : `Quota met. Overtime only pays ${Math.round(E.OVERTIME_PAY * 100)}%.`;
  }

  function render() {
    renderDay();
    $("app").classList.toggle("quota-met", s.quotaMet && s.phase === "day");
    renderStatus();
    renderCta();
    if (s.stage < 2) return;
    for (const id of ["farm", "barn", "markets", "stats"]) $("tab-" + id).classList.toggle("on", tab === id);
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
        floatText(box.clientWidth * 0.62, box.clientHeight * 0.6, "+" + money(pending));
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
    if (s.phase === "night") tab = "barn";
    if (E.paperIsHere(s) && s.beats.includes("paper")) $("paper").hidden = false;
    syncScene();
    drawHelpers();
    render();
    $("scene").addEventListener("pointerdown", onTap);
    $("clover").addEventListener("click", onClover);
    $("paper").addEventListener("click", onPaper);
    $("door").addEventListener("click", openDoor);
    for (const id of ["farm", "barn", "markets", "stats"]) $("tab-" + id).addEventListener("click", () => setTab(id));
    $("cta").addEventListener("click", onCta);
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
