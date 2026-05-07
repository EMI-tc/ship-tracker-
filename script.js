// Ship Tracker Script
let ships = [];
let ports = [];
let map = null;
let shipMarker = null;
let autoUpdateInterval = null;
const UPDATE_INTERVAL = 30000; // 30 seconds
let isUsingMockData = true; // Tracks actual data source being used

// API Configuration (replace with actual API keys when available)
const API_CONFIG = {
  // Example for MarineTraffic API (requires subscription)
  marinetraffic: {
    baseUrl: 'https://services.marinetraffic.com/api/exportvessel/v:5',
    // Note: In production, you would need a valid API key
    // For demo purposes, we'll attempt without key and fall back to mock on failure
    params: {
      protocol: 'jsono',
      timespan: '1',
      ship_types: 'Cargo', // or more specific for bulk carriers
      // Add bbox for Taiwan area to limit results: minLon,minLat,maxLon,maxLat
      // Focused on Taichung Port (24.3N,120.5E) and Kaohsiung Port (22.6N,120.3E)
      bbox: '120,22,121,25' // Waters around Taichung and Kaohsiung
    }
  }
};

// Initialize map
function initMap() {
  map = L.map('map').setView([25.0330, 121.5654], 10); // Default to Taipei
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
}

// Fetch ships data (try real API first, fallback to mock)
async function fetchShips() {
  try {
    showLoading('ship-list');
    
    let shipsData;
    let usedMock = false;
    
    // Try to fetch from real API (MarineTraffic example)
    try {
      const url = new URL(API_CONFIG.marinetraffic.baseUrl);
      // Note: Without a valid API key, this will likely fail with 401/403
      // In a real implementation, you would add: url.searchParams.set('key', API_KEY);
      Object.entries(API_CONFIG.marinetraffic.params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
      
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      shipsData = await response.json();
      usedMock = false;
      console.log('Successfully fetched real AIS data');
    } catch (apiError) {
      console.warn('Failed to fetch real AIS data, falling back to mock:', apiError);
      // Fallback to mock data
      const mockResponse = await fetch('ships.json');
      if (!mockResponse.ok) throw new Error('Failed to fetch mock ships data');
      shipsData = await mockResponse.json();
      usedMock = true;
    }
    
    ships = shipsData;
    isUsingMockData = usedMock;
    renderShipList();
    updateDataSourceIndicator();
    
    if (ships.length > 0) {
      const shipSelect = document.getElementById('ship-select');
      if (shipSelect.value === '') {
        // No ship selected, select first one
        shipSelect.value = ships[0].imo;
        showShipDetail(ships[0].imo);
      } else {
        // Refresh currently selected ship (for auto-update)
        showShipDetail(shipSelect.value);
      }
    }
    hideLoading('ship-list');
  } catch (error) {
    console.error('Error fetching ships:', error);
    showError('ship-list', '載入船舶資料失敗');
    hideLoading('ship-list');
  }
}

// Fetch ports data (try real API first, fallback to mock)
async function fetchPorts() {
  try {
    showLoading('ports-list');
    
    let portsData;
    let usedMock = false;
    
    // Try to fetch real port data (if available)
    // For demo, we'll try a simple approach: if we have ship data, we could derive port info
    // But for simplicity, we'll fall back to mock since real-time port status APIs are less common
    try {
      // Attempt to fetch from a hypothetical port API
      // In reality, you would substitute with actual port authority API
      const portResponse = await fetch('https://api.example.com/ports/taiwan'); // Will fail
      if (!portResponse.ok) throw new Error('Port API not available');
      portsData = await portResponse.json();
      usedMock = false;
    } catch (portError) {
      console.warn('Failed to fetch real port data, falling back to mock:', portError);
      const mockResponse = await fetch('ports.json');
      if (!mockResponse.ok) throw new Error('Failed to fetch mock ports data');
      portsData = await mockResponse.json();
      usedMock = true;
    }
    
    ports = portsData;
    renderPorts();
    hideLoading('ports-list');
  } catch (error) {
    console.error('Error fetching ports:', error);
    showError('ports-list', '載入港口資料失敗');
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
  portsList.innerHTML = '';
  // Filter to only show Taichung and Kaohsiung ports
  const filteredPorts = ports.filter(port => 
    port.name === '臺中港' || port.name === '高雄港'
  );
  filteredPorts.forEach(port => {
    const portCard = document.createElement('div');
    portCard.className = 'port-card';
    
    // Determine status class for styling
    let statusClass = 'status-normal';
    if (port.status.includes('繁忙') || port.status.includes('擁堵')) {
      statusClass = 'status-busy';
    } else if (port.status.includes('暢通') || port.status.includes('良好')) {
      statusClass = 'status-good';
    }
    
    portCard.innerHTML = `
      <h3>${port.name}</h3>
      <p><span>泊位使用率:</span> ${port.berthUtilization}%</p>
      <p><span>等待船舶:</span> ${port.waitingShips} 艘</p>
      <p><span>狀態:</span> <span class="status-indicator ${statusClass}">${port.status}</span></p>
    `;
    portsList.appendChild(portCard);
  });
}

// Update data source indicator in UI
function updateDataSourceIndicator() {
  const indicator = document.createElement('div');
  indicator.style.position = 'fixed';
  indicator.style.bottom = '10px';
  indicator.style.right = '10px';
  indicator.style.padding = '5px 10px';
  indicator.style.backgroundColor = isUsingMockData ? '#e74c3c' : '#2ecc71';
  indicator.style.color = 'white';
  indicator.style.borderRadius = '4px';
  indicator.style.fontSize = '0.9rem';
  indicator.style.zIndex = '1000';
  indicator.textContent = isUsingMockData ? '⚠️ 使用模擬資料' : '📡 即時 AIS 資料';
  
  // Remove existing indicator if any
  const existing = document.querySelector('.data-source-indicator');
  if (existing) existing.remove();
  
  indicator.className = 'data-source-indicator';
  document.body.appendChild(indicator);
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
