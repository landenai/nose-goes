# nose-goes

A MMORPG (mini multiplayer online running player game) by @landenai and @binhrobles

[View the field](https://landenai.github.io/nose-goes/public/game.html) or [drop in!](https://landenai.github.io/nose-goes/public/player.html)

## Current Gotchas

The websocket URL will need to be updated in `config.js` whenever the ngrok server changes.

## Running

```bash
## quickly open the player / game views
open player.html
open game.html

## run the websocket server on 8080
npm start

## simulate a mob of players
npm run sneeze

### simulate w/ custom settings (20 players + 60s)
npm run sneeze -- -- -p 20 -t 60
```

## Things to consider

- session storage
- lag will hurt through zoom + with so many players
- bad actors around player ws id?
- bad actors around ws messages?
- name input limit
- names: add a unique per player seed? ws id? so two "ben"s aren't the same face

## TODO:

- [x] Cute little stick dudes
  - [x] Make / Add a sprite sheet
  - [x] Animate it
  - [x] Make them distinguishable
- [x] Make it a game
  - [x] Start: Drop a nose randomly
  - [x] End: All players are on the nose
  - [x] Loser: last person to the nose => some sad animation?
  - [x] Winner: points?
- [x] Websocket management
  - [x] drop player on disconnect
- [x] Hosting
  - [x] host the game server somewhere
- [ ] Misc
  - [ ] color trails
  - [ ] a setting
  - [ ] a maze / obstacles

## Acknowledgements

- cute stickmen from [crazygamer3124](https://crazygamer3124.itch.io/pixel-stickman-8x8)
- avatar faces from [dicebear](https://www.dicebear.com/playground/)
- client-server architecture guidance from [Gabriel Gambetta](https://www.gabrielgambetta.com/client-server-game-architecture.html)
