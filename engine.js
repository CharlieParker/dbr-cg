/* Game rules and numbers. No drawing or page code lives here, so the balance
   can be tested on its own with `node tools/simulate.js`. */
(function (root) {
  "use strict";

  const FURROW_WORK = 10;      // work needed to finish one furrow
  const FURROW_PAY = 10;       // what the Man is paid per furrow, in pounds
  const BELLY_PER_BITE = 4;    // 25 bites fills the belly
  const OVERTIME_PAY = 0.2;    // pay rate once the day's quota is met
  const FREEDOM_NUMBER = 5000000; // target net worth for tools/simulate.js
  const PAPER_AT = 2500;       // lifetime earnings that bring the newspaper
  const FLIP_WIN_CHANCE = 0.47;
  const SAVE_VERSION = 2;

  // Helpers repeat: each one costs more than the last.
  const HELPERS = [
    { id: "chicken", name: "Chicken crew", note: "Pecks at the soil. Paid in corn.", cost: 12, growth: 1.3, work: 2.5 },
    { id: "sheep", name: "Sheep shift", note: "Slow, but they stick together.", cost: 110, growth: 1.3, work: 14 },
    { id: "goat", name: "Goat gang", note: "Eats the plans, then finishes the job.", cost: 900, growth: 1.3, work: 80 },
    { id: "tractor", name: "Borrowed tractor", note: "The Man has not noticed yet.", cost: 7000, growth: 1.3, work: 450 },
  ];

  // Upgrades double a helper's output. Each one needs a herd of a certain size.
  const UPGRADES = {
    chicken: [
      { name: "Better corn", note: "Well-fed chickens peck harder.", own: 5, cost: 180 },
      { name: "Free-range pens", note: "Happy hens, deeper furrows.", own: 15, cost: 6000 },
      { name: "Prize-winning hens", note: "They have rosettes now.", own: 30, cost: 400000 },
    ],
    sheep: [
      { name: "Sturdier breed", note: "More muscle under the wool.", own: 5, cost: 1500 },
      { name: "Sheepdog foreman", note: "The flock stops wandering off.", own: 15, cost: 45000 },
      { name: "Champion rams", note: "They plough with their heads.", own: 30, cost: 2000000 },
    ],
    goat: [
      { name: "Sharper horns", note: "Goats make excellent ploughs.", own: 5, cost: 12000 },
      { name: "Mountain breed", note: "No slope is too steep.", own: 15, cost: 350000 },
      { name: "Goat engineers", note: "They have started drawing plans.", own: 30, cost: 12000000 },
    ],
    tractor: [
      { name: "Bigger engine", note: "Louder too, which helps.", own: 5, cost: 100000 },
      { name: "Wider plough", note: "More rows on every pass.", own: 15, cost: 2500000 },
      { name: "Self-driving kit", note: "The tractor no longer needs a goat.", own: 30, cost: 90000000 },
    ],
  };

  const PLOUGH = { name: "Sharpen the plough", note: "Each tap ploughs further.", cost: 4, growth: 1.75, work: 1 };

  // Each step takes a slice of the Man's cut. Bought once, in order.
  const REBELLIONS = [
    { id: "raise", name: "Ask for a raise", note: "Polite. Terrified.", cost: 20, cut: 0.85, face: "nervous", line: "Could I, um, keep a bit more?" },
    { id: "union", name: "Start a union", note: "The chickens are in.", cost: 150, cut: 0.75, face: "suspicious", needs: "chicken", line: "We know where the corn is kept." },
    { id: "strike", name: "Sit-down strike", note: "A bull in a field, refusing.", cost: 700, cut: 0.6, face: "angry", line: "I am not moving. Literally." },
    { id: "lawyer", name: "Hire a goat lawyer", note: "He read the contract, then ate it.", cost: 2400, cut: 0.45, face: "triumph", needs: "goat", line: "Which contract? I see no contract." },
  ];

  const ISSUES = [
    { headline: "Your wages are not your wealth", body: "A worker sells hours. An owner gets paid while asleep. Guess which one the Man is.", cost: 3000, bonus: 1.5 },
    { headline: "Small sums, left alone, get big", body: "Interest earns interest. Given enough years, the curve bends up on its own.", cost: 9000, bonus: 1.5 },
    { headline: "What exactly is a share?", body: "A tiny slice of a business. Own the slice and its profits are partly yours.", cost: 24000, bonus: 2 },
  ];

  // Fictional markets, settled once a night. beta is how hard the mood hits it.
  const ASSETS = [
    { id: "index", name: "Farm Index Fund", note: "Boring. Mostly goes up.", drift: 0.015, vol: 0.02, beta: 1 },
    { id: "moo", name: "Moo Motors", note: "Electric tractors, allegedly.", drift: 0.03, vol: 0.08, beta: 2 },
    { id: "hay", name: "$HAY coin", note: "Backed by nothing, including hay.", drift: 0.06, vol: 0.24, beta: 4 },
  ];
  const MOOD_DRIFT = { bull: 0.02, bear: -0.035 };

  // The bear's lessons, sold one at a time so the barn keeps opening up.
  const LESSONS = [
    { id: "flip2", name: "Lucky wrist", note: "One more flip each night.", cost: 6000, line: "Volume, kid. That's the whole secret." },
    { id: "index", name: "Open a brokerage account", note: "Unlocks the Farm Index Fund.", cost: 12000, line: "Put it in, go to sleep, wake up richer. Usually." },
    { id: "moo", name: "Stock tips", note: "Unlocks Moo Motors.", cost: 30000, line: "This one moves. In which direction is your problem." },
    { id: "lev2", name: "Borrow from the bear", note: "Unlocks 2× leverage.", cost: 60000, line: "My money, your risk. Lovely arrangement." },
    { id: "hay", name: "Crypto, for some reason", note: "Unlocks $HAY coin.", cost: 100000, line: "Nobody can explain it. That's the appeal." },
    { id: "lev5", name: "A bigger loan", note: "Unlocks 5× leverage.", cost: 200000, line: "Lose 20% and you're wiped out. Don't lose 20%." },
    { id: "lev10", name: "A very bad idea", note: "Unlocks 10× leverage.", cost: 400000, line: "I've buried better bulls than you." },
  ];

  function newGame() {
    return {
      v: SAVE_VERSION, stage: 1, belly: 0, money: 0, lifetime: 0, manTook: 0,
      work: 0, furrows: 0, plough: 0, helpers: {}, rebellions: [], issues: 0,
      earnedBy: {}, tiers: {}, day: 1, phase: "day", quota: 10, dayFurrows: 0, dayEarned: 0,
      dayTook: 0, quotaMet: false, report: null, paperFound: false, doubleUntil: 0,
      clock: 0, taps: 0, beats: [], bearMet: false, lessons: [], flipsLeft: 0,
      flipsWon: 0, flipsLost: 0, flipNet: 0, positions: {}, leverage: 1, liquidations: 0,
      assetNet: {}, assetPrice: { index: 100, moo: 100, hay: 100 }, history: [],
      market: { mood: "bull", nights: 4, next: "bull", hint: "bull" },
    };
  }

  function cut(s) {
    const done = REBELLIONS.filter((r) => s.rebellions.includes(r.id));
    return done.length ? done[done.length - 1].cut : 0.9;
  }

  const costOfPlough = (s) => Math.round(PLOUGH.cost * Math.pow(PLOUGH.growth, s.plough));
  const costOfHelper = (s, h) => Math.round(h.cost * Math.pow(h.growth, s.helpers[h.id] || 0));
  const tapWork = (s) => 2 + s.plough * PLOUGH.work;
  const workOf = (s, h) => h.work * Math.pow(2, s.tiers[h.id] || 0);
  const helperWork = (s) => HELPERS.reduce((sum, h) => sum + workOf(s, h) * (s.helpers[h.id] || 0), 0);
  const issueBonus = (s) => ISSUES.slice(0, s.issues).reduce((m, i) => m * i.bonus, 1);
  const payMultiplier = (s) => issueBonus(s) * (s.clock < s.doubleUntil ? 2 : 1) * (s.quotaMet ? OVERTIME_PAY : 1);
  const payPerWork = (s) => (FURROW_PAY / FURROW_WORK) * (1 - cut(s)) * payMultiplier(s);
  const incomePerSecond = (s) => (s.phase === "day" ? helperWork(s) * payPerWork(s) : 0);
  const helperIncome = (s, h) => (s.helpers[h.id] || 0) * workOf(s, h) * payPerWork(s);
  const portfolioValue = (s) => Object.values(s.positions).reduce((a, b) => a + b, 0);
  const netWorth = (s) => s.money + portfolioValue(s);
  const dayProgress = (s) => Math.min(1, (s.dayFurrows + s.work / FURROW_WORK) / s.quota);

  // The Man raises the quota as you get faster, so a day never shrinks away.
  function quotaFor(s) {
    const seconds = Math.min(45, 14 + 5 * (s.day - 1));
    const furrowsPerSecond = (3 * tapWork(s) + helperWork(s)) / FURROW_WORK;
    return Math.max(10 + 2 * (s.day - 1), Math.round(seconds * furrowsPerSecond));
  }

  // Turn work into furrows and pay, splitting it with the Man.
  function addWork(s, amount, source) {
    const gross = (amount * FURROW_PAY) / FURROW_WORK * payMultiplier(s);
    const kept = gross * (1 - cut(s));
    s.money += kept;
    s.lifetime += kept;
    s.manTook += gross - kept;
    s.dayEarned += kept;
    s.dayTook += gross - kept;
    s.earnedBy[source] = (s.earnedBy[source] || 0) + kept;
    s.work += amount;
    const finished = Math.floor(s.work / FURROW_WORK);
    s.work -= finished * FURROW_WORK;
    s.furrows += finished;
    s.dayFurrows += finished;
    if (s.dayFurrows >= s.quota) s.quotaMet = true;
    return { kept, took: gross - kept, finished };
  }

  function bite(s) {
    if (s.stage !== 1) return false;
    s.taps += 1;
    s.belly = Math.min(100, s.belly + BELLY_PER_BITE);
    return true;
  }

  function plough(s) {
    if (s.stage < 2 || s.phase !== "day") return null;
    s.taps += 1;
    return addWork(s, tapWork(s), "bull");
  }

  function spend(s, cost) {
    if (s.money < cost) return false;
    s.money -= cost;
    return true;
  }

  const buyPlough = (s) => spend(s, costOfPlough(s)) && ((s.plough += 1), true);

  function buyHelper(s, id) {
    const h = HELPERS.find((x) => x.id === id);
    if (!h || !spend(s, costOfHelper(s, h))) return false;
    s.helpers[id] = (s.helpers[id] || 0) + 1;
    return true;
  }

  // A helper's next upgrade, once the herd has nearly reached the size it needs.
  function nextUpgrade(s, id) {
    const u = UPGRADES[id][s.tiers[id] || 0];
    return u && (s.helpers[id] || 0) >= u.own - 2 ? u : null;
  }

  function buyUpgrade(s, id) {
    const u = nextUpgrade(s, id);
    if (!u || (s.helpers[id] || 0) < u.own || !spend(s, u.cost)) return false;
    s.tiers[id] = (s.tiers[id] || 0) + 1;
    return true;
  }

  const nextRebellion = (s) => REBELLIONS.find((r) => !s.rebellions.includes(r.id)) || null;
  const canSeeRebellion = (s, r) => !r.needs || (s.helpers[r.needs] || 0) > 0;

  function buyRebellion(s, id) {
    const r = nextRebellion(s);
    if (!r || r.id !== id || !canSeeRebellion(s, r) || !spend(s, r.cost)) return false;
    s.rebellions.push(r.id);
    return true;
  }

  function readIssue(s) {
    const issue = ISSUES[s.issues];
    if (!issue || s.phase !== "night" || !spend(s, issue.cost)) return false;
    s.issues += 1;
    return true;
  }

  const paperIsHere = (s) => s.stage === 2 && !s.paperFound && s.lifetime >= PAPER_AT;

  function findPaper(s) {
    if (!paperIsHere(s)) return false;
    s.paperFound = true;
    s.stage = 3;
    return true;
  }

  // A lucky clover is worth a minute of income, or doubles pay for 20 seconds.
  function pickClover(s, roll) {
    if (roll < 0.5) {
      s.doubleUntil = s.clock + 20;
      return { kind: "double" };
    }
    const prize = Math.max(5, incomePerSecond(s) * 60);
    s.money += prize;
    s.lifetime += prize;
    s.earnedBy.clover = (s.earnedBy.clover || 0) + prize;
    return { kind: "cash", amount: prize };
  }

  function tick(s, seconds) {
    s.clock += seconds;
    if (s.stage < 2 || s.phase !== "day") return { kept: 0, took: 0, finished: 0 };
    let total = { kept: 0, took: 0, finished: 0 };
    for (const h of HELPERS) {
      const count = s.helpers[h.id] || 0;
      if (!count) continue;
      const r = addWork(s, workOf(s, h) * count * seconds, h.id);
      total = { kept: total.kept + r.kept, took: total.took + r.took, finished: total.finished + r.finished };
    }
    return total;
  }

  function startWork(s) {
    if (s.stage === 1) {
      s.stage = 2;
      s.quota = quotaFor(s);
    }
  }

  /* Night */
  function hasLesson(s, id) { return s.lessons.includes(id); }
  const flipsPerNight = (s) => (hasLesson(s, "flip2") ? 2 : 1);
  const nextLesson = (s) => LESSONS.find((l) => !s.lessons.includes(l.id)) || null;
  const leverageOptions = (s) => [1, 2, 5, 10].filter((x) => x === 1 || hasLesson(s, "lev" + x));
  const assetUnlocked = (s, id) => hasLesson(s, id);

  function goToBarn(s, rng) {
    if (!s.quotaMet || s.phase !== "day") return false;
    s.phase = "night";
    s.report = { day: s.day, furrows: s.dayFurrows, earned: s.dayEarned, took: s.dayTook };
    s.flipsLeft = flipsPerNight(s);
    const m = s.market;
    m.next = m.nights <= 1 ? (m.mood === "bull" ? "bear" : "bull") : m.mood;
    // The paper's market tip is right four times in five.
    m.hint = rng() < 0.8 ? m.next : (m.next === "bull" ? "bear" : "bull");
    return true;
  }

  function meetBear(s) {
    if (s.phase !== "night" || s.issues < 1 || s.bearMet) return false;
    s.bearMet = true;
    s.flipsLeft = flipsPerNight(s);
    return true;
  }

  function buyLesson(s) {
    const l = nextLesson(s);
    if (!l || !s.bearMet || s.phase !== "night" || !spend(s, l.cost)) return false;
    s.lessons.push(l.id);
    return true;
  }

  function flip(s, share, rng) {
    const stake = s.money * share;
    if (!s.bearMet || s.phase !== "night" || s.flipsLeft < 1 || stake <= 0) return null;
    s.flipsLeft -= 1;
    const win = rng() < FLIP_WIN_CHANCE;
    s.money += win ? stake : -stake;
    s.flipNet += win ? stake : -stake;
    if (win) s.flipsWon += 1; else s.flipsLost += 1;
    return { win, stake };
  }

  function invest(s, id, share) {
    const amount = s.money * share;
    if (!assetUnlocked(s, id) || s.phase !== "night" || amount <= 0) return false;
    s.money -= amount;
    s.positions[id] = (s.positions[id] || 0) + amount;
    return true;
  }

  function sell(s, id) {
    if (s.phase !== "night" || !s.positions[id]) return false;
    s.money += s.positions[id];
    delete s.positions[id];
    return true;
  }

  function setLeverage(s, x) {
    if (leverageOptions(s).includes(x)) s.leverage = x;
  }

  function gaussian(rng) {
    const u = Math.max(rng(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  }

  // One row of history a day, read by the graphs. Oldest rows drop off at 400.
  function recordDay(s) {
    s.history.push({
      d: s.day, worth: netWorth(s), port: portfolioValue(s), earned: s.dayEarned,
      took: s.dayTook, flip: s.flipNet, pos: { ...s.assetNet }, px: { ...s.assetPrice },
    });
    if (s.history.length > 400) s.history.shift();
  }

  // Settle the market, then start the next day.
  function sleep(s, rng) {
    if (s.phase !== "night") return null;
    const m = s.market;
    const results = [];
    for (const a of ASSETS) {
      const move = a.drift + MOOD_DRIFT[m.next] * a.beta + a.vol * gaussian(rng);
      s.assetPrice[a.id] = Math.max(1, s.assetPrice[a.id] * (1 + move));
      const before = s.positions[a.id];
      if (!before) continue;
      const change = Math.max(-1, move * s.leverage);
      const after = before * (1 + change);
      const wiped = after <= 0;
      if (wiped) { delete s.positions[a.id]; s.liquidations += 1; } else s.positions[a.id] = after;
      s.assetNet[a.id] = (s.assetNet[a.id] || 0) + (after - before);
      results.push({ id: a.id, name: a.name, move, before, after: wiped ? 0 : after, wiped });
    }
    recordDay(s);
    if (m.next !== m.mood) { m.mood = m.next; m.nights = 3 + Math.floor(rng() * 4); } else m.nights -= 1;
    s.day += 1;
    s.phase = "day";
    s.dayFurrows = 0;
    s.dayEarned = 0;
    s.dayTook = 0;
    s.quotaMet = false;
    s.quota = quotaFor(s);
    return { results, mood: m.mood };
  }

  // Older saves and damaged data fall back to a fresh game.
  function load(raw) {
    try {
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!data || data.v !== SAVE_VERSION) return newGame();
      return Object.assign(newGame(), data);
    } catch (e) {
      return newGame();
    }
  }

  root.BullEngine = {
    HELPERS, PLOUGH, REBELLIONS, ISSUES, ASSETS, LESSONS, FREEDOM_NUMBER, PAPER_AT,
    FURROW_WORK, OVERTIME_PAY, FLIP_WIN_CHANCE,
    newGame, cut, workOf, nextUpgrade, buyUpgrade, costOfPlough, costOfHelper, tapWork, helperWork, payPerWork,
    payMultiplier, issueBonus, incomePerSecond, helperIncome, portfolioValue, netWorth,
    dayProgress, bite, plough, buyPlough, buyHelper, nextRebellion, canSeeRebellion,
    buyRebellion, readIssue, findPaper, paperIsHere, pickClover, tick, startWork,
    goToBarn, meetBear, nextLesson, buyLesson, flip, invest, sell, setLeverage,
    leverageOptions, assetUnlocked, sleep, load,
  };
})(typeof window !== "undefined" ? window : globalThis);
