import { WebSocketServer } from "ws";
import { stringify, v4 as uuid } from "uuid";
import express from "express";

const STARTING_POSITION = { x: 640, y: 350 };
const X_BOUND = 1245;
const Y_BOUND = 650;
const SPEED = 5;
const MIN_DISTANCE = 200;

const gameState = {
  players: {},
  nose: {
    previousLocation: {},
    currentLocation: {},
  },
  loser: null,
};

// Static file mgmt

const app = express();
app.use(express.static("./public"));
app.listen(3000, () => {
  console.log("Express server listening on 3000");
});

// Websocket definition
const wss = new WebSocketServer({ port: 8080 });

let viewClient = { id: null, ws: null };

wss.on("connection", function connection(ws) {
  console.log("new connection");
  const id = uuid();
  ws.on("error", console.error);

  ws.on("close", function message(data) {
    if (id === viewClient.id) {
      viewClient = { id: null, ws: null };
    }
  });

  ws.on("message", function message(data) {
    try {
      const json = JSON.parse(data);
      switch (json.type) {
        case "initPlayer":
          addPlayer({ name: json.data.name, id });
          viewClient.ws.send(JSON.stringify(gameState));
          ws.send(JSON.stringify({ data: { id: id } }));
          break;
        case "initView":
          console.log("initView");
          if (viewClient.id) {
            console.log("view client already connected");
            break;
          }
          viewClient = { id: id, ws: ws };
          gameState.nose.currentLocation = generateNose();
          viewClient.ws.send(JSON.stringify(gameState));
          break;
        case "move":
          movePlayer({
            deltaX: json.data.direction.x,
            deltaY: json.data.direction.y,
            id: id,
          });
          viewClient.ws.send(JSON.stringify(gameState));
          break;
        case "finish":
          gameState.players[json.data.id].isFinished = true;
          const loser = checkForLoser();
          if (loser) gameState.loser = loser;
          viewClient.ws.send(JSON.stringify(gameState));
          break;
      }
    } catch (e) {
      console.log(e);
    }
  });
});

const addPlayer = ({ name, id }) => {
  if (!name || !id) {
    console.log("invalid player");
    return;
  }
  console.log(id);
  gameState.players[id] = {
    name: name,
    position: STARTING_POSITION,
    isFinished: false,
  };
};

const movePlayer = ({ deltaX, deltaY, id }) => {
  let isMoving = deltaX && deltaY;
  let { x, y } = gameState.players[id].position;
  x += deltaX * SPEED;
  y += deltaY * SPEED;
  if (x > X_BOUND || x < -10) {
    return;
  }
  if (y > Y_BOUND || y < -10) {
    return;
  }

  gameState.players[id] = {
    ...gameState.players[id],
    position: { x, y },
    isMoving: isMoving,
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

const checkForLoser = () => {
  let loser = null;
  for (const [id, player] of Object.entries(gameState.players)) {
    if (player.isFinished) continue;
    if (!loser) {
      loser = null;
      break;
    }
    loser = id;
  }
  return loser;
};
