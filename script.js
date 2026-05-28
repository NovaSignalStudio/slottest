const CONFIG = {
  startBalance: 500,
  winChance: 0.22,
  apiEndpoint: null,
  bets: {
    10: 100,
    20: 200,
  },
};

const ASSETS = {
  infinity: "assets/infinity-logo-symbol.png",
  diamond: "assets/diamond.svg",
  credits: "assets/credits.svg",
  chest: "assets/chest.svg",
  hc: "assets/hc.svg",
  duck: "assets/duck.svg",
  throne: "assets/throne.svg",
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
  rounds: 0,
  locked: false,
  sound: true,
};

const $ = (selector) => document.querySelector(selector);

const els = {
  balance: $("#balance"),
  topBalance: $("#topBalance"),
  currentBet: $("#currentBet"),
  lastWin: $("#lastWin"),
  jackpotText: $("#jackpotText"),
  message: $("#message"),
  playButton: $("#playButton"),
  betOne: $("#betOne"),
  maxBet: $("#maxBet"),
  soundToggle: $("#soundToggle"),
  slotMachine: $("#slotMachine"),
  reels: [$("#reel0"), $("#reel1"), $("#reel2")],
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
  tick(i) {
    this.tone(420 + i * 18, 0.03, "square", 0.012);
  },
  win() {
    [523, 659, 784, 1046, 1318].forEach((freq, i) => this.tone(freq, 0.16, "triangle", 0.045, i * 0.095));
  },
  lose() {
    this.tone(160, 0.16, "sawtooth", 0.025);
    this.tone(100, 0.18, "sine", 0.02, 0.12);
  },
};

function prize() {
  return CONFIG.bets[state.bet];
}

function format(value) {
  return new Intl.NumberFormat("it-IT").format(value);
}

function emitSlotEvent(name, detail) {
  window.dispatchEvent(new CustomEvent(`infinity-slot:${name}`, { detail }));
}

window.InfinitySlotBridge = {
  getState: () => ({ ...state, prize: prize() }),
  setBalance(value) {
    state.balance = Number(value) || 0;
    updateHud();
  },
  setApiEndpoint(url) {
    CONFIG.apiEndpoint = url || null;
  },
  setResolver(fn) {
    window.InfinityNitroSlot = { spin: fn };
  },
};

async function resolveSpin(payload) {
  if (window.InfinityNitroSlot && typeof window.InfinityNitroSlot.spin === "function") {
    return window.InfinityNitroSlot.spin(payload);
  }

  if (CONFIG.apiEndpoint) {
    const response = await fetch(CONFIG.apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("Spin validation failed");
    return response.json();
  }

  const won = Math.random() < CONFIG.winChance;
  return {
    ok: true,
    won,
    prize: won ? prize() : 0,
    symbols: won ? winningGrid() : losingGrid(),
  };
}

function symbolPool() {
  return ["infinity", "diamond", "credits", "chest", "hc", "duck", "throne"];
}

function randomSymbol() {
  const pool = symbolPool();
  return pool[Math.floor(Math.random() * pool.length)];
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

function setReel(reel, symbols) {
  reel.innerHTML = "";
  symbols.forEach((symbol) => {
    const cell = document.createElement("div");
    cell.className = "symbol-cell";
    const img = document.createElement("img");
    img.src = ASSETS[symbol] || ASSETS.diamond;
    img.alt = "";
    if (symbol === "infinity") img.className = "infinity";
    cell.appendChild(img);
    reel.appendChild(cell);
  });
}

function setMessage(text, tone = "") {
  els.message.textContent = text;
  els.message.className = `message-strip ${tone}`.trim();
}

function updateHud() {
  els.balance.textContent = format(state.balance);
  els.topBalance.textContent = format(state.balance);
  els.currentBet.textContent = format(state.bet);
  els.lastWin.textContent = format(state.lastWin);
  els.jackpotText.textContent = `Jackpot ${format(prize())}`;
}

function setBet(value) {
  if (state.locked) return;
  state.bet = value;
  setMessage(`Bet impostata a ${value}c.`);
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
  els.reels.forEach((reel, reelIndex) => {
    reel.classList.add("spinning");
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
  if (state.balance < state.bet) {
    setMessage("Crediti insufficienti.", "lose");
    SlotAudio.lose();
    return;
  }

  state.locked = true;
  state.balance -= state.bet;
  state.lastWin = 0;
  state.rounds += 1;
  els.playButton.disabled = true;
  setMessage("Good luck, Habbo.");
  updateHud();
  SlotAudio.spin();
  startAnimation();
  emitSlotEvent("spin-start", { bet: state.bet, prize: prize(), balance: state.balance, round: state.rounds });

  try {
    const result = await resolveSpin({
      bet: state.bet,
      prize: prize(),
      clientBalance: state.balance,
      round: state.rounds,
    });
    window.setTimeout(() => finishSpin(result), 1500);
  } catch (error) {
    window.setTimeout(() => finishSpin({
      ok: false,
      won: false,
      prize: 0,
      symbols: losingGrid(),
      message: "Errore server.",
    }), 900);
  }
}

function finishSpin(result) {
  const grid = Array.isArray(result.symbols) && result.symbols.length === 3 ? result.symbols : losingGrid();
  els.reels.forEach((reel, index) => {
    reel.classList.remove("spinning");
    setReel(reel, grid[index]);
  });

  state.locked = false;
  els.playButton.disabled = false;

  const won = Boolean(result.ok !== false && result.won);
  const awarded = Number(result.prize || (won ? prize() : 0));

  if (won) {
    state.balance += awarded;
    state.totalWon += awarded;
    state.lastWin = awarded;
    setMessage(`Jackpot Infinity! +${awarded}c`, "win");
    SlotAudio.win();
    coinBurst();
  } else {
    state.lastWin = 0;
    setMessage(result.message || "Spin again.", "lose");
    SlotAudio.lose();
  }

  updateHud();
  emitSlotEvent("spin-end", { won, awarded, symbols: grid, bet: state.bet, balance: state.balance, round: state.rounds });
}

els.playButton.addEventListener("click", play);
els.betOne.addEventListener("click", () => setBet(state.bet === 10 ? 20 : 10));
els.maxBet.addEventListener("click", () => setBet(20));
els.soundToggle.addEventListener("click", () => {
  state.sound = !state.sound;
  SlotAudio.enabled = state.sound;
  els.soundToggle.classList.toggle("active", state.sound);
  els.soundToggle.textContent = state.sound ? "Sound" : "Mute";
});

setReel(els.reels[0], ["duck", "chest", "diamond"]);
setReel(els.reels[1], ["credits", "infinity", "duck"]);
setReel(els.reels[2], ["diamond", "hc", "throne"]);
updateHud();
