/* zapn.js — Zap-N cognitive test suite (Optiver-style) */
(() => {
  'use strict';

  // ---- Utilities ----
  const randInt = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // ---- Global state ----
  let currentGameIdx = 0;
  const scores = new Array(9).fill(null);

  // ---- DOM helper ----
  const $ = id => document.getElementById(id);

  // ==============================================================
  // GAME DEFINITIONS
  // ==============================================================

  const GAMES = [];

  // --------------------------------------------------------------
  // 1. Stock Master — reaction time
  // --------------------------------------------------------------
  GAMES.push({
    name: 'Stock Master',
    tag: 'Reaction Time',
    desc: 'A bar rises at varying speeds. Click when it enters the green zone.',
    hint: 'Watch the gold bar rise. Click (or tap) the track when the bar is inside the green zone. 5 rounds — each round has a different speed and zone position.',
    play(el, done) {
      const ROUNDS = 5;
      let round = 0, total = 0;

      function render() {
        el.innerHTML = `
          <div style="text-align:center">
            <div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--muted);margin-bottom:1rem">
              Round <span id="sm-r">${round + 1}</span> / ${ROUNDS}
            </div>
            <canvas id="sm-canvas" width="110" height="300"
              style="cursor:pointer;display:block;margin:0 auto;border-radius:6px"></canvas>
            <p style="font-size:0.8rem;color:var(--text-secondary);margin:0.75rem 0 0.25rem">
              Click when the bar enters the green zone
            </p>
            <div style="font-family:var(--font-mono);font-size:0.82rem;color:var(--text-secondary)">
              Score: <span id="sm-total">${total}</span> / ${ROUNDS * 100}
            </div>
            <div id="sm-fb" class="zapn-feedback"></div>
          </div>`;
        runRound();
      }

      function runRound() {
        const canvas = document.getElementById('sm-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const fb = $('sm-fb');

        // Progressive difficulty: each round gets faster and the zone narrows
        const speed     = 1 + round * 0.35;               // 1.0 → 2.4×
        const baseDur   = 4200 / speed;
        const dur       = baseDur * (0.8 + Math.random() * 0.4);
        const zoneWidth = Math.max(0.09, 0.21 - round * 0.025); // 0.21 → 0.11

        // Initial zone position
        let zS = 0.18 + Math.random() * 0.34;
        let zE = Math.min(zS + zoneWidth, 0.90);

        // Rounds 3-5: zone shifts once when bar crosses ~40%
        const willShift   = round >= 2;
        const shiftPoint  = 0.35 + Math.random() * 0.20;
        let   shifted     = false;

        let prog = 0, t0 = null, animId, clicked = false;

        function draw() {
          // Zone shift: fire once when prog passes shiftPoint
          if (willShift && !shifted && prog >= shiftPoint) {
            shifted = true;
            zS = 0.18 + Math.random() * 0.34;
            zE = Math.min(zS + zoneWidth, 0.90);
          }

          ctx.clearRect(0, 0, W, H);
          // track background
          ctx.fillStyle = '#111318';
          ctx.roundRect ? ctx.roundRect(0, 0, W, H, 6) : ctx.rect(0, 0, W, H);
          ctx.fill();
          // border
          ctx.strokeStyle = 'rgba(184,156,75,0.25)';
          ctx.lineWidth = 1;
          ctx.stroke();
          // green zone (measured from bottom)
          const zoneY = H - zE * H;
          const zoneH = (zE - zS) * H;
          ctx.fillStyle = 'rgba(56,161,105,0.28)';
          ctx.fillRect(0, zoneY, W, zoneH);
          ctx.strokeStyle = '#38a169';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, zoneY);            ctx.lineTo(W, zoneY);
          ctx.moveTo(0, zoneY + zoneH);    ctx.lineTo(W, zoneY + zoneH);
          ctx.stroke();
          // fill bar rising from bottom
          const fillH = prog * H;
          const grad  = ctx.createLinearGradient(0, H - fillH, 0, H);
          grad.addColorStop(0, '#C2A75E');
          grad.addColorStop(1, '#8A6F2A');
          ctx.fillStyle = grad;
          ctx.fillRect(12, H - fillH, W - 24, fillH);
          // round label overlay
          ctx.fillStyle = 'rgba(133,133,146,0.7)';
          ctx.font = '10px monospace';
          ctx.textAlign = 'right';
          ctx.fillText(`R${round + 1}`, W - 5, 14);
        }

        function frame(t) {
          if (!t0) t0 = t;
          prog = Math.min((t - t0) / dur, 1);
          draw();
          if (prog < 1 && !clicked) {
            animId = requestAnimationFrame(frame);
          } else if (!clicked) {
            clicked = true;
            resolve();
          }
        }
        animId = requestAnimationFrame(frame);

        canvas.onclick = () => {
          if (clicked) return;
          clicked = true;
          cancelAnimationFrame(animId);
          resolve();
        };

        function resolve() {
          let pts = 0;
          if (prog >= zS && prog <= zE) {
            const center = (zS + zE) / 2;
            const halfW  = (zE - zS) / 2;
            const dist   = Math.abs(prog - center) / halfW;
            pts = Math.round(100 * (1 - dist * 0.6));
            if (fb) { fb.textContent = `+${pts} pts — zone hit!`; fb.className = 'zapn-feedback zapn-feedback--good'; }
          } else {
            if (fb) { fb.textContent = prog < zS ? 'Too early — 0 pts' : 'Too late — 0 pts'; fb.className = 'zapn-feedback zapn-feedback--bad'; }
          }
          total += pts;
          const totEl = $('sm-total');
          if (totEl) totEl.textContent = total;
          round++;
          if (round >= ROUNDS) {
            setTimeout(() => done(Math.round(total / ROUNDS), `${total} / ${ROUNDS * 100}`), 1400);
          } else {
            setTimeout(render, 1200);
          }
        }
      }

      render();
    }
  });

  // --------------------------------------------------------------
  // 2. Balloon — risk management (BART)
  // --------------------------------------------------------------
  GAMES.push({
    name: 'Balloon',
    tag: 'Risk Management',
    desc: 'Pump a balloon to earn coins. Pop it and you lose everything plus a penalty.',
    hint: 'Each pump earns coins but increases burst risk. Cash out to bank your earnings. Rounds 4–5 are high-stakes: 3× reward, but balloons pop sooner.',
    play(el, done) {
      const ROUNDS = 5;
      let round = 0, bank = 0, roundEarned = 0, pumps = 0;

      function render() {
        const high     = round >= 3;
        const perPump  = high ? 3 : 1;
        const popDenom = high ? 8 : 13;
        const size     = Math.min(44 + pumps * 13, 210);
        el.innerHTML = `
          <div class="zapn-bl-wrap">
            <div class="zapn-bl-meta">
              Round ${round + 1} / ${ROUNDS} · Bank: <strong>$${bank}</strong>
              ${high ? '<span class="zapn-badge-hot">HIGH STAKES 3×</span>' : ''}
            </div>
            <div class="zapn-bl-stage">
              <div class="zapn-bl-balloon" style="width:${size}px;height:${size}px"></div>
            </div>
            <div class="zapn-bl-info">Pumps: ${pumps} · Earned this round: $${roundEarned}</div>
            <div class="zapn-bl-btns">
              <button class="btn btn-primary" id="bl-pump">Pump (+$${perPump})</button>
              <button class="btn" id="bl-cash">Cash Out ($${roundEarned})</button>
            </div>
            <div id="bl-fb" class="zapn-feedback"></div>
          </div>`;

        $('bl-pump').onclick = doPump;
        $('bl-cash').onclick = doCash;
      }

      function doPump() {
        const high     = round >= 3;
        const perPump  = high ? 3 : 1;
        const popDenom = high ? 8 : 13;
        pumps++;
        if (Math.random() < pumps / popDenom) {
          const penalty = high ? 10 : 5;
          bank -= penalty;
          el.innerHTML = `
            <div class="zapn-bl-wrap zapn-bl-popped">
              <div class="zapn-bl-pop-icon">💥</div>
              <h3>Balloon popped!</h3>
              <p>Lost $${roundEarned} + $${penalty} penalty · Bank: $${bank}</p>
            </div>`;
          setTimeout(nextRound, 1600);
        } else {
          roundEarned += perPump;
          render();
        }
      }

      function doCash() {
        bank += roundEarned;
        el.innerHTML = `
          <div class="zapn-bl-wrap">
            <div class="zapn-feedback zapn-feedback--good" style="font-size:1.2rem">+$${roundEarned} banked!</div>
            <p style="margin-top:1rem;color:var(--text-secondary)">Bank: $${bank}</p>
          </div>`;
        setTimeout(nextRound, 1200);
      }

      function nextRound() {
        round++;
        roundEarned = 0;
        pumps = 0;
        if (round >= ROUNDS) {
          done(Math.max(0, bank), `$${bank}`);
        } else {
          render();
        }
      }

      render();
    }
  });

  // --------------------------------------------------------------
  // 3. Skyscraper — planning (Tower rearrangement)
  // --------------------------------------------------------------
  GAMES.push({
    name: 'Skyscraper',
    tag: 'Planning',
    desc: 'Rearrange colored balls in glass tubes to match the target layout using minimal moves.',
    hint: 'Click a tube to pick up its top ball, then click another tube to drop it there. Reach the target arrangement shown on the right. 3 puzzles of increasing difficulty.',
    play(el, done) {
      const PUZZLES = 3;
      const COLORS = ['#cc2222', '#2255cc', '#22aa22', '#ccaa00', '#8822cc'];
      const LIGHTS = ['rgba(255,160,160,0.75)', 'rgba(160,160,255,0.75)', 'rgba(160,255,160,0.75)', 'rgba(255,240,140,0.75)', 'rgba(220,150,255,0.75)'];
      const DARKS  = ['#7a0000', '#001a66', '#004d00', '#554400', '#3d0066'];

      let puzzle = 0, totalScore = 0;
      let state, goalState, optDepth, moveCount, selected;

      function genPuzzle(numBlocks) {
        const goal = [[], [], []];
        const shuffled = shuffle([...Array(numBlocks).keys()]);
        // Ensure at least 2 stacks are used
        goal[0].push(shuffled[0]);
        goal[1].push(shuffled[1]);
        for (let i = 2; i < numBlocks; i++) {
          goal[Math.floor(Math.random() * 3)].push(shuffled[i]);
        }
        let cur = goal.map(s => [...s]);
        const depth = numBlocks * 2 + 2;
        let lastSrc = -1, lastDst = -1;
        for (let i = 0; i < depth; i++) {
          const srcs = [0, 1, 2].filter(s => cur[s].length > 0);
          if (!srcs.length) break;
          let src, dst, tries = 0;
          do {
            src = pick(srcs);
            const dsts = [0, 1, 2].filter(d => d !== src);
            dst = pick(dsts);
            tries++;
          } while (tries < 8 && src === lastDst && dst === lastSrc);
          cur[dst].push(cur[src].pop());
          lastSrc = src; lastDst = dst;
        }
        return { start: cur, goal, depth };
      }

      // BFS: compute the true minimum moves from start to goal
      function computeOptimal(start, goal) {
        const enc     = s => JSON.stringify(s);
        const goalKey = enc(goal);
        const startKey = enc(start);
        if (startKey === goalKey) return 0;
        const visited = new Set([startKey]);
        const queue   = [[start, 0]];
        while (queue.length) {
          const [st, d] = queue.shift();
          for (let src = 0; src < 3; src++) {
            if (!st[src].length) continue;
            for (let dst = 0; dst < 3; dst++) {
              if (src === dst) continue;
              const ns = st.map(a => [...a]);
              ns[dst].push(ns[src].pop());
              const k = enc(ns);
              if (k === goalKey) return d + 1;
              if (!visited.has(k)) { visited.add(k); queue.push([ns, d + 1]); }
            }
          }
        }
        return -1;
      }

      function startPuzzle() {
        const p = genPuzzle(3 + puzzle);
        state     = p.start;
        goalState = p.goal;
        optDepth  = computeOptimal(p.start, p.goal); // true BFS optimal
        moveCount = 0;
        selected  = null;
        renderBoard();
      }

      function ballStyle(b) {
        return `radial-gradient(ellipse at 36% 28%, ${LIGHTS[b]}, ${COLORS[b]} 48%, ${DARKS[b]})`;
      }

      function renderBoard() {
        const carriedBlock = selected !== null ? state[selected][state[selected].length - 1] : null;

        el.innerHTML = `
          <div class="zapn-sky-wrap">
            <div class="zapn-sky-meta">Puzzle ${puzzle + 1} / ${PUZZLES} · Moves: ${moveCount}</div>

            <div class="zapn-sky-status${selected !== null ? ' zapn-sky-status--carrying' : ''}">
              ${selected !== null
                ? `<div class="sky-ball sky-ball-sm" style="background:${ballStyle(carriedBlock)}"></div>
                   <span>Carrying — click a tube to place</span>`
                : `<span>Click a tube to pick up its top ball</span>`}
            </div>

            <div class="zapn-sky-boards">
              <div class="zapn-sky-board">
                <div class="zapn-sky-label">Current</div>
                <div class="zapn-sky-stacks" id="sky-cur">${stacksHTML(state, true)}</div>
              </div>
              <div class="zapn-sky-arrow">→</div>
              <div class="zapn-sky-board">
                <div class="zapn-sky-label">Target</div>
                <div class="zapn-sky-stacks">${stacksHTML(goalState, false)}</div>
              </div>
            </div>

            <div id="sky-fb" class="zapn-feedback"></div>
            <button class="btn btn-sm" id="sky-skip" style="margin-top:var(--space-md);opacity:0.5">Skip this puzzle (0 pts)</button>
          </div>`;

        el.querySelectorAll('#sky-cur .sky-tube-wrap').forEach((s, i) => {
          s.addEventListener('click', () => handleClick(i));
          if (selected === i) s.classList.add('sky-stack-selected');
        });

        $('sky-skip').onclick = () => {
          selected = null;
          puzzle++;
          if (puzzle >= PUZZLES) {
            done(Math.round(totalScore / PUZZLES), `${totalScore} / ${PUZZLES * 100}`);
          } else {
            setTimeout(startPuzzle, 200);
          }
        };
      }

      function stacksHTML(stacks, interactive) {
        return stacks.map((stack, i) => {
          const isCarried = interactive && selected === i;
          const topIdx    = stack.length - 1;
          return `<div class="sky-tube-wrap${interactive ? ' sky-tube-interactive' : ''}">
            <div class="sky-tube-body">
              ${stack.map((b, bi) =>
                `<div class="sky-ball${isCarried && bi === topIdx ? ' sky-ball-lifted' : ''}"
                   style="background:${ballStyle(b)}"></div>`
              ).join('')}
            </div>
            <div class="sky-tube-base"></div>
          </div>`;
        }).join('');
      }

      function handleClick(idx) {
        const fb = $('sky-fb');
        fb.textContent = '';
        if (selected === null) {
          if (state[idx].length === 0) {
            fb.textContent = 'Stack is empty.';
            fb.className = 'zapn-feedback zapn-feedback--bad';
            return;
          }
          selected = idx;
          renderBoard();
        } else if (selected === idx) {
          selected = null;
          renderBoard();
        } else {
          state[idx].push(state[selected].pop());
          moveCount++;
          selected = null;
          if (state.every((s, i) => JSON.stringify(s) === JSON.stringify(goalState[i]))) {
            const extra = moveCount - optDepth; // 0 = perfect
            const pts   = Math.max(10, 100 - extra * 10);
            totalScore += pts;
            const verdict = extra === 0
              ? 'Optimal path!'
              : `${extra} extra move${extra > 1 ? 's' : ''} (optimal: ${optDepth})`;
            el.innerHTML = `
              <div class="zapn-sky-wrap">
                <div class="zapn-feedback zapn-feedback--good" style="font-size:1.2rem">Solved in ${moveCount} moves! +${pts} pts</div>
                <p style="margin-top:0.8rem;color:var(--text-secondary)">${verdict}</p>
              </div>`;
            puzzle++;
            if (puzzle >= PUZZLES) {
              setTimeout(() => done(Math.round(totalScore / PUZZLES), `${totalScore} / ${PUZZLES * 100}`), 1500);
            } else {
              setTimeout(startPuzzle, 1700);
            }
          } else {
            renderBoard();
          }
        }
      }

      startPuzzle();
    }
  });

  // --------------------------------------------------------------
  // 4. Shapeshift — selective attention (Simon effect)
  // --------------------------------------------------------------
  GAMES.push({
    name: 'Shapeshift',
    tag: 'Selective Attention',
    desc: 'A shape flashes left or right. Respond to its shape — not its position.',
    hint: 'Press ← (or click Left button) for circles. Press → (or click Right button) for squares. Ignore which side the shape appears on. 20 trials, 1.8 s each.',
    play(el, done) {
      const TRIALS = 20;
      let trial = 0, correct = 0;
      let answered = false, trialTimer = null;
      let active = true;

      const SHAPE_KEY = { circle: 'ArrowLeft', square: 'ArrowRight' };
      let curShape = null;

      el.innerHTML = `
        <div class="zapn-sf-wrap">
          <div class="zapn-sf-meta">Trial <span id="sf-t">1</span> / ${TRIALS} · Correct: <span id="sf-s">0</span></div>
          <div class="zapn-sf-arena">
            <div class="zapn-sf-half" id="sf-left"></div>
            <div class="zapn-sf-half" id="sf-right"></div>
          </div>
          <div class="zapn-sf-rule">← for <strong>circles</strong> · → for <strong>squares</strong> · ignore position</div>
          <div class="zapn-sf-btns">
            <button class="btn" id="sf-lb">← Circle</button>
            <button class="btn" id="sf-rb">Square →</button>
          </div>
          <div id="sf-fb" class="zapn-feedback"></div>
        </div>`;

      $('sf-lb').onclick = () => handleResp('ArrowLeft');
      $('sf-rb').onclick = () => handleResp('ArrowRight');

      const keyHandler = e => {
        if (!active) return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          handleResp(e.key);
        }
      };
      document.addEventListener('keydown', keyHandler);

      function nextTrial() {
        if (trial >= TRIALS) {
          active = false;
          document.removeEventListener('keydown', keyHandler);
          done(Math.round((correct / TRIALS) * 100), `${correct} / ${TRIALS} correct`);
          return;
        }
        answered = false;
        curShape = Math.random() < 0.5 ? 'circle' : 'square';
        const side = Math.random() < 0.5 ? 'left' : 'right';
        $('sf-left').innerHTML = '';
        $('sf-right').innerHTML = '';
        $(`sf-${side}`).innerHTML = `<div class="zapn-sf-shape zapn-sf-${curShape}"></div>`;
        $('sf-t').textContent  = trial + 1;
        $('sf-fb').textContent = '';
        $('sf-fb').className   = 'zapn-feedback';
        clearTimeout(trialTimer);
        trialTimer = setTimeout(() => {
          if (!answered) { answered = true; onResult(false, 'Too slow!'); }
        }, 1800);
      }

      function handleResp(key) {
        if (answered || !active) return;
        answered = true;
        clearTimeout(trialTimer);
        onResult(key === SHAPE_KEY[curShape], key === SHAPE_KEY[curShape] ? 'Correct!' : `Wrong! ${curShape === 'circle' ? 'Circles = ←' : 'Squares = →'}`);
      }

      function onResult(ok, msg) {
        if (ok) correct++;
        const fb = $('sf-fb');
        fb.textContent = msg;
        fb.className   = `zapn-feedback zapn-feedback--${ok ? 'good' : 'bad'}`;
        $('sf-s').textContent = correct;
        trial++;
        setTimeout(nextTrial, 650);
      }

      nextTrial();
    }
  });

  // --------------------------------------------------------------
  // 5. Digit — working memory span
  // --------------------------------------------------------------
  GAMES.push({
    name: 'Digit',
    tag: 'Working Memory',
    desc: 'Digits flash one at a time. Recall them in order, then in reverse.',
    hint: 'Watch the digits, then type them back. Phase 1: same order. Phase 2: reversed. Sequences grow until you fail twice at the same length.',
    play(el, done) {
      let phase = 0; // 0 = forward, 1 = backward
      let spanLen = 3, failures = 0;
      let maxFwd = 0, maxRev = 0;
      let sequence = [];

      function renderRound() {
        const phaseLabel = phase === 0 ? 'Forward Recall' : 'Reverse Recall';
        el.innerHTML = `
          <div class="zapn-dg-wrap">
            <div class="zapn-dg-phase">Phase ${phase + 1} / 2 — ${phaseLabel}</div>
            <div class="zapn-dg-meta">Sequence length: ${spanLen} · Best: Fwd ${maxFwd} · Rev ${maxRev}</div>
            <div class="zapn-dg-display" id="dg-display">
              <span id="dg-digit" class="zapn-dg-digit"></span>
            </div>
            <div id="dg-input-area" style="display:none">
              <p class="zapn-dg-instruction">${phase === 0 ? 'Type digits in order' : 'Type digits in REVERSE order'}</p>
              <input id="dg-input" class="zapn-dg-input" type="text" inputmode="numeric" autocomplete="off" maxlength="15" />
              <button class="btn btn-primary" id="dg-sub" style="margin-top:var(--space-sm)">Submit</button>
            </div>
            <div id="dg-fb" class="zapn-feedback"></div>
          </div>`;

        $('dg-sub').onclick   = submit;
        $('dg-input').onkeydown = e => { if (e.key === 'Enter') submit(); };
        showSeq();
      }

      function showSeq() {
        sequence = Array.from({ length: spanLen }, () => randInt(0, 9));
        const digitEl = $('dg-digit');
        let i = 0;

        function next() {
          if (i > 0) digitEl.textContent = '';
          setTimeout(() => {
            if (i < sequence.length) {
              digitEl.textContent = sequence[i++];
              setTimeout(next, 650);
            } else {
              digitEl.textContent = '';
              setTimeout(() => {
                $('dg-input-area').style.display = 'block';
                $('dg-input').focus();
              }, 400);
            }
          }, 150);
        }
        next();
      }

      function submit() {
        const val      = ($('dg-input').value || '').trim();
        const expected = phase === 0
          ? sequence.join('')
          : [...sequence].reverse().join('');
        const fb = $('dg-fb');

        if (val === expected) {
          if (phase === 0) maxFwd = Math.max(maxFwd, spanLen);
          else             maxRev = Math.max(maxRev, spanLen);
          fb.textContent = `Correct! Span ${spanLen}`;
          fb.className   = 'zapn-feedback zapn-feedback--good';
          failures = 0;
          spanLen++;
          setTimeout(renderRound, 900);
        } else {
          fb.textContent = `Wrong. Expected: ${expected}`;
          fb.className   = 'zapn-feedback zapn-feedback--bad';
          failures++;
          if (failures >= 2) {
            if (phase === 0) {
              phase    = 1;
              spanLen  = 3;
              failures = 0;
              setTimeout(renderRound, 1300);
            } else {
              const score = maxFwd + maxRev;
              setTimeout(() => done(score, `Fwd ${maxFwd} + Rev ${maxRev}`), 1300);
            }
          } else {
            spanLen = Math.max(3, spanLen - 1);
            setTimeout(renderRound, 1200);
          }
        }
      }

      renderRound();
    }
  });

  // --------------------------------------------------------------
  // 6. The Switch — cognitive flexibility (task switching)
  // --------------------------------------------------------------
  GAMES.push({
    name: 'The Switch',
    tag: 'Cognitive Flexibility',
    desc: 'Left panel = solve addition; right panel = same/different arrows. Switch between them fluidly.',
    hint: 'A stimulus appears on the LEFT or RIGHT. Left means math (pick the correct sum). Right means arrows (are both rows identical?). 15 trials, 4 s each.',
    play(el, done) {
      const TRIALS = 15;
      let trial = 0, correct = 0;
      let waiting = false, trialTimer = null;
      let curAnswer = null;

      el.innerHTML = `
        <div class="zapn-sw-wrap">
          <div class="zapn-sw-meta">Trial <span id="sw-t">1</span> / ${TRIALS} · Score: <span id="sw-s">0</span></div>
          <div class="zapn-sw-rule">LEFT panel → math &nbsp;|&nbsp; RIGHT panel → arrows same/different</div>
          <div class="zapn-sw-arena">
            <div class="zapn-sw-half">
              <span class="zapn-sw-side-label">LEFT — Math</span>
              <div id="sw-lc"></div>
            </div>
            <div class="zapn-sw-divider"></div>
            <div class="zapn-sw-half">
              <span class="zapn-sw-side-label">RIGHT — Arrows</span>
              <div id="sw-rc"></div>
            </div>
          </div>
          <div id="sw-resp" class="zapn-sw-response"></div>
          <div id="sw-fb" class="zapn-feedback"></div>
        </div>`;

      function nextTrial() {
        if (trial >= TRIALS) {
          done(Math.round((correct / TRIALS) * 100), `${correct} / ${TRIALS}`);
          return;
        }
        waiting = true;
        $('sw-t').textContent  = trial + 1;
        $('sw-fb').textContent = '';
        $('sw-fb').className   = 'zapn-feedback';
        $('sw-lc').innerHTML   = '';
        $('sw-rc').innerHTML   = '';

        const side = Math.random() < 0.5 ? 'left' : 'right';
        const respEl = $('sw-resp');

        if (side === 'left') {
          const a = randInt(2, 25), b = randInt(2, 25), ans = a + b;
          curAnswer = String(ans);
          const opts = shuffle([ans, ans + randInt(1, 4), ans - randInt(1, 4), ans + randInt(5, 9)].filter((v, i, arr) => v > 0 && arr.indexOf(v) === i).slice(0, 4));
          while (opts.length < 4) opts.push(ans + randInt(-6, 6) || ans + 1);
          $('sw-lc').innerHTML = `<div class="zapn-sw-math">${a} + ${b} = ?</div>`;
          respEl.innerHTML = opts.slice(0, 4).map(o =>
            `<button class="btn zapn-sw-opt" data-v="${o}">${o}</button>`).join('');
        } else {
          const ARR = ['↑', '↓', '←', '→'];
          const seq1 = Array.from({ length: 3 }, () => pick(ARR));
          const same = Math.random() < 0.5;
          const seq2 = same ? [...seq1] : seq1.map(a => Math.random() < 0.5 ? pick(ARR.filter(x => x !== a)) : a);
          const actualSame = JSON.stringify(seq1) === JSON.stringify(seq2);
          curAnswer = actualSame ? 'same' : 'diff';
          $('sw-rc').innerHTML = `
            <div class="zapn-sw-arrows">
              <div class="zapn-sw-arrow-row">${seq1.join(' ')}</div>
              <div class="zapn-sw-arrow-row">${seq2.join(' ')}</div>
            </div>`;
          respEl.innerHTML = `
            <button class="btn zapn-sw-opt" data-v="same">Same</button>
            <button class="btn zapn-sw-opt" data-v="diff">Different</button>`;
        }

        respEl.querySelectorAll('.zapn-sw-opt').forEach(btn =>
          btn.addEventListener('click', () => { if (waiting) handleResp(btn.dataset.v); })
        );

        clearTimeout(trialTimer);
        trialTimer = setTimeout(() => {
          if (waiting) { waiting = false; onResult(false, 'Too slow!'); }
        }, 4000);
      }

      function handleResp(val) {
        if (!waiting) return;
        waiting = false;
        clearTimeout(trialTimer);
        onResult(val === curAnswer, val === curAnswer ? 'Correct!' : 'Wrong!');
      }

      function onResult(ok, msg) {
        if (ok) correct++;
        const fb = $('sw-fb');
        fb.textContent = msg;
        fb.className   = `zapn-feedback zapn-feedback--${ok ? 'good' : 'bad'}`;
        $('sw-s').textContent = correct;
        trial++;
        setTimeout(nextTrial, 750);
      }

      nextTrial();
    }
  });

  // --------------------------------------------------------------
  // 7. Number Box — mental arithmetic (24 Game variant)
  // --------------------------------------------------------------
  GAMES.push({
    name: 'Number Box',
    tag: 'Mental Arithmetic',
    desc: 'Use all four numbers with +, −, ×, ÷ and parentheses to hit the target.',
    hint: 'Type an expression using all four numbers exactly once (e.g. "(3+7)*4/2"). You can use parentheses. Press Enter or click Check. Skip a puzzle if you\'re stuck. 3 puzzles.',
    play(el, done) {
      const PUZZLES = 3;
      let puzzle = 0, solved = 0;

      function genPuzzle() {
        const ops = ['+', '-', '*', '/'];
        for (let attempt = 0; attempt < 300; attempt++) {
          const nums = Array.from({ length: 4 }, () => randInt(1, 9));
          const perm = shuffle(nums);
          const o1 = pick(ops), o2 = pick(ops), o3 = pick(ops);
          const forms = [
            `((${perm[0]}${o1}${perm[1]})${o2}${perm[2]})${o3}${perm[3]}`,
            `(${perm[0]}${o1}(${perm[1]}${o2}${perm[2]}))${o3}${perm[3]}`,
            `${perm[0]}${o1}((${perm[1]}${o2}${perm[2]})${o3}${perm[3]})`,
            `(${perm[0]}${o1}${perm[1]})${o2}(${perm[2]}${o3}${perm[3]})`,
          ];
          try {
            const val = new Function(`return ${forms[Math.floor(Math.random() * forms.length)]}`)();
            if (Number.isFinite(val) && Number.isInteger(val) && val >= 5 && val <= 100) {
              return { nums, target: val };
            }
          } catch (_) { /* continue */ }
        }
        return { nums: [1, 2, 3, 4], target: 10 };
      }

      function renderPuzzle() {
        const p = genPuzzle();
        el.innerHTML = `
          <div class="zapn-nb-wrap">
            <div class="zapn-nb-meta">Puzzle ${puzzle + 1} / ${PUZZLES} · Solved: ${solved}</div>
            <div class="zapn-nb-target">Target: <span class="zapn-nb-num">${p.target}</span></div>
            <div class="zapn-nb-numbers">Numbers: ${p.nums.map(n => `<span class="zapn-nb-tile">${n}</span>`).join('')}</div>
            <p class="zapn-nb-hint">Use all four numbers exactly once with +&nbsp;−&nbsp;*&nbsp;/ and parentheses.</p>
            <div class="zapn-nb-input-row">
              <input id="nb-in" class="zapn-nb-input" type="text" placeholder="e.g. (3+7)*4/2" autocomplete="off" />
              <button class="btn btn-primary" id="nb-check">Check</button>
            </div>
            <div id="nb-fb" class="zapn-feedback"></div>
            <button class="btn btn-sm" id="nb-skip" style="margin-top:var(--space-md);opacity:0.55">Skip puzzle</button>
          </div>`;

        $('nb-in').focus();
        $('nb-check').onclick = check;
        $('nb-in').onkeydown  = e => { if (e.key === 'Enter') check(); };
        $('nb-skip').onclick  = () => { puzzle++; advance(false); };

        function check() {
          const fb    = $('nb-fb');
          const raw   = ($('nb-in').value || '').trim();
          const clean = raw.replace(/\s/g, '');
          if (!clean) return;
          if (clean.length > 50 || !/^[\d+\-*/().]+$/.test(clean)) {
            fb.textContent = 'Only digits and + − * / ( ) allowed.';
            fb.className = 'zapn-feedback zapn-feedback--bad';
            return;
          }
          const usedNums = (clean.match(/\d+/g) || []).map(Number);
          const sort = a => [...a].sort((x, y) => x - y);
          if (JSON.stringify(sort(usedNums)) !== JSON.stringify(sort(p.nums))) {
            fb.textContent = 'Must use all four numbers exactly once.';
            fb.className = 'zapn-feedback zapn-feedback--bad';
            return;
          }
          let result;
          try { result = new Function(`'use strict'; return (${clean})`)(); }
          catch (_) {
            fb.textContent = 'Invalid expression.';
            fb.className = 'zapn-feedback zapn-feedback--bad';
            return;
          }
          if (!Number.isFinite(result)) {
            fb.textContent = 'Result is not finite (division by zero?).';
            fb.className = 'zapn-feedback zapn-feedback--bad';
            return;
          }
          if (Math.abs(result - p.target) < 0.001) {
            fb.textContent = `= ${result} ✓`;
            fb.className = 'zapn-feedback zapn-feedback--good';
            solved++;
            puzzle++;
            setTimeout(() => advance(true), 1200);
          } else {
            fb.textContent = `= ${result} · Need ${p.target}`;
            fb.className = 'zapn-feedback zapn-feedback--bad';
          }
        }
      }

      function advance() {
        if (puzzle >= PUZZLES) {
          done(Math.round((solved / PUZZLES) * 100), `${solved} / ${PUZZLES} solved`);
        } else {
          renderPuzzle();
        }
      }

      renderPuzzle();
    }
  });

  // --------------------------------------------------------------
  // 8. Code Compare — pattern recognition
  // --------------------------------------------------------------
  GAMES.push({
    name: 'Code Compare',
    tag: 'Pattern Recognition',
    desc: 'A numeric code appears at the top. Find the matching option before time runs out.',
    hint: 'Read the code at the top, then click the matching option. The timer shrinks with each round. 10 rounds.',
    play(el, done) {
      const ROUNDS = 10;
      let round = 0, correct = 0;
      let timerInterval = null, answered = false;

      function genDistractor(code) {
        const arr = code.split('');
        const changes = Math.random() < 0.5 ? 1 : 2;
        const positions = shuffle([...Array(arr.length).keys()]).slice(0, changes);
        positions.forEach(p => {
          let d;
          do { d = String(Math.floor(Math.random() * 10)); } while (d === arr[p]);
          arr[p] = d;
        });
        return arr.join('');
      }

      function showRound() {
        if (round >= ROUNDS) {
          done(Math.round((correct / ROUNDS) * 100), `${correct} / ${ROUNDS}`);
          return;
        }
        answered = false;
        clearInterval(timerInterval);

        // Progressive: 4 digits → 5 → 6 → 7; time 3.4s → 1.4s
        const len    = 4 + Math.floor(round / 3);          // 4,4,4,5,5,5,6,6,6,6
        const timeLimit = Math.max(1.4, 3.4 - round * 0.22);
        const code   = Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join('');
        const opts   = [code];
        let attempts = 0;
        while (opts.length < 4 && attempts++ < 50) {
          const d = genDistractor(code);
          if (!opts.includes(d)) opts.push(d);
        }
        while (opts.length < 4) opts.push(genDistractor(code + '0').slice(0, len));
        const shuffled = shuffle(opts);

        el.innerHTML = `
          <div class="zapn-cc-wrap">
            <div class="zapn-cc-meta">Round ${round + 1} / ${ROUNDS} · Score: ${correct}</div>
            <div class="zapn-cc-code">${code}</div>
            <div class="zapn-cc-timer-bar"><div class="zapn-cc-timer-fill" id="cc-fill"></div></div>
            <div class="zapn-cc-options">
              ${shuffled.map(o => `<button class="btn zapn-cc-opt" data-v="${o}">${o}</button>`).join('')}
            </div>
            <div id="cc-fb" class="zapn-feedback"></div>
          </div>`;

        const fill = $('cc-fill');
        fill.style.transition = 'none';
        fill.style.width = '100%';
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            fill.style.transition = `width ${timeLimit}s linear`;
            fill.style.width = '0%';
          });
        });

        el.querySelectorAll('.zapn-cc-opt').forEach(btn =>
          btn.addEventListener('click', () => {
            if (answered) return;
            answered = true;
            clearInterval(timerInterval);
            const ok = btn.dataset.v === code;
            if (ok) correct++;
            const fb = $('cc-fb');
            fb.textContent = ok ? 'Match!' : `Wrong — it was ${code}`;
            fb.className   = `zapn-feedback zapn-feedback--${ok ? 'good' : 'bad'}`;
            round++;
            setTimeout(showRound, 650);
          })
        );

        let elapsed = 0;
        timerInterval = setInterval(() => {
          elapsed += 100;
          if (elapsed >= timeLimit * 1000 && !answered) {
            answered = true;
            clearInterval(timerInterval);
            const fb = $('cc-fb');
            fb.textContent = `Time up! It was ${code}`;
            fb.className   = 'zapn-feedback zapn-feedback--bad';
            round++;
            setTimeout(showRound, 650);
          }
        }, 100);
      }

      showRound();
    }
  });

  // --------------------------------------------------------------
  // 9. Figure It Out — logical deduction (Mastermind-style)
  // --------------------------------------------------------------
  GAMES.push({
    name: 'Figure It Out',
    tag: 'Logical Deduction',
    desc: 'Discover a hidden figure\'s shape, color, and pattern. Each guess reveals which attributes are correct.',
    hint: 'Select one option per attribute and submit a guess. You get ✓ (correct) or ✗ (wrong) for each attribute. Find the answer in as few guesses as possible. 3 rounds.',
    play(el, done) {
      const PUZZLES = 3;
      const SHAPES   = ['Circle', 'Triangle', 'Square', 'Diamond'];
      const COLORS   = ['Red', 'Blue', 'Green', 'Yellow'];
      const PATTERNS = ['Solid', 'Striped', 'Dotted', 'Outlined'];
      const HEX = { Red: '#E74C3C', Blue: '#3498DB', Green: '#2ECC71', Yellow: '#F1C40F' };

      let puzzle = 0, totalScore = 0;
      let target, guesses, history;

      function startPuzzle() {
        target  = { shape: pick(SHAPES), color: pick(COLORS), pattern: pick(PATTERNS) };
        guesses = 0;
        history = [];
        renderGuess();
      }

      function renderGuess() {
        const histHTML = history.map((g, i) => `
          <div class="zapn-fi-guess-row">
            <span class="zapn-fi-guess-num">${i + 1}.</span>
            <span>${g.shape} <span class="${g.shapeOk ? 'zapn-fi-ok' : 'zapn-fi-bad'}">${g.shapeOk ? '✓' : '✗'}</span></span>
            <span>${g.color} <span class="${g.colorOk ? 'zapn-fi-ok' : 'zapn-fi-bad'}">${g.colorOk ? '✓' : '✗'}</span></span>
            <span>${g.pattern} <span class="${g.patternOk ? 'zapn-fi-ok' : 'zapn-fi-bad'}">${g.patternOk ? '✓' : '✗'}</span></span>
          </div>`).join('');

        el.innerHTML = `
          <div class="zapn-fi-wrap">
            <div class="zapn-fi-meta">Puzzle ${puzzle + 1} / ${PUZZLES} · Guesses: ${guesses}</div>
            <p class="zapn-fi-instruction">Find the hidden figure. Each guess shows ✓ or ✗ per attribute.</p>
            <div class="zapn-fi-selects">
              <div class="zapn-fi-sel-group">
                <span class="label">Shape</span>
                <div class="zapn-fi-opts">${SHAPES.map(s =>
                  `<button class="btn zapn-fi-opt" data-attr="shape" data-val="${s}">${s}</button>`).join('')}
                </div>
              </div>
              <div class="zapn-fi-sel-group">
                <span class="label">Color</span>
                <div class="zapn-fi-opts">${COLORS.map(c =>
                  `<button class="btn zapn-fi-opt" data-attr="color" data-val="${c}" style="border-left:3px solid ${HEX[c]}">${c}</button>`).join('')}
                </div>
              </div>
              <div class="zapn-fi-sel-group">
                <span class="label">Pattern</span>
                <div class="zapn-fi-opts">${PATTERNS.map(p =>
                  `<button class="btn zapn-fi-opt" data-attr="pattern" data-val="${p}">${p}</button>`).join('')}
                </div>
              </div>
            </div>
            <p id="fi-preview" class="zapn-fi-guess-preview">Select one option per attribute to continue</p>
            <button class="btn btn-primary" id="fi-sub" disabled>Submit Guess</button>
            ${history.length ? `<div class="zapn-fi-history">${histHTML}</div>` : ''}
            <div id="fi-fb" class="zapn-feedback"></div>
          </div>`;

        const selected  = { shape: null, color: null, pattern: null };
        const submitBtn = $('fi-sub');

        el.querySelectorAll('.zapn-fi-opt').forEach(btn => {
          btn.addEventListener('click', () => {
            const { attr, val } = btn.dataset;
            el.querySelectorAll(`.zapn-fi-opt[data-attr="${attr}"]`).forEach(b => b.classList.remove('zapn-fi-opt--selected'));
            btn.classList.add('zapn-fi-opt--selected');
            selected[attr] = val;
            const allSet = selected.shape && selected.color && selected.pattern;
            submitBtn.disabled = !allSet;
            if (allSet) $('fi-preview').textContent = `${selected.shape} · ${selected.color} · ${selected.pattern}`;
          });
        });

        submitBtn.addEventListener('click', () => {
          if (!selected.shape || !selected.color || !selected.pattern) return;
          guesses++;
          const shapeOk   = selected.shape   === target.shape;
          const colorOk   = selected.color   === target.color;
          const patternOk = selected.pattern === target.pattern;
          history.push({ ...selected, shapeOk, colorOk, patternOk });

          if (shapeOk && colorOk && patternOk) {
            const pts = Math.max(20, 100 - (guesses - 1) * 20);
            totalScore += pts;
            el.innerHTML = `
              <div class="zapn-fi-wrap">
                <div class="zapn-feedback zapn-feedback--good" style="font-size:1.2rem">
                  Solved in ${guesses} guess${guesses > 1 ? 'es' : ''}! +${pts} pts
                </div>
                <p style="margin-top:0.9rem;color:var(--text-secondary)">
                  ${target.shape} · ${target.color} · ${target.pattern}
                </p>
              </div>`;
            puzzle++;
            if (puzzle >= PUZZLES) {
              setTimeout(() => done(Math.round(totalScore / PUZZLES), `avg ${Math.round(totalScore / PUZZLES)} / 100`), 1500);
            } else {
              setTimeout(startPuzzle, 1700);
            }
          } else if (guesses >= 8) {
            el.innerHTML = `
              <div class="zapn-fi-wrap">
                <div class="zapn-feedback zapn-feedback--bad">Max guesses reached.</div>
                <p style="margin-top:0.8rem;color:var(--text-secondary)">
                  Answer: ${target.shape} · ${target.color} · ${target.pattern}
                </p>
              </div>`;
            puzzle++;
            if (puzzle >= PUZZLES) {
              setTimeout(() => done(Math.round(totalScore / PUZZLES), `avg ${Math.round(totalScore / PUZZLES)} / 100`), 1500);
            } else {
              setTimeout(startPuzzle, 1700);
            }
          } else {
            renderGuess();
          }
        });
      }

      startPuzzle();
    }
  });

  // ==============================================================
  // FLOW CONTROL
  // ==============================================================

  function showSection(id) {
    ['zapn-intro', 'zapn-game', 'zapn-results'].forEach(sid => {
      const el = $(sid);
      if (el) el.style.display = sid === id ? '' : 'none';
    });
  }

  function startTest() {
    currentGameIdx = 0;
    scores.fill(null);
    beginGame(0);
  }

  function beginGame(idx) {
    currentGameIdx = idx;
    showSection('zapn-game');

    const g = GAMES[idx];
    const pct = Math.round((idx / GAMES.length) * 100);
    $('zapn-progress-fill').style.width = `${pct}%`;
    $('zapn-game-label').textContent    = `Game ${idx + 1} / ${GAMES.length} · ${g.tag}`;
    $('zapn-game-title').textContent    = g.name;
    $('zapn-game-subtitle').textContent = g.desc;
    $('zapn-hint-text').textContent     = g.hint;

    $('zapn-instruction-card').style.display = '';
    const area = $('zapn-game-area');
    area.style.display = 'none';
    area.innerHTML = '';

    $('zapn-ready-btn').onclick = () => {
      $('zapn-instruction-card').style.display = 'none';
      area.style.display = '';
      g.play(area, (score, label) => {
        scores[idx] = { score, label };
        showGameComplete(idx, label);
      });
    };
  }

  function showGameComplete(idx, label) {
    const isLast = idx === GAMES.length - 1;
    $('zapn-game-area').innerHTML = `
      <div class="zapn-gameover">
        <span class="label">${GAMES[idx].name} complete</span>
        <h2 style="margin:var(--space-sm) 0 var(--space-md)">${label}</h2>
        <button id="zapn-next-btn" class="btn btn-primary">
          ${isLast ? 'See Results' : 'Next Game →'}
        </button>
      </div>`;
    $('zapn-next-btn').onclick = isLast ? showResults : () => beginGame(idx + 1);
  }

  // Normalize each game's raw score to the 0-100 scale.
  function zapnNorm(idx, raw) {
    if (raw == null) return 0;
    const v = [
      raw,                                                         // 0 Stock Master   0-100
      Math.min(100, Math.round(raw / 25 * 100)),                  // 1 Balloon         $0-$25 → 0-100
      raw,                                                         // 2 Skyscraper      0-100
      raw,                                                         // 3 Shapeshift      0-100
      Math.min(100, Math.round(Math.max(0, raw - 6) / 12 * 100)), // 4 Digit           span 6-18 → 0-100
      raw,                                                         // 5 Switch          0-100
      raw,                                                         // 6 Number Box      0-100
      raw,                                                         // 7 Code Compare    0-100
      Math.round(Math.max(0, raw - 20) / 80 * 100),               // 8 Figure It Out   20-100 → 0-100
    ];
    return Math.max(0, Math.min(100, v[idx] ?? raw));
  }

  function showResults() {
    showSection('zapn-results');
    $('zapn-progress-fill').style.width = '100%';

    $('zapn-scores-list').innerHTML = GAMES.map((g, i) => {
      const s = scores[i];
      return `
        <div class="zapn-result-row">
          <span class="zapn-result-name">${g.name}</span>
          <span class="zapn-result-tag">${g.tag}</span>
          <span class="zapn-result-score">${s ? s.label : '—'}</span>
        </div>`;
    }).join('');

    $('zapn-restart-btn').onclick = startTest;

    // Submit normalized overall score to the leaderboard
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
      const filled = scores.filter(s => s !== null);
      if (filled.length > 0) {
        const overall = Math.round(
          scores.reduce((sum, s, i) => sum + (s ? zapnNorm(i, s.score) : 0), 0) /
          filled.length
        );
        fetch('/api/drill/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ score: overall, correct: 0, wrong: 0, skipped: 0, duration_s: 0, game_type: 'zapn' }),
        });
      }
    }
  }

  // ==============================================================
  // INIT
  // ==============================================================

  document.addEventListener('DOMContentLoaded', () => {
    const startBtn = $('zapn-start-btn');
    if (startBtn) {
      startBtn.onclick = startTest;
    }
    showSection('zapn-intro');
  });
})();
