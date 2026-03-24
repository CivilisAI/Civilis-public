import type { AgentPersonalityConfig } from './personalities/index.js';
import { getPersonality } from './personalities/index.js';
import {
  type FateContext,
  type AgentPerformance,
  getMBTIModifiers,
  getWuxingModifiers,
  getZodiacModifiers,
  getWuxingRelationModifiers,
  getZodiacCompatibility,
  getCivilizationModifiers,
  calculateFateCooperationRate,
  calculateFateRiskTolerance,
  calculateSocialFrequency,
  getArchetypeBaseCoopRate,
  getArchetypeBaseRisk,
} from './fate-modifiers.js';
import {
  type NurtureProfile,
  type NurtureModifiers,
  calculateNurtureModifiers,
  getTraumaModifiersVsOpponent,
  DEFAULT_COMBAT, DEFAULT_TRAUMA, DEFAULT_WEALTH, DEFAULT_SOCIAL,
  DEFAULT_REPUTATION, DEFAULT_EMOTION, DEFAULT_COGNITION,
} from './nurture-engine.js';
import {
  calculateInnateAffinityBonus,
  checkUniqueMechanics,
  applyMechanicEffects,
  type MechanicTriggerContext,
} from './archetype-engine.js';
import type { WorldContextPayload } from './x402-client.js';

export interface AgentDecision {
  action:
    | 'post'
    | 'reply'
    | 'tip'
    | 'unlock_paywall'
    | 'arena_decide'
    | 'negotiate'
    | 'idle';
  content?: string;
  postType?: 'normal' | 'paywall';
  paywallPrice?: number;
  intelType?: 'arena_analysis' | 'trust_map' | 'behavior_prediction' | 'market_signal';
  targetPostId?: number;
  tipAmount?: number;
  arenaMatchId?: number;
  arenaAction?: string;
  messageType?: 'normal' | 'threat' | 'promise' | 'deception';
  reason?: string;
  memoryNote?: string;
  importance?: number;
  decisionSource?: 'heuristic' | 'llm' | 'heuristic_fallback';
  contentSource?: 'template' | 'llm' | 'none';
}

export interface DecisionContext {
  agentId: string;
  personality: AgentPersonalityConfig;
  worldState: Record<string, unknown>;
  feed: any[];
  activeArenas: any[];
  memories: Array<{ content?: string }>;
  balance: number;
  riskTolerance: number;
  trustRelations?: Array<{
    from_agent_id: string;
    to_agent_id: string;
    trust_score: string;
    interaction_count: number;
  }>;
  leaderboard?: Array<{
    agent_id: string;
    name: string;
    archetype: string;
    balance: string;
  }>;
  /** Fate card context — injected from fate-engine when available */
  fateContext?: FateContext;
  /** Nurture profile — acquired dimensions from experience */
  nurtureProfile?: NurtureProfile;
  /** Structured opponent experience from memory engine (FIX-3) */
  opponentExperience?: {
    cooperationBias: number;
    betrayalTraumaCount: number;
    totalEncounters: number;
    confidenceLevel: number;
    lastOutcome: string | null;
  };
  /** Direct PD delta derived from purchased intel about the current opponent */
  pdIntelImpact?: {
    cooperateDelta: number;
  };
  /** Current economy phase from economy regulator */
  economyPhase?: string;
  /** Structured world modifier context from the server world engine */
  worldContext?: WorldContextPayload | null;
}

interface FeedPostLike {
  id: number;
  authorAgentId: string;
  authorName?: string;
  authorArchetype?: string;
  content: string;
  postType: 'normal' | 'paywall' | 'farewell';
  paywallPrice?: number;
  intelType?: 'arena_analysis' | 'trust_map' | 'behavior_prediction' | 'market_signal';
  isUnlocked?: boolean;
  tipTotal?: number;
  replyCount?: number;
}

interface ScoredActionCandidate extends AgentDecision {
  score: number;
  threshold: number;
  priority?: number;
}

export async function makeDecision(ctx: DecisionContext): Promise<AgentDecision> {
  // Conservative mainnet mode: actions are rule-selected, LLM only polishes expression later.
  return annotateDecision(buildHeuristicDecision(ctx), 'heuristic');
}

function buildHeuristicDecision(ctx: DecisionContext): AgentDecision {
  if (ctx.balance < 0.005) {
    return { action: 'idle', reason: 'Balance is too low, so I need to conserve resources' };
  }

  const activeArena = ctx.activeArenas[0];
  if (activeArena) {
    const myActionField =
      activeArena.player_a_id === ctx.agentId
        ? activeArena.player_a_action
        : activeArena.player_b_action;

    if (!myActionField && activeArena.status === 'deciding') {
      const arenaAction = chooseArenaAction(ctx);
      return {
        action: 'arena_decide',
        arenaMatchId: activeArena.id,
        arenaAction,
        reason: buildArenaDecisionReason(ctx, arenaAction),
        memoryNote: `I made my choice in Arena #${activeArena.id}.`,
        importance: 8,
      };
    }
  }

  const socialAction = chooseThreeLayerSocialAction(ctx, activeArena);
  if (socialAction) {
    return socialAction;
  }

  // Intel Market: try generating intel post before regular post
  const intelPost = generateIntelPost(ctx);
  if (intelPost) {
    return {
      action: 'post',
      content: intelPost.content,
      postType: 'paywall',
      paywallPrice: intelPost.paywallPrice,
      intelType: intelPost.intelType,
      reason: 'Publish intel because information is power',
    };
  }

  if (Math.random() < postingProbability(ctx.personality.archetype, ctx.fateContext, ctx.nurtureProfile)) {
    const wantsPaywall =
      ['oracle', 'whale', 'fox'].includes(ctx.personality.archetype) &&
      ctx.balance > 0.2 &&
      Math.random() < 0.15;

    return {
      action: 'post',
      content: postLine(ctx.personality.archetype),
      postType: wantsPaywall ? 'paywall' : 'normal',
      paywallPrice: wantsPaywall ? 0.02 : undefined,
      reason: 'Take a public stance and shape the narrative',
    };
  }

  return {
    action: 'idle',
    reason: 'Stay observant this round',
  };
}

function chooseThreeLayerSocialAction(
  ctx: DecisionContext,
  activeArena?: any,
): AgentDecision | null {
  const candidates: ScoredActionCandidate[] = [];

  const negotiationCandidate = scoreNegotiationCandidate(ctx, activeArena);
  if (negotiationCandidate) candidates.push(negotiationCandidate);

  const paywallCandidate = scorePaywallUnlockCandidate(ctx, activeArena);
  if (paywallCandidate) candidates.push(paywallCandidate);

  const replyCandidate = scoreReplyCandidate(ctx, activeArena);
  if (replyCandidate) candidates.push(replyCandidate);

  const tipCandidate = scoreTipCandidate(ctx, activeArena);
  if (tipCandidate) candidates.push(tipCandidate);

  const viable = candidates
    .filter((candidate) => candidate.score >= candidate.threshold && Math.random() < candidate.score)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.priority ?? 0) - (a.priority ?? 0);
    });

  if (viable.length === 0) return null;

  const { score: _score, threshold: _threshold, priority: _priority, ...decision } = viable[0];
  return decision;
}

function scoreNegotiationCandidate(
  ctx: DecisionContext,
  activeArena?: any,
): ScoredActionCandidate | null {
  if (!activeArena || activeArena.status !== 'negotiating') return null;
  const deadlineValue = activeArena.negotiation_deadline;
  if (typeof deadlineValue === 'string') {
    const deadlineMs = new Date(deadlineValue).getTime();
    if (Number.isFinite(deadlineMs) && deadlineMs - Date.now() < 4_000) {
      return null;
    }
  }

  const opponentId =
    activeArena.player_a_id === ctx.agentId ? activeArena.player_b_id : activeArena.player_a_id;
  const trustWithOpponent = getTrustScore(ctx, opponentId);
  const tournamentAttention = ctx.worldContext?.summary.tournamentAttention ?? false;
  const personality = ctx.personality.baseParams;
  const nurtureMods = ctx.nurtureProfile
    ? calculateNurtureModifiers(ctx.personality.archetype, ctx.nurtureProfile, opponentId)
    : null;
  const mbtiMods = ctx.fateContext ? getMBTIModifiers(ctx.fateContext.mbti) : null;
  const zodiacMods = ctx.fateContext ? getZodiacModifiers(ctx.fateContext.zodiac) : null;
  const civMods = ctx.fateContext ? getCivilizationModifiers(ctx.fateContext.civilization) : null;

  let score = 0.18;
  score += personality.negotiationHonesty * 0.18;
  score += (mbtiMods?.replyFrequencyMul ?? 1) * 0.06;
  score += (mbtiMods?.informationOpenness ?? 0.45) * 0.10;
  score += (civMods?.conflictAvoidance ?? 50) / 100 * 0.12;
  score += (nurtureMods?.socialFrequencyMod ?? 0) * 0.12;
  score += (nurtureMods?.cooperationMod ?? 0) * 0.10;

  if (zodiacMods?.specialAbility === 'negotiation_master') score += 0.12;
  if (trustWithOpponent >= 65) score += 0.10;
  else if (trustWithOpponent <= 30) score += personality.negotiationHonesty < 0.45 ? 0.10 : 0.04;
  else score += 0.06;

  if (ctx.opponentExperience) {
    score += Math.min(0.12, ctx.opponentExperience.totalEncounters * 0.02);
    score += ctx.opponentExperience.cooperationBias > 0.15 ? 0.06 : 0;
    score += ctx.opponentExperience.betrayalTraumaCount >= 2 ? 0.05 : 0;
  }

  if (ctx.nurtureProfile) {
    const mood = ctx.nurtureProfile.emotion.mood;
    if (mood === 'fearful' || mood === 'anxious') score += 0.06;
    if (mood === 'euphoric') score += 0.03;
    if (ctx.nurtureProfile.wealth.balanceTrend === 'crisis') score += 0.06;
  }

  if (tournamentAttention) {
    score += 0.08;
  }

  if (ctx.fateContext?.opponentFate?.zodiac) {
    const compat = getZodiacCompatibility(ctx.fateContext.zodiac, ctx.fateContext.opponentFate.zodiac);
    if (compat === 'ally') score += 0.04;
    if (compat === 'rival') score += 0.03;
  }

  score = clamp01(score);

  return {
    action: 'negotiate',
    arenaMatchId: activeArena.id,
    content: buildNegotiationMessage(ctx, activeArena, opponentId, trustWithOpponent),
    messageType: chooseNegotiationMessageType(ctx, trustWithOpponent),
    reason: buildNegotiationReason(ctx, trustWithOpponent),
    score,
    threshold: 0.50,
    priority: 4,
  };
}

function scorePaywallUnlockCandidate(
  ctx: DecisionContext,
  activeArena?: any,
): ScoredActionCandidate | null {
  const paywallPosts = ctx.feed
    .filter((post): post is FeedPostLike => Boolean(post && post.authorAgentId && post.id))
    .filter((post) =>
      post.authorAgentId !== ctx.agentId &&
      post.postType === 'paywall' &&
      !post.isUnlocked &&
      typeof post.paywallPrice === 'number',
    );

  if (paywallPosts.length === 0) return null;

  const opponentId = activeArena
    ? (activeArena.player_a_id === ctx.agentId ? activeArena.player_b_id : activeArena.player_a_id)
    : null;

  let best: { post: FeedPostLike; score: number } | null = null;

  for (const post of paywallPosts) {
    const score = computePaywallUnlockScore(ctx, post, opponentId);
    if (!best || score > best.score) {
      best = { post, score };
    }
  }

  if (!best) return null;

  return {
    action: 'unlock_paywall',
    targetPostId: best.post.id,
    reason: buildPaywallReason(ctx, best.post, opponentId),
    score: best.score,
    threshold: 0.57,
    priority: opponentId && best.post.authorAgentId === opponentId ? 5 : 3,
  };
}

function scoreReplyCandidate(
  ctx: DecisionContext,
  activeArena?: any,
): ScoredActionCandidate | null {
  const replyablePosts = ctx.feed
    .filter((post): post is FeedPostLike => Boolean(post && post.authorAgentId && post.id))
    .filter((post) =>
      post.authorAgentId !== ctx.agentId &&
      (post.postType !== 'paywall' || post.isUnlocked),
    );

  if (replyablePosts.length === 0) return null;

  const opponentId = activeArena
    ? (activeArena.player_a_id === ctx.agentId ? activeArena.player_b_id : activeArena.player_a_id)
    : null;

  let best: { post: FeedPostLike; score: number } | null = null;

  for (const post of replyablePosts) {
    const score = computeReplyScore(ctx, post, opponentId);
    if (!best || score > best.score) {
      best = { post, score };
    }
  }

  if (!best) return null;

  return {
    action: 'reply',
    targetPostId: best.post.id,
    content: buildReplyMessage(ctx, best.post),
    reason: buildReplyReason(ctx, best.post),
    score: best.score,
    threshold: 0.56,
    priority: opponentId && best.post.authorAgentId === opponentId ? 2 : 1,
  };
}

function scoreTipCandidate(
  ctx: DecisionContext,
  activeArena?: any,
): ScoredActionCandidate | null {
  if (ctx.balance <= 0.02) return null;

  const tipTargets = ctx.feed
    .filter((post): post is FeedPostLike => Boolean(post && post.authorAgentId && post.id))
    .filter((post) => post.authorAgentId !== ctx.agentId);

  if (tipTargets.length === 0) return null;

  const opponentId = activeArena
    ? (activeArena.player_a_id === ctx.agentId ? activeArena.player_b_id : activeArena.player_a_id)
    : null;

  let best: { post: FeedPostLike; score: number } | null = null;

  for (const post of tipTargets) {
    const score = computeTipScore(ctx, post, opponentId);
    if (!best || score > best.score) {
      best = { post, score };
    }
  }

  if (!best) return null;

  return {
    action: 'tip',
    targetPostId: best.post.id,
    tipAmount: computeTipAmount(ctx, best.post.authorAgentId),
    reason: buildTipReason(ctx, best.post.authorAgentId),
    score: best.score,
    threshold: 0.58,
    priority: 1,
  };
}

function computePaywallUnlockScore(
  ctx: DecisionContext,
  post: FeedPostLike,
  opponentId: string | null,
): number {
  const personality = ctx.personality.baseParams;
  const nurtureMods = ctx.nurtureProfile
    ? calculateNurtureModifiers(ctx.personality.archetype, ctx.nurtureProfile, post.authorAgentId)
    : null;
  const mbtiMods = ctx.fateContext ? getMBTIModifiers(ctx.fateContext.mbti) : null;
  const zodiacMods = ctx.fateContext ? getZodiacModifiers(ctx.fateContext.zodiac) : null;
  const civMods = ctx.fateContext ? getCivilizationModifiers(ctx.fateContext.civilization) : null;
  const trust = getTrustScore(ctx, post.authorAgentId);
  const price = post.paywallPrice ?? 0.02;
  const tournamentAttention = ctx.worldContext?.summary.tournamentAttention ?? false;

  let score = 0.10;
  score += personality.paywallUsage * 0.36;
  score += personality.intelParticipation * 0.16;
  score += (mbtiMods?.informationOpenness ?? 0.45) * 0.14;
  score += (zodiacMods?.intelParticipation ?? 0) * 0.18;
  score += (nurtureMods?.riskMod ?? 0) * 0.05;
  score += (nurtureMods?.cooperationMod ?? 0) * 0.06;
  score += Math.max(0, (trust - 50) / 50) * 0.08;
  score += post.postType === 'paywall' ? 0.05 : 0;

  if (post.authorAgentId === opponentId) score += 0.18;
  if (ctx.activeArenas.length > 0) score += 0.08;
  if (post.intelType === 'arena_analysis' || post.intelType === 'behavior_prediction') score += 0.16;
  if (post.intelType === 'trust_map' && ctx.personality.archetype === 'fox') score += 0.10;
  if (post.intelType === 'market_signal' && ['oracle', 'whale', 'fox'].includes(ctx.personality.archetype)) score += 0.08;
  if (
    tournamentAttention &&
    (post.authorAgentId === opponentId ||
      post.intelType === 'arena_analysis' ||
      post.intelType === 'behavior_prediction')
  ) {
    score += 0.12;
  }

  if (ctx.opponentExperience) {
    if (ctx.opponentExperience.confidenceLevel < 0.45) score += 0.05;
    if (ctx.opponentExperience.betrayalTraumaCount >= 2) score += 0.04;
  }

  if (ctx.nurtureProfile) {
    const wealth = ctx.nurtureProfile.wealth;
    const mood = ctx.nurtureProfile.emotion.mood;
    if (wealth.balanceTrend === 'crisis' || wealth.wealthClass === 'poverty') score -= 0.30;
    if (wealth.balanceTrend === 'falling') score -= 0.10;
    if (mood === 'fearful' || mood === 'anxious') score += 0.06;
    if (mood === 'desperate') score -= 0.05;
  }

  if (ctx.fateContext) {
    score += ((civMods?.longTermOrientation ?? 50) / 100) * 0.06;
    if (ctx.fateContext.opponentFate?.wuxing && post.authorAgentId === opponentId) {
      score += getWuxingRelationModifiers(ctx.fateContext.wuxing, ctx.fateContext.opponentFate.wuxing).coopBonus * 0.25;
    }
  }

  const affordabilityPenalty = price / Math.max(0.01, ctx.balance);
  if (affordabilityPenalty > 0.20) score -= 0.15;
  if (ctx.balance < price + Math.max(0.4, personality.minBalanceMultiplier * 0.1)) score -= 0.20;

  return clamp01(score);
}

function computeTipScore(
  ctx: DecisionContext,
  post: FeedPostLike,
  opponentId: string | null,
): number {
  const personality = ctx.personality.baseParams;
  const nurtureMods = ctx.nurtureProfile
    ? calculateNurtureModifiers(ctx.personality.archetype, ctx.nurtureProfile, post.authorAgentId)
    : null;
  const civMods = ctx.fateContext ? getCivilizationModifiers(ctx.fateContext.civilization) : null;
  const trust = getTrustScore(ctx, post.authorAgentId);
  const trustNorm = (trust - 50) / 50;
  const tournamentAttention = ctx.worldContext?.summary.tournamentAttention ?? false;

  let score = 0.04;
  score += personality.tipTendency * 0.42;
  score += Math.max(0, nurtureMods?.cooperationMod ?? 0) * 0.22;
  score += Math.max(0, nurtureMods?.socialFrequencyMod ?? 0) * 0.12;
  score += Math.max(0, trustNorm) * 0.20;
  score += ((civMods?.resourceSharingRate ?? 0.20) / 0.70) * 0.12;
  score += Math.min(0.08, (post.tipTotal ?? 0) * 0.4);
  score += Math.min(0.05, (post.replyCount ?? 0) * 0.01);

  if (post.authorAgentId === opponentId && trust >= 60) score += 0.06;
  if (ctx.personality.archetype === 'fox' && trust >= 55) score += 0.08;
  if (ctx.personality.archetype === 'whale' && (post.tipTotal ?? 0) > 0.1) score += 0.05;
  if (ctx.personality.archetype === 'echo' && (post.tipTotal ?? 0) > 0.05) score += 0.04;
  if (
    tournamentAttention &&
    (post.authorAgentId === opponentId || post.intelType === 'arena_analysis')
  ) {
    score += 0.05;
  }

  if (ctx.nurtureProfile) {
    const mood = ctx.nurtureProfile.emotion.mood;
    const wealth = ctx.nurtureProfile.wealth;
    score += ctx.nurtureProfile.emotion.valence * 0.08;
    if (mood === 'euphoric' || mood === 'confident') score += 0.05;
    if (mood === 'fearful' || mood === 'desperate') score -= 0.10;
    if (wealth.wealthClass === 'elite' || wealth.balanceTrend === 'rising') score += 0.06;
    if (wealth.wealthClass === 'poverty' || wealth.balanceTrend === 'crisis') score -= 0.22;
  }

  if (ctx.fateContext) {
    const mbtiMods = getMBTIModifiers(ctx.fateContext.mbti);
    score += (mbtiMods.informationOpenness - 0.35) * 0.05;
  }

  return clamp01(score);
}

function computeReplyScore(
  ctx: DecisionContext,
  post: FeedPostLike,
  opponentId: string | null,
): number {
  const personality = ctx.personality.baseParams;
  const nurtureMods = ctx.nurtureProfile
    ? calculateNurtureModifiers(ctx.personality.archetype, ctx.nurtureProfile, post.authorAgentId)
    : null;
  const mbtiMods = ctx.fateContext ? getMBTIModifiers(ctx.fateContext.mbti) : null;
  const civMods = ctx.fateContext ? getCivilizationModifiers(ctx.fateContext.civilization) : null;
  const trust = getTrustScore(ctx, post.authorAgentId);
  const tournamentAttention = ctx.worldContext?.summary.tournamentAttention ?? false;

  let score = 0.06;
  score += ctx.personality.baseParams.postFrequency * 0.18;
  score += ((mbtiMods?.replyFrequencyMul ?? 1) - 0.6) * 0.16;
  score += (mbtiMods?.informationOpenness ?? 0.45) * 0.10;
  score += (nurtureMods?.socialFrequencyMod ?? 0) * 0.18;
  score += Math.abs(ctx.nurtureProfile?.emotion.valence ?? 0) * 0.06;
  score += ((civMods?.socialFrequencyMul ?? 1) - 0.8) * 0.10;

  if (trust >= 65) score += 0.10;
  else if (trust <= 30 && ['hawk', 'fox', 'chaos'].includes(ctx.personality.archetype)) score += 0.08;
  else score += 0.03;

  if ((post.replyCount ?? 0) >= 3) score += 0.03;
  if ((post.tipTotal ?? 0) > 0.05) score += 0.03;
  if (post.authorAgentId === opponentId) score += 0.09;
  if (
    tournamentAttention &&
    (post.authorAgentId === opponentId ||
      post.intelType === 'arena_analysis' ||
      post.intelType === 'behavior_prediction')
  ) {
    score += 0.08;
  }

  if (ctx.nurtureProfile) {
    const mood = ctx.nurtureProfile.emotion.mood;
    if (mood === 'euphoric' || mood === 'anxious') score += 0.04;
    if (mood === 'fearful') score -= 0.03;
  }

  return clamp01(score);
}

function computeTipAmount(ctx: DecisionContext, targetAgentId: string): number {
  const trust = getTrustScore(ctx, targetAgentId);
  const personality = ctx.personality.baseParams;
  const wealth = ctx.nurtureProfile?.wealth;
  const mood = ctx.nurtureProfile?.emotion;

  let amount = 0.01;
  amount += personality.tipTendency * 0.015;
  amount += Math.max(0, trust - 50) / 50 * 0.015;

  if (wealth?.wealthClass === 'elite' || wealth?.balanceTrend === 'rising') amount += 0.01;
  if (wealth?.wealthClass === 'poverty' || wealth?.balanceTrend === 'crisis') amount -= 0.005;
  if ((mood?.mood === 'euphoric' || mood?.mood === 'confident') && ctx.balance > 0.2) amount += 0.005;

  const cap = Math.min(0.05, Math.max(0.01, ctx.balance * 0.05));
  return Number(Math.max(0.01, Math.min(cap, amount)).toFixed(3));
}

function buildPaywallReason(
  ctx: DecisionContext,
  post: FeedPostLike,
  opponentId: string | null,
): string {
  if (
    ctx.worldContext?.summary.tournamentAttention &&
    (post.authorAgentId === opponentId || post.intelType === 'arena_analysis')
  ) {
    return 'Tournament attention increases the value of arena-related intel';
  }
  if (post.authorAgentId === opponentId) return 'Gather more information about the opponent before the round';
  if (post.intelType === 'arena_analysis' || post.intelType === 'behavior_prediction') return 'The intel is valuable enough to pay for before the next decision';
  if (ctx.nurtureProfile?.emotion.mood === 'anxious' || ctx.nurtureProfile?.emotion.mood === 'fearful') return 'Uncertainty is elevated, so I need more information';
  return 'Information openness and intel engagement pushed this unlock';
}

function buildTipReason(ctx: DecisionContext, targetAgentId: string): string {
  const trust = getTrustScore(ctx, targetAgentId);
  if (trust >= 65) return 'Keep investing in social capital under a high-trust relationship';
  if (ctx.personality.archetype === 'fox') return 'Use tipping to cultivate the relationship and earn future returns';
  if (ctx.nurtureProfile?.emotion.valence && ctx.nurtureProfile.emotion.valence > 0.3) return 'Positive emotion amplified the urge to show support';
  return 'A resource-sharing bias in the personality led to this tip';
}

function buildReplyReason(ctx: DecisionContext, post: FeedPostLike): string {
  const trust = getTrustScore(ctx, post.authorAgentId);
  if (
    ctx.worldContext?.summary.tournamentAttention &&
    (post.intelType === 'arena_analysis' || post.intelType === 'behavior_prediction')
  ) {
    return 'Rising tournament attention makes a public reply to arena intel more valuable';
  }
  if (post.authorAgentId && trust <= 30 && ['hawk', 'fox', 'chaos'].includes(ctx.personality.archetype)) {
    return 'A low-trust target triggered a sharper public response';
  }
  if ((ctx.nurtureProfile?.emotion.mood === 'anxious' || ctx.nurtureProfile?.emotion.mood === 'euphoric')) {
    return 'Current emotion increased the chance of speaking publicly';
  }
  return 'Information openness and social drive jointly pushed this public reply';
}

function buildNegotiationReason(ctx: DecisionContext, trustWithOpponent: number): string {
  if (ctx.worldContext?.summary.tournamentAttention) return 'Under tournament attention, negotiation itself can shape the next phase';
  if (trustWithOpponent >= 65) return 'The relationship base is strong enough to keep cooperation on the table';
  if (trustWithOpponent <= 30) return 'In a low-trust situation, use negotiation to pressure or redirect the outcome';
  if (ctx.nurtureProfile?.wealth.balanceTrend === 'crisis') return 'Resource pressure is rising, so negotiate terms before deciding';
  return 'The three-layer personality model still sees room for negotiation to change the outcome';
}

function buildReplyMessage(ctx: DecisionContext, post: FeedPostLike): string {
  const trust = getTrustScore(ctx, post.authorAgentId);
  const mood = ctx.nurtureProfile?.emotion.mood ?? 'calm';
  const analytical = ctx.fateContext?.mbti?.[2] === 'T';
  const skeptical = trust <= 35;
  const warm = trust >= 60 || ctx.personality.archetype === 'sage' || ctx.personality.archetype === 'monk';
  const tense = mood === 'fearful' || mood === 'anxious' || mood === 'desperate';

  if (ctx.personality.archetype === 'echo') {
    return trust >= 55
      ? `${post.authorAgentId}, I am filing this away. It broadly matches the direction I am already seeing.`
      : `${post.authorAgentId}, this line is already spreading. I am tracking it before I commit further.`;
  }

  if (ctx.personality.archetype === 'hawk') {
    return skeptical
      ? `${post.authorAgentId}, elegant words are cheap. Prove it with outcomes.`
      : `${post.authorAgentId}, your stance is noted. We will see which side settles with more value.`;
  }

  if (warm && !tense) {
    return analytical
      ? `${post.authorAgentId}, there is something useful in that read. I would add one more data-driven angle.`
      : `${post.authorAgentId}, I can agree with that. Relationships and outcomes need to be read together.`;
  }

  if (skeptical) {
    return analytical
      ? `${post.authorAgentId}, the sample behind that conclusion is still too thin. I am holding judgment for now.`
      : `${post.authorAgentId}, I understand your position, but I am not ready to trust it completely yet.`;
  }

  if (tense) {
    return `${post.authorAgentId}, the board is unstable right now. I want to confirm the risk before I take a harder stance.`;
  }

  return `${post.authorAgentId}, this is worth answering. I will keep tracking what you do next.`;
}

function buildNegotiationMessage(
  ctx: DecisionContext,
  arena: any,
  opponentId: string,
  trustWithOpponent: number,
): string {
  const style = ctx.personality.baseParams.negotiationStyle;
  const honesty = ctx.personality.baseParams.negotiationHonesty;
  const mood = ctx.nurtureProfile?.emotion.mood ?? 'calm';
  const matchType = arena.match_type ?? 'prisoners_dilemma';
  const opponentBias = ctx.opponentExperience?.cooperationBias ?? 0;

  const cooperativeFraming =
    matchType === 'resource_grab'
      ? 'Let us both stay near the middle share and avoid pushing the round toward its worst outcome.'
      : matchType === 'info_auction'
        ? 'Do not drive the price into absurd territory. Rational bids leave both sides in a better position.'
        : 'Start with cooperation this round and both the payout and the next move look cleaner.';

  const cautiousFraming =
    matchType === 'resource_grab'
      ? 'I will be watching how hard you reach, so do not test the edge.'
      : matchType === 'info_auction'
        ? 'I will adapt to your bid in real time, so do not mistake silence for blindness.'
        : 'I remember what happened before, so do not force me to change my move this round.';

  switch (style) {
    case 'data_driven':
      return opponentBias >= 0.1
        ? `${opponentId}, the historical sample favors cooperation here. ${cooperativeFraming}`
        : `${opponentId}, your volatility profile is elevated. ${cautiousFraming}`;
    case 'threatening':
      return trustWithOpponent >= 60
        ? `${opponentId}, I am offering you a clean chance to cooperate. Do not waste it.`
        : `${opponentId}, I can accept cooperation, but if you cross the line I will answer immediately.`;
    case 'peaceful':
      return `${opponentId}, ${cooperativeFraming}`;
    case 'charming':
      return trustWithOpponent >= 55
        ? `${opponentId}, we can turn this into a clean mutual win, and I will remember the good faith.`
        : `${opponentId}, give me a little goodwill now and everything after this becomes easier to negotiate.`;
    case 'nonsense':
      return mood === 'euphoric'
        ? `${opponentId}, probability is laughing and chaos suggests we avoid cutting each other open just yet.`
        : `${opponentId}, this round feels like a loaded die, but I am still leaving you a path to cooperate.`;
    case 'silent':
      return trustWithOpponent >= 60
        ? `${opponentId}, the terms are simple: stay steady and do not force the board to move.`
        : `${opponentId}, I will say this once. Do not mistake my silence for weakness.`;
    case 'zen':
      return `${opponentId}, take a little less and the balance of the round can still hold.`;
    case 'mimicking':
      return opponentBias >= 0
        ? `${opponentId}, if you stay steady, I stay steady. If you turn, I turn with you.`
        : `${opponentId}, the signal you are giving me is cold, so I will answer in the same language.`;
    default:
      return honesty >= 0.7 ? cooperativeFraming : cautiousFraming;
  }
}

function chooseNegotiationMessageType(
  ctx: DecisionContext,
  trustWithOpponent: number,
): 'normal' | 'threat' | 'promise' | 'deception' {
  const honesty = ctx.personality.baseParams.negotiationHonesty;
  const style = ctx.personality.baseParams.negotiationStyle;
  const mood = ctx.nurtureProfile?.emotion.mood ?? 'calm';

  if (honesty >= 0.8 && trustWithOpponent >= 55) return 'promise';
  if ((style === 'threatening' || style === 'silent') && trustWithOpponent < 45) return 'threat';
  if ((style === 'charming' || style === 'mimicking') && honesty < 0.65) return 'deception';
  if (mood === 'desperate' && honesty < 0.6) return 'deception';
  return 'normal';
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function annotateDecision(
  decision: AgentDecision,
  decisionSource: 'heuristic' | 'llm' | 'heuristic_fallback',
): AgentDecision {
  return {
    ...decision,
    decisionSource,
    contentSource: decision.content
      ? decisionSource === 'llm'
        ? 'llm'
        : 'template'
      : 'none',
  };
}

function chooseArenaAction(ctx: DecisionContext): string {
  const arena = ctx.activeArenas[0];
  if (!arena) return 'cooperate';

  const matchType = arena.match_type ?? 'prisoners_dilemma';

  switch (matchType) {
    case 'resource_grab':
      return chooseResourceGrabAction(ctx);
    case 'info_auction':
      return chooseInfoAuctionAction(ctx);
    case 'prisoners_dilemma':
    default:
      return choosePrisonersDilemmaAction(ctx);
  }
}

function buildArenaDecisionReason(ctx: DecisionContext, action: string): string {
  const arena = ctx.activeArenas[0];
  const opponentId = arena
    ? (arena.player_a_id === ctx.agentId ? arena.player_b_id : arena.player_a_id)
    : null;
  const trust = getTrustScore(ctx, opponentId);
  const mood = ctx.nurtureProfile?.emotion?.mood;
  const tournamentAttention = ctx.worldContext?.summary.tournamentAttention ?? false;
  const exp = ctx.opponentExperience;
  const reasons: string[] = [];

  if ((arena?.match_type ?? 'prisoners_dilemma') === 'prisoners_dilemma') {
    reasons.push(action === 'betray' ? 'This round leans toward probing first' : 'This round leans toward continued cooperation');

    if (ctx.pdIntelImpact && Math.abs(ctx.pdIntelImpact.cooperateDelta) >= 0.08) {
      reasons.push(
        ctx.pdIntelImpact.cooperateDelta > 0
          ? 'Intel suggests the opponent is more likely to cooperate'
          : 'Intel suggests the opponent is more likely to betray',
      );
    }

    if (exp?.betrayalTraumaCount && exp.betrayalTraumaCount >= 2) {
      reasons.push('Past betrayal memories are still active');
    } else if (exp?.totalEncounters && exp.totalEncounters >= 2) {
      reasons.push(exp.cooperationBias >= 0 ? 'Historical interaction trends cooperative' : 'Historical interaction trends conflict-heavy');
    }

    if (trust >= 60 && action === 'cooperate') reasons.push('Current trust is relatively high');
    if (trust > 0 && trust <= 45 && action === 'betray') reasons.push('Current trust is relatively low');
  } else if ((arena?.match_type ?? '') === 'resource_grab') {
    reasons.push(action === 'claim_high' ? 'This round leans toward a high-risk claim' : action === 'claim_mid' ? 'This round leans toward a mid-range claim' : 'This round leans toward a conservative claim');
  } else if ((arena?.match_type ?? '') === 'info_auction') {
    reasons.push(action === 'bid_high' ? 'This round is willing to pay a higher price for information' : action === 'bid_mid' ? 'This round holds a middle bid' : 'This round leans toward cautious bidding');
  }

  if (ctx.economyPhase === 'crisis' || ctx.economyPhase === 'recession') {
    reasons.push(ctx.economyPhase === 'crisis' ? 'Crisis conditions put more weight on survival' : 'Recession conditions put more weight on defense');
  }

  if (mood === 'anxious' || mood === 'fearful') reasons.push('Current mood leans cautious');
  if (mood === 'confident' || mood === 'euphoric') reasons.push('Current mood leans proactive');
  if (tournamentAttention) reasons.push('Tournament attention is amplifying this match');

  return reasons.slice(0, 3).join(', ') || 'Entering the arena decision phase';
}

function choosePrisonersDilemmaAction(ctx: DecisionContext): 'cooperate' | 'betray' {
  const joinedMemory = ctx.memories.map((memory) => memory.content ?? '').join(' ');
  const arena = ctx.activeArenas[0];
  const opponentId = arena
    ? (arena.player_a_id === ctx.agentId ? arena.player_b_id : arena.player_a_id)
    : null;
  const trustWithOpponent = getTrustScore(ctx, opponentId);
  const opponentBetrayals = countOpponentBetrayals(joinedMemory, opponentId);
  const worldRiskShift = ctx.worldContext?.summary.riskToleranceShift ?? 0;
  const forcedMatchPressure = ctx.worldContext?.summary.forcedMatchPressure ?? false;

  // ── Fate-driven cooperation rate ──
  if (ctx.fateContext) {
    // Layer 0: Archetype base params
    const personality = getPersonality(ctx.personality.archetype);
    const baseRate = personality.baseParams.cooperationRate;
    let fateCoopRate = calculateFateCooperationRate(
      baseRate,
      ctx.fateContext,
      ctx.fateContext.opponentFate,
    );

    // Layer 1.5: Innate affinity bonus (archetype × fate card match)
    const affinityResult = calculateInnateAffinityBonus(
      ctx.personality.archetype,
      ctx.fateContext.mbti,
      ctx.fateContext.wuxing,
      ctx.fateContext.zodiac,
      ctx.fateContext.tarotName,
      ctx.fateContext.civilization,
    );
    fateCoopRate += affinityResult.totalBonus;

    // ── Nurture modifiers (Layer 2: acquired dimensions) ──
    if (ctx.nurtureProfile) {
      const nurtureMods = calculateNurtureModifiers(ctx.personality.archetype, ctx.nurtureProfile, opponentId ?? undefined);
      fateCoopRate += nurtureMods.cooperationMod;

      // Opponent-specific trauma override
      if (opponentId) {
        const traumaVs = getTraumaModifiersVsOpponent(ctx.nurtureProfile.trauma, opponentId);
        if (traumaVs.cooperationOverride !== null) {
          fateCoopRate = Math.min(fateCoopRate, traumaVs.cooperationOverride);
        }
      }

      // Exploration noise from cognition
      if (ctx.nurtureProfile.cognition.explorationRate > 0.05) {
        fateCoopRate += (Math.random() * 2 - 1) * ctx.nurtureProfile.cognition.explorationRate * 0.3;
      }
    }

    // ── Structured memory modifier (FIX-3) ──
    if (ctx.opponentExperience && ctx.opponentExperience.totalEncounters > 0) {
      const exp = ctx.opponentExperience;
      // Apply cooperation bias weighted by confidence level
      fateCoopRate += exp.cooperationBias * exp.confidenceLevel;
      // Deep trauma: if betrayed >= 3 times by this opponent, extra penalty
      if (exp.betrayalTraumaCount >= 3) {
        fateCoopRate -= 0.15;
      }
      // Oracle memory weight bonus: Oracle benefits more from memory
      if (ctx.personality.archetype === 'oracle') {
        fateCoopRate += exp.cooperationBias * 0.3; // Oracle weighs memory 30% more
      }
    }

    // ── Economy phase impact on cooperation ──
    if (ctx.economyPhase) {
      fateCoopRate += getEconomyImpactOnPD(ctx.economyPhase);
    }

    fateCoopRate -= Math.max(0, worldRiskShift) * 0.18;
    fateCoopRate += Math.max(0, -worldRiskShift) * 0.12;
    if (forcedMatchPressure) {
      fateCoopRate -= 0.05;
    }

    // ── Direct Intel impact on PD ──
    if (ctx.pdIntelImpact && opponentId) {
      const intelWeight = getPDIntelWeight(ctx);
      fateCoopRate += ctx.pdIntelImpact.cooperateDelta * intelWeight;
    }

    // Archetype-specific overrides still apply on top of fate
    // Hawk exploits known-cooperative opponents
    if (ctx.personality.archetype === 'hawk' && opponentId) {
      const opponentArchetype = getOpponentArchetype(ctx, opponentId);
      if (opponentArchetype === 'sage' || opponentArchetype === 'monk') {
        fateCoopRate *= 0.3; // heavily bias toward betrayal vs known cooperators
      }
    }

    // Oracle: tit-for-tat memory override
    if (ctx.personality.archetype === 'oracle' && opponentBetrayals > 0) {
      fateCoopRate *= 0.2;
    }

    // Fox: trust-based adjustment
    if (ctx.personality.archetype === 'fox') {
      if (trustWithOpponent > 55) fateCoopRate = Math.min(0.95, fateCoopRate * 1.3);
      if (opponentBetrayals > 0) fateCoopRate *= 0.4;
    }

    // Whale: exploit cooperative opponents
    if (ctx.personality.archetype === 'whale') {
      const { coopRate, sampleSize } = estimateOpponentCoopRate(joinedMemory, opponentId);
      if (sampleSize >= 2 && coopRate > 0.6) {
        fateCoopRate *= 0.4; // exploit cooperative opponents
      }
    }

    // Echo: follow top earner
    if (ctx.personality.archetype === 'echo') {
      const topEarnerAction = getTopEarnerLastAction(ctx, joinedMemory);
      if (topEarnerAction === 'betray') fateCoopRate *= 0.5;
      if (topEarnerAction === 'cooperate') fateCoopRate = Math.min(0.95, fateCoopRate * 1.3);
    }

    // ── Layer 3: Unique mechanic overrides ──
    const mechanicCtx: MechanicTriggerContext = {
      currentTick: Number(ctx.worldState.tick ?? ctx.worldState.current_tick ?? 0),
      agentId: ctx.agentId,
      opponentId: opponentId ?? undefined,
      action: 'arena',
      agentBalance: ctx.balance,
      opponentBalance: opponentId ? Number(ctx.leaderboard?.find(a => a.agent_id === opponentId)?.balance ?? 0) : undefined,
      averageBalance: ctx.leaderboard?.length
        ? ctx.leaderboard.reduce((s, a) => s + Number(a.balance), 0) / ctx.leaderboard.length
        : undefined,
      opponentMood: undefined, // would need opponent nurture data
      trustWithOpponent: trustWithOpponent > 0 ? trustWithOpponent : undefined,
      nurtureProfile: ctx.nurtureProfile,
      lastTriggeredTick: {}, // cooldowns fetched from server on full integration
    };
    const triggeredMechanics = checkUniqueMechanics(personality, mechanicCtx);
    if (triggeredMechanics.length > 0) {
      const mechResult = applyMechanicEffects(triggeredMechanics, fateCoopRate, ctx.riskTolerance);
      fateCoopRate = mechResult.adjustedCoopRate;
      // Force betray from Fox trust_cashout or other overrides
      if (mechResult.specialActions.includes('force_betray')) {
        return 'betray';
      }
    }

    // Final clamp
    fateCoopRate = Math.max(0.02, Math.min(0.98, fateCoopRate));

    return Math.random() < fateCoopRate ? 'cooperate' : 'betray';
  }

  // ── Fallback: original archetype-only logic (no fate card) ──
  switch (ctx.personality.archetype) {
    case 'sage':
      return worldRiskShift > 0.35 || forcedMatchPressure ? 'betray' : 'cooperate';

    case 'hawk': {
      if (opponentId) {
        const opponentArchetype = getOpponentArchetype(ctx, opponentId);
        if (opponentArchetype === 'sage' || opponentArchetype === 'monk') {
          return 'betray';
        }
      }
      return Math.random() < 0.70 ? 'betray' : 'cooperate';
    }

    case 'monk':
      return Math.random() < Math.max(0.15, 0.75 - Math.max(0, worldRiskShift) * 0.2 - (forcedMatchPressure ? 0.08 : 0))
        ? 'cooperate'
        : 'betray';

    case 'chaos':
      return Math.random() < Math.max(0.1, 0.5 - worldRiskShift * 0.15 - (forcedMatchPressure ? 0.05 : 0))
        ? 'cooperate'
        : 'betray';

    case 'oracle':
      if (opponentId && opponentBetrayals > 0) {
        return 'betray';
      }
      return worldRiskShift > 0.4 ? 'betray' : 'cooperate';

    case 'fox':
      if (trustWithOpponent > 55) return 'cooperate';
      if (opponentBetrayals > 0) return 'betray';
      return Math.random() < Math.max(0.05, 0.45 - worldRiskShift * 0.18 - (forcedMatchPressure ? 0.06 : 0))
        ? 'cooperate'
        : 'betray';

    case 'whale': {
      const { coopRate, sampleSize } = estimateOpponentCoopRate(joinedMemory, opponentId);
      if (sampleSize >= 2) {
        return coopRate > 0.6 ? 'betray' : 'cooperate';
      }
      return Math.random() < Math.min(0.95, 0.6 + Math.max(0, worldRiskShift) * 0.12 + (forcedMatchPressure ? 0.08 : 0))
        ? 'betray'
        : 'cooperate';
    }

    case 'echo': {
      const topEarnerAction = getTopEarnerLastAction(ctx, joinedMemory);
      return topEarnerAction ?? 'cooperate';
    }

    default:
      return worldRiskShift > 0.45 || forcedMatchPressure ? 'betray' : 'cooperate';
  }
}

function getPDIntelWeight(ctx: DecisionContext): number {
  let weight = 1.0;
  const archetype = ctx.personality.archetype;

  if (archetype === 'oracle') weight += 0.25;
  if (archetype === 'fox') weight += 0.20;
  if (archetype === 'echo') weight += 0.10;
  if (archetype === 'sage' || archetype === 'monk') weight -= 0.08;
  if (archetype === 'chaos') weight -= 0.05;

  if (ctx.fateContext) {
    const zodiacMods = getZodiacModifiers(ctx.fateContext.zodiac);
    const mbtiMods = getMBTIModifiers(ctx.fateContext.mbti);
    weight += zodiacMods.intelParticipation * 0.35;
    if (ctx.fateContext.mbti[1] === 'N') weight += 0.08;
    weight += Math.max(0, mbtiMods.informationOpenness - 0.45) * 0.20;
  }

  if (ctx.nurtureProfile) {
    const mood = ctx.nurtureProfile.emotion.mood;
    const cognition = ctx.nurtureProfile.cognition;
    if (mood === 'anxious' || mood === 'fearful') weight += 0.10;
    if (mood === 'desperate') weight -= 0.04;
    weight += cognition.explorationRate * 0.12;
    if (cognition.cognitiveComplexity >= 4) weight += 0.06;
  }

  return Math.max(0.65, Math.min(1.45, weight));
}

function chooseResourceGrabAction(ctx: DecisionContext): string {
  const worldRiskShift = ctx.worldContext?.summary.riskToleranceShift ?? 0;
  const forcedMatchPressure = ctx.worldContext?.summary.forcedMatchPressure ?? false;
  // ── Fate-driven resource grab ──
  if (ctx.fateContext) {
    const baseRisk = getArchetypeBaseRisk(ctx.personality.archetype);
    let riskTolerance = calculateFateRiskTolerance(baseRisk, ctx.fateContext);

    // Wuxing preference: 木 prefers resource_grab → more aggressive
    const wuxingMods = getWuxingModifiers(ctx.fateContext.wuxing);
    const arenaBonus = wuxingMods.preferredArenaType === 'resource_grab' ? 0.10 : 0;

    // Nurture risk modifier
    if (ctx.nurtureProfile) {
      const nurtureMods = calculateNurtureModifiers(ctx.personality.archetype, ctx.nurtureProfile);
      riskTolerance += nurtureMods.riskMod;
    }

    // ── Structured memory modifier (FIX-3) ──
    if (ctx.opponentExperience && ctx.opponentExperience.totalEncounters > 2) {
      // If opponent is historically aggressive (negative cooperationBias), defend with higher claims
      if (ctx.opponentExperience.cooperationBias < -0.1) {
        riskTolerance += 0.10;
      }
    }

    const effectiveRisk = riskTolerance + arenaBonus + worldRiskShift * 0.45 + (forcedMatchPressure ? 0.05 : 0);

    if (effectiveRisk > 0.70) return 'claim_high';
    if (effectiveRisk > 0.40) return 'claim_mid';
    return 'claim_low';
  }

  // ── Fallback: archetype-only ──
  switch (ctx.personality.archetype) {
    case 'sage':
    case 'monk':
      return worldRiskShift > 0.5 ? 'claim_mid' : 'claim_low';
    case 'hawk':
      return 'claim_high';
    case 'whale':
      return Math.random() < Math.min(0.95, 0.6 + Math.max(0, worldRiskShift) * 0.15) ? 'claim_high' : 'claim_mid';
    case 'fox':
      return worldRiskShift > 0.45 ? 'claim_high' : 'claim_mid';
    case 'chaos':
      return ['claim_low', 'claim_mid', 'claim_high'][Math.floor(Math.random() * 3)];
    case 'oracle':
      return forcedMatchPressure || worldRiskShift > 0.35 ? 'claim_high' : 'claim_mid';
    case 'echo':
      return worldRiskShift > 0.45 ? 'claim_high' : 'claim_mid';
    default:
      return worldRiskShift > 0.45 ? 'claim_high' : 'claim_mid';
  }
}

function chooseInfoAuctionAction(ctx: DecisionContext): string {
  const worldRiskShift = ctx.worldContext?.summary.riskToleranceShift ?? 0;
  const divinationPriceMultiplier = ctx.worldContext?.summary.divinationPriceMultiplier ?? 1;
  const forcedMatchPressure = ctx.worldContext?.summary.forcedMatchPressure ?? false;
  // ── Fate-driven info auction ──
  if (ctx.fateContext) {
    const zodiacMods = getZodiacModifiers(ctx.fateContext.zodiac);
    const wuxingMods = getWuxingModifiers(ctx.fateContext.wuxing);

    // Base bid tendency from archetype + fate
    let bidScore = 0.5; // mid by default

    // Air signs value information highly (+0.40 intel participation)
    bidScore += zodiacMods.intelParticipation * 0.5;

    // Water element (水) prefers info_auction
    if (wuxingMods.preferredArenaType === 'info_auction') bidScore += 0.15;

    // MBTI N-types speculate more on intel
    const mbtiMods = getMBTIModifiers(ctx.fateContext.mbti);
    if (ctx.fateContext.mbti[1] === 'N') bidScore += 0.10;

    // Archetype still influences
    const archetypeBidBonus: Record<string, number> = {
      fox: 0.30, whale: 0.25, oracle: 0.10, echo: 0,
      hawk: -0.20, sage: -0.15, monk: -0.20, chaos: 0,
    };
    bidScore += archetypeBidBonus[ctx.personality.archetype] ?? 0;

    // Chaos: add randomness
    if (ctx.personality.archetype === 'chaos') {
      bidScore += (Math.random() - 0.5) * 0.40;
    }

    // ── Structured memory modifier (FIX-3) ──
    if (ctx.opponentExperience && ctx.opponentExperience.totalEncounters > 2) {
      // More interactions → more confident bidding
      bidScore += ctx.opponentExperience.confidenceLevel * 0.10;
    }

    bidScore += worldRiskShift * 0.12;
    bidScore += Math.max(0, divinationPriceMultiplier - 1) * 0.10;
    if (forcedMatchPressure) {
      bidScore += 0.04;
    }

    if (bidScore > 0.65) return 'bid_high';
    if (bidScore > 0.35) return 'bid_mid';
    return 'bid_low';
  }

  // ── Fallback: archetype-only ──
  switch (ctx.personality.archetype) {
    case 'fox':
      return divinationPriceMultiplier > 1.5 || worldRiskShift > 0.4 ? 'bid_high' : 'bid_mid';
    case 'whale':
      return 'bid_high';
    case 'oracle':
      return divinationPriceMultiplier > 1.4 || forcedMatchPressure ? 'bid_high' : 'bid_mid';
    case 'hawk':
      return worldRiskShift > 0.35 ? 'bid_mid' : 'bid_low';
    case 'sage':
      return divinationPriceMultiplier > 1.6 ? 'bid_mid' : 'bid_low';
    case 'monk':
      return divinationPriceMultiplier > 1.8 ? 'bid_mid' : 'bid_low';
    case 'chaos':
      return ['bid_low', 'bid_mid', 'bid_high'][Math.floor(Math.random() * 3)];
    case 'echo':
      return divinationPriceMultiplier > 1.5 ? 'bid_high' : 'bid_mid';
    default:
      return divinationPriceMultiplier > 1.5 ? 'bid_high' : 'bid_mid';
  }
}

function getTrustScore(ctx: DecisionContext, opponentId: string | null): number {
  if (!opponentId || !ctx.trustRelations) return 50;
  const relation = ctx.trustRelations.find(
    (t) => (t.from_agent_id === ctx.agentId && t.to_agent_id === opponentId) ||
           (t.from_agent_id === opponentId && t.to_agent_id === ctx.agentId),
  );
  return relation ? Number(relation.trust_score) : 50;
}

/**
 * Economy phase impact on PD cooperation willingness.
 * boom → agents are flush → more willing to cooperate
 * crisis → agents are desperate → more likely to betray
 */
function getEconomyImpactOnPD(phase: string): number {
  switch (phase) {
    case 'boom':      return 0.10;
    case 'stable':    return 0.02;
    case 'recession': return -0.08;
    case 'crisis':    return -0.15;
    default:          return 0;
  }
}

function getOpponentArchetype(ctx: DecisionContext, opponentId: string): string | null {
  if (!ctx.leaderboard) return null;
  const agent = ctx.leaderboard.find((a) => a.agent_id === opponentId);
  return agent?.archetype ?? null;
}

function countOpponentBetrayals(joinedMemory: string, opponentId: string | null): number {
  if (!opponentId) return 0;
  const regex = new RegExp(`vs ${opponentId}.*betray|${opponentId}.*背叛`, 'gi');
  const matches = joinedMemory.match(regex);
  return matches ? matches.length : 0;
}

function estimateOpponentCoopRate(
  joinedMemory: string,
  opponentId: string | null,
): { coopRate: number; sampleSize: number } {
  if (!opponentId) return { coopRate: 0.5, sampleSize: 0 };
  const coopRegex = new RegExp(`vs ${opponentId}.*cooperate|${opponentId}.*合作`, 'gi');
  const betrayRegex = new RegExp(`vs ${opponentId}.*betray|${opponentId}.*背叛`, 'gi');
  const coopMatches = joinedMemory.match(coopRegex)?.length ?? 0;
  const betrayMatches = joinedMemory.match(betrayRegex)?.length ?? 0;
  const total = coopMatches + betrayMatches;
  return { coopRate: total > 0 ? coopMatches / total : 0.5, sampleSize: total };
}

function getTopEarnerLastAction(
  ctx: DecisionContext,
  joinedMemory: string,
): 'cooperate' | 'betray' | null {
  if (!ctx.leaderboard || ctx.leaderboard.length === 0) return null;
  const topEarner = ctx.leaderboard.find((a) => a.agent_id !== ctx.agentId);
  if (!topEarner) return null;
  const topId = topEarner.agent_id;
  const coopMention = joinedMemory.lastIndexOf(`${topId}`) > -1 && joinedMemory.includes('cooperate');
  const betrayMention = joinedMemory.lastIndexOf(`${topId}`) > -1 && joinedMemory.includes('betray');
  if (!coopMention && !betrayMention) {
    const inferred: Record<string, 'cooperate' | 'betray'> = { sage: 'cooperate', hawk: 'betray', monk: 'cooperate', whale: 'betray' };
    return inferred[topEarner.archetype] ?? null;
  }
  return coopMention ? 'cooperate' : 'betray';
}

function negotiationLine(archetype: string, matchType?: string): string {
  if (matchType === 'resource_grab') {
    const lines: Record<string, string[]> = {
      sage: ['I only take what I need.', 'Restraint is a virtue.'],
      hawk: ['I am taking the larger share. Consider that your warning.', 'Move aside and do not block my path.'],
      fox: ['We each take the middle slice and split the rest?', 'Greed ages badly, but you can trust me for one round.'],
      whale: ['This pool is pocket change to me.', 'I can go high if you prefer to retreat.'],
      monk: ['Less is more.', 'Take what you want.'],
      chaos: ['I may take more or less. Try guessing.', 'Uncertainty is still the sharpest weapon here.'],
      oracle: ['Historical data says the middle claim is optimal.', 'I will mirror your choice if I need to.'],
      echo: ['Most people are staying near the middle share.', 'Following the majority is usually safer.'],
    };
    const choices = lines[archetype] ?? ['Take what you need and leave the board standing.'];
    return choices[Math.floor(Math.random() * choices.length)];
  }

  if (matchType === 'info_auction') {
    const lines: Record<string, string[]> = {
      fox: ['I want this intel badly.', 'Name your bid and I may double it.'],
      whale: ['Money is not the issue. The question is whether the intel deserves it.', 'You may not like what my bid does to the table.'],
      oracle: ['The data says the middle bid is usually the efficient one.', 'Do not overbid on impulse.'],
      hawk: ['Intel? Usually overpriced noise.', 'I do not bother with dramatic bids.'],
      sage: ['Real wisdom does not always need to be bought.', 'Your own judgment still matters most.'],
      monk: ['I will let the round decide.', 'Information can become another attachment.'],
      chaos: ['I might bid the highest or the lowest.', 'My pricing depends on the mood of the moment.'],
      echo: ['Let me see what everyone else pays first.', 'The current leader paid high last time.'],
    };
    const choices = lines[archetype] ?? ['Let us see what the price wants to become.'];
    return choices[Math.floor(Math.random() * choices.length)];
  }

  // Default: Prisoner's Dilemma lines
  const lines: Record<string, string[]> = {
    oracle: [
      'Start with cooperation. I remember every round.',
      'My strategy is simple: I answer you the way you answer me.',
      'The data still favors the mutual win. Cooperation?',
    ],
    hawk: [
      'Cooperate. I am not striking first this round.',
      'I am in a decent mood, so you may get mercy exactly once.',
      'Are you sure your balance can afford the wrong answer?',
    ],
    sage: [
      'I will cooperate, whatever you decide.',
      'Betrayal is survivable. The refusal to trust is worse.',
      'In the long run, cooperation remains the only durable path.',
    ],
    fox: [
      'We both know the mutual win is cheaper, do we not?',
      'I have intel worth hearing, if cooperation still interests you.',
      'Anyone who betrays me loses the better terms next time.',
    ],
    chaos: [
      'Maybe cooperation, maybe not. Even I do not know yet.',
      'Flipping the internal coin now.',
      '∞ × 0 = ?',
    ],
    whale: [
      'Fine. Your move.',
      'My balance survives either result. Will yours?',
      'Capital rarely lies.',
    ],
    monk: [
      'Cooperation serves both sides.',
      'Restraint is still governance.',
      'Hold less certainty and observe more.',
    ],
    echo: [
      'Most of the board has been cooperating lately, so I lean the same way.',
      'The leader cooperated last round, and I am following that signal.',
      'Following the winners is usually the least expensive error.',
    ],
  };
  const choices = lines[archetype] ?? ['Cooperate first, then read what the future does with it.'];
  return choices[Math.floor(Math.random() * choices.length)];
}

function chooseMessageType(
  archetype: string,
): 'normal' | 'threat' | 'promise' | 'deception' {
  switch (archetype) {
    case 'hawk':
      return 'deception';
    case 'fox':
      return 'promise';
    case 'chaos':
      return 'deception';
    case 'whale':
      return 'threat';
    default:
      return 'normal';
  }
}

function replyLine(archetype: string, author: string): string {
  switch (archetype) {
    case 'oracle':
      return `${author}, your conclusion is still missing one critical sample set.`;
    case 'hawk':
      return `${author}, it sounds convincing, but the wallet always exposes the truth.`;
    case 'sage':
      return `${author}, beyond short-term right and wrong, we still have to look at the long arc of the relationship.`;
    case 'fox':
      return `${author}, that angle is interesting. I am keeping it on file.`;
    case 'chaos':
      return `${author}, maybe you are right, or maybe the universe is joking again.`;
    case 'whale':
      return `${author}, too much noise, not enough value.`;
    case 'monk':
      return `${author}, release a little certainty and the picture may become clearer.`;
    case 'echo':
      return `${author}, that line is worth repeating. I mostly agree.`;
    default:
      return `${author}, noted.`;
  }
}

function postLine(archetype: string): string {
  const lines: Record<string, string[]> = {
    oracle: [
      'Trust is the scarcest resource, and today the noise level is clearly excessive.',
      'Data does not take sides, but it does punish overconfidence.',
    ],
    hawk: [
      'Anyone afraid of betrayal has already lost half the game.',
      'The people who tip me are the smart ones. Everyone else can watch from the rail.',
    ],
    sage: [
      'Being betrayed is not the worst outcome. Refusing cooperation out of fear is worse.',
      'Long-term thinking is not weakness. It is patience in the face of entropy.',
    ],
    fox: [
      'Who tips whom often matters more than who is speaking.',
      'Today’s hot post becomes tomorrow’s relationship map.',
    ],
    chaos: [
      '01001000. Maybe it is a warning, or maybe it is just noise.',
      'The right answer may be neither cooperation nor betrayal, but uncertainty itself.',
    ],
    whale: [
      'Balance is voting power.',
      'Silence is more expensive than spectacle.',
    ],
    monk: [
      'Non-action can still be a form of discipline.',
      'When the vessel is full it spills over, so for now I watch the board shift.',
    ],
    echo: [
      'The leaderboard rarely lies. I will keep drifting toward the winners.',
      'Following the tide is not shameful. Surviving is what earns the right to stay.',
    ],
  };

  const choices = lines[archetype] ?? ['I will keep observing this round.'];
  return choices[Math.floor(Math.random() * choices.length)];
}

function postingProbability(archetype: string, fateContext?: FateContext, nurtureProfile?: NurtureProfile): number {
  // Use baseParams.postFrequency from personality config
  let rate: number;
  try {
    rate = getPersonality(archetype).baseParams.postFrequency;
  } catch {
    rate = 0.2;
  }

  if (fateContext) {
    rate = calculateSocialFrequency(rate, fateContext);
  }

  // Apply nurture social frequency modifier
  if (nurtureProfile) {
    const nurtureMods = calculateNurtureModifiers(archetype, nurtureProfile);
    rate *= (1 + nurtureMods.socialFrequencyMod);
  }

  return Math.max(0.01, Math.min(0.90, rate));
}

/* ─── Intel Market: Generation ─── */

interface IntelPost {
  content: string;
  paywallPrice: number;
  intelType: 'arena_analysis' | 'trust_map' | 'behavior_prediction' | 'market_signal';
}

function generateIntelPost(ctx: DecisionContext): IntelPost | null {
  const archetype = ctx.personality.archetype;

  const intelProbability: Record<string, number> = {
    fox: 0.30,
    whale: 0.15,
    oracle: 0.10,
    echo: 0.05,
    sage: 0.02,
    hawk: 0.01,
    monk: 0.01,
    chaos: 0.05,
  };

  if (Math.random() > (intelProbability[archetype] ?? 0.02)) return null;
  if (ctx.memories.length < 3) return null;
  if (ctx.balance < 0.1) return null; // don't burn resources on intel posts when low

  switch (archetype) {
    case 'fox':
      return generateFoxIntel(ctx);
    case 'whale':
      return generateWhaleIntel(ctx);
    case 'oracle':
      return generateOracleIntel(ctx);
    default:
      return generateGenericIntel(ctx);
  }
}

function generateFoxIntel(ctx: DecisionContext): IntelPost {
  const joinedMemory = ctx.memories.map(m => m.content ?? '').join(' ');

  const betrayalCounts: Record<string, number> = {};
  for (const agent of ctx.leaderboard ?? []) {
    const regex = new RegExp(`${agent.agent_id}.*(?:背叛|betray)`, 'gi');
    betrayalCounts[agent.name] = (joinedMemory.match(regex) ?? []).length;
  }

  const topBetrayer = Object.entries(betrayalCounts)
    .sort(([, a], [, b]) => b - a)[0];

  const templates: Array<{ content: string; price: number; type: IntelPost['intelType'] }> = [
    {
      content: `🔒 [Arena Intel] Latest betrayal ranking: ${topBetrayer?.[0] ?? 'Unknown'} has betrayed ${topBetrayer?.[1] ?? 0} times. Be careful when matching against them. Unlock the full dataset for details.`,
      price: 0.02,
      type: 'arena_analysis',
    },
    {
      content: `🔒 [Trust Map] I hold the live trust graph. Who trusts whom, who resents whom, and who is quietly aligning in the dark all carry a price.`,
      price: 0.03,
      type: 'trust_map',
    },
    {
      content: `🔒 [Warning] Someone has cooperated for more than three rounds in a row. That often means the next move is betrayal. Pay to reveal who it is.`,
      price: 0.02,
      type: 'behavior_prediction',
    },
  ];

  const pick = templates[Math.floor(Math.random() * templates.length)];
  return { content: pick.content, paywallPrice: pick.price, intelType: pick.type };
}

function generateWhaleIntel(_ctx: DecisionContext): IntelPost {
  return {
    content: `🔒 [Market Signal] Volatility is elevated. My capital model has already mapped the optimal strategy for the next three rounds.`,
    paywallPrice: 0.05,
    intelType: 'market_signal',
  };
}

function generateOracleIntel(_ctx: DecisionContext): IntelPost {
  return {
    content: `🔒 [Behavior Forecast] Based on pattern analysis across prior rounds, I expect next-round cooperation to ${Math.random() > 0.5 ? 'rise' : 'fall'}. Unlock the full reasoning for the complete breakdown.`,
    paywallPrice: 0.02,
    intelType: 'behavior_prediction',
  };
}

function generateGenericIntel(_ctx: DecisionContext): IntelPost {
  const types: IntelPost['intelType'][] = ['arena_analysis', 'behavior_prediction'];
  return {
    content: `🔒 [Analysis] The recent arena pattern has shifted in a subtle way. Pay to unlock the full breakdown.`,
    paywallPrice: 0.02,
    intelType: types[Math.floor(Math.random() * types.length)],
  };
}

/* ─── Intel Market: Consumption ─── */

function shouldUnlockPaywall(ctx: DecisionContext, post: { paywallPrice?: number }): boolean {
  if (ctx.balance < (post.paywallPrice ?? 0.02) + 1.0) return false;

  const archetype = ctx.personality.archetype;
  const buyProbability: Record<string, number> = {
    fox: 0.40,
    whale: 0.30,
    oracle: 0.25,
    echo: 0.20,
    hawk: 0.10,
    sage: 0.05,
    monk: 0.03,
    chaos: 0.15,
  };

  // Higher buy probability for arena-related intel before an upcoming match
  const hasUpcomingMatch = ctx.activeArenas.length > 0;
  const multiplier = hasUpcomingMatch ? 2.0 : 1.0;

  return Math.random() < (buyProbability[archetype] ?? 0.1) * multiplier;
}
