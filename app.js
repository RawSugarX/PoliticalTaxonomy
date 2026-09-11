/* Towards a new taxonomy of politics — vanilla one-page questionnaire.
   Data comes from data.js (generated from taxanomy.xlsx by tools/xlsx_to_json.py). */
(function () {
  "use strict";

  var DATA = window.TAXONOMY_DATA;
  var STORE_KEY = "taxonomy.answers.v2";   // v2: Q25 options were reordered, so old indices are stale
  var DIMS = DATA.meta.dimensions;                  // ["Economic","Legal","Political"]
  var LIMIT = DATA.meta.scoring;                    // { min: -100, max: 100 }

  var VIEWS = [
    { id: "introduction",  label: "Introduction" },
    { id: "semantics",     label: "Semantics" },
    { id: "questionnaire", label: "Questionnaire" },
    { id: "results",       label: "Results" }
  ];

  var state = { view: "introduction", index: 0, answers: load() };

  /* ---------------- storage ---------------- */
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state.answers)); } catch (e) {}
  }

  /* ---------------- helpers ---------------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function clamp(v) { return Math.max(LIMIT.min, Math.min(LIMIT.max, v)); }
  function answered() { return DATA.questions.filter(function (q) { return state.answers[q.id] != null; }).length; }

  /* ---------------- scoring ----------------
     Mirrors the workbook: per dimension, sum the chosen options' benefit and
     control weights, then clamp each sum to [-100, 100].                     */
  function scores() {
    var out = {};
    DIMS.forEach(function (d) { out[d] = { benefit: 0, control: 0, answered: 0, total: 0 }; });
    DATA.questions.forEach(function (q) {
      var s = out[q.dimension];
      s.total++;
      var pick = state.answers[q.id];
      if (pick == null) return;
      s.answered++;
      s.benefit += q.options[pick].benefit;
      s.control += q.options[pick].control;
    });
    DIMS.forEach(function (d) {
      out[d].benefit = clamp(out[d].benefit);
      out[d].control = clamp(out[d].control);
    });
    return out;
  }

  /* Derived 3x3 label, in the spirit of the nine positions in the Introduction. */
  function band(v) { return v <= -25 ? 0 : (v < 25 ? 1 : 2); }
  var BENEFIT_WORDS = { Economic:  ["pro equality", "moderate equality", "anti redistribution"],
                        Legal:     ["pro legal equality", "moderate legal equality", "pro legal privilege"],
                        Political: ["pro political equality", "moderate political equality", "pro restricted rights"] };
  var CONTROL_WORDS = { Economic:  ["pro popular control of production", "moderate control of production", "pro elite control of production"],
                        Legal:     ["pro popular control of law", "moderate control of law", "pro elite control of law"],
                        Political: ["pro popular political control", "moderate political control", "pro elite political control"] };
  function positionLabel(dim, s) {
    return BENEFIT_WORDS[dim][band(s.benefit)] + ", " + CONTROL_WORDS[dim][band(s.control)];
  }

  /* ---------------- navigation ---------------- */
  function buildNav() {
    var nav = $("nav");
    nav.innerHTML = "";
    VIEWS.forEach(function (v) {
      var b = el("button", null, v.label);
      b.type = "button";
      b.onclick = function () { go(v.id); };
      b.dataset.view = v.id;
      nav.appendChild(b);
    });
  }

  function go(view, index) {
    state.view = view;
    if (typeof index === "number") state.index = index;
    if (location.hash.slice(1) !== view) {
      try { history.replaceState(null, "", "#" + view); } catch (e) { location.hash = view; }
    }
    VIEWS.forEach(function (v) { $("view-" + v.id).hidden = v.id !== view; });
    Array.prototype.forEach.call($("nav").children, function (b) {
      b.setAttribute("aria-current", b.dataset.view === view ? "true" : "false");
    });
    $("progress-bar").hidden = view !== "questionnaire";
    if (view === "questionnaire") renderQuestion();
    if (view === "results") renderResults();
    window.scrollTo(0, 0);
  }

  /* ---------------- introduction ---------------- */
  function para(text, cls) { return el("p", cls, text); }

  function table(spec, keyFirst) {
    var wrapper = el("div", "table-scroll");
    var t = el("table");
    var thead = el("thead"), tr = el("tr");
    spec.headers.forEach(function (h) { tr.appendChild(el("th", null, h)); });
    thead.appendChild(tr); t.appendChild(thead);
    var tbody = el("tbody");
    spec.rows.forEach(function (row) {
      var r = el("tr");
      row.forEach(function (cell, i) { r.appendChild(el("td", keyFirst && i === 0 ? "key" : null, cell || "")); });
      tbody.appendChild(r);
    });
    t.appendChild(tbody);
    wrapper.appendChild(t);
    return wrapper;
  }

  function renderIntroduction() {
    var I = DATA.introduction, v = $("view-introduction");
    v.innerHTML = "";
    v.appendChild(el("h2", null, I.title));
    I.lead.forEach(function (p, i) { if (p) v.appendChild(para(p, i === 0 ? "lead" : null)); });
    v.appendChild(el("h3", null, "The dimensions"));
    v.appendChild(table(I.domainTable, true));
    I.body.forEach(function (p) { if (p) v.appendChild(para(p)); });
    v.appendChild(el("h3", null, "Nine positions per dimension"));
    if (I.gridIntro) v.appendChild(para(I.gridIntro));
    var g = el("div", "grid3");
    I.grid.forEach(function (row) { row.forEach(function (c) { g.appendChild(el("div", null, c || "")); }); });
    v.appendChild(g);
    v.appendChild(el("h3", null, "Proposed terminology"));
    I.definitionsIntro.forEach(function (p) { if (p) v.appendChild(para(p)); });
    v.appendChild(table(I.definitions, true));

    var cta = el("div", "cta");
    var start = el("button", "btn btn-primary", answered() ? "Continue the questionnaire" : "Start the questionnaire");
    start.type = "button";
    start.onclick = function () { go("questionnaire", firstUnanswered()); };
    var read = el("button", "btn", "Read the semantics essay");
    read.type = "button";
    read.onclick = function () { go("semantics"); };
    cta.appendChild(start); cta.appendChild(read);
    v.appendChild(cta);
  }

  /* ---------------- semantics ---------------- */
  function renderSemantics() {
    var S = DATA.semantics, v = $("view-semantics");
    v.innerHTML = "";
    v.appendChild(el("h2", null, S.title));
    S.paragraphs.forEach(function (p, i) { if (p) v.appendChild(para(p, i === 0 ? "lead" : null)); });
    var cta = el("div", "cta");
    var start = el("button", "btn btn-primary", answered() ? "Continue the questionnaire" : "Start the questionnaire");
    start.type = "button";
    start.onclick = function () { go("questionnaire", firstUnanswered()); };
    cta.appendChild(start);
    v.appendChild(cta);
  }

  /* ---------------- questionnaire ---------------- */
  function firstUnanswered() {
    for (var i = 0; i < DATA.questions.length; i++) {
      if (state.answers[DATA.questions[i].id] == null) return i;
    }
    return DATA.questions.length - 1;
  }

  function renderQuestion() {
    var q = DATA.questions[state.index];
    var n = DATA.questions.length;

    $("q-counter").textContent = "Question " + (state.index + 1) + " of " + n;
    $("q-dim").textContent = q.dimension + (q.type ? " · " + q.type : "");
    $("q-text").textContent = q.question;
    $("q-explanation").textContent = q.explanation || "";
    $("q-note").hidden = !q.note;
    $("q-note").textContent = q.note || "";

    var info = $("q-info");
    info.innerHTML = "";
    info.hidden = !q.infoBoxes;
    (q.infoBoxes || []).forEach(function (b) {
      var card = el("div", "infobox");
      card.appendChild(el("p", "infobox-title", b.title));
      var ul = el("ul");
      b.lines.forEach(function (line) { ul.appendChild(el("li", null, line)); });
      card.appendChild(ul);
      info.appendChild(card);
    });
    $("progress-fill").style.width = (answered() / n * 100) + "%";

    var box = $("options");
    box.innerHTML = "";
    q.options.forEach(function (opt, i) {
      var b = el("button", "opt");
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", state.answers[q.id] === i ? "true" : "false");
      b.appendChild(el("span", "num", String(i + 1)));
      b.appendChild(el("span", "txt", opt.label));
      b.onclick = function () { choose(i); };
      box.appendChild(b);
    });

    $("btn-prev").disabled = state.index === 0;
    var last = state.index === n - 1;
    $("btn-next").textContent = last ? "See results →" : "Next →";
    $("btn-next").disabled = false;
    $("q-hint").textContent = "Press 1–5 to answer, ← / → to move. " + answered() + " of " + n + " answered.";
  }

  function choose(i) {
    var q = DATA.questions[state.index];
    state.answers[q.id] = i;
    save();
    renderQuestion();
    setTimeout(function () { step(1); }, 140);
  }

  function step(delta) {
    var next = state.index + delta;
    if (next < 0) return;
    if (next >= DATA.questions.length) { go("results"); return; }
    state.index = next;
    renderQuestion();
  }

  /* ---------------- results ---------------- */
  var PAD = { l: 46, r: 16, t: 16, b: 42 };
  var SIZE = 340;

  function chart(dim, s) {
    var W = SIZE + PAD.l + PAD.r, H = SIZE + PAD.t + PAD.b;
    var ns = "http://www.w3.org/2000/svg";
    function mk(tag, attrs, text) {
      var n = document.createElementNS(ns, tag);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      if (text != null) n.textContent = text;
      return n;
    }
    var svg = mk("svg", { viewBox: "0 0 " + W + " " + H, role: "img",
                          "aria-label": DATA.meta.chartTitles[dim] });
    function x(v) { return PAD.l + (v + 100) / 200 * SIZE; }
    function y(v) { return PAD.t + (100 - v) / 200 * SIZE; }

    svg.appendChild(mk("rect", { x: PAD.l, y: PAD.t, width: SIZE, height: SIZE,
                                 fill: "none", stroke: "var(--line)" }));
    [-50, 50].forEach(function (g) {
      svg.appendChild(mk("line", { x1: x(g), y1: PAD.t, x2: x(g), y2: PAD.t + SIZE, stroke: "var(--line)", "stroke-dasharray": "2 4" }));
      svg.appendChild(mk("line", { x1: PAD.l, y1: y(g), x2: PAD.l + SIZE, y2: y(g), stroke: "var(--line)", "stroke-dasharray": "2 4" }));
    });
    svg.appendChild(mk("line", { x1: x(0), y1: PAD.t, x2: x(0), y2: PAD.t + SIZE, stroke: "var(--ink-faint)" }));
    svg.appendChild(mk("line", { x1: PAD.l, y1: y(0), x2: PAD.l + SIZE, y2: y(0), stroke: "var(--ink-faint)" }));

    var ax = DATA.meta.axes;
    function axisText(t, attrs) {
      var n = mk("text", attrs, t);
      n.setAttribute("font-size", "10");
      n.setAttribute("fill", "var(--ink-faint)");
      n.setAttribute("font-family", "system-ui, sans-serif");
      return n;
    }
    svg.appendChild(axisText(ax.benefit.negative + " ←", { x: PAD.l, y: H - 22 }));
    svg.appendChild(axisText("→ " + ax.benefit.positive, { x: PAD.l + SIZE, y: H - 22, "text-anchor": "end" }));
    svg.appendChild(axisText(ax.benefit.label, { x: PAD.l + SIZE / 2, y: H - 7, "text-anchor": "middle" }));
    var cy = PAD.t + SIZE / 2;
    svg.appendChild(axisText(ax.control.negative + "  \u27F6  " + ax.control.positive,
      { x: 14, y: cy, transform: "rotate(-90 14 " + cy + ")", "text-anchor": "middle" }));

    // reference figures
    DATA.reference.forEach(function (ref) {
      var r = ref.scores[dim];
      if (!r || r.benefit == null) return;
      svg.appendChild(mk("circle", { cx: x(r.benefit), cy: y(r.control), r: 4,
                                     fill: "var(--ink-faint)", "fill-opacity": ".55" }));
      var t = mk("text", { x: x(r.benefit) + 7, y: y(r.control) + 3.5 }, ref.name);
      t.setAttribute("font-size", "10");
      t.setAttribute("fill", "var(--ink-soft)");
      t.setAttribute("font-family", "system-ui, sans-serif");
      if (x(r.benefit) > PAD.l + SIZE * 0.72) { t.setAttribute("text-anchor", "end"); t.setAttribute("x", x(r.benefit) - 7); }
      svg.appendChild(t);
    });

    // you
    if (s.answered > 0) {
      svg.appendChild(mk("circle", { cx: x(s.benefit), cy: y(s.control), r: 9,
                                     fill: "var(--accent)", "fill-opacity": ".18" }));
      svg.appendChild(mk("circle", { cx: x(s.benefit), cy: y(s.control), r: 5,
                                     fill: "var(--accent)", stroke: "var(--surface)", "stroke-width": "1.5" }));
      var yt = mk("text", { x: x(s.benefit) + 10, y: y(s.control) - 8 }, "You");
      yt.setAttribute("font-size", "11");
      yt.setAttribute("font-weight", "700");
      yt.setAttribute("fill", "var(--accent)");
      yt.setAttribute("font-family", "system-ui, sans-serif");
      if (x(s.benefit) > PAD.l + SIZE * 0.72) { yt.setAttribute("text-anchor", "end"); yt.setAttribute("x", x(s.benefit) - 10); }
      svg.appendChild(yt);
    }

    var box = el("div", "chart");
    box.appendChild(el("h3", null, DATA.meta.chartTitles[dim]));
    box.appendChild(el("p", "sub", s.answered + " of " + s.total + " questions in this dimension answered"));
    box.appendChild(svg);
    var lg = el("div", "legend");
    var you = el("span"); you.appendChild(el("i", "you")); you.appendChild(el("span", null, "You"));
    lg.appendChild(you);
    var others = el("span"); others.appendChild(el("i")); others.appendChild(el("span", null, "Reference figures (estimates)"));
    lg.appendChild(others);
    box.appendChild(lg);
    return box;
  }

  function meter(label, value) {
    var wrap = document.createDocumentFragment();
    var m = el("div", "metric");
    m.appendChild(el("span", null, label));
    var b = el("b", null, (value > 0 ? "+" : "") + Math.round(value));
    m.appendChild(b);
    wrap.appendChild(m);
    var bar = el("div", "meter");
    var fill = el("i");
    var half = Math.abs(value) / 200 * 100;
    if (value >= 0) { fill.style.left = "50%"; fill.style.width = half + "%"; }
    else { fill.style.right = "50%"; fill.style.width = half + "%"; }
    bar.appendChild(fill);
    wrap.appendChild(bar);
    return wrap;
  }

  function renderResults() {
    var v = $("view-results");
    var s = scores();
    var done = answered(), n = DATA.questions.length;
    v.innerHTML = "";

    var head = el("div", "results-head");
    head.appendChild(el("h2", null, "Your position"));
    head.appendChild(el("p", null, done === n
      ? "All " + n + " questions answered. Scores are the summed weights per dimension, clamped to ±100."
      : done + " of " + n + " questions answered — unanswered questions contribute nothing, so the position will shift as you finish."));
    v.appendChild(head);

    var cards = el("div", "scorecards");
    DIMS.forEach(function (d) {
      var c = el("div", "card");
      c.appendChild(el("h3", null, d));
      c.appendChild(el("p", "label", positionLabel(d, s[d])));
      c.appendChild(meter(DATA.meta.axes.benefit.label, s[d].benefit));
      c.appendChild(meter(DATA.meta.axes.control.label, s[d].control));
      cards.appendChild(c);
    });
    v.appendChild(cards);

    DIMS.forEach(function (d) { v.appendChild(chart(d, s[d])); });

    if (DATA.referenceNotes) {
      DATA.referenceNotes.forEach(function (t) { if (t) v.appendChild(el("p", "footnote", t)); });
    }
    DATA.reference.forEach(function (r) {
      if (r.note) v.appendChild(el("p", "footnote", r.note));
    });

    // per-answer breakdown
    var det = el("details");
    det.appendChild(el("summary", null, "Show every answer and the weights it contributed"));
    var wrapT = el("div", "table-scroll");
    var t = el("table", "answers-table");
    var thead = el("thead"), hr = el("tr");
    ["Dimension", "Question", "Your answer", "Benefit", "Control"].forEach(function (h) { hr.appendChild(el("th", null, h)); });
    thead.appendChild(hr); t.appendChild(thead);
    var tb = el("tbody");
    DATA.questions.forEach(function (q, i) {
      var pick = state.answers[q.id];
      var tr = el("tr");
      tr.appendChild(el("td", null, q.dimension));
      var qc = el("td");
      var link = el("button", "linkish", q.question);
      link.type = "button";
      link.style.cssText = "background:none;border:none;padding:0;font:inherit;color:var(--accent);cursor:pointer;text-align:left";
      link.onclick = function () { go("questionnaire", i); };
      qc.appendChild(link);
      tr.appendChild(qc);
      tr.appendChild(el("td", "ans", pick == null ? "— not answered —" : q.options[pick].label));
      tr.appendChild(el("td", "w", pick == null ? "" : String(q.options[pick].benefit)));
      tr.appendChild(el("td", "w", pick == null ? "" : String(q.options[pick].control)));
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    wrapT.appendChild(t);
    det.appendChild(wrapT);
    v.appendChild(det);

    var cta = el("div", "cta");
    if (done < n) {
      var cont = el("button", "btn btn-primary", "Answer the remaining " + (n - done));
      cont.type = "button";
      cont.onclick = function () { go("questionnaire", firstUnanswered()); };
      cta.appendChild(cont);
    }
    var dl = el("button", "btn", "Download my answers (JSON)");
    dl.type = "button";
    dl.onclick = function () { download(s); };
    cta.appendChild(dl);
    var reset = el("button", "btn", "Clear answers");
    reset.type = "button";
    reset.onclick = function () {
      if (!confirm("Clear all your answers?")) return;
      state.answers = {}; save(); state.index = 0; renderResults();
    };
    cta.appendChild(reset);
    v.appendChild(cta);
  }

  function download(s) {
    var payload = {
      takenAt: new Date().toISOString(),
      scores: s,
      answers: DATA.questions.map(function (q) {
        var pick = state.answers[q.id];
        return {
          id: q.id, dimension: q.dimension, question: q.question,
          answerNumber: pick == null ? null : pick + 1,
          answer: pick == null ? null : q.options[pick].label,
          benefit: pick == null ? null : q.options[pick].benefit,
          control: pick == null ? null : q.options[pick].control
        };
      })
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "taxonomy-answers.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* ---------------- wiring ---------------- */
  function init() {
    $("site-title").textContent = DATA.meta.title;
    document.title = DATA.meta.title;
    buildNav();
    renderIntroduction();
    renderSemantics();

    $("btn-prev").onclick = function () { step(-1); };
    $("btn-next").onclick = function () { step(1); };
    $("btn-skip").onclick = function () { step(1); };

    document.addEventListener("keydown", function (e) {
      if (state.view !== "questionnaire") return;
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key >= "1" && e.key <= "5") { choose(Number(e.key) - 1); e.preventDefault(); }
      else if (e.key === "ArrowRight") { step(1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { step(-1); e.preventDefault(); }
    });

    var initial = location.hash.slice(1);
    var valid = VIEWS.some(function (v) { return v.id === initial; });
    go(valid ? initial : "introduction", valid && initial === "questionnaire" ? firstUnanswered() : undefined);

    window.addEventListener("hashchange", function () {
      var h = location.hash.slice(1);
      if (h && h !== state.view && VIEWS.some(function (v) { return v.id === h; })) go(h);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
