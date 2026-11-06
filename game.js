/* Everything on screen: drawing, tapping, story beats and saving.
   The rules and numbers are in engine.js. */
(function () {
  "use strict";
  const E = window.BullEngine;
  const SAVE_KEY = "bull-run-escape";
  const $ = (id) => document.getElementById(id);
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let s = E.newGame();

  /* Saving. Storage can be blocked, so the game must still run without it. */
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* no storage here */ }
  }
  function readSave() {
    try { return localStorage.getItem(SAVE_KEY); } catch (e) { return null; }
  }

  /* Numbers */
  function money(n) {
    if (n < 1000) return "£" + n.toFixed(n < 100 ? 2 : 0);
    if (n < 1e6) return "£" + Math.floor(n).toLocaleString("en-GB");
    return "£" + (n / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
  }

  /* Speech: lines queue so that a burst of events stays readable. */
  const queue = [];
  let talkUntil = 0;
  function say(who, face, text) {
    queue.push({ who, face, text });
    if (queue.length > 3) queue.shift(); // old lines give way to new events
  }
  function bull(face, text) { say("bull", face, text); }
  function man(text) { say("man", "boots", text); }
  function runTalk(now) {
    if (now < talkUntil) return;
    const line = queue.shift();
    if (!line) { $("talk").hidden = true; return; }
    $("talk").hidden = false;
    $("talk").classList.toggle("man", line.who === "man");
    $("talk-face").hidden = line.who === "man";
    if (line.who === "bull") $("talk-face").src = `assets/face-${line.face}.png`;
    $("talk-text").textContent = (line.who === "man" ? "The Man: " : "") + line.text;
    talkUntil = now + Math.max(2600, line.text.length * 62);
  }

  /* One-off story beats. Each fires once and is remembered in the save. */
  const BEATS = [
    { id: "start", when: () => true, run: () => bull("calm", "Grass. Today's plan is grass.") },
    { id: "fence", when: () => s.belly >= 32, run: () => bull("suspicious", "What's past that fence, I wonder?") },
    { id: "full", when: () => s.belly >= 64, run: () => bull("nervous", "Is grass all there is?") },
    { id: "work", when: () => s.belly >= 100, run: manArrives },
    { id: "firstpay", when: () => s.furrows >= 1, run: () => bull("shocked", "One pound?! I ploughed that whole furrow!") },
    { id: "helper", when: () => (s.helpers.chicken || 0) >= 1, run: () => bull("laughing", "The chickens have joined the workforce.") },
    { id: "fair", when: () => E.cut(s) <= 0.75, run: () => man("Ungrateful animal.") },
    { id: "wobble", when: () => E.cut(s) <= 0.6, run: () => man("Who taught you these words?") },
    { id: "paper", when: () => E.paperIsHere(s), run: sendPaper },
    { id: "ending", when: () => s.finished, run: () => bull("greedy", "I don't need a bigger plough. I need to own something.") },
  ];
  function runBeats() {
    for (const b of BEATS) {
      if (!s.beats.includes(b.id) && b.when()) {
        s.beats.push(b.id);
        b.run();
      }
    }
  }

  function manArrives() {
    queue.length = 0;
    talkUntil = 0;
    man("Fat and idle, are we? Time you earned that grass.");
    setTimeout(() => {
      E.startWork(s);
      man("A tenner a furrow, less my cut. Ninety per cent.");
      bull("shocked", "Ninety?!");
      syncScene();
    }, 2600);
    syncScene(true);
  }

  function sendPaper() {
    bull("suspicious", "What's that blowing across the field?");
    showPaper();
  }
  function showPaper() { $("paper").hidden = false; }

  /* The field */
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
    goat: `<svg viewBox="0 0 46 46"><path d="M14 36 V44 M34 36 V44" stroke="#1B0F08" stroke-width="4"/><path d="M12 16 C20 12 36 14 40 24 C42 34 30 38 20 38 C12 38 10 26 12 16Z" fill="#CFC6B4" stroke="#1B0F08" stroke-width="3" stroke-linejoin="round"/><path d="M14 18 L4 20 L8 30 C12 30 15 26 15 22Z" fill="#CFC6B4" stroke="#1B0F08" stroke-width="3" stroke-linejoin="round"/><path d="M10 15 L16 3 M14 16 L22 5" stroke="#1B0F08" stroke-width="3"/><path d="M6 30 L7 38" stroke="#1B0F08" stroke-width="3"/><circle cx="9" cy="23" r="1.8" fill="#1B0F08"/></svg>`,
    tractor: `<svg viewBox="0 0 72 58"><path d="M6 22 H34 V8 H56 V36 H6Z" fill="#D4321C" stroke="#1B0F08" stroke-width="3" stroke-linejoin="round"/><path d="M40 13 H51 V24 H40Z" fill="#7FD0F0" stroke="#1B0F08" stroke-width="3"/><circle cx="50" cy="42" r="14" fill="#2B1D12" stroke="#1B0F08" stroke-width="3"/><circle cx="50" cy="42" r="5" fill="#FFC72C"/><circle cx="16" cy="46" r="10" fill="#2B1D12" stroke="#1B0F08" stroke-width="3"/><circle cx="16" cy="46" r="3.5" fill="#FFC72C"/></svg>`,
  };
  // Where each kind of helper stands: [left %, bottom %, spacing %].
  const HELPER_SPOTS = { chicken: [1, 19, 7], sheep: [4, 42, 9], goat: [52, 40, 8], tractor: [34, 46, 0] };
  function drawHelpers() {
    const box = $("helpers");
    let html = "";
    for (const h of E.HELPERS) {
      const shown = Math.min(s.helpers[h.id] || 0, h.id === "tractor" ? 1 : 3);
      for (let i = 0; i < shown; i++) {
        const [left, bottom, gap] = HELPER_SPOTS[h.id];
        html += `<div class="helper" data-kind="${h.id}" style="left:${left + i * gap}%;bottom:${bottom}%;animation-delay:-${i * 0.21}s">${HELPER_ART[h.id]}</div>`;
      }
    }
    if (box.dataset.html !== html) { box.dataset.html = html; box.innerHTML = html; }
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

  let pose = "";
  function setPose(name) {
    if (pose === name) return;
    pose = name;
    $("bull").src = `assets/bull-${name}.png`;
  }
  let poseUntil = 0;
  function flashPose(name, ms) {
    setPose(name);
    poseUntil = performance.now() + ms;
  }

  /* Tapping */
  let groundSpeed = 0;
  let groundX = 0;
  function onTap(e) {
    if (e.target.closest("button")) return;
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
      if (s.taps % 4 === 0) floatText(x + 30, y + 22, `Man +${money(paid.took)}`, true);
    }
    render();
  }

  /* Lucky clover */
  let cloverAt = 25;
  let cloverGone = Infinity;
  function runClover() {
    const el = $("clover");
    if (s.stage < 2) return;
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
  function openPaper(issue, label, headline, body, bonus) {
    $("sheet-issue").textContent = label;
    $("sheet-headline").textContent = headline;
    $("sheet-body").textContent = body;
    $("sheet-bonus").textContent = bonus;
    $("sheet-bonus").hidden = !bonus;
    $("reader").hidden = false;
    $("sheet-close").focus({ preventScroll: true });
  }
  function onPaper() {
    E.findPaper(s);
    $("paper").hidden = true;
    openPaper(0, "Free sample", "Who really owns the field?", "Landowners hold assets, and assets pay them. If you are reading this in a field, you may be one of the assets.", "");
    bull("suspicious", "The Man's been keeping this from me.");
    render();
    save();
  }
  function onRead() {
    const issue = E.ISSUES[s.issues];
    if (!E.readIssue(s)) return;
    openPaper(s.issues, `Issue ${s.issues} of ${E.ISSUES.length}`, issue.headline, issue.body, `Lesson learned: all pay × ${issue.bonus}`);
    render();
    save();
  }

  /* The shop */
  function revealed(id, cost) {
    const key = "shop-" + id;
    if (s.beats.includes(key)) return true;
    if (s.lifetime >= cost * 0.45) { s.beats.push(key); return true; }
    return false;
  }
  function shopList() {
    const list = [];
    if (s.stage >= 3 && E.ISSUES[s.issues]) {
      const n = s.issues + 1;
      const issue = E.ISSUES[s.issues];
      list.push({ key: "issue" + n, kind: "news", name: `Read issue ${n}`, note: `All pay × ${issue.bonus}. The headline stays secret until you buy it.`, cost: issue.cost, buy: onRead });
    }
    const r = E.nextRebellion(s);
    if (r && E.canSeeRebellion(s, r) && revealed(r.id, r.cost)) {
      list.push({
        key: r.id, kind: "rebel", name: r.name, note: `${r.note} His cut falls to ${Math.round(r.cut * 100)}%.`, cost: r.cost,
        buy: () => {
          if (!E.buyRebellion(s, r.id)) return;
          bull(r.face, r.line);
          flashPose("hero", 2200);
        },
      });
    }
    list.push({ key: "plough", name: E.PLOUGH.name, count: s.plough, note: E.PLOUGH.note, cost: E.costOfPlough(s), buy: () => E.buyPlough(s) });
    for (const h of E.HELPERS) {
      const cost = E.costOfHelper(s, h);
      if (revealed(h.id, h.cost)) {
        list.push({ key: h.id, name: h.name, count: s.helpers[h.id] || 0, note: h.note, cost, buy: () => E.buyHelper(s, h.id) });
      }
    }
    return list;
  }
  let shopShape = "";
  let shopItems = [];
  function renderShop() {
    const list = shopList();
    const shape = list.map((i) => `${i.key}:${i.count ?? ""}:${i.cost}:${i.note}`).join("|");
    if (shape !== shopShape) {
      shopShape = shape;
      const shop = $("shop");
      shop.textContent = "";
      shopItems = list.map((item) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "item" + (item.kind ? " " + item.kind : "");
        b.innerHTML = `<span><b></b><small></small></span><span class="price"></span>`;
        b.querySelector("b").textContent = item.name;
        if (item.count) b.querySelector("b").insertAdjacentHTML("beforeend", ` <em>× ${item.count}</em>`);
        b.querySelector("small").textContent = item.note;
        b.querySelector(".price").textContent = money(item.cost);
        b.addEventListener("click", () => {
          item.buy();
          render();
          save();
        });
        shop.append(b);
        return { el: b, cost: item.cost };
      });
    }
    for (const { el, cost } of shopItems) el.disabled = s.money < cost;
  }

  /* Ending of this build */
  function renderEnding() {
    const el = $("ending");
    if (!s.finished || !el.hidden) return;
    const minutes = Math.max(1, Math.round(s.clock / 60));
    el.innerHTML = `<h2>The market opens in the next update</h2><p></p>`;
    el.querySelector("p").textContent = `You reached this point in about ${minutes} min. The Man took ${money(s.manTook)} from your work. Your bull is ready to invest.`;
    el.hidden = false;
  }

  function syncScene(manOnly) {
    const app = $("app");
    app.classList.toggle("man-here", s.stage >= 2 || !!manOnly);
    if (manOnly) return;
    app.classList.toggle("stage-1", s.stage === 1);
    app.classList.toggle("stage-2", s.stage === 2);
    app.classList.toggle("stage-3", s.stage === 3);
    app.classList.toggle("has-panel", s.stage >= 2);
    $("panel").hidden = s.stage < 2;
    $("purse").hidden = s.stage < 2;
    $("cut-sign").hidden = s.stage < 2;
    $("hint").hidden = $("hint").hidden || s.stage >= 2;
  }

  function render() {
    $("belly-fill").style.width = s.belly + "%";
    $("belly").setAttribute("aria-valuenow", String(s.belly));
    if (s.stage < 2) return;
    $("money").textContent = money(s.money);
    $("money").classList.toggle("doubled", s.clock < s.doubleUntil);
    const rate = E.incomePerSecond(s);
    $("rate").hidden = rate <= 0;
    $("rate").textContent = money(rate) + " a second";
    const cut = E.cut(s);
    $("cut").textContent = Math.round(cut * 100) + "%";
    // The Man's boots shrink into the distance as his cut falls.
    document.documentElement.style.setProperty("--man-scale", (0.3 + (cut - 0.45) * 1.55).toFixed(3));
    $("freedom").hidden = s.stage < 3;
    if (s.stage >= 3) {
      $("freedom-label").textContent = `Freedom: ${money(s.money)} of ${money(E.FREEDOM_NUMBER)}`;
      $("freedom-fill").style.width = Math.min(100, (s.money / E.FREEDOM_NUMBER) * 100) + "%";
    }
    renderShop();
    renderEnding();
  }

  /* Main loop */
  let last = performance.now();
  let lastRender = 0;
  let pending = 0;
  let pendingLost = 0;
  let pendingAt = 0;
  function frame(now) {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    const made = E.tick(s, dt);
    pending += made.kept;
    pendingLost += made.took;
    runBeats();
    runClover();
    runTalk(now);

    if (s.stage >= 2) {
      const auto = Math.min(420, Math.sqrt(E.helperWork(s)) * 40);
      groundSpeed = Math.max(auto, groundSpeed * Math.pow(0.04, dt));
      groundX += groundSpeed * dt;
      $("ground").style.backgroundPositionX = `${groundX.toFixed(1)}px`;
      if (pending >= 0.01 && now - pendingAt > 1100) {
        const box = $("scene");
        floatText(box.clientWidth * 0.1, box.clientHeight * 0.5, "+" + money(pending));
        pending = 0;
        pendingLost = 0;
        pendingAt = now;
      }
      if (now > poseUntil) setPose(s.stage >= 3 && groundSpeed > 200 ? "run" : "side");
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
    pose = "side";
    if (s.taps > 0) $("hint").hidden = true;
    if (E.paperIsHere(s) && s.beats.includes("paper")) showPaper();
    syncScene();
    drawHelpers();
    render();
    $("scene").addEventListener("pointerdown", onTap);
    $("clover").addEventListener("click", onClover);
    $("paper").addEventListener("click", onPaper);
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
