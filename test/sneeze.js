// governs spawning a bunch of snots w/ the appropriate test configurations
// couldn't figure out how to spawn multiple _separate_ ws connections from a single file
// so leveraged Node Worker Threads to create unique WS connections on separate threads
import minimist from 'minimist';

import { Worker } from 'worker_threads';

const D_PLAYERS = 10;
const D_RUNTIME_S = 10;
const D_REFRESH_RATE_MS = 20;
const WS_ENDPOINT = 'ws://localhost:8080';

const argv = minimist(process.argv.slice(2));

if (argv.h) {
  console.log(`
    🤧 A script for load testing our game backend.

    Usage: node sneeze.js [OPTIONS]

    Options:
      -h           help
      -p {number}  # of snots (player instances) to spawn (default ${D_PLAYERS})
      -t {number}  # of seconds to run the simulation (default ${D_RUNTIME_S})
    `);
  process.exit(0);
}

const numPlayers = argv.p || D_PLAYERS;
const runtime = (argv.t || D_RUNTIME_S) * 1000;

console.log(`running test simulation w/ ${numPlayers} players for ${runtime} ms`);
console.log('view field at http://localhost:3000/game.html');

const createSnot = () => {
  console.log('making a snot');
  const snot = new Worker('./test/snot.js', {
    workerData: {
      runtime,
      refreshRate: D_REFRESH_RATE_MS,
      endpoint: WS_ENDPOINT,
    },
  });

  snot.on('exit', (code) => {
    if (code !== 0) {
      console.error(`irregular worker exit: ${code}`);
    }
  });
};

for (let i = 0; i < numPlayers; i += 1) {
  createSnot();
}
