/* Plays the game with a simple bot to check the pacing.
   Usage: node tools/simulate.js [taps per second] [random seed] */
require("../engine.js");
const E = globalThis.BullEngine;
const tapsPerSecond = Number(process.argv[2] || 4);
let seed = Number(process.argv[3] || 1);
const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const s = E.newGame();
const log = (what) => console.log(`${String(Math.round(s.clock)).padStart(5)}s day ${String(s.day).padStart(3)}  £${E.netWorth(s).toFixed(0).padStart(8)} worth  ${what}`);
const step = 0.25;
let owed = 0;

function shop() {
  const r = E.nextRebellion(s);
  if (r && E.canSeeRebellion(s, r) && s.money >= r.cost) { E.buyRebellion(s, r.id); log(`${r.name}: cut ${E.cut(s) * 100}%`); }
  const income = E.helperWork(s) * E.payPerWork(s) + tapsPerSecond * E.tapWork(s) * E.payPerWork(s);
  if (r && E.canSeeRebellion(s, r) && r.cost < s.money + income * 20) return;
  const options = E.HELPERS.map((h) => ({ cost: E.costOfHelper(s, h), gain: h.work, buy: () => E.buyHelper(s, h.id) }));
  options.push({ cost: E.costOfPlough(s), gain: tapsPerSecond * E.PLOUGH.work, buy: () => E.buyPlough(s) });
  // Keeps 60% of its cash back from the shop once there are barn costs to save for.
  const budget = s.paperFound ? s.money * 0.4 : s.money;
  const best = options.filter((o) => o.cost <= budget).sort((a, b) => b.gain / b.cost - a.gain / a.cost)[0];
  if (best) best.buy();
}

function night() {
  if (s.stage === 3 && E.ISSUES[s.issues] && s.money >= E.ISSUES[s.issues].cost) { const h = E.ISSUES[s.issues].headline; E.readIssue(s); log(`read: ${h}`); }
  if (E.meetBear(s)) log("met the bear");
  const l = E.nextLesson(s);
  if (l && s.bearMet && s.money >= l.cost) { E.buyLesson(s); log(`lesson: ${l.name}`); }
  if (s.bearMet && s.flipsLeft) E.flip(s, 0.1, rng);
  for (const a of E.ASSETS.slice().reverse()) {
    if (!E.assetUnlocked(s, a.id)) continue;
    if (s.market.hint === "bear") E.sell(s, a.id);
    else { E.invest(s, a.id, 0.5); break; }
  }
  const opts = E.leverageOptions(s);
  E.setLeverage(s, opts.length > 1 ? opts[1] : 1);
  const before = E.netWorth(s);
  const out = E.sleep(s, rng);
  if (out.results.some((r) => r.wiped)) log("liquidated");
}

while (E.netWorth(s) < E.FREEDOM_NUMBER && s.clock < 7200) {
  E.tick(s, step);
  owed += tapsPerSecond * step;
  while (owed >= 1) {
    owed -= 1;
    if (s.stage === 1) { E.bite(s); if (s.belly >= 100) { E.startWork(s); log("put to work"); } }
    else if (!s.quotaMet) E.plough(s);
  }
  if (E.paperIsHere(s)) { E.findPaper(s); log("found the newspaper"); }
  if (s.stage >= 2) shop();
  if (s.quotaMet) {
    s.clock += 12; // about this long in the barn
    E.goToBarn(s, rng);
    night();
  }
}
log(E.netWorth(s) >= E.FREEDOM_NUMBER ? "FREEDOM" : "ran out of time");
console.log(`plough ${s.plough}, helpers ${JSON.stringify(s.helpers)}, £${(E.helperWork(s) * E.payPerWork(s)).toFixed(0)}/s, lessons ${s.lessons.length}, liquidations ${s.liquidations}`);
