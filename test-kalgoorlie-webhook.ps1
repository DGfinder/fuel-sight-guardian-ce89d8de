# Test script for Kalgoorlie Dip Webhook (PowerShell)
# Usage: .\test-kalgoorlie-webhook.ps1

# Configuration
$WebhookUrl = "https://fuel-sight-guardian-ce89d8de.vercel.app/api/kalgoorlie-dip-webhook"
$ApiKey = "kalgoorlie-dip-2025"

# Sample payload matching the plan
$Payload = @{
    dips = @(
        @{ tank_name = "MILLENNIUM STHP"; dip_value = 42342; dip_date = "2025-12-09" },
        @{ tank_name = "KUNDANA Gen 1"; dip_value = 87867; dip_date = "2025-12-09" },
        @{ tank_name = "KUNDANA Gen 2"; dip_value = 13855; dip_date = "2025-12-09" },
        @{ tank_name = "RHP/RUBICON SURFACE"; dip_value = 43827; dip_date = "2025-12-09" },
        @{ tank_name = "RALEIGH SURFACE"; dip_value = 20910; dip_date = "2025-12-09" },
        @{ tank_name = "MLG Kundana"; dip_value = 66070; dip_date = "2025-12-09" },
        @{ tank_name = "Paradigm O/P"; dip_value = 44000; dip_date = "2025-12-09" }
    )
}

Write-Host "🚀 Testing Kalgoorlie Dip Webhook" -ForegroundColor Cyan
Write-Host "URL: $WebhookUrl"
Write-Host ""
Write-Host "📦 Payload:" -ForegroundColor Yellow
$Payload | ConvertTo-Json -Depth 10
Write-Host ""
Write-Host "📡 Sending request..." -ForegroundColor Green
Write-Host ""

# Send the request
try {
    $Headers = @{
        "Content-Type" = "application/json"
        "X-API-Key" = $ApiKey
    }

    $Body = $Payload | ConvertTo-Json -Depth 10

    $Response = Invoke-RestMethod -Uri $WebhookUrl -Method Post -Headers $Headers -Body $Body

    Write-Host "✅ Response:" -ForegroundColor Green
    $Response | ConvertTo-Json -Depth 10
    Write-Host ""

    if ($Response.success -eq $true) {
        Write-Host "🎉 Test PASSED!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Summary:" -ForegroundColor Cyan
        $Response.summary | ConvertTo-Json
    } else {
        Write-Host "❌ Test FAILED!" -ForegroundColor Red
        $Response | ConvertTo-Json -Depth 10
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    Write-Host $_.Exception.Message
}
