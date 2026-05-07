# 智慧港口船舶追蹤系統 - 部署說明

## 系統概述
- **功能**：即時監控船舶動態與港口狀況
- **技術**：純前端（HTML + JavaScript + CSS），無後端依賴
- **地圖**：Leaflet + OpenStreetMap
- **資料來源**：目前使用模擬資料（ships.json, ports.json），可擴展至真實 AIS API

## 檔案結構
```
ship-tracker/
├── index.html      # 主頁面（2.3KB）
├── script.js       # 核心邏輯（9.7KB，已修復）
├── style.css       # 樣式表（3.4KB）
├── ships.json      # 船舶資料（3 艘）
└── ports.json      # 港口狀況（4 個港口）
```

## 已修復的問題（v3 最終版）
1. ✅ `shipMarker` 變數名錯誤（導致地圖標記無法移除）
2. ✅ HTML 缺少 `ship-list` div（導致載入提示無法顯示）
3. ✅ 狀態判斷字元不匹配（`暢通` vs `暢通`）
4. ✅ 地圖標記重建導致閃爍（改為更新現有標記）
5. ✅ 自動更新時地圖不會同步（現已自動刷新選中船舶）

## 部署步驟

### 1. 啟動 HTTP 伺服器
```bash
cd /home/tharche/.openclaw/workspace/ship-tracker
python3 -m http.server 8080 > /tmp/ship-tracker-8080.log 2>&1 &
```

驗證：
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/index.html
# 應返回 200
```

### 2. 設置路由器端口轉發
登入路由器管理界面（通常 `http://192.168.0.1` 或 `http://192.168.1.1`）

**添加轉發規則：**
| 項目 | 值 |
|------|------|
| 外部端口 | 80（或 443、8080） |
| 內部 IP | 192.168.0.17 |
| 內部端口 | 8080 |
| 協議 | TCP |
| 狀態 | 啟用 |

儲存並重啟路由器（如需要）。

### 3. 測試外部訪問
在手機上（關閉 WiFi，使用 4G/5G）開啟瀏覽器：
```
http://61.218.128.139:80/index.html
```
或簡寫：
```
http://61.218.128.139/index.html
```

## 功能說明

### 船舶監控
- 下拉選單選擇船舶 → 地圖自動定位 + 顯示詳細資訊
- 船舶位置標記在 Leaflet 地圖上（可縮放、拖曳）
- 點擊地圖標記可查看船舶狀態與預計到達時間（ETA）

### 港口狀況
- 4 個主要港口即時狀態（高雄港、基隆港、臺中港、台北港）
- 顏色標示：🟢 暢通、🟡 正常、🔴 繁忙
- 顯示泊位使用率、等待船舶數

### 自動更新
- 點擊「自動更新」按鈕（預設 30 秒間隔）
- 自動刷新船舶位置與港口狀況
- 右下角指示器顯示資料來源（模擬資料 / 即時 AIS）

## 進階擴充

### 連接真實 AIS API
編輯 `script.js` 第 11-25 行，填入有效的 MarineTraffic API Key：
```javascript
const API_CONFIG = {
  marinetraffic: {
    baseUrl: 'https://services.marinetraffic.com/api/exportvessel/v:5',
    params: {
      protocol: 'jsono',
      timespan: '1',
      bbox: '119,21,122,26', // 台灣海域
      key: 'YOUR_API_KEY' // 取消註解並填入金鑰
    }
  }
};
```

### 新增船舶或港口
編輯 `ships.json` 或 `ports.json`，格式如下：

**ships.json：**
```json
[
  {
    "imo": "9247458",
    "name": "HUA HANG 6",
    "callsign": "BVAQ6",
    "flag": "Taiwan",
    "type": "Bulk Carrier",
    "destination": "Kaohsiung, Taiwan",
    "eta": "2026-05-06 08:00",
    "status": "Sailing",
    "lat": 25.0478,
    "lng": 121.7331
  }
]
```

**ports.json：**
```json
[
  {
    "name": "高雄港",
    "berthUtilization": 91,
    "waitingShips": 7,
    "status": "繁忙"
  }
]
```

## 監控與除錯

### 查看伺服器日誌
```bash
tail -f /tmp/ship-tracker-8080.log
```

### 測試本機訪問
```bash
curl -s http://localhost:8080/index.html | head -10
```

### 檢查伺服器狀態
```bash
lsof -i:8080 | grep python
# 或
ps aux | grep "http.server 8080"
```

## 已知限制
1. 目前使用模擬資料，真實 AIS API 需申請付費帳號
2. 地圖僅顯示最後選中的一艘船舶（可擴充為同時顯示多艘）
3. 手機版地圖控制較小，建議在平板或電腦上使用
4. 無後端資料庫，資料不會持久化

## 技術支援
- Leaflet 文檔：https://leafletjs.com/reference.html
- MarineTraffic API：https://www.marinetraffic.com/en/p/api-services
- 問題回報：透過 Telegram bot（@StickShaBot）

---
**部署完成日期**：2026-05-06  
**版本**：v3（最終修復版）  
**檔案大小**：總計約 19KB（未壓縮）
