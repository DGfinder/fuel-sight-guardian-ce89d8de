# Supabase MCP Server Setup

## For Claude Code CLI

Add this to your `~/.claude.json` (or `C:\Users\<YourUsername>\.claude.json` on Windows):

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--access-token",
        "sbp_9881bbe7785660066b22ce7b2a4c3f735d558300",
        "--project-ref",
        "wjzsdsvbtapriiuxzmih"
      ]
    }
  }
}
```

## For Cursor

Add this to your Cursor MCP settings (Settings > MCP Servers):

**Server Name:** `supabase`

**Command:**
```
npx
```

**Arguments:**
```
-y @supabase/mcp-server-supabase@latest --access-token sbp_9881bbe7785660066b22ce7b2a4c3f735d558300 --project-ref wjzsdsvbtapriiuxzmih
```

### Alternative: Cursor MCP Config File

If Cursor uses a JSON config file for MCP servers (usually `~/.cursor/mcp.json` or similar), use:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--access-token",
        "sbp_9881bbe7785660066b22ce7b2a4c3f735d558300",
        "--project-ref",
        "wjzsdsvbtapriiuxzmih"
      ]
    }
  }
}
```

## Connection Details

| Field | Value |
|-------|-------|
| Project Ref | `wjzsdsvbtapriiuxzmih` |
| Access Token | `sbp_9881bbe7785660066b22ce7b2a4c3f735d558300` |

## Available Tools (20)

Once connected, you'll have access to these Supabase tools:
- `list_tables` - List all tables in schemas
- `list_extensions` - List database extensions
- `list_migrations` - List migrations
- `apply_migration` - Apply DDL migrations
- `execute_sql` - Run SQL queries
- `get_logs` - Get service logs
- `get_advisors` - Security/performance advisors
- `get_project_url` - Get API URL
- `get_publishable_keys` - Get API keys
- `generate_typescript_types` - Generate TS types
- `list_edge_functions` - List Edge Functions
- `get_edge_function` - Get Edge Function code
- `deploy_edge_function` - Deploy Edge Functions
- `create_branch` - Create dev branch
- `list_branches` - List branches
- `delete_branch` - Delete branch
- `merge_branch` - Merge to production
- `reset_branch` - Reset branch migrations
- `rebase_branch` - Rebase on production
- `search_docs` - Search Supabase docs

## Troubleshooting

1. **Ensure Node.js is installed** - npx requires Node.js
2. **Run from project directory** - Some configs are project-scoped
3. **Restart Claude/Cursor** after config changes
4. **Check firewall** - Supabase API needs internet access

## Security Note

Keep your access token secure. Don't commit this file to public repositories.
