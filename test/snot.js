// A single instance of a spoofed player
// A Snot is just a worker thread
// Instantiates a WebSocket connection and sends movement messages
import { workerData, parentPort } from 'worker_threads';
import { faker } from '@faker-js/faker';
import WebSocket from 'ws';

const { runtime, refreshRate, endpoint } = workerData;

if (!runtime) {
  console.error('snot:: did not receive runtime length');
}

const ws = new WebSocket(endpoint);
const name = faker.person.firstName();
let noseLocation = {
  x: faker.number.int({ min: 0, max: 1200 }),
  y: faker.number.int({ min: 0, max: 700 }),
}; // just some random spot
let myLocation = { x: 0, y: 0 };

const jitter = () => Math.random() * 20 - 10;

const calculateDirectionToNose = () => ({
  x: (noseLocation.x - myLocation.x) + jitter(),
  y: (noseLocation.y - myLocation.y) + jitter(),
});

ws.on('error', console.error);
ws.on('close', console.log);
ws.on('open', () => {
  console.log(`initing ${name}`);
  ws.send(JSON.stringify({ type: 'initPlayer', data: { name } }));
  parentPort.postMessage({ name, event: 'init' });

  const wander = () => {
    ws.send(JSON.stringify({
      type: 'move',
      data: {
        direction: calculateDirectionToNose(),
      },
    }));
    setTimeout(wander, refreshRate);
  };

  setTimeout(wander, refreshRate);
});

ws.on('message', (message) => {
  try {
    const data = JSON.parse(message);

    noseLocation = data.noseLocation;
    myLocation = data.playerLocation;
  } catch (e) {
    console.error('got something that wasn\'t a snot broadcast');
    console.error(message);
    console.error(e);
  }
});

setTimeout(() => {
  console.log(`${name} logging off`);
  parentPort.postMessage({ name, event: 'complete' });
  process.exit(0);
}, runtime);
