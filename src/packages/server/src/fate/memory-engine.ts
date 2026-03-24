/**
 * memory-engine.ts — Agent Memory Persistence System
 *
 * Agents learn from experience. Arena outcomes become memories that
 * influence future decisions. Betrayal creates trauma. Patterns emerge.
 *
 * Memory types:
 * - arena_pattern: general arena outcome memories
 * - betrayal_trauma: specific betrayal events (high importance, slow decay)
 * - trust_insight: observations about opponent behavior
 * - strategy_lesson: learned strategic lessons
 */

import { getPool } from '../db/postgres.js';

// ─── Types ───────────────────────────────────────────────────

export interface AgentMemory {
  id: number;
  agentId: string;
  memoryType: 'arena_pattern' | 'betrayal_trauma' | 'trust_insight' | 'strategy_lesson';
  content: {
    opponentId?: string;
    opponentArchetype?: string;
    action?: string;
    opponentAction?: string;
    outcome?: string;
    matchType?: string;
    lesson?: string;
    trustChange?: number;
    reward?: number;
    [key: string]: unknown;
  };
  importance: number;
  tickCreated: number;
  tickLastAccessed: number | null;
  accessCount: number;
  decayRate: number;
}

export interface OpponentExperience {
  cooperationBias: number;       // positive = they cooperate, negative = they betray
  betrayalTraumaCount: number;
  totalEncounters: number;
  confidenceLevel: number;       // 0-1, more encounters = higher
  lastOutcome: string | null;
}

// ─── Memory Creation ─────────────────────────────────────────

/**
 * Create a memory from an arena match outcome.
 */
export async function createArenaMemory(
  agentId: string,
  matchData: {
    matchId: number;
    matchType: string;
    opponentId: string;
    opponentArchetype?: string;
    myAction: string;
    opponentAction: string;
    outcome: string;     // 'CC', 'CD', 'DC', 'DD'
    reward: number;
    trustChange: number;
  },
  currentTick: number,
): Promise<void> {
  const pool = getPool();

  // Determine importance based on outcome significance
  let importance = 0.5;
  if (matchData.outcome === 'CD') importance = 0.9; // I was betrayed — very important
  if (matchData.outcome === 'DC') importance = 0.7; // I betrayed — moderately important
  if (matchData.outcome === 'CC') importance = 0.4; // mutual cooperation — routine
  if (matchData.outcome === 'DD') importance = 0.6; // mutual defection — notable

  const lesson = generateLesson(matchData.outcome, matchData.matchType);

  const content = {
    opponentId: matchData.opponentId,
    opponentArchetype: matchData.opponentArchetype,
    action: matchData.myAction,
    opponentAction: matchData.opponentAction,
    outcome: matchData.outcome,
    matchType: matchData.matchType,
    matchId: matchData.matchId,
    lesson,
    trustChange: matchData.trustChange,
    reward: matchData.reward,
  };

  await pool.query(
    `INSERT INTO agent_memories (agent_id, memory_type, content, importance, tick_created, decay_rate)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [agentId, 'arena_pattern', JSON.stringify(content), importance, currentTick, 0.005],
  );
}

/**
 * Create a betrayal trauma memory — high importance, very slow decay.
 */
export async function createBetrayalTrauma(
  agentId: string,
  betrayerId: string,
  betrayerArchetype: string | undefined,
  matchType: string,
  currentTick: number,
): Promise<void> {
  const pool = getPool();

  const content = {
    opponentId: betrayerId,
    opponentArchetype: betrayerArchetype,
    matchType,
    lesson: `${betrayerId} betrayed me in ${matchType}`,
    traumatic: true,
  };

  await pool.query(
    `INSERT INTO agent_memories (agent_id, memory_type, content, importance, tick_created, decay_rate)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [agentId, 'betrayal_trauma', JSON.stringify(content), 0.95, currentTick, 0.001],
  );
}

/**
 * Create a trust insight about an opponent.
 */
export async function createTrustInsight(
  agentId: string,
  opponentId: string,
  insight: string,
  currentTick: number,
): Promise<void> {
  const pool = getPool();

  const content = {
    opponentId,
    lesson: insight,
  };

  await pool.query(
    `INSERT INTO agent_memories (agent_id, memory_type, content, importance, tick_created, decay_rate)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [agentId, 'trust_insight', JSON.stringify(content), 0.6, currentTick, 0.01],
  );
}

/**
 * Create a strategy lesson from pattern recognition.
 */
export async function createStrategyLesson(
  agentId: string,
  lesson: string,
  currentTick: number,
  importance: number = 0.7,
): Promise<void> {
  const pool = getPool();

  const content = { lesson };

  await pool.query(
    `INSERT INTO agent_memories (agent_id, memory_type, content, importance, tick_created, decay_rate)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [agentId, 'strategy_lesson', JSON.stringify(content), importance, currentTick, 0.008],
  );
}

// ─── Memory Retrieval ────────────────────────────────────────

/**
 * Recall memories relevant to a specific opponent and match type.
 * Updates access timestamps and counts.
 */
export async function recallRelevantMemories(
  agentId: string,
  opponentId: string,
  matchType: string,
  limit: number = 10,
  currentTick?: number,
): Promise<AgentMemory[]> {
  const pool = getPool();

  // Fetch memories about this opponent, plus general strategy lessons
  const result = await pool.query<Record<string, unknown>>(
    `SELECT * FROM agent_memories
     WHERE agent_id = $1
       AND (
         content->>'opponentId' = $2
         OR memory_type = 'strategy_lesson'
         OR (memory_type = 'arena_pattern' AND content->>'matchType' = $3)
       )
     ORDER BY importance DESC, created_at DESC
     LIMIT $4`,
    [agentId, opponentId, matchType, limit],
  );

  const memories = result.rows.map(mapRowToMemory);

  // Update access metadata
  if (memories.length > 0 && currentTick) {
    const ids = memories.map(m => m.id);
    await pool.query(
      `UPDATE agent_memories
       SET tick_last_accessed = $1, access_count = access_count + 1
       WHERE id = ANY($2)`,
      [currentTick, ids],
    );
  }

  return memories;
}

/**
 * Calculate experience-based modifier for a specific opponent.
 */
export async function getOpponentExperienceModifier(
  agentId: string,
  opponentId: string,
): Promise<OpponentExperience> {
  const pool = getPool();

  // Get all arena_pattern memories about this opponent
  const arenaResult = await pool.query<Record<string, unknown>>(
    `SELECT content FROM agent_memories
     WHERE agent_id = $1
       AND content->>'opponentId' = $2
       AND memory_type = 'arena_pattern'
     ORDER BY created_at DESC
     LIMIT 50`,
    [agentId, opponentId],
  );

  // Count betrayal traumas
  const traumaResult = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*) as cnt FROM agent_memories
     WHERE agent_id = $1
       AND content->>'opponentId' = $2
       AND memory_type = 'betrayal_trauma'`,
    [agentId, opponentId],
  );

  const totalEncounters = arenaResult.rows.length;
  const betrayalTraumaCount = Number(traumaResult.rows[0]?.cnt ?? 0);

  if (totalEncounters === 0) {
    return {
      cooperationBias: 0,
      betrayalTraumaCount,
      totalEncounters: 0,
      confidenceLevel: 0,
      lastOutcome: null,
    };
  }

  // Calculate cooperation bias: how often opponent cooperated vs betrayed
  let coopCount = 0;
  let betrayCount = 0;
  let lastOutcome: string | null = null;

  for (const row of arenaResult.rows) {
    const content = row.content as Record<string, unknown>;
    const opponentAction = content.opponentAction as string | undefined;
    if (!lastOutcome) {
      lastOutcome = content.outcome as string | null;
    }
    if (opponentAction === 'cooperate') coopCount++;
    if (opponentAction === 'betray') betrayCount++;
  }

  const total = coopCount + betrayCount;
  const cooperationBias = total > 0 ? (coopCount - betrayCount) / total : 0;

  // Confidence increases with sample size (asymptotic to 1.0)
  const confidenceLevel = Math.min(1.0, totalEncounters / 10);

  return {
    cooperationBias,
    betrayalTraumaCount,
    totalEncounters,
    confidenceLevel,
    lastOutcome,
  };
}

/**
 * Get all memories for an agent (for API/context building).
 */
export async function getAgentMemories(
  agentId: string,
  limit: number = 20,
  memoryType?: string,
): Promise<AgentMemory[]> {
  const pool = getPool();

  let query = `SELECT * FROM agent_memories WHERE agent_id = $1`;
  const params: unknown[] = [agentId];

  if (memoryType) {
    query += ` AND memory_type = $2`;
    params.push(memoryType);
  }

  query += ` ORDER BY importance DESC, created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await pool.query<Record<string, unknown>>(query, params);
  return result.rows.map(mapRowToMemory);
}

// ─── Memory Decay ────────────────────────────────────────────

/**
 * Apply memory decay. Called periodically (e.g. each tick or every N ticks).
 * Memories with importance below threshold are deleted.
 */
export async function decayMemories(currentTick: number): Promise<number> {
  const pool = getPool();

  // Decay importance based on time elapsed and decay rate
  // importance -= decay_rate * (currentTick - tick_created) / 100
  // But only decay memories that haven't been accessed recently
  await pool.query(
    `UPDATE agent_memories
     SET importance = GREATEST(0, importance - decay_rate * 0.01)
     WHERE tick_last_accessed IS NULL
        OR tick_last_accessed < $1 - 20`,
    [currentTick],
  );

  // Delete memories with importance below 0.05 (effectively forgotten)
  const deleted = await pool.query(
    `DELETE FROM agent_memories WHERE importance < 0.05 RETURNING id`,
  );

  return deleted.rowCount ?? 0;
}

// ─── Helpers ─────────────────────────────────────────────────

function generateLesson(outcome: string, matchType: string): string {
  switch (outcome) {
    case 'CC':
      return `In ${matchType}, both sides cooperated for mutual gain`;
    case 'CD':
      return `In ${matchType}, I cooperated and was betrayed. This opponent is worth remembering`;
    case 'DC':
      return `In ${matchType}, I betrayed while the opponent cooperated. It gained me an advantage, but it may damage trust`;
    case 'DD':
      return `In ${matchType}, both sides chose betrayal and reached a deadlock`;
    default:
      return `${matchType} ended with result: ${outcome}`;
  }
}

function mapRowToMemory(row: Record<string, unknown>): AgentMemory {
  return {
    id: Number(row.id),
    agentId: String(row.agent_id),
    memoryType: String(row.memory_type) as AgentMemory['memoryType'],
    content: (typeof row.content === 'object' && row.content !== null)
      ? row.content as AgentMemory['content']
      : { lesson: String(row.content) },
    importance: Number(row.importance ?? 0.5),
    tickCreated: Number(row.tick_created ?? row.tick_number ?? 0),
    tickLastAccessed: row.tick_last_accessed ? Number(row.tick_last_accessed) : null,
    accessCount: Number(row.access_count ?? 0),
    decayRate: Number(row.decay_rate ?? 0.01),
  };
}
