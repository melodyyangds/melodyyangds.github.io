/* Small chart kit for the portfolio data visualization pages.
   No dependencies. Every chart re-renders on resize and has a hover/focus tooltip.
   All data on these pages is synthetic and generated in the browser from a fixed seed. */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const VZ = {};

  /* ---------- data helpers ---------- */
  VZ.rng = function (seed) {           // mulberry32, deterministic
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  VZ.gauss = function (r) {             // Box-Muller
    let u = 0, v = 0;
    while (u === 0) u = r();
    while (v === 0) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  VZ.poisson = function (r, lambda) {
    if (lambda > 40) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * VZ.gauss(r)));
    const L = Math.exp(-lambda); let k = 0, p = 1;
    do { k++; p *= r(); } while (p > L);
    return k - 1;
  };
  VZ.sum = (a) => a.reduce((s, v) => s + v, 0);
  VZ.median = function (a) {
    if (!a.length) return 0;
    const s = a.slice().sort((x, y) => x - y), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  VZ.fmt = function (n, d) {
    if (n == null || isNaN(n)) return "–";
    return Number(n).toLocaleString("en-US", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  };
  VZ.pct = (n, d) => VZ.fmt(n * 100, d == null ? 0 : d) + "%";
  VZ.css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function niceStep(range, count) {
    const raw = range / Math.max(1, count), mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  }
  VZ.ticks = function (min, max, count) {
    if (max === min) max = min + 1;
    const step = niceStep(max - min, count || 4);
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, out = [];
    for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(10));
    return out;
  };

  /* ---------- DOM helpers ---------- */
  function s(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, x, y, str, cls, extra) {
    const t = s("text", Object.assign({ x: x, y: y, class: cls || "ax" }, extra || {}), parent);
    t.textContent = str;
    return t;
  }
  VZ.s = s; VZ.txt = txt;
  function h(tag, cls, parent, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  VZ.h = h;
  function svgFor(el, height) {
    el.innerHTML = "";
    const w = Math.max(260, Math.round(el.clientWidth || 600));
    const svg = s("svg", { viewBox: "0 0 " + w + " " + height, width: w, height: height, role: "img" }, el);
    svg.style.width = "100%"; svg.style.height = "auto";
    if (el.dataset.label) svg.setAttribute("aria-label", el.dataset.label);
    return { svg: svg, w: w, h: height };
  }

  /* ---------- tooltip (one per page) ---------- */
  let tipEl = null;
  function tip() {
    if (!tipEl) { tipEl = h("div", "vz-tip", document.body); tipEl.setAttribute("role", "status"); }
    return tipEl;
  }
  // rows: [{label, value, color}]
  VZ.showTip = function (x, y, title, rows) {
    const t = tip();
    t.innerHTML = "";
    if (title) h("div", "t", t, title);
    rows.forEach(function (r) {
      const row = h("div", "r", t);
      const k = h("i", null, row);
      k.style.background = r.color || "transparent";
      if (!r.color) k.style.width = "0";
      h("span", null, row, r.label);
      h("b", null, row, r.value);
    });
    t.classList.add("on");
    const bw = t.offsetWidth, bh = t.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    let lx = x + 14, ly = y - bh - 12;
    if (lx + bw > vw - 8) lx = x - bw - 14;
    if (lx < 8) lx = 8;
    if (ly < 8) ly = y + 18;
    if (ly + bh > vh - 8) ly = vh - bh - 8;
    t.style.left = lx + "px"; t.style.top = ly + "px";
  };
  VZ.hideTip = function () { if (tipEl) tipEl.classList.remove("on"); };
  window.addEventListener("scroll", VZ.hideTip, { passive: true });

  function bindMark(node, getTip, group) {
    node.setAttribute("tabindex", "0");
    node.classList.add("mark-hover");
    const on = function (e) {
      const t = getTip();
      let x, y;
      if (e && e.clientX != null && e.type !== "focus") { x = e.clientX; y = e.clientY; }
      else { const b = node.getBoundingClientRect(); x = b.left + b.width / 2; y = b.top; }
      VZ.showTip(x, y, t.title, t.rows);
      if (group) { group.classList.add("dim"); node.classList.add("on"); }
    };
    const off = function () { VZ.hideTip(); if (group) { group.classList.remove("dim"); node.classList.remove("on"); } };
    node.addEventListener("pointermove", on);
    node.addEventListener("pointerleave", off);
    node.addEventListener("focus", on);
    node.addEventListener("blur", off);
  }
  VZ.bindMark = bindMark;

  /* rounded-top bar path (4px data end, square at baseline) */
  function barPath(x, y, w, hgt, r, dir) {
    r = Math.max(0, Math.min(r, w / 2, Math.abs(hgt)));
    if (hgt <= 0) return "";
    if (dir === "right") {        // horizontal bar: rounded on the right end
      return "M" + x + "," + y + "h" + (w - r) + "a" + r + "," + r + " 0 0 1 " + r + "," + r +
        "v" + (hgt - 2 * r) + "a" + r + "," + r + " 0 0 1 " + (-r) + "," + r + "h" + (-(w - r)) + "z";
    }
    if (dir === "down") {         // vertical bar hanging below baseline: rounded at the bottom
      return "M" + x + "," + y + "h" + w + "v" + (hgt - r) + "a" + r + "," + r + " 0 0 1 " + (-r) + "," + r +
        "h" + (-(w - 2 * r)) + "a" + r + "," + r + " 0 0 1 " + (-r) + "," + (-r) + "z";
    }
    return "M" + x + "," + (y + hgt) + "v" + (-(hgt - r)) + "a" + r + "," + r + " 0 0 1 " + r + "," + (-r) +
      "h" + (w - 2 * r) + "a" + r + "," + r + " 0 0 1 " + r + "," + r + "v" + (hgt - r) + "z";
  }
  VZ.barPath = barPath;

  /* ---------- legend ---------- */
  VZ.legend = function (el, items, kind) {
    el.innerHTML = "";
    items.forEach(function (it) {
      const sp = h("span", null, el);
      const i = h("i", kind === "line" ? "ln" : null, sp);
      i.style.background = it.color;
      sp.appendChild(document.createTextNode(it.name));
    });
  };

  /* ---------- line chart with crosshair ----------
     opts: labels[], series[{name,color,values}], height, yFmt, tickEvery, yMin, yMax,
           marks[{i,label}] (vertical annotation), area (bool, single series) */
  VZ.line = function (el, o) {
    const H = o.height || 260;
    const g = svgFor(el, H), svg = g.svg, W = g.w;
    const endLabels = o.series.length > 1 && o.series.length <= 4 && W > 480;
    const m = { t: 14, r: endLabels ? 96 : 16, b: 28, l: 44 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b, n = o.labels.length;
    let all = []; o.series.forEach((sr) => (all = all.concat(sr.values.filter((v) => v != null))));
    const yt = VZ.ticks(o.yMin != null ? o.yMin : Math.min(0, Math.min.apply(null, all)), o.yMax != null ? o.yMax : Math.max.apply(null, all), 4);
    const y0 = yt[0], y1 = yt[yt.length - 1];
    const X = (i) => m.l + (n === 1 ? pw / 2 : (i / (n - 1)) * pw);
    const Y = (v) => m.t + ph - ((v - y0) / (y1 - y0)) * ph;
    const yF = o.yFmt || ((v) => VZ.fmt(v));
    yt.forEach(function (v) {
      s("line", { x1: m.l, x2: m.l + pw, y1: Y(v), y2: Y(v), class: v === y0 ? "baseline" : "gridline" }, svg);
      txt(svg, m.l - 8, Y(v) + 4, yF(v), "ax", { "text-anchor": "end" });
    });
    const base = o.tickEvery || 1, need = Math.ceil(n / Math.max(2, Math.floor(pw / 62)));
    const every = base * Math.ceil(need / base);   // multiples of the requested step, never closer than ~62px
    for (let i = 0; i < n; i += every) txt(svg, X(i), H - 8, o.labels[i], "ax", { "text-anchor": "middle" });
    (o.marks || []).forEach(function (mk) {
      s("line", { x1: X(mk.i), x2: X(mk.i), y1: m.t, y2: m.t + ph, stroke: "#B8A88C", "stroke-width": 1 }, svg);
      txt(svg, X(mk.i) + 6, m.t + 10, mk.label, "lb2");
    });
    o.series.forEach(function (sr) {
      let d = "", started = false;
      sr.values.forEach(function (v, i) {
        if (v == null) { started = false; return; }
        d += (started ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1); started = true;
      });
      if (o.area && o.series.length === 1) {
        s("path", { d: d + "L" + X(n - 1) + "," + Y(y0) + "L" + X(0) + "," + Y(y0) + "Z", fill: sr.color, opacity: 0.1 }, svg);
      }
      s("path", { d: d, fill: "none", stroke: sr.color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
    });
    if (endLabels) {   // direct labels at the line ends, nudged apart
      const ends = o.series.map(function (sr) {
        let i = sr.values.length - 1; while (i > 0 && sr.values[i] == null) i--;
        return { name: sr.name, color: sr.color, y: Y(sr.values[i]), x: X(i) };
      }).sort((a, b) => a.y - b.y);
      for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 14) ends[k].y = ends[k - 1].y + 14;
      ends.forEach(function (e) {
        s("circle", { cx: e.x, cy: e.y, r: 0 }, svg);
        txt(svg, m.l + pw + 8, e.y + 4, e.name, "lb");
      });
    }
    // crosshair layer
    const cross = s("line", { y1: m.t, y2: m.t + ph, stroke: "#8C8374", "stroke-width": 1, opacity: 0 }, svg);
    const dots = o.series.map((sr) => s("circle", { r: 4.5, fill: sr.color, stroke: "#fff", "stroke-width": 2, opacity: 0 }, svg));
    const hit = s("rect", { x: m.l - 6, y: m.t, width: pw + 12, height: ph, class: "hit", tabindex: 0 }, svg);
    hit.setAttribute("aria-label", (el.dataset.label || "Line chart") + ". Use left and right arrow keys to read values.");
    let cur = n - 1;
    function show(i, cx, cy) {
      cur = i;
      cross.setAttribute("x1", X(i)); cross.setAttribute("x2", X(i)); cross.setAttribute("opacity", 1);
      o.series.forEach(function (sr, k) {
        const v = sr.values[i];
        dots[k].setAttribute("opacity", v == null ? 0 : 1);
        if (v != null) { dots[k].setAttribute("cx", X(i)); dots[k].setAttribute("cy", Y(v)); }
      });
      const rows = o.series.map((sr) => ({ label: sr.name, value: sr.values[i] == null ? "–" : yF(sr.values[i]), color: sr.color }));
      if (o.extraTip) rows.push.apply(rows, o.extraTip(i));
      VZ.showTip(cx, cy, o.tipTitle ? o.tipTitle(i) : o.labels[i], rows);
    }
    function idx(e) {
      const b = svg.getBoundingClientRect(), sx = (e.clientX - b.left) * (W / b.width);
      return Math.max(0, Math.min(n - 1, Math.round(((sx - m.l) / pw) * (n - 1))));
    }
    function hide() { cross.setAttribute("opacity", 0); dots.forEach((d) => d.setAttribute("opacity", 0)); VZ.hideTip(); }
    hit.addEventListener("pointermove", (e) => show(idx(e), e.clientX, e.clientY));
    hit.addEventListener("pointerleave", hide);
    hit.addEventListener("blur", hide);
    function kpos() { const b = svg.getBoundingClientRect(); return [b.left + (X(cur) / W) * b.width, b.top + 20]; }
    hit.addEventListener("focus", function () { const p = kpos(); show(cur, p[0], p[1]); });
    hit.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault(); cur = Math.max(0, Math.min(n - 1, cur + (e.key === "ArrowLeft" ? -1 : 1)));
        const p = kpos(); show(cur, p[0], p[1]);
      }
    });
  };

  /* ---------- horizontal ranked bars ----------
     opts: data[{label,value,color?,tip?}], color, fmt, rowH, labelW */
  VZ.hbar = function (el, o) {
    const rowH = o.rowH || 30, H = o.data.length * rowH + 8;
    const g = svgFor(el, H), svg = g.svg, W = g.w;
    const lw = o.labelW || Math.min(150, Math.round(W * 0.34)), vr = 54;
    const pw = W - lw - vr, max = o.max || Math.max.apply(null, o.data.map((d) => d.value)) || 1;
    const F = o.fmt || ((v) => VZ.fmt(v));
    const grp = s("g", null, svg);
    o.data.forEach(function (d, i) {
      const y = 4 + i * rowH, bh = rowH - 10, w = Math.max(2, (d.value / max) * pw);
      txt(svg, lw - 10, y + bh / 2 + 4, d.label, "lb2", { "text-anchor": "end" });
      const p = s("path", { d: barPath(lw, y, w, bh, 4, "right"), fill: d.color || o.color }, grp);
      txt(svg, lw + w + 6, y + bh / 2 + 4, F(d.value), "lb");
      const hitR = s("rect", { x: 0, y: y - 4, width: W, height: rowH, fill: "transparent" }, grp);
      const t = () => d.tip || { title: d.label, rows: [{ label: o.valueName || "Value", value: F(d.value), color: d.color || o.color }] };
      bindMark(hitR, t);
      hitR.addEventListener("pointerenter", () => p.setAttribute("opacity", 0.8));
      hitR.addEventListener("pointerleave", () => p.setAttribute("opacity", 1));
    });
  };

  /* ---------- horizontal 100% / absolute stacked bars ----------
     opts: rows[{label, values[]}], series[{name,color}], fmt, percent(bool) */
  VZ.stackH = function (el, o) {
    const rowH = o.rowH || 32, H = o.rows.length * rowH + 8;
    const g = svgFor(el, H), svg = g.svg, W = g.w;
    const lw = o.labelW || Math.min(150, Math.round(W * 0.32)), vr = o.percent ? 8 : 54, pw = W - lw - vr;
    const max = o.percent ? 1 : Math.max.apply(null, o.rows.map((r) => VZ.sum(r.values))) || 1;
    const F = o.fmt || ((v) => VZ.fmt(v));
    o.rows.forEach(function (r, i) {
      const y = 4 + i * rowH, bh = rowH - 12, tot = VZ.sum(r.values);
      txt(svg, lw - 10, y + bh / 2 + 4, r.label, "lb2", { "text-anchor": "end" });
      let x = lw;
      r.values.forEach(function (v, k) {
        const share = o.percent ? (tot ? v / tot : 0) : v / max, w = share * pw;
        if (w <= 0) return;
        const last = k === r.values.length - 1 || r.values.slice(k + 1).every((z) => !z);
        const ww = Math.max(1, w - (last ? 0 : 2));
        const node = last ? s("path", { d: barPath(x, y, ww, bh, 4, "right"), fill: o.series[k].color }, svg)
          : s("rect", { x: x, y: y, width: ww, height: bh, fill: o.series[k].color }, svg);
        if (o.percent && ww > 34) txt(svg, x + ww / 2, y + bh / 2 + 4, VZ.pct(share), "ax", { "text-anchor": "middle", fill: "#fff", style: "fill:#fff;font-weight:600" });
        bindMark(node, () => ({
          title: r.label,
          rows: o.series.map((sr, j) => ({ label: sr.name, value: F(r.values[j]) + (o.percent && tot ? "  (" + VZ.pct(r.values[j] / tot) + ")" : ""), color: sr.color }))
        }));
        x += w;
      });
      if (!o.percent) txt(svg, x + 6, y + bh / 2 + 4, F(tot), "lb");
    });
  };

  /* ---------- vertical bars, optional cumulative % line on the SAME percent axis (Pareto) ----------
     opts: labels[], values[] (shares 0..1 when pareto), color, cumulative(bool), threshold */
  VZ.vbar = function (el, o) {
    const H = o.height || 250, g = svgFor(el, H), svg = g.svg, W = g.w;
    const m = { t: 16, r: 14, b: 40, l: 44 }, pw = W - m.l - m.r, ph = H - m.t - m.b, n = o.labels.length;
    const pct = !!o.percent;
    const top = pct ? 1 : Math.max.apply(null, o.values);
    const yt = pct ? [0, 0.25, 0.5, 0.75, 1] : VZ.ticks(0, top, 4);
    const y1 = yt[yt.length - 1];
    const Y = (v) => m.t + ph - (v / y1) * ph;
    const F = o.fmt || ((v) => (pct ? VZ.pct(v) : VZ.fmt(v)));
    yt.forEach(function (v) {
      s("line", { x1: m.l, x2: m.l + pw, y1: Y(v), y2: Y(v), class: v === 0 ? "baseline" : "gridline" }, svg);
      txt(svg, m.l - 8, Y(v) + 4, F(v), "ax", { "text-anchor": "end" });
    });
    const slot = pw / n, bw = Math.min(46, slot - 2 - slot * 0.28);
    let cum = 0; const pts = [];
    o.labels.forEach(function (lab, i) {
      const v = o.values[i], x = m.l + i * slot + (slot - bw) / 2;
      cum += v; pts.push([m.l + i * slot + slot / 2, Y(cum), cum]);
      const node = s("path", { d: barPath(x, Y(v), bw, Y(0) - Y(v), 4), fill: (o.colors && o.colors[i]) || o.color }, svg);
      const words = String(lab).split(" ");
      const l1 = words.slice(0, Math.ceil(words.length / 2)).join(" "), l2 = words.slice(Math.ceil(words.length / 2)).join(" ");
      txt(svg, m.l + i * slot + slot / 2, H - 24, slot < 70 ? lab.split(" ")[0] : l1, "ax", { "text-anchor": "middle" });
      if (slot >= 70 && l2) txt(svg, m.l + i * slot + slot / 2, H - 11, l2, "ax", { "text-anchor": "middle" });
      bindMark(node, function () {
        const rows = [{ label: o.valueName || "Share", value: F(v), color: (o.colors && o.colors[i]) || o.color }];
        if (o.cumulative) rows.push({ label: "Cumulative", value: VZ.pct(pts[i][2]), color: VZ.css("--ink") });
        if (o.extraTip) rows.push.apply(rows, o.extraTip(i));
        return { title: lab, rows: rows };
      });
    });
    if (o.cumulative) {
      if (o.threshold) {
        s("line", { x1: m.l, x2: m.l + pw, y1: Y(o.threshold), y2: Y(o.threshold), stroke: "#B8A88C", "stroke-width": 1 }, svg);
        txt(svg, m.l + pw - 2, Y(o.threshold) - 5, VZ.pct(o.threshold) + " line", "ax", { "text-anchor": "end" });
      }
      s("polyline", { points: pts.map((p) => p[0] + "," + p[1]).join(" "), fill: "none", stroke: VZ.css("--ink"), "stroke-width": 2, "stroke-linejoin": "round" }, svg);
      pts.forEach((p) => s("circle", { cx: p[0], cy: p[1], r: 4, fill: VZ.css("--ink"), stroke: "#fff", "stroke-width": 2 }, svg));
    }
  };

  /* ---------- diverging vertical bars (added above, removed below) ---------- */
  VZ.diverge = function (el, o) {
    const H = o.height || 240, g = svgFor(el, H), svg = g.svg, W = g.w;
    const m = { t: 12, r: 12, b: 26, l: 44 }, pw = W - m.l - m.r, ph = H - m.t - m.b, n = o.labels.length;
    const mx = Math.max(Math.max.apply(null, o.pos.values), Math.max.apply(null, o.neg.values));
    const yt = VZ.ticks(-mx, mx, 4), y0 = yt[0], y1 = yt[yt.length - 1];
    const Y = (v) => m.t + ph - ((v - y0) / (y1 - y0)) * ph;
    yt.forEach(function (v) {
      s("line", { x1: m.l, x2: m.l + pw, y1: Y(v), y2: Y(v), class: v === 0 ? "baseline" : "gridline" }, svg);
      txt(svg, m.l - 8, Y(v) + 4, VZ.fmt(Math.abs(v)), "ax", { "text-anchor": "end" });
    });
    const slot = pw / n, bw = Math.min(26, slot * 0.62);
    o.labels.forEach(function (lab, i) {
      const x = m.l + i * slot + (slot - bw) / 2, a = o.pos.values[i], r = o.neg.values[i];
      s("path", { d: barPath(x, Y(a), bw, Y(0) - Y(a) - 1, 4), fill: o.pos.color }, svg);
      s("path", { d: barPath(x, Y(0) + 1, bw, Y(-r) - Y(0) - 1, 4, "down"), fill: o.neg.color }, svg);
      if (i % Math.ceil(n / Math.floor(pw / 52)) === 0) txt(svg, x + bw / 2, H - 8, lab, "ax", { "text-anchor": "middle" });
      const hitR = s("rect", { x: m.l + i * slot, y: m.t, width: slot, height: ph, fill: "transparent" }, svg);
      bindMark(hitR, () => ({ title: lab, rows: [
        { label: o.pos.name, value: VZ.fmt(a), color: o.pos.color },
        { label: o.neg.name, value: VZ.fmt(r), color: o.neg.color },
        { label: "Net change", value: (a - r >= 0 ? "+" : "") + VZ.fmt(a - r) }] }));
    });
  };

  /* ---------- heatmap (sequential, one hue) ----------
     opts: rows[], cols[], values[r][c], ramp[], flags[r][c] (count of late items), tip(r,c) */
  VZ.heat = function (el, o) {
    const W0 = Math.max(260, el.clientWidth || 600);
    const lw = Math.min(150, Math.round(W0 * 0.3)), cols = o.cols.length;
    const cw = (W0 - lw - 6) / cols, ch = Math.min(34, Math.max(22, cw * 0.8));
    const H = o.rows.length * ch + 26;
    const g = svgFor(el, H), svg = g.svg;
    const vals = [].concat.apply([], o.values), max = Math.max.apply(null, vals) || 1;
    const ramp = o.ramp, bins = ramp.length;
    const colorOf = (v) => (v === 0 ? "#F4EFE6" : ramp[Math.min(bins - 1, Math.floor((v / (max + 0.0001)) * bins))]);
    o.rows.forEach(function (rl, r) {
      txt(svg, lw - 10, 4 + r * ch + ch / 2 + 4, rl, "lb2", { "text-anchor": "end" });
      o.cols.forEach(function (cl, c) {
        const x = lw + c * cw, y = 4 + r * ch, v = o.values[r][c];
        const cell = s("rect", { x: x + 1, y: y + 1, width: cw - 2, height: ch - 2, rx: 3, fill: colorOf(v) }, svg);
        if (o.flags && o.flags[r][c] > 0) {
          s("rect", { x: x + 2, y: y + 2, width: cw - 4, height: ch - 4, rx: 3, fill: "none", stroke: VZ.css("--critical"), "stroke-width": 2 }, svg);
          txt(svg, x + cw / 2, y + ch / 2 + 4, "!", "lb", { "text-anchor": "middle", style: "fill:" + VZ.css("--critical") + ";font-weight:800" });
        }
        bindMark(cell, () => o.tip(r, c));
      });
    });
    const every = Math.ceil(cols / Math.max(3, Math.floor((W0 - lw) / 34)));
    o.cols.forEach(function (cl, c) { if (c % every === 0) txt(svg, lw + c * cw + cw / 2, H - 6, cl, "ax", { "text-anchor": "middle" }); });
    return { colorOf: colorOf, max: max };
  };

  /* ---------- control chart (P-chart or I / MR) ----------
     opts: labels[], values[], cl[], ucl[], lcl[] (per point, stepped by phase),
           phaseAt (index where the improved process starts), yFmt, color, signal(i) -> bool */
  VZ.control = function (el, o) {
    const H = o.height || 250, g = svgFor(el, H), svg = g.svg, W = g.w;
    const m = { t: 22, r: 50, b: 26, l: 46 }, pw = W - m.l - m.r, ph = H - m.t - m.b, n = o.values.length;
    const hiV = Math.max(Math.max.apply(null, o.values), Math.max.apply(null, o.ucl));
    const yt = VZ.ticks(0, hiV * 1.05, 4), y1 = yt[yt.length - 1];
    const X = (i) => m.l + (i / (n - 1)) * pw, Y = (v) => m.t + ph - (v / y1) * ph;
    const F = o.yFmt || ((v) => VZ.fmt(v, 1));
    yt.forEach(function (v) {
      s("line", { x1: m.l, x2: m.l + pw, y1: Y(v), y2: Y(v), class: v === 0 ? "baseline" : "gridline" }, svg);
      txt(svg, m.l - 8, Y(v) + 4, F(v), "ax", { "text-anchor": "end" });
    });
    if (o.phaseAt != null) {
      const px = (X(o.phaseAt - 1) + X(o.phaseAt)) / 2;
      s("rect", { x: px, y: m.t, width: m.l + pw - px, height: ph, fill: "#F3FAF8" }, svg);
      s("line", { x1: px, x2: px, y1: m.t - 6, y2: m.t + ph, stroke: "#8C8374", "stroke-width": 1 }, svg);
      txt(svg, px - 6, m.t - 8, o.phaseLabels ? o.phaseLabels[0] : "Before", "lb2", { "text-anchor": "end" });
      txt(svg, px + 6, m.t - 8, o.phaseLabels ? o.phaseLabels[1] : "After", "lb2");
    }
    function stepped(arr, cls, stroke, w) {
      let d = "";
      for (let i = 0; i < n; i++) {
        const xL = i === 0 ? X(0) : (X(i - 1) + X(i)) / 2, xR = i === n - 1 ? X(n - 1) : (X(i) + X(i + 1)) / 2;
        d += (i === 0 ? "M" : "L") + xL.toFixed(1) + "," + Y(arr[i]).toFixed(1) + "L" + xR.toFixed(1) + "," + Y(arr[i]).toFixed(1);
      }
      s("path", { d: d, fill: "none", stroke: stroke, "stroke-width": w }, svg);
    }
    stepped(o.ucl, "", "#C9B8A0", 1.5);
    if (o.lcl.some((v) => v > 0)) stepped(o.lcl, "", "#C9B8A0", 1.5);
    stepped(o.cl, "", "#6B6152", 1.5);
    txt(svg, m.l + pw + 6, Y(o.ucl[n - 1]) + 4, "UCL", "ax");
    txt(svg, m.l + pw + 6, Y(o.cl[n - 1]) + 4, "CL", "ax");
    if (o.lcl[n - 1] > 0) txt(svg, m.l + pw + 6, Y(o.lcl[n - 1]) + 4, "LCL", "ax");
    let d = "";
    o.values.forEach((v, i) => (d += (i ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1)));
    s("path", { d: d, fill: "none", stroke: o.color, "stroke-width": 2, "stroke-linejoin": "round" }, svg);
    const every = Math.ceil(n / Math.max(3, Math.floor(pw / 60)));
    o.values.forEach(function (v, i) {
      const sig = o.signal ? o.signal(i) : (v > o.ucl[i] || v < o.lcl[i]);
      if (sig) {
        s("circle", { cx: X(i), cy: Y(v), r: 5, fill: VZ.css("--critical"), stroke: "#fff", "stroke-width": 2 }, svg);
      } else s("circle", { cx: X(i), cy: Y(v), r: 2.6, fill: o.color }, svg);
      if (i % every === 0) txt(svg, X(i), H - 8, o.labels[i], "ax", { "text-anchor": "middle" });
      const hitR = s("rect", { x: X(i) - pw / n / 2, y: m.t, width: pw / n, height: ph, fill: "transparent" }, svg);
      bindMark(hitR, function () {
        const rows = [{ label: o.valueName || "Value", value: F(v), color: o.color },
          { label: "Center line", value: F(o.cl[i]) }, { label: "Upper limit", value: F(o.ucl[i]) }];
        if (o.lcl[i] > 0) rows.push({ label: "Lower limit", value: F(o.lcl[i]) });
        if (o.extraTip) rows.push.apply(rows, o.extraTip(i));
        if (sig) rows.push({ label: "! Out of control", value: "investigate", color: VZ.css("--critical") });
        return { title: o.labels[i], rows: rows };
      });
    });
  };

  /* ---------- table view + CSV ---------- */
  VZ.table = function (wrap, cols, rows) {
    wrap.innerHTML = "";
    const t = h("table", "vt", wrap), thead = h("thead", null, t), tr = h("tr", null, thead);
    cols.forEach((c) => h("th", null, tr, c.label));
    const tb = h("tbody", null, t);
    rows.forEach(function (r) {
      const row = h("tr", null, tb);
      cols.forEach(function (c) {
        const v = r[c.key];
        h("td", c.num ? "n" : null, row, c.fmt ? c.fmt(v) : v);
      });
    });
  };
  VZ.csv = function (filename, cols, rows) {
    const esc = (v) => { const sv = String(v == null ? "" : v); return /[",\n]/.test(sv) ? '"' + sv.replace(/"/g, '""') + '"' : sv; };
    const body = [cols.map((c) => esc(c.label)).join(",")].concat(rows.map((r) => cols.map((c) => esc(r[c.key])).join(","))).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
    a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  /* wire a "Show table" toggle + "Download CSV" button pair */
  VZ.tableTools = function (root, getData, filename) {
    const tools = h("div", "tools", root);
    const btn = h("button", "tbtn", tools, "Show data table");
    btn.type = "button"; btn.setAttribute("aria-expanded", "false");
    const dl = h("button", "tbtn", tools, "Download sample data (CSV)"); dl.type = "button";
    const wrap = h("div", "tablewrap", root); wrap.hidden = true;
    function refresh() { if (!wrap.hidden) { const d = getData(); VZ.table(wrap, d.cols, d.rows); } }
    btn.addEventListener("click", function () {
      wrap.hidden = !wrap.hidden; btn.textContent = wrap.hidden ? "Show data table" : "Hide data table";
      btn.setAttribute("aria-expanded", String(!wrap.hidden)); refresh();
    });
    dl.addEventListener("click", function () { const d = getData(); VZ.csv(filename, d.cols, d.rows); });
    return refresh;
  };

  /* ---------- segmented control ---------- */
  VZ.seg = function (el, options, value, onChange) {
    el.innerHTML = "";
    options.forEach(function (op) {
      const b = h("button", null, el, op.label);
      b.type = "button"; b.setAttribute("aria-pressed", String(op.value === value));
      b.addEventListener("click", function () {
        [].forEach.call(el.children, (c) => c.setAttribute("aria-pressed", "false"));
        b.setAttribute("aria-pressed", "true"); onChange(op.value);
      });
    });
  };

  /* render now and again on resize (debounced) */
  VZ.mount = function (render) {
    let t = null;
    const run = function () { VZ.hideTip(); render(); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(run); else run();
    let lastW = window.innerWidth;
    window.addEventListener("resize", function () {
      if (window.innerWidth === lastW) return; lastW = window.innerWidth;
      clearTimeout(t); t = setTimeout(run, 120);
    });
  };

  /* ---------- page navigation: sticky bar + back card (one list for every page) ---------- */
  VZ.PAGES = [
    { f: "request-demand.html", t: "Request demand" },
    { f: "access-governance.html", t: "Access program" },
    { f: "rework-spc.html", t: "Rework charts" },
    { f: "inventory-adoption.html", t: "Inventory adoption" },
    { f: "pm-cal-compliance.html", t: "PM and calibration" }
  ];
  (function buildNav() {
    const cur = location.pathname.split("/").pop() || "";
    if (!VZ.PAGES.some((p) => p.f === cur)) return;
    const bar = h("nav", "dvbar"); bar.setAttribute("aria-label", "Dashboards");
    const w = h("div", "wrap", bar);
    const back = h("a", "back", w, "← Back to portfolio"); back.href = "../index.html#dataviz";
    const tabs = h("div", "tabs", w);
    VZ.PAGES.forEach(function (p) {
      const a = h("a", null, tabs, p.t); a.href = p.f;
      if (p.f === cur) a.setAttribute("aria-current", "page");
    });
    document.body.insertBefore(bar, document.body.firstChild);
    const on = tabs.querySelector("[aria-current]"); if (on) on.scrollIntoView({ block: "nearest", inline: "center" });
    const pager = document.querySelector(".pager");
    if (pager) {
      const card = document.createElement("a"); card.className = "home-card"; card.href = "../index.html#dataviz";
      const txtBox = h("span", null, card); h("small", null, txtBox, "Done here?"); h("strong", null, txtBox, "See all 5 dashboards and my other work");
      h("span", "go", card, "← Back to portfolio");
      pager.parentNode.insertBefore(card, pager);
      // prev / next dashboards, wrapping around, so the footer never repeats "back to portfolio"
      const i = VZ.PAGES.findIndex((p) => p.f === cur), n = VZ.PAGES.length;
      const prev = VZ.PAGES[(i - 1 + n) % n], next = VZ.PAGES[(i + 1) % n];
      pager.innerHTML = "";
      [[prev, "Previous dashboard", "← ", ""], [next, "Next dashboard", "", " →"]].forEach(function (x, k) {
        const link = h("a", k ? "next" : null, pager); link.href = x[0].f;
        h("small", null, link, x[1]); h("strong", null, link, x[2] + x[0].t + x[3]);
      });
    }
  })();

  /* "At a glance" card in the page header, filled from the Real outcome block on the same page */
  (function buildGlance() {
    const wrap = document.querySelector(".page-head .wrap"), ocs = document.querySelectorAll(".outcomes .oc");
    if (!wrap || !ocs.length) return;
    const main = document.createElement("div");
    while (wrap.firstChild) main.appendChild(wrap.firstChild);
    wrap.appendChild(main); wrap.classList.add("has-glance");
    const card = h("aside", "glance", wrap); card.setAttribute("aria-label", "Real outcome at a glance");
    const head = h("div", "glance-head", card); h("span", null, head, "Real outcome"); h("span", null, head, "At a glance");
    const ul = h("ul", null, card);
    const sec = ocs[0].closest("section"); if (sec) sec.hidden = true;   // same facts now live in the header card
    ocs.forEach(function (oc) {
      const li = h("li", null, ul), b = oc.querySelector("b"), sp = oc.querySelector("span");
      h("b", null, li, b ? b.textContent : ""); h("span", null, li, sp ? sp.textContent : "");
    });
  })();

  window.VZ = VZ;
})();
