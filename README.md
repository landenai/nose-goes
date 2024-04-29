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
```

## Things to consider

- session storage
- lag will hurt through zoom + with so many players
- bad actors around player ws id?
- bad actors around ws messages?
- name input limit
- names: add a unique per player seed? ws id? so two "ben"s aren't the same face

## TODO:

- [ ] Cute little stick dudes
  - [x] Make / Add a sprite sheet
  - [x] Animate it
  - [x] Make them distinguishable
- [ ] Make it a game
  - [x] Start: Drop a nose randomly
  - [ ] End: All players are on the nose
  - [x] Loser: last person to the nose => some sad animation?
  - [x] Winner: points?
- [ ] Websocket management
  - [ ] drop player on disconnect
- [x] Hosting
  - [x] host the game server somewhere
- [ ] Misc
  - [ ] color trails
  - [ ] a setting
  - [ ] a maze / obstacles

## Acknowledgements

- cute stickmen from [crazygamer3124](https://crazygamer3124.itch.io/pixel-stickman-8x8)
