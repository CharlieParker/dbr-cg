/* Plays through in a phone-sized browser, saving screenshots to a folder.
   Usage: node tools/playtest.js output-folder */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = process.cwd(), shots = process.argv[2];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((q, r) => {
  const f = path.join(root, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => e ? (r.writeHead(404), r.end()) : (r.writeHead(200, { 'content-type': types[path.extname(f)] }), r.end(d)));
}).listen(8123);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 780 }, hasTouch: true });
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => m.type() === 'error' && !/fonts|ERR_TUNNEL/.test(m.text() + m.location().url) && errors.push(m.text()));
  await p.goto('http://localhost:8123/');
  await p.waitForTimeout(300);
  const tap = async (n) => { for (let i = 0; i < n; i++) await p.mouse.click(200, 330); };
  await tap(25); await p.waitForTimeout(3200);
  await p.waitForSelector('#purse:not([hidden])');
  for (let i = 0; i < 60; i++) {
    await tap(4);
    for (const btn of await p.$$('#rows button.item:not(:disabled):not(.go)')) await btn.click({ timeout: 300 }).catch(() => {});
  }
  await p.screenshot({ path: `${shots}/a-day.png` });
  await p.click('#tab-stats'); await p.waitForTimeout(150);
  await p.screenshot({ path: `${shots}/b-stats.png` });
  await p.click('#tab-main'); await p.waitForTimeout(150);
  await p.locator('.item.go').click({ timeout: 2000 }).catch(async () => { await tap(60); await p.locator('.item.go').click(); });
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${shots}/c-barn.png` });
  await p.locator('.item.go').click(); await p.waitForTimeout(200);
  const day2 = await p.textContent('#rate');
  // Jump ahead to the bear with a doctored save.
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('bull-run-escape') || 'null');
    Object.assign(s, { stage: 3, paperFound: true, phase: 'night', issues: 1, money: 130000, lifetime: 150000, day: 19,
      report: { day: 18, furrows: 90, earned: 21000, took: 26000 }, flipsLeft: 1,
      helpers: { chicken: 14, sheep: 8, goat: 6, tractor: 3 }, rebellions: ['raise', 'union', 'strike', 'lawyer'], lessons: ['flip2', 'index', 'moo', 'lev2'] });
    s.beats.push('paper'); localStorage.setItem('bull-run-escape', JSON.stringify(s)); Storage.prototype.setItem = () => {};
  });
  await p.reload(); await p.waitForTimeout(400);
  await p.screenshot({ path: `${shots}/d-door.png` });
  await p.click('#door'); await p.waitForTimeout(700);
  await p.getByRole('button', { name: 'Bet 10%' }).click(); await p.waitForTimeout(200);
  await p.getByRole('button', { name: 'Buy 25%' }).first().click();
  await p.getByRole('button', { name: 'Buy 25%' }).nth(1).click();
  await p.getByRole('button', { name: '2×' }).click();
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${shots}/e-bear.png` });
  await p.locator('.item.go').click(); await p.waitForTimeout(500);
  await p.screenshot({ path: `${shots}/f-morning.png` });
  await p.click('#sheet-close'); await p.waitForTimeout(250);
  await p.screenshot({ path: `${shots}/g-day19.png` });
  console.log({ day2, overflowX: await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), errors });
  await b.close(); server.close();
})().catch(e => { console.error(e); server.close(); process.exit(1); });
