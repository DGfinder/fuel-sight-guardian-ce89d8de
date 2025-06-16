# Fuel Sight Guardian - Deployment Guide

## Deploy to fueldips.greatsouthernfuels.com.au

### Phase 1: Initial Deployment (5 minutes)

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy Application**
   ```bash
   cd /path/to/fuel-sight-guardian
   vercel --prod
   ```
   - Follow prompts
   - Choose "Create new project"
   - Use all default settings

3. **Note the Deployment URL**
   - You'll get a URL like: `fuel-sight-guardian.vercel.app`

### Phase 2: Custom Domain Setup (10 minutes)

4. **Add Custom Domain in Vercel**
   - Go to Vercel dashboard
   - Select your project
   - Go to "Settings" → "Domains"
   - Add: `fueldips.greatsouthernfuels.com.au`

5. **Get DNS Records from Vercel**
   - Vercel will show you DNS records to add
   - Usually a CNAME record pointing to Vercel

6. **Add DNS Records to Your Domain**
   
   **Find Your DNS Provider:**
   - Check where you bought `greatsouthernfuels.com.au`
   - Common Australian providers:
     - Crazy Domains
     - Netregistry
     - VentraIP
     - GoDaddy
     - Melbourne IT
   
   **Add the CNAME Record:**
   ```
   Type: CNAME
   Name: fueldips (or fuel)
   Target: [provided by Vercel]
   TTL: 300
   ```

### Phase 3: Environment Variables

7. **Set Production Environment Variables**
   - In Vercel dashboard → Settings → Environment Variables
   - Add:
     ```
     VITE_SUPABASE_URL=your-supabase-project-url
     VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
     ```

### Phase 4: SSL & Security (Automatic)

8. **SSL Certificate**
   - Vercel automatically provisions SSL
   - Your site will be accessible via HTTPS
   - Usually takes 5-15 minutes after DNS propagation

### Phase 5: Testing & Monitoring

9. **Test Deployment**
   - Visit `https://fueldips.greatsouthernfuels.com.au`
   - Test all functionality:
     - Login/logout
     - Tank viewing
     - Dip entry with date picker
     - RBAC permissions
     - Previous dips tab

10. **Set Up Monitoring**
    - Add domain to UptimeRobot (free)
    - Configure email alerts
    - Monitor performance with Vercel Analytics

## Alternative: Netlify Deployment

If you prefer Netlify:

```bash
# Build the app
npm run build

# Deploy to Netlify
npm install -g netlify-cli
netlify deploy --prod --dir dist
```

## DNS Provider Quick Check

To find your DNS provider:
1. Log into where you purchased `greatsouthernfuels.com.au`
2. Look for "DNS Management" or "Name Servers"
3. Or check your domain registrar account

## Common Australian DNS Providers

### Crazy Domains
- Login → Domain Manager → DNS Settings

### Netregistry  
- Login → Manage Domains → DNS Zone Editor

### VentraIP
- Login → Domain Management → DNS Management

### GoDaddy
- Login → My Products → Domains → DNS

## Post-Deployment Checklist

- [ ] Application loads at custom domain
- [ ] SSL certificate active (green padlock)
- [ ] All features working (login, dips, charts)
- [ ] RBAC permissions working
- [ ] Performance acceptable (<3s load time)
- [ ] Uptime monitoring configured
- [ ] Team notified of new URL

## Estimated Costs

- **Vercel**: Free for this usage level
- **SSL Certificate**: Free (automatic)
- **CDN**: Free (included)
- **Monitoring**: Free (UptimeRobot basic plan)

**Total Cost: $0/month**

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Verify DNS propagation: https://dnschecker.org
3. Test Supabase connection in production
4. Check browser console for errors

## Maintenance

- **Updates**: Git push triggers automatic deployment
- **Monitoring**: Weekly uptime reports via email
- **Backups**: Automatic via Vercel + Git history