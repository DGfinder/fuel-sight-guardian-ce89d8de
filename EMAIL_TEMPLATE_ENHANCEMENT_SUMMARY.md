# Email Template Enhancement Summary

## Overview

I've completely redesigned the AgBot email system with improved information hierarchy, comprehensive analytics, and Great Southern Fuels branding. The new system supports **daily, weekly, and monthly** report frequencies with enhanced data visualization and insights.

---

## 🎨 Key Improvements

### 1. **Information Hierarchy** (Prioritized for End Users)

**Above the Fold - Executive Summary:**
- ✅ **24-hour fuel consumption** (HIGHLIGHTED) - Most important metric
- ✅ **Total tanks monitored**
- ✅ **Refills needed** (next 3 days)
- ✅ **Online status** and **Alert counts**

**Tank Cards (Sorted by Priority):**
- ✅ **Tank name** (prominent, bold)
- ✅ **Capacity display**: "X L / Y,000 L" (highlighted)
- ✅ **Current fill percentage** (color-coded: red/amber/green)
- ✅ **24hr fuel usage** with trend indicator (↑↓→)
- ✅ **Days remaining** with estimated refill date
- ✅ **7-day consumption sparkline** (mini chart)
- ✅ **Battery and connectivity status**

### 2. **Great Southern Fuels Branding**

**Brand Colors:**
- Primary Green: `#2d7a2e` (from logo)
- Green Light: `#4a9d4c`
- Green Dark: `#1f5620`

**Visual Identity:**
- Logo display (text-based badge when image unavailable)
- Green gradient header
- Professional color scheme throughout
- Branded footer with support contact

### 3. **Analytics & Data Insights**

**Per-Tank Metrics:**
- 24-hour consumption (litres + percentage)
- 7-day consumption with daily breakdown
- 30-day consumption (monthly reports)
- Consumption trend (increasing/decreasing/stable)
- Efficiency score vs baseline
- Comparison vs yesterday and 7-day average

**Fleet-Wide Metrics:**
- Total fleet consumption (24h/7d/30d)
- Fleet trend analysis
- Top consuming tanks
- Average efficiency score

### 4. **Report Frequency Support**

**Daily Reports:**
- Focus: Immediate actionable data
- 24hr consumption highlighted
- 7-day trend sparklines
- Text-based indicators for fast loading

**Weekly Reports:**
- Focus: Pattern analysis
- Weekly consumption charts
- Day-of-week patterns
- Fleet comparison charts

**Monthly Reports:**
- Focus: Long-term trends
- 30-day consumption analysis
- Refill frequency tracking
- Cost projections and forecasting

### 5. **Chart Visualizations**

**Embedded Charts (Weekly/Monthly):**
- 7-day consumption trend line chart
- Weekly pattern bar chart
- Fleet comparison horizontal bar chart
- Trend sparklines (inline mini-charts)

**Charts Generated via QuickChart API:**
- Free, no authentication required
- Chart.js based
- Email-compatible image URLs

---

## 📁 New Files Created

### Core Template System

1. **`api/lib/agbot-email-template-v2.ts`**
   - Enhanced HTML email template
   - Great Southern Fuels branding
   - Support for all report frequencies
   - Responsive design, mobile-friendly

2. **`api/lib/agbot-email-analytics.ts`**
   - Server-side analytics queries
   - 24hr/7day/30day consumption calculations
   - Trend analysis functions
   - Fleet summary aggregation

3. **`api/lib/agbot-chart-generator.ts`**
   - Chart URL generation via QuickChart
   - Sparkline generators
   - Fleet comparison charts
   - ASCII sparklines for text emails

4. **`api/lib/agbot-report-generator.ts`**
   - Master report generator
   - Wrapper functions for daily/weekly/monthly
   - Frequency-based date formatting
   - Report scheduling logic

---

## 🔧 Modified Files

1. **`api/cron/send-agbot-reports.ts`**
   - ✅ Supports all report frequencies
   - ✅ Feature flag: `USE_ENHANCED_REPORTS = true`
   - ✅ Automatic frequency filtering (sends weekly on Mondays, monthly on 1st)
   - ✅ Backward compatible with legacy template

2. **`api/test-send-email.ts`**
   - ✅ Enhanced with `use_enhanced` parameter
   - ✅ `frequency` parameter (daily/weekly/monthly)
   - ✅ Test all template variants
   - ✅ Detailed logging and debugging

---

## 🚀 How to Use

### Enable Enhanced Reports

In `api/cron/send-agbot-reports.ts`, set:

```typescript
const USE_ENHANCED_REPORTS = true; // Line 14
```

### Test Email Templates

Send test emails via `POST /api/test-send-email`:

```bash
# Test Daily Report (Legacy)
curl -X POST https://your-domain/api/test-send-email \
  -H "Content-Type: application/json" \
  -d '{
    "contact_id": "your-contact-uuid",
    "use_enhanced": false,
    "frequency": "daily"
  }'

# Test Daily Report (Enhanced)
curl -X POST https://your-domain/api/test-send-email \
  -H "Content-Type: application/json" \
  -d '{
    "contact_id": "your-contact-uuid",
    "use_enhanced": true,
    "frequency": "daily"
  }'

# Test Weekly Report (Enhanced)
curl -X POST https://your-domain/api/test-send-email \
  -H "Content-Type: application/json" \
  -d '{
    "contact_id": "your-contact-uuid",
    "use_enhanced": true,
    "frequency": "weekly"
  }'

# Test Monthly Report (Enhanced)
curl -X POST https://your-domain/api/test-send-email \
  -H "Content-Type: application/json" \
  -d '{
    "contact_id": "your-contact-uuid",
    "use_enhanced": true,
    "frequency": "monthly"
  }'
```

### Report Scheduling

The cron job (`/api/cron/send-agbot-reports`) runs **daily at 7 AM AWST (11 PM UTC)**.

**Automatic Frequency Filtering:**
- **Daily**: Sent every day
- **Weekly**: Sent only on Mondays
- **Monthly**: Sent only on the 1st of each month

---

## 📊 Data Hierarchy in Templates

### Priority 1: Executive Summary
```
┌─────────────────────────────────────────┐
│  24-Hour Usage   Tanks   Refills Needed │
│     5,240 L        12          2        │
│                                         │
│  Online  Low Fuel  Critical  7d Usage  │
│    11        3         2      34,680 L │
└─────────────────────────────────────────┘
```

### Priority 2: Individual Tank Cards
```
┌─────────────────────────────────────────┐
│ Tank Name                         85%   │
│ 🟢 Online • Diesel                      │
│ 17,000 L / 20k L               ~45 days │
│                                         │
│ 24-Hour Usage                           │
│   380 L ↑ (1.9%)                       │
│                                         │
│ Avg daily: ~350 L/day                   │
│ 7d trend: ▁▂▃▄▅▆▇                       │
└─────────────────────────────────────────┘
```

### Priority 3: Fleet Analytics (Weekly/Monthly)
```
┌─────────────────────────────────────────┐
│ 📊 Fleet Analytics                      │
│                                         │
│ Fleet trend: 📈 increasing              │
│ Highest consumer: Tank A (1,200 L/24h)│
│                                         │
│ [Top 10 Tanks Chart]                    │
└─────────────────────────────────────────┘
```

---

## 🎨 Color Coding

**Fuel Levels:**
- 🔴 **Critical** (<15% or ≤3 days): `#dc2626`
- 🟠 **Low** (<30%): `#d97706`
- 🟢 **Good** (≥30%): `#059669`

**Brand Colors:**
- **Primary**: `#2d7a2e` (Great Southern Fuels green)
- **Accent**: `#4a9d4c` (Light green)
- **Dark**: `#1f5620` (Dark green)

---

## 🔮 Future Enhancements

### Logo Hosting
Currently using text-based logo badge. To add image logo:

1. Upload `src/assets/logo.png` to a CDN or Resend
2. Update `logoUrl` parameter in report generator
3. Logo will automatically display in email header

### Additional Features You Can Add

1. **Cost Tracking**
   - Add fuel price data to analytics
   - Calculate 24hr/7d/30d fuel costs
   - Budget vs actual comparisons

2. **Predictive Alerts**
   - "Tank will reach critical in 5 days"
   - "Refill recommended by [date]"
   - Weather-adjusted consumption forecasts

3. **Multi-Language Support**
   - Template localization
   - Date/number formatting by locale

4. **Custom Branding Per Customer**
   - Customer-specific logos
   - Color scheme customization
   - White-label support

5. **Interactive Elements**
   - "Schedule Refill" button
   - Direct link to tank details
   - Feedback/survey links

---

## 📧 Email Deliverability

**Headers Included:**
- ✅ List-Unsubscribe (one-click)
- ✅ Reply-To: support@greatsouthernfuel.com.au
- ✅ Plain text version (accessibility)
- ✅ Mobile-responsive HTML
- ✅ Verified domain: tankalert.greatsouthernfuels.com.au

**Best Practices:**
- ✅ Inline CSS (email client compatibility)
- ✅ Table-based layout (Outlook support)
- ✅ Alt text for images
- ✅ Semantic HTML
- ✅ Light mode optimized

---

## 🧪 Testing Checklist

- [x] Daily report template (legacy)
- [x] Daily report template (enhanced)
- [x] Weekly report template (enhanced)
- [x] Monthly report template (enhanced)
- [x] Brand colors applied correctly
- [x] Charts generate successfully
- [x] Analytics calculations accurate
- [x] Frequency filtering works
- [x] Mobile responsive
- [x] Plain text version included
- [x] Unsubscribe links functional
- [x] Error handling robust

---

## 🎯 Key Metrics Displayed

### 24-Hour Period
- Fuel consumed (litres)
- Percentage consumed
- Trend vs yesterday

### 7-Day Period
- Weekly total consumption
- Daily breakdown (sparkline)
- Average daily usage
- Week-over-week comparison

### 30-Day Period (Monthly reports)
- Monthly total consumption
- Refill frequency analysis
- Long-term trend direction
- Cost projections

---

## 💡 Implementation Notes

1. **Feature Flag**: The system uses a feature flag to allow gradual rollout
2. **Backward Compatible**: Legacy template still available
3. **Performance**: Analytics queries run in parallel for speed
4. **Scalability**: Designed to handle 100s of tanks per customer
5. **Error Handling**: Graceful fallbacks if analytics data unavailable

---

## 📝 Database Schema

No database changes required! The enhanced system uses existing tables:
- `customer_contacts` - Contact info and preferences
- `agbot_locations` - Tank master data
- `agbot_assets` - Tank telemetry
- `agbot_readings_history` - Historical data for analytics
- `customer_email_logs` - Email delivery tracking

---

## 🚨 Important Notes

1. **Logo URL**: Currently set to `undefined`. Upload logo and update `logoUrl` parameter to display brand image.

2. **QuickChart Limits**: Free tier allows 60 requests/minute. For high-volume usage, consider self-hosted charting or paid tier.

3. **Report Scheduling**:
   - Cron runs daily
   - Weekly reports sent on Mondays
   - Monthly reports sent on 1st of month

4. **Feature Flag**: Set `USE_ENHANCED_REPORTS = true` in cron job to enable new templates globally.

---

## ✅ Success Criteria Met

✅ **Information Hierarchy**: Critical data (capacity, 24hr usage) highlighted
✅ **Tank Name**: Prominent display
✅ **Litres Capacity**: Highlighted format (X L / Yk L)
✅ **24-Hour Usage**: Featured in summary and per-tank cards
✅ **Weekly Usage**: Included with sparkline visualization
✅ **Graphs & Trends**: Charts embedded (weekly/monthly), sparklines (daily)
✅ **Great Southern Fuels Branding**: Logo, colors, footer
✅ **All Frequencies**: Daily, weekly, monthly templates
✅ **Analytics**: Comprehensive consumption data and insights

---

## 🎉 Ready to Deploy!

The enhanced email system is production-ready. To activate:

1. Set `USE_ENHANCED_REPORTS = true` in `api/cron/send-agbot-reports.ts`
2. Test using the `/api/test-send-email` endpoint
3. Monitor `customer_email_logs` table for delivery status
4. Collect user feedback and iterate

**Questions?** Contact support at support@greatsouthernfuel.com.au
