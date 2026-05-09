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

// Initialize map
function initMap() {
  map = L.map('map').setView([25.0330, 121.5654], 10); // Default to Taipei
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
}

// Fetch ships data (directly from mock JSON)
async function fetchShips() {
  console.log('[Ships] Starting fetch...');
  try {
    showLoading('ship-list');
    
    // Directly fetch from mock JSON
    const response = await fetch('./ships.json');
    if (!response.ok) throw new Error('Failed to fetch ships data');
    
    const shipsData = await response.json();
    ships = shipsData;
    isUsingMockData = true;
    console.log(`[Ships] Using local mock JSON, count: ${shipsData.length}`);
    
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
    console.log('[Ships] Done. Ships count:', ships.length);
  } catch (error) {
    console.error('Error fetching ships:', error);
    showError('ship-list', '載入船舶資料失敗: ' + error.message);
    hideLoading('ship-list');
  }
}

// Fetch ports data (directly from mock JSON)
async function fetchPorts() {
  try {
    showLoading('ports-list');
    
    // Directly fetch from mock JSON
    const response = await fetch('./ports.json');
    if (!response.ok) throw new Error('Failed to fetch ports data');
    
    const portsData = await response.json();
    ports = portsData;
    console.log(`[Ports] Using local mock JSON, count: ${portsData.length}`);
    
    renderPorts();
    hideLoading('ports-list');
  } catch (error) {
    console.error('Error fetching ports:', error);
    showError('ports-list', '載入港口資料失敗: ' + error.message);
    hideLoading('ports-list');
  }
}

// Render ship list in dropdown
function renderShipList() {
  const shipSelect = document.getElementById('ship-select');
  shipSelect.innerHTML = '<option value="">-- 請選擇船舶 --</option>';
  ships.forEach(ship => {
    const option = document.createElement('option');
    option.value = ship.imo;
    option.textContent = `${ship.name} (${ship.imo})`;
    shipSelect.appendChild(option);
  });
}

// Show ship detail and update map
function showShipDetail(imo) {
  const ship = ships.find(s => s.imo === imo);
  if (!ship) return;

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
}

// Render ports status
function renderPorts() {
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
  const shipSelect = document.getElementById('ship-select');
  shipSelect.addEventListener('change', (e) => {
    const imo = e.target.value;
    if (imo) {
      showShipDetail(imo);
    }
  });

  const refreshBtn = document.getElementById('refresh-btn');
  refreshBtn.addEventListener('click', () => {
    fetchShips();
    fetchPorts();
  });

  const toggleAutoBtn = document.getElementById('toggle-auto');
  toggleAutoBtn.addEventListener('click', () => {
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
  initMap();
  fetchShips();
  fetchPorts();
  setupEventListeners();
}

// Start when DOM loaded
document.addEventListener('DOMContentLoaded', init);
