#!/bin/bash

# Test script for enhanced Gasbot webhook
# This script tests the webhook with comprehensive data structure

echo "🧪 Testing Enhanced Gasbot Webhook Integration"
echo "=============================================="

# Configuration
WEBHOOK_URL="https://fuel-sight-guardian-ce89d8de.vercel.app/api/gasbot-webhook"
WEBHOOK_SECRET="FSG-gasbot-webhook-2025"
TEST_DATA_FILE="./gasbot-webhook-comprehensive-test.json"

# Check if test data file exists
if [ ! -f "$TEST_DATA_FILE" ]; then
    echo "❌ Test data file not found: $TEST_DATA_FILE"
    exit 1
fi

echo "📍 Webhook URL: $WEBHOOK_URL"
echo "🔑 Using webhook secret: ${WEBHOOK_SECRET:0:10}..."
echo "📊 Test data file: $TEST_DATA_FILE"
echo ""

# Test 1: Send comprehensive test data
echo "🧪 Test 1: Sending comprehensive webhook data..."
echo "----------------------------------------------"

response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
  -X POST "$WEBHOOK_URL" \
  -H "Authorization: Bearer $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d @"$TEST_DATA_FILE")

# Extract HTTP status and body
http_status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
response_body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')

echo "📋 HTTP Status: $http_status"
echo "📄 Response Body:"
echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
echo ""

# Test 2: Test authentication failure
echo "🧪 Test 2: Testing authentication failure..."
echo "--------------------------------------------"

auth_fail_response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
  -X POST "$WEBHOOK_URL" \
  -H "Authorization: Bearer INVALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[]')

auth_fail_status=$(echo "$auth_fail_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
auth_fail_body=$(echo "$auth_fail_response" | sed 's/HTTPSTATUS:[0-9]*$//')

echo "📋 HTTP Status: $auth_fail_status"
echo "📄 Response Body:"
echo "$auth_fail_body" | jq '.' 2>/dev/null || echo "$auth_fail_body"
echo ""

# Test 3: Test invalid method
echo "🧪 Test 3: Testing invalid method (GET)..."
echo "------------------------------------------"

method_fail_response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
  -X GET "$WEBHOOK_URL" \
  -H "Authorization: Bearer $WEBHOOK_SECRET")

method_fail_status=$(echo "$method_fail_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
method_fail_body=$(echo "$method_fail_response" | sed 's/HTTPSTATUS:[0-9]*$//')

echo "📋 HTTP Status: $method_fail_status"
echo "📄 Response Body:"
echo "$method_fail_body" | jq '.' 2>/dev/null || echo "$method_fail_body"
echo ""

# Summary
echo "📊 Test Summary"
echo "==============="
if [ "$http_status" = "200" ]; then
    echo "✅ Comprehensive data test: PASSED"
else
    echo "❌ Comprehensive data test: FAILED (Status: $http_status)"
fi

if [ "$auth_fail_status" = "401" ]; then
    echo "✅ Authentication test: PASSED"
else
    echo "❌ Authentication test: FAILED (Expected 401, got: $auth_fail_status)"
fi

if [ "$method_fail_status" = "405" ]; then
    echo "✅ Method validation test: PASSED"
else
    echo "❌ Method validation test: FAILED (Expected 405, got: $method_fail_status)"
fi

echo ""
echo "🎉 Testing complete!"
echo "📝 Check your database for the inserted comprehensive data."
echo "💡 Monitor logs at: https://vercel.com/dashboard"