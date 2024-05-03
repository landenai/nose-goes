import WebSocket, { WebSocketServer } from 'ws';
import { v4 as uuid } from 'uuid';
import express from 'express';

const STARTING_POSITION = { x: 200, y: 80 };
const X_LOWER_BOUND = 20;
const X_UPPER_BOUND = 1260;
const Y_UPPER_BOUND = 680;
const Y_LOWER_BOUND = 40;
const SPEED = 8;
const MIN_DISTANCE = 200;
const REFRESH_RATE_MS = 100;
const PLAYER_IDLE_LIMIT_MS = 10 * 1000;
const NOSE_REMINDER_MS = 2 * 1000;
const IN_TEST_MODE = process.env.NODE_ENV === 'test';

const gameState = {
  players: {},
  nose: {
    previousLocation: {},
    currentLocation: {},
  },
  playersRemaining: 0,
};

// map of player IDs to ws connections
// for managing player connectivity separately from game state
const wsClients = {};

// Static file mgmt

const app = express();
app.use(express.static('./public'));
app.listen(3000, () => {
  console.log('👃 \tGame view \thttp://localhost:3000/game.html');
  console.log('🕹️ \tPlayer view \thttp://localhost:3000/player.html');
});

// player disconnection handling
// a reference to the player disconnection setTimeout
// a global reference so that we can clear it when the game ends
let playerDisconnectTimeout;
const playerDisconnectTick = () => {
  console.log(gameState);
  console.log('checking for inactive players');

  // for every player, check if movementReceived in last PLAYER_IDLE_LIMIT_MS period
  Object.entries(wsClients).forEach(([playerId, { isActive, ws }]) => {
    // remove any inactive connections
    if (!isActive) {
      console.log(`terminating ${playerId}`);
      ws.terminate(); // close the connection, which triggers `on('close')`
    }

    // now assume inactivity until player sends message up
    wsClients[playerId].isActive = false;
  });
  playerDisconnectTimeout = setTimeout(playerDisconnectTick, PLAYER_IDLE_LIMIT_MS);
};

// Websocket definition
// TODO: possibly separate primarily incoming player WS from primarily outgoing view WS?
const wss = new WebSocketServer({ port: 8080 });
console.log('🗣️ \tWebsocket \tws://localhost:8080/');

let viewClient = { id: null, ws: null };

// adds player to global game state
const addPlayer = ({ name, id, ws }) => {
  if (!name || !id) {
    console.log('invalid player');
    return;
  }

  gameState.playersRemaining += 1;

  gameState.players[id] = {
    id,
    name,
    position: { x: STARTING_POSITION.x + getXJitter(), y: STARTING_POSITION.y + getYJitter() },
    isFinished: false,
  };

  wsClients[id] = {
    isActive: true,
    ws,
  };
};

// assumes that x and y are non-zero (because of where it is invoked in `viewRefreshTick()`
const normalizeDirection = ({ x, y }) => {
  const magnitude = 1 / Math.sqrt(x ** 2 + y ** 2);
  return {
    x: x * magnitude,
    y: y * magnitude,
  };
};

const movePlayer = ({ vecX, vecY, id }) => {
  const { x: deltaX, y: deltaY } = normalizeDirection({ x: vecX, y: vecY });
  let { x: posX, y: posY } = gameState.players[id].position;

  posX += Math.floor(deltaX * SPEED);
  posY += Math.floor(deltaY * SPEED);

  if (posX > X_UPPER_BOUND || posX < X_LOWER_BOUND) {
    return;
  }
  if (posY > Y_UPPER_BOUND || posY < Y_LOWER_BOUND) {
    return;
  }

  gameState.players[id] = {
    ...gameState.players[id],
    position: { x: posX, y: posY },
  };
};

const generateNose = () => {
  const x = Math.floor(Math.random() * X_UPPER_BOUND + X_LOWER_BOUND);
  const y = Math.floor(Math.random() * Y_UPPER_BOUND + Y_LOWER_BOUND);
  if (x <= 350 && y <= 200) return generateNose();
  return { x, y };
};

const calculateDistance = (x1, y1, x2, y2) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

const generateNewNose = () => {
  const { x, y } = generateNose();
  const distance = calculateDistance(
    x,
    y,
    gameState.nose.currentLocation.x,
    gameState.nose.currentLocation.y,
  );
  console.log(`generated nose at ${x}, ${y} -- distance ${distance}`);

  if (distance < MIN_DISTANCE) return generateNewNose();

  return { x, y };
};

// decrements player count and checks if end game
// if so, triggers game over loop
const markOneLessPlayer = () => {
  if (gameState.playersRemaining > 0) gameState.playersRemaining -= 1;

  // if 1 remaining, end the game!
  if (gameState.playersRemaining === 1) {
    // first, clear the playerDisconnectTimeout, so players aren't disconnected
    // for not moving during the intermission
    clearTimeout(playerDisconnectTimeout);

    const loser = Object.values(gameState.players).filter(
      (p) => !p.isFinished,
    )[0];
    if (loser) {
      console.log(`LOSER: ${JSON.stringify(loser)}`);

      gameState.nose = {
        previousLocation: gameState.nose.currentLocation,
        currentLocation: generateNewNose(),
      };

      if (viewClient && viewClient.ws) {
        viewClient.ws.send(
          JSON.stringify({
            type: 'loser',
            playerId: loser.id,
            previousNoseLocation: gameState.nose.previousLocation,
            nextNoseLocation: gameState.nose.currentLocation,
          }),
        );
      }
    }
  }
};

// remove player from all global states
// tells the game to remove them from view
// and decrements the player count, potentially resulting in an end game
const handlePlayerDisconnect = (idToRemove) => {
  delete gameState.players[idToRemove];
  delete wsClients[idToRemove];
  if (viewClient && viewClient.ws) {
    viewClient.ws.send(
      JSON.stringify({
        type: 'removePlayer',
        playerId: idToRemove,
      }),
    );
  }
  markOneLessPlayer();
};

wss.on('connection', (ws) => {
  console.log('new connection');
  const id = uuid();

  ws.on('error', console.error);

  ws.on('close', () => {
    if (id === viewClient.id) {
      console.log('view client connection closed');
      viewClient = { id: null, ws: null };
    } else {
      console.log('player connection closed');
      handlePlayerDisconnect(id);
    }
  });

  ws.on('message', (data) => {
    try {
      const json = JSON.parse(data);
      switch (json.type) {
        case 'initPlayer':
          console.log(`adding ${json.data.name} at ${id}`);
          addPlayer({ name: json.data.name, id, ws });

          if (viewClient && viewClient.ws) {
            viewClient.ws.send(
              JSON.stringify({
                type: 'initPlayer',
                player: gameState.players[id],
              }),
            );
          }
          break;

        case 'initView':
          console.log('initView');
          if (viewClient.id) {
            console.log('view client already connected');
            break;
          }
          viewClient = { id, ws };

          gameState.nose.previousLocation = gameState.nose.currentLocation;
          gameState.nose.currentLocation = generateNose();

          viewClient.ws.send(
            JSON.stringify({
              type: 'initView',
              gameState,
            }),
          );
          break;

        // should be receiving this from every player every PLAYER_REFRESH_RATE_MS
        case 'move':
          wsClients[id].isActive = true;

          if (!gameState.players[id].isFinished) {
            movePlayer({
              vecX: json.data.direction.x,
              vecY: json.data.direction.y,
              id,
            });
          }
          break;

        case 'finish':
          if (id !== viewClient.id) break;

          console.log(`finishing for ${json.data.id}`);
          gameState.players[json.data.id].isFinished = true;
          markOneLessPlayer();
          break;

        case 'reset':
          if (id !== viewClient.id) break;

          // eslint-disable-next-line
          for (const [_, player] of Object.entries(gameState.players)) {
            player.position = {
              x: gameState.nose.previousLocation.x + getXJitter(),
              y: gameState.nose.previousLocation.y + getYJitter(),
            };
            player.isFinished = false;
          }
          gameState.playersRemaining = Object.entries(gameState.players).length;

          // start the playerDisconnect checks again
          playerDisconnectTimeout = setTimeout(playerDisconnectTick, PLAYER_IDLE_LIMIT_MS);

          console.log(gameState);
          break;

        default:
          console.log(`unexpected message type: ${json.type}`);
      }
    } catch (e) {
      console.log(e);
    }
  });
});

const viewRefreshTick = () => {
  if (viewClient && viewClient.ws) {
    viewClient.ws.send(
      JSON.stringify({
        type: 'move',
        gameState,
      }),
    );
  }
  setTimeout(viewRefreshTick, REFRESH_RATE_MS);
};

const snotBroadcast = () => {
  Object.keys(wsClients).forEach((id) => {
    const client = wsClients[id].ws;
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        playerLocation: gameState.players[id].position,
        noseLocation: gameState.nose.currentLocation,
      }));
    }
  });
  setTimeout(snotBroadcast, NOSE_REMINDER_MS);
};

const getXJitter = () => Math.random() * (40) - 20;
const getYJitter = () => Math.random() * (40) - 20;

viewRefreshTick();
playerDisconnectTimeout = setTimeout(playerDisconnectTick, PLAYER_IDLE_LIMIT_MS);

// if in test mode, broadcast the player and nose location for the snots regularly
if (IN_TEST_MODE) setTimeout(snotBroadcast, NOSE_REMINDER_MS);
