const libraryEl = document.getElementById('library');
const statusCardEl = document.getElementById('statusCard');
let libraryData = null;
let currentStatus = null;
let openFolderId = null;

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (response.status === 401) { window.location.href = '/login'; return; }
  if (!response.ok) throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  return response.json();
}
async function loadLibrary() { libraryData = await fetchJson('/api/library'); renderLibrary(); }
async function loadStatus() { currentStatus = await fetchJson('/api/status'); renderStatus(); }
async function playMedia(mediaId) {
  try {
    const result = await fetchJson('/api/play', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ mediaId }) });
    if (result && result.ok && result.status) { currentStatus = result.status; renderStatus(); renderLibrary(); }
  } catch (error) { console.error('Play failed', error); alert('Failed to start media.'); }
}
async function pauseOrResume() {
  if (!currentStatus || !currentStatus.pauseAllowed) return;
  try {
    const result = await fetchJson('/api/pause', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({}) });
    if (result && result.ok && result.status) { currentStatus = result.status; renderStatus(); }
  } catch (error) { console.error('Pause/resume failed', error); alert('Failed to pause or resume.'); }
}
async function stopPlayback() {
  try {
    const result = await fetchJson('/api/stop', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({}) });
    if (result && result.ok && result.status) { currentStatus = result.status; renderStatus(); renderLibrary(); }
  } catch (error) { console.error('Stop failed', error); alert('Failed to stop playback.'); }
}
async function setLoop(loopEnabled) {
  try {
    const result = await fetchJson('/api/loop', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ loopEnabled }) });
    if (result && result.ok && result.status) { currentStatus = result.status; renderStatus(); }
  } catch (error) { console.error('Loop toggle failed', error); alert('Failed to change loop setting.'); }
}
async function logout() {
  await fetchJson('/api/logout', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({}) });
  window.location.href = '/login';
}
function toggleFolder(folderId) { openFolderId = openFolderId === folderId ? null : folderId; renderLibrary(); }
function getPauseButtonLabel() { if (!currentStatus || currentStatus.type !== 'video') return 'Pause'; return currentStatus.playbackState === 'paused' ? 'Resume' : 'Pause'; }
function renderStatus() {
  if (!statusCardEl) return;
  if (!currentStatus) { statusCardEl.innerHTML = `<div class="status-title">Status</div><div class="status-loading">Loading status…</div>`; return; }
  const { title, type, description, playbackState, loopEnabled, pauseAllowed, controllerUrl } = currentStatus;
  const prettyType = type === 'video' ? 'Video' : 'Image';
  const prettyState = playbackState === 'playing' ? 'Playing' : playbackState === 'paused' ? 'Paused' : 'Displayed';
  statusCardEl.innerHTML = `
    <div class="status-title">Status</div>
    <div class="status-grid">
      <div class="status-label">Title</div><div class="status-value">${escapeHtml(title || '')}</div>
      <div class="status-label">Type</div><div class="status-value">${prettyType}</div>
      <div class="status-label">State</div><div class="status-value">${prettyState}</div>
      <div class="status-label">Loop</div><div class="status-value">${loopEnabled ? 'On' : 'Off'}</div>
    </div>
    <div class="status-description-block"><div class="status-label status-description-label">Description</div><div class="status-description">${escapeHtml(description || '')}</div></div>
    <div class="status-description-block"><div class="status-label status-description-label">Controller URL</div><div class="status-description">${escapeHtml(controllerUrl || '')}</div></div>
    <div class="status-controls">
      <button class="control-button" id="pauseButton" ${pauseAllowed ? '' : 'disabled'}>${getPauseButtonLabel()}</button>
      <button class="control-button" id="stopButton">Stop</button>
      <button class="control-button ${loopEnabled ? 'active' : ''}" id="loopButton">Loop ${loopEnabled ? 'On' : 'Off'}</button>
      <button class="control-button" id="logoutButton">Log Out</button>
    </div>`;
  document.getElementById('pauseButton')?.addEventListener('click', pauseOrResume);
  document.getElementById('stopButton')?.addEventListener('click', stopPlayback);
  document.getElementById('loopButton')?.addEventListener('click', () => setLoop(!currentStatus.loopEnabled));
  document.getElementById('logoutButton')?.addEventListener('click', logout);
}
function renderLibrary() {
  if (!libraryEl) return;
  if (!libraryData || !Array.isArray(libraryData.folders)) { libraryEl.innerHTML = `<div class="library-loading">Loading library…</div>`; return; }
  const foldersHtml = libraryData.folders.map(folder => {
    const isOpen = folder.id === openFolderId;
    const itemCount = Array.isArray(folder.items) ? folder.items.length : 0;
    const itemsHtml = isOpen ? `<div class="accordion-content"><div class="media-grid">${(folder.items || []).map(renderMediaCard).join('')}</div></div>` : '';
    return `<section class="accordion-section ${isOpen ? 'open' : ''}" data-folder-id="${escapeHtmlAttr(folder.id)}"><button class="accordion-header" data-folder-toggle="${escapeHtmlAttr(folder.id)}"><span class="accordion-left"><span class="accordion-chevron">${isOpen ? '▼' : '▶'}</span><span class="accordion-title">${escapeHtml(folder.label)}</span></span><span class="accordion-count">${itemCount}</span></button>${itemsHtml}</section>`;
  }).join('');
  libraryEl.innerHTML = `<div class="library-title">Media Library</div><div class="accordion">${foldersHtml}</div>`;
  libraryEl.querySelectorAll('[data-folder-toggle]').forEach(button => button.addEventListener('click', () => toggleFolder(button.getAttribute('data-folder-toggle'))));
  libraryEl.querySelectorAll('[data-media-id]').forEach(card => card.addEventListener('click', () => playMedia(card.getAttribute('data-media-id'))));
}
function renderMediaCard(item) {
  const isCurrent = currentStatus && currentStatus.currentMediaId === item.id;
  return `<article class="media-card ${isCurrent ? 'current' : ''}" data-media-id="${escapeHtmlAttr(item.id)}" role="button" tabindex="0"><div class="media-thumb-wrap"><img class="media-thumb" src="${escapeHtmlAttr(item.thumbnailPath)}" alt="${escapeHtmlAttr(item.title)}" loading="lazy" /></div><div class="media-card-body"><div class="media-card-title-row"><h3 class="media-card-title">${escapeHtml(item.title)}</h3><span class="media-type-pill">${item.type === 'video' ? 'Video' : 'Image'}</span></div><p class="media-card-description">${escapeHtml(item.description || '')}</p></div></article>`;
}
function escapeHtml(value) { return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'); }
function escapeHtmlAttr(value) { return escapeHtml(value); }
function setupKeyboardSupport() { document.addEventListener('keydown', event => { const card = event.target.closest('[data-media-id]'); if (!card) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); playMedia(card.getAttribute('data-media-id')); } }); }
function setupSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
  socket.addEventListener('message', event => { try { const message = JSON.parse(event.data); if (message.type === 'status' && message.status) { currentStatus = message.status; renderStatus(); renderLibrary(); } } catch (error) { console.error('Invalid socket message', error); } });
  socket.addEventListener('close', () => console.warn('Socket disconnected'));
  socket.addEventListener('error', error => console.error('Socket error', error));
}
async function init() {
  renderStatus(); renderLibrary(); setupKeyboardSupport(); setupSocket();
  try { await Promise.all([loadLibrary(), loadStatus()]); if (!openFolderId && libraryData?.folders?.length > 0) { openFolderId = libraryData.folders[0].id; renderLibrary(); } } catch (error) { console.error('Initialization failed', error); statusCardEl.innerHTML = `<div class="status-title">Status</div><div class="status-error">Failed to load controller data.</div>`; libraryEl.innerHTML = `<div class="library-error">Failed to load media library.</div>`; }
}
init();
