/* A small line chart drawn as SVG, used by every graph in the game. */
(function () {
  "use strict";
  const H = 170;
  const PAD = { top: 12, right: 12, bottom: 22, left: 50 };

  function niceTicks(lo, hi) {
    const range = hi - lo || Math.abs(hi) || 1;
    const rough = range / 3;
    const power = Math.pow(10, Math.floor(Math.log10(rough)));
    const step = [1, 2, 5, 10].map((m) => m * power).find((v) => v >= rough);
    const first = Math.floor(lo / step) * step;
    const ticks = [];
    for (let v = first; v <= hi + step * 0.999; v += step) ticks.push(v);
    return ticks;
  }

  // options: { days, series: [{ name, color, values }], format }
  function draw(el, options) {
    const { days, series, format } = options;
    const width = el.clientWidth || 340;
    if (days.length < 2) {
      el.innerHTML = `<p class="chart-empty">This graph starts after your second night.</p>`;
      return;
    }
    const all = series.flatMap((s) => s.values);
    const ticks = niceTicks(Math.min(...all, options.zero ? 0 : Infinity), Math.max(...all, options.zero ? 0 : -Infinity));
    const lo = ticks[0];
    const hi = ticks[ticks.length - 1];
    const x = (i) => PAD.left + (i / (days.length - 1)) * (width - PAD.left - PAD.right);
    const y = (v) => PAD.top + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.top - PAD.bottom);
    const grid = ticks.map((t) => `<line x1="${PAD.left}" x2="${width - PAD.right}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${PAD.left - 6}" y="${y(t) + 4}" text-anchor="end">${format(t)}</text>`).join("");
    const lines = series.map((s) => {
      const d = s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
      const end = s.values.length - 1;
      return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${x(end)}" cy="${y(s.values[end])}" r="4" fill="${s.color}" stroke="#1E2340" stroke-width="2"/>`;
    }).join("");
    const legend = series.length > 1
      ? `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join("")}</div>` : "";
    el.innerHTML = `<div class="chart-tip" hidden></div><svg viewBox="0 0 ${width} ${H}" width="100%" height="${H}" role="img" aria-label="Line graph from day ${days[0]} to day ${days[days.length - 1]}">
      ${grid}<text x="${PAD.left}" y="${H - 5}">Day ${days[0]}</text><text x="${width - PAD.right}" y="${H - 5}" text-anchor="end">Day ${days[days.length - 1]}</text>
      ${lines}<line class="cross" y1="${PAD.top}" y2="${H - PAD.bottom}" hidden/></svg>${legend}`;

    // Touch or hover anywhere on the graph to read that day's values.
    const svg = el.querySelector("svg");
    const tip = el.querySelector(".chart-tip");
    const cross = el.querySelector(".cross");
    function show(e) {
      const box = svg.getBoundingClientRect();
      const ratio = (e.clientX - box.left - PAD.left) / (box.width - PAD.left - PAD.right);
      const i = Math.max(0, Math.min(days.length - 1, Math.round(ratio * (days.length - 1))));
      cross.removeAttribute("hidden");
      cross.setAttribute("x1", x(i));
      cross.setAttribute("x2", x(i));
      tip.hidden = false;
      tip.textContent = `Day ${days[i]}: ` + series.map((s) => (series.length > 1 ? `${s.name} ` : "") + format(s.values[i])).join(", ");
    }
    svg.addEventListener("pointerdown", show);
    svg.addEventListener("pointermove", show);
    svg.addEventListener("pointerleave", () => { tip.hidden = true; cross.setAttribute("hidden", ""); });
  }

  window.BullCharts = { draw };
})();
