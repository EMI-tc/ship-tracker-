// Ship Tracker Script
let ships = [];
let ports = [];
let map = null;
let shipMarker = null;
let autoUpdateInterval = null;
const UPDATE_INTERVAL = 30000; // 30 seconds
let isUsingMockData = true; // Tracks actual data source being used

// Data configuration (using mock data directly for GitHub Pages deployment)
const API_CONFIG = {
  mockData: './ships.json'            // 直接讀取靜態 JSON
};

// Debug div
let debugDiv = null;
function initDebug() {
  debugDiv = document.createElement('div');
  debugDiv.id = 'debug';
  debugDiv.style.cssText = 'position:fixed;bottom:0;left:0;right:0;height:100px;background:rgba(0,0,0,0.7);color:white;overflow:auto;pointer-events:none;z-index:9999;font-size:10px;padding:5px;';
  document.body.appendChild(debugDiv);
}
function debugLog(msg) {
  if (!debugDiv) return;
  const now = new Date();
  const time = now.toLocaleTimeString();
  debugDiv.textContent += `[${time}] ${msg}\n`;
  debugDiv.scrollTop = debugDiv.scrollHeight;
}

// Initialize map
function initMap() {
  debugLog('Initializing map');
  map = L.map('map').setView([25.0330, 121.5654], 10); // Default to Taipei
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  debugLog('Map initialized');
}

// Fetch ships data (directly from mock JSON)
async function fetchShips() {
  debugLog('[Ships] Starting fetch...');
  try {
    showLoading('ship-list');
    
    // Directly fetch from mock JSON
    const response = await fetch('./ships.json');
    if (!response.ok) throw new Error('Failed to fetch ships data: ' + response.status);
    
    const shipsData = await response.json();
    ships = shipsData;
    isUsingMockData = true;
    debugLog(`[Ships] Using local mock JSON, count: ${shipsData.length}`);
    
    renderShipList();
    updateDataSourceIndicator();
    
    if (ships.length > 0) {
      const shipSelect = document.getElementById('ship-select');
      if (shipSelect.value === '') {
        shipSelect.value = ships[0].imo;
        showShipDetail(ships[0].imo);
      } else {
        showShipDetail(shipSelect.value);
      }
    }
    hideLoading('ship-list');
    debugLog('[Ships] Done. Ships count:', ships.length);
  } catch (error) {
    console.error('Error fetching ships:', error);
    showError('ship-list', '載入船舶資料失敗: ' + error.message);
    debugLog('[Ships] Error: ' + error.message);
    hideLoading('ship-list');
  }
}

// Fetch ports data (directly from mock JSON)
async function fetchPorts() {
  try {
    debugLog('[Ports] Starting fetch...');
    showLoading('ports-list');
    
    // Directly fetch from mock JSON
    const response = await fetch('./ports.json');
    if (!response.ok) throw new Error('Failed to fetch ports data: ' + response.status);
    
    const portsData = await response.json();
    ports = portsData;
    debugLog(`[Ports] Using local mock JSON, count: ${portsData.length}`);
    
    renderPorts();
    hideLoading('ports-list');
    debugLog('[Ports] Done.');
  } catch (error) {
    console.error('Error fetching ports:', error);
    showError('ports-list', '載入港口資料失敗: ' + error.message);
    debugLog('[Ports] Error: ' + error.message);
    hideLoading('ports-list');
  }
}

// Render ship list in dropdown
function renderShipList() {
  debugLog('[ShipList] Rendering ship list');
  const shipSelect = document.getElementById('ship-select');
  shipSelect.innerHTML = '<option value="">-- 請選擇船舶 --</option>';
  ships.forEach(ship => {
    const option = document.createElement('option');
    option.value = ship.imo;
    option.textContent = `${ship.name} (${ship.imo})`;
    shipSelect.appendChild(option);
  });
  debugLog(`[ShipList] Rendered ${ships.length} ships`);
}

// Show ship detail and update map
function showShipDetail(imo) {
  debugLog(`[ShowDetail] Showing ship ${imo}`);
  const ship = ships.find(s => s.imo === imo);
  if (!ship) {
    debugLog(`[ShowDetail] Ship ${imo} not found`);
    return;
  }

  // Update ship info
  document.getElementById('ship-name').textContent = `船名: ${ship.name}`;
  document.getElementById('imo').textContent = `IMO編號: ${ship.imo}`;
  document.getElementById('call-sign').textContent = `呼號: ${ship.callsign}`;
  document.getElementById('flag').textContent = `船籍: ${ship.flag}`;
  document.getElementById('ship-type').textContent = `船型: ${ship.type}`;
  document.getElementById('destination').textContent = `目的地: ${ship.destination}`;
  document.getElementById('eta').textContent = `預計到達時間: ${ship.eta}`;
  document.getElementById('status').textContent = `目前狀態: ${ship.status}`;

  // Update map
  if (map) {
    debugLog(`[ShowDetail] Updating map for ship at (${ship.lat}, ${ship.lng})`);
    // Update existing marker or create new one
    if (shipMarker) {
      // Update position and popup without removing/re-adding
      shipMarker.setLatLng([ship.lat, ship.lng])
        .setPopupContent(`<b>${ship.name}</b><br/>${ship.status}<br/>ETA: ${ship.eta}`)
        .openPopup();
    } else {
      // Create new marker
      shipMarker = L.marker([ship.lat, ship.lng]).addTo(map)
        .bindPopup(`<b>${ship.name}</b><br/>${ship.status}<br/>ETA: ${ship.eta}`)
        .openPopup();
    }
    // Center map on ship
    map.setView([ship.lat, ship.lng], 12);
  }
  debugLog(`[ShowDetail] Done`);
}

// Render ports status
function renderPorts() {
  debugLog('[Ports] Rendering ports');
  const portsList = document.getElementById('ports-list');
  if (!portsList) return;
  
  portsList.innerHTML = '';
  
  ports.forEach(port => {
    const portCard = document.createElement('div');
    portCard.className = 'port-card';
    
    // Determine status class for styling
    let statusClass = 'status-normal';
    let statusSymbol = '🟡';
    if (port.status && (port.status.includes('繁忙') || port.status.includes('擁堵') || port.congestion === 'high')) {
      statusClass = 'status-busy';
      statusSymbol = '🔴';
    } else if (port.status && (port.status.includes('暢通') || port.status.includes('良好') || port.congestion === 'low')) {
      statusClass = 'status-good';
      statusSymbol = '🟢';
    }
    
    portCard.innerHTML = `
      <h3>${port.name} ${statusSymbol}</h3>
      <p><span>泊位使用率:</span> ${port.berthUtilization || port.berthUtilization === 0 ? port.berthUtilization + '%' : 'N/A'}</p>
      <p><span>等待船舶:</span> ${port.waitingShips || port.waitingShips === 0 ? port.waitingShips + ' 艘' : 'N/A'}</p>
      <p><span>狀態:</span> <span class="status-indicator ${statusClass}">${port.status || '未知'}</span></p>
    `;
    portsList.appendChild(portCard);
  });
  debugLog(`[Ports] Rendered ${ports.length} ports`);
}

// Update data source indicator in UI
function updateDataSourceIndicator() {
  let indicator = document.querySelector('.data-source-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'data-source-indicator';
    document.body.appendChild(indicator);
  }
  
  indicator.style.cssText = 'position:fixed;bottom:10px;right:10px;padding:6px 12px;background-color:#2c3e50;color:white;border-radius:20px;font-size:0.85rem;z-index:1000;box-shadow:0 2px 8px rgba(0,0,0,0.2);';
  
  const sourceText = isUsingMockData ? '⚠️ 模擬資料' : '📡 Marinesia API';
  const sourceColor = isUsingMockData ? '#e67e22' : '#27ae60';
  
  indicator.innerHTML = `<span style="background:${sourceColor};padding:2px 8px;border-radius:10px;color:white;font-weight:bold;">${sourceText}</span>`;
}

// UI Helper Functions
function showLoading(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerHTML = '<div class="loading">載入中...</div>';
  }
}

function showError(elementId, message) {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerHTML = `<div class="error">${message}</div>`;
  }
}

function hideLoading(elementId) {
  // Loading is hidden when actual content is rendered
}

// Event listeners
function setupEventListeners() {
  debugLog('[Setup] Setting up event listeners');
  const shipSelect = document.getElementById('ship-select');
  shipSelect.addEventListener('change', (e) => {
    const imo = e.target.value;
    if (imo) {
      debugLog(`[ShipSelect] Changed to ${imo}`);
      showShipDetail(imo);
    }
  });

  const refreshBtn = document.getElementById('refresh-btn');
  refreshBtn.addEventListener('click', () => {
    debugLog('[RefreshBtn] Clicked');
    fetchShips();
    fetchPorts();
  });

  const toggleAutoBtn = document.getElementById('toggle-auto');
  toggleAutoBtn.addEventListener('click', () => {
    debugLog('[ToggleAuto] Clicked');
    if (autoUpdateInterval) {
      clearInterval(autoUpdateInterval);
      autoUpdateInterval = null;
      toggleAutoBtn.innerHTML = '自動更新: <span id="auto-status">關閉</span>';
    } else {
      autoUpdateInterval = setInterval(() => {
        fetchShips();
        fetchPorts();
      }, UPDATE_INTERVAL);
      toggleAutoBtn.innerHTML = `自動更新: <span id="auto-status">開啟 (${UPDATE_INTERVAL/1000}s)</span>`;
    }
  });
}

// Initialize
function init() {
  debugLog('[Init] Starting');
  initDebug();
  initMap();
  fetchShips();
  fetchPorts();
  setupEventListeners();
  debugLog('[Init] Done');
}

// Start when DOM loaded
document.addEventListener('DOMContentLoaded', init);
