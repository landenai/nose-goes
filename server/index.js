import { WebSocketServer } from "ws";
import { v4 as uuid } from "uuid";
import express from "express";

const STARTING_POSITION = { x: 640, y: 350 };
const X_BOUND = 1245;
const Y_BOUND = 650;
const SPEED = 8;
const MIN_DISTANCE = 200;
const REFRESH_RATE_MS = 100;

const gameState = {
  players: {},
  nose: {
    previousLocation: {},
    currentLocation: {},
  },
  playersRemaining: 0,
};

// Static file mgmt

const app = express();
app.use(express.static("./public"));
app.listen(3000, () => {
  console.log("👃 \tGame view \thttp://localhost:3000/game.html");
  console.log("🕹️ \tPlayer view \thttp://localhost:3000/player.html");
});

// Websocket definition
// TODO: possibly separate primarily incoming player WS from primarily outgoing view WS?
const wss = new WebSocketServer({ port: 8080 });
console.log("🗣️ \tWebsocket \tws://localhost:8080/");

let viewClient = { id: null, ws: null };

// adds player to global game state
const addPlayer = ({ name, id }) => {
  if (!name || !id) {
    console.log("invalid player");
    return;
  }

  gameState.playersRemaining += 1;

  gameState.players[id] = {
    id,
    name,
    position: STARTING_POSITION,
    isFinished: false,
  };
};

// assumes that x and y are non-zero (because of where it is invoked in `onTick()`
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
  console.log(`---- move ${id} ----`);
  console.log(`ogpos: ${posX} ${posY}`);
  console.log(`invec: ${deltaX} ${deltaY}`);
  console.log(
    `delta: ${Math.floor(deltaX * SPEED)} ${Math.floor(deltaY * SPEED)}`
  );

  posX += Math.floor(deltaX * SPEED);
  posY += Math.floor(deltaY * SPEED);

  if (posX > X_BOUND || posX < -10) {
    return;
  }
  if (posY > Y_BOUND || posY < -10) {
    return;
  }
  console.log(`  out: ${posX} ${posY}`);

  gameState.players[id] = {
    ...gameState.players[id],
    position: { x: posX, y: posY },
  };
};

const generateNose = () => {
  const x = Math.floor(Math.random() * X_BOUND);
  const y = Math.floor(Math.random() * Y_BOUND);
  return { x, y };
};

const calculateDistance = (x1, y1, x2, y2) =>
  Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

const generateNewNose = () => {
  let distance;
  let x;
  let y;
  do {
    [x, y] = generateNewNose();
    distance = calculateDistance(
      x,
      y,
      gameState.nose.currentLocation.x,
      gameState.nose.currentLocation.y
    );
  } while (distance < MIN_DISTANCE);
  return { x, y };
};

wss.on("connection", (ws) => {
  console.log("new connection");
  const id = uuid();
  ws.on("error", console.error);

  ws.on("close", () => {
    if (id === viewClient.id) {
      viewClient = { id: null, ws: null };
    }
  });

  ws.on("message", (data) => {
    try {
      const json = JSON.parse(data);
      switch (json.type) {
        case "initPlayer":
          addPlayer({ name: json.data.name, id });
          viewClient.ws.send(
            JSON.stringify({
              type: "initPlayer",
              player: gameState.players[id],
            })
          );
          ws.send(JSON.stringify({ data: { id } }));
          break;

        case "initView":
          console.log("initView");
          if (viewClient.id) {
            console.log("view client already connected");
            break;
          }
          viewClient = { id, ws };
          gameState.nose.currentLocation = generateNose();
          viewClient.ws.send(
            JSON.stringify({
              type: "initView",
              gameState,
            })
          );
          break;

        case "move":
          if (!gameState.players[id].isFinished) {
            movePlayer({
              vecX: json.data.direction.x,
              vecY: json.data.direction.y,
              id,
            });
          }
          break;

        case "finish":
          console.log(`finishing for ${json.data.id}`);
          gameState.players[json.data.id].isFinished = true;
          gameState.playersRemaining -= 1;

          // TODO: some race condition?
          if (gameState.playersRemaining <= 1) {
            const loser = Object.values(gameState.players).filter(
              (p) => !p.isFinished
            )[0];
            console.log(`LOSER: ${JSON.stringify(loser)}`);

            viewClient.ws.send(
              JSON.stringify({
                type: "loser",
                id: loser.id,
              })
            );
          }

          break;
        default:
          console.log(`unexpected message type: ${json.type}`);
      }
    } catch (e) {
      console.log(e);
    }
  });

  const onTick = () => {
    if (viewClient && viewClient.ws) {
      viewClient.ws.send(
        JSON.stringify({
          type: "move",
          gameState,
        })
      );
    }
    setTimeout(onTick, REFRESH_RATE_MS);
  };

  onTick();
});
