# 🔗 Gasbot Simple Webhook - Ultra Easy Integration

## ✨ **The Simplest Possible Gasbot Integration**

This is the **ultra-simplified** version of the Gasbot webhook that makes it as easy as possible to receive tank data.

### 🎯 **Key Simplifications**

| Complex Version | Simple Version |
|----------------|----------------|
| Bearer token authentication | Simple API key in header/URL |
| 3 database tables | 1 single table |
| 40+ fields mapped | 8 essential fields |
| Complex data transformation | Minimal processing |
| Strict validation | Flexible data acceptance |
| POST only | Both GET and POST |

---

## 🚀 **Quick Start - 3 Steps**

### 1. **Database Setup**
```bash
# Run the migration to create the simple table
psql -f database/migrations/create_gasbot_simple_readings.sql
```

### 2. **Webhook URL**
```
https://fuel-sight-guardian-ce89d8de.vercel.app/api/gasbot-webhook-simple
```

### 3. **API Key**
```
gasbot-2025
```

**That's it!** Start sending data immediately.

---

## 📡 **How to Send Data**

### **Option A: POST with JSON (Recommended)**
```bash
curl -X POST https://your-app.vercel.app/api/gasbot-webhook-simple \
  -H "X-API-Key: gasbot-2025" \
  -H "Content-Type: application/json" \
  -d '[{
    "LocationId": "Tank 1",
    "AssetCalibratedFillLevel": 75.5,
    "DeviceOnline": true,
    "AssetSerialNumber": "TANK-001",
    "TenancyName": "My Customer"
  }]'
```

### **Option B: GET for Testing (Super Simple)**
```
https://your-app.vercel.app/api/gasbot-webhook-simple?key=gasbot-2025&location=TestTank&fuel_level=75.5&online=true&serial=TEST-001
```

### **Option C: Minimal Data**
```json
{
  "location": "Tank ABC", 
  "fuel_level": 45.2,
  "serial": "ABC-123"
}
```

---

## 📊 **Accepted Data Fields**

The webhook accepts data in **any format** and maps common field names:

| Purpose | Field Names Accepted |
|---------|---------------------|
| **Location** | `LocationId`, `location`, `location_name` |
| **Fuel Level** | `AssetCalibratedFillLevel`, `fuel_level`, `level` |
| **Customer** | `TenancyName`, `customer`, `customer_name` |
| **Device Serial** | `AssetSerialNumber`, `DeviceSerialNumber`, `serial` |
| **Online Status** | `DeviceOnline`, `online` (defaults to true) |
| **Volume** | `AssetReportedLitres`, `volume`, `litres` |
| **Battery** | `DeviceBatteryVoltage`, `battery`, `voltage` |
| **Timestamp** | `AssetLastCalibratedTelemetryTimestamp`, `timestamp` |

**Missing fields? No problem!** The webhook handles missing/null values gracefully.

---

## 🔑 **Authentication Options**

The API key can be provided in **multiple ways** (choose what's easiest):

1. **Header**: `X-API-Key: gasbot-2025`
2. **Authorization Header**: `Authorization: Bearer gasbot-2025`
3. **URL Parameter**: `?key=gasbot-2025`
4. **JSON Body**: `{"api_key": "gasbot-2025", ...}`

---

## 🧪 **Testing**

### **Instant Test**
Click this link to test immediately:
```
https://fuel-sight-guardian-ce89d8de.vercel.app/api/gasbot-webhook-simple?key=gasbot-2025&location=TestTank&fuel_level=88.8&online=true
```

### **Full Test Suite**
```bash
node test/test-gasbot-simple-webhook.js
```

---

## 📋 **Database Schema**

Super simple table with only essential fields:

```sql
CREATE TABLE gasbot_simple_readings (
  id SERIAL PRIMARY KEY,
  location_name VARCHAR(255),     -- Tank location
  customer_name VARCHAR(255),     -- Customer name
  device_serial VARCHAR(100),     -- Device serial number
  fuel_level_percent DECIMAL(5,2), -- Fuel level %
  volume_litres DECIMAL(10,2),    -- Current volume
  device_online BOOLEAN,          -- Online status
  battery_voltage DECIMAL(5,2),   -- Battery voltage
  last_reading TIMESTAMP,         -- Tank reading time
  received_at TIMESTAMP,          -- Webhook received time
  raw_data JSONB                  -- Complete original data
);
```

---

## 🎨 **Dashboard Component**

A simple React component to display the data:

```tsx
import GasbotSimpleDashboard from '@/components/GasbotSimpleDashboard';

// Show live tank data
<GasbotSimpleDashboard />
```

Features:
- ✅ Auto-refresh every 5 minutes
- ✅ Summary cards (total tanks, online, low fuel, avg level)
- ✅ Tank table with fuel bars and status
- ✅ Battery and signal indicators
- ✅ Webhook configuration info

---

## 🔧 **Gasbot Configuration**

If configuring in Gasbot dashboard:

| Field | Value |
|-------|--------|
| **URL** | `https://fuel-sight-guardian-ce89d8de.vercel.app/api/gasbot-webhook-simple` |
| **Method** | `POST` |
| **Headers** | `X-API-Key: gasbot-2025`<br>`Content-Type: application/json` |
| **Format** | JSON Array |

---

## 💡 **Why This Approach?**

### **Ultra Simple Benefits:**
- ✅ **5-minute setup** vs hours of configuration
- ✅ **Works with any data format** - no strict requirements
- ✅ **Multiple authentication options** - use what works
- ✅ **GET support** for instant browser testing
- ✅ **Single table** - no complex joins or relationships
- ✅ **Graceful error handling** - never fails completely
- ✅ **Flexible field mapping** - works with various naming conventions

### **Perfect For:**
- 🧪 **Quick testing** and proof of concepts
- 🚀 **Rapid prototyping** of fuel monitoring
- 🔌 **Easy third-party integrations**
- 📱 **Mobile/IoT devices** with simple HTTP capabilities
- 🛠️ **Development environments** needing minimal setup

---

## 🚨 **Production Notes**

For production use, consider:

1. **Change the API key** from default `gasbot-2025`
2. **Add HTTPS enforcement** if needed
3. **Implement rate limiting** if receiving high volume
4. **Set up monitoring** for failed webhooks
5. **Regular database cleanup** of old readings

---

## 🎉 **Success Response**

```json
{
  "success": true,
  "message": "Processed 2/2 tank readings",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "results": [
    {
      "location": "Tank Alpha",
      "status": "success", 
      "fuel_level": 75.5
    },
    {
      "location": "Tank Beta",
      "status": "success",
      "fuel_level": 45.2  
    }
  ]
}
```

---

**Ready to receive tank data in under 5 minutes! 🚀**