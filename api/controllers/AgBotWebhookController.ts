/**
 * AgBot Webhook Controller
 * HTTP request/response handler for Gasbot webhook endpoint
 *
 * Responsibilities:
 * - Validate webhook authentication
 * - Validate HTTP method (POST only)
 * - Parse request body
 * - Delegate to orchestrator
 * - Format response
 * - Error handling
 *
 * Endpoint: POST /api/gasbot-webhook
 * Auth: Bearer token (GASBOT_WEBHOOK_SECRET)
 * Content-Type: application/json
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AgBotWebhookOrchestrator } from '../services/AgBotWebhookOrchestrator.js';

export class AgBotWebhookController {
  constructor(
    private orchestrator: AgBotWebhookOrchestrator,
    private webhookSecret: string
  ) {}

  /**
   * Handles incoming webhook POST request
   */
  async handleWebhook(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
    // 1. Validate method
    if (req.method !== 'POST') {
      console.warn(`[Webhook] Invalid method: ${req.method}`);
      return res.status(405).json({
        success: false,
        error: 'Method not allowed',
        message: 'Only POST requests are accepted'
      });
    }

    // 2. Validate authentication
    const authHeader = req.headers.authorization;
    if (!this.isAuthorized(authHeader)) {
      console.warn('[Webhook] Unauthorized request');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or missing webhook secret'
      });
    }

    // 3. Validate request body
    if (!req.body) {
      console.warn('[Webhook] Empty request body');
      return res.status(400).json({
        success: false,
        error: 'Bad request',
        message: 'Request body is required'
      });
    }

    // 4. Delegate to orchestrator
    try {
      const result = await this.orchestrator.processWebhook(req.body);

      // 5. Format response based on result status
      if (result.status === 'success') {
        return res.status(200).json({
          success: true,
          message: 'Webhook processed successfully',
          stats: {
            totalRecords: result.assetsProcessed,
            locationsProcessed: result.locationsProcessed,
            assetsProcessed: result.assetsProcessed,
            readingsProcessed: result.readingsProcessed,
            alertsTriggered: result.alertsTriggered,
            duration: result.durationMs
          },
          warnings: result.warnings.length > 0 ? result.warnings.slice(0, 5) : undefined
        });
      }

      if (result.status === 'partial') {
        return res.status(207).json({ // 207 Multi-Status
          success: true,
          message: 'Webhook processed with some errors',
          stats: {
            totalRecords: result.assetsProcessed + result.errors.length,
            locationsProcessed: result.locationsProcessed,
            assetsProcessed: result.assetsProcessed,
            readingsProcessed: result.readingsProcessed,
            alertsTriggered: result.alertsTriggered,
            duration: result.durationMs
          },
          errors: result.errors.slice(0, 5),
          warnings: result.warnings.slice(0, 5)
        });
      }

      // status === 'error'
      return res.status(400).json({
        success: false,
        error: 'Webhook processing failed',
        message: result.errors[0] || 'Unknown error occurred',
        errors: result.errors.slice(0, 5),
        duration: result.durationMs
      });

    } catch (error) {
      console.error('[Webhook] Unexpected error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: (error as Error).message
      });
    }
  }

  /**
   * Validates webhook authentication
   */
  private isAuthorized(authHeader: string | string[] | undefined): boolean {
    if (!authHeader || Array.isArray(authHeader)) {
      return false;
    }

    // Remove "Bearer " prefix if present
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    // Compare with webhook secret
    return token === this.webhookSecret;
  }

  /**
   * Gets webhook statistics (optional endpoint)
   */
  async getStatistics(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
    if (!this.isAuthorized(req.headers.authorization)) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    try {
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default: last 7 days
      const end = endDate ? new Date(endDate as string) : new Date();

      const stats = await this.orchestrator.getStatistics(start, end);

      return res.status(200).json({
        success: true,
        data: stats,
        period: {
          startDate: start.toISOString(),
          endDate: end.toISOString()
        }
      });
    } catch (error) {
      console.error('[Webhook Stats] Error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics',
        message: (error as Error).message
      });
    }
  }

  /**
   * Gets recent webhook executions (optional endpoint)
   */
  async getRecentExecutions(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
    if (!this.isAuthorized(req.headers.authorization)) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    try {
      const { limit } = req.query;
      const limitNum = limit ? parseInt(limit as string, 10) : 10;

      const executions = await this.orchestrator.getRecentExecutions(limitNum);

      return res.status(200).json({
        success: true,
        data: executions,
        count: executions.length
      });
    } catch (error) {
      console.error('[Webhook Recent] Error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch recent executions',
        message: (error as Error).message
      });
    }
  }
}
