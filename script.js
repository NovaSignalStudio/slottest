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
window.scrollTo(0, 0);
window.addEventListener("load", () => window.setTimeout(() => window.scrollTo(0, 0), 50));

const state = {
  balance: CONFIG.startBalance,
  bet: 10,
  totalWon: 0,
  rounds: 0,
  locked: false,
  sound: true,
  history: [],
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  balance: $("#balance"),
  currentBet: $("#currentBet"),
  prizeLabel: $("#prizeLabel"),
  spinCost: $("#spinCost"),
  message: $("#message"),
  playButton: $("#playButton"),
  soundToggle: $("#soundToggle"),
  slotMachine: $("#slotMachine"),
  totalWon: $("#totalWon"),
  lastResult: $("#lastResult"),
  rounds: $("#rounds"),
  history: $("#history"),
  reels: [$("#reel0"), $("#reel1"), $("#reel2")],
  bets: $$(".bet"),
};

const SlotAudio = {
  ctx: null,
  enabled: true,
  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
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
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp);
    amp.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  },
  spin() {
    [180, 230, 290, 360, 430, 520].forEach((freq, i) => this.tone(freq, 0.06, "square", 0.022, i * 0.075));
  },
  tick(i) {
    this.tone(360 + i * 24, 0.035, "square", 0.016);
  },
  win() {
    [523, 659, 784, 1046, 1318].forEach((freq, i) => this.tone(freq, 0.16, "triangle", 0.045, i * 0.095));
    this.tone(196, 0.5, "sine", 0.025, 0);
  },
  lose() {
    this.tone(180, 0.16, "sawtooth", 0.025);
    this.tone(112, 0.22, "sine", 0.02, 0.12);
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

async function resolveSpinOnServer(payload) {
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

    if (!response.ok) {
      throw new Error("Spin validation failed");
    }

    return response.json();
  }

  const won = Math.random() < CONFIG.winChance;
  return {
    ok: true,
    won,
    prize: won ? prize() : 0,
    symbols: won ? ["infinity", "infinity", "infinity"] : buildLosingSymbols(),
  };
}

function buildLosingSymbols() {
  const pool = ["infinity", "diamond", "credits", "chest", "hc", "duck", "throne"];
  const symbols = Array.from({ length: 3 }, () => pool[Math.floor(Math.random() * pool.length)]);

  if (symbols.every((symbol) => symbol === "infinity")) {
    symbols[2] = "diamond";
  }

  return symbols;
}

function updateHud() {
  els.balance.textContent = format(state.balance);
  els.currentBet.textContent = format(state.bet);
  els.prizeLabel.textContent = `${format(prize())} diamanti`;
  els.spinCost.textContent = `-${state.bet} dia`;
  els.totalWon.textContent = format(state.totalWon);
  els.rounds.textContent = format(state.rounds);
}

function setMessage(text, type = "") {
  els.message.textContent = text;
  els.message.className = `result ${type}`.trim();
}

function setSymbol(reel, symbol) {
  reel.innerHTML = "";
  const img = document.createElement("img");
  img.src = ASSETS[symbol] || ASSETS.diamond;
  img.alt = "";
  if (symbol !== "infinity") img.classList.add("pixel");
  reel.appendChild(img);
}

function randomVisualSymbol() {
  const pool = Object.keys(ASSETS);
  return pool[Math.floor(Math.random() * pool.length)];
}

function pushHistory(text) {
  state.history.unshift(text);
  state.history = state.history.slice(0, 5);
  els.history.textContent = state.history.join("  /  ");
}

function setBet(button) {
  if (state.locked) return;

  state.bet = Number(button.dataset.bet);
  els.bets.forEach((bet) => bet.classList.toggle("active", bet === button));
  setMessage(`Puntata ${state.bet}: se escono 3 loghi Infinity vinci ${prize()} diamanti.`);
  updateHud();
  emitSlotEvent("bet-change", { bet: state.bet, prize: prize() });
}

function coinBurst() {
  for (let i = 0; i < 44; i += 1) {
    const coin = document.createElement("span");
    coin.className = "coin-pop";
    coin.style.left = `${50 + Math.random() * 10 - 5}vw`;
    coin.style.top = `${50 + Math.random() * 8 - 4}vh`;
    coin.style.setProperty("--x", `${Math.random() * 620 - 310}px`);
    coin.style.setProperty("--y", `${Math.random() * -420 - 80}px`);
    document.body.appendChild(coin);
    window.setTimeout(() => coin.remove(), 1050);
  }
}

function startSpinAnimation() {
  els.reels.forEach((reel, reelIndex) => {
    reel.classList.add("spinning");
    let ticks = 0;
    const interval = window.setInterval(() => {
      ticks += 1;
      setSymbol(reel, randomVisualSymbol());
      if (reelIndex === 0) SlotAudio.tick(ticks);
      if (ticks > 18) window.clearInterval(interval);
    }, 70);
  });
}

async function play() {
  if (state.locked) return;

  if (state.balance < state.bet) {
    setMessage("Non hai abbastanza diamanti per questa puntata.", "lose");
    SlotAudio.lose();
    return;
  }

  state.locked = true;
  state.balance -= state.bet;
  state.rounds += 1;
  els.playButton.disabled = true;
  els.slotMachine.classList.add("is-spinning");
  setMessage("Connessione al destino... i rulli stanno girando.");
  updateHud();
  SlotAudio.spin();
  startSpinAnimation();
  emitSlotEvent("spin-start", { bet: state.bet, prize: prize(), balance: state.balance });

  try {
    const result = await resolveSpinOnServer({
      bet: state.bet,
      prize: prize(),
      clientBalance: state.balance,
      round: state.rounds,
    });

    window.setTimeout(() => finishSpin(result), 1500);
  } catch (error) {
    window.setTimeout(() => {
      finishSpin({
        ok: false,
        won: false,
        prize: 0,
        symbols: buildLosingSymbols(),
        message: "Errore validazione server. Nessun premio assegnato.",
      });
    }, 1000);
  }
}

function finishSpin(result) {
  const symbols = Array.isArray(result.symbols) && result.symbols.length === 3 ? result.symbols : buildLosingSymbols();

  els.reels.forEach((reel, index) => {
    reel.classList.remove("spinning");
    setSymbol(reel, symbols[index]);
  });

  state.locked = false;
  els.playButton.disabled = false;
  els.slotMachine.classList.remove("is-spinning");

  const won = Boolean(result.ok !== false && result.won);
  const awarded = Number(result.prize || (won ? prize() : 0));

  if (won) {
    state.balance += awarded;
    state.totalWon += awarded;
    els.lastResult.textContent = `+${awarded}`;
    setMessage(`Jackpot Infinity! Hai vinto ${awarded} diamanti.`, "win");
    pushHistory(`3x Infinity: +${awarded} diamanti`);
    SlotAudio.win();
    coinBurst();
  } else {
    els.lastResult.textContent = "Perso";
    setMessage(result.message || "Non sono usciti tre loghi Infinity. Ritenta.", "lose");
    pushHistory(`Round ${state.rounds}: -${state.bet} diamanti`);
    SlotAudio.lose();
  }

  updateHud();
  emitSlotEvent("spin-end", {
    won,
    awarded,
    symbols,
    bet: state.bet,
    balance: state.balance,
    round: state.rounds,
  });
}

els.bets.forEach((button) => button.addEventListener("click", () => setBet(button)));
els.playButton.addEventListener("click", play);
els.soundToggle.addEventListener("click", () => {
  state.sound = !state.sound;
  SlotAudio.enabled = state.sound;
  els.soundToggle.classList.toggle("active", state.sound);
  els.soundToggle.textContent = state.sound ? "Sound" : "Mute";
});

setSymbol(els.reels[0], "infinity");
setSymbol(els.reels[1], "diamond");
setSymbol(els.reels[2], "chest");
updateHud();
