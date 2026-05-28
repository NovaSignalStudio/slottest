const CONFIG = {
  startBalance: 500,
  jackpotChance: 0.015,
  lineWinChance: 0.13,
  bonusChance: 0.025,
  rareChance: 0.006,
  apiEndpoint: null,
  balanceEndpoint: null,
  currencyName: "diamanti",
  currencyShort: "d",
  rarePrizeLabel: "Raro 1000",
  bets: {
    10: 100,
    20: 200,
    50: 500,
  },
  payouts: {
    infinity: { label: "Infinity Jackpot", multiplier: 10, currency: "diamonds" },
    seven: { label: "Raro 1000", fixed: 1000, currency: "rare" },
    diamond: { label: "Diamond bonus", multiplier: 3, currency: "diamonds" },
    crown: { label: "Free spin bonus", multiplier: 2, currency: "diamonds" },
    chip: { label: "Chip win", multiplier: 2, currency: "diamonds" },
    chest: { label: "Chest win", multiplier: 1, currency: "diamonds" },
    hc: { label: "HC win", multiplier: 1, currency: "diamonds" },
  },
};

if (window.InfinitySlotConfig && typeof window.InfinitySlotConfig === "object") {
  Object.assign(CONFIG, window.InfinitySlotConfig);
  if (window.InfinitySlotConfig.bets) CONFIG.bets = { ...CONFIG.bets, ...window.InfinitySlotConfig.bets };
  if (window.InfinitySlotConfig.payouts) CONFIG.payouts = { ...CONFIG.payouts, ...window.InfinitySlotConfig.payouts };
}

const ASSETS = {
  infinity: "assets/infinity-logo-symbol.png",
  diamond: "assets/diamond.svg",
  credits: "assets/credits.svg",
  chest: "assets/chest.svg",
  hc: "assets/hc.svg",
  duck: "assets/duck.svg",
  throne: "assets/throne.svg",
  seven: "assets/seven.svg",
  crown: "assets/crown.svg",
  chip: "assets/chip.svg",
};

if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}
window.addEventListener("load", () => window.setTimeout(() => window.scrollTo(0, 0), 50));

const state = {
  balance: CONFIG.startBalance,
  bet: 10,
  totalWon: 0,
  lastWin: 0,
  lastRareWin: 0,
  rareWon: 0,
  freeSpins: 0,
  bonusActive: false,
  bonusBank: 0,
  rounds: 0,
  spinId: 0,
  locked: false,
  sound: true,
  autoMode: false,
  serverMode: false,
};

const $ = (selector) => document.querySelector(selector);

const els = {
  balance: $("#balance"),
  topBalance: $("#topBalance"),
  currentBet: $("#currentBet"),
  lastWin: $("#lastWin"),
  freeSpins: $("#freeSpins"),
  jackpotText: $("#jackpotText"),
  sevenText: $("#sevenText"),
  diamondText: $("#diamondText"),
  jackpotDisplay: $("#jackpotDisplay"),
  paytableHint: $("#paytableHint"),
  jackpotBanner: $("#jackpotBanner"),
  bonusBanner: $("#bonusBanner"),
  bonusTotal: $("#bonusTotal"),
  bonusTotalAmount: $("#bonusTotalAmount"),
  message: $("#message"),
  playButton: $("#playButton"),
  betOne: $("#betOne"),
  maxBet: $("#maxBet"),
  autoSpin: $("#autoSpin"),
  soundToggle: $("#soundToggle"),
  slotMachine: $("#slotMachine"),
  reels: [$("#reel0"), $("#reel1"), $("#reel2")],
  paylines: {
    middle: $(".center-line"),
    diagonalDown: $(".diag-a"),
    diagonalUp: $(".diag-b"),
  },
};

const SlotAudio = {
  ctx: null,
  enabled: true,
  ensure() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === "suspended") this.ctx.resume();
  },
  tone(freq, duration, type = "sine", gain = 0.035, delay = 0) {
    if (!this.enabled) return;
    this.ensure();
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp);
    amp.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  },
  spin() {
    [220, 280, 340, 430, 520, 640].forEach((freq, i) => this.tone(freq, 0.055, "square", 0.022, i * 0.07));
  },
  click() {
    this.tone(520, 0.035, "square", 0.018);
    this.tone(680, 0.035, "triangle", 0.012, 0.035);
  },
  stop(i) {
    this.tone(260 + i * 120, 0.07, "square", 0.022);
  },
  tick(i) {
    this.tone(420 + i * 18, 0.03, "square", 0.012);
  },
  win() {
    [523, 659, 784, 1046, 1318].forEach((freq, i) => this.tone(freq, 0.16, "triangle", 0.045, i * 0.095));
  },
  bonus() {
    [392, 523, 659, 784, 988, 1174].forEach((freq, i) => this.tone(freq, 0.13, "triangle", 0.04, i * 0.08));
    this.tone(196, 0.55, "sine", 0.018, 0);
  },
  bonusLoopTimer: null,
  bonusLoop() {
    if (!this.enabled || this.bonusLoopTimer) return;
    let step = 0;
    const notes = [392, 494, 587, 784, 659, 587, 494, 523];
    this.bonusLoopTimer = window.setInterval(() => {
      this.tone(notes[step % notes.length], 0.12, "triangle", 0.016);
      step += 1;
    }, 190);
  },
  stopBonusLoop() {
    window.clearInterval(this.bonusLoopTimer);
    this.bonusLoopTimer = null;
  },
  money() {
    [880, 988, 1174, 1318, 1568, 1760].forEach((freq, i) => this.tone(freq, 0.08, "square", 0.03, i * 0.055));
  },
  lose() {
    this.tone(160, 0.16, "sawtooth", 0.025);
    this.tone(100, 0.18, "sine", 0.02, 0.12);
  },
};

function prize() {
  return CONFIG.bets[state.bet];
}

function payoutAmount(symbol) {
  const payout = CONFIG.payouts[symbol];
  if (!payout) return 0;
  if (Number.isFinite(Number(payout.fixed))) return Number(payout.fixed);
  return (Number(payout.multiplier) || 0) * state.bet;
}

function payoutLabel(symbol) {
  const payout = CONFIG.payouts[symbol];
  const amount = payoutAmount(symbol);
  if (!payout) return "";
  if (payout.currency === "rare") return `${payout.label}`;
  return `${payout.label} ${format(amount)}${CONFIG.currencyShort}`;
}

function format(value) {
  return new Intl.NumberFormat("it-IT").format(value);
}

function emitSlotEvent(name, detail) {
  window.dispatchEvent(new CustomEvent(`infinity-slot:${name}`, { detail }));
}

function serverBalanceFrom(result) {
  if (!result || typeof result !== "object") return null;
  const value = result.balance ?? result.diamonds ?? result.balanceAfter ?? result.wallet?.diamonds;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

window.InfinitySlotBridge = {
  getState: () => ({ ...state, prize: prize() }),
  setBalance(value) {
    state.balance = Number(value) || 0;
    updateHud();
  },
  addBalance(value) {
    state.balance += Number(value) || 0;
    updateHud();
  },
  setApiEndpoint(url) {
    CONFIG.apiEndpoint = url || null;
    state.serverMode = Boolean(CONFIG.apiEndpoint || CONFIG.balanceEndpoint || window.InfinityNitroSlot);
  },
  setBalanceEndpoint(url) {
    CONFIG.balanceEndpoint = url || null;
    state.serverMode = Boolean(CONFIG.apiEndpoint || CONFIG.balanceEndpoint || window.InfinityNitroSlot);
  },
  setApiEndpoints({ balance, spin } = {}) {
    CONFIG.balanceEndpoint = balance || null;
    CONFIG.apiEndpoint = spin || null;
    state.serverMode = Boolean(CONFIG.apiEndpoint || CONFIG.balanceEndpoint || window.InfinityNitroSlot);
    return this.refreshBalance();
  },
  async refreshBalance() {
    return refreshBalance();
  },
  setResolver(fn) {
    window.InfinityNitroSlot = { spin: fn };
    state.serverMode = typeof fn === "function";
  },
  setBalanceResolver(fn) {
    window.InfinityNitroWallet = { getBalance: fn };
    state.serverMode = typeof fn === "function" || state.serverMode;
  },
};

function normalizeBalancePayload(payload) {
  if (typeof payload === "number") return payload;
  if (!payload || typeof payload !== "object") return state.balance;
  return Number(payload.diamonds ?? payload.balance ?? payload.credits ?? state.balance) || 0;
}

async function refreshBalance() {
  if (window.InfinityNitroWallet && typeof window.InfinityNitroWallet.getBalance === "function") {
    state.balance = normalizeBalancePayload(await window.InfinityNitroWallet.getBalance());
    updateHud();
    emitSlotEvent("balance-sync", { balance: state.balance });
    return state.balance;
  }

  if (CONFIG.balanceEndpoint) {
    const response = await fetch(CONFIG.balanceEndpoint, {
      method: "GET",
      credentials: "include",
      headers: { "Accept": "application/json" },
    });
    if (!response.ok) throw new Error("Balance sync failed");
    state.balance = normalizeBalancePayload(await response.json());
    updateHud();
    emitSlotEvent("balance-sync", { balance: state.balance });
  }

  return state.balance;
}

async function resolveSpin(payload) {
  if (window.InfinityNitroSlot && typeof window.InfinityNitroSlot.spin === "function") {
    state.serverMode = true;
    return window.InfinityNitroSlot.spin(payload);
  }

  if (CONFIG.apiEndpoint) {
    state.serverMode = true;
    const response = await fetch(CONFIG.apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("Spin validation failed");
    return response.json();
  }

  const bonusRoll = Math.random() < CONFIG.bonusChance;
  const jackpotRoll = Math.random() < CONFIG.jackpotChance;
  const rareRoll = !jackpotRoll && Math.random() < CONFIG.rareChance;
  const lineRoll = !jackpotRoll && !rareRoll && Math.random() < CONFIG.lineWinChance;
  let symbols = randomGrid();

  if (jackpotRoll) {
    symbols = winningGrid();
  } else if (rareRoll) {
    symbols = forceLine(symbols, ["middle", "diagonalDown", "diagonalUp"][Math.floor(Math.random() * 3)], "seven");
  } else if (lineRoll) {
    const lineId = ["middle", "diagonalDown", "diagonalUp"][Math.floor(Math.random() * 3)];
    const symbol = ["diamond", "chip", "crown", "chest", "hc"][Math.floor(Math.random() * 5)];
    symbols = forceLine(symbols, lineId, symbol);
  }

  if (bonusRoll) {
    symbols[0][0] = "crown";
    symbols[1][1] = "crown";
    symbols[2][2] = "crown";
  }

  const evaluation = evaluateGrid(symbols);

  return {
    ok: true,
    won: evaluation.won,
    prize: evaluation.total,
    rarePrize: evaluation.rareTotal,
    freeSpins: evaluation.freeSpins,
    wins: evaluation.wins,
    symbols,
    balance: state.balance + evaluation.total,
  };
}

function symbolPool() {
  return ["diamond", "diamond", "chip", "chip", "crown", "chest", "chest", "hc", "hc", "seven", "infinity"];
}

function randomSymbol() {
  const pool = symbolPool();
  return pool[Math.floor(Math.random() * pool.length)];
}

function payoutFor(symbol) {
  const payout = CONFIG.payouts[symbol];
  if (!payout || payout.currency === "rare") return 0;
  if (Number.isFinite(Number(payout.fixed))) return Number(payout.fixed);
  return (Number(payout.multiplier) || 0) * state.bet;
}

function rarePayoutFor(symbol) {
  const payout = CONFIG.payouts[symbol];
  if (!payout || payout.currency !== "rare") return 0;
  if (Number.isFinite(Number(payout.fixed))) return Number(payout.fixed);
  return (Number(payout.multiplier) || 0) * state.bet;
}

function getPaylines(grid) {
  return [
    { id: "middle", symbols: [grid[0][1], grid[1][1], grid[2][1]] },
    { id: "diagonalDown", symbols: [grid[0][0], grid[1][1], grid[2][2]] },
    { id: "diagonalUp", symbols: [grid[0][2], grid[1][1], grid[2][0]] },
  ];
}

function evaluateGrid(grid) {
  const wins = [];
  let total = 0;
  let rareTotal = 0;

  getPaylines(grid).forEach((line) => {
    const [a, b, c] = line.symbols;
    if (a === b && b === c) {
      const amount = payoutFor(a);
      const rareAmount = rarePayoutFor(a);
      if (amount > 0 || rareAmount > 0) {
        wins.push({ ...line, symbol: a, amount, rareAmount, currency: rareAmount > 0 ? "rare" : "diamonds" });
        total += amount;
        rareTotal += rareAmount;
      }
    }
  });

  const crownCount = grid.flat().filter((symbol) => symbol === "crown").length;
  const freeSpins = crownCount >= 3 ? 3 : 0;

  return {
    freeSpins,
    rareTotal,
    total,
    wins,
    won: total > 0 || rareTotal > 0,
  };
}

function winningGrid() {
  return [
    [randomSymbol(), "infinity", randomSymbol()],
    [randomSymbol(), "infinity", randomSymbol()],
    [randomSymbol(), "infinity", randomSymbol()],
  ];
}

function losingGrid() {
  const grid = Array.from({ length: 3 }, () => Array.from({ length: 3 }, randomSymbol));
  if (grid.every((reel) => reel[1] === "infinity")) grid[2][1] = "diamond";
  return grid;
}

function randomGrid() {
  const grid = Array.from({ length: 3 }, () => Array.from({ length: 3 }, randomSymbol));
  return grid;
}

function forceLine(grid, lineId, symbol) {
  const next = grid.map((reel) => [...reel]);
  if (lineId === "middle") {
    next[0][1] = symbol;
    next[1][1] = symbol;
    next[2][1] = symbol;
  }
  if (lineId === "diagonalDown") {
    next[0][0] = symbol;
    next[1][1] = symbol;
    next[2][2] = symbol;
  }
  if (lineId === "diagonalUp") {
    next[0][2] = symbol;
    next[1][1] = symbol;
    next[2][0] = symbol;
  }
  return next;
}

function setReel(reel, symbols) {
  reel.innerHTML = "";
  symbols.forEach((symbol, index) => {
    const cell = document.createElement("div");
    cell.className = "symbol-cell";
    if (reel.dataset.winLine === "true" && index === 1) {
      cell.classList.add("win-cell");
    }
    const img = document.createElement("img");
    img.src = ASSETS[symbol] || ASSETS.diamond;
    img.alt = "";
    if (symbol === "infinity") img.className = "infinity";
    cell.appendChild(img);
    reel.appendChild(cell);
  });
}

function markWinLine(won) {
  document.querySelectorAll(".symbol-cell").forEach((cell) => cell.classList.remove("win-cell"));
  document.querySelectorAll(".pay-row").forEach((row) => row.classList.remove("active"));
  Object.values(els.paylines).forEach((line) => line.classList.remove("active"));
  els.reels.forEach((reel) => {
    reel.classList.remove("win-reel");
    reel.dataset.winLine = won ? "true" : "false";
  });

  if (!won) return;

  els.reels.forEach((reel) => {
    reel.classList.add("win-reel");
    reel.children[1]?.classList.add("win-cell");
  });
  document.querySelector('[data-pay="infinity"]')?.classList.add("active");
}

function markWinningLines(wins) {
  markWinLine(false);
  if (!wins.length) return;

  wins.forEach((win) => {
    els.paylines[win.id]?.classList.add("active");
    if (win.symbol === "infinity") document.querySelector('[data-pay="infinity"]')?.classList.add("active");
    if (win.symbol === "diamond") document.querySelector('[data-pay="diamond"]')?.classList.add("active");
    if (win.symbol === "seven") document.querySelector('[data-pay="seven"]')?.classList.add("active");
  });

  els.reels.forEach((reel, reelIndex) => {
    reel.classList.add("win-reel");
    wins.forEach((win) => {
      const cellIndex = win.id === "middle" ? 1 : win.id === "diagonalDown" ? reelIndex : 2 - reelIndex;
      reel.children[cellIndex]?.classList.add("win-cell");
    });
  });
}

function pressButton(button) {
  button.classList.add("pressed");
  window.setTimeout(() => button.classList.remove("pressed"), 140);
}

function animateLastWin(target) {
  const duration = 720;
  const start = performance.now();

  function frame(now) {
    const progress = Math.min(1, (now - start) / duration);
    state.lastWin = Math.round(target * progress);
    updateHud();
    if (progress < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function startBonusMode(amount) {
  const wasActive = state.bonusActive;
  state.bonusActive = true;
  if (!wasActive) state.bonusBank = 0;
  state.freeSpins += amount;
  els.slotMachine.classList.add("bonus-mode");
  if (!wasActive) SlotAudio.bonus();
  SlotAudio.bonusLoop();
  els.bonusBanner.classList.remove("show");
  void els.bonusBanner.offsetWidth;
  els.bonusBanner.classList.add("show");
}

function finishBonusMode() {
  if (!state.bonusActive || state.freeSpins > 0 || state.locked) return;
  const total = state.bonusBank;
  state.bonusActive = false;
  state.bonusBank = 0;
  els.slotMachine.classList.remove("bonus-mode");
  SlotAudio.stopBonusLoop();

  if (total <= 0) {
    setMessage("Bonus terminato. Nessuna vincita bonus.", "lose");
    return;
  }

  els.bonusTotalAmount.textContent = "0";
  els.bonusTotal.classList.remove("show");
  void els.bonusTotal.offsetWidth;
  els.bonusTotal.classList.add("show");
  SlotAudio.money();

  const duration = 1400;
  const start = performance.now();

  function frame(now) {
    const progress = Math.min(1, (now - start) / duration);
    els.bonusTotalAmount.textContent = format(Math.round(total * progress));
    if (progress < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
  setMessage(`Bonus completato: ${format(total)} diamanti.`, "win");
}

function setMessage(text, tone = "") {
  els.message.textContent = text;
  els.message.className = `message-strip ${tone}`.trim();
}

function updateHud() {
  els.balance.textContent = format(state.balance);
  if (els.topBalance) els.topBalance.textContent = format(state.balance);
  els.currentBet.textContent = format(state.bet);
  els.lastWin.textContent = format(state.lastWin);
  els.freeSpins.textContent = format(state.freeSpins);
  els.jackpotText.textContent = payoutLabel("infinity");
  els.sevenText.textContent = payoutLabel("seven");
  els.diamondText.textContent = payoutLabel("diamond");
  els.jackpotDisplay.textContent = `${format(prize())}${CONFIG.currencyShort}`;
  els.paytableHint.textContent = `Bet ${format(state.bet)}${CONFIG.currencyShort}: centro e diagonali pagano, 3 sette danno ${CONFIG.rarePrizeLabel}.`;
  els.slotMachine.classList.toggle("bonus-mode", state.bonusActive);
}

function forceUnlock(message = "Round annullato. Riprova.") {
  state.locked = false;
  els.playButton.disabled = false;
  els.slotMachine.classList.remove("spinning", "jackpot");
  els.reels.forEach((reel) => reel.classList.remove("spinning", "stop-bounce"));
  if (!state.bonusActive) SlotAudio.stopBonusLoop();
  setMessage(message, "lose");
  updateHud();
}

function setBet(value) {
  if (state.locked) return;
  if (state.freeSpins > 0 || state.bonusActive) {
    setMessage("Finisci prima i free spin.", "lose");
    return;
  }
  pressButton(value === 50 ? els.maxBet : els.betOne);
  SlotAudio.click();
  state.bet = value;
  setMessage(`Bet impostata a ${value}${CONFIG.currencyShort}.`);
  updateHud();
  emitSlotEvent("bet-change", { bet: state.bet, prize: prize() });
}

function coinBurst() {
  for (let i = 0; i < 36; i += 1) {
    const coin = document.createElement("span");
    coin.className = "coin-pop";
    coin.style.left = `${50 + Math.random() * 12 - 6}vw`;
    coin.style.top = `${45 + Math.random() * 8 - 4}vh`;
    coin.style.setProperty("--x", `${Math.random() * 520 - 260}px`);
    coin.style.setProperty("--y", `${Math.random() * -350 - 70}px`);
    document.body.appendChild(coin);
    window.setTimeout(() => coin.remove(), 1050);
  }
}

function startAnimation() {
  markWinLine(false);
  els.slotMachine.classList.add("spinning");
  els.reels.forEach((reel, reelIndex) => {
    reel.dataset.winLine = "false";
    reel.classList.add("spinning");
    reel.classList.remove("stop-bounce");
    let ticks = 0;
    const timer = window.setInterval(() => {
      ticks += 1;
      setReel(reel, [randomSymbol(), randomSymbol(), randomSymbol()]);
      if (reelIndex === 0) SlotAudio.tick(ticks);
      if (ticks > 18) window.clearInterval(timer);
    }, 70);
  });
}

async function play() {
  if (state.locked) return;
  pressButton(els.playButton);
  const freeSpin = state.freeSpins > 0;

  if (!freeSpin && state.balance < state.bet) {
    setMessage("Diamanti insufficienti.", "lose");
    SlotAudio.lose();
    state.autoMode = false;
    els.autoSpin.classList.remove("active");
    return;
  }

  state.locked = true;
  state.spinId += 1;
  const spinId = state.spinId;
  if (freeSpin) {
    state.freeSpins -= 1;
  } else {
    state.balance -= state.bet;
  }
  state.lastWin = 0;
  state.rounds += 1;
  els.playButton.disabled = true;
  setMessage(freeSpin ? `Free spin in corso (${state.freeSpins} rimasti).` : "Good luck, Habbo.");
  updateHud();
  SlotAudio.spin();
  startAnimation();
  emitSlotEvent("spin-start", { bet: state.bet, prize: prize(), balance: state.balance, round: state.rounds, freeSpin });

  const watchdog = window.setTimeout(() => {
    if (!state.locked || spinId !== state.spinId) return;
    forceUnlock("Round annullato. Riprova.");
  }, 5200);

  try {
    const result = await resolveSpin({
      bet: state.bet,
      prize: prize(),
      clientBalance: state.balance,
      currency: "diamonds",
      round: state.rounds,
      freeSpin,
    });
    window.setTimeout(() => {
      window.clearTimeout(watchdog);
      finishSpin(result, spinId);
    }, 1500);
  } catch (error) {
    window.setTimeout(() => {
      window.clearTimeout(watchdog);
      finishSpin({
        ok: false,
        won: false,
        prize: 0,
        balance: freeSpin ? state.balance : state.balance + state.bet,
        symbols: randomGrid(),
        message: "Errore server.",
      }, spinId);
    }, 900);
  }
}

function finishSpin(result, spinId = state.spinId) {
  if (!state.locked || spinId !== state.spinId) return;

  const grid = Array.isArray(result.symbols) && result.symbols.length === 3 ? result.symbols : losingGrid();
  const evaluation = evaluateGrid(grid);
  const lineWins = Array.isArray(result.wins) ? result.wins : evaluation.wins;
  const freeSpinAward = Number.isFinite(Number(result.freeSpins)) ? Number(result.freeSpins) : evaluation.freeSpins;
  const awarded = Number(result.prize ?? result.diamondsPrize ?? result.diamondsWon ?? evaluation.total) || 0;
  const rareAwarded = Number(result.rarePrize ?? result.rareWon ?? evaluation.rareTotal) || 0;
  const serverBalance = serverBalanceFrom(result);
  const won = Boolean(result.ok !== false && (result.won || awarded > 0 || rareAwarded > 0));

  els.reels.forEach((reel, index) => {
    reel.dataset.winLine = won ? "true" : "false";
    window.setTimeout(() => {
      reel.classList.remove("spinning");
      setReel(reel, grid[index]);
      reel.classList.remove("stop-bounce");
      void reel.offsetWidth;
      reel.classList.add("stop-bounce");
      SlotAudio.stop(index);
    }, index * 230);
  });

  window.setTimeout(() => {
    if (!state.locked || spinId !== state.spinId) return;

    try {
      state.locked = false;
      els.playButton.disabled = false;
      els.slotMachine.classList.remove("spinning");
      markWinningLines(lineWins);
      window.setTimeout(() => markWinningLines(lineWins), 120);

      if (freeSpinAward > 0) {
        startBonusMode(freeSpinAward + 2);
      }

      if (won) {
        if (serverBalance !== null) {
          state.balance = serverBalance;
        } else {
          state.balance += awarded;
        }
        state.totalWon += awarded;
        state.rareWon += rareAwarded;
        state.lastRareWin = rareAwarded;
        if (state.bonusActive) state.bonusBank += awarded;
        state.lastWin = 0;
        const rareText = rareAwarded > 0 ? ` + ${CONFIG.rarePrizeLabel}` : "";
        setMessage(lineWins.some((line) => line.symbol === "infinity") ? `Jackpot Infinity! +${awarded}${CONFIG.currencyShort}${rareText}` : `Vincita linee! +${awarded}${CONFIG.currencyShort}${rareText}`, "win");
        SlotAudio.win();
        coinBurst();
        if (lineWins.some((line) => line.symbol === "infinity")) {
          els.slotMachine.classList.add("jackpot");
          els.jackpotBanner.classList.remove("show");
          void els.jackpotBanner.offsetWidth;
          els.jackpotBanner.classList.add("show");
        }
        window.setTimeout(() => els.slotMachine.classList.remove("jackpot"), 2600);
        animateLastWin(awarded);
      } else {
        if (serverBalance !== null) state.balance = serverBalance;
        state.lastWin = 0;
        setMessage(freeSpinAward > 0 ? `Bonus! +${freeSpinAward + 2} free spin.` : result.message || "Spin again.", freeSpinAward > 0 ? "win" : "lose");
        if (freeSpinAward <= 0) SlotAudio.lose();
      }

      updateHud();
      emitSlotEvent("spin-end", { won, awarded, rareAwarded, freeSpins: freeSpinAward, wins: lineWins, symbols: grid, bet: state.bet, balance: state.balance, round: state.rounds });

      if (state.freeSpins > 0 || (state.autoMode && state.balance >= state.bet)) {
        window.setTimeout(() => play(), state.freeSpins > 0 ? 900 : 1200);
      } else {
        state.autoMode = false;
        els.autoSpin.classList.remove("active");
        finishBonusMode();
      }
    } catch (error) {
      console.error(error);
      forceUnlock("Round annullato. Riprova.");
    }
  }, 760);
}

els.playButton.addEventListener("click", play);
els.betOne.addEventListener("click", () => setBet(state.bet === 10 ? 20 : state.bet === 20 ? 50 : 10));
els.maxBet.addEventListener("click", () => setBet(50));
els.autoSpin.addEventListener("click", () => {
  if (state.locked && state.autoMode) {
    state.autoMode = false;
    els.autoSpin.classList.remove("active");
    setMessage("Auto spin si fermera dopo questo giro.");
    return;
  }
  if (state.locked) return;
  state.autoMode = !state.autoMode;
  els.autoSpin.classList.toggle("active", state.autoMode);
  SlotAudio.click();
  setMessage(state.autoMode ? "Auto spin attivo." : "Auto spin fermato.");
  if (state.autoMode) play();
});
els.soundToggle.addEventListener("click", () => {
  state.sound = !state.sound;
  SlotAudio.enabled = state.sound;
  els.soundToggle.classList.toggle("active", state.sound);
  els.soundToggle.textContent = state.sound ? "Sound" : "Mute";
});

setReel(els.reels[0], ["seven", "crown", "diamond"]);
setReel(els.reels[1], ["chip", "infinity", "seven"]);
setReel(els.reels[2], ["diamond", "hc", "chest"]);
updateHud();
if (CONFIG.balanceEndpoint || (window.InfinityNitroWallet && typeof window.InfinityNitroWallet.getBalance === "function")) {
  refreshBalance().catch(() => setMessage("Saldo non sincronizzato.", "lose"));
}
