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
  p.on('console', m => m.type() === 'error' && !/fonts/.test(m.text()) && errors.push(m.text()));
  await p.goto('http://localhost:8123/');
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${shots}/1-start.png` });
  const tap = async (n) => { for (let i = 0; i < n; i++) await p.mouse.click(120, 300); };
  await tap(14); await p.waitForTimeout(100);
  await p.screenshot({ path: `${shots}/2-graze.png` });
  await tap(11); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${shots}/3-man.png` });
  await p.waitForTimeout(1600);
  await tap(30); await p.waitForTimeout(200);
  await p.screenshot({ path: `${shots}/4-plough.png` });
  const buyAll = async () => { for (const btn of await p.$$('#shop .item:not(:disabled)')) { await btn.click({ timeout: 500 }).catch(() => {}); } };
  for (let i = 0; i < 60; i++) { await tap(5); await buyAll(); }
  await p.screenshot({ path: `${shots}/5-shop.png` });
  // Reload to prove the save restores, with enough money to reach the paper.
  await p.waitForTimeout(5200);
  const before = await p.textContent('#money');
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('bull-run-escape')); s.money = 5000; s.lifetime = 5000; s.helpers.goat = 2; s.rebellions = ['raise','union','strike']; localStorage.setItem('bull-run-escape', JSON.stringify(s)); Storage.prototype.setItem = () => {}; });
  await p.reload();
  await p.waitForSelector('#paper:not([hidden])', { timeout: 4000 });
  await p.waitForTimeout(4200);
  await p.screenshot({ path: `${shots}/6-paper-arrives.png` });
  await p.click('#paper', { force: true });
  await p.waitForTimeout(450);
  await p.screenshot({ path: `${shots}/7-paper.png` });
  await p.click('#sheet-close');
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${shots}/8-stage3.png` });
  console.log({ before, overflowX: await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), errors });
  await b.close(); server.close();
})().catch(e => { console.error(e); server.close(); process.exit(1); });
