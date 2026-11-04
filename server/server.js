const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const WebSocket = require('ws');
const config = require('./config');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const CATALOG_PATH = path.join(ROOT, 'catalog', 'library.json');

function readCatalog() {
  const raw = fs.readFileSync(CATALOG_PATH, 'utf8');
  return JSON.parse(raw);
}

let catalog = readCatalog();
let itemById = new Map();

function rebuildIndex() {
  itemById = new Map();
  for (const folder of catalog.folders || []) {
    for (const item of folder.items || []) {
      if (itemById.has(item.id)) throw new Error(`Duplicate media id: ${item.id}`);
      itemById.set(item.id, item);
    }
  }
  if (!itemById.has(catalog.defaultMediaId)) throw new Error(`defaultMediaId not found: ${catalog.defaultMediaId}`);
}
rebuildIndex();

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

function controllerUrl(req) {
  const host = req ? req.get('host') : `${getLanIp()}:${config.port}`;
  const port = String(config.port);
  const ip = getLanIp();
  if (host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
    return `http://${host}/controller/`;
  }
  return `http://${ip}:${port}/controller/`;
}

const defaultItem = () => itemById.get(catalog.defaultMediaId);
let runtimeState = {
  currentMediaId: catalog.defaultMediaId,
  playbackState: 'displayed',
  loopEnabled: true,
  isDefaultActive: true
};

function makeStatus(req) {
  const item = itemById.get(runtimeState.currentMediaId) || defaultItem();
  return {
    currentMediaId: item.id,
    title: item.title,
    type: item.type,
    description: item.description,
    mediaPath: item.mediaPath,
    thumbnailPath: item.thumbnailPath,
    playbackState: runtimeState.playbackState,
    loopEnabled: runtimeState.loopEnabled,
    isDefaultActive: item.id === catalog.defaultMediaId,
    pauseAllowed: item.type === 'video',
    stopAllowed: true,
    controllerUrl: controllerUrl(req)
  };
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' }
}));

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.redirect('/login');
}
function requireApiAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.status(401).json({ ok: false, error: 'NOT_AUTHENTICATED' });
}

app.get('/login', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'controller', 'login.html')));
app.post('/api/login', (req, res) => {
  if (req.body && req.body.password === config.controllerPassword) {
    req.session.authenticated = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false, error: 'BAD_PASSWORD' });
});
app.post('/api/logout', requireApiAuth, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.use('/controller', requireAuth, express.static(path.join(PUBLIC_DIR, 'controller')));
app.use('/player', express.static(path.join(PUBLIC_DIR, 'player')));
app.use('/media', express.static(path.join(PUBLIC_DIR, 'media')));
app.use('/thumbs', express.static(path.join(PUBLIC_DIR, 'thumbs')));
app.use('/defaults', express.static(path.join(PUBLIC_DIR, 'defaults')));

app.get('/', (req, res) => res.redirect('/controller/'));
app.get('/api/library', requireApiAuth, (req, res) => res.json(catalog));
app.get('/api/status', requireApiAuth, (req, res) => res.json(makeStatus(req)));
app.get('/api/player-status', (req, res) => res.json(makeStatus(req)));

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}
function broadcastStatus(req) {
  broadcast({ type: 'status', status: makeStatus(req) });
}
function sendPlayerCommand(command, extra = {}) {
  broadcast({ type: 'playerCommand', command, ...extra });
}

app.post('/api/play', requireApiAuth, (req, res) => {
  const mediaId = req.body && req.body.mediaId;
  const item = itemById.get(mediaId);
  if (!item) return res.status(404).json({ ok: false, error: 'MEDIA_NOT_FOUND' });
  runtimeState.currentMediaId = item.id;
  runtimeState.playbackState = item.type === 'video' ? 'playing' : 'displayed';
  runtimeState.isDefaultActive = item.id === catalog.defaultMediaId;
  sendPlayerCommand(item.type === 'video' ? 'play' : 'show', { media: item, loopEnabled: runtimeState.loopEnabled });
  broadcastStatus(req);
  res.json({ ok: true, status: makeStatus(req) });
});

app.post('/api/pause', requireApiAuth, (req, res) => {
  const item = itemById.get(runtimeState.currentMediaId);
  if (!item || item.type !== 'video') return res.status(400).json({ ok: false, error: 'PAUSE_NOT_ALLOWED_FOR_IMAGE' });
  if (runtimeState.playbackState === 'paused') {
    runtimeState.playbackState = 'playing';
    sendPlayerCommand('resume');
  } else {
    runtimeState.playbackState = 'paused';
    sendPlayerCommand('pause');
  }
  broadcastStatus(req);
  res.json({ ok: true, status: makeStatus(req) });
});

app.post('/api/stop', requireApiAuth, (req, res) => {
  const item = defaultItem();
  runtimeState.currentMediaId = item.id;
  runtimeState.playbackState = item.type === 'video' ? 'playing' : 'displayed';
  runtimeState.isDefaultActive = true;
  sendPlayerCommand(item.type === 'video' ? 'play' : 'show', { media: item, loopEnabled: runtimeState.loopEnabled });
  broadcastStatus(req);
  res.json({ ok: true, status: makeStatus(req) });
});

app.post('/api/loop', requireApiAuth, (req, res) => {
  runtimeState.loopEnabled = !!req.body.loopEnabled;
  sendPlayerCommand('setLoop', { loopEnabled: runtimeState.loopEnabled });
  broadcastStatus(req);
  res.json({ ok: true, status: makeStatus(req) });
});

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'status', status: makeStatus() }));
  socket.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'playerReady') {
        const item = itemById.get(runtimeState.currentMediaId) || defaultItem();
        sendPlayerCommand(item.type === 'video' ? 'play' : 'show', { media: item, loopEnabled: runtimeState.loopEnabled });
        broadcastStatus();
      }
      if (msg.type === 'playbackEnded') {
        runtimeState.playbackState = 'displayed';
        broadcastStatus();
      }
      if (msg.type === 'playbackError') {
        console.warn('Player error:', msg);
      }
    } catch (err) {
      console.error('Bad websocket message', err);
    }
  });
});

server.listen(config.port, '0.0.0.0', () => {
  console.log(`Cart media appliance listening on http://localhost:${config.port}`);
  console.log(`Controller URL: http://${getLanIp()}:${config.port}/controller/`);
});
