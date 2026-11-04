const imageEl = document.getElementById('imageEl');
const videoEl = document.getElementById('videoEl');
const overlay = document.getElementById('overlay');
const idleUrl = document.getElementById('idleUrl');
let currentMedia = null;
let playRequestId = 0;
let latestStatus = null;
function setOverlay(text) { overlay.textContent = text; }
function updateIdleUrl() {
  if (latestStatus && latestStatus.isDefaultActive && latestStatus.controllerUrl) {
    idleUrl.textContent = `Controller: ${latestStatus.controllerUrl}`;
    idleUrl.classList.remove('hidden');
  } else {
    idleUrl.classList.add('hidden');
  }
}
function resetVideoElement() { videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load(); videoEl.classList.add('hidden'); }
function showImage(media) {
  currentMedia = media; playRequestId += 1; resetVideoElement();
  imageEl.src = media.mediaPath; imageEl.classList.remove('hidden'); setOverlay(`Showing: ${media.title}`); updateIdleUrl();
}
function waitForCanPlay(video, requestId) {
  return new Promise((resolve, reject) => {
    const onCanPlay = () => { cleanup(); if (requestId !== playRequestId) return reject(new Error('Superseded by newer play request')); resolve(); };
    const onError = () => { cleanup(); reject(video.error || new Error('Video failed to load')); };
    const cleanup = () => { video.removeEventListener('canplay', onCanPlay); video.removeEventListener('error', onError); };
    video.addEventListener('canplay', onCanPlay, { once: true });
    video.addEventListener('error', onError, { once: true });
  });
}
async function playVideo(media, loopEnabled) {
  const requestId = ++playRequestId; currentMedia = media;
  imageEl.classList.add('hidden'); imageEl.removeAttribute('src'); resetVideoElement(); idleUrl.classList.add('hidden');
  videoEl.classList.remove('hidden'); videoEl.loop = !!loopEnabled; videoEl.muted = true; videoEl.playsInline = true; videoEl.src = media.mediaPath; videoEl.load();
  try { await waitForCanPlay(videoEl, requestId); if (requestId !== playRequestId) return; await videoEl.play(); setOverlay(`Playing: ${media.title}`); }
  catch (error) { if (requestId !== playRequestId) return; console.error('Playback failed', error); setOverlay(`Playback failed: ${media.title} (${error.name || 'Error'})`); sendMessage({ type:'playbackError', mediaId:media.id, message:`${error.name || 'Error'}: ${error.message || 'Unknown playback error'}` }); }
}
function pauseVideo() { if (!videoEl.classList.contains('hidden')) { videoEl.pause(); setOverlay(currentMedia ? `Paused: ${currentMedia.title}` : 'Paused'); } }
async function resumeVideo() { if (!videoEl.classList.contains('hidden')) { try { await videoEl.play(); setOverlay(currentMedia ? `Playing: ${currentMedia.title}` : 'Playing'); } catch (error) { console.error('Resume failed', error); setOverlay(`Resume failed (${error.name || 'Error'})`); } } }
function setLoop(loopEnabled) { videoEl.loop = !!loopEnabled; }
function handlePlayerCommand(message) { switch (message.command) { case 'show': showImage(message.media); break; case 'play': playVideo(message.media, message.loopEnabled); break; case 'pause': pauseVideo(); break; case 'resume': resumeVideo(); break; case 'setLoop': setLoop(message.loopEnabled); break; default: console.warn('Unknown player command', message); } }
function sendMessage(payload) { if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload)); }
videoEl.addEventListener('ended', () => { if (currentMedia && !videoEl.loop) { setOverlay(`Ended: ${currentMedia.title}`); sendMessage({ type:'playbackEnded', mediaId:currentMedia.id }); } });
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
socket.addEventListener('open', async () => { sendMessage({ type:'playerReady' }); try { const s = await fetch('/api/player-status').then(r => r.json()); latestStatus = s; updateIdleUrl(); } catch {} });
socket.addEventListener('message', event => { try { const message = JSON.parse(event.data); if (message.type === 'status' && message.status) { latestStatus = message.status; updateIdleUrl(); } if (message.type === 'playerCommand') handlePlayerCommand(message); } catch (error) { console.error('Invalid socket message', error); } });
socket.addEventListener('close', () => setOverlay('Socket disconnected'));
socket.addEventListener('error', () => setOverlay('Socket error'));
