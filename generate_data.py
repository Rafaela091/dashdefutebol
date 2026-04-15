import json
from pathlib import Path

import pandas as pd


def pct(part, total):
    if not total:
        return 0.0
    return round((part / total) * 100, 1)


def safe_div(a, b):
    if not b:
        return 0.0
    return a / b


def main():
    root = Path(__file__).resolve().parent
    data_dir = root / "data"

    fact = pd.read_parquet(data_dir / "fato_eventos.parquet")
    dim_clube = pd.read_parquet(data_dir / "dim_clube.parquet")
    dim_data = pd.read_parquet(data_dir / "dim_data.parquet")
    dim_atleta = pd.read_parquet(data_dir / "dim_atleta.parquet")
    dim_tipo_gol = pd.read_parquet(data_dir / "dim_tipo_gol.parquet")
    dim_cartao = pd.read_parquet(data_dir / "dim_cartao.parquet")

    fact = fact.reset_index(drop=True)
    fact = fact.merge(dim_clube, on="sk_clube", how="left")
    fact = fact.merge(dim_data[["sk_data", "ano"]], on="sk_data", how="left")

    goals = fact[fact["tipo_evento"] == "GOL"].copy()
    goals = goals.merge(dim_tipo_gol, on="sk_tipo_gol", how="left")

    cards = fact[fact["tipo_evento"] == "CARTAO"].copy()
    cards = cards.merge(dim_cartao, on="sk_cartao", how="left")

    team_goals = (
        goals.groupby(["partida_id", "clube"], as_index=False)["qtd_gol"].sum().rename(columns={"qtd_gol": "goals"})
    )

    yellow = (
        cards[cards["cartao"] == "Amarelo"]
        .groupby(["partida_id", "clube"], as_index=False)["qtd_cartao"]
        .sum()
        .rename(columns={"qtd_cartao": "yellow"})
    )
    red = (
        cards[cards["cartao"] == "Vermelho"]
        .groupby(["partida_id", "clube"], as_index=False)["qtd_cartao"]
        .sum()
        .rename(columns={"qtd_cartao": "red"})
    )

    # Ordem de clube por partida no fato_eventos e usada como proxy de mandante/visitante.
    team_order = (
        fact.groupby("partida_id")["clube"]
        .apply(lambda s: list(dict.fromkeys([x for x in s.tolist() if pd.notna(x)])))
        .reset_index(name="teams")
    )
    team_order = team_order[team_order["teams"].apply(len) >= 2].copy()
    team_order["home_team"] = team_order["teams"].apply(lambda t: t[0])
    team_order["away_team"] = team_order["teams"].apply(lambda t: t[1])

    season_by_match = fact.groupby("partida_id", as_index=False)["ano"].min().rename(columns={"ano": "season"})

    match_df = team_order[["partida_id", "home_team", "away_team"]].merge(season_by_match, on="partida_id", how="left")

    home_goals = team_goals.rename(columns={"clube": "home_team", "goals": "home_goals"})
    away_goals = team_goals.rename(columns={"clube": "away_team", "goals": "away_goals"})

    match_df = match_df.merge(home_goals[["partida_id", "home_team", "home_goals"]], on=["partida_id", "home_team"], how="left")
    match_df = match_df.merge(away_goals[["partida_id", "away_team", "away_goals"]], on=["partida_id", "away_team"], how="left")

    match_df["home_goals"] = match_df["home_goals"].fillna(0).astype(int)
    match_df["away_goals"] = match_df["away_goals"].fillna(0).astype(int)

    match_df["home_win"] = (match_df["home_goals"] > match_df["away_goals"]).astype(int)
    match_df["away_win"] = (match_df["away_goals"] > match_df["home_goals"]).astype(int)
    match_df["draw"] = (match_df["home_goals"] == match_df["away_goals"]).astype(int)

    total_matches = int(len(match_df))
    total_goals = int((match_df["home_goals"] + match_df["away_goals"]).sum())

    home_wins = int(match_df["home_win"].sum())
    away_wins = int(match_df["away_win"].sum())
    draws = int(match_df["draw"].sum())

    avg_home_goals = round(safe_div(match_df["home_goals"].sum(), total_matches), 2)
    avg_away_goals = round(safe_div(match_df["away_goals"].sum(), total_matches), 2)

    home_adv_overall = {
        "hw": home_wins,
        "aw": away_wins,
        "dr": draws,
        "hw_pct": pct(home_wins, total_matches),
        "aw_pct": pct(away_wins, total_matches),
        "dr_pct": pct(draws, total_matches),
        "avg_hg": avg_home_goals,
        "avg_ag": avg_away_goals,
    }

    home_side = pd.DataFrame(
        {
            "team": match_df["home_team"],
            "is_home": 1,
            "win": match_df["home_win"],
            "gf": match_df["home_goals"],
            "ga": match_df["away_goals"],
        }
    )
    away_side = pd.DataFrame(
        {
            "team": match_df["away_team"],
            "is_home": 0,
            "win": match_df["away_win"],
            "gf": match_df["away_goals"],
            "ga": match_df["home_goals"],
        }
    )
    sides = pd.concat([home_side, away_side], ignore_index=True)

    home_stats = (
        sides[sides["is_home"] == 1]
        .groupby("team", as_index=False)
        .agg(home_matches=("team", "size"), home_wins=("win", "sum"), home_gf=("gf", "sum"))
    )
    away_stats = (
        sides[sides["is_home"] == 0]
        .groupby("team", as_index=False)
        .agg(away_matches=("team", "size"), away_wins=("win", "sum"), away_gf=("gf", "sum"))
    )

    by_team = home_stats.merge(away_stats, on="team", how="outer").fillna(0)
    by_team["home_win_pct"] = by_team.apply(lambda r: round(safe_div(r["home_wins"], r["home_matches"]) * 100, 1), axis=1)
    by_team["away_win_pct"] = by_team.apply(lambda r: round(safe_div(r["away_wins"], r["away_matches"]) * 100, 1), axis=1)
    by_team["home_avg_gf"] = by_team.apply(lambda r: round(safe_div(r["home_gf"], r["home_matches"]), 2), axis=1)
    by_team["away_avg_gf"] = by_team.apply(lambda r: round(safe_div(r["away_gf"], r["away_matches"]), 2), axis=1)
    home_adv_by_team = (
        by_team.sort_values("home_win_pct", ascending=False)
        .head(15)[["team", "home_win_pct", "away_win_pct", "home_avg_gf", "away_avg_gf"]]
        .rename(columns={"team": "team"})
        .to_dict(orient="records")
    )

    home_table = match_df[["home_team", "home_goals", "away_goals", "home_win", "away_win", "draw"]].rename(
        columns={
            "home_team": "team",
            "home_goals": "gf",
            "away_goals": "ga",
            "home_win": "win",
        }
    )[["team", "gf", "ga", "win", "draw"]]
    away_table = match_df[["away_team", "away_goals", "home_goals", "away_win", "home_win", "draw"]].rename(
        columns={
            "away_team": "team",
            "away_goals": "gf",
            "home_goals": "ga",
            "away_win": "win",
        }
    )[["team", "gf", "ga", "win", "draw"]]

    table = pd.concat([home_table, away_table], ignore_index=True)
    hist = (
        table.groupby("team", as_index=False)
        .agg(matches=("team", "size"), wins=("win", "sum"), draws=("draw", "sum"), gf=("gf", "sum"), ga=("ga", "sum"))
    )
    hist["losses"] = hist["matches"] - hist["wins"] - hist["draws"]
    hist["gd"] = hist["gf"] - hist["ga"]
    hist["pts"] = hist["wins"] * 3 + hist["draws"]
    hist["win_pct"] = (hist["pts"] / (hist["matches"] * 3) * 100).round(1)
    hist = hist.sort_values(["pts", "wins", "gd"], ascending=False)

    historical_perf = hist[["team", "wins", "draws", "losses", "gf", "ga", "gd", "pts", "win_pct"]].to_dict(orient="records")

    top_goal_teams = (
        hist[["team", "gf", "matches"]]
        .rename(columns={"gf": "goals"})
        .assign(avg=lambda d: (d["goals"] / d["matches"]).round(2))
        .sort_values("goals", ascending=False)
        .head(12)
        .to_dict(orient="records")
    )

    team_cards = (
        cards.groupby(["clube", "cartao"], as_index=False)["qtd_cartao"]
        .sum()
        .pivot(index="clube", columns="cartao", values="qtd_cartao")
        .fillna(0)
        .reset_index()
        .rename(columns={"clube": "team", "Amarelo": "yellow", "Vermelho": "red"})
    )

    if "yellow" not in team_cards.columns:
        team_cards["yellow"] = 0
    if "red" not in team_cards.columns:
        team_cards["red"] = 0

    team_cards = team_cards.merge(hist[["team", "matches"]], on="team", how="left").fillna({"matches": 0})
    team_cards["total"] = team_cards["yellow"] + team_cards["red"]
    team_cards["per_match"] = team_cards.apply(lambda r: round(safe_div(r["total"], r["matches"]), 2), axis=1)

    most_violent = (
        team_cards.sort_values(["per_match", "total"], ascending=False)
        .head(12)[["team", "yellow", "red", "total", "matches", "per_match"]]
        .to_dict(orient="records")
    )

    goals_players = (
        goals.merge(dim_atleta, on="sk_atleta", how="left")
        .groupby(["atleta", "clube"], as_index=False)
        .agg(goals=("qtd_gol", "sum"), matches=("partida_id", "nunique"))
    )

    cards_players = (
        cards.merge(dim_atleta, on="sk_atleta", how="left")
        .groupby(["atleta", "cartao"], as_index=False)["qtd_cartao"]
        .sum()
        .pivot(index="atleta", columns="cartao", values="qtd_cartao")
        .fillna(0)
        .reset_index()
        .rename(columns={"Amarelo": "yellow", "Vermelho": "red"})
    )

    if "yellow" not in cards_players.columns:
        cards_players["yellow"] = 0
    if "red" not in cards_players.columns:
        cards_players["red"] = 0

    players = goals_players.merge(cards_players[["atleta", "yellow", "red"]], on="atleta", how="left").fillna(0)
    players["avg_goal"] = players.apply(lambda r: round(safe_div(r["goals"], r["matches"]), 2), axis=1)
    players["assists"] = 0
    players = players.sort_values("goals", ascending=False).head(8)
    players = players.rename(columns={"atleta": "name", "clube": "team"})
    players = players[["name", "team", "goals", "assists", "matches", "yellow", "red", "avg_goal"]].to_dict(orient="records")

    goals_by_season = (
        match_df.groupby("season", as_index=False)
        .agg(home=("home_goals", "sum"), away=("away_goals", "sum"))
        .sort_values("season")
        .rename(columns={"season": "season"})
        .to_dict(orient="records")
    )

    gt = goals.groupby("tipo_de_gol", as_index=False)["qtd_gol"].sum()
    goal_types = {row["tipo_de_gol"]: int(row["qtd_gol"]) for _, row in gt.iterrows()}

    summary = {
        "total_matches": total_matches,
        "total_goals": total_goals,
        "seasons": int(match_df["season"].nunique()),
        "clubs": int(pd.unique(pd.concat([match_df["home_team"], match_df["away_team"]])).size),
        "home_win_pct": home_adv_overall["hw_pct"],
        "away_win_pct": home_adv_overall["aw_pct"],
        "draw_pct": home_adv_overall["dr_pct"],
        "avg_home_goals": avg_home_goals,
        "avg_away_goals": avg_away_goals,
        "avg_goals_per_match": round(safe_div(total_goals, total_matches), 2),
    }

    data = {
        "summary": summary,
        "home_adv_overall": home_adv_overall,
        "home_adv_by_team": home_adv_by_team,
        "historical_perf": historical_perf,
        "top_goal_teams": top_goal_teams,
        "most_violent": most_violent,
        "players": players,
        "goals_by_season": goals_by_season,
        "goal_types": goal_types,
    }

    out_path = root / "dados_reais.json"
    out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    # Fallback para abrir o dashboard via file:// sem CORS no fetch.
    js_out_path = root / "dados_reais.js"
    js_payload = "window.__DADOS_REAIS__ = " + json.dumps(data, ensure_ascii=False) + ";\n"
    js_out_path.write_text(js_payload, encoding="utf-8")

    print(f"Arquivo gerado: {out_path}")
    print(f"Arquivo gerado: {js_out_path}")
    print(f"Partidas: {total_matches} | Gols: {total_goals} | Clubes: {summary['clubs']} | Temporadas: {summary['seasons']}")


if __name__ == "__main__":
    main()
