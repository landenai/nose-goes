# nose-goes

## Current Gotchas
The websocket URL will need to be updated whenever the ngrok server changes. OR you can update it to be the `ws://localhost:8080` server.

## Running
```bash
## quickly host the player / game states on localhost:3000/player.html + game.html
python -m http.server 3000

## run the websocket server on 8080
node server/websockets.js
```
