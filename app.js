let DATA = null;

const rendered = {};
let histData = [];
let histChartsPts = null;
let histChartsWpct = null;
let currentHistField = "pts";
let playerChart = null;
let radarChart = null;
let filteredPlayers = [];
let filtersInitialized = false;

const HIST_FIELD_META = {
  pts: {
    label: "Pontos Acumulados",
    subtitle: "Total no periodo",
    secondaryField: "win_pct",
    secondaryLabel: "Aproveitamento Geral (%)",
    secondarySubtitle: "% de pontos conquistados",
    tickSuffix: ""
  },
  wins: {
    label: "Vitorias Acumuladas",
    subtitle: "Total no periodo",
    secondaryField: "pts",
    secondaryLabel: "Pontos Acumulados",
    secondarySubtitle: "Comparativo do Top 10 filtrado",
    tickSuffix: ""
  },
  gf: {
    label: "Gols Feitos Acumulados",
    subtitle: "Total no periodo",
    secondaryField: "pts",
    secondaryLabel: "Pontos Acumulados",
    secondarySubtitle: "Comparativo do Top 10 filtrado",
    tickSuffix: ""
  },
  gd: {
    label: "Saldo de Gols Acumulado",
    subtitle: "Total no periodo",
    secondaryField: "pts",
    secondaryLabel: "Pontos Acumulados",
    secondarySubtitle: "Comparativo do Top 10 filtrado",
    tickSuffix: ""
  },
  win_pct: {
    label: "Aproveitamento (%)",
    subtitle: "Percentual de pontos conquistados",
    secondaryField: "pts",
    secondaryLabel: "Pontos Acumulados",
    secondarySubtitle: "Comparativo do Top 10 filtrado",
    tickSuffix: "%"
  }
};

function formatPercent(value) {
  if (value == null || Number.isNaN(value)) return "-";
  return `${Number(value).toFixed(1)}%`;
}

function normalizeNumber(value) {
  if (value == null || Number.isNaN(value)) return null;
  return value;
}

function fmtInt(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
}

function fmtDec(value, digits = 2) {
  return Number(value || 0).toFixed(digits).replace(".", ",");
}

function seasonRangeText() {
  const seasons = (DATA.goals_by_season || []).map((s) => Number(s.season)).filter((x) => !Number.isNaN(x));
  if (!seasons.length) return "periodo analisado";
  return `${Math.min(...seasons)}-${Math.max(...seasons)}`;
}

function showSection(id) {
  document.querySelectorAll(".section").forEach((s) => s.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  const activeNav = document.querySelector(`.nav-item[data-section="${id}"]`);
  if (activeNav) activeNav.classList.add("active");
  renderSection(id);
}

function renderSection(id) {
  if (id !== "hist_perf" && rendered[id]) return;
  rendered[id] = true;

  if (id === "overview") renderOverview();
  else if (id === "home_adv") renderHomeAdv();
  else if (id === "hist_perf") renderHistPerf();
  else if (id === "goals") renderGoals();
  else if (id === "cards") renderCards();
  else if (id === "players") renderPlayers();
}

function updateStaticCards() {
  const summary = DATA.summary;
  const seasonRange = seasonRangeText();

  const logoSub = document.querySelector(".logo p");
  if (logoSub) logoSub.textContent = `Serie A - ${seasonRange}`;

  const overviewHeaderSub = document.querySelector("#overview .page-header p");
  if (overviewHeaderSub) {
    overviewHeaderSub.textContent = `Analise de ${fmtInt(summary.seasons)} temporadas (${seasonRange}) - ${fmtInt(summary.clubs)} clubes - ${fmtInt(summary.total_matches)} partidas`;
  }

  const overviewSeasonSubtitle = document.querySelector("#overview .chart-card .chart-subtitle");
  if (overviewSeasonSubtitle) overviewSeasonSubtitle.textContent = `Casa vs Visitante - ${seasonRange}`;

  const histHeaderSub = document.querySelector("#hist_perf .page-header p");
  if (histHeaderSub) histHeaderSub.textContent = `Ranking consolidado de ${fmtInt(summary.seasons)} temporadas da Serie A (${seasonRange})`;

  const goalsHeaderSub = document.querySelector("#goals .page-header p");
  if (goalsHeaderSub) goalsHeaderSub.textContent = `Ranking ofensivo dos clubes no periodo ${seasonRange}`;

  const cardsHeaderSub = document.querySelector("#cards .page-header p");
  if (cardsHeaderSub) cardsHeaderSub.textContent = `Cartoes amarelos e vermelhos acumulados - periodo ${seasonRange}`;

  const overviewCards = document.querySelectorAll("#overview .kpi-card");
  if (overviewCards.length >= 4) {
    overviewCards[0].querySelector(".kpi-value").textContent = fmtInt(summary.total_matches);
    overviewCards[0].querySelector(".kpi-sub").textContent = `${fmtInt(summary.seasons)} temporadas analisadas`;

    overviewCards[1].querySelector(".kpi-value").textContent = fmtInt(summary.total_goals);
    overviewCards[1].querySelector(".kpi-sub").textContent = `Media de ${fmtDec(summary.avg_goals_per_match, 2)} gols/jogo`;

    overviewCards[2].querySelector(".kpi-value").textContent = formatPercent(summary.home_win_pct);
    overviewCards[2].querySelector(".kpi-sub").textContent = `vs ${formatPercent(summary.away_win_pct)} visitante`;

    overviewCards[3].querySelector(".kpi-value").textContent = fmtInt(summary.clubs);
    overviewCards[3].querySelector(".kpi-sub").textContent = "Clubes com dados no periodo";
  }

  const homeCards = document.querySelectorAll("#home_adv .kpi-card");
  if (homeCards.length >= 4) {
    const overall = DATA.home_adv_overall;
    homeCards[0].querySelector(".kpi-value").textContent = formatPercent(overall.hw_pct);
    homeCards[0].querySelector(".kpi-sub").textContent = `${fmtInt(overall.hw)} vitorias`;

    homeCards[1].querySelector(".kpi-value").textContent = formatPercent(overall.aw_pct);
    homeCards[1].querySelector(".kpi-sub").textContent = `${fmtInt(overall.aw)} vitorias`;

    homeCards[2].querySelector(".kpi-value").textContent = fmtDec(overall.avg_hg, 2);
    homeCards[2].querySelector(".kpi-sub").textContent = "por partida";

    homeCards[3].querySelector(".kpi-value").textContent = fmtDec(overall.avg_ag, 2);
    homeCards[3].querySelector(".kpi-sub").textContent = "por partida";
  }

  const goalCards = document.querySelectorAll("#goals .kpi-card");
  const topGoal = DATA.top_goal_teams[0];
  if (goalCards.length >= 4 && topGoal) {
    goalCards[0].querySelector(".kpi-value").textContent = topGoal.team;
    goalCards[0].querySelector(".kpi-sub").textContent = `${fmtInt(topGoal.goals)} gols no periodo`;

    goalCards[1].querySelector(".kpi-value").textContent = fmtDec(topGoal.avg, 2);
    goalCards[1].querySelector(".kpi-sub").textContent = `${topGoal.team} (gols/partida)`;

    goalCards[2].querySelector(".kpi-value").textContent = fmtInt(DATA.summary.total_goals);
    goalCards[2].querySelector(".kpi-sub").textContent = `${fmtInt(DATA.summary.seasons)} temporadas`;

    goalCards[3].querySelector(".kpi-value").textContent = fmtDec(DATA.summary.avg_goals_per_match, 2);
    goalCards[3].querySelector(".kpi-sub").textContent = "gols por jogo";
  }

  const cardCards = document.querySelectorAll("#cards .kpi-card");
  const violent = DATA.most_violent[0];
  if (cardCards.length >= 4 && violent) {
    const mostTotal = [...DATA.most_violent].sort((a, b) => b.total - a.total)[0] || violent;
    const mostRed = [...DATA.most_violent].sort((a, b) => b.red - a.red)[0] || violent;
    const leastAgg = [...DATA.most_violent].sort((a, b) => a.per_match - b.per_match)[0] || violent;

    cardCards[0].querySelector(".kpi-value").textContent = mostTotal.team;
    cardCards[0].querySelector(".kpi-sub").textContent = `${fmtInt(mostTotal.yellow)} amarelos + ${fmtInt(mostTotal.red)} vermelhos`;

    cardCards[1].querySelector(".kpi-value").textContent = violent.team;
    cardCards[1].querySelector(".kpi-sub").textContent = `${fmtDec(violent.per_match, 2)} cartoes por jogo`;

    cardCards[2].querySelector(".kpi-value").textContent = mostRed.team;
    cardCards[2].querySelector(".kpi-sub").textContent = `${fmtInt(mostRed.red)} expulsoes`;

    cardCards[3].querySelector(".kpi-value").textContent = leastAgg.team;
    cardCards[3].querySelector(".kpi-sub").textContent = "Menor indice (entre top 12)";
  }

  const footer = document.querySelector(".sidebar-footer p:last-child");
  if (footer) {
    footer.textContent = `${fmtInt(DATA.summary.total_matches)} partidas analisadas`;
  }
}

function renderOverviewGoalTypeBars() {
  const scoreWraps = document.querySelectorAll("#overview .score-bar-wrap");
  const labels = ["Normal", "Penalty", "Gol Contra"];
  const values = labels.map((k) => Number(DATA.goal_types[k] || 0));
  const total = values.reduce((acc, x) => acc + x, 0);

  scoreWraps.forEach((wrap, idx) => {
    const value = values[idx] || 0;
    const pct = total ? (value / total) * 100 : 0;
    const labelSpan = wrap.querySelector(".score-bar-label span:first-child");
    const valueSpan = wrap.querySelector(".score-bar-label span:last-child");
    const fill = wrap.querySelector(".score-bar-fill");

    if (labelSpan) labelSpan.textContent = labels[idx];
    if (valueSpan) valueSpan.textContent = fmtInt(value);
    if (fill) fill.style.width = `${pct.toFixed(1)}%`;
  });
}

function renderOverview() {
  const seasons = DATA.goals_by_season;
  const summary = DATA.summary;

  new Chart(document.getElementById("goalsSeasonChart"), {
    type: "bar",
    data: {
      labels: seasons.map((s) => s.season),
      datasets: [
        { label: "Casa", data: seasons.map((s) => s.home), backgroundColor: "rgba(29,185,84,0.8)", borderSkipped: false },
        { label: "Visitante", data: seasons.map((s) => s.away), backgroundColor: "rgba(58,139,208,0.7)", borderSkipped: false }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { stacked: true, ticks: { color: "#8b949e", font: { size: 11 } }, grid: { display: false } },
        y: { stacked: true, ticks: { color: "#8b949e", font: { size: 11 } }, grid: { color: "rgba(255,255,255,0.05)" } }
      }
    }
  });

  new Chart(document.getElementById("resultDonut"), {
    type: "doughnut",
    data: {
      labels: ["Casa", "Empate", "Visitante"],
      datasets: [{ data: [summary.home_win_pct, summary.draw_pct, summary.away_win_pct], backgroundColor: ["#1db954", "#f0b429", "#3a8bd0"], borderWidth: 0 }]
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: "70%", plugins: { legend: { display: false } } }
  });

  const donutLegendItems = document.querySelectorAll("#overview .donut-legend > div");
  if (donutLegendItems.length >= 3) {
    donutLegendItems[0].querySelector("div:first-child").textContent = formatPercent(summary.home_win_pct);
    donutLegendItems[1].querySelector("div:first-child").textContent = formatPercent(summary.draw_pct);
    donutLegendItems[2].querySelector("div:first-child").textContent = formatPercent(summary.away_win_pct);
  }

  const perf = DATA.historical_perf.slice(0, 10);
  new Chart(document.getElementById("histPtsChart"), {
    type: "bar",
    data: {
      labels: perf.map((t) => t.team),
      datasets: [{ label: "Pontos", data: perf.map((t) => t.pts), backgroundColor: perf.map((_, i) => (i === 0 ? "#1db954" : "rgba(58,139,208,0.7)")), borderSkipped: false, borderRadius: 4 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#8b949e", font: { size: 11 }, maxRotation: 30 }, grid: { display: false } },
        y: { ticks: { color: "#8b949e" }, grid: { color: "rgba(255,255,255,0.05)" } }
      }
    }
  });

  const goalTypeLabels = ["Normal", "Penalty", "Gol Contra"];
  new Chart(document.getElementById("goalTypeChart"), {
    type: "doughnut",
    data: {
      labels: ["Normal", "Penalti", "Gol Contra"],
      datasets: [{ data: goalTypeLabels.map((k) => Number(DATA.goal_types[k] || 0)), backgroundColor: ["#1db954", "#f0b429", "#e05252"], borderWidth: 0 }]
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: "65%", plugins: { legend: { display: false } } }
  });

  renderOverviewGoalTypeBars();
}

function renderHomeAdv() {
  const overall = DATA.home_adv_overall;
  const teams = DATA.home_adv_by_team;
  const labels = teams.map((t) => t.team);

  new Chart(document.getElementById("homeAdvChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Casa", data: teams.map((t) => t.home_win_pct), backgroundColor: "rgba(29,185,84,0.85)", borderSkipped: false, borderRadius: 3 },
        { label: "Visitante", data: teams.map((t) => normalizeNumber(t.away_win_pct)), backgroundColor: "rgba(58,139,208,0.75)", borderSkipped: false, borderRadius: 3 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#8b949e", callback: (v) => `${v}%` }, grid: { color: "rgba(255,255,255,0.05)" } },
        y: { ticks: { color: "#8b949e", font: { size: 11 } }, grid: { display: false } }
      }
    }
  });

  new Chart(document.getElementById("homeGoalsChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Casa", data: teams.map((t) => t.home_avg_gf), backgroundColor: "rgba(240,180,41,0.85)", borderSkipped: false, borderRadius: 3 },
        { label: "Visitante", data: teams.map((t) => normalizeNumber(t.away_avg_gf)), backgroundColor: "rgba(224,82,82,0.7)", borderSkipped: false, borderRadius: 3 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#8b949e" }, grid: { color: "rgba(255,255,255,0.05)" } },
        y: { ticks: { color: "#8b949e", font: { size: 11 } }, grid: { display: false } }
      }
    }
  });

  const tbody = document.getElementById("homeAdvTable");
  tbody.innerHTML = "";

  const rows = [
    { label: "Vitorias", home: overall.hw, away: overall.aw, diff: overall.hw - overall.aw },
    { label: "Empates", home: overall.dr, away: overall.dr, diff: 0 },
    { label: "Win Rate (%)", home: overall.hw_pct, away: overall.aw_pct, diff: overall.hw_pct - overall.aw_pct },
    { label: "Media Gols/Jogo", home: overall.avg_hg, away: overall.avg_ag, diff: overall.avg_hg - overall.avg_ag }
  ];

  rows.forEach((row) => {
    const isPercent = row.label.includes("%");
    const isAvg = row.label.includes("Media");
    let homeVal = row.home;
    let awayVal = row.away;
    let diffVal = row.diff;

    if (isPercent) {
      homeVal = `${Number(homeVal).toFixed(1)}%`;
      awayVal = `${Number(awayVal).toFixed(1)}%`;
      diffVal = `${Number(diffVal).toFixed(1)}pp`;
    } else if (isAvg) {
      homeVal = Number(homeVal).toFixed(2);
      awayVal = Number(awayVal).toFixed(2);
      diffVal = Number(diffVal).toFixed(2);
    }

    const diffColor = row.diff > 0 ? "var(--green)" : row.diff < 0 ? "var(--red)" : "var(--text2)";
    const widthPct = Math.min(100, Math.abs(row.diff) * 5);
    tbody.innerHTML += `<tr>
      <td class="team-name">${row.label}</td>
      <td class="num" style="color:var(--green);font-weight:700">${homeVal}</td>
      <td class="num" style="color:var(--blue)">${awayVal}</td>
      <td class="num" style="color:${diffColor};font-weight:700">${row.diff > 0 ? "+" : ""}${diffVal}</td>
      <td><div class="mini-bar"><div class="mini-bar-fill" style="width:${widthPct.toFixed(0)}%;background:${row.diff > 0 ? "var(--green)" : "var(--red)"}"></div></div></td>
    </tr>`;
  });
}

function getMatchesCount(team) {
  return (team.wins || 0) + (team.draws || 0) + (team.losses || 0);
}

function getHistMetricValue(team, field) {
  const value = Number(team[field] || 0);
  if (field === "win_pct") return value;
  return value;
}

function formatHistTick(field, value) {
  if (field === "win_pct") return `${value}%`;
  return Number(value).toFixed(0);
}

function getBarColorByField(field, value, index) {
  if (field === "win_pct") {
    if (value > 50) return "rgba(29,185,84,0.82)";
    if (value > 38) return "rgba(240,180,41,0.82)";
    return "rgba(224,82,82,0.75)";
  }

  if (field === "gd") {
    if (value > 0) return `rgba(29,185,84,${Math.max(0.35, 0.9 - index * 0.05)})`;
    if (value === 0) return "rgba(139,148,158,0.65)";
    return `rgba(224,82,82,${Math.max(0.35, 0.85 - index * 0.05)})`;
  }

  return `rgba(29,185,84,${Math.max(0.35, 1 - index * 0.07)})`;
}

function renderHistPerf() {
  const metric = HIST_FIELD_META[currentHistField] || HIST_FIELD_META.pts;
  const top10 = histData.slice(0, 10);
  const primaryValues = top10.map((t) => getHistMetricValue(t, currentHistField));
  const secondaryValues = top10.map((t) => getHistMetricValue(t, metric.secondaryField));

  document.getElementById("histPrimaryTitle").textContent = `${metric.label} - Top 10`;
  document.getElementById("histPrimarySubtitle").textContent = metric.subtitle;
  document.getElementById("histSecondaryTitle").textContent = metric.secondaryLabel;
  document.getElementById("histSecondarySubtitle").textContent = metric.secondarySubtitle;

  const canvasPts = document.getElementById("histPtsChart2");
  const canvasWpct = document.getElementById("histWinPctChart");

  if (histChartsPts) histChartsPts.destroy();
  if (histChartsWpct) histChartsWpct.destroy();

  histChartsPts = new Chart(canvasPts, {
    type: "bar",
    data: {
      labels: top10.map((t) => t.team),
      datasets: [{ label: metric.label, data: primaryValues, backgroundColor: primaryValues.map((v, i) => getBarColorByField(currentHistField, v, i)), borderSkipped: false, borderRadius: 4 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => (metric.tickSuffix ? `${context.raw.toFixed(1)}%` : `${context.raw.toFixed(0)}`)
          }
        }
      },
      scales: {
        x: { ticks: { color: "#8b949e", font: { size: 11 }, maxRotation: 35 }, grid: { display: false } },
        y: { ticks: { color: "#8b949e", callback: (value) => formatHistTick(currentHistField, value) }, grid: { color: "rgba(255,255,255,0.05)" } }
      }
    }
  });

  histChartsWpct = new Chart(canvasWpct, {
    type: "bar",
    data: {
      labels: top10.map((t) => t.team),
      datasets: [{ label: metric.secondaryLabel, data: secondaryValues, backgroundColor: secondaryValues.map((v, i) => getBarColorByField(metric.secondaryField, v, i)), borderSkipped: false, borderRadius: 4 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => (metric.secondaryField === "win_pct" ? `${context.raw.toFixed(1)}%` : `${context.raw.toFixed(0)}`)
          }
        }
      },
      scales: {
        x: { ticks: { color: "#8b949e", font: { size: 11 }, maxRotation: 35 }, grid: { display: false } },
        y: { ticks: { color: "#8b949e", callback: (value) => formatHistTick(metric.secondaryField, value) }, grid: { color: "rgba(255,255,255,0.05)" } }
      }
    }
  });

  renderHistTable();
}

function renderHistTable() {
  const tbody = document.getElementById("histTable");
  tbody.innerHTML = "";

  histData.forEach((t, i) => {
    const j = t.wins + t.draws + t.losses;
    const gdColor = t.gd > 0 ? "var(--green)" : t.gd < 0 ? "var(--red)" : "var(--text2)";
    const wPctColor = t.win_pct > 50 ? "var(--green)" : t.win_pct > 38 ? "var(--yellow)" : "var(--red)";

    tbody.innerHTML += `<tr>
      <td class="rank">${i + 1}</td>
      <td class="team-name">${t.team}</td>
      <td class="num" style="font-weight:700">${fmtInt(t.pts)}</td>
      <td class="num">${fmtInt(j)}</td>
      <td class="num" style="color:var(--green)">${fmtInt(t.wins)}</td>
      <td class="num" style="color:var(--yellow)">${fmtInt(t.draws)}</td>
      <td class="num" style="color:var(--red)">${fmtInt(t.losses)}</td>
      <td class="num">${fmtInt(t.gf)}</td>
      <td class="num">${fmtInt(t.ga)}</td>
      <td class="num" style="color:${gdColor}">${t.gd > 0 ? "+" : ""}${fmtInt(t.gd)}</td>
      <td class="num" style="color:${wPctColor}">${Number(t.win_pct).toFixed(1)}%</td>
    </tr>`;
  });
}

function sortHistTable(field, btn) {
  document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  currentHistField = field;
  histData.sort((a, b) => getHistMetricValue(b, field) - getHistMetricValue(a, field));
  renderHistPerf();
}

function renderGoals() {
  const teams = DATA.top_goal_teams;

  new Chart(document.getElementById("goalsRankChart"), {
    type: "bar",
    data: {
      labels: teams.map((t) => t.team),
      datasets: [{ label: "Gols", data: teams.map((t) => t.goals), backgroundColor: teams.map((_, i) => `rgba(29,185,84,${Math.max(0.2, 1 - i * 0.06)})`), borderSkipped: false, borderRadius: 4 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#8b949e", font: { size: 11 }, maxRotation: 35 }, grid: { display: false } },
        y: { ticks: { color: "#8b949e" }, grid: { color: "rgba(255,255,255,0.05)" } }
      }
    }
  });

  new Chart(document.getElementById("goalsAvgChart"), {
    type: "radar",
    data: {
      labels: teams.slice(0, 8).map((t) => t.team),
      datasets: [{ label: "Media/Jogo", data: teams.slice(0, 8).map((t) => t.avg), backgroundColor: "rgba(29,185,84,0.2)", borderColor: "#1db954", pointBackgroundColor: "#1db954", borderWidth: 2 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { r: { min: 0, ticks: { color: "#8b949e", backdropColor: "transparent", font: { size: 10 } }, grid: { color: "rgba(255,255,255,0.08)" }, pointLabels: { color: "#8b949e", font: { size: 11 } } } }
    }
  });

  const tbody = document.getElementById("goalsTable");
  tbody.innerHTML = "";
  const maxG = Math.max(...teams.map((t) => t.goals), 1);

  teams.forEach((t, i) => {
    const pct = (t.goals / maxG) * 100;
    tbody.innerHTML += `<tr>
      <td class="rank">${i + 1}</td>
      <td class="team-name">${t.team}</td>
      <td class="num" style="color:var(--green);font-weight:700">${fmtInt(t.goals)}</td>
      <td class="num">${fmtInt(t.matches)}</td>
      <td class="num" style="color:var(--yellow)">${Number(t.avg).toFixed(2)}</td>
      <td><div class="bar-cell"><div class="mini-bar"><div class="mini-bar-fill" style="width:${pct.toFixed(0)}%;background:var(--green)"></div></div><span style="font-size:11px;color:var(--text3)">${pct.toFixed(0)}%</span></div></td>
    </tr>`;
  });
}

function renderCards() {
  const teams = DATA.most_violent;

  new Chart(document.getElementById("cardsChart"), {
    type: "bar",
    data: {
      labels: teams.map((t) => t.team),
      datasets: [
        { label: "Amarelos", data: teams.map((t) => t.yellow), backgroundColor: "rgba(240,180,41,0.85)", borderSkipped: false },
        { label: "Vermelhos", data: teams.map((t) => t.red * 5), backgroundColor: "rgba(224,82,82,0.85)", borderSkipped: false }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => (ctx.datasetIndex === 1 ? `Vermelhos: ${Math.round(ctx.raw / 5)}` : `Amarelos: ${ctx.raw}`)
          }
        }
      },
      scales: {
        x: { stacked: true, ticks: { color: "#8b949e", font: { size: 11 }, maxRotation: 35 }, grid: { display: false } },
        y: { stacked: true, ticks: { color: "#8b949e" }, grid: { color: "rgba(255,255,255,0.05)" } }
      }
    }
  });

  new Chart(document.getElementById("cardsPerMatchChart"), {
    type: "bar",
    data: {
      labels: teams.map((t) => t.team),
      datasets: [{ label: "Cartoes/Jogo", data: teams.map((t) => t.per_match), backgroundColor: teams.map((t) => (t.per_match > 1.9 ? "rgba(224,82,82,0.85)" : t.per_match > 1.7 ? "rgba(240,180,41,0.85)" : "rgba(29,185,84,0.75)")), borderSkipped: false, borderRadius: 4 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#8b949e" }, grid: { color: "rgba(255,255,255,0.05)" } },
        y: { ticks: { color: "#8b949e", font: { size: 11 } }, grid: { display: false } }
      }
    }
  });

  const tbody = document.getElementById("cardsTable");
  tbody.innerHTML = "";
  const maxC = Math.max(...teams.map((t) => t.total), 1);

  teams.forEach((t, i) => {
    const violence = t.per_match > 1.9 ? "Alta" : t.per_match > 1.7 ? "Media" : "Baixa";
    tbody.innerHTML += `<tr>
      <td class="rank">${i + 1}</td>
      <td class="team-name">${t.team}</td>
      <td class="num" style="color:var(--yellow)">${fmtInt(t.yellow)}</td>
      <td class="num" style="color:var(--red)">${fmtInt(t.red)}</td>
      <td class="num" style="font-weight:700">${fmtInt(t.total)}</td>
      <td class="num" style="color:${t.per_match > 1.9 ? "var(--red)" : "var(--yellow)"}">${Number(t.per_match).toFixed(2)}</td>
      <td><div class="bar-cell"><div class="mini-bar"><div class="mini-bar-fill" style="width:${((t.total / maxC) * 100).toFixed(0)}%;background:${t.per_match > 1.9 ? "var(--red)" : "var(--yellow)"}"></div></div><span style="font-size:11px;color:var(--text3)">${violence}</span></div></td>
    </tr>`;
  });
}

function renderPlayers() {
  const grid = document.getElementById("playerGrid");
  const detail = document.getElementById("playerDetail");
  grid.innerHTML = "";
  detail.style.display = "none";

  // Populate filters once
  if (!filtersInitialized) {
    populateFilters();
    filtersInitialized = true;
  }

  // Use filtered players
  const playersToShow = filteredPlayers.length ? filteredPlayers : DATA.players;

  playersToShow.forEach((p, i) => {
    const name = p.name || p.team || "Jogador";
    const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("");
    const colors = ["#1db954", "#3a8bd0", "#f0b429", "#e05252", "#8b5cf6", "#f97316", "#06b6d4", "#10b981"];

    const cardCount = fmtInt((p.yellow || 0) + (p.red || 0));
    grid.innerHTML += `<div class="player-card" id="pcard_${i}" onclick="selectPlayer(${i})" tabindex="0" aria-label="Detalhes do jogador ${name}">
      <div class="player-avatar" style="color:${colors[i % colors.length]};border-color:${colors[i % colors.length]}">${initials}</div>
      <div class="player-name">${name}</div>
      <div class="player-team">${p.team || "-"}</div>
      <div class="player-stats">
        <div class="player-stat"><div class="player-stat-val">${fmtInt(p.goals)}</div><div class="player-stat-label">Gols</div></div>
        <div class="player-stat"><div class="player-stat-val">${cardCount}</div><div class="player-stat-label">Cartões</div></div>
        <div class="player-stat"><div class="player-stat-val">${fmtInt(p.matches)}</div><div class="player-stat-label">Jogos</div></div>
        <div class="player-stat"><div class="player-stat-val">${Number(p.avg_goal).toFixed(2)}</div><div class="player-stat-label">G/Jogo</div></div>
      </div>
    </div>`;
  });

  if (playerChart) playerChart.destroy();

  const chartCanvas = document.getElementById("playerBarChart");
  if (playersToShow.length === 1) {
    const p = playersToShow[0];
    const cards = (p.yellow || 0) + (p.red || 0);
    playerChart = new Chart(chartCanvas, {
      type: "radar",
      data: {
        labels: ["Gols", "Jogos", "G/Jogo", "Cartões"],
        datasets: [{
          label: p.name || p.team || "Jogador",
          data: [
            Math.min(100, p.goals || 0),
            Math.min(100, p.matches || 0),
            Math.min(100, Number(p.avg_goal || 0) * 30),
            Math.min(100, cards * 5)
          ],
          backgroundColor: "rgba(29,185,84,0.15)",
          borderColor: "#1db954",
          pointBackgroundColor: "#1db954",
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { r: { min: 0, max: 100, ticks: { color: "#8b949e", backdropColor: "transparent", stepSize: 20 }, grid: { color: "rgba(255,255,255,0.08)" }, pointLabels: { color: "#8b949e", font: { size: 12 } } } }
      }
    });
  } else {
    playerChart = new Chart(chartCanvas, {
      type: "bar",
      data: {
        labels: playersToShow.map((p) => (p.name || p.team || "Jogador").split(" ")[0]),
        datasets: [
          { label: "Gols", data: playersToShow.map((p) => p.goals), backgroundColor: "rgba(29,185,84,0.85)", borderSkipped: false, borderRadius: 3 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#8b949e" }, grid: { display: false } },
          y: { ticks: { color: "#8b949e" }, grid: { color: "rgba(255,255,255,0.05)" } }
        }
      }
    });
  }
}

function selectPlayer(idx) {
  document.querySelectorAll(".player-card").forEach((c) => c.classList.remove("selected"));
  const active = document.getElementById(`pcard_${idx}`);
  if (!active) return;
  active.classList.add("selected");

  const playersToShow = filteredPlayers.length ? filteredPlayers : DATA.players;
  const p = playersToShow[idx];
  const detail = document.getElementById("playerDetail");
  detail.style.display = "block";

  const playerName = p.name || p.team || "Jogador";
  document.getElementById("detailName").textContent = `${playerName} - ${p.team || "-"}`;
  document.getElementById("detailStats").innerHTML = `
    <div class="detail-item"><div class="detail-val" style="color:var(--green)">${fmtInt(p.goals)}</div><div class="detail-lbl">Gols</div></div>
    <div class="detail-item"><div class="detail-val">${fmtInt(p.matches)}</div><div class="detail-lbl">Jogos</div></div>
    <div class="detail-item"><div class="detail-val" style="color:var(--yellow)">${Number(p.avg_goal).toFixed(2)}</div><div class="detail-lbl">Gols/Jogo</div></div>
    <div class="detail-item"><div class="detail-val" style="color:var(--red)">${fmtInt(p.yellow)}Y ${fmtInt(p.red)}R</div><div class="detail-lbl">Cartoes</div></div>
  `;

  if (radarChart) radarChart.destroy();
  radarChart = new Chart(document.getElementById("playerRadar"), {
    type: "radar",
    data: {
      labels: ["Gols", "Jogos", "G/Jogo", "Disciplina"],
      datasets: [{
        label: p.name,
        data: [
          Math.min(100, p.goals),
          Math.min(100, p.matches / 2),
          Math.min(100, p.avg_goal * 100),
          Math.max(0, 100 - (p.yellow + p.red * 3) * 2)
        ],
        backgroundColor: "rgba(29,185,84,0.15)",
        borderColor: "#1db954",
        pointBackgroundColor: "#1db954",
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { r: { ticks: { display: false, backdropColor: "transparent" }, grid: { color: "rgba(255,255,255,0.08)" }, pointLabels: { color: "#8b949e", font: { size: 12 } }, min: 0, max: 100 } }
    }
  });
}

async function loadData() {
  if (window.__DADOS_REAIS__) {
    return window.__DADOS_REAIS__;
  }

  const response = await fetch("./dados_reais.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Falha ao carregar dados_reais.json: ${response.status}`);
  return response.json();
}

async function init() {
  try {
    DATA = await loadData();
    histData = [...(DATA.historical_perf || [])];
    updateStaticCards();
    renderOverview();
    rendered.overview = true;
  } catch (error) {
    console.error(error);
    const container = document.querySelector(".main");
    if (container) {
      container.innerHTML = `<div class="chart-card"><div class="chart-title">Erro ao carregar dados</div><div class="chart-subtitle">${error.message}. Se estiver abrindo via file://, gere e mantenha o arquivo dados_reais.js ao lado do index.html.</div></div>`;
    }
  }
}

function populateFilters() {
  const seasonSelect = document.getElementById("seasonFilter");
  const teamSelect = document.getElementById("teamFilter");

  seasonSelect.innerHTML = '<option value="">Todas as Temporadas</option>';
  teamSelect.innerHTML = '<option value="">Todos os Times</option>';

  // Get unique seasons
  const seasons = [...new Set(DATA.players.map(p => (p.season || "").toString().trim()).filter(s => s))].sort();
  seasons.forEach(season => {
    const option = document.createElement("option");
    option.value = season;
    option.textContent = season;
    seasonSelect.appendChild(option);
  });

  // Get unique teams
  const teams = [...new Set(DATA.players.map(p => (p.team || "").toString().trim()).filter(t => t))].sort();
  teams.forEach(team => {
    const option = document.createElement("option");
    option.value = team;
    option.textContent = team;
    teamSelect.appendChild(option);
  });
}

function applyFilters() {
  const seasonFilter = document.getElementById("seasonFilter").value;
  const teamFilter = document.getElementById("teamFilter").value;
  const searchFilter = document.getElementById("playerSearch").value.toLowerCase();

  filteredPlayers = DATA.players.filter(p => {
    const matchesSeason = !seasonFilter || p.season == seasonFilter;
    const matchesTeam = !teamFilter || p.team === teamFilter;
    const matchesSearch = !searchFilter || (p.name || "").toLowerCase().includes(searchFilter) || (p.team || "").toLowerCase().includes(searchFilter);
    return matchesSeason && matchesTeam && matchesSearch;
  });

  renderPlayers();
}

window.showSection = showSection;
window.sortHistTable = sortHistTable;
window.selectPlayer = selectPlayer;
window.applyFilters = applyFilters;

init();
