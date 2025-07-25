# MCP Setup Guide - Supabase Integration

## 🎯 **Overview**
This guide helps you set up the Model Context Protocol (MCP) server to interact with your Supabase database directly through Claude Code.

## ✅ **What's Been Configured**

### **1. Environment Variables Setup**
- **`.env` file created** with Supabase credentials
- **Removed hardcoded secrets** from `mcp.json`
- **Enhanced error handling** in MCP server

### **2. Secure Configuration**
- **No credentials in version control** - only in `.env` file
- **Proper environment variable loading** with dotenv
- **Clear error messages** if configuration is missing

## 🚀 **Testing the MCP Connection**

### **Step 1: Install Dependencies**
Make sure you have the required packages:
```bash
npm install dotenv
# or if using different package manager
yarn add dotenv
```

### **Step 2: Test MCP Server Manually**
You can test if the MCP server starts correctly:
```bash
cd /mnt/c/Users/Hayden/Downloads/fuel-sight-guardian-ce89d8de
node tools/mcp-supabase-server.js
```

**Expected Output:**
```
✅ MCP Supabase Server starting...
🔗 Connecting to: https://wjzsdsvbtapriiuxzmih...
🔑 Using anon key: eyJhbGciOiJIUzI1NiIsInR...
```

**If you see errors:**
- Check that `.env` file exists in project root
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set in `.env`
- Ensure dotenv package is installed

### **Step 3: Test Through Claude Code**
Now you should be able to use MCP tools in Claude Code. Try these commands to test database connectivity:

#### **Test 1: List Tables**
```
Can you show me what tables exist in the database?
```

#### **Test 2: Query Tank Data**
```
Can you run a simple query to show me a few tanks from the fuel_tanks table?
```

#### **Test 3: Run Recovery Scripts**
```
Can you execute the frontend_compatible_view.sql script from the database/fixes/ directory?
```

## 🔧 **MCP Commands Available**

With the MCP server running, you now have access to:

### **Database Operations**
- **Query execution** - Run any SQL query
- **View management** - Create, update, drop views
- **Data inspection** - Check table structures and data
- **Fix deployment** - Apply database fixes automatically

### **File Operations**
- **Read SQL files** - Execute scripts from your database/ directory
- **Write results** - Save query outputs to files
- **Backup operations** - Export data or schemas

## 📁 **Project Structure**
```
fuel-sight-guardian-ce89d8de/
├── .env                          # ✅ Your Supabase credentials
├── mcp.json                      # ✅ MCP configuration (no hardcoded secrets)
├── tools/
│   └── mcp-supabase-server.js    # ✅ Enhanced MCP server
├── database/
│   └── fixes/
│       ├── frontend_compatible_view.sql
│       └── non_recursive_rls_policies.sql
└── MANUAL_RECOVERY_STEPS.md      # ✅ Fallback instructions
```

## 🔒 **Security Notes**

### **What's Secure Now:**
- ✅ **No hardcoded credentials** in version control
- ✅ **Environment-based configuration**
- ✅ **Using anon key** (not service role) for proper RLS
- ✅ **Clear error messages** without exposing secrets

### **Important Security Reminders:**
- **Never commit `.env` file** - it's in `.gitignore`
- **Rotate keys periodically** through Supabase dashboard
- **Use anon key** for client-side access (respects RLS)
- **Monitor access logs** in Supabase for unusual activity

## ❌ **Troubleshooting**

### **"Environment variables are required" Error**
```bash
❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required
```
**Solution:**
1. Check `.env` file exists in project root
2. Verify variables are set correctly
3. Restart Claude Code to reload environment

### **"Cannot find module 'dotenv'" Error**
```bash
Error: Cannot find module 'dotenv'
```
**Solution:**
```bash
npm install dotenv
```

### **MCP Server Won't Start**
1. Check file paths in `mcp.json` are correct
2. Verify Node.js is installed and accessible
3. Try running the server manually first

### **Database Connection Fails**
1. Verify Supabase URL is correct
2. Check anon key is valid (not expired)
3. Test connection in Supabase dashboard first

## 🎉 **Success! What You Can Do Now**

With MCP working, you can:
- **Execute database fixes** directly through Claude Code
- **Run queries** without switching to Supabase dashboard  
- **Deploy schema changes** with single commands
- **Monitor database health** through automated checks
- **Test fixes** immediately after applying them

## 📞 **Next Steps**

1. **Test the connection** using the steps above
2. **Run database fixes** using MCP instead of manual SQL
3. **Monitor results** through enhanced logging
4. **Apply remaining fixes** from the recovery plan

The MCP integration makes database management much more efficient and reduces the chance of errors from manual copy/paste operations!