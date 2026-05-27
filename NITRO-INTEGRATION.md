# Infinity Rush - integrazione Nitro

La grafica e l'animazione sono client-side, ma la vincita reale deve essere decisa dal server.

## Opzione 1: funzione bridge nel client Nitro

Definisci questa funzione prima o subito dopo aver caricato `script.js`:

```html
<script>
  window.InfinityNitroSlot = {
    async spin(payload) {
      // payload: { bet, prize, clientBalance, round }
      // Chiama il tuo server/emulatore e torna un risultato validato.
      return {
        ok: true,
        won: true,
        prize: payload.prize,
        symbols: ["infinity", "infinity", "infinity"]
      };
    }
  };
</script>
```

## Opzione 2: endpoint HTTP

Nel client:

```js
window.InfinitySlotBridge.setApiEndpoint("/api/minigames/infinity-rush/spin");
```

Il server deve rispondere:

```json
{
  "ok": true,
  "won": true,
  "prize": 100,
  "symbols": ["infinity", "infinity", "infinity"]
}
```

Per una perdita:

```json
{
  "ok": true,
  "won": false,
  "prize": 0,
  "symbols": ["diamond", "chest", "hc"]
}
```

## Eventi disponibili

```js
window.addEventListener("infinity-slot:spin-start", (event) => {
  console.log(event.detail);
});

window.addEventListener("infinity-slot:spin-end", (event) => {
  console.log(event.detail);
});
```

Non assegnare diamanti leggendo il risultato dal browser: usa sempre la risposta server.
