// 80-in-8: Optiver-style mental-math drill.
// 80 multiple-choice arithmetic questions in 8 minutes.
// Scoring: +1 correct, -2 wrong or skipped.
// Integrated: auth gate, score submission, post-test review table.

(() => {
  const TOTAL_QUESTIONS = 80;
  const TIME_LIMIT_MS = 8 * 60 * 1000;

  // ---- State ----
  let questions = [];
  let qIdx = 0;
  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  let startedAt = 0;
  let timerHandle = null;
  let testActive = false;
  let answerLog = []; // { q, a, chosen, result: 'correct'|'wrong'|'skipped' }

  // ---- Utility ----
  const randInt = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const round = (x, dp) => +x.toFixed(dp);
  const shuffle = arr => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  function fmt(n) {
    if (typeof n === 'string') return n;
    if (Number.isInteger(n)) return String(n);
    return parseFloat(n.toFixed(6)).toString();
  }

  // ---- Distractor helpers ----
  // Distractors should be plausibly close to the answer so they don't
  // give themselves away. Step size scales with the magnitude of the answer.
  function intDistractors(ans) {
    const set = new Set([ans]);
    const abs = Math.abs(ans);
    const step = abs >= 1000 ? 100 : abs >= 100 ? 10 : 1;
    const swapAdjacentDigits = n => {
      const s = String(Math.abs(n));
      if (s.length < 2) return n + step;
      const i = randInt(0, s.length - 2);
      const swapped = s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2);
      const v = parseInt(swapped, 10);
      return n < 0 ? -v : v;
    };
    const candidates = [
      ans + step, ans - step, ans + 2 * step, ans - 2 * step,
      ans + 5 * step, ans - 5 * step,
      ans + 1, ans - 1, ans + 10, ans - 10,
      swapAdjacentDigits(ans),
      ans + (ans >= 0 ? step * 10 : -step * 10),
      -ans,
    ];
    const out = [];
    for (const c of shuffle(candidates)) {
      if (out.length >= 3) break;
      if (!Number.isFinite(c) || set.has(c)) continue;
      set.add(c);
      out.push(c);
    }
    while (out.length < 3) {
      const c = ans + randInt(-5, 5) * step;
      if (!set.has(c)) { set.add(c); out.push(c); }
    }
    return out.map(fmt);
  }

  function decDistractors(ans) {
    const set = new Set([fmt(ans)]);
    const abs = Math.abs(ans);
    const step = abs >= 100 ? 10 : abs >= 10 ? 1 : abs >= 1 ? 0.1 : abs >= 0.1 ? 0.01 : 0.001;
    const candidates = [
      round(ans + step, 6), round(ans - step, 6),
      round(ans + 2 * step, 6), round(ans - 2 * step, 6),
      ans * 10, ans / 10, ans * 100, ans / 100,
      round(ans + 0.5, 6), round(ans - 0.5, 6),
      -ans, round(ans * 2, 6), round(ans / 2, 6),
    ];
    const out = [];
    for (const c of shuffle(candidates)) {
      if (out.length >= 3) break;
      if (!Number.isFinite(c)) continue;
      const cs = fmt(round(c, 6));
      if (set.has(cs)) continue;
      set.add(cs);
      out.push(cs);
    }
    while (out.length < 3) {
      const c = round(ans + (Math.random() - 0.5) * 4 * step, 6);
      const cs = fmt(c);
      if (!set.has(cs)) { set.add(cs); out.push(cs); }
    }
    return out;
  }

  function fracDistractors(num, den) {
    const correct = `${num}/${den}`;
    const set = new Set([correct]);
    const candidates = [
      `${num + 1}/${den}`, `${Math.max(1, num - 1)}/${den}`,
      `${num}/${den + 1}`, `${num}/${Math.max(2, den - 1)}`,
      `${den}/${num}`, `${num + 1}/${den + 1}`,
      `${num + 2}/${den}`, `${num}/${den + 2}`,
    ];
    const out = [];
    for (const c of shuffle(candidates)) {
      if (out.length >= 3) break;
      if (set.has(c)) continue;
      set.add(c);
      out.push(c);
    }
    while (out.length < 3) {
      const c = `${num + randInt(-2, 3)}/${den + randInt(-1, 2)}`;
      if (!set.has(c) && !c.includes('-')) { set.add(c); out.push(c); }
    }
    return out;
  }

  // ---- Question generators ----
  // Calibrated to Optiver test difficulty: 2-3-digit arithmetic, percentages,
  // squares, order of operations, signed numbers, harder fractions, linear
  // algebra. Roughly 6 seconds per question.

  function makeQuestion(q, ans, distractors) {
    const all = shuffle([ans, ...distractors]);
    return { q, a: ans, choices: all };
  }

  function genIntAdd() {
    const variants = [
      () => [randInt(100, 999), randInt(100, 999)],
      () => [randInt(1000, 9999), randInt(100, 999)],
      () => [randInt(50, 99), randInt(50, 99)],
    ];
    const [a, b] = pick(variants)();
    return makeQuestion(`${a} + ${b}`, fmt(a + b), intDistractors(a + b));
  }

  function genIntSub() {
    const variants = [
      () => { const a = randInt(500, 999), b = randInt(100, a - 50); return [a, b]; },
      () => { const a = randInt(1000, 9999), b = randInt(200, a - 100); return [a, b]; },
      () => { const a = randInt(100, 199), b = randInt(20, 99); return [a, b]; },
    ];
    const [a, b] = pick(variants)();
    return makeQuestion(`${a} − ${b}`, fmt(a - b), intDistractors(a - b));
  }

  function genIntMul() {
    const variants = [
      () => [randInt(11, 99), randInt(11, 99)],     // 2-digit × 2-digit
      () => [randInt(2, 9), randInt(100, 999)],     // 1-digit × 3-digit
      () => [randInt(11, 25), randInt(11, 25)],     // common harder squares-area
      () => [randInt(20, 50), randInt(2, 9)],
    ];
    const [a, b] = pick(variants)();
    return makeQuestion(`${a} × ${b}`, fmt(a * b), intDistractors(a * b));
  }

  function genIntDiv() {
    const variants = [
      () => { const d = pick([11,12,13,14,15,16,17,18,19,21,22,23,24,25]); const q = randInt(11, 60); return [d, q]; },
      () => { const d = randInt(2, 9); const q = randInt(50, 200); return [d, q]; },
    ];
    const [d, q] = pick(variants)();
    return makeQuestion(`${d * q} ÷ ${d}`, fmt(q), intDistractors(q));
  }

  function genSquare() {
    const n = randInt(11, 25);
    return makeQuestion(`${n}²`, fmt(n * n), intDistractors(n * n));
  }

  function genPercent() {
    const variants = [
      () => {
        const p = pick([5,10,15,20,25,30,35,40,50,60,75,80]);
        const n = pick([40,60,80,120,160,200,240,300,400,500,600,800]);
        return [`${p}% of ${n}`, n * p / 100];
      },
      () => {
        const part = pick([5,12,15,18,20,24,30,35,40,45,60]);
        const total = part * pick([4,5,8,10]);
        return [`${part} is what % of ${total}`, part * 100 / total];
      },
      () => {
        const base = pick([80,120,160,200,240,400,500]);
        const p = pick([10,15,20,25,30,50]);
        return [`${base} increased by ${p}%`, base * (100 + p) / 100];
      },
    ];
    const [q, ans] = pick(variants)();
    if (Number.isInteger(ans)) return makeQuestion(q, fmt(ans), intDistractors(ans));
    return makeQuestion(q, fmt(round(ans, 4)), decDistractors(ans));
  }

  function genMixedOps() {
    const variants = [
      () => { const a = randInt(2, 20), b = randInt(2, 12), c = randInt(2, 12); return [`${a} + ${b} × ${c}`, a + b * c]; },
      () => { const a = randInt(2, 12), b = randInt(2, 12), c = randInt(2, 20); return [`${a} × ${b} − ${c}`, a * b - c]; },
      () => { const a = randInt(2, 9), b = randInt(2, 9), c = randInt(2, 9); return [`(${a} + ${b}) × ${c}`, (a + b) * c]; },
      () => { const a = randInt(2, 9), b = randInt(2, 9), c = randInt(3, 12); return [`${c} × (${a} − ${b})`, c * (a - b)]; },
      () => { const k = pick([2,3,4,6,8]); const m = randInt(3, 12); const c = randInt(2, 30); return [`${k * m} ÷ ${k} + ${c}`, m + c]; },
      () => { const a = randInt(3, 9); const b = randInt(2, 12); return [`${a}² − ${b}`, a * a - b]; },
    ];
    const [q, ans] = pick(variants)();
    return makeQuestion(q, fmt(ans), intDistractors(ans));
  }

  function genNegative() {
    const variants = [
      () => { const a = randInt(20, 99), b = randInt(20, 99); return [`-${a} + ${b}`, b - a]; },
      () => { const a = randInt(20, 99), b = randInt(20, 99); return [`${a} − ${a + b}`, -b]; },
      () => { const a = randInt(2, 12), b = randInt(2, 12); return [`-${a} × -${b}`, a * b]; },
      () => { const a = randInt(2, 12), b = randInt(3, 12); return [`-${a} × ${b}`, -a * b]; },
      () => { const q = randInt(3, 12), d = randInt(2, 9); return [`-${q * d} ÷ ${d}`, -q]; },
      () => { const a = randInt(20, 80), b = randInt(20, 80); return [`-${a} − ${b}`, -(a + b)]; },
    ];
    const [q, ans] = pick(variants)();
    return makeQuestion(q, fmt(ans), intDistractors(ans));
  }

  function genDecMul() {
    const variants = [
      () => { const a = pick([0.03,0.04,0.05,0.06,0.07,0.08]); const b = pick([20,30,40,50,60,80,120,150,200,250,400]); return [a,b,round(a*b,3)]; },
      () => { const a = pick([0.25,0.75,1.25,1.5,2.5]); const b = pick([4,8,12,16,20,24,32,40,80]); return [a,b,round(a*b,3)]; },
      () => { const a = pick([0.1,0.2,0.3,0.4,0.5,0.6,0.8]); const b = pick([0.4,0.5,0.6,0.7,0.8,0.04,0.05,0.06]); return [a,b,round(a*b,4)]; },
      () => { const a = pick([0.012,0.015,0.025,0.045,0.125]); const b = pick([100,200,400,800,1000]); return [a,b,round(a*b,4)]; },
    ];
    const [a, b, ans] = pick(variants)();
    return makeQuestion(`${a} × ${b}`, fmt(ans), decDistractors(ans));
  }

  function genDecDiv() {
    const variants = [
      () => { const q = randInt(20, 99); const d = pick([0.5,0.25,0.2,0.4,0.05]); return [round(d*q,3),d,q]; },
      () => { const q = pick([0.5,1.5,2.5,0.25,0.75,1.25,3.5]); const d = randInt(4,15); return [round(d*q,3),d,q]; },
      () => { const q = pick([20,25,40,50,80,125,200]); const d = pick([0.01,0.02,0.05,0.1]); return [round(d*q,3),d,q]; },
      () => { const q = randInt(15, 60); const d = pick([1.5,2.5,3.5,4.5]); return [round(d*q,3),d,q]; },
    ];
    const [a, b, ans] = pick(variants)();
    return makeQuestion(`${a} ÷ ${b}`, fmt(ans), decDistractors(ans));
  }

  function genFracTimesInt() {
    const denom = pick([2,3,4,5,6,7,8,9,10,12]);
    const num = randInt(1, denom - 1);
    const multiplier = randInt(3, 15);
    const ans = num * multiplier;
    return makeQuestion(`${num}/${denom} × ${denom * multiplier}`, fmt(ans), intDistractors(ans));
  }

  function genFracToDec() {
    const choices = [
      [1,2,0.5],[1,4,0.25],[3,4,0.75],[1,5,0.2],[2,5,0.4],[3,5,0.6],[4,5,0.8],
      [1,8,0.125],[3,8,0.375],[5,8,0.625],[7,8,0.875],[1,10,0.1],[3,10,0.3],
      [7,10,0.7],[9,10,0.9],[1,20,0.05],[3,20,0.15],[7,20,0.35],[13,20,0.65],
      [1,25,0.04],[3,25,0.12],[7,25,0.28],[1,16,0.0625],[3,16,0.1875],[5,16,0.3125],
      [1,40,0.025],[3,40,0.075],[7,40,0.175],[1,50,0.02],[7,50,0.14],
    ];
    const [n, d, v] = pick(choices);
    return makeQuestion(`${n}/${d} as a decimal`, fmt(v), decDistractors(v));
  }

  function genFracAdd() {
    const sets = [
      // Easy shared / nested denominators
      [[1,4],[1,4],[1,2]],[[1,4],[1,2],[3,4]],[[1,3],[1,6],[1,2]],
      [[1,4],[1,3],[7,12]],[[2,3],[1,6],[5,6]],[[1,5],[3,10],[1,2]],
      [[1,8],[1,4],[3,8]],[[3,4],[1,8],[7,8]],[[1,2],[1,5],[7,10]],
      [[1,2],[1,3],[5,6]],[[2,5],[1,10],[1,2]],
      // Cross-denominator (LCM)
      [[2,3],[3,4],[17,12]],[[3,5],[2,7],[31,35]],[[1,6],[2,9],[7,18]],
      [[3,8],[5,12],[19,24]],[[2,5],[3,8],[31,40]],[[5,9],[1,6],[13,18]],
      [[3,7],[1,4],[19,28]],[[7,12],[5,18],[31,36]],[[2,7],[3,5],[31,35]],
      [[1,9],[2,5],[23,45]],[[5,6],[3,8],[29,24]],
    ];
    const [[an,ad],[bn,bd],[rn,rd]] = pick(sets);
    return makeQuestion(`${an}/${ad} + ${bn}/${bd}`, `${rn}/${rd}`, fracDistractors(rn, rd));
  }

  function genFracSub() {
    const sets = [
      [[5,6],[1,4],[7,12]],[[3,4],[1,3],[5,12]],[[5,8],[1,4],[3,8]],
      [[7,10],[1,5],[1,2]],[[5,6],[1,2],[1,3]],[[3,5],[1,4],[7,20]],
      [[4,5],[2,3],[2,15]],[[7,8],[1,3],[13,24]],[[5,12],[1,4],[1,6]],
      [[2,3],[1,4],[5,12]],[[5,8],[1,3],[7,24]],[[7,12],[1,4],[1,3]],
      [[3,4],[2,5],[7,20]],[[5,9],[1,3],[2,9]],[[7,10],[3,8],[13,40]],
    ];
    const [[an,ad],[bn,bd],[rn,rd]] = pick(sets);
    return makeQuestion(`${an}/${ad} − ${bn}/${bd}`, `${rn}/${rd}`, fracDistractors(rn, rd));
  }

  function genAlgebraLinear() {
    const variants = [
      () => { const a = randInt(2, 12), x = randInt(2, 15), b = randInt(1, 30); return [`${a}x + ${b} = ${a * x + b}, x =`, x]; },
      () => { const a = randInt(3, 12), x = randInt(2, 15), b = randInt(1, 30); return [`${a}x − ${b} = ${a * x - b}, x =`, x]; },
      () => { const a = randInt(2, 9), x = randInt(2, 12), b = randInt(2, 9); return [`${a}(x + ${b}) = ${a * (x + b)}, x =`, x]; },
    ];
    const [q, ans] = pick(variants)();
    return makeQuestion(q, fmt(ans), intDistractors(ans));
  }

  function genAlgebraFraction() {
    const sets = [
      ['5/20','1/5','4/5'],['1/4','1/2','2'],['2/3','1/2','3/4'],
      ['3/8','3/4','2'],['1/3','1/6','1/2'],['2/5','1/5','1/2'],['3/4','1/2','2/3'],
      ['2/7','4/7','2'],['3/10','9/20','3/2'],['5/6','5/12','1/2'],
    ];
    const [lhs, rhs, ans] = pick(sets);
    let distractors;
    if (ans.includes('/')) {
      const [n, d] = ans.split('/').map(Number);
      distractors = fracDistractors(n, d);
    } else {
      distractors = intDistractors(parseInt(ans, 10));
    }
    return makeQuestion(`${lhs} × ? = ${rhs}`, ans, distractors);
  }

  // Weights tuned so the mix mirrors what the Optiver test actually throws:
  // mostly multi-digit arithmetic, percentages, fractions, and decimals,
  // with a steady tail of squares, mixed ops, signed numbers, and algebra.
  const GENERATORS = [
    [genIntAdd, 2], [genIntSub, 2], [genIntMul, 3], [genIntDiv, 2],
    [genDecMul, 3], [genDecDiv, 2],
    [genFracTimesInt, 2], [genFracToDec, 2], [genFracAdd, 2], [genFracSub, 2],
    [genPercent, 3], [genSquare, 2], [genMixedOps, 2], [genNegative, 2],
    [genAlgebraLinear, 2], [genAlgebraFraction, 1],
  ];

  function generateQuestionPool(n) {
    const pool = [];
    const totalWeight = GENERATORS.reduce((s, g) => s + g[1], 0);
    for (let i = 0; i < n; i++) {
      let r = Math.random() * totalWeight;
      for (const [gen, w] of GENERATORS) {
        r -= w;
        if (r <= 0) { pool.push(gen()); break; }
      }
    }
    return pool;
  }

  // ---- Test flow ----
  function startTest() {
    questions = generateQuestionPool(TOTAL_QUESTIONS);
    qIdx = 0; correct = 0; wrong = 0; skipped = 0;
    answerLog = [];
    testActive = true;
    startedAt = Date.now();

    document.getElementById('intro-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'none';
    const oldReview = document.getElementById('review-section');
    if (oldReview) oldReview.remove();
    document.getElementById('test-section').style.display = '';

    renderQuestion();
    renderStatus();
    timerHandle = setInterval(tick, 200);
  }

  function tick() {
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, TIME_LIMIT_MS - elapsed);
    const timerEl = document.getElementById('timer');
    if (timerEl) {
      timerEl.textContent = formatTime(remaining);
      timerEl.classList.toggle('timer-warning', remaining <= 60_000);
    }
    if (remaining <= 0) endTest();
  }

  function formatTime(ms) {
    const total = Math.ceil(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function renderStatus() {
    document.getElementById('counter').textContent = `${Math.min(qIdx + 1, TOTAL_QUESTIONS)} / ${TOTAL_QUESTIONS}`;
  }

  function renderQuestion() {
    const q = questions[qIdx];
    if (!q) return;
    document.getElementById('question').textContent = q.q;
    const container = document.getElementById('choices');
    container.innerHTML = '';
    q.choices.forEach((choice, i) => {
      const btn = document.createElement('button');
      btn.className = 'eighty-choice';
      // Keyboard hint badge
      const kbd = document.createElement('span');
      kbd.className = 'choice-kbd';
      kbd.textContent = i + 1;
      btn.appendChild(kbd);
      btn.appendChild(document.createTextNode(choice));
      btn.addEventListener('click', () => answer(choice));
      container.appendChild(btn);
    });
  }

  function answer(choice) {
    if (!testActive) return;
    const q = questions[qIdx];
    const isCorrect = choice === q.a;
    if (isCorrect) correct++; else wrong++;
    answerLog.push({ q: q.q, a: q.a, chosen: choice, result: isCorrect ? 'correct' : 'wrong' });
    advance();
  }

  function skip() {
    if (!testActive) return;
    const q = questions[qIdx];
    skipped++;
    answerLog.push({ q: q.q, a: q.a, chosen: null, result: 'skipped' });
    advance();
  }

  function advance() {
    qIdx++;
    renderStatus();
    if (qIdx >= TOTAL_QUESTIONS) endTest();
    else renderQuestion();
  }

  function endTest() {
    if (!testActive) return;
    testActive = false;
    clearInterval(timerHandle);

    while (answerLog.length < TOTAL_QUESTIONS) {
      const q = questions[answerLog.length];
      skipped++;
      answerLog.push({ q: q ? q.q : '?', a: q ? q.a : '?', chosen: null, result: 'skipped' });
    }

    const duration_s = Math.round((Date.now() - startedAt) / 1000);
    const score = correct - 2 * wrong - 2 * skipped;
    const penalty = 2 * (wrong + skipped);
    document.getElementById('test-section').style.display = 'none';
    showResults(score);
    buildReviewTable();
    submitScore({ score, correct, wrong, skipped, duration_s });
  }

  // ---- Results ----
  function showResults(score) {
    const penalty = 2 * (wrong + skipped);
    document.getElementById('results-section').style.display = '';
    document.getElementById('results-title').textContent = `Score: ${score}`;
    document.getElementById('results-formula').textContent =
      `${correct} correct − 2 × ${wrong + skipped} (wrong + skipped) = ${correct} − ${penalty} = ${score}`;
    document.getElementById('results-correct').textContent = String(correct);
    document.getElementById('results-wrong').textContent = String(wrong);
    document.getElementById('results-skipped').textContent = String(skipped);

    let verdict;
    if (score >= 70)      verdict = '🏆 Outstanding — highly competitive for Optiver.';
    else if (score >= 56) verdict = '✅ Pass — above the Optiver threshold of 56.';
    else if (score >= 30) verdict = '📈 Below pass. Avoid guessing — the −2 penalty bites hard.';
    else                  verdict = '💪 Keep drilling. Speed and accuracy compound quickly.';
    document.getElementById('results-verdict').textContent = verdict;
  }

  // ---- Review table ----
  function buildReviewTable() {
    const existing = document.getElementById('review-section');
    if (existing) existing.remove();

    const section = document.createElement('section');
    section.id = 'review-section';
    section.innerHTML = `
      <div class="section-header">
        <span class="label">Review</span>
        <h2>Question breakdown</h2>
      </div>
    `;

    const table = document.createElement('table');
    table.className = 'review-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>#</th>
          <th>Question</th>
          <th>Your answer</th>
          <th>Correct answer</th>
          <th></th>
        </tr>
      </thead>
    `;

    const tbody = document.createElement('tbody');
    answerLog.forEach((entry, i) => {
      const tr = document.createElement('tr');
      tr.className = `review-row review-${entry.result}`;

      const yourAnswer = entry.result === 'skipped'
        ? '<span class="review-skipped-label">Skipped</span>'
        : entry.chosen;

      const icon = { correct: '✓', wrong: '✗', skipped: '–' }[entry.result];

      tr.innerHTML = `
        <td class="review-num">${i + 1}</td>
        <td class="review-q">${entry.q} = ?</td>
        <td class="review-chosen${entry.result === 'wrong' ? ' review-wrong-ans' : ''}">${yourAnswer}</td>
        <td class="review-ans">${entry.a}</td>
        <td class="review-icon review-icon-${entry.result}">${icon}</td>
      `;
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    section.appendChild(table);

    const resultsSection = document.getElementById('results-section');
    resultsSection.parentNode.insertBefore(section, resultsSection.nextSibling);
  }

  // ---- Score submission ----
  async function submitScore(payload) {
    const title = document.getElementById('results-title');
    const savedEl = document.createElement('span');
    savedEl.id = 'score-save-status';
    savedEl.className = 'score-save-status';
    savedEl.textContent = ' · saving…';
    if (title) title.appendChild(savedEl);

    try {
      const res = await fetch('/api/drill/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        savedEl.textContent = ' · saved to leaderboard ✓';
        savedEl.classList.add('save-ok');
      } else if (res.status === 401) {
        savedEl.textContent = ' · sign in to save your score';
        savedEl.classList.add('save-warn');
      } else {
        savedEl.textContent = ' · could not save score';
        savedEl.classList.add('save-error');
      }
    } catch {
      savedEl.textContent = ' · offline — score not saved';
      savedEl.classList.add('save-error');
    }
  }

  // ---- Restart ----
  function restart() {
    document.getElementById('results-section').style.display = 'none';
    const oldReview = document.getElementById('review-section');
    if (oldReview) oldReview.remove();
    document.getElementById('intro-section').style.display = '';
  }

  // ---- Wire up ----
  document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', startTest);
    }

    document.getElementById('skip-btn').addEventListener('click', skip);
    document.getElementById('restart-btn').addEventListener('click', restart);

    // Keyboard: 1–4 to answer, S to skip
    document.addEventListener('keydown', e => {
      if (!testActive) return;
      if (e.key >= '1' && e.key <= '4') {
        const choices = document.querySelectorAll('.eighty-choice');
        const idx = parseInt(e.key, 10) - 1;
        if (choices[idx]) choices[idx].click();
      } else if (e.key === 's' || e.key === 'S') {
        skip();
      }
    });
  });
})();
