/* Plays the game with a simple bot to check the pacing.
   Usage: node tools/simulate.js [taps per second] */
require("../engine.js");
const E = globalThis.BullEngine;
const tapsPerSecond = Number(process.argv[2] || 4);
const s = E.newGame();
const log = (what) => console.log(`${String(Math.round(s.clock)).padStart(5)}s  £${s.lifetime.toFixed(0).padStart(7)} earned  ${what}`);
const step = 0.25;
const tapsEachStep = tapsPerSecond * step;
let owed = 0;

while (!s.finished && s.clock < 3600) {
  E.tick(s, step);
  owed += tapsEachStep;
  while (owed >= 1) {
    owed -= 1;
    if (s.stage === 1) {
      E.bite(s);
      if (s.belly >= 100) { E.startWork(s); log("put to work"); }
    } else E.plough(s);
  }
  if (E.paperIsHere(s)) { E.findPaper(s); log("found the newspaper"); }
  const r = E.nextRebellion(s);
  if (r && E.canSeeRebellion(s, r) && s.money >= r.cost) { E.buyRebellion(s, r.id); log(`${r.name}: cut now ${E.cut(s) * 100}%`); }
  if (s.stage === 3 && s.money >= E.ISSUES[s.issues].cost) { const h = E.ISSUES[s.issues].headline; E.readIssue(s); log(`read: ${h}`); }
  // Saves up for the next big purchase once it is within about 20 seconds.
  const income = E.incomePerSecond(s) + tapsPerSecond * E.tapWork(s) * E.payPerWork(s);
  const saving = (r && E.canSeeRebellion(s, r) && r.cost < s.money + income * 20) ||
    (s.stage === 3 && E.ISSUES[s.issues] && E.ISSUES[s.issues].cost < s.money + income * 20);
  if (saving) continue;
  const options = E.HELPERS.map((h) => ({ cost: E.costOfHelper(s, h), gain: h.work, buy: () => E.buyHelper(s, h.id) }));
  options.push({ cost: E.costOfPlough(s), gain: tapsPerSecond * E.PLOUGH.work, buy: () => E.buyPlough(s) });
  const best = options.filter((o) => o.cost <= s.money).sort((a, b) => b.gain / b.cost - a.gain / a.cost)[0];
  if (best) best.buy();
}
log("finished");
console.log(`plough ${s.plough}, helpers ${JSON.stringify(s.helpers)}, income £${E.incomePerSecond(s).toFixed(0)}/s, the Man took £${s.manTook.toFixed(0)}`);
