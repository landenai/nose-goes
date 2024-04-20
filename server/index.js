import { WebSocketServer } from 'ws';
import { v4 as uuid } from 'uuid';
import express from 'express';

const STARTING_POSITION = { x: 640, y: 350 };
const X_BOUND = 1245;
const Y_BOUND = 650;
const SPEED = 3; // SPEED * refreshRateMS becomes moveTo speed
const MIN_DISTANCE = 200;

const gameState = {
  players: {},
  nose: {
    previousLocation: {},
    currentLocation: {},
  },
};

// Static file mgmt

const app = express();
app.use(express.static('./public'));
app.listen(3000, () => {
  console.log('Express server listening on 3000');
});

// Websocket definition
const wss = new WebSocketServer({ port: 8080 });

let viewClient = { id: null, ws: null };

wss.on('connection', function connection(ws) {
  console.log('new connection');
  const id = uuid();
  ws.on('error', console.error);

  ws.on('close', function message() {
    if (id === viewClient.id) {
      viewClient = { id: null, ws: null };
    }
  });

  ws.on('message', function message(data) {
    try {
      const json = JSON.parse(data);
      switch (json.type) {
        case 'initPlayer':
          addPlayer({ name: json.data.name, id });
          viewClient.ws.send(
            JSON.stringify({
              type: 'initPlayer',
              player: gameState.players[id],
            })
          );
          ws.send(JSON.stringify({ data: { id } }));
          break;
        case 'initView':
          console.log('initView');
          if (viewClient.id) {
            console.log('view client already connected');
            break;
          }
          viewClient = { id: id, ws: ws };
          gameState.nose.currentLocation = generateNose();
          viewClient.ws.send(
            JSON.stringify({
              type: 'initView',
              gameState,
            })
          );
          break;
        case 'move':
          movePlayer({
            deltaX: json.data.direction.x,
            deltaY: json.data.direction.y,
            id: id,
          });
          viewClient.ws.send(
            JSON.stringify({
              type: 'move',
              gameState,
            })
          );
          break;
      }
    } catch (e) {
      console.log(e);
    }
  });
});

// adds player to global game state
const addPlayer = ({ name, id }) => {
  if (!name || !id) {
    console.log('invalid player');
    return;
  }
  gameState.players[id] = {
    id,
    name,
    position: STARTING_POSITION,
    isFinished: false,
  };
};

const movePlayer = ({ deltaX, deltaY, id }) => {
  let isMoving = Boolean(deltaX && deltaY);

  let { x, y } = gameState.players[id].position;
  console.log(`---- move ${id} ----`);
  console.log(`ogpos: ${x} ${y}`);
  console.log(`invec: ${deltaX} ${deltaY}`);
  console.log(
    `delta: ${Math.floor(deltaX * SPEED)} ${Math.floor(
      deltaY * SPEED
    )}`
  );

  x += Math.floor(deltaX * SPEED);
  y += Math.floor(deltaY * SPEED);

  if (x > X_BOUND || x < -10) {
    return;
  }
  if (y > Y_BOUND || y < -10) {
    return;
  }
  console.log(`  out: ${x} ${y}`);

  gameState.players[id] = {
    ...gameState.players[id],
    position: { x, y },
    isMoving,
  };
};

const generateNose = () => {
  const x = Math.floor(Math.random() * X_BOUND) + 1;
  const y = Math.floor(Math.random() * Y_BOUND) + 1;
  return { x, y };
};

const generateNewNose = () => {
  let distance;
  let x, y;
  do {
    [x, y] = generateNoseLocation();
    distance = calculateDistance(
      x,
      y,
      gameState.nose.currentLocation.x,
      gameState.nose.currentLocation.y
    );
  } while (distance < MIN_DISTANCE);
  return { x, y };
};

const calculateDistance = (x1, y1, x2, y2) => {
  return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
};
