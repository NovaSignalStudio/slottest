# Infinity Slots - integrazione retroserver/Nitro

La slot e pronta come widget client-side, ma la valuta reale deve essere gestita dal tuo server.
Il browser mostra animazioni, saldo e paytable; il server deve scalare diamanti, decidere i simboli e pagare.

## Flusso consigliato

1. Il client carica il saldo diamanti dal borsello utente.
2. Quando l'utente spinge `Spin`, il client invia puntata e round al server.
3. Il server controlla sessione utente, saldo e puntata.
4. Il server scala la puntata, genera il risultato, paga diamanti/raro e risponde col saldo aggiornato.
5. Il client anima la griglia e mostra il nuovo saldo in tempo reale.

Non pagare mai leggendo solo il risultato dal browser: il JS e modificabile dagli utenti.

## Collegamento rapido nel client Nitro

Inserisci questo dopo aver caricato `script.js`:

```html
<script>
  window.InfinitySlotBridge.setApiEndpoints({
    balance: "/api/infinity-slot/balance",
    spin: "/api/infinity-slot/spin"
  });
</script>
```

Oppure configura gli endpoint prima di `script.js`, cosi il saldo viene sincronizzato appena la slot parte:

```html
<script>
  window.InfinitySlotConfig = {
    balanceEndpoint: "/api/infinity-slot/balance",
    apiEndpoint: "/api/infinity-slot/spin"
  };
</script>
<script src="script.js"></script>
```

Se preferisci evitare HTTP e usare funzioni gia disponibili nel tuo Nitro:

```html
<script>
  window.InfinitySlotBridge.setBalanceResolver(async () => {
    return { diamonds: window.myNitroWallet.diamonds };
  });

  window.InfinitySlotBridge.setResolver(async (payload) => {
    return window.myNitroApi.spinInfinitySlot(payload);
  });
</script>
```

## Endpoint saldo

`GET /api/infinity-slot/balance`

Risposta:

```json
{
  "diamonds": 1450
}
```

## Endpoint spin

`POST /api/infinity-slot/spin`

Payload inviato dal client:

```json
{
  "bet": 10,
  "prize": 100,
  "clientBalance": 1440,
  "currency": "diamonds",
  "round": 12,
  "freeSpin": false
}
```

Il server deve ricalcolare internamente bet e payout, senza fidarsi di `prize` o `clientBalance`.

Risposta perdita:

```json
{
  "ok": true,
  "won": false,
  "prize": 0,
  "rarePrize": 0,
  "balance": 1430,
  "symbols": [
    ["diamond", "chest", "hc"],
    ["chip", "crown", "diamond"],
    ["hc", "seven", "chest"]
  ],
  "wins": []
}
```

Risposta vincita diamanti:

```json
{
  "ok": true,
  "won": true,
  "prize": 100,
  "rarePrize": 0,
  "balance": 1540,
  "symbols": [
    ["diamond", "infinity", "hc"],
    ["chip", "infinity", "crown"],
    ["seven", "infinity", "chest"]
  ],
  "wins": [
    { "id": "middle", "symbol": "infinity", "amount": 100, "currency": "diamonds" }
  ]
}
```

Risposta raro 1000 con tre 7 su diagonale:

```json
{
  "ok": true,
  "won": true,
  "prize": 0,
  "rarePrize": 1000,
  "balance": 1420,
  "symbols": [
    ["seven", "diamond", "hc"],
    ["chip", "seven", "crown"],
    ["diamond", "infinity", "seven"]
  ],
  "wins": [
    { "id": "diagonalDown", "symbol": "seven", "amount": 0, "rareAmount": 1000, "currency": "rare" }
  ]
}
```

## Puntate e paytable

Puntate supportate:

- 10 diamanti
- 20 diamanti
- 50 diamanti

Il paytable si aggiorna automaticamente quando cambia la puntata.

Premi linea centrale o diagonali:

- 3 Infinity: `bet x10` diamanti
- 3 Diamond: `bet x3` diamanti
- 3 Crown: `bet x2` diamanti + possibile bonus free spin
- 3 Chip: `bet x2` diamanti
- 3 Chest: `bet x1` diamanti
- 3 HC: `bet x1` diamanti
- 3 Seven: raro 1000

Linee supportate:

- `middle`: centro
- `diagonalDown`: alto-sinistra verso basso-destra
- `diagonalUp`: basso-sinistra verso alto-destra

## Eventi disponibili

```js
window.addEventListener("infinity-slot:balance-sync", (event) => {
  console.log("Saldo diamanti:", event.detail.balance);
});

window.addEventListener("infinity-slot:spin-start", (event) => {
  console.log("Spin iniziato:", event.detail);
});

window.addEventListener("infinity-slot:spin-end", (event) => {
  console.log("Spin finito:", event.detail);
});
```

## Note server-side

- Usa sempre la sessione/login reale dell'utente.
- Blocca puntate diverse da 10, 20, 50.
- Scala la puntata in una transazione atomica.
- Paga diamanti e raro nella stessa transazione del risultato.
- Salva log: user id, bet, symbols, prize, rarePrize, balance finale, timestamp.
- Non accettare `symbols`, `prize`, `rarePrize` o `balance` inviati dal client.
