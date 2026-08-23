#!/usr/bin/env node

/**
 * NSE-BSE MCP Server
 *
 * Streamable HTTP MCP server
 * Provides access to NSE and BSE India stock market APIs via MCP protocol.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

import { NSE, BSE } from 'nse-bse-api';

import { nseTools } from './tools/nse-tools.js';
import { bseTools } from './tools/bse-tools.js';
import { documentTools } from './tools/document-tools.js';

import { handleNseTool } from './handlers/nse-handler.js';
import { handleBseTool } from './handlers/bse-handler.js';
import { handleDocumentTool } from './handlers/document-handler.js';

// -----------------------------------------------------------------------------
// API clients
// -----------------------------------------------------------------------------

const nse = new NSE('./downloads');
const bse = new BSE({
  downloadFolder: './downloads',
});

// -----------------------------------------------------------------------------
// MCP server factory
// -----------------------------------------------------------------------------

function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'nse-bse-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // ---------------------------------------------------------------------------
  // List tools
  // ---------------------------------------------------------------------------

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        ...nseTools,
        ...bseTools,
        ...documentTools,
      ],
    };
  });

  // ---------------------------------------------------------------------------
  // Execute tools
  // ---------------------------------------------------------------------------

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request) => {
      const { name, arguments: args } = request.params;

      try {
        if (name.startsWith('nse_')) {
          return await handleNseTool(
            name,
            args || {},
            nse
          );
        }

        if (name.startsWith('bse_')) {
          return await handleBseTool(
            name,
            args || {},
            bse
          );
        }

        if (name === 'download_document') {
          return await handleDocumentTool(
            name,
            args || {}
          );
        }

        throw new Error(`Unknown tool: ${name}`);
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        console.error(
          `[MCP TOOL ERROR] ${name}:`,
          error
        );

        return {
          content: [
            {
              type: 'text',
              text: `Error: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}

// -----------------------------------------------------------------------------
// Express application
// -----------------------------------------------------------------------------

const app = express();

// -----------------------------------------------------------------------------
// CORS
// -----------------------------------------------------------------------------

const corsOrigin =
  process.env.CORS_ORIGIN || '*';

app.use(
  cors({
    origin: corsOrigin,
    methods: [
      'GET',
      'POST',
      'DELETE',
      'OPTIONS',
    ],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'Mcp-Session-Id',
      'Mcp-Protocol-Version',
      'Last-Event-ID',
    ],
    exposedHeaders: [
      'Mcp-Session-Id',
      'Mcp-Protocol-Version',
      'Content-Type',
    ],
    credentials:
      corsOrigin !== '*',
  })
);

// Explicit OPTIONS handling
app.options('*', cors());

// -----------------------------------------------------------------------------
// JSON body parser
// -----------------------------------------------------------------------------

app.use(
  express.json({
    limit: '10mb',
  })
);

// -----------------------------------------------------------------------------
// Logging middleware
// -----------------------------------------------------------------------------

app.use(
  (req: Request, _res: Response, next: NextFunction) => {
    console.log(
      `[HTTP] ${req.method} ${req.originalUrl}`
    );

    console.log(
      `[HTTP] Accept: ${req.headers.accept || '(none)'}`
    );

    console.log(
      `[HTTP] Content-Type: ${
        req.headers['content-type'] || '(none)'
      }`
    );

    console.log(
      `[HTTP] MCP Session: ${
        req.headers['mcp-session-id'] || '(none)'
      }`
    );

    next();
  }
);

// -----------------------------------------------------------------------------
// MCP Accept-header compatibility
// -----------------------------------------------------------------------------

app.use(
  '/mcp',
  (
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {
    const accept =
      req.headers.accept || '';

    /*
     * Some MCP clients send:
     *
     *   Accept: application/json
     *
     * even when using Streamable HTTP.
     *
     * The SDK can reject this with 406 when
     * text/event-stream is not advertised.
     *
     * We therefore advertise both formats.
     */

    if (
      req.method === 'POST' &&
      !accept.includes('text/event-stream')
    ) {
      req.headers.accept =
        accept.length > 0
          ? `${accept}, text/event-stream`
          : 'application/json, text/event-stream';
    }

    next();
  }
);

// -----------------------------------------------------------------------------
// Health check
// -----------------------------------------------------------------------------

app.get(
  '/health',
  (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      server: 'nse-bse-mcp-server',
      version: '1.0.0',
      transport: 'streamable-http',
      endpoint: '/mcp',
      tools: {
        nse: nseTools.length,
        bse: bseTools.length,
        documents: documentTools.length,
        total:
          nseTools.length +
          bseTools.length +
          documentTools.length,
      },
      timestamp:
        new Date().toISOString(),
    });
  }
);

// -----------------------------------------------------------------------------
// MCP POST endpoint
// -----------------------------------------------------------------------------

app.post(
  '/mcp',
  async (req: Request, res: Response) => {
    let transport:
      | StreamableHTTPServerTransport
      | undefined;

    try {
      console.log(
        '[MCP] POST /mcp received'
      );

      console.log(
        '[MCP] Request body:',
        JSON.stringify(req.body)
      );

      /*
       * Stateless mode:
       *
       * A new transport is created for each request.
       *
       * This is intentional for this deployment and
       * avoids maintaining an in-memory session map.
       */

      transport =
        new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        });

      // Clean up when HTTP connection closes.
      res.on('close', () => {
        try {
          transport?.close();
        } catch (error) {
          console.error(
            '[MCP] Transport close error:',
            error
          );
        }
      });

      // Create MCP server.
      const server =
        createMcpServer();

      // Connect MCP server to HTTP transport.
      await server.connect(
        transport
      );

      console.log(
        '[MCP] Server connected to transport'
      );

      // Process MCP request.
      await transport.handleRequest(
        req,
        res,
        req.body
      );

      console.log(
        '[MCP] Request handled'
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      console.error(
        '[MCP] POST /mcp ERROR:',
        error
      );

      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message:
              `Internal MCP server error: ${message}`,
          },
          id: null,
        });
      }
    }
  }
);

// -----------------------------------------------------------------------------
// MCP GET endpoint
// -----------------------------------------------------------------------------
//
// Streamable HTTP supports GET for SSE streams.
// Stateless mode does not maintain a session, so this
// endpoint delegates to a fresh transport.
//
// -----------------------------------------------------------------------------

app.get(
  '/mcp',
  async (req: Request, res: Response) => {
    let transport:
      | StreamableHTTPServerTransport
      | undefined;

    try {
      console.log(
        '[MCP] GET /mcp received'
      );

      transport =
        new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: false,
        });

      res.on('close', () => {
        try {
          transport?.close();
        } catch (error) {
          console.error(
            '[MCP] GET transport close error:',
            error
          );
        }
      });

      const server =
        createMcpServer();

      await server.connect(
        transport
      );

      await transport.handleRequest(
        req,
        res
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      console.error(
        '[MCP] GET /mcp ERROR:',
        error
      );

      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message:
              `Internal MCP server error: ${message}`,
          },
          id: null,
        });
      }
    }
  }
);

// -----------------------------------------------------------------------------
// MCP DELETE endpoint
// -----------------------------------------------------------------------------
//
// DELETE is part of Streamable HTTP session lifecycle.
// Stateless mode has no session to delete, but we still
// expose the endpoint for client compatibility.
//
// -----------------------------------------------------------------------------

app.delete(
  '/mcp',
  async (req: Request, res: Response) => {
    try {
      console.log(
        '[MCP] DELETE /mcp received'
      );

      const transport =
        new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        });

      await transport.handleRequest(
        req,
        res
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      console.error(
        '[MCP] DELETE /mcp ERROR:',
        error
      );

      if (!res.headersSent) {
        res.status(200).json({
          jsonrpc: '2.0',
          result: {},
          message,
        });
      }
    }
  }
);

// -----------------------------------------------------------------------------
// Root endpoint
// -----------------------------------------------------------------------------

app.get(
  '/',
  (_req: Request, res: Response) => {
    res.status(200).json({
      name: 'NSE-BSE MCP Server',
      status: 'online',
      transport: 'Streamable HTTP',
      mcpEndpoint: '/mcp',
      healthEndpoint: '/health',
      tools:
        nseTools.length +
        bseTools.length +
        documentTools.length,
    });
  }
);

// -----------------------------------------------------------------------------
// 404 handler
// -----------------------------------------------------------------------------

app.use(
  (
    req: Request,
    res: Response
  ) => {
    res.status(404).json({
      error: 'Not Found',
      path: req.originalUrl,
      availableEndpoints: [
        '/',
        '/health',
        '/mcp',
      ],
    });
  }
);

// -----------------------------------------------------------------------------
// Global Express error handler
// -----------------------------------------------------------------------------

app.use(
  (
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    console.error(
      '[EXPRESS ERROR]',
      error
    );

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }
);

// -----------------------------------------------------------------------------
// Server startup
// -----------------------------------------------------------------------------

const port = parseInt(
  process.env.PORT || '3000',
  10
);

const host =
  process.env.HOST || '0.0.0.0';

const server = app.listen(
  port,
  host,
  () => {
    console.log(
      '================================================'
    );

    console.log(
      'NSE-BSE MCP Server'
    );

    console.log(
      '================================================'
    );

    console.log(
      `Server: http://${host}:${port}`
    );

    console.log(
      `MCP endpoint: http://${host}:${port}/mcp`
    );

    console.log(
      `Health: http://${host}:${port}/health`
    );

    console.log(
      `Root: http://${host}:${port}/`
    );

    console.log(
      `NSE tools: ${nseTools.length}`
    );

    console.log(
      `BSE tools: ${bseTools.length}`
    );

    console.log(
      `Document tools: ${documentTools.length}`
    );

    console.log(
      `Total tools: ${
        nseTools.length +
        bseTools.length +
        documentTools.length
      }`
    );

    console.log(
      '================================================'
    );
  }
);

// -----------------------------------------------------------------------------
// Startup error
// -----------------------------------------------------------------------------

server.on(
  'error',
  (error) => {
    console.error(
      '[SERVER ERROR]',
      error
    );

    process.exit(1);
  }
);

// -----------------------------------------------------------------------------
// Graceful shutdown
// -----------------------------------------------------------------------------

async function shutdown(
  signal: string
) {
  console.log(
    `\nReceived ${signal}. Shutting down...`
  );

  try {
    nse.exit();
  } catch (error) {
    console.error(
      'NSE shutdown error:',
      error
    );
  }

  try {
    bse.close();
  } catch (error) {
    console.error(
      'BSE shutdown error:',
      error
    );
  }

  server.close(() => {
    console.log(
      'HTTP server closed.'
    );

    process.exit(0);
  });

  // Safety timeout
  setTimeout(() => {
    console.error(
      'Forced shutdown.'
    );

    process.exit(1);
  }, 10000);
}

process.on(
  'SIGINT',
  () => shutdown('SIGINT')
);

process.on(
  'SIGTERM',
  () => shutdown('SIGTERM')
);
