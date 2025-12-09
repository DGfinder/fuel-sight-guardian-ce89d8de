#!/bin/bash

# Test script for Kalgoorlie Dip Webhook
# Usage: ./test-kalgoorlie-webhook.sh

# Configuration
WEBHOOK_URL="https://fuel-sight-guardian-ce89d8de.vercel.app/api/kalgoorlie-dip-webhook"
API_KEY="kalgoorlie-dip-2025"

# Sample payload matching the plan
PAYLOAD='{
  "dips": [
    { "tank_name": "MILLENNIUM STHP", "dip_value": 42342, "dip_date": "2025-12-09" },
    { "tank_name": "KUNDANA Gen 1", "dip_value": 87867, "dip_date": "2025-12-09" },
    { "tank_name": "KUNDANA Gen 2", "dip_value": 13855, "dip_date": "2025-12-09" },
    { "tank_name": "RHP/RUBICON SURFACE", "dip_value": 43827, "dip_date": "2025-12-09" },
    { "tank_name": "RALEIGH SURFACE", "dip_value": 20910, "dip_date": "2025-12-09" },
    { "tank_name": "MLG Kundana", "dip_value": 66070, "dip_date": "2025-12-09" },
    { "tank_name": "Paradigm O/P", "dip_value": 44000, "dip_date": "2025-12-09" }
  ]
}'

echo "🚀 Testing Kalgoorlie Dip Webhook"
echo "URL: $WEBHOOK_URL"
echo ""
echo "📦 Payload:"
echo "$PAYLOAD" | jq .
echo ""
echo "📡 Sending request..."
echo ""

# Send the request
RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d "$PAYLOAD" \
  "$WEBHOOK_URL")

echo "✅ Response:"
echo "$RESPONSE" | jq .
echo ""

# Check for success
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
if [ "$SUCCESS" == "true" ]; then
  echo "🎉 Test PASSED!"
  echo ""
  echo "Summary:"
  echo "$RESPONSE" | jq '.summary'
else
  echo "❌ Test FAILED!"
  echo "$RESPONSE"
fi
