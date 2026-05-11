// Ship Tracker Script
let ships = []; // array of ship objects for rendering (static data with MMSI)
let ports = [];
let map = null;
let shipMarker = null;
let autoUpdateInterval = null;
const UPDATE_INTERVAL = 180000; // 3 minutes (minimum to avoid blocking)
let isUsingMockData = false; // Now we use real AIS data
let aisWs = null;
let shipsByMMSI = new Map(); // MMSI -> ship object (latest position data)
let staticDataByMMSI = new Map(); // MMSI -> static data (name, callsign, etc.) from AIS
let imoToMmsi = new Map(); // IMO -> MMSI mapping from static data
let shipMarkers = new Map(); // MMSI -> Leaflet marker

// Debug div
let debugDiv = null;
function initDebug() {
  debugDiv = document.createElement('div');
  debugDiv.id = 'debug';
  debugDiv.style.cssText = 'position:fixed;bottom:0;left:0;right:0;height:120px;background:rgba(0,0,0,0.8);color:#0f0;overflow:auto;pointer-events:none;z-index:9999;font-family:monospace;font-size:11px;padding:5px;';
  document.body.appendChild(debugDiv);
}
function debugLog(msg) {
  // If debugDiv not ready yet, create it or fall back to console
  if (!debugDiv) {
    // Try to create it if body is available
    if (document.body) {
      initDebug();
    } else {
      // Fallback to console if body not ready (shouldn't happen after DOMContentLoaded)
      console.log('[DEBUG PRE-INIT]', msg);
      return;
    }
  }
  const now = new Date();
  const time = now.toLocaleTimeString();
  debugDiv.textContent += `[${time}] ${msg}\n`;
  // Keep only last 20 lines
  const lines = debugDiv.textContent.split('\n').slice(-20);
  debugDiv.textContent = lines.join('\n');
  debugDiv.scrollTop = debugDiv.scrollHeight;
}

// Initialize map with error handling
function initMap() {
  debugLog('Initializing map...');
  try {
    // Check if Leaflet is loaded
    if (typeof L === 'undefined') {
      debugLog('ERROR: Leaflet (L) is not defined! Library may have failed to load.');
      // Try to show a helpful message
      const mapContainer = document.getElementById('map');
      if (mapContainer) {
        mapContainer.innerHTML = `<div style="padding:20px;text-align:center;color:red;background:#fff8f8;border:1px solid #fcc;">
          地圖庫載入失敗<br/>
          請檢查網路連線或稍後再試<br/>
          <small>技術細節: L is undefined</small>
        </div>`;
      }
      return;
    }
    debugLog('Leaflet library found');
    
    // Check if map container exists
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
      debugLog('ERROR: Map container not found!');
      return;
    }
    debugLog('Map container found');
    
    // Initialize Leaflet map
    map = L.map('map', {
      preferCanvas: true // Better performance on mobile
    }).setView([25.0330, 121.5654], 10); // Default to Taipei
    
    debugLog('Leaflet map object created');
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(map);
    
    debugLog('Tile layer added');
    
    // Test if map is working
    if (map) {
      debugLog(`Map initialized successfully. Size: ${map.getSize().x}x${map.getSize().y}`);
    } else {
      debugLog('ERROR: Map object is null after initialization');
    }
  } catch (e) {
    debugLog(`ERROR initializing map: ${e.message}`);
    console.error('Map initialization error:', e);
    // Show error on map container
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
      mapContainer.innerHTML = `<div style="padding:20px;text-align:center;color:red;">
        地圖載入失敗<br/>${e.message}
      </div>`;
    }
  }
}

// Fetch ships data (directly from mock JSON)
async function fetchShips() {
  if (isUsingMockData) {
    debugLog('[Ships] Starting fetch...');
    try {
      showLoading('ship-list');
      
      // Directly fetch from mock JSON
      const response = await fetch('./ships.json');
      if (!response.ok) throw new Error('Failed to fetch ships data: ' + response.status);
      
      const shipsData = await response.json();
      ships = shipsData;
      
      // Build IMO to MMSI mapping for later use
      imoToMmsi.clear();
      shipsData.forEach(ship => {
        if (ship.mmsi) {
          imoToMmsi.set(ship.imo, ship.mmsi);
        }
      });
      
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
  } else {
    debugLog('[Ships] Skipping mock fetch - using real AIS data');
    // Still fetch static data for ship names etc. and build IMO->MMSI mapping
    showLoading('ship-list');
    try {
      const response = await fetch('./ships.json');
      if (!response.ok) throw new Error('Failed to fetch ships data: ' + response.status);
      
      const shipsData = await response.json();
      ships = shipsData;
      
      // Build IMO to MMSI mapping
      imoToMmsi.clear();
      shipsData.forEach(ship => {
        if (ship.mmsi) {
          imoToMmsi.set(ship.imo, ship.mmsi);
        }
      });
      
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
      debugLog('[Ships] Loaded static ship data: ' + shipsData.length);
    } catch (error) {
      console.error('Error fetching ships:', error);
      showError('ship-list', '載入船舶資料失敗: ' + error.message);
      debugLog('[Ships] Error: ' + error.message);
      hideLoading('ship-list');
    }
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
  if (!shipSelect) {
    debugLog('ERROR: Ship select element not found');
    return;
  }
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
  
  // First try to find in static data
  const ship = ships.find(s => s.imo === imo);
  if (!ship) {
    debugLog(`[ShowDetail] Ship ${imo} not found in static data`);
    // Show error or fallback
    document.getElementById('ship-name').textContent = `船名: 未知 (${imo})`;
    document.getElementById('imo').textContent = `IMO編號: ${imo}`;
    document.getElementById('call-sign').textContent = `呼號: 未知`;
    document.getElementById('flag').textContent = `船籍: 未知`;
    document.getElementById('ship-type').textContent = `船型: 未知`;
    document.getElementById('destination').textContent = `目的地: 未知`;
    document.getElementById('eta').textContent = `預計到達時間: 未知`;
    document.getElementById('status').textContent = `目前狀態: 資料 unavailable`;
    
    // Clear map or show unknown position
    if (map && shipMarker) {
      shipMarker.setLatLng([25.0330, 121.5654]); // Default to Taipei
      shipMarker.setPopupContent(`<b>未知船舶 (${imo})</b><br/>無 AIS 資料`);
      shipMarker.openPopup();
    }
    return;
  }

  // Update ship info from static data
  try {
    document.getElementById('ship-name').textContent = `船名: ${ship.name}`;
    document.getElementById('imo').textContent = `IMO編號: ${ship.imo}`;
    document.getElementById('call-sign').textContent = `呼號: ${ship.callsign}`;
    document.getElementById('flag').textContent = `船籍: ${ship.flag}`;
    document.getElementById('ship-type').textContent = `船型: ${ship.type}`;
    document.getElementById('destination').textContent = `目的地: ${ship.destination}`;
    document.getElementById('eta').textContent = `預計到達時間: ${ship.eta}`;
    document.getElementById('status').textContent = `目前狀態: ${ship.status}`;
  } catch (e) {
    debugLog(`[ShowDetail] Error updating ship info: ${e.message}`);
  }

  // Try to get real-time position from AIS data
  // We need to map IMO to MMSI - this is the missing link!
  // For now, let's see if we can find by matching names or add MMSI to static data
  
  // Update map
  if (map) {
    // Try to find real-time position by IMO (we need MMSI->IMO mapping)
    // For demo purposes, let's just use the static position if no real-time data
    let lat = ship.lat;
    let lng = ship.lng;
    let hasRealtime = false;
    
    // TODO: Implement MMSI to IMO mapping
    // We would need either:
    // 1. ships.json to include MMSI field, OR
    // 2. A way to get MMSI from IMO (external API or static mapping)
    
    // For now, check if we have any AIS data and try to match by name (not reliable but works for demo)
    let bestMatch = null;
    let bestMatchScore = 0;
    
    shipsByMMSI.forEach((aisData, mmsi) => {
      // Get static data for this MMSI from AIS or our JSON
      let staticName = '';
      // Try to get name from our static ships data by matching IMO to... we don't have mapping
      // This is problematic without MMSI in static data
      
      // Simpler approach: if we had MMSI in ships.json, we could do:
      // const shipWithMMSI = ships.find(s => s.mmsi === mmsi);
      // if (shipWithMMSI && shipWithMMSI.imo === imo) { ... }
    });
    
    // For now, use static position and indicate if we have real-time data for any ship
    const hasAnyRealtime = shipsByMMSI.size > 0;
    
    if (hasAnyRealtime) {
      // Show that we have real-time data somewhere, even if not for this specific ship
      debugLog(`[ShowDetail] Showing static position for ${ship.name}, but we have real-time AIS data for ${shipsByMMSI.size} ships`);
    }
    
    // Update existing marker or create new one
    if (shipMarker) {
      // Update position and popup without removing/re-adding
      shipMarker.setLatLng([lat, lng])
        .setPopupContent(`<b>${ship.name}</b><br/>${ship.status}<br/>ETA: ${ship.eta}${hasAnyRealtime ? '<br/><i>實時 AIS 資料可用</i>' : ''}`)
        .openPopup();
    } else {
      // Create new marker
      shipMarker = L.marker([lat, lng]).addTo(map)
        .bindPopup(`<b>${ship.name}</b><br/>${ship.status}<br/>ETA: ${ship.eta}${hasAnyRealtime ? '<br/><i>實時 AIS 資料可用</i>' : ''}`)
        .openPopup();
    }
    // Center map on ship
    try {
      map.setView([lat, lng], 12);
      debugLog('[ShowDetail] Map view updated');
    } catch (e) {
      debugLog(`[ShowDetail] Error setting map view: ${e.message}`);
    }
  } else {
    debugLog('[ShowDetail] Map is not initialized');
  }
  debugLog(`[ShowDetail] Done`);
}

// Render ports status
function renderPorts() {
  debugLog('[Ports] Rendering ports');
  const portsList = document.getElementById('ports-list');
  if (!portsList) {
    debugLog('ERROR: Ports list element not found');
    return;
  }
  
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
  if (shipSelect) {
    shipSelect.addEventListener('change', (e) => {
      const imo = e.target.value;
      if (imo) {
        debugLog(`[ShipSelect] Changed to ${imo}`);
        showShipDetail(imo);
      }
    });
  } else {
    debugLog('ERROR: Ship select element not found for event listener');
  }

  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      debugLog('[RefreshBtn] Clicked');
      fetchShips();
      fetchPorts();
    });
  }

  const toggleAutoBtn = document.getElementById('toggle-auto');
  if (toggleAutoBtn) {
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
}

// Initialize
function init() {
  debugLog('[Init] Starting');
  initDebug(); // MUST be called before any debugLog
  initMap();
  connectToAisBackend(); // Connect to local AIS backend for real-time data
  fetchShips(); // Load static ship data (for names, etc.)
  fetchPorts();
  setupEventListeners();
  debugLog('[Init] Done');
}

// Connect to local AIS backend WebSocket
function connectToAisBackend() {
  debugLog('[AIS] Connecting to local backend at ws://localhost:8082');
  aisWs = new WebSocket('ws://localhost:8082');
  
  aisWs.onopen = () => {
    debugLog('[AIS] Connected to local backend');
  };
  
  aisWs.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleAisMessage(data);
    } catch (e) {
      debugLog('[AIS] Failed to parse message: ' + e.message);
    }
  };
  
  aisWs.onclose = () => {
    debugLog('[AIS] Disconnected from local backend');
    // Attempt to reconnect after delay
    setTimeout(connectToAisBackend, 5000);
  };
  
  aisWs.onerror = (err) => {
    debugLog('[AIS] WebSocket error: ' + err);
  };
}

// Handle incoming AIS message
function handleAisMessage(data) {
  // Check if this is a PositionReport message (MsgType 1, 2, 3, 4)
  if (data.Message && data.Message.Type && 
      [1, 2, 3, 4].includes(data.Message.Type)) {
    const msg = data.Message;
    const mmsi = String(msg.UserID); // MMSI as string
    
    // Update ship position data
    const shipData = {
      mmsi: mmsi,
      lat: msg.Lat,
      lng: msg.Lon,
      speed: msg.Speed,
      course: msg.Course,
      heading: msg.Heading,
      status: msg.NavigationalStatus, // This is Navigational status enum
      timestamp: data.Now // When we received it
    };
    
    // Store or update ship data
    shipsByMMSI.set(mmsi, shipData);
    
    // Update map marker if we have static data for this ship
    updateShipMarker(mmsi, shipData);
    
    debugLog(`[AIS] Updated position for MMSI ${mmsi}: ${msg.Lat}, ${msg.Lon}`);
  }
  // Handle other message types if needed (static data, voyage data, etc.)
  else if (data.Message && data.Message.Type === 5) { // Static and Voyage Related Data
    // This could provide ship name, callsign, etc. to match with our static data
    const msg = data.Message;
    const mmsi = String(msg.UserID);
    
    const staticData = {
      mmsi: mmsi,
      imo: msg.IMO, // This is what we need!
      name: msg.ShipName,
      callsign: msg.CallSign,
      // Note: AIS static data might not have all fields we want
    };
    
    // Store static data from AIS (could supplement our JSON data)
    staticDataByMMSI.set(mmsi, staticData);
    debugLog(`[AIS] Got static data for MMSI ${mmsi}: IMO=${msg.IMO}, Name=${msg.ShipName}`);
  }
}

// Update or create map marker for a ship
function updateShipMarker(mmsi, shipData) {
  // Try to find matching static data from our JSON or AIS static data
  let shipInfo = null;
  
  // First try to find by MMSI in our static JSON data (we'd need to add MMSI to ships.json)
  // For now, we'll work with what we have - if we had MMSI in ships.json:
  /*
  const staticShip = ships.find(s => s.mmsi === mmsi);
  if (staticShip) {
    shipInfo = staticShip;
  }
  */
  
  // Alternative: try to find by name or other fields (less reliable)
  // For now, let's create a basic ship entry if we don't have static data
  
  // If we have marker already, update it; otherwise create new
  if (shipMarkers.has(mmsi)) {
    const marker = shipMarkers.get(mmsi);
    marker.setLatLng([shipData.lat, shipData.lng]);
    
    // Update popup with latest info
    let popupContent = `<b>MMSI: ${mmsi}</b><br/>`;
    popupContent += `位置: ${shipData.lat.toFixed(4)}, ${shipData.lng.toFixed(4)}<br/>`;
    popupContent += `速度: ${shipData.speed ? shipData.speed.toFixed(1) + ' kt' : 'N/A'}<br/>`;
    popupContent += `航向: ${shipData.course ? shipData.course.toFixed(0) + '°' : 'N/A'}<br/>`;
    
    // Add status text
    const statusText = getNavStatusText(shipData.status);
    if (statusText) popupContent += `狀態: ${statusText}<br/>`;
    
    popupContent += `更新: ${new Date(shipData.timestamp).toLocaleTimeString()}`;
    
    marker.setPopupContent(popupContent);
    if (!marker.isOpen()) marker.openPopup();
  } else {
    // Create new marker
    let popupContent = `<b>MMSI: ${mmsi}</b><br/>`;
    popupContent += `位置: ${shipData.lat.toFixed(4)}, ${shipData.lng.toFixed(4)}<br/>`;
    popupContent += `速度: ${shipData.speed ? shipData.speed.toFixed(1) + ' kt' : 'N/A'}<br/>`;
    popupContent += `航向: ${shipData.course ? shipData.course.toFixed(0) + '°' : 'N/A'}<br/>`;
    
    const statusText = getNavStatusText(shipData.status);
    if (statusText) popupContent += `狀態: ${statusText}<br/>`;
    
    popupContent += `更新: ${new Date(shipData.timestamp).toLocaleTimeString()}`;
    
    const marker = L.marker([shipData.lat, shipData.lng]).addTo(map)
      .bindPopup(popupContent)
      .openPopup();
    
    shipMarkers.set(mmsi, marker);
    
    // If we want to auto-center on new ships (maybe only first few times)
    // if (shipMarkers.size <= 3) { // Only for first 3 ships
    //   map.setView([shipData.lat, shipData.lng], 12);
    // }
  }
}

// Convert Navigational Status enum to text
function getNavStatusText(status) {
  if (status === undefined) return '';
  const statusMap = {
    0: '掌舵中',
    1: '錨泊中',
    2: '受限制掌舵能力',
    3: '受限制吃水能力',
    4: '係留中',
    5: '擱淺',
    6: '參與撞擊',
    7: '作業中',
    8: '帆船',
    9: '無法接收',
    10: '水上滑翔機／水上飛機',
    11: '注意⚠',
    12: '注意⚠⚠',
    13: '注意⚠⚠⚠',
    14: '保留',
    15: '保留'
  };
  return statusMap[status] || '未知狀態 (' + status + ')';
}

// Initialize
function init() {
  debugLog('[Init] Starting');
  initDebug(); // MUST be called before any debugLog
  initMap();
  connectToAisBackend(); // Connect to local AIS backend for real-time data
  fetchShips(); // Load static ship data (for names, etc.)
  fetchPorts();
  setupEventListeners();
  debugLog('[Init] Done');
}

// Start when DOM loaded
document.addEventListener('DOMContentLoaded', () => {
  debugLog('DOM Content Loaded');
  init();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    debugLog('[Page] Hidden');
  } else {
    debugLog('[Page] Visible');
  }
});

// Global error handler
window.addEventListener('error', (e) => {
  debugLog(`[GLOBAL ERROR] ${e.message}`);
  console.error('Global error:', e);
});

window.addEventListener('unhandledrejection', (e) => {
  debugLog(`[PROMISE ERROR] ${e.reason.message}`);
  console.error('Unhandled promise rejection:', e.reason);
});