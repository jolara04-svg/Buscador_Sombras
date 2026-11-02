const net = require('node:net');
const http = require('node:http');
const originalListen = net.Server.prototype.listen;

function remappedListen(port, ...args) {
  return originalListen.call(this, process.env.TEST_PORT, ...args);
}

net.Server.prototype.listen = remappedListen;
http.Server.prototype.listen = remappedListen;

require('../server.js');
