import { WebSocketServer } from "ws";
import { stringify, v4 as uuid } from "uuid";

const STARTING_POSITION = { x: 640, y: 350 };
const X_BOUND = 1245;
const Y_BOUND = 650;
const SPEED = 5;

const wss = new WebSocketServer({ port: 8080 });
const gameState = {
  players: {},
};
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
          console.log(JSON.stringify(json));
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
  gameState.players[id] = { name: name, position: STARTING_POSITION };
};

const movePlayer = ({ deltaX, deltaY, id }) => {
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
  };
};
