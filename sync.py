import requests
import json
import os
from datetime import datetime, timezone

FPL_BASE = "https://fantasy.premierleague.com/api"
MY_TEAM_ID = 707471
LEAGUE_124_ID = 1473576
LEAGUE_IOC_ID = 155330

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}

def fetch_json(endpoint):
    url = f"{FPL_BASE}/{endpoint}"
    r = requests.get(url, headers=HEADERS, timeout=15)
    r.raise_for_status()
    return r.json()

def main():
    print("Fetching FPL bootstrap-static...")
    bs = fetch_json("bootstrap-static/")
    elements = bs['elements']
    el_map = {e['id']: e for e in elements}
    teams_short = {t['id']: t['short_name'] for t in bs['teams']}
    teams_name = {t['id']: t['name'] for t in bs['teams']}

    # Determine current and next GW
    events = bs['events']
    current_gw = next((e['id'] for e in events if e.get('is_current')), 10)
    next_gw_obj = next((e for e in events if e.get('is_next')), None)
    next_gw = next_gw_obj['id'] if next_gw_obj else current_gw + 1
    next_deadline = next_gw_obj.get('deadline_time', '2026-11-21T11:00:00Z') if next_gw_obj else '2026-11-21T11:00:00Z'
    gw_range = list(range(next_gw, min(next_gw + 5, 39)))

    # 1.5 Fetch GW live points for current_gw
    print(f"Fetching event/{current_gw}/live/...")
    live_res = fetch_json(f"event/{current_gw}/live/")
    live_pts_map = {e['id']: e['stats']['total_points'] for e in live_res.get('elements', [])}

    def fmt_dt(p):
        xg = float(p.get('expected_goals') or 0)
        xa = float(p.get('expected_assists') or 0)
        mins = p.get('minutes') or 0
        xgi_90 = round(((xg + xa) / mins) * 90, 2) if mins > 0 else 0.0
        return {
            "id": p['id'],
            "name": p['web_name'],
            "team": teams_short[p['team']],
            "cost": round(p['now_cost'] / 10, 1),
            "pts": p['total_points'],
            "gw_pts": live_pts_map.get(p['id'], 0),
            "form": float(p.get('form') or 0),
            "xgi_90": xgi_90,
            "ict": float(p.get('ict_index') or 0),
            "selected_by": float(p.get('selected_by_percent') or 0)
        }

    # 1. TEAM TOP STARS (for fixture strategy)
    team_stars = {}
    for t_id in teams_short:
        t_players = sorted([e for e in elements if e['team'] == t_id], key=lambda x: x['total_points'], reverse=True)
        team_stars[t_id] = ", ".join([f"{p['web_name']} ({p['total_points']}đ)" for p in t_players[:2]])

    # 2. FIXTURES HEATMAP (20 TEAMS, NEXT 5 GWs)
    print(f"Fetching fixtures for GW{gw_range[0]}-GW{gw_range[-1]}...")
    all_fixtures = []
    for gw in gw_range:
        all_fixtures.extend(fetch_json(f"fixtures/?event={gw}"))

    team_fdr = {t_id: {} for t_id in teams_short}
    for fix in all_fixtures:
        gw = fix['event']
        h_id = fix['team_h']
        a_id = fix['team_a']
        team_fdr[h_id][f"gw{gw}"] = {"opp": f"{teams_short[a_id]} (H)", "diff": fix['team_h_difficulty']}
        team_fdr[a_id][f"gw{gw}"] = {"opp": f"{teams_short[h_id]} (A)", "diff": fix['team_a_difficulty']}

    fixtures_table = []
    for t_id, data in team_fdr.items():
        diffs = [data.get(f"gw{g}", {}).get("diff", 3) for g in gw_range]
        avg_val = round(sum(diffs) / len(diffs), 1) if diffs else 3.0
        if avg_val <= 2.2:
            label = "Cực Mềm"
        elif avg_val <= 2.5:
            label = "Rất Mềm"
        elif avg_val <= 2.8:
            label = "Khá Mềm"
        elif avg_val <= 3.1:
            label = "Cân Não"
        else:
            label = "Xương Xẩu"

        row = {
            "id": t_id,
            "team": teams_name[t_id],
            "short": teams_short[t_id],
            "avg": avg_val,
            "avg_label": f"{avg_val} ({label})",
            "strat": f"Ngôi sao: {team_stars.get(t_id, '-')}",
            "matches": [data.get(f"gw{g}", {"opp": "-", "diff": 3}) for g in gw_range]
        }
        fixtures_table.append(row)

    fixtures_table.sort(key=lambda x: x["avg"])

    # 3. MARKET PLAYERS (TOP 35 SCORERS)
    top_players = sorted(elements, key=lambda x: x['total_points'], reverse=True)[:35]
    market_players = []
    pos_map = {1: "GKP", 2: "DEF", 3: "MID", 4: "FWD"}

    for p in top_players:
        pos_str = pos_map[p['element_type']]
        cost = round(p['now_cost'] / 10, 1)
        pts = p['total_points']
        form = float(p.get('form') or 0)
        xg = float(p.get('expected_goals') or 0)
        xa = float(p.get('expected_assists') or 0)
        mins = p.get('minutes') or 0
        xgi_90 = round(((xg + xa) / mins) * 90, 2) if mins > 0 else 0.0
        val_per_m = round(pts / cost, 2) if cost > 0 else 0.0
        ict = float(p.get('ict_index') or 0)
        selected = float(p.get('selected_by_percent') or 0)

        if pts >= 65:
            tag = "👑 Vua Điểm Số"
        elif xgi_90 >= 0.55 and pos_str in ("MID", "FWD"):
            tag = "🔥 Máy Cày xGI"
        elif val_per_m >= 10.0:
            tag = "💎 Giá Siêu Hời"
        else:
            tag = "⭐ Trụ Cột Ổn Định"

        market_players.append({
            "id": p['id'],
            "name": p['web_name'],
            "team": teams_short[p['team']],
            "pos": pos_str,
            "cost": cost,
            "pts": pts,
            "form": form,
            "xgi_90": xgi_90,
            "ict": ict,
            "value": val_per_m,
            "selected_by": selected,
            "news": p.get('news', ''),
            "tag": tag
        })

    # 4. TRANSFER WATCHDOG (REAL TRANSFERS IN / OUT)
    top_in = sorted(elements, key=lambda x: x.get('transfers_in_event', 0), reverse=True)[:3]
    top_out = sorted(elements, key=lambda x: x.get('transfers_out_event', 0), reverse=True)[:3]

    watchdog = {
        "rising": [
            {
                "name": p['web_name'],
                "team": teams_short[p['team']],
                "cost": round(p['now_cost'] / 10, 1),
                "net_transfers": f"+{p.get('transfers_in_event', 0):,}",
                "pts": p['total_points']
            } for p in top_in
        ],
        "falling": [
            {
                "name": p['web_name'],
                "team": teams_short[p['team']],
                "cost": round(p['now_cost'] / 10, 1),
                "net_transfers": f"-{p.get('transfers_out_event', 0):,}",
                "pts": p['total_points']
            } for p in top_out
        ]
    }

    # 5. DREAM TEAM (OVERALL TURN 1 OPTIMAL 3-4-3)
    gks = sorted([e for e in elements if e['element_type'] == 1], key=lambda x: x['total_points'], reverse=True)
    defs = sorted([e for e in elements if e['element_type'] == 2], key=lambda x: x['total_points'], reverse=True)
    mids = sorted([e for e in elements if e['element_type'] == 3], key=lambda x: x['total_points'], reverse=True)
    fwds = sorted([e for e in elements if e['element_type'] == 4], key=lambda x: x['total_points'], reverse=True)

    dream_team = {
        "gk": fmt_dt(gks[0]),
        "defs": [fmt_dt(d) for d in defs[:3]],
        "mids": [fmt_dt(m) for m in mids[:4]],
        "fwds": [fmt_dt(f) for f in fwds[:3]],
        "bench": [
            {"pos": "GKP", **fmt_dt(gks[1])},
            {"pos": "DEF", **fmt_dt(defs[3])},
            {"pos": "DEF", **fmt_dt(defs[4])},
            {"pos": "FWD", **fmt_dt(fwds[3])}
        ]
    }
    dream_team["total_pts"] = (
        dream_team["gk"]["pts"]
        + sum(x["pts"] for x in dream_team["defs"])
        + sum(x["pts"] for x in dream_team["mids"])
        + sum(x["pts"] for x in dream_team["fwds"])
    )

    # 6. LEAGUE 124+ | NÁT & RANK PROGRESSION
    print("Fetching League 124+ & histories...")
    l124_res = fetch_json(f"leagues-classic/{LEAGUE_124_ID}/standings/")
    l124_standings = []
    l124_squads = {}
    histories = {}
    gw_histories = {}

    for s in l124_res['standings']['results']:
        eid = s['entry']
        hist = fetch_json(f"entry/{eid}/history/")
        picks_res = fetch_json(f"entry/{eid}/event/{current_gw}/picks/")
        
        raw_picks = picks_res.get('picks', [])
        active_chip = picks_res.get('active_chip')
        squad_starting = {'GKP': [], 'DEF': [], 'MID': [], 'FWD': []}
        squad_bench = []
        for pk in raw_picks:
            el = el_map[pk['element']]
            p_pos = pos_map[el['element_type']]
            p_obj = fmt_dt(el)
            p_obj['pos'] = p_pos
            p_obj['is_captain'] = pk['is_captain']
            p_obj['is_vc'] = pk['is_vice_captain']
            p_obj['multiplier'] = pk['multiplier']
            # Effective GW points including multiplier (unless bench)
            p_obj['eff_gw_pts'] = p_obj['gw_pts'] * (pk['multiplier'] if pk['multiplier'] > 0 else 1)
            if pk['position'] <= 11:
                squad_starting[p_pos].append(p_obj)
            else:
                squad_bench.append(p_obj)

        l124_squads[s['entry_name']] = {
            "manager": s['player_name'],
            "gw_pts": s['event_total'],
            "active_chip": active_chip,
            "starting": squad_starting,
            "bench": squad_bench
        }
        raw_chips = hist.get('chips', [])
        chips = [f"{c['name'].upper()}(GW{c['event']})" for c in raw_chips]
        used_chip_keys = {c['name'] for c in raw_chips if c['event'] <= 19}
        
        cur_list = hist.get('current', [])
        gw_totals = {h['event']: h['total_points'] for h in cur_list}
        gw_nets = {h['event']: h['points'] - h['event_transfers_cost'] for h in cur_list}
        histories[eid] = gw_totals
        gw_histories[eid] = gw_nets

        # Calculate Turn 2 points (GW11 - GW19)
        t2_pts = sum((h['points'] - h['event_transfers_cost']) for h in cur_list if 11 <= h['event'] <= 19)
        # Turn 1 stats (GW1 - GW10)
        t1_list = [h for h in cur_list if h['event'] <= 10]
        best_gw_item = max(t1_list, key=lambda x: x['points'] - x['event_transfers_cost']) if t1_list else {'points': 0, 'event': 0, 'event_transfers_cost': 0}
        worst_gw_item = min(t1_list, key=lambda x: x['points'] - x['event_transfers_cost']) if t1_list else {'points': 0, 'event': 0, 'event_transfers_cost': 0}
        bench_wasted = sum(h.get('points_on_bench', 0) for h in cur_list)
        total_hits = sum(h.get('event_transfers_cost', 0) for h in cur_list)
        last_val = round(cur_list[-1].get('value', 1000) / 10, 1) if cur_list else 100.0

        l124_standings.append({
            "entry": eid,
            "rank": s['rank'],
            "team": s['entry_name'],
            "manager": s['player_name'],
            "gw_pts": s['event_total'],
            "total": s['total'],
            "turn2_pts": t2_pts,
            "chips": chips,
            "chips_map": {
                "wc": "wildcard" in used_chip_keys,
                "tc": "3xc" in used_chip_keys,
                "bb": "bboost" in used_chip_keys,
                "fh": "freehit" in used_chip_keys
            },
            "best_gw": best_gw_item['points'] - best_gw_item['event_transfers_cost'],
            "best_gw_num": best_gw_item['event'],
            "worst_gw": worst_gw_item['points'] - worst_gw_item['event_transfers_cost'],
            "worst_gw_num": worst_gw_item['event'],
            "bench_wasted": bench_wasted,
            "total_hits": total_hits,
            "team_value": last_val
        })

    leader_pts = l124_standings[0]['total'] if l124_standings else 0
    last_pts = min(x['total'] for x in l124_standings) if l124_standings else 0

    for item in l124_standings:
        item["gap_leader"] = item["total"] - leader_pts
        item["is_last"] = (item["total"] == last_pts)

    # Turn 1 Superlatives / Awards
    top_gw_king = max(l124_standings, key=lambda x: x['best_gw'])
    worst_gw_king = min(l124_standings, key=lambda x: x['worst_gw'])
    bench_king = max(l124_standings, key=lambda x: x['bench_wasted'])
    hit_king = max(l124_standings, key=lambda x: x['total_hits'])
    richest_club = max(l124_standings, key=lambda x: x['team_value'])

    turn1_awards = {
        "best_gw": {"team": top_gw_king['team'], "manager": top_gw_king['manager'], "val": f"{top_gw_king['best_gw']}đ (GW{top_gw_king['best_gw_num']})"},
        "worst_gw": {"team": worst_gw_king['team'], "manager": worst_gw_king['manager'], "val": f"{worst_gw_king['worst_gw']}đ (GW{worst_gw_king['worst_gw_num']})"},
        "bench_king": {"team": bench_king['team'], "manager": bench_king['manager'], "val": f"{bench_king['bench_wasted']}đ"},
        "hit_king": {"team": hit_king['team'], "manager": hit_king['manager'], "val": f"-{hit_king['total_hits']}đ"},
        "richest": {"team": richest_club['team'], "manager": richest_club['manager'], "val": f"£{richest_club['team_value']}m"}
    }

    # Rank & Points progression for GW1 to current_gw
    rank_prog = {item['team']: [] for item in l124_standings}
    points_prog = {item['team']: [] for item in l124_standings}
    gw_points_prog = {item['team']: [] for item in l124_standings}
    for gw in range(1, current_gw + 1):
        sorted_eids = sorted(histories.keys(), key=lambda eid: histories[eid].get(gw, 0), reverse=True)
        for idx, eid in enumerate(sorted_eids):
            t_name = next(x['team'] for x in l124_standings if x['entry'] == eid)
            rank_prog[t_name].append(idx + 1)
            points_prog[t_name].append(histories[eid].get(gw, 0))
            gw_points_prog[t_name].append(gw_histories[eid].get(gw, 0))

    # 7. LEAGUE IOC_124
    print("Fetching League IOC_124...")
    ioc_res = fetch_json(f"leagues-classic/{LEAGUE_IOC_ID}/standings/")
    ioc_standings = []
    for s in ioc_res['standings']['results']:
        eid = s['entry']
        hist = fetch_json(f"entry/{eid}/history/")
        chips = [f"{c['name'].upper()}(GW{c['event']})" for c in hist.get('chips', [])]
        ioc_standings.append({
            "rank": s['rank'],
            "team": s['entry_name'],
            "manager": s['player_name'],
            "gw_pts": s['event_total'],
            "total": s['total'],
            "chips": chips
        })

    # 8. CAPTAINCY INDEX (FOR NEXT GW)
    # Build top 4 candidates from real active players with upcoming easy fixtures
    team_fdr_next = {row['short']: row['matches'][0]['diff'] for row in fixtures_table}
    team_opp_next = {row['short']: row['matches'][0]['opp'] for row in fixtures_table}
    cap_candidates = [p for p in market_players if p['pos'] in ('MID', 'FWD') and p['pts'] >= 50]
    for p in cap_candidates:
        fdr = team_fdr_next.get(p['team'], 3)
        # Heuristic Captain Index out of 100
        score = round(min(98.0, 50 + (p['xgi_90'] * 25) + (p['form'] * 2.5) + ((5 - fdr) * 4)), 1)
        p['cap_index'] = score
        p['next_opp'] = team_opp_next.get(p['team'], '-')
    cap_candidates.sort(key=lambda x: x['cap_index'], reverse=True)
    captaincy = cap_candidates[:4]

    # 9. MY PRIVATE INTEL (FOR VIP VAULT ONLY)
    print("Fetching Can VIP private picks...")
    my_entry = fetch_json(f"entry/{MY_TEAM_ID}/")
    my_picks_res = fetch_json(f"entry/{MY_TEAM_ID}/event/{current_gw}/picks/")
    my_hist = fetch_json(f"entry/{MY_TEAM_ID}/history/")
    
    used_chips = [c['name'] for c in my_hist.get('chips', [])]
    phase1_chips = [
        {"name": "Wildcard 1", "key": "wildcard", "used": "wildcard" in used_chips},
        {"name": "Triple Captain 1", "key": "3xc", "used": "3xc" in used_chips},
        {"name": "Bench Boost 1", "key": "bboost", "used": "bboost" in used_chips},
        {"name": "Free Hit 1", "key": "freehit", "used": "freehit" in used_chips}
    ]

    my_squad = []
    for pick in my_picks_res.get('picks', []):
        el = el_map[pick['element']]
        my_squad.append({
            "pos_slot": pick['position'],
            "pos": pos_map[el['element_type']],
            "name": el['web_name'],
            "team": teams_short[el['team']],
            "cost": round(el['now_cost'] / 10, 1),
            "pts": el['total_points'],
            "is_captain": pick['is_captain'],
            "is_vc": pick['is_vice_captain'],
            "is_bench": pick['position'] > 11
        })

    # Calculate bank & FT from entry history
    last_gw_hist = my_hist.get('current', [])[-1] if my_hist.get('current') else {}
    bank_itb = round(last_gw_hist.get('bank', 28) / 10, 1)

    can_vip_entry = next((x for x in l124_standings if x['entry'] == MY_TEAM_ID), None)
    vip_gap = can_vip_entry['gap_leader'] if can_vip_entry else -27

    vip_vault = {
        "team_name": my_entry.get('name', 'Cận VIP'),
        "manager": f"{my_entry.get('player_first_name', 'Trung')} {my_entry.get('player_last_name', 'TíT')}",
        "total_points": my_entry.get('summary_overall_points', 578),
        "overall_rank": my_entry.get('summary_overall_rank', 3985485),
        "gap_to_leader": vip_gap,
        "leader_name": l124_standings[0]['team'] if l124_standings else "Bao Bui",
        "leader_pts": leader_pts,
        "bank_itb": bank_itb,
        "phase1_chips": phase1_chips,
        "squad": my_squad
    }

    output = {
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "current_gw": current_gw,
        "next_gw": next_gw,
        "next_deadline": next_deadline,
        "gw_headers": [f"GW{g}" for g in gw_range],
        "league_124": l124_standings,
        "league_124_squads": l124_squads,
        "turn1_awards": turn1_awards,
        "league_ioc": ioc_standings,
        "rank_progression": rank_prog,
        "points_progression": points_prog,
        "gw_points_progression": gw_points_prog,
        "fixtures": fixtures_table,
        "market_players": market_players,
        "watchdog": watchdog,
        "dream_team": dream_team,
        "captaincy": captaincy,
        "vip_vault": vip_vault
    }

    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"SUCCESS: Generated {out_path} ({len(fixtures_table)} teams, {len(market_players)} players)")

if __name__ == "__main__":
    main()
