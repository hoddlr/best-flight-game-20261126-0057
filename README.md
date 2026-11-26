[![best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/hoddlr/best-flight-game-20261126-0057/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/hoddlr/best-flight-game-20261126-0057/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

# Sky Courier

A little red prop plane, a long valley, three parcels to deliver. Fly the
gold rings between the airstrips, land soft on the runways, and watch your
fuel — empty means a forced landing, and a hard landing or a hillside costs
you the airframe.

## How to play

- **W / S** or **↑ / ↓** — pitch the nose up and down
- **D / A** or **→ / ←** — throttle up and down
- **Space** or click — start, restart
- **P** or **Esc** — pause, **M** — mute the engine hum

Too slow and the wing stalls; too fast and turns bite less. Land on the
strip the parcel is bound for to deliver it. Three deliveries at High Pass
finishes the sortie.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Hand the entry in (Node 22, standard library only):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

The game is plain static files under `game/` — canvas 2D, no library, no
network request — with a procedural WebAudio engine hum and a seeded valley,
so every flight over the same terrain plays the same.
