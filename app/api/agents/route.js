/**
 * Agent Orchestration API Route
 * =============================
 * POST /api/agents
 *
 * Purpose: Main entry point for invoking agent orchestration pipelines.
 *
 * Request Body:
 * {
 *   agent: 'router' | 'planner' | 'executor' | 'critic' | 'memory' | 'recovery',
 *   context: {
 *     module: 'edifact' | 'twitter' | 'erp',
 *     analysisId?: string,
 *     sessionId?: string,
 *     domain?: object,
 *     user?: object
 *   },
 *   messages: [
 *     { role: 'user' | 'assistant', content: string }
 *   ],
 *   parameters?: {
 *     temperature?: number,
 *     maxTokens?: number,
 *     tools?: string[]
 *   }
 * }
 *
 * Response:
 * {
 *   success: true,
 *   agentName: 'router',
 *   result: {
 *     intent: 'ANALYSIS',
 *     pipeline: 'FULL_PIPELINE',
 *     module: 'edifact',
 *     confidence: 0.95
 *   },
 *   agentPlan?: { subtasks: [...] },
 *   toolCalls?: [ { tool: string, arguments: object } ],
 *   toolResults?: [ { tool: string, result: any } ],
 *   duration_ms: 1250,
 *   streaming?: boolean
 * }
 *
 * Error Response:
 * {
 *   success: false,
 *   error: 'Agent execution failed',
 *   code: 'AGENT_ERROR',
 *   details: string
 * }
 *
 * Authentication:
 * - Requires valid JWT in HTTP-only cookie (authToken)
 * - Validates user session
 * - Logs agent invocation for audit trail
 *
 * Workflow:
 * 1. Validate request (auth, parameters)
 * 2. Load agent based on request.agent
 * 3. Load provider from user config (BYOK or managed vLLM)
 * 4. Invoke agent with context and messages
 * 5. Collect result (including agentPlan, toolCalls, toolResults if applicable)
 * 6. Persist to AnalysisChat.messages if needed
 * 7. Stream response via WebSocket or HTTP
 *
 * Future Enhancements:
 * - Support streaming responses (chunked JSON)
 * - Support parallel agent invocation
 * - Agent caching (results cache for identical inputs)
 * - Performance metrics (latency, token usage)
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Import agents
import { Router } from 'lib/ai/agents/router.js';
import { Executor } from 'lib/ai/agents/executor.js';
import { Critic } from 'lib/ai/agents/critic.js';
import { Recovery } from 'lib/ai/agents/recovery.js';
import { Memory } from 'lib/ai/agents/memory.js';

// Import orchestration
import { Scheduler } from 'lib/ai/orchestration/scheduler.js';

// Import providers
import { OpenAIAdapter } from 'lib/ai/providers/openai.js';

// Import config
import { ROUTER_CONFIG, EXECUTOR_CONFIG, CRITIC_CONFIG } from 'lib/ai/config/agents.config.js';

// Import tool registry
import { initializeToolRegistry, isToolRegistryReady } from 'lib/ai/tools/init.js';

// Import models
import User from 'models/shared/User.js';
import AnalysisChat from 'models/edifact/AnalysisChat.js';
import AnalysisMessage from 'models/edifact/AnalysisMessage.js';
import dbConnect from 'lib/dbConnect.js';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key');

/**
 * POST /api/agents
 * Main agent invocation endpoint
 */
export async function POST(request) {
  const startTime = Date.now();

  try {
    // 1. AUTHENTICATION: Validate JWT token
    const token = request.cookies.get('authToken')?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'NO_AUTH' },
        { status: 401 }
      );
    }

    let userId;
    try {
      const verified = await jwtVerify(token, SECRET);
      userId = verified.payload.sub;
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid token', code: 'INVALID_TOKEN' },
        { status: 401 }
      );
    }

    // 2. PARSE REQUEST
    const body = await request.json();
    const { agent, context = {}, messages = [], parameters = {} } = body;

    // Validate required fields
    if (!agent || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: agent (string), messages (array)',
          code: 'INVALID_REQUEST',
        },
        { status: 400 }
      );
    }

    // Validate agent name
    const validAgents = ['router', 'executor', 'critic', 'memory'];
    if (!validAgents.includes(agent)) {
      return NextResponse.json(
        { success: false, error: `Unknown agent: ${agent}`, code: 'UNKNOWN_AGENT' },
        { status: 400 }
      );
    }

    // 3. DATABASE CONNECTION
    await dbConnect();

    // 4. LOAD USER CONFIG
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }

    // 5. INITIALIZE PROVIDERS
    let provider;
    try {
      // Get user's LLM provider config
      const apiKey = user.openaiKey || process.env.OPENAI_API_KEY;
      const model = parameters.model || 'gpt-4-turbo';

      provider = new OpenAIAdapter({
        apiKey,
        model,
        temperature: parameters.temperature || 0.7,
        maxTokens: parameters.maxTokens || 4000
      });
    } catch (error) {
      console.error('[API] Provider initialization failed:', error);
      return NextResponse.json(
        { success: false, error: 'Provider initialization failed', code: 'PROVIDER_ERROR' },
        { status: 500 }
      );
    }

    // 6. INITIALIZE AGENTS
    const agents = {
      router: new Router({ ...ROUTER_CONFIG }),
      executor: new Executor({ ...EXECUTOR_CONFIG }),
      critic: new Critic({ ...CRITIC_CONFIG }),
      recovery: new Recovery(),
      memory: new Memory(),
      scheduler: new Scheduler()
    };

    // 7. INVOKE AGENT
    let result;
    const agentConfig = {
      router: ROUTER_CONFIG,
      executor: EXECUTOR_CONFIG,
      critic: CRITIC_CONFIG
    };

    console.log(`[API] Invoking ${agent} agent for user ${userId}`);

    switch (agent) {
      case 'router': {
        // Route intent classification
        result = await agents.router.invoke({
          messages,
          context,
          provider
        });
        break;
      }

      case 'executor': {
        // Execute tools (ReAct loop)
        result = await agents.executor.invoke({
          messages,
          context,
          provider,
          toolNames: parameters.tools
        });
        break;
      }

      case 'critic': {
        // Validate output
        const output = parameters.output || messages[messages.length - 1]?.content;
        result = await agents.critic.invoke({
          output,
          context,
          validators: {}
        });
        break;
      }

      case 'memory': {
        // Retrieve or store context
        if (parameters.action === 'store') {
          result = await agents.memory.store({
            message: messages[messages.length - 1],
            sessionId: context.sessionId,
            metadata: parameters.metadata
          });
        } else {
          result = await agents.memory.retrieve({
            sessionId: context.sessionId,
            limit: parameters.limit || 10,
            query: parameters.query
          });
        }
        break;
      }

      default:
        throw new Error(`Unsupported agent: ${agent}`);
    }

    // 8. PERSIST TO DATABASE (if analysis ID provided)
    if (context.sessionId && (agent === 'router' || agent === 'executor')) {
      try {
        const chat = await AnalysisChat.findById(context.sessionId);
        if (chat) {
          const message = new AnalysisMessage({
            chat: context.sessionId,
            role: 'assistant',
            content: result.reasoning || JSON.stringify(result),
            agent,
            agentPlan: result.agentPlan,
            toolCalls: result.toolCalls,
            toolResults: result.toolResults,
            metadata: {
              intent: result.intent,
              pipeline: result.pipeline,
              confidence: result.confidence
            }
          });
          await message.save();
          console.log(`[API] Persisted message to chat ${context.sessionId}`);
        }
      } catch (dbError) {
        console.warn('[API] Failed to persist message:', dbError);
        // Don't fail the request, just warn
      }
    }

    // 9. LOG INVOCATION (audit trail)
    try {
      console.log(`[API:AUDIT] Agent=${agent} User=${userId} Session=${context.sessionId} Duration=${Date.now() - startTime}ms`);
    } catch (logError) {
      console.warn('[API] Failed to log invocation:', logError);
    }

    // 10. RETURN RESPONSE
    const duration_ms = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      agentName: agent,
      result,
      duration_ms,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[API] Agent invocation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Agent execution failed',
        code: 'AGENT_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/agents
 * CORS preflight
 */
export async function OPTIONS(request) {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  );
}