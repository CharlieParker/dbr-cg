/* Game rules and numbers. No drawing or page code lives here, so the balance
   can be tested on its own with `node tools/simulate.js`. */
(function (root) {
  "use strict";

  const FURROW_WORK = 10;      // work needed to finish one furrow
  const FURROW_PAY = 10;       // what the Man is paid per furrow, in pounds
  const BELLY_PER_BITE = 4;    // 25 bites fills the belly
  const FREEDOM_NUMBER = 1000000;
  const PAPER_AT = 4000;       // lifetime earnings that bring the newspaper
  const SAVE_VERSION = 1;

  // Helpers repeat: each one costs more than the last.
  const HELPERS = [
    { id: "chicken", name: "Chicken crew", note: "Pecks at the soil. Paid in corn.", cost: 12, growth: 1.15, work: 2.5 },
    { id: "sheep", name: "Sheep shift", note: "Slow, but they stick together.", cost: 110, growth: 1.15, work: 14 },
    { id: "goat", name: "Goat gang", note: "Eats the plans, then finishes the job.", cost: 900, growth: 1.15, work: 80 },
    { id: "tractor", name: "Borrowed tractor", note: "The Man has not noticed yet.", cost: 7000, growth: 1.15, work: 450 },
  ];

  // Sharper plough: more work from every tap.
  const PLOUGH = { name: "Sharpen the plough", note: "Each tap ploughs further.", cost: 4, growth: 1.7, work: 1 };

  // Each step takes a slice of the Man's cut. Bought once, in order.
  const REBELLIONS = [
    { id: "raise", name: "Ask for a raise", note: "Polite. Terrified.", cost: 20, cut: 0.85, face: "nervous", line: "Could I, um, keep a bit more?" },
    { id: "union", name: "Start a union", note: "The chickens are in.", cost: 150, cut: 0.75, face: "suspicious", needs: "chicken", line: "We know where the corn is kept." },
    { id: "strike", name: "Sit-down strike", note: "A bull in a field, refusing.", cost: 700, cut: 0.6, face: "angry", line: "I am not moving. Literally." },
    { id: "lawyer", name: "Hire a goat lawyer", note: "He read the contract, then ate it.", cost: 2400, cut: 0.45, face: "triumph", needs: "goat", line: "Which contract? I see no contract." },
  ];

  // Issues of the paper. Reading each one teaches something and pays for itself.
  const ISSUES = [
    { headline: "Your wages are not your wealth", body: "A worker sells hours. An owner gets paid while asleep. Guess which one the Man is.", cost: 3000, bonus: 1.5 },
    { headline: "Small sums, left alone, get big", body: "Interest earns interest. Given enough years, the curve bends up on its own.", cost: 9000, bonus: 1.5 },
    { headline: "What exactly is a share?", body: "A tiny slice of a business. Own the slice and its profits are partly yours.", cost: 24000, bonus: 2 },
  ];

  function newGame() {
    return {
      v: SAVE_VERSION, stage: 1, belly: 0, money: 0, lifetime: 0, manTook: 0,
      work: 0, furrows: 0, plough: 0, helpers: {}, rebellions: [], issues: 0,
      paperFound: false, finished: false, doubleUntil: 0, clock: 0, taps: 0, beats: [],
    };
  }

  function cut(s) {
    const done = REBELLIONS.filter((r) => s.rebellions.includes(r.id));
    return done.length ? done[done.length - 1].cut : 0.9;
  }

  const costOfPlough = (s) => Math.round(PLOUGH.cost * Math.pow(PLOUGH.growth, s.plough));
  const costOfHelper = (s, h) => Math.round(h.cost * Math.pow(h.growth, s.helpers[h.id] || 0));
  const tapWork = (s) => 2 + s.plough * PLOUGH.work;
  const helperWork = (s) => HELPERS.reduce((sum, h) => sum + h.work * (s.helpers[h.id] || 0), 0);
  const issueBonus = (s) => ISSUES.slice(0, s.issues).reduce((m, i) => m * i.bonus, 1);
  const payMultiplier = (s) => issueBonus(s) * (s.clock < s.doubleUntil ? 2 : 1);
  const payPerWork = (s) => (FURROW_PAY / FURROW_WORK) * (1 - cut(s)) * payMultiplier(s);
  const incomePerSecond = (s) => helperWork(s) * payPerWork(s);

  // Turn work into furrows and pay, splitting it with the Man.
  function addWork(s, amount) {
    const gross = (amount * FURROW_PAY) / FURROW_WORK * payMultiplier(s);
    const kept = gross * (1 - cut(s));
    s.money += kept;
    s.lifetime += kept;
    s.manTook += gross - kept;
    s.work += amount;
    const finished = Math.floor(s.work / FURROW_WORK);
    s.work -= finished * FURROW_WORK;
    s.furrows += finished;
    return { kept, took: gross - kept, finished };
  }

  function bite(s) {
    if (s.stage !== 1) return false;
    s.taps += 1;
    s.belly = Math.min(100, s.belly + BELLY_PER_BITE);
    return true;
  }

  function plough(s) {
    if (s.stage < 2) return null;
    s.taps += 1;
    return addWork(s, tapWork(s));
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

  const nextRebellion = (s) => REBELLIONS.find((r) => !s.rebellions.includes(r.id)) || null;

  function canSeeRebellion(s, r) {
    return !r.needs || (s.helpers[r.needs] || 0) > 0;
  }

  function buyRebellion(s, id) {
    const r = nextRebellion(s);
    if (!r || r.id !== id || !canSeeRebellion(s, r) || !spend(s, r.cost)) return false;
    s.rebellions.push(r.id);
    return true;
  }

  function readIssue(s) {
    const issue = ISSUES[s.issues];
    if (!issue || !spend(s, issue.cost)) return false;
    s.issues += 1;
    if (s.issues === ISSUES.length) s.finished = true;
    return true;
  }

  function findPaper(s) {
    if (!paperIsHere(s)) return false;
    s.paperFound = true;
    s.stage = 3;
    return true;
  }

  const paperIsHere = (s) => s.stage === 2 && !s.paperFound && s.lifetime >= PAPER_AT;

  // A lucky clover is worth a minute of income, or doubles pay for 20 seconds.
  function pickClover(s, roll) {
    if (roll < 0.5) {
      s.doubleUntil = s.clock + 20;
      return { kind: "double" };
    }
    const prize = Math.max(5, incomePerSecond(s) * 60);
    s.money += prize;
    s.lifetime += prize;
    return { kind: "cash", amount: prize };
  }

  function tick(s, seconds) {
    s.clock += seconds;
    if (s.stage < 2) return { kept: 0, took: 0, finished: 0 };
    return addWork(s, helperWork(s) * seconds);
  }

  function startWork(s) {
    if (s.stage === 1) s.stage = 2;
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
    HELPERS, PLOUGH, REBELLIONS, ISSUES, FREEDOM_NUMBER, PAPER_AT, FURROW_WORK,
    newGame, cut, costOfPlough, costOfHelper, tapWork, helperWork, payPerWork,
    payMultiplier, incomePerSecond, bite, plough, buyPlough, buyHelper,
    nextRebellion, canSeeRebellion, buyRebellion, readIssue, findPaper,
    paperIsHere, pickClover, tick, startWork, load,
  };
})(typeof window !== "undefined" ? window : globalThis);
