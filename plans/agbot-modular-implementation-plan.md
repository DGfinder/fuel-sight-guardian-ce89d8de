# AgBot Plug-and-Play Modularity Assessment

## Executive Summary: How Far Away Are We?

**Current Status:** 🔴 **Not Close** - Significant architectural work needed

**Estimated Effort:** 3-4 weeks of focused development

**Confidence Level:** High (based on comprehensive codebase analysis)

---

## The Good News ✅

You've built a **solid foundation** that makes modularity achievable:

1. **Clean Architecture**: Service-oriented design with repositories, services, and controllers well-separated
2. **Database Structure**: `ta_agbot_*` tables already exist in tenant schemas (not in public)
3. **Tenant System**: White-label tenant infrastructure with `whitelabel_tenants` table and settings JSONB
4. **Feature Flag Ready**: Tenant settings have `'agbot_integration': true` flag defined

The architecture is **good**. The problem is it's not being **used** for multi-tenancy yet.

---

## The Critical Problems 🔴

### 1. **Webhook Has Zero Tenant Detection**

**File:** `api/gasbot-webhook.ts` (lines 37-80)

**Current State:**
```typescript
// Line 40-43: Creates ONE Supabase client (no tenant context)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

**Problem:**
- No tenant identifier in webhook payload
- No `search_path` set to route to tenant schema
- Webhook data goes to... wherever the default schema points (likely public or misconfigured)

**What's Missing:**
- Tenant detection from webhook payload (e.g., `TenantIdentifier` field)
- Lookup tenant by identifier
- Call `set_tenant_search_path` RPC before processing
- Validate AgBot is enabled for that tenant

---

### 2. **API Credentials Are Global, Not Per-Tenant**

**File:** `src/services/agbot-api.ts` (lines 28-30)

**Current State:**
```typescript
const ATHARA_API_KEY = import.meta.env.VITE_ATHARA_API_KEY;
const ATHARA_API_SECRET = import.meta.env.VITE_ATHARA_API_SECRET;
const ATHARA_BASE_URL = import.meta.env.VITE_ATHARA_BASE_URL || '...';
```

**Problem:**
- Hardcoded environment variables
- ONE set of credentials for ALL tenants
- Impossible to have different AgBot customers with different API keys

**What's Needed:**
- Store API credentials per tenant (in Vercel environment variables with prefixes)
  - `AGBOT_API_KEY_GREAT_SOUTHERN_FUELS=...`
  - `AGBOT_API_KEY_ACME_CORP=...`
- Create `AgBotConfigService` to fetch tenant-specific credentials
- Refactor API service to accept dynamic config

---

### 3. **Schema Confusion in Repositories**

**File:** `api/repositories/AgBotLocationRepository.ts` (line 100)

**Current State:**
```typescript
// Line 99-100: COMMENT says it all
// TEMPORARY: Using public schema until great_southern_fuels is exposed in Supabase API settings
let query = this.db.from('ta_agbot_locations').select('*')...
```

**Problem:**
- Comment indicates schema routing isn't working
- Unclear if queries go to tenant schemas or public schema
- Supabase `search_path` might not be set correctly

**Root Cause:**
- Backend doesn't call `set_tenant_search_path` before queries
- Webhook handler doesn't establish tenant context

---

### 4. **Frontend Has No Feature Detection**

**File:** `src/services/agbot-api.ts`, `src/pages/AgbotPage.tsx`

**Current State:**
- AgBot pages render unconditionally
- No check if AgBot is enabled for current tenant
- No graceful fallback if feature is disabled

**What's Missing:**
- `useAgBotFeature()` hook to check tenant settings
- Conditional rendering: Show "Feature not available" if disabled
- Lazy loading of AgBot components

---

### 5. **Configuration Service Doesn't Exist**

**Critical Gap:**

There's NO service to:
- Read tenant settings from `whitelabel_tenants.settings` JSONB
- Check if `features.agbot_enabled = true`
- Fetch tenant-specific AgBot configuration
- Get API credentials for a specific tenant

**What's Needed:**
```typescript
class AgBotConfigService {
  async getTenantConfig(schemaName: string): Promise<AgBotTenantConfig | null>
  async isAgBotEnabled(schemaName: string): Promise<boolean>
  async getApiCredentials(schemaName: string): Promise<{key, secret} | null>
}
```

---

## Detailed Gap Analysis by Layer

### **Database Layer** ✅ (80% Complete)
- ✅ Tables exist in tenant schemas
- ✅ Tenant settings JSONB structure defined
- ❌ No RPC to fetch tenant AgBot config
- ❌ Search path not consistently set

### **Backend API Layer** 🟡 (40% Complete)
- ✅ Clean service architecture
- ✅ Repositories and services well-structured
- ❌ Webhook: No tenant detection
- ❌ Webhook: No search_path routing
- ❌ No AgBotConfigService
- ❌ Credentials not tenant-scoped

### **Frontend Layer** 🟡 (50% Complete)
- ✅ Components exist and work
- ✅ Hooks for data fetching
- ❌ No feature detection
- ❌ API service uses hardcoded credentials
- ❌ No graceful degradation

### **Configuration Layer** 🔴 (20% Complete)
- ✅ Tenant settings JSONB exists
- ✅ Feature flag defined in GSF tenant
- ❌ No service to read tenant config
- ❌ No per-tenant credential storage
- ❌ No validation of AgBot enablement

---

## What "Plug-and-Play" Actually Requires

To copy AgBot to a new white-label and have it "just work" with new API credentials:

### **Minimum Viable Modularity:**

1. **Tenant Detection in Webhook** (2-3 days)
   - Add `TenantIdentifier` field to webhook payload
   - Resolve tenant from identifier
   - Set `search_path` before processing
   - Validate AgBot enabled

2. **Configuration Service** (2-3 days)
   - Create `AgBotConfigService`
   - Read tenant settings from database
   - Fetch per-tenant API credentials
   - Cache config for performance

3. **Per-Tenant Credentials** (1 day)
   - Store in Vercel env vars with prefixes
   - Update AgBot API service to accept dynamic config
   - Pass tenant context through API calls

4. **Frontend Feature Detection** (2 days)
   - Create `useAgBotFeature()` hook
   - Wrap pages with feature checks
   - Add "Feature not available" fallback UI

5. **Backend Tenant Routing** (2-3 days)
   - Fix search_path in all AgBot operations
   - Ensure repositories use tenant schemas
   - Remove hardcoded schema references

6. **Testing & Validation** (4-5 days)
   - Test with existing GSF tenant
   - Create test tenant without AgBot
   - Test multi-tenant webhooks
   - Validate data isolation

### **Total Estimated Time:** 14-18 working days (3-4 weeks)

---

## Why It's Harder Than Expected

You thought: "Just swap API credentials and everything works"

Reality check:

1. **Webhook is stateless** - No session, no user context, no way to know which tenant owns the data
2. **Schema routing requires RPC** - Can't just "point" at different schema without explicit PostgreSQL search_path
3. **Frontend doesn't know about tenants** - No context about which features are enabled
4. **API credentials are baked into env vars** - Frontend imports them at build time
5. **No configuration layer** - Nothing reads tenant settings and makes decisions

---

## Immediate Action Plan

### **Phase 1: Foundation (Week 1)**

**Goal:** Enable basic tenant-aware configuration

1. Create `AgBotConfigService.ts` in `api/services/`
   - Read from `whitelabel_tenants.settings` JSONB
   - Store per-tenant API credentials in Vercel env
   - Cache config with 5-minute TTL

2. Update GSF tenant settings with AgBot config:
   ```sql
   UPDATE whitelabel_tenants
   SET settings = settings || jsonb_build_object(
     'agbot', jsonb_build_object(
       'webhook_identifier', 'gsf-gasbot-2025',
       'api_base_url', 'https://dashboard2-production.prod.gasbot.io'
     )
   )
   WHERE tenant_key = 'great-southern-fuels';
   ```

3. Add Vercel environment variable:
   ```
   AGBOT_API_KEY_GREAT_SOUTHERN_FUELS=0H5NTKJPLQURW4SQDU3J0G5EO7UNZCI6EB3C
   AGBOT_API_SECRET_GREAT_SOUTHERN_FUELS=1F01ONSVQGCN47NOS987MAR768RBXJF5NO1VORQF7W
   ```

### **Phase 2: Webhook Routing (Week 2)**

**Goal:** Make webhook tenant-aware

1. Modify Athara webhook config to include:
   ```json
   {
     "TenantIdentifier": "gsf-gasbot-2025",
     "LocationId": "...",
     ...
   }
   ```

2. Update `api/gasbot-webhook.ts`:
   - Extract `TenantIdentifier` from payload
   - Lookup tenant by identifier
   - Call `set_tenant_search_path` before processing
   - Validate AgBot enabled for tenant

3. Add backward compatibility for existing GSF webhooks

### **Phase 3: Frontend Modularity (Week 3)**

**Goal:** Feature detection and dynamic config

1. Create `src/hooks/useAgBotFeature.ts`:
   - Read tenant context
   - Check if `settings.features.agbot_enabled`
   - Return config and enabled flag

2. Wrap AgBot pages:
   ```typescript
   function AgbotPage() {
     const { isEnabled } = useAgBotFeature();
     if (!isEnabled) return <FeatureNotAvailable />;
     return <AgbotPageContent />;
   }
   ```

3. Refactor API service to use dynamic config

### **Phase 4: Testing & Polish (Week 4)**

**Goal:** Validate multi-tenancy

1. Test with GSF (existing tenant)
2. Create test tenant without AgBot
3. Simulate webhook from multiple tenants
4. Verify data isolation
5. Document onboarding process

---

## Critical Files That Need Changes

### **High Priority (Must Change):**

1. `api/gasbot-webhook.ts` (80 lines)
   - Add tenant detection and routing

2. `api/repositories/AgBotLocationRepository.ts` (477 lines)
   - Remove hardcoded schema references
   - Trust search_path set by webhook

3. `src/services/agbot-api.ts` (1770 lines)
   - Refactor to accept dynamic config
   - Remove hardcoded env vars

4. `database/migrations/002_seed_gsf_tenant.sql`
   - Add AgBot-specific config to settings JSONB

### **New Files to Create:**

1. `api/services/AgBotConfigService.ts` (NEW)
   - Read tenant settings
   - Fetch API credentials
   - Validate AgBot enabled

2. `src/hooks/useAgBotFeature.ts` (NEW)
   - Feature detection hook

3. `api/lib/tenant-resolver.ts` (NEW - might exist)
   - Resolve tenant by identifier

---

## Key Architectural Decisions Needed

### **Question 1: Webhook Identifier Strategy**

**Option A:** Add field to webhook payload
- Requires Athara dashboard configuration change
- Most reliable

**Option B:** Use separate webhook URLs per tenant
- `/api/gasbot-webhook/gsf`
- `/api/gasbot-webhook/acme`
- No payload modification needed

**Recommendation:** Option A (cleaner, more scalable)

### **Question 2: Credential Storage**

**Option A:** Vercel environment variables
- Secure, simple
- Requires redeploy to add tenant

**Option B:** Database encrypted column
- Dynamic, no redeploy
- Requires encryption/decryption layer

**Recommendation:** Option A for now (simpler)

### **Question 3: Feature Detection**

**Option A:** Frontend checks tenant settings
- Requires tenant context in frontend
- Dynamic, real-time

**Option B:** Feature flags in Edge Config
- Ultra-fast
- Requires manual sync with tenant settings

**Recommendation:** Option A (single source of truth)

---

## Comparison: Current vs. Target State

### **Adding AgBot to New Tenant**

#### **Current Reality (Doesn't Work):**
1. Copy all AgBot files to new project ❌
2. Update `.env` with new API keys ❌
3. Everything breaks because:
   - Webhook doesn't route to tenant
   - Frontend hardcodes credentials
   - No feature detection

#### **Target State (Plug-and-Play):**
1. Provision tenant schema ✅
2. Add to tenant settings:
   ```sql
   UPDATE whitelabel_tenants
   SET settings = settings || jsonb_build_object(
     'features', jsonb_build_object('agbot_enabled', true),
     'agbot', jsonb_build_object(
       'webhook_identifier', 'acme-gasbot-2025'
     )
   )
   WHERE tenant_key = 'acme-corp';
   ```
3. Add Vercel env vars:
   ```
   AGBOT_API_KEY_ACME_CORP=...
   AGBOT_API_SECRET_ACME_CORP=...
   ```
4. Configure Athara webhook:
   - URL: Same endpoint
   - Payload includes: `"TenantIdentifier": "acme-gasbot-2025"`
5. ✅ **Done. Everything works.**

---

## Recommendations

### **Short-Term (If You Need Quick Demo):**

Focus on making it work for ONE tenant first:
1. Fix schema routing in webhook (set `search_path`)
2. Keep GSF credentials hardcoded for now
3. Prove data flows correctly

### **Long-Term (For True White-Label):**

Follow the 4-phase plan:
1. Build configuration service
2. Implement webhook routing
3. Add frontend feature detection
4. Test with multiple tenants

### **Pragmatic Middle Ground:**

Hybrid approach:
1. Week 1: Fix webhook schema routing for GSF
2. Week 2: Add configuration service
3. Week 3: Make credentials tenant-specific
4. Week 4: Frontend feature detection

This gets you to "mostly plug-and-play" in 1 month.

---

## Bottom Line

**You asked:** "How far away are we from plug-and-play?"

**Answer:** About **3-4 weeks of focused work**.

**The good news:** Your architecture is solid. The changes needed are well-defined and achievable.

**The challenge:** AgBot touches multiple layers (webhook, backend, frontend, config) and all need to become tenant-aware together.

**Reality check:** This isn't just "copy files and swap API keys." It requires:
- Webhook tenant routing
- Configuration service
- Per-tenant credentials
- Feature detection
- Testing across tenants

But it's **definitely achievable** with the plan outlined above.
