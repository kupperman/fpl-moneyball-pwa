    let DATA = null;
    let isVipUnlocked = false;
    let currentPosFilter = 'ALL';
    let standingMode = 'overall';
    let countdownInterval = null;
    let radarChart = null;
    let rankChart = null;
    const VALID_PASSWORDS = ['0124'];

    async function loadLiveData() {
      const icon = document.getElementById('refresh-icon');
      icon.classList.add('fa-spin');
      try {
        const res = await fetch('./data.json?v=' + Date.now());
        if (!res.ok) throw new Error('Failed to load data.json');
        DATA = await res.json();
        if (window.HUB_MODE === 'ioc') {
          DATA.league_main_backup = DATA.league_124;
          DATA.league_124 = DATA.league_ioc;
          DATA.league_124_squads = DATA.league_ioc_squads;
          DATA.turn1_awards = DATA.ioc_turn1_awards;
          DATA.rank_progression = DATA.ioc_rank_progression;
          DATA.points_progression = DATA.ioc_points_progression;
          DATA.gw_points_progression = DATA.ioc_gw_points_progression;
          DATA.league_ioc = DATA.league_main_backup;
        }

        renderAll();
      } catch (err) {
        console.error('Data sync error:', err);
        document.getElementById('sync-timestamp').textContent = 'Lỗi tải dữ liệu. Vui lòng thử lại.';
      } finally {
        setTimeout(() => icon.classList.remove('fa-spin'), 400);
      }
    }

    let pitchDoughnut = null;
    let currentPitchPlayers = {};
    let turnChart = null;
    let allSeasonChart = null;

    let selectedReplayGw = 10;
    let gwReplayTimer = null;
    let banterTickerTimer = null;

    function renderAll() {
      if (!DATA) return;
      document.getElementById('sync-timestamp').textContent = `Đồng bộ tự động: ${DATA.updated_at} • Sau GW${DATA.current_gw}`;
      selectedReplayGw = DATA.current_gw || 10;
      startCountdown();
      startBanterTicker();
      renderHeroCards();
      renderTurn1Awards();
      setStandingMode(standingMode);
      renderChipMatrix();
      renderLeagueIOC();
      renderTurnChart();
      renderAllSeasonChart();
      renderGwReplay(selectedReplayGw);
      renderPainGloryTable();
      populateSimManagers();
      runWhatIfSim();
      populatePitchSelector();
      renderPitchView();
      populateClashManagers();
      renderSquadClash();
      renderLeagueOwnershipMeta();
      populateRadarSelectors();
      renderWatchdog();
      renderCaptaincy();
      renderMarketTable();
      renderFixtureTable();
      renderVipVault();
    }

    const HLV_LABEL_MAP = {
      'Bao Bui': 'HLV Bảo',
      'Cận VIP': 'HLV TíT',
      'SNAL': 'HLV Cương',
      'FC K': 'HLV iKen',
      'Ninh SS': 'HLV Ninh',
      'Ngocdao': 'HLV Ngọc',
      'XOẠC-UNITED': 'HLV Tệ',
      'HELL_BOY Ψ (☆ ｗ ☆) Ψ': 'HLV Tóc Maz',
      'Phấn Đào': 'HLV Huy Anh',
      'Pending Moderation': 'HLV Hoàng',
      'hoheheho': 'HLV Tùng Lâm',
      "Dương's Team": 'HLV Dương Đắc'
    };

    function getHlvLabel(teamName, rawManager) {
      if (HLV_LABEL_MAP[teamName]) return HLV_LABEL_MAP[teamName];
      if (!rawManager) return 'HLV';
      return rawManager.startsWith('HLV ') ? rawManager : `HLV ${rawManager}`;
    }

    function getDisplayRank(teamName, fallbackRank) {
      if (DATA && DATA.league_124) {
        const idx = DATA.league_124.findIndex(x => x.team === teamName);
        if (idx >= 0) return idx + 1;
      }
      return fallbackRank;
    }

    function getManagerMap() {
      const m = {};
      if (DATA && DATA.league_124) {
        DATA.league_124.forEach(s => { m[s.team] = getHlvLabel(s.team, s.manager); });
      }
      return m;
    }

    function teamWithManager(teamName) {
      const hlv = getHlvLabel(teamName, DATA?.league_124?.find(x => x.team === teamName)?.manager);
      return `${teamName} (${hlv})`;
    }

    function getBanterLines() {
      if (!DATA || !DATA.league_124) return [];
      const l = DATA.league_124;
      const top1 = l[0];
      const top2 = l[1];
      const ninh = l.find(x => x.team === 'Ninh SS') || l[4];
      const haoTam = l.filter(x => x.is_last).map(x => teamWithManager(x.team)).join(' & ');
      const maxBench = [...l].sort((a, b) => (b.bench_wasted || 0) - (a.bench_wasted || 0))[0];
      const maxHit = [...l].sort((a, b) => (b.total_hits || 0) - (a.total_hits || 0))[0];
      return [
        `🏆 Chốt sổ Chặng 1: ${teamWithManager(top1.team)} (${top1.total}đ) lên ngôi nhờ nổ Bench Boost GW10 • ${teamWithManager(top2.team)} (${top2.total}đ) bám sát và còn nguyên 3 Chip hạng nặng (TC, BB, FH) cho Chặng 2!`,
        `🎖️ Vinh danh hai Nhà Hảo Tâm Turn 1: ${haoTam} cùng chốt sổ 535đ — cảm ơn hai sếp tài trợ kèo tổng kết!`,
        `💙 Cà khịa Xanh Samsung: Đổi màu áo mới cho ${teamWithManager(ninh.team)} đỡ tủi thân khi trượt dài từ #1 (GW3) xuống hạng #${getDisplayRank(ninh.team, ninh.rank)} (${ninh.total}đ — chỉ hơn đáy đúng 19đ)!`,
        `🪑 Chúa tể bỏ rơi ghế dự bị: ${teamWithManager(maxBench.team)} để mốc tới ${maxBench.bench_wasted}đ trên băng ghế sub sau 10 vòng!`,
        `💸 Đam mê đi chợ trừ Hit: ${teamWithManager(maxHit.team)} đã đốt tổng cộng -${maxHit.total_hits}đ tiền chuyển nhượng trong Chặng 1!`,
        `⚡ Chặng 2 (GW11 – GW19) chính thức RESET điểm chặng về 0 – 0! Mọi HLV phải xả sạch 4 Chip Phase 1 trước Deadline GW19!`
      ];
    }

    function startBanterTicker() {
      if (banterTickerTimer) clearInterval(banterTickerTimer);
      const lines = getBanterLines();
      const el = document.getElementById('live-banter-ticker');
      if (!el || !lines.length) return;
      let idx = 0;
      el.textContent = lines[0];
      banterTickerTimer = setInterval(() => {
        idx = (idx + 1) % lines.length;
        el.textContent = lines[idx];
      }, 4800);
    }

    function renderGwReplay(gwNum) {
      if (!DATA || !DATA.gw_points_progression) return;
      selectedReplayGw = gwNum;
      const maxGw = DATA.current_gw || 10;
      const pillsEl = document.getElementById('gw-replay-pills');
      if (pillsEl) {
        pillsEl.innerHTML = Array.from({ length: maxGw }, (_, i) => {
          const g = i + 1;
          const active = g === gwNum;
          return `<button onclick="stopGwReplayAuto(); renderGwReplay(${g})" class="px-2.5 py-1 rounded-lg text-[10px] font-mono-numbers font-extrabold border transition ${active ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-md shadow-emerald-500/30' : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'}">GW${g}</button>`;
        }).join('');
      }

      const gwIdx = gwNum - 1;
      const rawEntries = DATA.league_124.map((s, teamIdx) => {
        const pts = (DATA.gw_points_progression[s.team] || [])[gwIdx] || 0;
        const cumPts = (DATA.points_progression && DATA.points_progression[s.team]) ? (DATA.points_progression[s.team][gwIdx] || 0) : 0;
        return { team: s.team, hlv: getHlvLabel(s.team, s.manager), teamIdx, pts, cumPts, color: TEAM_COLOR_MAP[s.team] || '#94a3b8' };
      });
      const byCum = [...rawEntries].sort((a, b) => (b.cumPts - a.cumPts) || (a.teamIdx - b.teamIdx));
      const rankAtGwMap = {};
      byCum.forEach((item, idx) => { rankAtGwMap[item.team] = idx + 1; });

      const entries = rawEntries.map(e => ({ ...e, rnk: rankAtGwMap[e.team] || '-' })).sort((a, b) => (b.pts - a.pts) || (a.rnk - b.rnk));

      const mvp = entries[0];
      const worst = entries[entries.length - 1];
      const maxPts = Math.max(...entries.map(x => x.pts), 1);

      const hlEl = document.getElementById('gw-replay-highlights');
      if (hlEl && mvp && worst) {
        hlEl.innerHTML = `
          <div class="p-2.5 rounded-xl bg-emerald-950/25 border border-emerald-500/40 flex items-center justify-between">
            <div>
              <span class="text-[9px] font-black uppercase text-emerald-400 block">👑 Vua Vòng GW${gwNum}</span>
              <b class="text-xs text-white">${mvp.team}</b> <span class="text-[10px] text-slate-300 font-semibold">(${mvp.hlv})</span>
            </div>
            <span class="text-sm font-black font-mono-numbers text-emerald-300">${mvp.pts}đ</span>
          </div>
          <div class="p-2.5 rounded-xl bg-rose-950/25 border border-rose-500/40 flex items-center justify-between">
            <div>
              <span class="text-[9px] font-black uppercase text-rose-400 block">💀 Hấp Hối GW${gwNum}</span>
              <b class="text-xs text-white">${worst.team}</b> <span class="text-[10px] text-slate-300 font-semibold">(${worst.hlv})</span>
            </div>
            <span class="text-sm font-black font-mono-numbers text-rose-300">${worst.pts}đ</span>
          </div>
        `;
      }

      const barsEl = document.getElementById('gw-replay-bars');
      if (barsEl) {
        barsEl.innerHTML = entries.map((e, idx) => {
          const w = Math.max(14, Math.round((e.pts / maxPts) * 100));
          return `
            <div onclick="focusSpotlightTeam('${e.team}', false)" class="cursor-pointer group">
              <div class="flex justify-between items-center text-[11px] mb-0.5 gap-2">
                <span class="font-bold text-white group-hover:text-cyan-300 transition truncate">${idx === 0 ? '🔥 ' : ''}${e.team} <span class="text-slate-300 font-semibold">(${e.hlv})</span> <span class="text-[10px] text-slate-400 font-semibold">• #${e.rnk} • Tổng ${e.cumPts}đ</span></span>
                <span class="font-mono-numbers font-extrabold text-white shrink-0">${e.pts}đ</span>
              </div>
              <div class="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800/80">
                <div class="h-full rounded-full transition-all duration-500" style="width:${w}%; background-color:${e.color}; box-shadow: 0 0 10px ${e.color}"></div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    function stopGwReplayAuto() {
      if (gwReplayTimer) {
        clearInterval(gwReplayTimer);
        gwReplayTimer = null;
      }
      const icon = document.getElementById('gw-replay-icon');
      const lbl = document.getElementById('gw-replay-label');
      if (icon) icon.className = 'fa-solid fa-play';
      if (lbl) lbl.textContent = 'Tua GW1 → 10';
    }

    function toggleGwReplayAuto() {
      if (gwReplayTimer) {
        stopGwReplayAuto();
        return;
      }
      const maxGw = DATA?.current_gw || 10;
      let cur = 1;
      renderGwReplay(cur);
      const icon = document.getElementById('gw-replay-icon');
      const lbl = document.getElementById('gw-replay-label');
      if (icon) icon.className = 'fa-solid fa-pause';
      if (lbl) lbl.textContent = 'Đang Tua...';
      gwReplayTimer = setInterval(() => {
        cur++;
        if (cur > maxGw) {
          stopGwReplayAuto();
          return;
        }
        renderGwReplay(cur);
      }, 1100);
    }

    function renderPainGloryTable() {
      const tbody = document.getElementById('pain-glory-tbody');
      const insightEl = document.getElementById('pain-glory-insight');
      if (!tbody || !DATA) return;

      const maxBench = Math.max(...DATA.league_124.map(x => x.bench_wasted || 0));
      const maxHit = Math.max(...DATA.league_124.map(x => x.total_hits || 0));

      tbody.innerHTML = DATA.league_124.map(s => {
        const col = TEAM_COLOR_MAP[s.team] || '#94a3b8';
        const hlv = getHlvLabel(s.team, s.manager);
        const isBenchKing = s.bench_wasted === maxBench;
        const isHitKing = s.total_hits === maxHit && maxHit > 0;
        return `
          <tr onclick="focusSpotlightTeam('${s.team}', true)" class="hover:bg-slate-800/40 cursor-pointer transition">
            <td class="p-2 whitespace-nowrap">
              <div class="flex items-center gap-1.5 font-extrabold text-white">
                <span class="w-2 h-2 rounded-full shrink-0" style="background-color:${col}"></span><span>${s.team}</span><span class="text-[11px] font-semibold text-slate-400">(${hlv})</span>
              </div>
              <span class="text-[10px] text-slate-400 pl-3.5">Giá trị đội hình: <b class="text-amber-300 font-mono-numbers">£${s.team_value}m</b></span>
            </td>
            <td class="p-2 text-center font-mono-numbers whitespace-nowrap">
              <span class="px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-500/30 font-bold text-[10px] inline-block">${s.best_gw}đ (GW${s.best_gw_num})</span>
            </td>
            <td class="p-2 text-center font-mono-numbers whitespace-nowrap">
              <span class="px-2 py-0.5 rounded bg-rose-950/70 text-rose-300 border border-rose-500/30 font-bold text-[10px] inline-block">${s.worst_gw}đ (GW${s.worst_gw_num})</span>
            </td>
            <td class="p-2 text-right font-mono-numbers font-black whitespace-nowrap ${isBenchKing ? 'text-purple-300' : 'text-slate-200'}">
              ${isBenchKing ? '🪑 ' : ''}${s.bench_wasted}đ
            </td>
            <td class="p-2 text-right font-mono-numbers font-bold whitespace-nowrap ${isHitKing ? 'text-amber-400' : (s.total_hits > 0 ? 'text-rose-400' : 'text-emerald-400')}">
              ${s.total_hits > 0 ? '-' + s.total_hits + 'đ' : '0đ'}
            </td>
          </tr>
        `;
      }).join('');

      if (insightEl) {
        const totalBenchAll = DATA.league_124.reduce((a, b) => a + (b.bench_wasted || 0), 0);
        const totalHitsAll = DATA.league_124.reduce((a, b) => a + (b.total_hits || 0), 0);
        insightEl.innerHTML = `💡 <b>Tổng kết độ phung phí cả giải:</b> ${DATA.league_124.length} HLV đã bỏ quên tổng cộng <b class="text-purple-300 font-mono-numbers">${totalBenchAll} điểm</b> trên ghế dự bị và nộp cho FPL <b class="text-amber-400 font-mono-numbers">-${totalHitsAll} điểm</b> tiền đi chợ (-Hit) trong Chặng 1!`;
      }
    }

    function populateClashManagers() {
      const sA = document.getElementById('clash-manager-a');
      const sB = document.getElementById('clash-manager-b');
      if (!sA || !sB || !DATA) return;
      const opts = DATA.league_124.map((s, idx) => `<option value="${s.team}">${s.team} (${getHlvLabel(s.team, s.manager)}) — #${idx + 1}</option>`).join('');
      sA.innerHTML = opts;
      sB.innerHTML = opts;
      if (DATA.league_124.length >= 2) {
        sA.value = DATA.league_124[1].team; // Cận VIP
        sB.value = DATA.league_124[0].team; // Bao Bui
      }
    }

    function renderSquadClash() {
      if (!DATA || !DATA.league_124_squads) return;
      const teamA = document.getElementById('clash-manager-a')?.value || DATA.league_124[1]?.team;
      const teamB = document.getElementById('clash-manager-b')?.value || DATA.league_124[0]?.team;
      const sqA = DATA.league_124_squads[teamA];
      const sqB = DATA.league_124_squads[teamB];
      if (!sqA || !sqB) return;

      const flattenStarters = (sq) => [...(sq.starting.GKP || []), ...(sq.starting.DEF || []), ...(sq.starting.MID || []), ...(sq.starting.FWD || [])];
      const startA = flattenStarters(sqA);
      const startB = flattenStarters(sqB);

      const idsA = new Set(startA.map(p => p.id));
      const idsB = new Set(startB.map(p => p.id));

      const diffA = startA.filter(p => !idsB.has(p.id)).sort((a, b) => (b.eff_gw_pts ?? b.gw_pts) - (a.eff_gw_pts ?? a.gw_pts));
      const diffB = startB.filter(p => !idsA.has(p.id)).sort((a, b) => (b.eff_gw_pts ?? b.gw_pts) - (a.eff_gw_pts ?? a.gw_pts));
      const shared = startA.filter(p => idsB.has(p.id)).map(pA => {
        const pB = startB.find(x => x.id === pA.id);
        return { ...pA, capA: pA.is_captain, capB: pB?.is_captain };
      });

      const sumEff = (arr) => arr.reduce((s, p) => s + (p.eff_gw_pts !== undefined ? p.eff_gw_pts : p.gw_pts), 0);
      const ptsDiffA = sumEff(diffA);
      const ptsDiffB = sumEff(diffB);
      const swing = ptsDiffA - ptsDiffB;

      document.getElementById('clash-col-a-title').textContent = `🔥 Hàng Độc ${teamA} (${diffA.length} cầu thủ • ${ptsDiffA}đ)`;
      document.getElementById('clash-col-shared-title').textContent = `🤝 Trùng Máu (${shared.length}/11 vị trí)`;
      document.getElementById('clash-col-b-title').textContent = `⚡ Hàng Độc ${teamB} (${diffB.length} cầu thủ • ${ptsDiffB}đ)`;

      const bannerEl = document.getElementById('clash-summary-banner');
      if (bannerEl) {
        const capA = startA.find(x => x.is_captain);
        const capB = startB.find(x => x.is_captain);
        const swingBadge = swing > 0
          ? `<span class="text-cyan-300 font-black"> Hàng độc ${teamA} gác +${swing}đ</span>`
          : (swing < 0 ? `<span class="text-amber-300 font-black"> Hàng độc ${teamB} gác +${Math.abs(swing)}đ</span>` : `<span class="text-emerald-300 font-black">Hàng độc 2 bên hòa điểm!</span>`);
        bannerEl.innerHTML = `
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span>⚔️ <b>Độ giống nhau:</b> Trùng <b>${shared.length}/11</b> vị trí đá chính (${Math.round((shared.length/11)*100)}%) • ${swingBadge}</span>
            <span class="font-mono-numbers text-[11px] text-slate-300">Cap: <b class="text-cyan-300">${capA ? capA.name + ' (' + capA.eff_gw_pts + 'đ)' : '-'}</b> vs <b class="text-amber-300">${capB ? capB.name + ' (' + capB.eff_gw_pts + 'đ)' : '-'}</b></span>
          </div>
        `;
      }

      const itemHtml = (p, accent) => {
        const pts = p.eff_gw_pts !== undefined ? p.eff_gw_pts : p.gw_pts;
        return `
          <div class="p-2 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between">
            <div class="min-w-0">
              <p class="font-bold text-white truncate">${p.name} ${p.is_captain ? '<span class="text-amber-400 font-black">(C)</span>' : ''}</p>
              <p class="text-[10px] text-slate-400">${p.pos} • ${p.team} • £${p.cost}m</p>
            </div>
            <span class="font-mono-numbers font-black ${pts >= 6 ? accent : 'text-slate-300'}">${pts}đ</span>
          </div>
        `;
      };

      document.getElementById('clash-diff-a').innerHTML = diffA.length ? diffA.map(p => itemHtml(p, 'text-cyan-300')).join('') : '<p class="text-slate-500 italic">Không có hàng khác biệt</p>';
      document.getElementById('clash-diff-b').innerHTML = diffB.length ? diffB.map(p => itemHtml(p, 'text-amber-300')).join('') : '<p class="text-slate-500 italic">Không có hàng khác biệt</p>';
      document.getElementById('clash-shared').innerHTML = shared.length ? shared.map(p => `
        <div class="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
          <div class="min-w-0">
            <p class="font-bold text-slate-200 truncate">${p.name} ${p.capA ? '<span class="text-cyan-400">(C-' + teamA + ')</span>' : ''} ${p.capB ? '<span class="text-amber-400">(C-' + teamB + ')</span>' : ''}</p>
            <p class="text-[10px] text-slate-500">${p.pos} • ${p.team}</p>
          </div>
          <span class="font-mono-numbers font-bold text-slate-300">${p.gw_pts}đ</span>
        </div>
      `).join('') : '<p class="text-slate-500 italic">Không trùng cầu thủ nào</p>';
    }

    function renderLeagueOwnershipMeta() {
      if (!DATA || !DATA.league_124_squads) return;
      const playerMap = {};
      const capChoices = [];

      DATA.league_124.forEach(s => {
        const sq = DATA.league_124_squads[s.team];
        if (!sq) return;
        const starters = [...(sq.starting.GKP || []), ...(sq.starting.DEF || []), ...(sq.starting.MID || []), ...(sq.starting.FWD || [])];
        const all15 = [...starters, ...(sq.bench || [])];
        starters.forEach(p => {
          if (p.is_captain) capChoices.push({ managerTeam: s.team, name: p.name, club: p.team, effPts: p.eff_gw_pts ?? (p.gw_pts * 2) });
        });
        all15.forEach(p => {
          if (!playerMap[p.id]) {
            playerMap[p.id] = { id: p.id, name: p.name, club: p.team, pos: p.pos, pts: p.pts, gw_pts: p.gw_pts, cost: p.cost, owners: [] };
          }
          playerMap[p.id].owners.push(s.team);
        });
      });

      const totalMgrs = DATA.league_124.length;
      const allPlayers = Object.values(playerMap);
      const templates = allPlayers.filter(p => p.owners.length >= Math.ceil(totalMgrs / 2)).sort((a, b) => b.owners.length - a.owners.length || b.pts - a.pts);
      const diffs = allPlayers.filter(p => p.owners.length <= 2 && p.pts >= 42).sort((a, b) => b.pts - a.pts).slice(0, 8);

      const capEl = document.getElementById('league-meta-captains');
      if (capEl) {
        capEl.innerHTML = `
          <p class="text-[10px] font-black uppercase tracking-wider text-amber-400"><i class="fa-solid fa-crown mr-1"></i>Lựa Chọn Băng Captain GW10 Của ${totalMgrs} HLV</p>
          <div class="flex flex-wrap gap-1.5">
            ${capChoices.map(c => `<span class="px-2 py-0.5 rounded-lg bg-slate-900 border border-amber-500/30 text-[10px]"><b>${teamWithManager(c.managerTeam)}:</b> <span class="text-amber-300 font-bold">${c.name}</span> <span class="font-mono-numbers text-emerald-400">(${c.effPts}đ)</span></span>`).join('')}
          </div>
        `;
      }

      const tplEl = document.getElementById('league-meta-template');
      if (tplEl) {
        tplEl.innerHTML = templates.map(p => `
          <div class="p-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2">
            <div class="min-w-0">
              <p class="font-bold text-white truncate">${p.name} <span class="text-[10px] text-cyan-400">(${p.club} • ${p.pts}đ mùa)</span></p>
              <p class="text-[10px] text-slate-400 truncate">Sở hữu: ${p.owners.map(o => teamWithManager(o)).join(', ')}</p>
            </div>
            <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono-numbers font-black text-[10px] shrink-0">${p.owners.length}/${totalMgrs} HLV</span>
          </div>
        `).join('');
      }

      const diffEl = document.getElementById('league-meta-diffs');
      if (diffEl) {
        diffEl.innerHTML = diffs.map(p => `
          <div class="p-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2">
            <div class="min-w-0">
              <p class="font-bold text-white truncate">${p.name} <span class="text-[10px] text-rose-400">(${p.club} • £${p.cost}m)</span></p>
              <p class="text-[10px] text-slate-400 truncate">Hàng riêng của: <b class="text-amber-300">${p.owners.map(o => teamWithManager(o)).join(', ')}</b></p>
            </div>
            <span class="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono-numbers font-black text-[10px] shrink-0">${p.pts}đ (${p.owners.length}/${totalMgrs})</span>
          </div>
        `).join('');
      }
    }

    function startCountdown() {
      if (countdownInterval) clearInterval(countdownInterval);
      const targetTime = new Date(DATA.next_deadline || '2026-11-21T11:00:00Z').getTime();
      const update = () => {
        const now = Date.now();
        const diff = targetTime - now;
        const el = document.getElementById('gw-countdown');
        if (!el) return;
        if (diff <= 0) {
          el.textContent = "ĐANG THI ĐẤU LIVE!";
          return;
        }
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / (1000 * 60)) % 60);
        const s = Math.floor((diff / 1000) % 60);
        el.textContent = `${String(d).padStart(2,'0')}d : ${String(h).padStart(2,'0')}h : ${String(m).padStart(2,'0')}m : ${String(s).padStart(2,'0')}s`;
      };
      update();
      countdownInterval = setInterval(update, 1000);
    }

    function renderTurn1Awards() {
      if (!DATA.turn1_awards) return;
      const a = DATA.turn1_awards;
      const card = (icon, title, subtitle, item, color) => {
        const labelTeam = teamWithManager(item.team);
        return `
          <div class="vip-card rounded-2xl p-3 border border-slate-800 flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl ${color} flex items-center justify-center text-base shrink-0">${icon}</div>
            <div class="min-w-0">
              <p class="text-[9px] font-bold uppercase tracking-wider text-slate-400 truncate">${title}</p>
              <p class="text-xs font-black text-white truncate" title="${labelTeam} ${item.val}">${labelTeam} <span class="text-amber-400 font-mono-numbers">${item.val}</span></p>
              <p class="text-[10px] text-slate-400 truncate">${subtitle}</p>
            </div>
          </div>
        `;
      };
      const worstCard = a.worst_gw ? card('📉', 'Chiến Thuật Điểm Kém', 'Tụt huyết áp bất thình lình', a.worst_gw, 'bg-rose-500/20 text-rose-400 border border-rose-500/30') : '';
      document.getElementById('turn1-awards-container').innerHTML =
        card('🎯', 'Tuyển Trạch Viên Cao Thủ', 'Kỷ lục nổ to nhất 1 vòng', a.best_gw, 'bg-blue-500/20 text-blue-400 border border-blue-500/40') +
        worstCard +
        card('🪑', 'Chúa Tể Bỏ Rơi Dự Bị', 'Tuyển hàng xịn để ghế sub', a.bench_king, 'bg-purple-500/20 text-purple-400 border border-purple-500/30') +
        card('💸', 'Chuyên Gia Đi Chợ (-Hit)', 'Đam mê mua sắm bất chấp', a.hit_king, 'bg-amber-500/20 text-amber-400 border border-amber-500/30');
    }

    function setStandingMode(mode) {
      standingMode = mode;
      const btnT2 = document.getElementById('mode-turn2');
      const btnOv = document.getElementById('mode-overall');
      const sub = document.getElementById('standings-subtitle');
      if (mode === 'turn2') {
        btnT2.className = "px-2.5 py-1 rounded-lg bg-cyan-600 text-white font-bold transition";
        btnOv.className = "px-2.5 py-1 rounded-lg text-slate-400 hover:text-white font-bold transition";
        sub.textContent = "Chế độ: Đua Chặng 2 (GW11 – GW19) • Toàn Giải Reset 0 – 0";
      } else {
        btnOv.className = "px-2.5 py-1 rounded-lg bg-cyan-600 text-white font-bold transition";
        btnT2.className = "px-2.5 py-1 rounded-lg text-slate-400 hover:text-white font-bold transition";
        sub.textContent = "Chế độ: Bảng Tổng Sắp Toàn Mùa Giải (GW1 – GW38)";
      }
      renderLeague124();
    }

    function renderHeroCards() {
      const l124 = DATA.league_124;
      const leader = l124[0];
      const runnerUp = l124[1];
      const lastGroup = l124.filter(x => x.is_last).map(x => `${x.team} (${getHlvLabel(x.team, x.manager)})`).join(' & ');
      const lastPts = l124.find(x => x.is_last)?.total || 0;

      document.getElementById('hero-cards-container').innerHTML = `
        <div class="vip-card rounded-2xl p-4 relative overflow-hidden">
          <div class="absolute -right-2 -bottom-2 opacity-10 text-5xl text-cyan-400"><i class="fa-solid fa-flag-checkered"></i></div>
          <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Chặng 1 (Turn 1)</p>
          <p class="text-2xl font-black text-emerald-400 mt-1">CHỐT SỔ</p>
          <span class="text-[11px] text-slate-400 font-mono-numbers">Chuẩn bị Reset Turn 2 (GW11)</span>
        </div>
        <div class="vip-card rounded-2xl p-4 vip-gold-glow relative overflow-hidden">
          <div class="absolute -right-2 -bottom-2 opacity-10 text-5xl text-amber-400"><i class="fa-solid fa-crown"></i></div>
          <p class="text-[10px] font-bold uppercase tracking-wider text-amber-400">Quán Quân Turn 1</p>
          <p class="text-xl sm:text-2xl font-black text-gold-gradient mt-1 truncate">${leader.team} <span class="text-xs font-bold text-amber-200/90">(${getHlvLabel(leader.team, leader.manager)})</span></p>
          <span class="text-[11px] text-amber-300 font-mono-numbers">${leader.total} điểm (GW10: ${leader.gw_pts}đ)</span>
        </div>
        <div class="vip-card rounded-2xl p-4 vip-cyan-glow relative overflow-hidden">
          <div class="absolute -right-2 -bottom-2 opacity-10 text-5xl text-cyan-400"><i class="fa-solid fa-shield"></i></div>
          <p class="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Á Quân Chặng 1</p>
          <p class="text-xl sm:text-2xl font-black text-cyan-gradient mt-1 truncate">${runnerUp.team} <span class="text-xs font-bold text-cyan-200/90">(${getHlvLabel(runnerUp.team, runnerUp.manager)})</span></p>
          <span class="text-[11px] text-cyan-300 font-mono-numbers">${runnerUp.total} điểm (Kém ${Math.abs(runnerUp.gap_leader)}đ)</span>
        </div>
        <div class="vip-card rounded-2xl p-4 vip-rose-glow relative overflow-hidden cursor-pointer" onclick="openHaoTamModal()">
          <div class="absolute -right-2 -bottom-2 opacity-10 text-5xl text-rose-400"><i class="fa-solid fa-medal"></i></div>
          <div class="flex justify-between items-start">
            <p class="text-[10px] font-bold uppercase tracking-wider text-rose-400">Nhà Hảo Tâm Turn 1</p>
            <i class="fa-solid fa-circle-info text-rose-400 text-xs"></i>
          </div>
          <p class="text-2xl font-black text-rose-400 mt-1">${lastPts} Điểm</p>
          <span class="text-[11px] text-rose-300 underline font-medium">${lastGroup}</span>
        </div>
      `;
    }

    function renderLeague124() {
      const thead = document.getElementById('league-124-thead');
      const tbody = document.getElementById('league-124-tbody');

      if (standingMode === 'turn2') {
        thead.innerHTML = `
          <tr>
            <th class="p-2.5 text-center w-14 whitespace-nowrap">Hạng</th>
            <th class="p-2.5 whitespace-nowrap">Đội Bóng & HLV</th>
            <th class="p-2.5 text-right font-black text-cyan-400 whitespace-nowrap">Điểm Turn 2</th>
            <th class="p-2.5 text-right whitespace-nowrap">Điểm Turn 1</th>
            <th class="p-2.5 text-center whitespace-nowrap">Trạng Thái Chặng 2</th>
          </tr>
        `;
        const sortedT2 = [...DATA.league_124].sort((a, b) => b.turn2_pts - a.turn2_pts);
        tbody.innerHTML = sortedT2.map((s, idx) => `
          <tr class="hover:bg-slate-800/30 transition">
            <td class="p-2.5 text-center font-black text-cyan-400 whitespace-nowrap">#${idx + 1}</td>
            <td class="p-2.5 whitespace-nowrap">
              <div class="font-extrabold text-white">${s.team} <span class="text-[11px] font-semibold text-cyan-300/90">(${getHlvLabel(s.team, s.manager)})</span></div>
            </td>
            <td class="p-2.5 text-right font-mono-numbers font-black text-cyan-400 text-sm whitespace-nowrap">${s.turn2_pts}đ</td>
            <td class="p-2.5 text-right font-mono-numbers text-slate-400 whitespace-nowrap">${s.total}đ</td>
            <td class="p-2.5 text-center whitespace-nowrap">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 font-bold inline-block whitespace-nowrap">⚡ Xuất Phát 0 – 0</span>
            </td>
          </tr>
        `).join('');
        return;
      }

      thead.innerHTML = `
        <tr>
          <th class="p-2.5 text-center w-14 whitespace-nowrap">Hạng</th>
          <th class="p-2.5 whitespace-nowrap">Đội Bóng & HLV</th>
          <th class="p-2.5 text-center hidden sm:table-cell whitespace-nowrap">Phong Độ 3 Vòng</th>
          <th class="p-2.5 text-right whitespace-nowrap">GW10</th>
          <th class="p-2.5 text-right font-black text-white whitespace-nowrap">Tổng Điểm</th>
          <th class="p-2.5 text-right whitespace-nowrap">Cách Top 1</th>
          <th class="p-2.5 text-center whitespace-nowrap">Trạng Thái Chặng 1</th>
        </tr>
      `;

      const maxPts = Math.max(...DATA.league_124.map(x => x.total), 1);
      const minPts = Math.min(...DATA.league_124.map(x => x.total), 0);

      tbody.innerHTML = DATA.league_124.map((s, idx) => {
        const dispRank = idx + 1;
        const hlv = getHlvLabel(s.team, s.manager);
        let rankBadge = `#${dispRank}`;
        let rowStyle = 'hover:bg-slate-800/40 cursor-pointer';
        let teamNameStyle = 'text-white';
        let statusTag = '<span class="px-2.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 border border-slate-700 inline-block whitespace-nowrap">An Toàn</span>';
        const teamCol = TEAM_COLOR_MAP[s.team] || '#94a3b8';
        const isSpot = spotlightTeam === s.team;

        if (dispRank === 1) {
          rankBadge = '🥇 #1';
          statusTag = '<span class="px-2.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/40 inline-block whitespace-nowrap">🏆 Quán Quân Turn 1</span>';
        } else if (dispRank === 2) {
          rankBadge = '🥈 #2';
          rowStyle = 'bg-cyan-950/15 border-l-2 border-cyan-400 hover:bg-cyan-950/30 cursor-pointer';
          statusTag = '<span class="px-2.5 py-0.5 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300 font-extrabold border border-cyan-500/40 inline-block whitespace-nowrap">🥈 Á Quân Turn 1</span>';
        } else if (dispRank === 3) {
          rankBadge = '🥉 #3';
          statusTag = '<span class="px-2.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 border border-slate-700 inline-block whitespace-nowrap">Top 3</span>';
        } else if (s.is_last) {
          rowStyle = 'bg-rose-950/15 hover:bg-rose-950/30 cursor-pointer';
          statusTag = '<span onclick="event.stopPropagation(); openHaoTamModal()" class="cursor-pointer px-2.5 py-0.5 rounded-full text-[10px] bg-rose-500/25 text-rose-300 font-black border border-rose-500/50 inline-block whitespace-nowrap">🎖️ Nhà Hảo Tâm Turn 1</span>';
        }

        // MÀU XANH SAMSUNG CHO ANH NINH (NINH SS) — CHỈ ĐỔI MÀU CHỮ & TRẠNG THÁI TRÊU CHỌC NHẸ, KHÔNG LÀM BADGE TO LẤN ÁT TOP 1 & NHÀ HẢO TÂM
        if (s.team === 'Ninh SS') {
          teamNameStyle = 'text-blue-400';
          statusTag = '<span onclick="event.stopPropagation(); openSamsungModal()" title="Bấm xem lý do đổi màu chống chìm" class="cursor-pointer px-2.5 py-0.5 rounded-full text-[10px] bg-slate-900 text-blue-300/90 border border-blue-500/30 hover:border-blue-400 transition inline-block whitespace-nowrap">Hạng 5 • Cách đáy 19đ</span>';
        }

        if (isSpot) {
          rowStyle = 'bg-cyan-500/15 border-l-4 border-cyan-400 ring-1 ring-cyan-400/40 cursor-pointer';
        }

        const gwArr = (DATA.gw_points_progression && DATA.gw_points_progression[s.team]) ? DATA.gw_points_progression[s.team].slice(-3) : [];
        const formHtml = gwArr.map(v => {
          const c = v >= 65 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : (v <= 45 ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-slate-900 text-slate-300 border-slate-700');
          return `<span class="px-1.5 py-0.5 rounded border text-[9px] font-mono-numbers font-bold ${c}">${v}</span>`;
        }).join('');

        const pctBar = Math.max(18, Math.round(((s.total - (minPts - 25)) / Math.max(1, maxPts - (minPts - 25))) * 100));

        return `
          <tr onclick="focusSpotlightTeam('${s.team}', true)" title="Bấm để soi riêng đường biểu đồ của ${s.team} (${hlv})" class="${rowStyle} transition">
            <td class="p-2.5 text-center font-black whitespace-nowrap ${dispRank <= 2 ? 'text-amber-400' : 'text-slate-400'}">${rankBadge}</td>
            <td class="p-2.5 whitespace-nowrap">
              <div class="flex items-center gap-1.5 whitespace-nowrap">
                <span class="w-2 h-2 rounded-full shrink-0" style="background-color:${teamCol}; box-shadow: 0 0 6px ${teamCol}"></span>
                <span class="font-extrabold ${teamNameStyle}">${s.team}</span>
                <span class="text-[11px] font-semibold text-slate-300">(${hlv})</span>
                ${isSpot ? '<span class="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/30 text-cyan-200 font-black">ĐANG SOI</span>' : ''}
              </div>
            </td>
            <td class="p-2.5 text-center hidden sm:table-cell whitespace-nowrap">
              <div class="inline-flex items-center gap-1">${formHtml}</div>
            </td>
            <td class="p-2.5 text-right font-mono-numbers font-bold whitespace-nowrap ${s.gw_pts >= 64 ? 'text-emerald-400' : 'text-slate-300'}">${s.gw_pts}</td>
            <td class="p-2.5 text-right whitespace-nowrap">
              <div class="font-mono-numbers font-black text-white">${s.total}</div>
              <div class="w-16 ml-auto bg-slate-800/90 h-1 rounded-full overflow-hidden mt-0.5">
                <div class="h-1 rounded-full" style="width:${pctBar}%; background-color:${teamCol}"></div>
              </div>
            </td>
            <td class="p-2.5 text-right font-mono-numbers text-slate-400 whitespace-nowrap">${s.gap_leader === 0 ? 'MỐC #1' : s.gap_leader + 'đ'}</td>
            <td class="p-2.5 text-center whitespace-nowrap">${statusTag}</td>
          </tr>
        `;
      }).join('');
    }

    function renderChipMatrix() {
      const tbody = document.getElementById('chip-matrix-tbody');
      if (!tbody) return;
      const chipBadge = (used) => used
        ? '<span class="text-rose-400/80 font-bold text-[10px] whitespace-nowrap"><i class="fa-solid fa-xmark"></i> Hết</span>'
        : '<span class="text-emerald-400 font-bold text-[10px] whitespace-nowrap"><i class="fa-solid fa-check"></i> Còn</span>';

      tbody.innerHTML = DATA.league_124.map(s => {
        const cm = s.chips_map || { wc: false, tc: false, bb: false, fh: false };
        return `
          <tr class="hover:bg-slate-800/30">
            <td class="p-1.5 text-left whitespace-nowrap">
              <div class="font-bold text-white leading-tight">${s.team}</div>
              <div class="text-[9px] text-slate-400 leading-tight">${getHlvLabel(s.team, s.manager)}</div>
            </td>
            <td class="p-1.5">${chipBadge(cm.wc)}</td>
            <td class="p-1.5">${chipBadge(cm.tc)}</td>
            <td class="p-1.5">${chipBadge(cm.bb)}</td>
            <td class="p-1.5">${chipBadge(cm.fh)}</td>
            <td class="p-1.5 text-right font-mono-numbers text-amber-300 font-bold whitespace-nowrap">£${s.team_value}m</td>
          </tr>
        `;
      }).join('');
    }

    function renderLeagueIOC() {
      const tbody = document.getElementById('league-ioc-tbody');
      if (!tbody || !DATA.league_ioc) return;
      tbody.innerHTML = DATA.league_ioc.map((s, idx) => {
        const chipsHtml = (s.chips && s.chips.length > 0)
          ? s.chips.map(c => `<span class="px-1.5 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-700/50 text-[9px] font-mono mr-1">${c}</span>`).join('')
          : '<span class="text-emerald-400 text-[10px] font-bold">Full 4 Chip</span>';
        return `
          <tr class="hover:bg-slate-800/30 transition">
            <td class="p-2.5 text-center font-bold text-slate-400 whitespace-nowrap">#${idx + 1}</td>
            <td class="p-2.5 whitespace-nowrap">
              <div class="font-bold text-white">${s.team} <span class="text-[11px] font-semibold text-slate-400">(${getHlvLabel(s.team, s.manager)})</span></div>
            </td>
            <td class="p-2.5 text-right font-mono-numbers text-slate-300 whitespace-nowrap">${s.gw_pts}</td>
            <td class="p-2.5 text-right font-mono-numbers font-black text-white whitespace-nowrap">${s.total}</td>
            <td class="p-2.5 text-center whitespace-nowrap">${chipsHtml}</td>
          </tr>
        `;
      }).join('');
    }

    const TEAM_COLOR_MAP = {
      'Bao Bui': '#f59e0b',
      'Cận VIP': '#06b6d4',
      'SNAL': '#a855f7',
      'FC K': '#10b981',
      'Ninh SS': '#2563eb', // Xanh Samsung Hoàng Gia
      'Ngocdao': '#f43f5e',
      'XOẠC-UNITED': '#ec4899',
      'HELL_BOY Ψ (☆ ｗ ☆) Ψ': '#f59e0b',
      'Phấn Đào': '#10b981',
      'Pending Moderation': '#a855f7',
      'hoheheho': '#3b82f6',
      "Dương's Team": '#f43f5e'
    };

    // Trạng thái bật/tắt từng người & Spotlight trên 2 biểu đồ
    const chartVisibility = {
      turn: {},
      all: {}
    };
    let spotlightTeam = null;

    // Plugin Broadcast: Vẽ đường gióng dọc Crosshair & hiện số trực tiếp trên từng điểm khi lọc <= 3 người hoặc đang Spotlight
    const broadcastChartPlugin = {
      id: 'broadcastOverlay',
      afterDatasetsDraw(chart, args, pluginOptions) {
        const { ctx, chartArea } = chart;
        if (!chartArea) return;

        // 1. Vẽ đường Crosshair dọc khi hover
        if (chart.tooltip?._active && chart.tooltip._active.length) {
          const activePoint = chart.tooltip._active[0];
          const x = activePoint.element.x;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(x, chartArea.top);
          ctx.lineTo(x, chartArea.bottom);
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = 'rgba(165, 243, 252, 0.35)';
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.restore();
        }

        // 2. Vẽ nhãn điểm/hạng trực tiếp trên đỉnh từng nút khi số dòng đang bật <= 3 hoặc có Spotlight
        const visibleCount = chart.data.datasets.filter((_, i) => chart.isDatasetVisible(i)).length;
        if (visibleCount === 0 || (visibleCount > 3 && !spotlightTeam)) return;

        const isRankMode = pluginOptions?.isRank === true;
        ctx.save();
        ctx.font = '700 9.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';

        chart.data.datasets.forEach((ds, dsIdx) => {
          if (!chart.isDatasetVisible(dsIdx)) return;
          if (spotlightTeam && ds.label !== spotlightTeam && visibleCount > 2) return;
          const meta = chart.getDatasetMeta(dsIdx);
          meta.data.forEach((pt, i) => {
            const val = ds.data[i];
            if (val === undefined || val === null) return;
            const txt = isRankMode ? `#${val}` : `${val}`;
            const yPos = Math.max(chartArea.top + 10, pt.y - 9);
            const w = ctx.measureText(txt).width + 8;
            ctx.fillStyle = 'rgba(6, 9, 17, 0.88)';
            ctx.beginPath();
            ctx.roundRect(pt.x - w / 2, yPos - 8, w, 13, 4);
            ctx.fill();
            ctx.strokeStyle = ds.borderColor;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = '#f8fafc';
            ctx.fillText(txt, pt.x, yPos + 1.5);
          });
        });
        ctx.restore();
      }
    };

    function ensureChartVisibilityInit(teams) {
      ['turn', 'all'].forEach(k => {
        teams.forEach(t => {
          if (chartVisibility[k][t] === undefined) chartVisibility[k][t] = true;
        });
      });
    }

    function updateSpotlightBanner() {
      const banner = document.getElementById('chart-spotlight-banner');
      const lbl = document.getElementById('spotlight-team-label');
      const btnPitch = document.getElementById('btn-spotlight-pitch');
      if (!banner || !lbl) return;
      if (btnPitch) {
        if (isVipUnlocked) btnPitch.classList.remove('hidden');
        else btnPitch.classList.add('hidden');
      }
      if (spotlightTeam) {
        const idx = DATA?.league_124?.findIndex(x => x.team === spotlightTeam);
        const obj = idx >= 0 ? DATA.league_124[idx] : null;
        lbl.textContent = obj ? `${obj.team} (${getHlvLabel(obj.team, obj.manager)} • #${idx + 1} • ${obj.total}đ)` : spotlightTeam;
        banner.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }
    }

    function toggleChartTeam(chartKey, team) {
      spotlightTeam = null;
      chartVisibility[chartKey][team] = !chartVisibility[chartKey][team];
      updateSpotlightBanner();
      renderLeague124();
      if (chartKey === 'turn') renderTurnChart();
      else renderAllSeasonChart();
    }

    function soloChartTeam(chartKey, team, evt) {
      if (evt) evt.stopPropagation();
      const teams = DATA.league_124.map(s => s.team);
      const onlyThisVisible = teams.every(t => t === team ? chartVisibility[chartKey][t] : !chartVisibility[chartKey][t]);
      if (onlyThisVisible) {
        teams.forEach(t => { chartVisibility[chartKey][t] = true; });
        spotlightTeam = null;
      } else {
        teams.forEach(t => { chartVisibility[chartKey][t] = (t === team); });
        spotlightTeam = team;
      }
      updateSpotlightBanner();
      renderLeague124();
      if (chartKey === 'turn') renderTurnChart();
      else renderAllSeasonChart();
    }

    function focusSpotlightTeam(team, scrollToChart = false) {
      const teams = DATA.league_124.map(s => s.team);
      if (spotlightTeam === team) {
        spotlightTeam = null;
        ['turn', 'all'].forEach(k => teams.forEach(t => { chartVisibility[k][t] = true; }));
      } else {
        spotlightTeam = team;
        ['turn', 'all'].forEach(k => teams.forEach(t => { chartVisibility[k][t] = (t === team); }));
      }
      updateSpotlightBanner();
      renderLeague124();
      renderTurnChart();
      renderAllSeasonChart();
      if (scrollToChart && spotlightTeam) {
        document.getElementById('charts-section-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    function resetAllChartsFilter() {
      const teams = DATA.league_124.map(s => s.team);
      spotlightTeam = null;
      ['turn', 'all'].forEach(k => teams.forEach(t => { chartVisibility[k][t] = true; }));
      updateSpotlightBanner();
      renderLeague124();
      renderTurnChart();
      renderAllSeasonChart();
    }

    function openSpotlightSquadOnPitch() {
      if (!spotlightTeam) return;
      const sel = document.getElementById('pitch-squad-selector');
      if (sel) sel.value = spotlightTeam;
      switchTab('pitch');
    }

    function setChartPreset(chartKey, preset) {
      if (!DATA) return;
      const teams = DATA.league_124.map(s => s.team);
      spotlightTeam = null;
      if (preset === 'all') {
        teams.forEach(t => { chartVisibility[chartKey][t] = true; });
      } else if (preset === 'top2') {
        teams.forEach((t, idx) => { chartVisibility[chartKey][t] = (idx < 2); });
      } else if (preset === 'none') {
        teams.forEach(t => { chartVisibility[chartKey][t] = false; });
      }
      updateSpotlightBanner();
      renderLeague124();
      if (chartKey === 'turn') renderTurnChart();
      else renderAllSeasonChart();
    }

    function buildCustomLegend(containerId, teams, chartKey) {
      const container = document.getElementById(containerId);
      if (!container) return;
      ensureChartVisibilityInit(teams);
      container.innerHTML = teams.map((team, idx) => {
        const col = TEAM_COLOR_MAP[team] || '#94a3b8';
        const isVisible = chartVisibility[chartKey][team] !== false;
        const obj = DATA.league_124.find(x => x.team === team);
        const statTag = obj ? `#${idx + 1} • ${obj.total}đ` : '';
        const display = `${team} (${getHlvLabel(team, obj?.manager)})`;
        const activeStyle = isVisible
          ? `background: rgba(15, 23, 42, 0.92); border-color: ${col}88; box-shadow: 0 0 12px -3px ${col}66;`
          : `background: rgba(9, 13, 22, 0.55); border-color: rgba(51, 65, 85, 0.45); opacity: 0.38;`;
        return `
          <div onclick="toggleChartTeam('${chartKey}', '${team}')"
               ondblclick="soloChartTeam('${chartKey}', '${team}', event)"
               style="${activeStyle}"
               title="Bấm để ẩn/hiện dòng của ${display} • Bấm tâm ngắm để soi riêng 1 mình ${display}"
               class="legend-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${isVisible ? 'text-white' : 'text-slate-500 line-through'}">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${col}; box-shadow: ${isVisible ? '0 0 8px ' + col : 'none'};"></span>
            <span>${display}</span>
            <span class="text-[9px] font-mono-numbers ${isVisible ? 'text-slate-300' : 'text-slate-600'}">${statTag}</span>
            <button type="button" onclick="soloChartTeam('${chartKey}', '${team}', event)" title="Chỉ hiện riêng đường của ${display}" class="ml-0.5 text-[9px] text-slate-400 hover:text-cyan-300 transition px-0.5">
              <i class="fa-solid fa-crosshairs"></i>
            </button>
          </div>
        `;
      }).join('');
    }

    function renderTurnChart() {
      const ctx = document.getElementById('turnAnalyticsChart').getContext('2d');
      if (turnChart) turnChart.destroy();

      const stage = document.getElementById('turn-chart-stage')?.value || 'turn1';
      const metric = document.getElementById('turn-chart-metric')?.value || 'rank';
      const subEl = document.getElementById('turn-chart-subtitle');

      const teams = DATA.league_124.map(s => s.team);
      ensureChartVisibilityInit(teams);
      buildCustomLegend('turn-chart-legend', teams, 'turn');

      let startIdx = 0;
      let endIdx = Math.min(10, DATA.current_gw);
      if (stage === 'turn2') {
        startIdx = 10;
        endIdx = Math.max(10, DATA.current_gw);
        subEl.textContent = DATA.current_gw >= 11
          ? `Chặng 2 (GW11 – GW${DATA.current_gw}) • Reset từ 0 điểm`
          : 'Chặng 2 (GW11 – GW19) • Dự kiến xuất phát 0 – 0 tại GW11';
      } else {
        subEl.textContent = metric === 'rank'
          ? 'Thứ hạng qua từng vòng trong Chặng 1 (GW1 – GW10)'
          : 'Số điểm ghi được ở từng vòng trong Chặng 1 (GW1 – GW10)';
      }

      const labels = (stage === 'turn2' && DATA.current_gw < 11)
        ? ['GW11 (Start)']
        : Array.from({ length: endIdx - startIdx }, (_, i) => `GW${startIdx + i + 1}`);

      const visibleCount = teams.filter(t => chartVisibility.turn[t] !== false).length;

      const datasets = teams.map((team, idx) => {
        const col = TEAM_COLOR_MAP[team] || '#94a3b8';
        const isVis = chartVisibility.turn[team] !== false;
        let rawData = [];
        if (stage === 'turn2' && DATA.current_gw < 11) {
          rawData = [metric === 'rank' ? 1 : 0];
        } else {
          const source = metric === 'rank' ? DATA.rank_progression[team] : (DATA.gw_points_progression ? DATA.gw_points_progression[team] : []);
          rawData = (source || []).slice(startIdx, endIdx);
        }

        const isHighlighted = (visibleCount <= 2 && isVis) || spotlightTeam === team;
        const grad = ctx.createLinearGradient(0, 0, 0, 260);
        grad.addColorStop(0, col + (isHighlighted ? '40' : '18'));
        grad.addColorStop(1, col + '00');

        return {
          label: team,
          data: rawData,
          hidden: !isVis,
          borderColor: col,
          backgroundColor: grad,
          fill: isHighlighted && metric !== 'rank',
          borderWidth: isHighlighted ? 3.6 : ((idx <= 1 || team === 'Ninh SS') ? 2.8 : 1.8),
          tension: 0.36,
          pointRadius: isHighlighted ? 5 : 4,
          pointHoverRadius: 8,
          pointBackgroundColor: col,
          pointBorderColor: '#04070e',
          pointBorderWidth: 2
        };
      });

      const isRank = metric === 'rank';
      turnChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        plugins: [broadcastChartPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 20, bottom: 8, left: 6, right: 16 } },
          interaction: { mode: 'index', intersect: false },
          scales: {
            y: isRank ? {
              reverse: true,
              min: 1,
              max: Math.max(2, teams.length),
              ticks: { stepSize: 1, color: '#94a3b8', font: { size: 10, family: 'JetBrains Mono', weight: 'bold' }, callback: v => '#' + v },
              grid: { color: 'rgba(255,255,255,0.06)', tickBorderDash: [4, 4] }
            } : {
              beginAtZero: true,
              ticks: { color: '#94a3b8', font: { size: 10, family: 'JetBrains Mono', weight: 'bold' }, callback: v => v + 'đ' },
              grid: { color: 'rgba(255,255,255,0.06)' }
            },
            x: {
              offset: true,
              ticks: { color: '#cbd5e1', font: { size: 10, family: 'JetBrains Mono', weight: 'bold' } },
              grid: { color: 'rgba(255,255,255,0.03)' }
            }
          },
          plugins: {
            broadcastOverlay: { isRank },
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(9, 14, 26, 0.96)',
              borderColor: 'rgba(6, 182, 212, 0.55)',
              borderWidth: 1,
              padding: 11,
              cornerRadius: 12,
              titleFont: { family: 'Plus Jakarta Sans', weight: '800', size: 12 },
              bodyFont: { family: 'JetBrains Mono', size: 11 },
              itemSort: (a, b) => isRank ? a.parsed.y - b.parsed.y : b.parsed.y - a.parsed.y,
              callbacks: {
                label: (c) => ` ${teamWithManager(c.dataset.label)}: ${isRank ? '#' + c.parsed.y : c.parsed.y + 'đ'}`
              }
            }
          }
        }
      });
    }

    function renderAllSeasonChart() {
      const ctx = document.getElementById('allSeasonChart').getContext('2d');
      if (allSeasonChart) allSeasonChart.destroy();

      const metric = document.getElementById('all-chart-metric')?.value || 'total_pts';
      const subEl = document.getElementById('all-chart-subtitle');
      subEl.textContent = metric === 'total_pts'
        ? `Tổng điểm tích lũy liên tục toàn mùa (GW1 – GW${DATA.current_gw})`
        : `Quỹ đạo thứ hạng chung cuộc toàn mùa (GW1 – GW${DATA.current_gw})`;

      const teams = DATA.league_124.map(s => s.team);
      ensureChartVisibilityInit(teams);
      buildCustomLegend('all-chart-legend', teams, 'all');

      const labels = Array.from({ length: DATA.current_gw }, (_, i) => `GW${i + 1}`);
      const isTotal = metric === 'total_pts';
      const visibleCount = teams.filter(t => chartVisibility.all[t] !== false).length;

      const datasets = teams.map((team, idx) => {
        const col = TEAM_COLOR_MAP[team] || '#94a3b8';
        const isVis = chartVisibility.all[team] !== false;
        const dataArr = isTotal
          ? (DATA.points_progression ? DATA.points_progression[team] : [])
          : (DATA.rank_progression[team] || []);

        const isHighlighted = (visibleCount <= 2 && isVis) || spotlightTeam === team;
        let bgFill = col;
        let fillMode = false;
        if (isTotal && (isHighlighted || idx <= 1 || team === 'Ninh SS')) {
          const grad = ctx.createLinearGradient(0, 0, 0, 260);
          grad.addColorStop(0, col + (isHighlighted ? '48' : '30'));
          grad.addColorStop(1, col + '00');
          bgFill = grad;
          fillMode = true;
        }

        return {
          label: team,
          data: dataArr,
          hidden: !isVis,
          borderColor: col,
          backgroundColor: bgFill,
          fill: fillMode,
          borderWidth: isHighlighted ? 3.6 : ((idx <= 1 || team === 'Ninh SS') ? 2.8 : 1.7),
          tension: 0.36,
          pointRadius: isHighlighted ? 5 : 3.8,
          pointHoverRadius: 8,
          pointBackgroundColor: col,
          pointBorderColor: '#04070e',
          pointBorderWidth: 1.8
        };
      });

      allSeasonChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        plugins: [broadcastChartPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 20, bottom: 8, left: 6, right: 16 } },
          interaction: { mode: 'index', intersect: false },
          scales: {
            y: isTotal ? {
              beginAtZero: false,
              ticks: { color: '#94a3b8', font: { size: 10, family: 'JetBrains Mono', weight: 'bold' }, callback: v => v + 'đ' },
              grid: { color: 'rgba(255,255,255,0.06)' }
            } : {
              reverse: true,
              min: 1,
              max: Math.max(2, teams.length),
              ticks: { stepSize: 1, color: '#94a3b8', font: { size: 10, family: 'JetBrains Mono', weight: 'bold' }, callback: v => '#' + v },
              grid: { color: 'rgba(255,255,255,0.06)' }
            },
            x: {
              offset: true,
              ticks: { color: '#cbd5e1', font: { size: 10, family: 'JetBrains Mono', weight: 'bold' } },
              grid: { color: 'rgba(255,255,255,0.03)' }
            }
          },
          plugins: {
            broadcastOverlay: { isRank: !isTotal },
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(9, 14, 26, 0.96)',
              borderColor: 'rgba(245, 158, 11, 0.55)',
              borderWidth: 1,
              padding: 11,
              cornerRadius: 12,
              titleFont: { family: 'Plus Jakarta Sans', weight: '800', size: 12 },
              bodyFont: { family: 'JetBrains Mono', size: 11 },
              itemSort: (a, b) => isTotal ? b.parsed.y - a.parsed.y : a.parsed.y - b.parsed.y,
              callbacks: {
                label: (c) => ` ${teamWithManager(c.dataset.label)}: ${isTotal ? c.parsed.y + 'đ' : '#' + c.parsed.y}`
              }
            }
          }
        }
      });
    }

    function populateSimManagers() {
      const sA = document.getElementById('sim-manager-a');
      const sB = document.getElementById('sim-manager-b');
      if (!sA || !sB || !DATA) return;
      const opts = DATA.league_124.map(s => `<option value="${s.team}">${s.team} (${getHlvLabel(s.team, s.manager)})</option>`).join('');
      sA.innerHTML = opts;
      sB.innerHTML = opts;
      if (DATA.league_124.length >= 2) {
        sA.value = DATA.league_124[1].team;
        sB.value = DATA.league_124[0].team;
      }
    }

    function runWhatIfSim() {
      if (!DATA) return;
      const mode = document.getElementById('sim-mode').value;
      const teamAName = document.getElementById('sim-manager-a').value || DATA.league_124[1].team;
      const teamBName = document.getElementById('sim-manager-b').value || DATA.league_124[0].team;

      const objA = DATA.league_124.find(x => x.team === teamAName) || DATA.league_124[1];
      const objB = DATA.league_124.find(x => x.team === teamBName) || DATA.league_124[0];

      const ptsA = parseInt(document.getElementById('slider-a').value);
      const ptsB = parseInt(document.getElementById('slider-b').value);
      const chipA = parseInt(document.getElementById('sim-chip-a').value);
      const chipB = parseInt(document.getElementById('sim-chip-b').value);

      const gwTotalA = ptsA + chipA;
      const gwTotalB = ptsB + chipB;
      document.getElementById('sim-pts-a').textContent = `${gwTotalA}đ` + (chipA > 0 ? ` (+${chipA})` : '');
      document.getElementById('sim-pts-b').textContent = `${gwTotalB}đ` + (chipB > 0 ? ` (+${chipB})` : '');

      const baseA = mode === 'turn2' ? (objA.turn2_pts || 0) : objA.total;
      const baseB = mode === 'turn2' ? (objB.turn2_pts || 0) : objB.total;

      const finalA = baseA + gwTotalA;
      const finalB = baseB + gwTotalB;
      const diff = finalA - finalB;

      const textEl = document.getElementById('sim-status-text');
      const badgeEl = document.getElementById('sim-gap-badge');
      textEl.textContent = `${teamWithManager(objA.team)} (${finalA}đ) vs ${teamWithManager(objB.team)} (${finalB}đ)`;

      if (diff > 0) {
        badgeEl.className = 'font-black text-emerald-400';
        badgeEl.textContent = `🏆 ${teamWithManager(objA.team)} THẮNG KÈO (+${diff}đ)`;
      } else if (diff === 0) {
        badgeEl.className = 'font-black text-amber-400';
        badgeEl.textContent = '🤝 HÒA KÈO KHÔNG PHÂN THẮNG BẠI';
      } else {
        badgeEl.className = 'font-black text-rose-400';
        badgeEl.textContent = `🏆 ${teamWithManager(objB.team)} THẮNG KÈO (+${Math.abs(diff)}đ)`;
      }
    }

    const CLUB_KITS = {
      ARS: { main: '#EF0107', sleeve: '#FFFFFF', collar: '#FFFFFF' },
      AVL: { main: '#670E36', sleeve: '#95BFE5', collar: '#95BFE5' },
      BHA: { main: '#0057B8', sleeve: '#FFFFFF', collar: '#FFFFFF' },
      BOU: { main: '#DA291C', sleeve: '#111827', collar: '#111827' },
      BRE: { main: '#E30613', sleeve: '#FFFFFF', collar: '#111827' },
      CHE: { main: '#034694', sleeve: '#034694', collar: '#FFFFFF' },
      COV: { main: '#7AD0F6', sleeve: '#7AD0F6', collar: '#0F172A' },
      CRY: { main: '#1B458F', sleeve: '#C4122E', collar: '#FFFFFF' },
      EVE: { main: '#003399', sleeve: '#003399', collar: '#FFFFFF' },
      FUL: { main: '#FFFFFF', sleeve: '#111827', collar: '#111827' },
      HUL: { main: '#F5A12D', sleeve: '#111827', collar: '#111827' },
      IPS: { main: '#3A64A3', sleeve: '#3A64A3', collar: '#FFFFFF' },
      LEE: { main: '#F8FAFC', sleeve: '#FACC15', collar: '#1D4ED8' },
      LIV: { main: '#C8102E', sleeve: '#C8102E', collar: '#FFFFFF' },
      MCI: { main: '#6CABDD', sleeve: '#6CABDD', collar: '#FFFFFF' },
      MUN: { main: '#DA291C', sleeve: '#DA291C', collar: '#111827' },
      NEW: { main: '#1E293B', sleeve: '#F8FAFC', collar: '#F8FAFC' },
      NFO: { main: '#DD0000', sleeve: '#DD0000', collar: '#FFFFFF' },
      SUN: { main: '#EB172B', sleeve: '#FFFFFF', collar: '#111827' },
      TOT: { main: '#F8FAFC', sleeve: '#F8FAFC', collar: '#132257' }
    };

    function getClubJerseySVG(team, isGK, badge) {
      const kit = isGK ? { main: '#F59E0B', sleeve: '#D97706', collar: '#111827' } : (CLUB_KITS[team] || { main: '#64748B', sleeve: '#475569', collar: '#FFFFFF' });
      const badgeHtml = badge ? `<span class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 font-black text-[9px] flex items-center justify-center border border-white shadow">${badge}</span>` : '';
      return `
        <div class="relative w-10 h-10 sm:w-11 sm:h-11 mx-auto drop-shadow-md">
          <svg viewBox="0 0 64 64" class="w-full h-full">
            <path d="M18 10 L26 6 L38 6 L46 10 L58 20 L51 30 L44 25 L44 56 L20 56 L20 25 L13 30 L6 20 Z" fill="${kit.main}" stroke="#0F172A" stroke-width="2" stroke-linejoin="round"/>
            <path d="M18 10 L6 20 L13 30 L20 25 Z" fill="${kit.sleeve}" stroke="#0F172A" stroke-width="1.5"/>
            <path d="M46 10 L58 20 L51 30 L44 25 Z" fill="${kit.sleeve}" stroke="#0F172A" stroke-width="1.5"/>
            <path d="M26 6 Q32 14 38 6" fill="none" stroke="${kit.collar}" stroke-width="2.5"/>
          </svg>
          ${badgeHtml}
        </div>
      `;
    }

    function populatePitchSelector() {
      const sel = document.getElementById('pitch-squad-selector');
      const hint = document.getElementById('pitch-selector-hint');
      if (!sel || !DATA) return;
      let opts = `<option value="DREAM_TEAM">🏆 Dream Team Mùa 2026/27 (${DATA.dream_team.total_pts}đ)</option>`;
      if (isVipUnlocked && DATA.league_124_squads) {
        DATA.league_124.forEach(s => {
          const sq = DATA.league_124_squads[s.team];
          if (sq) {
            const chipTag = sq.active_chip ? ` • ${sq.active_chip.toUpperCase()}` : '';
            opts += `<option value="${s.team}">🛡️ ${s.team} (${getHlvLabel(s.team, s.manager)}) — GW10: ${sq.gw_pts}đ${chipTag}</option>`;
          }
        });
        if (hint) hint.innerHTML = 'Chọn đội bóng bất kỳ để soi 15 cầu thủ ra sân GW10, So Găng 1v1 và Meta Sở Hữu Nội Bộ';
      } else {
        if (hint) hint.innerHTML = 'Đội hình 11 ngôi sao xuất sắc nhất mùa giải 2026/27 • Chạm vào từng cầu thủ trên sân để xem thông số';
      }
      sel.innerHTML = opts;
    }

    function inspectPitchPlayer(pid) {
      const p = currentPitchPlayers[pid];
      if (!p) return;
      const body = document.getElementById('pitch-inspector-body');
      const fourthCell = isVipUnlocked ? `
          <div class="bg-slate-950/90 p-2 rounded-xl border border-slate-800">
            <span class="text-[9px] text-slate-400 block font-sans">xGI / 90'</span>
            <b class="text-sm text-cyan-400">${p.xgi_90}</b>
          </div>` : `
          <div class="bg-slate-950/90 p-2 rounded-xl border border-slate-800">
            <span class="text-[9px] text-slate-400 block font-sans">Giá (£)</span>
            <b class="text-sm text-cyan-400">£${p.cost}m</b>
          </div>`;
      body.innerHTML = `
        <div class="flex items-center gap-3 mb-3">
          <div class="shrink-0">${getClubJerseySVG(p.team, p.pos === 'GKP', p.is_captain ? 'C' : (p.is_vc ? 'V' : ''))}</div>
          <div>
            <h4 class="text-base font-black text-white">${p.name} <span class="text-xs font-semibold text-cyan-400">(${p.team} • ${p.pos || 'PL'})</span></h4>
            <p class="text-[11px] text-slate-400">Giá thị trường: <b class="text-emerald-400 font-mono-numbers">£${p.cost}m</b> • Sở hữu: <b class="text-white font-mono-numbers">${p.selected_by}%</b></p>
          </div>
        </div>
        <div class="grid grid-cols-4 gap-2 text-center font-mono-numbers">
          <div class="bg-slate-950/90 p-2 rounded-xl border border-slate-800">
            <span class="text-[9px] text-slate-400 block font-sans">GW10</span>
            <b class="text-sm text-amber-400">${p.eff_gw_pts !== undefined ? p.eff_gw_pts : p.gw_pts}đ</b>
          </div>
          <div class="bg-slate-950/90 p-2 rounded-xl border border-slate-800">
            <span class="text-[9px] text-slate-400 block font-sans">Tổng Mùa</span>
            <b class="text-sm text-white">${p.pts}đ</b>
          </div>
          ${fourthCell}
          <div class="bg-slate-950/90 p-2 rounded-xl border border-slate-800">
            <span class="text-[9px] text-slate-400 block font-sans">Form</span>
            <b class="text-sm text-emerald-400">${p.form}</b>
          </div>
        </div>
      `;
    }

    function renderPitchView() {
      if (!DATA) return;
      const selEl = document.getElementById('pitch-squad-selector');
      let selVal = selEl?.value || 'DREAM_TEAM';
      if (!isVipUnlocked && selVal !== 'DREAM_TEAM') {
        selVal = 'DREAM_TEAM';
        if (selEl) selEl.value = 'DREAM_TEAM';
      }
      currentPitchPlayers = {};

      let gkList = [], defList = [], midList = [], fwdList = [], benchList = [];
      let isSeasonMode = true;
      let totalLabel = '';

      if (selVal === 'DREAM_TEAM' || !DATA.league_124_squads || !DATA.league_124_squads[selVal]) {
        const dt = DATA.dream_team;
        gkList = [{ ...dt.gk, pos: 'GKP' }];
        defList = dt.defs.map(x => ({ ...x, pos: 'DEF' }));
        midList = dt.mids.map(x => ({ ...x, pos: 'MID' }));
        fwdList = dt.fwds.map(x => ({ ...x, pos: 'FWD' }));
        benchList = dt.bench;
        totalLabel = `Tổng Mùa: ${dt.total_pts}đ`;
        document.getElementById('pitch-title').textContent = 'DREAM TEAM CHẶNG 1 — CHÍNH THỨC 2026/27';
        document.getElementById('pitch-subtitle').textContent = '11 ngôi sao ghi nhiều điểm nhất Premier League thực tế sau 10 vòng';
        document.getElementById('pitch-chip-badge').classList.add('hidden');
      } else {
        isSeasonMode = false;
        const sq = DATA.league_124_squads[selVal];
        gkList = sq.starting.GKP || [];
        defList = sq.starting.DEF || [];
        midList = sq.starting.MID || [];
        fwdList = sq.starting.FWD || [];
        benchList = sq.bench || [];
        totalLabel = `Điểm GW10: ${sq.gw_pts}đ`;
        document.getElementById('pitch-title').textContent = `ĐỘI HÌNH RA SÂN GW10 — ${selVal.toUpperCase()}`;
        document.getElementById('pitch-subtitle').textContent = `${getHlvLabel(selVal, sq.manager)} • Dữ liệu thực tế sau khi chốt sổ Auto-Sub`;
        const chipBadge = document.getElementById('pitch-chip-badge');
        if (sq.active_chip) {
          chipBadge.textContent = `⚡ CHIP: ${sq.active_chip.toUpperCase()}`;
          chipBadge.classList.remove('hidden');
        } else {
          chipBadge.classList.add('hidden');
        }
      }

      document.getElementById('dt-total-badge').textContent = totalLabel;

      const makeNode = (p, isGK) => {
        const pid = 'p_' + p.id + '_' + Math.random().toString(36).slice(2, 6);
        currentPitchPlayers[pid] = p;
        const ptsShow = isSeasonMode ? p.pts : (p.eff_gw_pts !== undefined ? p.eff_gw_pts : p.gw_pts);
        const capTag = p.is_captain ? 'C' : (p.is_vc ? 'V' : '');
        const pillColor = (isSeasonMode ? ptsShow >= 65 : ptsShow >= 10)
          ? 'bg-amber-400 text-slate-950 font-black'
          : ((isSeasonMode ? ptsShow >= 55 : ptsShow >= 6) ? 'bg-emerald-500 text-white font-bold' : 'bg-slate-900/95 text-slate-200');

        return `
          <div onclick="inspectPitchPlayer('${pid}')" class="pitch-player text-center cursor-pointer w-16 sm:w-20">
            ${getClubJerseySVG(p.team, isGK, capTag)}
            <div class="mt-0.5 bg-slate-950/90 rounded-t px-1 py-0.5 text-[9px] sm:text-[10px] font-bold text-white truncate border-x border-t border-slate-700/60">${p.name}</div>
            <div class="${pillColor} rounded-b px-1 py-0.5 text-[9px] font-mono-numbers shadow-sm">${ptsShow}đ • ${p.team}</div>
          </div>
        `;
      };

      document.getElementById('dt-pitch-container').innerHTML = `
        <div class="flex justify-center">${gkList.map(p => makeNode(p, true)).join('')}</div>
        <div class="flex justify-around items-center">${defList.map(p => makeNode(p, false)).join('')}</div>
        <div class="flex justify-around items-center">${midList.map(p => makeNode(p, false)).join('')}</div>
        <div class="flex justify-around items-center">${fwdList.map(p => makeNode(p, false)).join('')}</div>
      `;

      // Render Bench
      document.getElementById('dt-bench-container').innerHTML = benchList.map(b => {
        const pid = 'b_' + b.id + '_' + Math.random().toString(36).slice(2, 6);
        currentPitchPlayers[pid] = b;
        const ptsShow = isSeasonMode ? b.pts : b.gw_pts;
        return `
          <div onclick="inspectPitchPlayer('${pid}')" class="cursor-pointer bg-slate-900/90 hover:bg-slate-800 border border-slate-800 rounded-xl p-2 text-center transition">
            <span class="text-[9px] text-slate-400 block font-mono">${b.pos} • ${b.team}</span>
            <p class="text-[11px] font-bold text-white truncate">${b.name}</p>
            <span class="text-[10px] font-mono-numbers font-bold ${ptsShow >= 6 ? 'text-emerald-400' : 'text-slate-400'}">${ptsShow}đ</span>
          </div>
        `;
      }).join('');

      // Calculate Breakdown by Position
      const sumPts = (arr) => arr.reduce((acc, p) => acc + (isSeasonMode ? p.pts : (p.eff_gw_pts !== undefined ? p.eff_gw_pts : p.gw_pts)), 0);
      const gkPts = sumPts(gkList);
      const defPts = sumPts(defList);
      const midPts = sumPts(midList);
      const fwdPts = sumPts(fwdList);
      const totalAll = Math.max(1, gkPts + defPts + midPts + fwdPts);

      const bar = (title, pts, color) => {
        const pct = ((pts / totalAll) * 100).toFixed(1);
        return `
          <div>
            <div class="flex justify-between font-bold mb-1">
              <span class="text-slate-200">${title}</span>
              <span class="font-mono-numbers text-white">${pts}đ (${pct}%)</span>
            </div>
            <div class="w-full bg-slate-800 rounded-full h-1.5">
              <div class="${color} h-1.5 rounded-full" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      };

      document.getElementById('dt-breakdown-bars').innerHTML =
        bar('Hậu Vệ', defPts, 'bg-cyan-500') +
        bar('Tiền Vệ', midPts, 'bg-indigo-500') +
        bar('Tiền Đạo', fwdPts, 'bg-rose-500') +
        bar('Thủ Môn', gkPts, 'bg-amber-500');

      // Render Doughnut Chart
      const dCtx = document.getElementById('pitchDoughnutChart').getContext('2d');
      if (pitchDoughnut) pitchDoughnut.destroy();
      pitchDoughnut = new Chart(dCtx, {
        type: 'doughnut',
        data: {
          labels: ['DEF', 'MID', 'FWD', 'GKP'],
          datasets: [{
            data: [defPts, midPts, fwdPts, gkPts],
            backgroundColor: ['#06b6d4', '#6366f1', '#f43f5e', '#f59e0b'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: { legend: { display: false } }
        }
      });

      // Render Club Exposure
      const allStarters = [...gkList, ...defList, ...midList, ...fwdList];
      const clubCounts = {};
      allStarters.forEach(p => {
        const pts = isSeasonMode ? p.pts : (p.eff_gw_pts !== undefined ? p.eff_gw_pts : p.gw_pts);
        if (!clubCounts[p.team]) clubCounts[p.team] = { count: 0, pts: 0 };
        clubCounts[p.team].count += 1;
        clubCounts[p.team].pts += pts;
      });
      const sortedClubs = Object.entries(clubCounts).sort((a, b) => b[1].pts - a[1].pts);
      document.getElementById('pitch-club-exposure').innerHTML = sortedClubs.map(([team, stat]) => `
        <span class="px-2.5 py-1 rounded-xl bg-slate-950/90 border border-slate-800 text-[11px] flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full" style="background-color: ${(CLUB_KITS[team]?.main) || '#94a3b8'}"></span>
          <b class="text-white">${team}</b> <span class="text-slate-400">(${stat.count} người)</span>: <b class="text-emerald-400 font-mono-numbers">${stat.pts}đ</b>
        </span>
      `).join('');

      // Auto inspect highest scorer
      const topId = Object.keys(currentPitchPlayers).sort((a, b) => {
        const pa = currentPitchPlayers[a];
        const pb = currentPitchPlayers[b];
        return (isSeasonMode ? pb.pts - pa.pts : (pb.eff_gw_pts || pb.gw_pts) - (pa.eff_gw_pts || pa.gw_pts));
      })[0];
      if (topId) inspectPitchPlayer(topId);
    }

    function populateRadarSelectors() {
      const s1 = document.getElementById('radar-player-1');
      const s2 = document.getElementById('radar-player-2');
      const opts = DATA.market_players.slice(0, 20).map(p =>
        `<option value="${p.name}">${p.name} (${p.team} • £${p.cost}m • ${p.pts}đ)</option>`
      ).join('');
      s1.innerHTML = opts;
      s2.innerHTML = opts;
      if (DATA.market_players.length > 8) {
        s1.value = 'Groß';
        s2.value = 'Tavernier';
      }
      updateComparison();
    }

    function updateComparison() {
      if (!DATA) return;
      const n1 = document.getElementById('radar-player-1').value;
      const n2 = document.getElementById('radar-player-2').value;
      const p1 = DATA.market_players.find(p => p.name === n1) || DATA.market_players[0];
      const p2 = DATA.market_players.find(p => p.name === n2) || DATA.market_players[1];

      document.getElementById('h2h-title').textContent = `${p1.name} vs ${p2.name}`;

      const compRow = (label, v1, v2, suffix = '') => {
        const sum = (v1 + v2) || 1;
        const pct1 = Math.max(10, Math.min(90, (v1 / sum) * 100));
        const pct2 = 100 - pct1;
        return `
          <div>
            <div class="flex justify-between font-bold text-white mb-1">
              <span class="text-cyan-400">${v1}${suffix} (${p1.name})</span>
              <span class="text-slate-400 font-sans text-[10px]">${label}</span>
              <span class="text-emerald-400">${v2}${suffix} (${p2.name})</span>
            </div>
            <div class="flex h-2 rounded-full overflow-hidden bg-slate-800">
              <div class="bg-cyan-500" style="width: ${pct1}%"></div>
              <div class="bg-emerald-500" style="width: ${pct2}%"></div>
            </div>
          </div>
        `;
      };

      if (isVipUnlocked) {
        document.getElementById('h2h-bars-container').innerHTML =
          compRow('Tổng Điểm Mùa', p1.pts, p2.pts, 'đ') +
          compRow('xGI / 90 Phút', p1.xgi_90, p2.xgi_90, '') +
          compRow('Form (4 Vòng)', p1.form, p2.form, '') +
          compRow('ICT Tấn Công', p1.ict, p2.ict, '') +
          compRow('Hiệu Suất Điểm/£1m', p1.value, p2.value, '');
      } else {
        document.getElementById('h2h-bars-container').innerHTML =
          compRow('Tổng Điểm Mùa', p1.pts, p2.pts, 'đ') +
          compRow('Form (4 Vòng)', p1.form, p2.form, '') +
          compRow('Tỷ Lệ Sở Hữu (%)', p1.selected_by, p2.selected_by, '%') +
          compRow('Giá Chuyển Nhượng (£m)', p1.cost, p2.cost, 'm');
      }

      // Update Radar
      const ctx = document.getElementById('marketRadarCanvas').getContext('2d');
      const norm = (val, max) => Math.min(100, Math.round((val / max) * 100));
      const radarLabels = isVipUnlocked
        ? ['Tổng Điểm', 'xGI/90', 'Form', 'ICT Index', 'Điểm/£1m']
        : ['Tổng Điểm', 'Form', 'Sở Hữu (%)', 'Giá (£m)'];
      const d1 = isVipUnlocked
        ? [norm(p1.pts, 80), norm(p1.xgi_90, 0.9), norm(p1.form, 10), norm(p1.ict, 100), norm(p1.value, 14)]
        : [norm(p1.pts, 80), norm(p1.form, 10), norm(p1.selected_by, 60), norm(p1.cost, 15)];
      const d2 = isVipUnlocked
        ? [norm(p2.pts, 80), norm(p2.xgi_90, 0.9), norm(p2.form, 10), norm(p2.ict, 100), norm(p2.value, 14)]
        : [norm(p2.pts, 80), norm(p2.form, 10), norm(p2.selected_by, 60), norm(p2.cost, 15)];

      if (radarChart) radarChart.destroy();
      radarChart = new Chart(ctx, {
        type: 'radar',
        data: {
          labels: radarLabels,
          datasets: [
            { label: p1.name, data: d1, backgroundColor: 'rgba(6, 182, 212, 0.25)', borderColor: '#06b6d4', pointBackgroundColor: '#06b6d4', borderWidth: 2 },
            { label: p2.name, data: d2, backgroundColor: 'rgba(16, 185, 129, 0.25)', borderColor: '#10b981', pointBackgroundColor: '#10b981', borderWidth: 2 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          scales: { r: { angleLines: { color: 'rgba(255,255,255,0.1)' }, grid: { color: 'rgba(255,255,255,0.08)' }, pointLabels: { color: '#94a3b8', font: { size: 10, weight: 'bold' } }, ticks: { display: false, max: 100 } } },
          plugins: { legend: { labels: { color: '#f1f5f9', font: { size: 11, weight: 'bold' } } } }
        }
      });
    }

    function renderWatchdog() {
      const wd = DATA.watchdog;
      const inHtml = wd.rising.map(p => `
        <div class="p-2 rounded-xl bg-emerald-950/20 border border-emerald-800/40 flex items-center justify-between">
          <div><p class="font-bold text-white">${p.name} (${p.team})</p><p class="text-[10px] text-slate-400">£${p.cost}m • ${p.pts}đ</p></div>
          <span class="font-bold text-emerald-400 font-mono-numbers">${p.net_transfers}</span>
        </div>
      `).join('');
      const outHtml = wd.falling.map(p => `
        <div class="p-2 rounded-xl bg-rose-950/20 border border-rose-800/40 flex items-center justify-between">
          <div><p class="font-bold text-white">${p.name} (${p.team})</p><p class="text-[10px] text-slate-400">£${p.cost}m • ${p.pts}đ</p></div>
          <span class="font-bold text-rose-400 font-mono-numbers">${p.net_transfers}</span>
        </div>
      `).join('');
      document.getElementById('watchdog-container').innerHTML = `<div class="space-y-1.5">${inHtml}</div><div class="space-y-1.5">${outHtml}</div>`;
    }

    function renderCaptaincy() {
      document.getElementById('captaincy-container').innerHTML = DATA.captaincy.map((c, idx) => `
        <div class="bg-slate-950/80 p-3 rounded-xl border ${idx === 0 ? 'border-amber-500/50' : 'border-slate-800'} relative">
          <span class="absolute top-2 right-2 text-[9px] font-black px-1.5 py-0.5 rounded ${idx === 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-300'}">#${idx + 1} Cap</span>
          <p class="font-black text-white text-sm">${c.name} (${c.team})</p>
          <p class="text-[11px] text-slate-400">vs ${c.next_opp} • Form ${c.form}</p>
          <div class="mt-2 flex justify-between items-center font-mono-numbers">
            <span class="text-xs text-slate-400">Cap Index:</span>
            <span class="text-base font-black ${idx === 0 ? 'text-amber-400' : 'text-cyan-400'}">${c.cap_index} / 100</span>
          </div>
        </div>
      `).join('');
    }

    function filterPlayerPos(pos) {
      currentPosFilter = pos;
      ['ALL', 'FWD', 'MID', 'DEF', 'GKP'].forEach(p => {
        const btn = document.getElementById('btn-filter-' + p);
        if (btn) btn.className = p === pos ? "px-2.5 py-1 rounded-lg bg-cyan-600 text-white font-bold text-[11px]" : "px-2.5 py-1 rounded-lg text-slate-400 hover:text-white text-[11px]";
      });
      renderMarketTable();
    }

    function renderMarketTable() {
      if (!DATA) return;
      const q = (document.getElementById('player-search').value || '').toLowerCase();
      const filtered = DATA.market_players.filter(p => {
        const matchPos = currentPosFilter === 'ALL' || p.pos === currentPosFilter;
        const matchQuery = !q || p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q);
        return matchPos && matchQuery;
      });

      const headEl = document.getElementById('market-table-head');
      const subEl = document.getElementById('market-table-subtitle');
      if (headEl) {
        headEl.innerHTML = isVipUnlocked ? `
          <tr>
            <th class="p-2.5">Cầu Thủ</th>
            <th class="p-2.5">CLB / Vị Trí</th>
            <th class="p-2.5 text-right">Giá (£)</th>
            <th class="p-2.5 text-right font-black text-white">Tổng Điểm</th>
            <th class="p-2.5 text-right text-cyan-400 font-bold">xGI/90</th>
            <th class="p-2.5 text-right">Form</th>
            <th class="p-2.5 text-right font-bold text-emerald-400">Điểm/£1m</th>
            <th class="p-2.5 text-right">Sở Hữu (%)</th>
            <th class="p-2.5 text-center">Nhận Định</th>
          </tr>
        ` : `
          <tr>
            <th class="p-2.5">Cầu Thủ</th>
            <th class="p-2.5">CLB / Vị Trí</th>
            <th class="p-2.5 text-right">Giá (£)</th>
            <th class="p-2.5 text-right font-black text-white">Tổng Điểm</th>
            <th class="p-2.5 text-right">Form</th>
            <th class="p-2.5 text-right">Sở Hữu (%)</th>
          </tr>
        `;
      }
      if (subEl) {
        subEl.textContent = isVipUnlocked
          ? 'Đang hiển thị đầy đủ chỉ số Moneyball (xGI/90, Điểm/£1m & Nhận định chuyên sâu)'
          : 'Lọc theo vị trí hoặc tìm tên cầu thủ để tra cứu phong độ & tỷ lệ sở hữu';
      }

      document.getElementById('market-table-body').innerHTML = filtered.map(p => isVipUnlocked ? `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="p-2.5 font-bold text-white">${p.name}</td>
          <td class="p-2.5 text-slate-400 font-mono text-[11px]">${p.pos} • ${p.team}</td>
          <td class="p-2.5 text-right font-mono-numbers">£${p.cost}m</td>
          <td class="p-2.5 text-right font-mono-numbers font-black text-white">${p.pts}</td>
          <td class="p-2.5 text-right font-mono-numbers font-bold text-cyan-400">${p.xgi_90}</td>
          <td class="p-2.5 text-right font-mono-numbers">${p.form}</td>
          <td class="p-2.5 text-right font-mono-numbers font-bold text-emerald-400">${p.value}</td>
          <td class="p-2.5 text-right font-mono-numbers text-slate-400">${p.selected_by}%</td>
          <td class="p-2.5 text-center"><span class="px-2 py-0.5 rounded-full text-[10px] bg-slate-900 text-slate-300 border border-slate-700">${p.tag}</span></td>
        </tr>
      ` : `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="p-2.5 font-bold text-white">${p.name}</td>
          <td class="p-2.5 text-slate-400 font-mono text-[11px]">${p.pos} • ${p.team}</td>
          <td class="p-2.5 text-right font-mono-numbers">£${p.cost}m</td>
          <td class="p-2.5 text-right font-mono-numbers font-black text-white">${p.pts}</td>
          <td class="p-2.5 text-right font-mono-numbers">${p.form}</td>
          <td class="p-2.5 text-right font-mono-numbers text-slate-400">${p.selected_by}%</td>
        </tr>
      `).join('');
    }

    function renderFixtureTable() {
      if (!DATA) return;
      const headers = DATA.gw_headers.map(h => `<th class="p-3 text-center">${h}</th>`).join('');
      document.getElementById('fixture-thead').innerHTML = `
        <tr>
          <th class="p-3 w-36">Câu Lạc Bộ</th>
          ${headers}
          <th class="p-3 text-center font-bold text-emerald-400">FDR TB</th>
          ${isVipUnlocked ? '<th class="p-3 text-left text-amber-300">Ngôi Sao Trọng Tâm</th>' : ''}
        </tr>
      `;

      document.getElementById('fixture-table-body').innerHTML = DATA.fixtures.map(f => {
        const lbl = String(f.avg_label || f.avg);
        const dotColor = lbl.includes('Mềm') ? 'bg-emerald-400' : (lbl.includes('Xương') ? 'bg-rose-500' : 'bg-slate-400');
        const textColor = lbl.includes('Mềm') ? 'text-emerald-400' : (lbl.includes('Xương') ? 'text-rose-400' : 'text-slate-300');
        const matchCells = f.matches.map(m =>
          `<td class="p-2.5 text-center"><span class="badge-diff-${m.diff} px-2 py-0.5 rounded-md text-[10px] font-extrabold inline-block w-16 text-center shadow-sm">${m.opp}</span></td>`
        ).join('');
        const stratCell = isVipUnlocked
          ? `<td class="p-3 text-[11px] text-slate-300">${f.strat}</td>`
          : '';

        return `
          <tr class="hover:bg-slate-800/40 transition">
            <td class="p-3 font-bold text-white flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full ${dotColor}"></span>${f.team}</td>
            ${matchCells}
            <td class="p-3 text-center font-bold font-mono-numbers ${textColor}">${lbl}</td>
            ${stratCell}
          </tr>
        `;
      }).join('');
    }

    function renderVipVault() {
      const v = DATA.vip_vault;
      document.getElementById('vip-stats-grid').innerHTML = `
        <div class="bg-slate-950/90 p-3 rounded-xl border border-slate-800">
          <span class="text-[10px] uppercase font-bold text-slate-400">Tổng Điểm / Rank</span>
          <p class="text-xl font-black text-cyan-400 font-mono-numbers">${v.total_points}đ</p>
          <span class="text-[10px] text-slate-400">#${v.overall_rank.toLocaleString()}</span>
        </div>
        <div class="bg-slate-950/90 p-3 rounded-xl border border-slate-800">
          <span class="text-[10px] uppercase font-bold text-slate-400">Ngân Sách Dư (ITB)</span>
          <p class="text-xl font-black text-emerald-400 font-mono-numbers">£${v.bank_itb}m</p>
          <span class="text-[10px] text-slate-400">Tiền mặt sẵn sàng</span>
        </div>
        <div class="bg-slate-950/90 p-3 rounded-xl border border-slate-800">
          <span class="text-[10px] uppercase font-bold text-slate-400">Cách Top 1 (${v.leader_name})</span>
          <p class="text-xl font-black text-amber-400 font-mono-numbers">${v.gap_to_leader}đ</p>
          <span class="text-[10px] text-slate-400">Bao mới nổ Bench Boost GW10</span>
        </div>
        <div class="bg-slate-950/90 p-3 rounded-xl border border-slate-800">
          <span class="text-[10px] uppercase font-bold text-slate-400">Còn Lại Phase 1</span>
          <p class="text-xl font-black text-purple-400 font-mono-numbers">3 Chip</p>
          <span class="text-[10px] text-rose-400 font-bold">Hạn chót GW19!</span>
        </div>
      `;

      document.getElementById('vip-chips-grid').innerHTML = v.phase1_chips.map(c => `
        <div class="p-2.5 rounded-xl border ${c.used ? 'bg-slate-900/40 border-slate-800 opacity-60' : 'bg-emerald-950/20 border-emerald-500/40'}">
          <p class="text-[10px] text-slate-400">${c.name}</p>
          <p class="text-xs font-black mt-0.5 ${c.used ? 'text-slate-500 line-through' : 'text-emerald-400'}">${c.used ? 'ĐÃ KÍCH HOẠT' : 'SẴN SÀNG'}</p>
        </div>
      `).join('');

      document.getElementById('vip-squad-tbody').innerHTML = v.squad.map(p => `
        <tr class="${p.is_bench ? 'opacity-60 bg-slate-900/40' : ''}">
          <td class="p-1.5 font-mono text-[10px] text-slate-400">${p.is_bench ? 'SUB' : p.pos}</td>
          <td class="p-1.5 font-bold text-white">${p.name} ${p.is_captain ? '<span class="text-amber-400">(C)</span>' : (p.is_vc ? '<span class="text-cyan-400">(VC)</span>' : '')} <span class="text-[10px] text-slate-400">(${p.team})</span></td>
          <td class="p-1.5 text-right font-mono-numbers">£${p.cost}m</td>
          <td class="p-1.5 text-right font-mono-numbers font-bold text-emerald-400">${p.pts}đ</td>
        </tr>
      `).join('');

      document.getElementById('vip-strategy-notes').innerHTML = `
        <p>• <b>Sự thật về Bao Bui (605đ):</b> Hắn vừa kích hoạt <b>Bench Boost ở GW10</b> (+19đ dự bị) nên mới vọt lên cách mình ${Math.abs(v.gap_to_leader)}đ. Ngược lại, <b>Cận VIP vẫn còn nguyên 3 Chip (TC, BB, FH)</b> trong tay để phản công ở Chặng 2!</p>
        <p>• <b>Kế hoạch xả Chip Phase 1 (Từ GW11–GW19):</b> Với ${v.bank_itb}m trong ngân hàng, giữ nguyên 3 Chip còn lại để dồn hỏa lực vào các vòng có lịch đấu xanh ngắt (Aston Villa FDR 2.2, Brighton 2.8) và bung Bench Boost vào giai đoạn Boxing Day.</p>
      `;
    }

    // NAVIGATION & AUTH
    function switchTab(tabId) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
      document.querySelectorAll('nav button').forEach(el => {
        el.classList.remove('text-cyan-400', 'text-amber-400');
        el.classList.add('text-slate-400');
      });
      document.getElementById('tab-' + tabId).classList.remove('hidden');
      const activeNav = document.getElementById('nav-' + tabId);
      if (activeNav) {
        activeNav.classList.remove('text-slate-400');
        activeNav.classList.add(tabId === 'vip-vault' ? 'text-amber-400' : 'text-cyan-400');
      }
      if (tabId === 'market' && DATA) updateComparison();
      if (tabId === 'pitch' && DATA) renderPitchView();
    }

    function handleVipButton() { isVipUnlocked ? switchTab('vip-vault') : togglePasswordModal(); }
    function togglePasswordModal() {
      document.getElementById('password-modal').classList.toggle('hidden');
      document.getElementById('pass-error').classList.add('hidden');
      document.getElementById('vip-pass-input').value = '';
    }
    function verifyPassword() {
      const input = document.getElementById('vip-pass-input').value.trim().toLowerCase();
      if (VALID_PASSWORDS.includes(input)) {
        isVipUnlocked = true;
        localStorage.setItem('fpl_vip_auth_0124', 'true');
        togglePasswordModal();
        applyVipState();
        switchTab('vip-vault');
      } else {
        document.getElementById('pass-error').classList.remove('hidden');
      }
    }
    function lockVipVault() { isVipUnlocked = false; localStorage.removeItem('fpl_vip_auth_0124'); applyVipState(); switchTab('standings'); }
    function applyVipState() {
      const navVip = document.getElementById('nav-vip-vault');
      const vipIcon = document.getElementById('vip-icon');
      const vipLabel = document.getElementById('vip-label');
      const pitchDeepAnalytics = document.getElementById('pitch-vip-deep-analytics');
      const marketCapCard = document.getElementById('market-vip-captaincy-card');

      if (isVipUnlocked) {
        navVip.classList.remove('hidden'); navVip.classList.add('flex');
        vipIcon.className = "fa-solid fa-lock-open text-emerald-400"; vipLabel.textContent = "VIP Mở";
        pitchDeepAnalytics?.classList.remove('hidden');
        marketCapCard?.classList.remove('hidden');
      } else {
        navVip.classList.add('hidden'); navVip.classList.remove('flex');
        vipIcon.className = "fa-solid fa-lock text-amber-400"; vipLabel.textContent = "VIP Vault";
        pitchDeepAnalytics?.classList.add('hidden');
        marketCapCard?.classList.add('hidden');
      }
      updateSpotlightBanner();
      if (DATA) {
        populatePitchSelector();
        renderPitchView();
        updateComparison();
        renderMarketTable();
        renderFixtureTable();
      }
    }
    function openHaoTamModal() { document.getElementById('haotam-modal').classList.remove('hidden'); }
    function closeHaoTamModal() { document.getElementById('haotam-modal').classList.add('hidden'); }
    function openSamsungModal() { document.getElementById('samsung-modal').classList.remove('hidden'); }
    function closeSamsungModal() { document.getElementById('samsung-modal').classList.add('hidden'); }

    window.addEventListener('DOMContentLoaded', () => {
      if (localStorage.getItem('fpl_vip_auth_0124') === 'true') isVipUnlocked = true;
      applyVipState();
      loadLiveData();
    });
  