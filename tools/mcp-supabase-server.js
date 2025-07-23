#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env file if available
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Load .env file from project root
config({ path: join(rootDir, '.env') });

// Get Supabase configuration from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
  console.error('📝 Please ensure your .env file exists in the project root with:');
  console.error('   SUPABASE_URL=your_supabase_url');
  console.error('   SUPABASE_ANON_KEY=your_supabase_anon_key');
  console.error('💡 You can copy from .env.example if needed');
  process.exit(1);
}

console.log('✅ MCP Supabase Server starting...');
console.log(`🔗 Connecting to: ${SUPABASE_URL.substring(0, 30)}...`);
console.log(`🔑 Using anon key: ${SUPABASE_ANON_KEY.substring(0, 20)}...`);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false, // MCP server doesn't need session persistence
    autoRefreshToken: false,
  },
  global: {
    headers: {
      'x-application-name': 'fuel-sight-guardian-mcp'
    }
  }
});

const server = new Server(
  {
    name: 'supabase-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'supabase_query',
        description: 'Execute a SELECT query on Supabase database',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'The table name to query',
            },
            select: {
              type: 'string',
              description: 'Columns to select (default: *)',
              default: '*',
            },
            filter: {
              type: 'object',
              description: 'Filter conditions as key-value pairs',
              additionalProperties: true,
            },
            limit: {
              type: 'number',
              description: 'Maximum number of rows to return',
            },
          },
          required: ['table'],
        },
      },
      {
        name: 'supabase_insert',
        description: 'Insert data into a Supabase table',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'The table name to insert into',
            },
            data: {
              type: 'object',
              description: 'The data to insert as key-value pairs',
              additionalProperties: true,
            },
          },
          required: ['table', 'data'],
        },
      },
      {
        name: 'supabase_update',
        description: 'Update data in a Supabase table',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'The table name to update',
            },
            data: {
              type: 'object',
              description: 'The data to update as key-value pairs',
              additionalProperties: true,
            },
            filter: {
              type: 'object',
              description: 'Filter conditions as key-value pairs',
              additionalProperties: true,
            },
          },
          required: ['table', 'data', 'filter'],
        },
      },
      {
        name: 'supabase_delete',
        description: 'Delete data from a Supabase table',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'The table name to delete from',
            },
            filter: {
              type: 'object',
              description: 'Filter conditions as key-value pairs',
              additionalProperties: true,
            },
          },
          required: ['table', 'filter'],
        },
      },
      {
        name: 'supabase_rpc',
        description: 'Call a Supabase database function (RPC)',
        inputSchema: {
          type: 'object',
          properties: {
            function_name: {
              type: 'string',
              description: 'The name of the database function to call',
            },
            params: {
              type: 'object',
              description: 'Parameters to pass to the function',
              additionalProperties: true,
            },
          },
          required: ['function_name'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'supabase_query': {
        const { table, select = '*', filter, limit } = args;
        let query = supabase.from(table).select(select);
        
        if (filter) {
          Object.entries(filter).forEach(([key, value]) => {
            query = query.eq(key, value);
          });
        }
        
        if (limit) {
          query = query.limit(limit);
        }
        
        const { data, error } = await query;
        
        if (error) {
          throw new McpError(ErrorCode.InternalError, `Query failed: ${error.message}`);
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'supabase_insert': {
        const { table, data } = args;
        const { data: result, error } = await supabase.from(table).insert(data).select();
        
        if (error) {
          throw new McpError(ErrorCode.InternalError, `Insert failed: ${error.message}`);
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'supabase_update': {
        const { table, data, filter } = args;
        let query = supabase.from(table).update(data);
        
        Object.entries(filter).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
        
        const { data: result, error } = await query.select();
        
        if (error) {
          throw new McpError(ErrorCode.InternalError, `Update failed: ${error.message}`);
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'supabase_delete': {
        const { table, filter } = args;
        let query = supabase.from(table).delete();
        
        Object.entries(filter).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
        
        const { data: result, error } = await query.select();
        
        if (error) {
          throw new McpError(ErrorCode.InternalError, `Delete failed: ${error.message}`);
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'supabase_rpc': {
        const { function_name, params = {} } = args;
        const { data, error } = await supabase.rpc(function_name, params);
        
        if (error) {
          throw new McpError(ErrorCode.InternalError, `RPC call failed: ${error.message}`);
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error.message}`);
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Supabase MCP server running on stdio');
}

runServer().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});