// ============================================================
// THE SLINGSHOT — TRAJECTORY SHIM
// Adds optional benchmarking (Supabase) to the game.
//
// ZERO changes to existing game logic.
// This file is loaded AFTER the game and wraps endGame()
// to read (never modify) game state and send to Supabase.
//
// If Supabase is unreachable, the game works exactly as before.
// To remove: delete this file and its <script> tag.
// ============================================================

(function() {
  'use strict';

  // ==================== CONFIG ====================
  const SUPABASE_URL = 'https://rqukezqiximsmpygjeqi.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdWtlenFpeGltc21weWdqZXFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1ODc1MjAsImV4cCI6MjA4OTE2MzUyMH0.oTYfRz0YXDFiAo63OSobD2anwrdoA8zZHP8hrZjRNHA';

  // State — set during opt-in, read at end of game
  let trajectoryEnabled = false;  // true = show comparison at end
  let recordingEnabled = false;   // true = record data (always, even if player skips comparison)
  let playerId = null;
  let playerLevel = null;
  let playerNickname = null;
  let sessionId = null; // null for solo players
  let gameStartTime = null;
  let sb = null; // Supabase client, initialised lazily

  // ==================== HTML ESCAPING ====================
  // All values that originate from the database (other players' input)
  // must pass through this before being inserted into innerHTML.
  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ==================== SUPABASE INIT ====================
  function initSupabase() {
    if (sb) return sb;
    try {
      if (typeof supabase !== 'undefined' && supabase.createClient) {
        sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      }
    } catch (e) {
      console.warn('[Trajectory] Could not init Supabase:', e);
    }
    return sb;
  }

  // ==================== OPT-IN OVERLAY ====================
  // Shown before the game's own setup begins.
  // Player chooses: benchmark (with level + nickname + optional join code) or skip.

  function showOptInOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'trajectoryOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,15,35,0.95);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;font-family:system-ui,sans-serif;';
    overlay.innerHTML = `
      <div style="background:#1e1e3a;border:1px solid rgba(255,255,255,0.15);border-radius:1rem;max-width:460px;width:100%;padding:2rem;color:white;max-height:90vh;overflow-y:auto;">
        <h2 style="font-size:1.5rem;font-weight:800;margin:0 0 0.25rem;">Trajectory</h2>
        <p style="color:#a5b4fc;font-size:0.875rem;margin:0 0 1.25rem;">Compare your startup journey to other players</p>

        <p style="color:#cbd5e1;font-size:0.85rem;margin:0 0 1.25rem;line-height:1.5;">
          Want to see how your choices and outcomes compare to other players? Enter a nickname and your level below. When the game ends, you'll see where you stand — which founder type, sector, funding path, and location others chose, and how your valuation, milestones, and equity compare.
        </p>

        <div id="trajFields" style="display:flex;flex-direction:column;gap:0.75rem;margin-bottom:1.25rem;">
          <div>
            <label style="display:block;font-size:0.75rem;color:#cbd5e1;margin-bottom:0.25rem;">Nickname</label>
            <input id="trajNickname" type="text" placeholder="e.g. RocketSam" maxlength="30"
              style="width:100%;padding:0.6rem 0.75rem;background:#0f0f23;border:1px solid rgba(255,255,255,0.2);border-radius:0.5rem;color:white;font-size:0.9rem;box-sizing:border-box;">
            <p style="color:#64748b;font-size:0.7rem;margin:0.25rem 0 0;">Pick anything — this is not linked to your identity.</p>
          </div>
          <div>
            <label style="display:block;font-size:0.75rem;color:#cbd5e1;margin-bottom:0.25rem;">Your level</label>
            <select id="trajLevel"
              style="width:100%;padding:0.6rem 0.75rem;background:#0f0f23;border:1px solid rgba(255,255,255,0.2);border-radius:0.5rem;color:white;font-size:0.9rem;box-sizing:border-box;">
              <option value="" disabled selected>Select level</option>
              <option value="ug">Undergraduate</option>
              <option value="masters">Masters</option>
              <option value="mba">MBA</option>
              <option value="other">Other</option>
            </select>
            <p style="color:#64748b;font-size:0.7rem;margin:0.25rem 0 0;">So we compare you to players at the same level.</p>
          </div>
          <div>
            <label style="display:block;font-size:0.75rem;color:#cbd5e1;margin-bottom:0.25rem;">Class join code <span style="color:#64748b;">(optional — from your lecturer)</span></label>
            <input id="trajJoinCode" type="text" placeholder="e.g. ABK4T7" maxlength="6"
              style="width:100%;padding:0.6rem 0.75rem;background:#0f0f23;border:1px solid rgba(255,255,255,0.2);border-radius:0.5rem;color:white;font-size:0.9rem;text-transform:uppercase;letter-spacing:0.15em;box-sizing:border-box;">
            <p style="color:#64748b;font-size:0.7rem;margin:0.25rem 0 0;">If your lecturer gave you a code, enter it here. If not, leave blank.</p>
          </div>
        </div>

        <div id="trajError" style="display:none;color:#f87171;font-size:0.8rem;text-align:center;margin-bottom:0.75rem;"></div>

        <button id="trajOptIn" onclick="window._trajectoryOptIn()"
          style="width:100%;padding:0.75rem;background:#4f46e5;color:white;font-weight:700;font-size:1rem;border:none;border-radius:0.5rem;cursor:pointer;margin-bottom:0.75rem;">
          Compare my game
        </button>
        <button id="trajSkip" onclick="window._trajectorySkip()"
          style="width:100%;padding:0.65rem;background:rgba(255,255,255,0.05);color:white;font-size:0.9rem;font-weight:500;border:1px solid rgba(255,255,255,0.2);border-radius:0.5rem;cursor:pointer;margin-bottom:1.25rem;">
          Skip — just play the game
        </button>

        <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:1rem;">
          <p style="color:#94a3b8;font-size:0.7rem;margin:0;line-height:1.5;">
            <span style="color:#6ee7b7;">Privacy:</span>
            No real names, emails, accounts or cookies — no personal information is collected or retained. Your chosen nickname and game outcomes are stored anonymously on EU servers (Frankfurt) purely to show you how your play compares with other founders. It is feedback for you, not a data-collection or research exercise —
            <a href="https://slingshotsim.org/classroom.html" target="_blank" style="color:#a5b4fc;text-decoration:underline;">learn more</a>.
          </p>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function hideOverlay() {
    const el = document.getElementById('trajectoryOverlay');
    if (el) el.remove();
  }

  function showError(msg) {
    const el = document.getElementById('trajError');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }

  // ==================== OPT-IN HANDLER ====================
  window._trajectoryOptIn = async function() {
    const nickname = (document.getElementById('trajNickname').value || '').trim();
    const level = document.getElementById('trajLevel').value;
    const joinCode = (document.getElementById('trajJoinCode').value || '').trim().toUpperCase();

    if (!nickname) { showError('Please enter a nickname.'); return; }
    if (nickname.length > 30) { showError('Nickname must be 30 characters or fewer.'); return; }
    if (!level) { showError('Please select your level.'); return; }

    const btn = document.getElementById('trajOptIn');
    btn.textContent = 'Setting up...';
    btn.disabled = true;

    try {
      const client = initSupabase();
      if (!client) throw new Error('Could not connect');

      // If join code provided, look up the session
      if (joinCode) {
        const { data: session, error: sessErr } = await client.from('sessions')
          .select('id, student_level')
          .eq('join_code', joinCode)
          .single();

        if (sessErr || !session) {
          showError('Join code not found. Check the code or leave it blank to play solo.');
          btn.textContent = 'Compare my game';
          btn.disabled = false;
          return;
        }
        sessionId = session.id;
        // Use the session's level rather than what the player picked
        playerLevel = session.student_level;
      } else {
        playerLevel = level;
      }

      // Create player record
      const { data: player, error: playerErr } = await client.from('players')
        .insert({
          session_id: sessionId,
          nickname: nickname,
          student_level: playerLevel,
          finished: false
        })
        .select()
        .single();

      if (playerErr) throw playerErr;

      playerId = player.id;
      playerNickname = nickname;
      trajectoryEnabled = true;   // show comparison at end
      recordingEnabled = true;    // record data
      gameStartTime = Date.now();

      console.log('[Trajectory] Opted in. Player ID:', playerId, 'Level:', playerLevel);
    } catch (e) {
      console.warn('[Trajectory] Opt-in failed, continuing without benchmarking:', e);
      // Fail silently — game still works
    }

    hideOverlay();
    // Continue the game flow
    if (window._trajectoryContinue) window._trajectoryContinue();
  };

  // ==================== SKIP HANDLER ====================
  // Player skips the comparison screen, but we still record their game
  // anonymously to build the benchmark pool.
  window._trajectorySkip = async function() {
    trajectoryEnabled = false; // won't show comparison at end
    gameStartTime = Date.now();

    try {
      const client = initSupabase();
      if (client) {
        // Create an anonymous player record (no nickname, default level)
        const { data: player } = await client.from('players')
          .insert({
            session_id: null,
            nickname: 'Anonymous',
            student_level: 'other',
            finished: false
          })
          .select()
          .single();

        if (player) {
          playerId = player.id;
          playerLevel = 'other';
          recordingEnabled = true;
          console.log('[Trajectory] Skipped comparison, recording anonymously. Player ID:', playerId);
        }
      }
    } catch (e) {
      console.warn('[Trajectory] Anonymous setup failed (game unaffected):', e);
    }

    hideOverlay();
    if (window._trajectoryContinue) window._trajectoryContinue();
  };

  // ==================== ENGAGEMENT SCORE ====================
  // 1-5 scale based on decision variety and information usage (NOT time).
  // Reads game state — never modifies it.

  function computeEngagementScore(g) {
    try {
      let score = 0;
      const checks = [];

      // 1. Decision diversity: did they vary their AP allocation across domains?
      if (g.domainInvestments) {
        const vals = Object.values(g.domainInvestments).filter(v => v > 0);
        checks.push(vals.length >= 3); // used at least 3 of 4 domains
      }

      // 2. Did they complete at least one milestone?
      checks.push((g.completedMilestones || []).length >= 1);

      // 3. Did they survive past quarter 4?
      checks.push((g.turn || 0) > 4);

      // 4. Did they engage with funder advice at all?
      checks.push((g.funderAdviceFollowed || 0) + (g.funderAdviceIgnored || 0) > 0);

      // 5. Did they make varied strategic choices (mix of aggressive and conservative)?
      const totalChoices = (g.aggressiveChoices || 0) + (g.conservativeChoices || 0);
      checks.push(totalChoices > 0 && (g.aggressiveChoices || 0) > 0 && (g.conservativeChoices || 0) > 0);

      score = checks.filter(Boolean).length;
      return Math.max(1, Math.min(5, score));
    } catch (e) {
      return null;
    }
  }

  // ==================== RECORD OUTCOME ====================
  // Called after the original endGame() has run.
  // Reads game state, writes to Supabase, then refreshes benchmarks.

  async function recordOutcome(g, reason) {
    if (g && g.gameMode === 'seed') return; // Seed is a learning mode; never benchmarked
    if (!recordingEnabled || !playerId) return;

    try {
      const client = initSupabase();
      if (!client) return;

      const engagementMins = gameStartTime
        ? Math.round((Date.now() - gameStartTime) / 60000)
        : null;

      const engagementScore = computeEngagementScore(g);

      // Total funding raised from investors array
      const totalFunding = (g.investors || []).reduce((sum, inv) => sum + (inv.amount || 0), 0);
      const numRounds = (g.investors || []).length;

      // Funding path: the initial funding stage
      const fundingPath = g.fundingStage || (g.funder ? g.funder.type : null);

      const outcome = {
        player_id: playerId,
        founder_type: g.founder?.profile?.name || g.founder?.name || null,
        sector: g.company?.archetype || g.company?.name || null,
        location: g.location?.name || null,
        funding_path: fundingPath,
        end_reason: reason,
        final_turn: g.turn || null,
        final_cash: g.metrics?.cash || 0,
        milestones_completed: (g.completedMilestones || []).length,
        total_funding_raised: totalFunding,
        num_funding_rounds: numRounds,
        peak_valuation: g.peakValuation || g.metrics?.val || 0,
        final_valuation: g.metrics?.val || 0,
        final_revenue: g.metrics?.revenue || 0,
        final_customers: g.metrics?.customers || 0,
        final_staff: g.metrics?.staff || 0,
        engagement_mins: engagementMins,
        engagement_score: engagementScore,
        detail: {
          startupName: g.company?.name,
          pivots: (g.pivotHistory || []).length,
          funderAdviceFollowed: g.funderAdviceFollowed || 0,
          funderAdviceIgnored: g.funderAdviceIgnored || 0
        }
      };

      // Mark player as finished
      await client.from('players')
        .update({ finished: true })
        .eq('id', playerId);

      // Insert outcome
      await client.from('outcomes')
        .insert(outcome);

      // Refresh benchmarks (server-side function)
      await client.rpc('refresh_benchmarks');

      console.log('[Trajectory] Outcome recorded successfully.');
    } catch (e) {
      console.warn('[Trajectory] Failed to record outcome (game unaffected):', e);
    }
  }

  // ==================== TRAJECTORY RESULTS SCREEN ====================
  // Injected into the end modal for opted-in players.
  // Encouraging tone — celebrates what went well, nudges replay.

  const METRIC_LABELS = {
    milestones_completed:  { label: 'Milestones Completed', unit: '',  prefix: '' },
    final_turn:            { label: 'Quarters Survived',    unit: '',  prefix: '' },
    peak_valuation:        { label: 'Peak Valuation',       unit: 'k', prefix: '£' },
    total_funding_raised:  { label: 'Total Funding Raised', unit: 'k', prefix: '£' },
    num_funding_rounds:    { label: 'Funding Rounds',       unit: '',  prefix: '' },
    final_valuation:       { label: 'Final Valuation',      unit: 'k', prefix: '£' },
  };

  const METRIC_ORDER = [
    'milestones_completed', 'final_turn', 'peak_valuation',
    'total_funding_raised', 'num_funding_rounds',
    'final_valuation'
  ];

  // Encouraging messages per metric and band
  const ENCOURAGEMENT = {
    milestones_completed: {
      top:    'Impressive milestone progress',
      above:  'Solid milestone progress — keep pushing',
      below:  'You got milestones done — that\'s further than many players get',
      bottom: 'Milestones are tough — a different strategy could help next time',
    },
    final_turn: {
      top:    'You outlasted nearly everyone',
      above:  'You outlasted most players at your level',
      below:  'You kept going longer than some — every quarter teaches you something',
      bottom: 'A short run, but now you know the terrain — try again!',
    },
    peak_valuation: {
      top:    'You built something really valuable',
      above:  'Strong valuation — you were on the right track',
      below:  'You created real value — room to grow next time',
      bottom: 'Building value takes time — a different approach could unlock more',
    },
    total_funding_raised: {
      top:    'Strong fundraising',
      above:  'Good fundraising — investors believed in you',
      below:  'You attracted some funding — try pitching differently next time',
      bottom: 'Fundraising is hard — many real founders struggle here too',
    },
    num_funding_rounds: {
      top:    'You attracted more investor interest than most',
      above:  'Above average investor engagement',
      below:  'Some investor traction — could be stronger next run',
      bottom: 'Investors are cautious — try a different pitch next time',
    },
    final_valuation: {
      top:    'Great final position',
      above:  'Solid ending — you had momentum',
      below:  'Not where you hoped, but your peak shows what\'s possible',
      bottom: 'Cash ran out — but your peak valuation shows real potential. Try a different strategy!',
    },
  };

  function getPercentileBand(value, p25, p50, p75) {
    // 2.1.64: with a small or uniform benchmark pool the percentiles collapse
    // (p25 = p75), and the old >= tests ranked a £0 run as "Top 25%".
    // With no spread, make no ranking claim.
    if (!(p75 > p25)) {
      if (value > p75) return { band: 'Ahead of recorded games so far', color: '#6366f1', pct: 62, tier: 'above' };
      return { band: 'In line with recorded games so far', color: '#94a3b8', pct: 40, tier: 'below' };
    }
    if (value > p75) return { band: 'Top 25%', color: '#10b981', pct: 87, tier: 'top' };
    if (value > p50) return { band: 'Above median', color: '#6366f1', pct: 62, tier: 'above' };
    if (value >= p25) return { band: 'Below median', color: '#f59e0b', pct: 37, tier: 'below' };
    return { band: 'Bottom 25%', color: '#ef4444', pct: 12, tier: 'bottom' };
  }

  // Color for the slim gradient bar
  function barGradient(color) {
    const MAP = {
      '#10b981': 'linear-gradient(90deg,#10b981,#34d399)',
      '#6366f1': 'linear-gradient(90deg,#6366f1,#818cf8)',
      '#f59e0b': 'linear-gradient(90deg,#f59e0b,#fbbf24)',
      '#ef4444': 'linear-gradient(90deg,#ef4444,#f87171)',
    };
    return MAP[color] || `linear-gradient(90deg,${color},${color})`;
  }

  // Render one slim comparison bar (6px)
  function renderSingleBar(playerValue, bench, label, meta, showN) {
    if (!bench) return '';
    const p25 = Number(bench.p25) || 0;
    const p50 = Number(bench.p50) || 0;
    const p75 = Number(bench.p75) || 0;
    const info = getPercentileBand(playerValue, p25, p50, p75);
    const medianVal = meta.prefix + Math.round(p50).toLocaleString() + meta.unit;
    const nLabel = showN ? ' <span style="color:#475569;">(n=' + (bench.sample_size || '?') + ')</span>' : '';
    return `
      <div style="margin-bottom:0.5rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.25rem;">
          <span style="font-size:0.7rem;color:#64748b;">${label}${nLabel}</span>
          <span style="font-size:0.7rem;color:#64748b;">median ${medianVal}</span>
        </div>
        <div style="height:6px;background:#0f172a;border-radius:3px;position:relative;">
          <div style="position:absolute;left:0;top:0;bottom:0;width:${Math.max(info.pct, 3)}%;background:${barGradient(info.color)};border-radius:3px;"></div>
        </div>
        <div style="font-size:0.65rem;color:#64748b;margin-top:0.15rem;">${info.band}</div>
      </div>`;
  }

  // Build a metric row with dual bars (class + all) or single bar if not enough class data
  function renderMetricBar(metricKey, playerValue, levelBench, allBench, levelLabel) {
    const meta = METRIC_LABELS[metricKey];
    if (!meta) return '';
    if (!levelBench && !allBench) return '';

    // Determine the primary bench for the encouraging message
    const primary = (levelBench && levelBench.sample_size >= 10) ? levelBench : allBench;
    if (!primary) return '';
    const p25 = Number(primary.p25) || 0;
    const p50 = Number(primary.p50) || 0;
    const p75 = Number(primary.p75) || 0;
    const info = getPercentileBand(playerValue, p25, p50, p75);
    const displayVal = meta.prefix + Math.round(playerValue).toLocaleString() + meta.unit;
    const msg = ENCOURAGEMENT[metricKey]?.[info.tier] || info.band;

    const hasLevel = levelBench && levelBench.sample_size >= 10;
    const hasAll = allBench && allBench.sample_size >= 1;
    const showDual = hasLevel && hasAll;

    let barsHtml = '';
    if (showDual) {
      barsHtml = renderSingleBar(playerValue, levelBench, 'Your ' + levelLabel + ' class', meta, true)
               + renderSingleBar(playerValue, allBench, 'All players', meta, false);
    } else if (hasLevel) {
      barsHtml = renderSingleBar(playerValue, levelBench, 'Your ' + levelLabel + ' class', meta, true);
    } else {
      barsHtml = renderSingleBar(playerValue, allBench, 'All players', meta, false);
    }

    return `
      <div style="margin-bottom:1.5rem;">
        <div style="display:flex;justify-content:space-between;margin-bottom:0.4rem;">
          <span style="font-size:0.85rem;color:#94a3b8;">${meta.label}</span>
          <span style="font-size:0.9rem;font-weight:600;color:white;">${displayVal}</span>
        </div>
        ${barsHtml}
        <div style="font-size:0.75rem;color:#94a3b8;margin-top:0.25rem;">${msg}</div>
      </div>`;
  }

  // Build choice distribution bar (rounded segments, player highlighted)
  function renderChoiceBar(label, playerChoice, distribution) {
    if (!distribution || distribution.length === 0) return '';

    const total = distribution.reduce((s, d) => s + d.count, 0);
    if (total === 0) return '';

    distribution.sort((a, b) => b.count - a.count);

    // Show top 5 choices as wrapping pills, rest grouped as "Other"
    const top = distribution.slice(0, 5);
    const rest = distribution.slice(5);
    const restCount = rest.reduce((s, d) => s + d.count, 0);
    if (restCount > 0) top.push({ value: 'Other', count: restCount });

    let pillsHtml = top.map((d) => {
      const pct = Math.round(d.count / total * 100);
      if (pct < 2) return '';
      const isPlayer = d.value === playerChoice;
      const bg = isPlayer ? '#6366f1' : '#374151';
      const outline = isPlayer ? 'outline:2px solid #a5b4fc;outline-offset:-2px;' : '';
      const weight = isPlayer ? 'font-weight:600;' : '';
      const textColor = isPlayer ? 'color:white;' : 'color:#cbd5e1;';
      return `<div style="background:${bg};padding:4px 10px;border-radius:6px;font-size:0.7rem;${textColor}${weight}${outline}white-space:nowrap;" title="${escapeHtml(d.value)}: ${pct}%">${escapeHtml(d.value)} ${pct}%</div>`;
    }).join('');

    return `
      <div style="margin-bottom:1.25rem;">
        <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;">
          <span style="font-size:0.85rem;color:#94a3b8;">${label}</span>
          <span style="font-size:0.8rem;color:#a5b4fc;">You: ${escapeHtml(playerChoice) || 'N/A'}</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">${pillsHtml}</div>
      </div>`;
  }

  // Fetch choice distribution from outcomes table
  async function fetchChoiceDistribution(client, field, level) {
    try {
      const { data, error } = await client
        .from('outcomes')
        .select(`${field}, player_id, players!inner(student_level)`)
        .not(field, 'is', null);

      if (error || !data) return [];

      let filtered = data.filter(r => r.players?.student_level === level);
      if (filtered.length < 10) filtered = data;

      const counts = {};
      filtered.forEach(r => {
        const val = r[field];
        if (val) counts[val] = (counts[val] || 0) + 1;
      });

      return Object.entries(counts).map(([value, count]) => ({ value, count }));
    } catch (e) {
      console.warn('[Trajectory] Choice distribution fetch failed:', e);
      return [];
    }
  }

  // Pick the 3 best metrics to highlight at the top
  function pickHighlights(playerValues, levelBenchMap, allBenchMap) {
    const scored = [];
    for (const key of METRIC_ORDER) {
      const primary = (levelBenchMap[key] && levelBenchMap[key].sample_size >= 10) ? levelBenchMap[key] : allBenchMap[key];
      if (!primary) continue;
      const info = getPercentileBand(playerValues[key], Number(primary.p25)||0, Number(primary.p50)||0, Number(primary.p75)||0);
      scored.push({ key, pct: info.pct, tier: info.tier, color: info.color });
    }
    // Sort best first, take top 3
    scored.sort((a, b) => b.pct - a.pct);
    return scored.slice(0, 3);
  }

  // Render a highlight tile
  function renderHighlight(metricKey, playerValue, tier) {
    const meta = METRIC_LABELS[metricKey];
    if (!meta) return '';
    const isTop = (tier === 'top' || tier === 'above');
    const bg = isTop ? 'background:#132218;border:1px solid #1a3a24;' : 'background:#1a1630;border:1px solid #2a2450;';
    const numColor = isTop ? '#34d399' : '#a5b4fc';
    const labelColor = isTop ? '#6ee7b7' : '#818cf8';
    const bandColor = isTop ? '#4ade80' : '#818cf8';
    const bandLabel = { top: 'Top 25% of players', above: 'Above median', below: 'Below median', bottom: 'Keep going!' }[tier];
    let displayVal = meta.prefix + Math.round(playerValue).toLocaleString() + meta.unit;
    // Shorten large numbers for tiles
    if (playerValue >= 1000 && meta.unit === 'k') {
      displayVal = meta.prefix + (playerValue / 1000).toFixed(1) + 'm';
    }
    return `<div style="flex:1;${bg}border-radius:0.75rem;padding:1rem;text-align:center;">
      <div style="font-size:1.5rem;font-weight:700;color:${numColor};">${displayVal}</div>
      <div style="font-size:0.75rem;color:${labelColor};margin-top:0.25rem;">${meta.label}</div>
      <div style="font-size:0.7rem;color:${bandColor};margin-top:0.3rem;">${bandLabel}</div>
    </div>`;
  }

  // Main function: fetch data and inject results into the end modal
  async function showTrajectoryResults(g, reason) {
    if (!trajectoryEnabled) return;

    try {
      const client = initSupabase();
      if (!client) return;

      const { data: benchmarks } = await client.from('benchmarks')
        .select('*')
        .in('student_level', [playerLevel, 'all']);

      if (!benchmarks || benchmarks.length === 0) {
        console.log('[Trajectory] No benchmarks available yet.');
        injectMinimalResults();
        return;
      }

      const levelBenchMap = {};
      const allBenchMap = {};
      benchmarks.forEach(b => {
        if (b.student_level === playerLevel) levelBenchMap[b.metric] = b;
        if (b.student_level === 'all') allBenchMap[b.metric] = b;
      });

      const totalFunding = (g.investors || []).reduce((s, i) => s + (i.amount || 0), 0);
      const playerValues = {
        milestones_completed: (g.completedMilestones || []).length,
        final_turn:           g.turn || 0,
        peak_valuation:       g.peakValuation || g.metrics?.val || 0,
        total_funding_raised: totalFunding,
        num_funding_rounds:   (g.investors || []).length,
        final_equity:         g.metrics?.equity || 0,
        final_valuation:      g.metrics?.val || 0,
      };

      const [founderDist, sectorDist, locationDist] = await Promise.all([
        fetchChoiceDistribution(client, 'founder_type', playerLevel),
        fetchChoiceDistribution(client, 'sector', playerLevel),
        fetchChoiceDistribution(client, 'location', playerLevel),
      ]);

      const playerFounder = g.founder?.profile?.name || g.founder?.name || null;
      const playerSector = g.company?.archetype || g.company?.name || null;
      const playerLocation = g.location?.name || null;

      const levelLabel = { ug: 'Undergraduate', masters: 'Masters', mba: 'MBA', other: 'All' }[playerLevel] || 'All';

      // Highlights — top 3 best metrics
      const highlights = pickHighlights(playerValues, levelBenchMap, allBenchMap);
      let highlightsHtml = highlights.map(h => renderHighlight(h.key, playerValues[h.key], h.tier)).join('');

      // Sample sizes for display
      const levelSample = Object.values(levelBenchMap)[0];
      const allSample = Object.values(allBenchMap)[0];
      const levelSize = levelSample?.sample_size || 0;
      const allSize = allSample?.sample_size || 0;
      const hasLevelData = levelSize >= 10;

      // Full metrics
      let metricsHtml = '';
      for (const key of METRIC_ORDER) {
        metricsHtml += renderMetricBar(key, playerValues[key], levelBenchMap[key], allBenchMap[key], levelLabel);
      }

      // Choices
      let choicesHtml = '';
      choicesHtml += renderChoiceBar('Founder Type', playerFounder, founderDist);
      choicesHtml += renderChoiceBar('Sector', playerSector, sectorDist);
      choicesHtml += renderChoiceBar('Location', playerLocation, locationDist);

      const trajectoryCard = document.createElement('div');
      trajectoryCard.id = 'trajectoryResults';
      trajectoryCard.innerHTML = `
        <div style="background:#1a1a2e;border-radius:1rem;padding:2rem;margin-bottom:1.5rem;border:1px solid #2a2a4a;">

          <div style="text-align:center;margin-bottom:2rem;">
            <p style="font-size:0.7rem;letter-spacing:0.15em;text-transform:uppercase;color:#818cf8;margin-bottom:0.5rem;">Trajectory</p>
            <h3 style="font-size:1.3rem;font-weight:600;color:#f1f5f9;margin:0 0 0.5rem;">Your Entrepreneurial Journey</h3>
            <p style="color:#94a3b8;font-size:0.85rem;line-height:1.5;">Every founder's path is different. Here's how yours compares to ${hasLevelData ? levelSize + ' ' + levelLabel + ' classmates and ' : ''}other players.</p>
          </div>

          ${highlightsHtml ? `<div style="display:flex;gap:0.75rem;margin-bottom:2rem;">${highlightsHtml}</div>` : ''}

          <h4 style="font-size:0.9rem;font-weight:600;color:#cbd5e1;margin-bottom:1.25rem;">Your full journey</h4>
          ${metricsHtml}

          ${choicesHtml ? `
            <div style="height:1px;background:#2a2a4a;margin:2rem 0 1.75rem;"></div>
            <h4 style="font-size:0.9rem;font-weight:600;color:#cbd5e1;margin-bottom:1.25rem;">What others chose</h4>
            ${choicesHtml}
          ` : ''}

          <div style="background:linear-gradient(135deg, #1e1b4b, #312e81);border-radius:0.75rem;padding:1.25rem;text-align:center;border:1px solid #3730a3;margin-top:2rem;">
            <p style="color:#cbd5e1;font-size:0.9rem;font-style:italic;margin:0 0 0.5rem;line-height:1.5;">"I have not failed. I've just found 10,000 ways that won't work."</p>
            <p style="color:#64748b;font-size:0.75rem;margin:0 0 1rem;">— Thomas Edison</p>
            <p style="color:#cbd5e1;font-size:0.9rem;font-style:italic;margin:0 0 0.5rem;line-height:1.5;">"Next time someone complains that you have made a mistake, tell him that may be a good thing. Because without imperfection, neither you nor I would exist."</p>
            <p style="color:#64748b;font-size:0.75rem;margin:0 0 0.75rem;">— Stephen Hawking</p>
            <p style="color:#94a3b8;font-size:0.8rem;margin:0;line-height:1.5;">Play again with a different founder, sector, or strategy — players almost always do better on their second attempt.</p>
          </div>

          <div style="text-align:center;padding-top:1rem;margin-top:1.25rem;">
            <p style="color:#475569;font-size:0.7rem;">
              ${playerNickname ? 'Playing as <span style="color:#94a3b8;">' + escapeHtml(playerNickname) + '</span> · ' : ''}Look up results at <a href="https://slingshotsim.org/classroom.html" target="_blank" style="color:#64748b;text-decoration:none;">slingshotsim.org</a>
            </p>
          </div>
        </div>`;

      injectResultsCard(trajectoryCard);
      console.log('[Trajectory] Results displayed.');
    } catch (e) {
      console.warn('[Trajectory] Could not show results (game unaffected):', e);
    }
  }

  // Inject when there aren't enough benchmarks yet
  function injectMinimalResults() {
    const card = document.createElement('div');
    card.id = 'trajectoryResults';
    card.innerHTML = `
      <div style="background:#1a1a2e;border-radius:1rem;padding:2rem;margin-bottom:1.5rem;border:1px solid #2a2a4a;text-align:center;">
        <p style="font-size:0.7rem;letter-spacing:0.15em;text-transform:uppercase;color:#818cf8;margin-bottom:0.5rem;">Trajectory</p>
        <h3 style="font-size:1.25rem;font-weight:600;color:#f1f5f9;margin:0 0 0.5rem;">Your Entrepreneurial Journey</h3>
        <p style="color:#a5b4fc;font-size:0.85rem;margin:0 0 0.75rem;">Your game has been recorded!</p>
        <p style="color:#94a3b8;font-size:0.85rem;margin:0 0 1.5rem;line-height:1.5;">
          There aren't enough games yet to show comparisons. As more players finish, you'll see how your journey stacks up. Look up your results later at <a href="https://slingshotsim.org/classroom.html" target="_blank" style="color:#818cf8;text-decoration:none;">slingshotsim.org</a>.
        </p>
        <div style="background:linear-gradient(135deg, #1e1b4b, #312e81);border-radius:0.75rem;padding:1.25rem;border:1px solid #3730a3;">
          <p style="color:#cbd5e1;font-size:0.9rem;font-style:italic;margin:0 0 0.35rem;line-height:1.5;">"I have not failed. I've just found 10,000 ways that won't work."</p>
          <p style="color:#64748b;font-size:0.75rem;margin:0 0 0.75rem;">— Thomas Edison</p>
          <p style="color:#cbd5e1;font-size:0.9rem;font-style:italic;margin:0 0 0.35rem;line-height:1.5;">"Next time someone complains that you have made a mistake, tell him that may be a good thing. Because without imperfection, neither you nor I would exist."</p>
          <p style="color:#64748b;font-size:0.75rem;margin:0 0 0.75rem;">— Stephen Hawking</p>
          <p style="color:#94a3b8;font-size:0.8rem;margin:0;line-height:1.5;">Play again with a different founder, sector, or strategy — players who try again almost always do better on their second attempt.</p>
        </div>
      </div>`;
    injectResultsCard(card);
  }

  // Find the right modal and insert the card before the Play Again section
  function injectResultsCard(card) {
    const endModal = document.getElementById('endModal');
    const victoryModal = document.getElementById('victoryModal');
    let target = null;

    if (endModal && endModal.classList.contains('flex')) {
      const mainCard = endModal.querySelector('.bg-white');
      if (mainCard && mainCard.nextElementSibling) {
        target = mainCard.nextElementSibling;
        target.parentNode.insertBefore(card, target);
      }
    } else if (victoryModal && victoryModal.classList.contains('flex')) {
      const buttons = victoryModal.querySelectorAll('.text-center');
      for (const btn of buttons) {
        if (btn.querySelector('button[onclick*="reload"]')) {
          target = btn;
          btn.parentNode.insertBefore(card, btn);
          break;
        }
      }
    }

    if (!target) {
      const visible = endModal?.classList.contains('flex') ? endModal : victoryModal;
      if (visible) {
        const inner = visible.querySelector('.max-w-2xl, .max-w-4xl');
        if (inner) inner.appendChild(card);
      }
    }
  }

  // ==================== MONKEY-PATCH endGame() ====================
  // Wraps the existing endGame method. Calls the original first,
  // then records the outcome to Supabase. If anything fails,
  // the original endGame has already run — game is unaffected.

  function patchEndGame() {
    if (typeof game === 'undefined' || !game.endGame) {
      console.warn('[Trajectory] Game object not found, retrying...');
      setTimeout(patchEndGame, 500);
      return;
    }

    const originalEndGame = game.endGame.bind(game);

    game.endGame = function(reason) {
      // Run the original endGame FIRST — game behaviour unchanged
      originalEndGame(reason);

      // Then record to Supabase, and show results if opted in
      recordOutcome(game, reason)
        .then(() => showTrajectoryResults(game, reason))
        .catch(e => {
          console.warn('[Trajectory] Recording/results failed (game unaffected):', e);
        });
    };

    console.log('[Trajectory] Patched endGame. Ready.');
  }

  // ==================== INIT ====================
  // Hooks into the game's showPreamblePage2() — which is called when
  // the player clicks "Start Your Journey". The opt-in overlay appears
  // at that natural pause, before the game setup continues.

  function init() {
    if (typeof supabase === 'undefined') {
      console.warn('[Trajectory] Supabase client not loaded. Shim disabled.');
      return;
    }

    // Wait for the game object to exist
    if (typeof game === 'undefined' || !game.showPreamblePage2) {
      setTimeout(init, 500);
      return;
    }

    // Patch endGame for recording outcomes
    patchEndGame();

    // Patch showPreamblePage2 to show opt-in overlay first
    const originalShowPreamble2 = game.showPreamblePage2.bind(game);

    game.showPreamblePage2 = function() {
      // Seed (learning) mode: no benchmarking, skip the opt-in entirely
      if (game.gameMode === 'seed') { originalShowPreamble2(); return; }

      // Hide preamble 1 (the landing page)
      const p1 = document.getElementById('preambleModal1');
      if (p1) { p1.classList.add('hidden'); p1.classList.remove('flex'); }

      // Show the opt-in overlay
      showOptInOverlay();

      // Store the original function so opt-in/skip can continue the flow
      window._trajectoryContinue = function() {
        originalShowPreamble2();
      };
    };

    console.log('[Trajectory] Ready. Overlay will appear after "Start Your Journey".');
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }

})();
