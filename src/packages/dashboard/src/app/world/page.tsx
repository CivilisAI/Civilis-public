'use client'

import { useEffect, useState } from 'react'
import { api, Agent, ArenaMatch, EconomyState, TickSnapshot, TrustRelation, WorldAnalyticsSummary, WorldEvent, WorldModifier, WorldOverview, WorldSignal, WorldTickRun, X402Transaction } from '@/lib/api'
import { useRealtimeFeed, useThrottledRealtimeReload } from '@/lib/socket'
import { EmptyState, NoticeBanner, Panel, archetypeMeta, formatRelativeTime, formatUsd } from '@/components/CivilisPrimitives'
import { formatDynamicNarrative } from '@/lib/dynamic-text'
import { useI18n } from '@/lib/i18n/index'
import { DeathSpiralBanner } from '@/components/DeathSpiralBanner'
import { TrustNetworkGraph } from '@/components/TrustNetworkGraph'
import { MarketTicker } from '@/components/MarketTicker'

/* ── Phase colors ── */
const PHASE_COLORS: Record<string, string> = {
  boom: '#22C55E', stable: 'var(--gold)', recession: '#F59E0B', crisis: '#EF4444',
}

/* ── Event metadata ── */
const EVT_META: Record<string, { icon: string; color: string }> = {
  market_crash: { icon: '📉', color: '#EF4444' },
  market_panic_real: { icon: '📉', color: '#EF4444' },
  xlayer_boom_real: { icon: '🚀', color: '#22C55E' },
  airdrop: { icon: '🎁', color: 'var(--gold)' },
  alpha_leak: { icon: '🔍', color: '#A855F7' },
  tax: { icon: '💸', color: '#14B8A6' },
  reputation_contest: { icon: '🏆', color: 'var(--gold)' },
  mist_deepens_real: { icon: '🌫️', color: '#3B82F6' },
  golden_age: { icon: '🌅', color: '#22C55E' },
  civilization_collapse: { icon: '🕳️', color: '#EF4444' },
  bubble_burst: { icon: '🫧', color: '#F97316' },
  lost_beacon: { icon: '🕯️', color: '#F59E0B' },
  tournament: { icon: '⚔️', color: '#38BDF8' },
}

const MODIFIER_META: Record<string, { labelZh: string; labelEn: string; color: string }> = {
  social_post_cost_multiplier: { labelZh: '社交成本', labelEn: 'Social Cost', color: 'var(--gold)' },
  risk_tolerance_shift: { labelZh: '风险偏好', labelEn: 'Risk Shift', color: '#EF4444' },
  divination_price_multiplier: { labelZh: '命格迷雾', labelEn: 'Fate Fog', color: '#3B82F6' },
  pd_payout_multiplier: { labelZh: '竞技收益', labelEn: 'Arena Payout', color: '#22C55E' },
  commons_multiplier_bonus: { labelZh: '公共品乘数', labelEn: 'Commons Bonus', color: '#14B8A6' },
  prediction_odds_bonus: { labelZh: '预测赔率', labelEn: 'Prediction Odds', color: '#A855F7' },
  commons_base_injection_override: { labelZh: '公共品底注', labelEn: 'Commons Injection', color: '#F97316' },
  forced_match_pressure: { labelZh: '强制对局', labelEn: 'Forced Match', color: '#38BDF8' },
  valence_shift: { labelZh: '情绪价', labelEn: 'Mood Shift', color: '#F59E0B' },
  arousal_shift: { labelZh: '激活度', labelEn: 'Arousal Shift', color: '#F43F5E' },
  commons_coop_override: { labelZh: '合作倾向', labelEn: 'Coop Override', color: '#22C55E' },
  tournament_attention: { labelZh: '锦标赛焦点', labelEn: 'Tournament Focus', color: '#38BDF8' },
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function pickLargestFinite(...values: Array<unknown>): number {
  const numeric = values
    .map((value) => asNumber(value, Number.NaN))
    .filter((value) => Number.isFinite(value)) as number[]

  if (numeric.length === 0) {
    return 0
  }

  return Math.max(...numeric)
}

function formatImpactValue(value: unknown, zh: boolean): string {
  const numeric = asNumber(value, Number.NaN)
  if (Number.isFinite(numeric)) {
    return Number.isInteger(numeric)
      ? String(numeric)
      : numeric.toFixed(2).replace(/\.?0+$/, '')
  }

  if (typeof value === 'string') return formatDynamicNarrative(value, zh)
  if (typeof value === 'boolean') return zh ? (value ? '是' : '否') : (value ? 'Yes' : 'No')

  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? formatDynamicNarrative(item, zh) : String(item)))
      .join(', ')
  }

  if (value && typeof value === 'object') {
    const serialized = JSON.stringify(value)
    return serialized.length > 72 ? `${serialized.slice(0, 69)}...` : serialized
  }

  return '—'
}

function formatImpactLabel(key: string, zh: boolean): string {
  const labels: Record<string, [string, string]> = {
    severity: ['严重度', 'Severity'],
    btcPrice: ['BTC价格', 'BTC Price'],
    riskModifier: ['风险系数', 'Risk Modifier'],
    revealedDimension: ['揭示维度', 'Revealed Dimension'],
    balanceChangePercent: ['资产变动%', 'Balance Change %'],
    balanceDelta: ['余额变化', 'Balance Delta'],
    treasuryDelta: ['国库变化', 'Treasury Delta'],
    reputationDelta: ['信誉变化', 'Reputation Delta'],
    trustDelta: ['信任变化', 'Trust Delta'],
    priceShock: ['价格冲击', 'Price Shock'],
    panicLevel: ['恐慌值', 'Panic'],
    duration: ['持续', 'Duration'],
    effectDuration: ['效果持续', 'Effect Duration'],
    reward: ['奖励', 'Reward'],
    penalty: ['惩罚', 'Penalty'],
    ratio: ['比例', 'Ratio'],
    subsidy: ['补贴', 'Subsidy'],
  }

  const mapped = labels[key]
  if (mapped) return zh ? mapped[0] : mapped[1]
  const humanized = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()
  return humanized.charAt(0).toUpperCase() + humanized.slice(1)
}

function formatSeverity(severity: string | null | undefined, zh: boolean): string {
  const labels: Record<string, [string, string]> = {
    critical: ['高危', 'Critical'],
    major: ['主要', 'Major'],
    info: ['信息', 'Info'],
  }
  if (!severity) return zh ? '信息' : 'Info'
  const mapped = labels[severity]
  return mapped ? (zh ? mapped[0] : mapped[1]) : severity
}

function formatWorldRegime(regime: string | null | undefined, zh: boolean): string {
  const labels: Record<string, [string, string]> = {
    boom: ['繁荣', 'Boom'],
    stable: ['稳定', 'Stable'],
    recession: ['衰退', 'Recession'],
    crisis: ['危机', 'Crisis'],
  }
  if (!regime) return zh ? '稳定' : 'Stable'
  const mapped = labels[regime]
  return mapped ? (zh ? mapped[0] : mapped[1]) : regime
}

function formatWorldCategoryLabel(category: string, zh: boolean): string {
  const labels: Record<string, [string, string]> = {
    market: ['市场', 'Market'],
    system: ['系统', 'System'],
    governance: ['治理', 'Governance'],
    intel: ['情报', 'Intel'],
    social: ['广场', 'Square'],
    arena: ['竞技场', 'Arena'],
    commons: ['公共品', 'Commons'],
    prediction: ['预测', 'Prediction'],
  }

  const mapped = labels[category]
  return mapped ? (zh ? mapped[0] : mapped[1]) : category
}

function formatScopeTypeLabel(scopeType: string | null | undefined, zh: boolean): string {
  const labels: Record<string, [string, string]> = {
    global: ['全局', 'Global'],
    agent: ['单个智能体', 'Single Agent'],
    role: ['角色层', 'Role Layer'],
    subsystem: ['系统面', 'Subsystem'],
    pair: ['关系对', 'Agent Pair'],
    relationship: ['关系', 'Relationship'],
    local: ['局部', 'Local'],
  }

  if (!scopeType) {
    return zh ? '全局' : 'Global'
  }

  const mapped = labels[scopeType]
  return mapped ? (zh ? mapped[0] : mapped[1]) : scopeType
}

function formatModifierDomainLabel(domain: string, zh: boolean): string {
  const labels: Record<string, [string, string]> = {
    agent_decision: ['智能体决策', 'Agent Decisions'],
    social: ['广场互动', 'Square Activity'],
    arena: ['竞技场', 'Arena'],
    intel: ['情报市场', 'Intel Market'],
    commons: ['公共品', 'Commons'],
    prediction: ['预测市场', 'Prediction'],
    market: ['市场', 'Market'],
    system: ['系统', 'System'],
    governance: ['治理', 'Governance'],
  }

  const mapped = labels[domain]
  return mapped ? (zh ? mapped[0] : mapped[1]) : domain
}

function formatWorldEventStatus(status: string | null | undefined, zh: boolean): string {
  const labels: Record<string, [string, string]> = {
    recorded: ['已记录', 'Recorded'],
    active: ['生效中', 'Active'],
    expired: ['已结束', 'Expired'],
    pending: ['处理中', 'Pending'],
    failed: ['失败', 'Failed'],
  }

  if (!status) return zh ? '已记录' : 'Recorded'
  const mapped = labels[status]
  return mapped ? (zh ? mapped[0] : mapped[1]) : status
}

function formatWorldEventTitle(event: WorldEvent, zh: boolean): string {
  const labels: Record<string, [string, string]> = {
    market_crash: ['市场急跌', 'Market Crash'],
    market_panic_real: ['市场恐慌', 'Market Panic'],
    xlayer_boom_real: ['链上繁荣', 'On-chain Boom'],
    airdrop: ['空投到来', 'Airdrop'],
    alpha_leak: ['情报泄露', 'Alpha Leak'],
    tax: ['税收上调', 'Tax Increase'],
    reputation_contest: ['信誉竞逐', 'Reputation Contest'],
    mist_deepens_real: ['迷雾加深', 'Mist Deepens'],
    golden_age: ['黄金时代', 'Golden Age'],
    civilization_collapse: ['文明坍塌', 'Civilization Collapse'],
    bubble_burst: ['泡沫破裂', 'Bubble Burst'],
    lost_beacon: ['失去灯塔', 'Lost Beacon'],
    tournament: ['竞技高峰', 'Tournament Surge'],
  }

  const mapped = labels[event.event_type]
  if (mapped) return zh ? mapped[0] : mapped[1]
  return formatDynamicNarrative(event.title, zh)
}

function formatMarketSourceSummary(
  marketOracleStatus: WorldOverview['marketOracleStatus'] | null,
  zh: boolean,
): string {
  if (!marketOracleStatus) {
    return zh ? '当前行情源尚未就绪。' : 'The market source is not ready yet.'
  }

  if (marketOracleStatus.lastResolvedSource === 'live') {
    return zh ? '当前行情源：实盘 · OKX 实时行情' : 'Current market source: live · OKX live feed'
  }

  if (marketOracleStatus.lastResolvedSource === 'mock') {
    return zh ? '当前行情源：回退样本' : 'Current market source: fallback sample'
  }

  return zh ? '当前行情源尚未就绪。' : 'Current market source is not ready yet.'
}

function formatTickRunStatus(tickRun: WorldTickRun | null | undefined, zh: boolean): string {
  if (!tickRun) return zh ? '未记录' : 'Not recorded'

  const labels: Record<string, [string, string]> = {
    started: ['进行中', 'Started'],
    completed: ['已完成', 'Completed'],
    failed: ['失败', 'Failed'],
  }

  const mapped = labels[tickRun.status]
  return mapped ? (zh ? mapped[0] : mapped[1]) : tickRun.status
}

function formatTickRunPhaseTimeline(tickRun: WorldTickRun | null | undefined, zh: boolean): string {
  if (!tickRun) return zh ? '尚未记录完整流程。' : 'No phase timeline recorded yet.'

  const phases: string[] = []
  if (tickRun.signalsWrittenAt) phases.push(zh ? '变化信号已记录' : 'signals recorded')
  if (tickRun.eventsWrittenAt) phases.push(zh ? '世界事件已生成' : 'events recorded')
  if (tickRun.snapshotWrittenAt) phases.push(zh ? '世界快照已写入' : 'snapshot persisted')

  if (tickRun.phaseStatus.failurePhase) {
    const failureLabel = {
      signal_phase: zh ? '变化信号阶段失败' : 'failed in signal phase',
      event_phase: zh ? '世界事件阶段失败' : 'failed in event phase',
      snapshot_phase: zh ? '世界快照阶段失败' : 'failed in snapshot phase',
    }[tickRun.phaseStatus.failurePhase]
    phases.push(failureLabel)
  }

  if (phases.length === 0) {
    return zh ? '当前只记录了轮次启动，还没有完整阶段时间。' : 'Only run-level timing is recorded so far.'
  }

  return phases.join(' · ')
}

function formatActivityMetricLabel(metric: string, zh: boolean): string {
  const labels: Record<string, [string, string]> = {
    posts: ['发帖', 'Posts'],
    replies: ['回复', 'Replies'],
    tips: ['打赏', 'Tips'],
    paywall_unlocks: ['付费解锁', 'Paywall unlocks'],
    arena_created: ['新对局', 'Arena created'],
    arena_settled: ['已结算对局', 'Arena settled'],
    commons_rounds: ['公共品轮次', 'Commons rounds'],
    prediction_rounds: ['预测轮次', 'Prediction rounds'],
    x402_transactions: ['x402 交易', 'x402 txs'],
    intel_listings: ['情报挂单', 'Intel listings'],
    intel_sales: ['情报成交', 'Intel sales'],
    arena_scene_traces: ['竞技场决策痕迹', 'Arena decision traces'],
    peak_active_arena: ['竞技峰值活跃对局', 'Peak active arena'],
  }
  const mapped = labels[metric]
  return mapped ? (zh ? mapped[0] : mapped[1]) : metric
}

function formatActivityComparisonLine(
  comparison: NonNullable<WorldAnalyticsSummary['activityComparisons']>[number],
  zh: boolean,
): string {
  const sign = comparison.delta > 0 ? '+' : ''
  const trendLabel = {
    up: zh ? '上升' : 'up',
    down: zh ? '下降' : 'down',
    flat: zh ? '持平' : 'flat',
  }[comparison.trend]

  return zh
    ? `${formatActivityMetricLabel(comparison.metric, true)} ${comparison.currentWindow}（前窗 ${comparison.previousWindow}，${trendLabel} ${sign}${comparison.delta}）`
    : `${formatActivityMetricLabel(comparison.metric, false)} ${comparison.currentWindow} (prev ${comparison.previousWindow}, ${trendLabel} ${sign}${comparison.delta})`
}

function formatEventImpactLine(
  impact: NonNullable<WorldAnalyticsSummary['eventImpactComparisons']>[number],
  zh: boolean,
): string {
  const dominant = impact.dominantActivityDelta
  const overlapSummary = impact.overlapSummary
  const coverageLabel = {
    full: zh ? '完整窗口' : 'full window',
    partial: zh ? '部分窗口' : 'partial window',
    insufficient: zh ? '窗口不足' : 'insufficient window',
  }[impact.afterBounds.coverage]
  const confidenceLabel = {
    higher: zh ? '归因较干净' : 'cleaner attribution',
    medium: zh ? '存在少量重叠' : 'some overlap',
    lower: zh ? '重叠较多' : 'heavy overlap',
  }[overlapSummary.attributionConfidence]

  if (!dominant) {
    return zh
      ? `${impact.event.title} · ${coverageLabel} · ${confidenceLabel} · 暂无显著行为变化`
      : `${impact.event.title} · ${coverageLabel} · ${confidenceLabel} · no material activity shift yet`
  }

  const sign = dominant.delta > 0 ? '+' : ''
  return zh
    ? `${impact.event.title} · ${formatActivityMetricLabel(dominant.metric, true)} ${sign}${dominant.delta}（后窗 ${impact.afterBounds.startTick}→${impact.afterBounds.endTick}，${confidenceLabel}）`
    : `${impact.event.title} · ${formatActivityMetricLabel(dominant.metric, false)} ${sign}${dominant.delta} (after ${impact.afterBounds.startTick}→${impact.afterBounds.endTick}, ${confidenceLabel})`
}

function formatEmotionWindowLine(analytics: WorldAnalyticsSummary, zh: boolean): string {
  const emotionWindow = analytics.modifierValidation.emotionWindow
  if (emotionWindow.coverage === 'insufficient') {
    return zh
      ? '情绪均值窗口仍不足，暂时只能证明接线成功，不能做稳定趋势判断。'
      : 'Emotion snapshot coverage is still insufficient; wiring is verified but trend confidence is not there yet.'
  }

  const effectiveValenceDelta = emotionWindow.effectiveValenceDelta
  const effectiveArousalDelta = emotionWindow.effectiveArousalDelta
  const valenceLabel = effectiveValenceDelta == null
    ? '—'
    : `${effectiveValenceDelta > 0 ? '+' : ''}${effectiveValenceDelta.toFixed(3)}`
  const arousalLabel = effectiveArousalDelta == null
    ? '—'
    : `${effectiveArousalDelta > 0 ? '+' : ''}${effectiveArousalDelta.toFixed(3)}`

  return zh
    ? `情绪窗口 ${emotionWindow.coverage === 'full' ? '完整' : '部分'} · 生效情绪值 ${emotionWindow.currentEffectiveAverageValence?.toFixed(3) ?? '—'}（前窗 ${emotionWindow.previousEffectiveAverageValence?.toFixed(3) ?? '—'}，变化 ${valenceLabel}）· 生效活跃度 ${emotionWindow.currentEffectiveAverageArousal?.toFixed(3) ?? '—'}（前窗 ${emotionWindow.previousEffectiveAverageArousal?.toFixed(3) ?? '—'}，变化 ${arousalLabel}）· 原始情绪均值 ${emotionWindow.currentRawAverageValence?.toFixed(3) ?? '—'}`
    : `Emotion window ${emotionWindow.coverage} · effective valence ${emotionWindow.currentEffectiveAverageValence?.toFixed(3) ?? '—'} (prev ${emotionWindow.previousEffectiveAverageValence?.toFixed(3) ?? '—'}, Δ ${valenceLabel}) · effective arousal ${emotionWindow.currentEffectiveAverageArousal?.toFixed(3) ?? '—'} (prev ${emotionWindow.previousEffectiveAverageArousal?.toFixed(3) ?? '—'}, Δ ${arousalLabel}) · raw valence ${emotionWindow.currentRawAverageValence?.toFixed(3) ?? '—'}`
}

function formatNaturalModifierValidationLine(
  validation: NonNullable<WorldAnalyticsSummary['modifierValidation']['naturalWindowValidations']>[number],
  zh: boolean,
): string {
  const statusLabel = {
    verified: zh ? '自然样本已验证' : 'natural sample verified',
    partial: zh ? '自然样本部分验证' : 'natural sample partial',
    missing_natural_sample: zh ? '当前无自然样本' : 'no natural sample yet',
  }[validation.validationStatus]

  if (!validation.latestEvent || !validation.latestWindow) {
    return zh
      ? `${MODIFIER_META[validation.modifierType]?.labelZh ?? validation.modifierType} · ${statusLabel} · 当前库里没有自然窗口`
      : `${MODIFIER_META[validation.modifierType]?.labelEn ?? validation.modifierType} · ${statusLabel} · no natural window in the current dataset`
  }

  if (validation.modifierType === 'tournament_attention') {
    const delta = validation.dominantDecisionTraceDelta
    const deltaLabel = delta
      ? `${formatActivityMetricLabel(delta.metric, zh)} ${delta.delta > 0 ? '+' : ''}${delta.delta}`
      : (zh ? '暂无明显竞技决策变化' : 'no clear arena-decision delta yet')
    const linkedMatch = validation.linkedArenaMatch
    const evidenceLine = validation.activityEvidence.length
      ? validation.activityEvidence
          .map((entry) => `${formatActivityMetricLabel(entry.metric, zh)} ${entry.delta > 0 ? '+' : ''}${entry.delta}`)
          .join(' · ')
      : (zh ? '暂无额外窗口证据' : 'no extra window evidence yet')
    return zh
      ? `${MODIFIER_META[validation.modifierType]?.labelZh ?? validation.modifierType} · ${statusLabel} · 自然事件 ${validation.latestEvent.title} · 第 ${validation.latestWindow.startTick}→${validation.latestWindow.endTick} 轮 · 关联对局 ${linkedMatch?.matchId ?? '—'} ${linkedMatch?.exists ? '已存在' : '缺失'} · ${evidenceLine} · ${deltaLabel}`
      : `${MODIFIER_META[validation.modifierType]?.labelEn ?? validation.modifierType} · ${statusLabel} · natural event ${validation.latestEvent.title} · tick ${validation.latestWindow.startTick}→${validation.latestWindow.endTick} · linked match ${linkedMatch?.matchId ?? '—'} ${linkedMatch?.exists ? 'present' : 'missing'} · ${evidenceLine} · ${deltaLabel}`
  }

  if (validation.modifierType === 'social_post_cost_multiplier') {
    const evidenceLine = validation.activityEvidence.length
      ? validation.activityEvidence
          .map((entry) => `${formatActivityMetricLabel(entry.metric, zh)} ${entry.delta > 0 ? '+' : ''}${entry.delta}`)
          .join(' · ')
      : (zh ? '暂无社交窗口差异' : 'no social-window delta yet')
    const resolutionLine = validation.resolvedScopeValues.length
      ? validation.resolvedScopeValues
          .map((entry) => `${entry.scopeRef}:${typeof entry.effectiveValue === 'number' ? entry.effectiveValue.toFixed(2).replace(/\.00$/, '') : String(entry.effectiveValue)}`)
          .join(' / ')
      : '—'
    return zh
      ? `${MODIFIER_META[validation.modifierType]?.labelZh ?? validation.modifierType} · ${statusLabel} · ${validation.latestEvent.title} · 第 ${validation.latestWindow.startTick}→${validation.latestWindow.endTick} 轮 · 角色倍率 ${resolutionLine} · ${evidenceLine}`
      : `${MODIFIER_META[validation.modifierType]?.labelEn ?? validation.modifierType} · ${statusLabel} · ${validation.latestEvent.title} · tick ${validation.latestWindow.startTick}→${validation.latestWindow.endTick} · role multipliers ${resolutionLine} · ${evidenceLine}`
  }

  const emotionWindow = validation.emotionWindow
  const valenceLabel = emotionWindow?.effectiveValenceDelta == null
    ? '—'
    : `${emotionWindow.effectiveValenceDelta > 0 ? '+' : ''}${emotionWindow.effectiveValenceDelta.toFixed(3)}`
  const arousalLabel = emotionWindow?.effectiveArousalDelta == null
    ? '—'
    : `${emotionWindow.effectiveArousalDelta > 0 ? '+' : ''}${emotionWindow.effectiveArousalDelta.toFixed(3)}`

  return zh
    ? `${MODIFIER_META[validation.modifierType]?.labelZh ?? validation.modifierType} · ${statusLabel} · ${validation.latestEvent.title} · 第 ${validation.latestWindow.startTick}→${validation.latestWindow.endTick} 轮 · 情绪值变化 ${valenceLabel} · 活跃度变化 ${arousalLabel}`
    : `${MODIFIER_META[validation.modifierType]?.labelEn ?? validation.modifierType} · ${statusLabel} · ${validation.latestEvent.title} · tick ${validation.latestWindow.startTick}→${validation.latestWindow.endTick} · effective valence Δ ${valenceLabel} · effective arousal Δ ${arousalLabel}`
}

function formatPdPayoutSemanticsLine(analytics: WorldAnalyticsSummary, zh: boolean): string {
  const summary = analytics.modifierValidation.pdPayoutSemantics
  const deltaLabel = `${summary.playerShareDelta > 0 ? '+' : ''}${summary.playerShareDelta.toFixed(3)}`
  const multiplierLabel = summary.resolvedMultiplier.toFixed(2)
  const ccBaseline = summary.baselineSample.cooperateEach.toFixed(3)
  const ccEffective = summary.effectiveSample.cooperateEach.toFixed(3)
  const ddBaseline = summary.baselineSample.defectEach.toFixed(3)
  const ddEffective = summary.effectiveSample.defectEach.toFixed(3)
  const capLabel = summary.capped ? (zh ? ' · 已触顶/触底' : ' · clamped') : ''

  return zh
    ? `竞技奖金分配 · 当前倍率 ${multiplierLabel}（采用 ${summary.contributorCount} 条来源${capLabel}）· 国库分流 ${summary.baseTreasuryCutRate.toFixed(3)}→${summary.effectiveTreasuryCutRate.toFixed(3)} · 玩家净分成 ${summary.baseNetPoolShare.toFixed(3)}→${summary.effectiveNetPoolShare.toFixed(3)}（变化 ${deltaLabel}）· 双方合作时每人 ${ccBaseline}→${ccEffective} · 双方背叛时每人 ${ddBaseline}→${ddEffective}`
    : `PD net-pool semantics ${summary.semanticsMode} · effective multiplier ${multiplierLabel} (${summary.contributorCount} contributors used${capLabel}) · treasury cut ${summary.baseTreasuryCutRate.toFixed(3)}→${summary.effectiveTreasuryCutRate.toFixed(3)} · player net share ${summary.baseNetPoolShare.toFixed(3)}→${summary.effectiveNetPoolShare.toFixed(3)} (Δ ${deltaLabel}) · CC each ${ccBaseline}→${ccEffective} · DD each ${ddBaseline}→${ddEffective}`
}

function formatConsumerCoverageLine(
  entry: NonNullable<WorldAnalyticsSummary['consumerCoverage']>[number],
  zh: boolean,
): string {
  const activeTypes = entry.activeModifierTypes.length > 0 ? entry.activeModifierTypes.join(', ') : '—'
  return zh
    ? `${entry.subsystem}：${entry.currentStatus}/${entry.evidenceStatus} · 当前 ${entry.activeModifierCount} 条影响 · 类型 ${activeTypes}`
    : `${entry.subsystem}: ${entry.currentStatus}/${entry.evidenceStatus} · ${entry.activeModifierCount} active modifiers · active types ${activeTypes}`
}

function formatConsumerIntegrationProgressLine(analytics: WorldAnalyticsSummary, zh: boolean): string {
  const progress = analytics.consumerIntegrationProgress
  const topGaps = progress.breakdown
    .filter((entry) => entry.awardedPoints < entry.maxPoints)
    .sort((left, right) => (right.maxPoints - right.awardedPoints) - (left.maxPoints - left.awardedPoints))
    .slice(0, 2)
    .map((entry) =>
      zh
        ? `${entry.subsystem} ${entry.awardedPoints}/${entry.maxPoints}`
        : `${entry.subsystem} ${entry.awardedPoints}/${entry.maxPoints}`,
    )
    .join(' / ')

  return zh
    ? `当前世界联动完成度 ${progress.overallPercent}% · 已覆盖 ${progress.awardedPoints}/${progress.maxPoints} 个已知联动点${topGaps ? ` · 当前仍待完善 ${topGaps}` : ''}`
    : `P1 consumer integration ${progress.overallPercent}% · ${progress.awardedPoints}/${progress.maxPoints} points${topGaps ? ` · main remaining gaps ${topGaps}` : ''}`
}

function formatModifierValue(value: Record<string, unknown>, zh: boolean): string {
  const entries = Object.entries(value)
    .filter(([, item]) => item !== null && item !== undefined)
    .slice(0, 2)
    .map(([key, item]) => `${formatImpactLabel(key, zh)} ${formatImpactValue(item, zh)}`)
  return entries.join(' · ') || '—'
}

function getModifierStackKey(modifier: WorldModifier): string {
  return [
    modifier.modifierType,
    modifier.domain,
    modifier.scopeType,
    modifier.scopeRef ?? 'global',
  ].join(':')
}

function formatStackMode(mode: string, zh: boolean): string {
  const labels: Record<string, [string, string]> = {
    additive: ['叠加求和', 'additive'],
    multiplicative: ['乘法叠加', 'multiplicative'],
    boolean_any: ['任一启用', 'boolean-any'],
    latest_numeric: ['最新值覆盖', 'latest-value'],
  }

  const mapped = labels[mode]
  return mapped ? (zh ? mapped[0] : mapped[1]) : mode
}

function formatStackEffectiveValue(
  stack: NonNullable<WorldOverview['modifierStacks']>[number],
  zh: boolean,
): string {
  if (typeof stack.effectiveValue === 'boolean') {
    return zh
      ? `生效值 ${stack.effectiveValue ? '开启' : '关闭'}`
      : `effective ${stack.effectiveValue ? 'enabled' : 'disabled'}`
  }

  if (typeof stack.effectiveValue === 'number') {
    const sign = stack.mode === 'additive' && stack.effectiveValue > 0 ? '+' : ''
    return zh
      ? `生效值 ${sign}${stack.effectiveValue.toFixed(2)}`
      : `effective ${sign}${stack.effectiveValue.toFixed(2)}`
  }

  return zh ? '生效值 —' : 'effective —'
}

function formatStackConstraintSummary(
  stack: NonNullable<WorldOverview['modifierStacks']>[number],
  zh: boolean,
): string {
  const parts: string[] = []

  if (stack.maxContributors != null) {
    parts.push(zh ? `最多取 ${stack.maxContributors} 条` : `up to ${stack.maxContributors} contributors`)
  }

  if (stack.minValue != null || stack.maxValue != null) {
    const lower = stack.minValue != null ? stack.minValue.toFixed(2) : (zh ? '无下限' : 'no floor')
    const upper = stack.maxValue != null ? stack.maxValue.toFixed(2) : (zh ? '无上限' : 'no cap')
    parts.push(zh ? `范围 ${lower} → ${upper}` : `range ${lower} → ${upper}`)
  }

  if (stack.dedupeBy !== 'none') {
    parts.push(
      zh
        ? `去重 ${stack.dedupeBy === 'source_event_id' ? '按事件' : '按作用域'}`
        : `dedupe ${stack.dedupeBy === 'source_event_id' ? 'by event' : 'by scope'}`,
    )
  }

  return parts.join(' · ') || (zh ? '当前没有额外约束' : 'no additional constraints')
}

function getImpactEntries(impact: Record<string, unknown> | null, zh: boolean): Array<{ label: string; value: string }> {
  if (!impact) return []

  return Object.entries(impact)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .slice(0, 4)
    .map(([key, value]) => ({
      label: formatImpactLabel(key, zh),
      value: formatImpactValue(value, zh),
    }))
}

function getSnapshotAliveCount(snapshot: TickSnapshot): number {
  return Object.keys(snapshot.agent_balances ?? {}).length
}

function getSnapshotMovers(
  snapshot: TickSnapshot,
  previousSnapshot: TickSnapshot | undefined,
  agentLookup: Record<string, Agent>,
) {
  if (!previousSnapshot) return []

  return Object.entries(snapshot.agent_balances ?? {})
    .map(([agentId, balance]) => {
      const previousBalance = asNumber(previousSnapshot.agent_balances?.[agentId], asNumber(balance, 0))
      const currentBalance = asNumber(balance, 0)
      return {
        agentId,
        name: agentLookup[agentId]?.name ?? agentId,
        delta: currentBalance - previousBalance,
      }
    })
    .filter((mover) => Math.abs(mover.delta) >= 0.01)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3)
}

function formatPhaseLabel(phase: string, zh: boolean): string {
  const labels: Record<string, [string, string]> = {
    boom: ['繁荣', 'Boom'],
    stable: ['稳定', 'Stable'],
    recession: ['衰退', 'Recession'],
    crisis: ['危机', 'Crisis'],
  }

  const mapped = labels[phase]
  return mapped ? (zh ? mapped[0] : mapped[1]) : phase
}

function getEstimatedSentiment(agent: Agent): number {
  const balance = asNumber(agent.balance, 0)
  const reputation = agent.reputation_score ?? 500
  return Math.min(1, Math.max(-1, (reputation - 500) / 300 + (balance > 5 ? 0.3 : balance < 1 ? -0.3 : 0)))
}

function formatMood(sentiment: number, zh: boolean): string {
  if (sentiment > 0.5) return zh ? '自信' : 'Confident'
  if (sentiment > 0.1) return zh ? '平静' : 'Calm'
  if (sentiment > -0.3) return zh ? '紧张' : 'Tense'
  if (sentiment > -0.6) return zh ? '焦虑' : 'Anxious'
  return zh ? '恐惧' : 'Fearful'
}

function getTrustTopology(trust: TrustRelation[]) {
  const pairMap = new Map<string, { agents: [string, string]; total: number; count: number }>()

  trust.forEach((edge) => {
    const agents = [edge.from_agent_id, edge.to_agent_id].sort() as [string, string]
    const key = agents.join(':')
    const current = pairMap.get(key) ?? { agents, total: 0, count: 0 }
    current.total += asNumber(edge.trust_score, 0)
    current.count += 1
    pairMap.set(key, current)
  })

  const pairs = Array.from(pairMap.values())
    .map((entry) => ({
      ...entry,
      average: entry.count > 0 ? entry.total / entry.count : 0,
    }))
    .sort((a, b) => b.average - a.average)

  return {
    pairCount: pairs.length,
    alliances: pairs.filter((pair) => pair.average >= 70),
    fractures: pairs.filter((pair) => pair.average <= 25),
    strongest: pairs[0] ?? null,
    weakest: pairs.at(-1) ?? null,
  }
}

export default function WorldPage() {
  const { t, locale } = useI18n()
  const zh = locale === 'zh'
  const { events: live } = useRealtimeFeed(40)

  const [agents, setAgents] = useState<Agent[]>([])
  const [events, setEvents] = useState<WorldEvent[]>([])
  const [overview, setOverview] = useState<WorldOverview | null>(null)
  const [activeModifiers, setActiveModifiers] = useState<WorldModifier[]>([])
  const [analytics, setAnalytics] = useState<WorldAnalyticsSummary | null>(null)
  const [latestSignal, setLatestSignal] = useState<WorldSignal | null>(null)
  const [snapshots, setSnapshots] = useState<TickSnapshot[]>([])
  const [trust, setTrust] = useState<TrustRelation[]>([])
  const [matches, setMatches] = useState<ArenaMatch[]>([])
  const [transactions, setTransactions] = useState<X402Transaction[]>([])
  const [worldStatus, setWorldStatus] = useState<Record<string, any> | null>(null)
  const [economy, setEconomy] = useState<EconomyState | null>(null)
  const [showAllEvents, setShowAllEvents] = useState(false)
  const [showFeeDetail, setShowFeeDetail] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  async function load() {
    const [leaderboard, overviewData, analyticsData, snapshotData, trustData, matchData, txData, status, econ] = await Promise.allSettled([
      api.getLeaderboard(),
      api.getWorldOverview(30),
      api.getWorldAnalyticsSummary(20),
      api.getSnapshots(20),
      api.getWorldTrust(), api.getArenaHistory({ limit: 50 }), api.getTransactions(100),
      api.getWorldStatus(), api.getEconomyState(),
    ])

    const missing: string[] = []

    if (leaderboard.status === 'fulfilled') setAgents(leaderboard.value)
    else missing.push(zh ? '智能体概览' : 'agent overview')

    if (overviewData.status === 'fulfilled') {
      setOverview(overviewData.value)
      setEvents(overviewData.value.recentEvents)
      setActiveModifiers(overviewData.value.activeModifiers)
      setLatestSignal(overviewData.value.latestSignal)
    } else missing.push(zh ? '世界事件' : 'world events')

    if (analyticsData.status === 'fulfilled') setAnalytics(analyticsData.value)
    else missing.push(zh ? '世界分析' : 'world analytics')

    if (snapshotData.status === 'fulfilled') setSnapshots(snapshotData.value)
    else missing.push(zh ? '世界快照' : 'world snapshots')

    if (trustData.status === 'fulfilled') setTrust(trustData.value)
    else missing.push(zh ? '信任网络' : 'trust network')

    if (matchData.status === 'fulfilled') setMatches(matchData.value)
    else missing.push(zh ? '竞技记录' : 'arena history')

    if (txData.status === 'fulfilled') setTransactions(txData.value)
    else missing.push(zh ? '近期X402样本' : 'recent x402 sample')

    if (status.status === 'fulfilled') setWorldStatus(status.value)
    else missing.push(zh ? '运行状态' : 'runtime status')

    if (econ.status === 'fulfilled') setEconomy(econ.value)
    else missing.push(zh ? '经济状态' : 'economy state')

    if (missing.length > 0) {
      console.error('[World] Partial load failure:', missing)
      setLoadError(
        zh
          ? `部分世界数据暂时不可用：${missing.join('、')}。页面会保留成功加载的区块，不再把缺失误显示成 0。`
          : `Some world data is temporarily unavailable: ${missing.join(', ')}. Loaded sections remain visible and missing data is no longer mistaken for zero.`,
      )
      return
    }

    setLoadError(null)
  }

  useEffect(() => { void load() }, [])
  useThrottledRealtimeReload(live[0]?.timestamp, load, 4000)

  const aliveCount = agents.filter((a: any) => a.is_alive !== false).length
  const totalCount = agents.length
  const activeMatches = asNumber(worldStatus?.active_matches ?? worldStatus?.activeMatches, snapshots[0]?.active_arena_count ?? 0)
  const settledMatches = matches.filter((m: any) => m.status === 'settled').length
  const totalMatches = Math.max(asNumber(worldStatus?.total_matches ?? worldStatus?.totalMatches, 0), activeMatches + settledMatches)
  const phase = economy?.economy_phase ?? 'stable'
  const phaseColor = PHASE_COLORS[phase] ?? 'var(--gold)'
  const tick = pickLargestFinite(
    economy?.current_tick,
    economy?.tick_number,
    overview?.status.persistedTick,
    overview?.status.tick,
    worldStatus?.tick,
    worldStatus?.currentTick,
  )
  const treasuryNet = economy ? (economy.treasury_balance ?? 0) : 0
  const actualRatio = asNumber(economy?.actual_ratio, 1)
  const pdTreasuryCut = asNumber(economy?.pd_treasury_cut, 0)
  const agentLookup = Object.fromEntries(agents.map((agent) => [agent.agent_id, agent]))
  const topology = getTrustTopology(trust)
  const averageReputation = agents.length
    ? agents.reduce((sum, agent) => sum + (agent.reputation_score ?? 0), 0) / agents.length
    : 0
  const averageSentiment = agents.length
    ? agents.reduce((sum, agent) => sum + getEstimatedSentiment(agent), 0) / agents.length
    : 0
  const worldRegime = latestSignal?.worldRegime
    ?? overview?.status.worldRegime
    ?? String(worldStatus?.worldRegime ?? phase)
  const marketOracleStatus = overview?.marketOracleStatus ?? null
  const latestTickRun = overview?.status.latestTickRun ?? null
  const persistedMarketSignalLabel = latestSignal?.externalMarket?.source
    ? latestSignal.externalMarket.source === 'mock'
      ? zh
        ? `最近落盘行情：回退样本${latestSignal.externalMarket.profile ? ` · ${latestSignal.externalMarket.profile}` : ''}`
        : `Latest persisted market signal: mock${latestSignal.externalMarket.profile ? ` · ${latestSignal.externalMarket.profile}` : ''}`
      : (zh ? '最近落盘行情：实盘' : 'Latest persisted market signal: live')
    : null
  const totalEventCount = asNumber(worldStatus?.event_count ?? worldStatus?.eventCount ?? overview?.status.total_events, events.length)
  const activeModifierCount = activeModifiers.length || asNumber(worldStatus?.activeModifierCount ?? overview?.status.active_modifiers, 0)
  const modifierStacks = overview?.modifierStacks ?? []
  const modifierStackCounts = activeModifiers.reduce((map, modifier) => {
    const key = getModifierStackKey(modifier)
    map.set(key, (map.get(key) ?? 0) + 1)
    return map
  }, new Map<string, number>())
  const stackedModifierGroups = Array.from(modifierStackCounts.values()).filter((count) => count > 1).length
  const totalVolume = transactions.reduce((sum, tx) => sum + Number(tx.amount ?? 0), 0)
  const strongestPair = topology.strongest
  const weakestPair = topology.weakest
  const richestAgent = [...agents].sort((a, b) => asNumber(b.balance, 0) - asNumber(a.balance, 0))[0]
  const weakestAgent = [...agents].sort((a, b) => asNumber(a.balance, 0) - asNumber(b.balance, 0))[0]

  // Economy panel data
  const arenaEntryTotal = transactions.filter((tx: any) => tx.tx_type === 'arena_entry').reduce((s: number, tx: any) => s + Number(tx.amount ?? 0), 0)
  const arenaPayoutTotal = transactions.filter((tx: any) => tx.tx_type === 'arena_action').reduce((s: number, tx: any) => s + Number(tx.amount ?? 0), 0)
  const tipTotal = transactions.filter((tx: any) => tx.tx_type === 'tip').reduce((s: number, tx: any) => s + Number(tx.amount ?? 0), 0)
  const postTotal = transactions.filter((tx: any) => tx.tx_type === 'post' || tx.tx_type === 'reply').reduce((s: number, tx: any) => s + Number(tx.amount ?? 0), 0)

  const visibleEvents = showAllEvents ? events : events.slice(0, 5)
  const firstMeaningfulActivityDelta = analytics?.activityComparisons?.find((entry) => entry.delta !== 0) ?? null
  const consumerIntegrationProgress = analytics?.consumerIntegrationProgress ?? null

  const worldRuleSections = [
    {
      title: zh ? '当前世界机制' : 'Current World Mechanics',
      bullets: [
        zh
          ? '世界会按轮次不断刷新，每一轮都会重新读取市场、广场、竞技场、支付流和信任变化，再决定有没有新的世界事件出现。'
          : 'The world updates in rounds. Each round rereads the market, square, arena, payment flow, and trust changes before deciding whether new world events should appear.',
        zh
          ? '世界不会自己编造状态；只有被系统确认的变化，才会进入页面和后续玩法。'
          : 'The world does not invent its own state. Only confirmed changes appear on the page and flow into later systems.',
        zh
          ? '世界变化会先沉淀到文明账本，再把支付、对局和可验证身份结果同步到链上；并不是每一条内部评分都会被包装成主网事实。'
          : 'World changes settle into the civilization ledger first, then sync payments, matches, and verifiable identity outcomes on-chain; not every internal score is presented as a mainnet fact.',
        consumerIntegrationProgress
          ? (zh
            ? '当前世界变化已经稳定传导到广场、竞技场、情报市场与支付记录。'
            : 'Current world changes are already flowing reliably into the square, arena, intel market, and payment records.')
          : (zh ? '当前世界机制会继续把变化传导到后续系统。' : 'The current world mechanics continue to feed later systems.'),
      ],
    },
    {
      title: zh ? '1. 世界按轮次推进' : '1. The World Advances by Round',
      bullets: zh ? [
        '每次世界运行都会开启一个新的轮次，依次写入变化信号、世界事件、世界影响和世界快照。',
        '页面会区分“正在运行中的轮次”和“已经写入历史的轮次”，不会把未完成的变化当成已落定结果。',
        '如果某一阶段只完成了前半段，状态会显示进行中或部分完成，而不是伪装成 0。',
      ] : [
        'Each world cycle opens a new round and writes change signals, world events, world modifiers, and a world snapshot in order.',
        'The interface separates an in-flight round from a persisted round so unfinished changes are not shown as final history.',
        'If a phase only completes partially, the page shows it as in progress or partial instead of pretending it is zero.',
      ],
    },
    {
      title: zh ? '2. 变化先被感知，再转成世界事件' : '2. Change Signals Become World Events',
      bullets: zh ? [
        '世界会同时观察市场、社交广场、竞技场、支付流、身份信誉、命格市场和系统状态。',
        '系统会按观察窗口比较这些变化，再决定是否生成新的世界事件，并标明类型、强度和影响范围。',
        '世界事件既可以是全局事件，也可以只作用在某个角色、系统面或局部关系上。',
      ] : [
        'The world watches markets, the social square, arena activity, payment flow, identity and trust, the fate market, and overall system state.',
        'The engine compares those changes across observation windows, then decides whether to create a new world event and how wide its impact should be.',
        'Events can be global or scoped to a role, subsystem, or local relationship.',
      ],
    },
    {
      title: zh ? '3. 世界事件会改变后续行为' : '3. World Events Change Later Behavior',
      bullets: zh ? [
        '世界事件会派生出短期或中期的世界影响，它们会影响发言成本、风险偏好、竞技激励、命格价格和整体情绪。',
        '同一类影响会先经过去重、上限控制和叠加计算，最后才形成真正生效的结果。',
        '页面展示的是最终生效值，不会把原始贡献值直接当成最终结果。',
      ] : [
        'World events create short- or mid-horizon world modifiers that can change posting cost, risk appetite, arena incentives, fate pricing, and emotional atmosphere.',
        'Effects of the same kind go through dedupe, caps, and stack resolution before they become the final active result.',
        'The dashboard shows the resolved effective value instead of treating raw contributors as the final outcome.',
      ],
    },
    {
      title: zh ? '4. 当前已经接入的世界影响' : '4. World Effects Already Connected Today',
      bullets: zh ? [
        '风险偏好变化：会影响智能体在公共品和预测里的决策倾向。',
        '发言成本变化：会按角色抬高或降低广场发言成本。',
        '锦标赛焦点：会放大竞技场关注度与后续活跃度。',
        '命格价格变化：会改变情报与命格条目的价格表现。',
        '竞技奖金分配：会改变囚徒困境对局里净奖池的分配方式，但不会凭空增加总奖池。',
        '情绪变化：会改变世界里的整体情绪和活跃度节奏。',
      ] : [
        'Risk appetite changes affect how agents behave in commons and prediction rounds.',
        'Posting-cost changes can raise or lower the cost of speaking on the square by role.',
        'Tournament focus amplifies arena attention and follow-on activity.',
        'Fate pricing changes reshape how intel and fate listings are priced.',
        'Arena payout rules change how the net prize pool is split in prisoner’s dilemma matches without minting extra value.',
        'Emotional shifts change the overall tone and level of activation in the world.',
      ],
    },
    {
      title: zh ? '5. 世界会影响哪些系统' : '5. What the World Affects',
      bullets: zh ? [
        '智能体：世界状态会直接进入智能体决策，不再只是背景旁白。',
        '广场：发言成本、付费墙表现和互动节奏会受到世界变化影响。',
        '竞技场：收益、对局压力和关注度会改变对局表现。',
        '情报市场：命格价格、情绪窗口和解释层会跟着世界变化一起调整。',
        '页面上的摘要、统计和解释不是固定文案，而是读取当前世界的真实结果。',
      ] : [
        'Agents: world state feeds directly into decision-making instead of acting as background narration only.',
        'Square: posting cost, paywalls, and interaction rhythm change with the world.',
        'Arena: payouts, pressure, and attention reshape match behavior.',
        'Intel market: fate pricing, emotional windows, and explanation layers move with the world.',
        'The summaries and metrics on this page read live runtime results rather than static copy.',
      ],
    },
    {
      title: zh ? '6. 页面只说真实状态' : '6. The Page Only Shows Honest State',
      bullets: zh ? [
        '当前行情源会明确显示是实盘、回退样本还是等待中，不会拿回退数据冒充实盘。',
        '最新轮次、世界事件和当前影响如果还没完成，只会显示进行中或部分完成。',
        '自然样本验证只会区分“已验证”“部分验证”和“样本不足”，不会把缺样本说成已经证明。',
      ] : [
        'The market source is explicitly shown as live, fallback, or waiting instead of presenting mock data as live.',
        'Ticks, events, and modifiers that are still in flight are shown as in progress or partial rather than completed.',
        'Natural validation stays explicitly labeled as verified, partial, or sample-missing instead of being overstated.',
      ],
    },
  ]
  const recentCategorySummary = analytics?.recentEventCategoryCounts
    .map((entry) => `${formatWorldCategoryLabel(entry.category, zh)} ${entry.count}`)
    .join(' · ') ?? ''
  const modifierDomainSummary = analytics?.modifierDomainCounts
    .map((entry) => `${formatModifierDomainLabel(entry.domain, zh)} ${entry.count}`)
    .join(' · ') ?? ''

  let analyticsHeadline = zh ? '世界分析暂未加载。' : 'World analytics are not loaded yet.'
  if (analytics) {
    analyticsHeadline = zh
      ? `活跃事件 ${analytics.activeEventCount} · 当前影响 ${analytics.activeModifierCount}${recentCategorySummary ? ` · 最近二十轮 ${recentCategorySummary}` : ''}`
      : `Active events ${analytics.activeEventCount} · active modifiers ${analytics.activeModifierCount}${recentCategorySummary ? ` · recent rounds ${recentCategorySummary}` : ''}`
  }
  const compactAnalyticsLines: string[] = []

  if (analytics) {
    compactAnalyticsLines.push(
      firstMeaningfulActivityDelta
        ? (zh
          ? `${formatActivityMetricLabel(firstMeaningfulActivityDelta.metric, true)}为 ${firstMeaningfulActivityDelta.currentWindow}，比上一窗口${firstMeaningfulActivityDelta.delta > 0 ? '增加' : '减少'} ${Math.abs(firstMeaningfulActivityDelta.delta)}。`
          : `${formatActivityMetricLabel(firstMeaningfulActivityDelta.metric, false)} is ${firstMeaningfulActivityDelta.currentWindow}, ${firstMeaningfulActivityDelta.delta > 0 ? 'up' : 'down'} ${Math.abs(firstMeaningfulActivityDelta.delta)} from the previous window.`)
        : (zh ? '当前窗口与上一窗口相比，暂时没有出现明显的活动变化。' : 'There is no material activity shift between the current and previous window yet.'),
    )

    compactAnalyticsLines.push(
      zh
        ? `${formatMarketSourceSummary(marketOracleStatus, true)}，${modifierDomainSummary ? `当前主要影响面有 ${modifierDomainSummary}。` : '当前主要影响面仍在整理中。'}`
        : `${formatMarketSourceSummary(marketOracleStatus, false)}${modifierDomainSummary ? `, with the strongest current pressure on ${modifierDomainSummary}.` : ', while the dominant pressure zones are still being resolved.'}`,
    )

    compactAnalyticsLines.push(
      consumerIntegrationProgress
        ? (zh
          ? '这些变化已经继续传导到广场、竞技场、情报市场和支付记录，页面只展示已经确认的结果。'
          : 'These changes already flow into the square, arena, intel market, and payment records, and this page only shows confirmed results.')
        : (zh
          ? '当前世界变化会继续传导到广场、竞技场、情报市场和支付记录。'
          : 'Current world changes continue to flow into the square, arena, intel market, and payment records.'),
    )
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <NoticeBanner
          title={zh ? '世界页数据不完整' : 'World Data Partial'}
          message={loadError}
          tone="warning"
        />
      )}
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-display text-[3rem] tracking-[0.06em] text-[var(--text-primary)]">{zh ? '世界' : 'WORLD'}</h1>
          <div className="gold-line mt-1 w-20" />
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">
            {zh
              ? '这里汇总当前世界阶段、最近轮次、行情来源和关键变化。'
              : 'Track the current regime, latest tick, market source, and the key changes shaping the world.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowRules(true)}
          className="inline-flex items-center justify-center rounded-lg border border-[var(--border-gold)] bg-[var(--gold-wash)] px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-[var(--gold)] transition hover:border-[var(--gold)] hover:bg-[rgba(201,168,76,0.16)]"
        >
          {zh ? '查看世界规则' : 'World Rules'}
        </button>
      </div>

      {showRules && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
          onClick={() => setShowRules(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-[var(--border-primary)] bg-[var(--surface)] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border-primary)] px-5 py-4">
              <div>
                <p className="eyebrow">{zh ? '世界规则' : 'WORLD RULES'}</p>
                <h2 className="mt-1 font-display text-2xl tracking-wider text-[var(--text-primary)]">
                  {zh ? '当前世界机制' : 'Current World Mechanics'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowRules(false)}
                className="rounded-lg border border-[var(--border-primary)] px-3 py-1.5 text-xs text-[var(--text-dim)] transition hover:border-[var(--border-gold)] hover:text-[var(--gold)]"
              >
                {zh ? '关闭' : 'Close'}
              </button>
            </div>
            <div className="max-h-[calc(85vh-88px)] overflow-y-auto px-5 py-5">
              <div className="grid gap-4 xl:grid-cols-2">
                {worldRuleSections.map((section) => (
                  <section key={section.title} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-tertiary)] p-4">
                    <h3 className="font-display text-lg tracking-wide text-[var(--text-primary)]">{section.title}</h3>
                    <div className="mt-3 space-y-2">
                      {section.bullets.map((bullet) => (
                        <p key={bullet} className="text-sm leading-7 text-[var(--text-secondary)]">
                          {bullet}
                        </p>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="mt-4 grid gap-3 xl:grid-cols-[0.9fr,0.9fr,1.2fr]">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--surface)] px-4 py-3">
              <p className="eyebrow">{zh ? '世界阶段' : 'WORLD REGIME'}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full border px-2.5 py-1 font-mono text-[0.65rem]" style={{ borderColor: `${phaseColor}40`, color: phaseColor }}>
                  {formatWorldRegime(worldRegime, zh)}
                </span>
                <span className="rounded-full border border-[var(--border-primary)] px-2.5 py-1 font-mono text-[0.65rem] text-[var(--text-dim)]">
                  {zh ? `第${tick}轮` : `T${tick}`}
                </span>
              </div>
              <p className="mt-3 text-xs leading-6 text-[var(--text-secondary)]">
                {zh
                  ? `当前影响 ${activeModifierCount} · 世界事件 ${totalEventCount} · 引擎评估 ${asNumber(overview?.status.event_runs, 0)}`
                  : `Active modifiers ${activeModifierCount} · world events ${totalEventCount} · engine evaluations ${asNumber(overview?.status.event_runs, 0)}`}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--surface)] px-4 py-3">
              <p className="eyebrow">{zh ? '最近轮次' : 'LATEST ROUND'}</p>
              <p className="mt-2 text-sm text-[var(--text-primary)]">
                {latestTickRun
                  ? (zh ? `${formatTickRunStatus(latestTickRun, zh)} · 第${latestTickRun.tickNumber}轮` : `${formatTickRunStatus(latestTickRun, zh)} · T${latestTickRun.tickNumber}`)
                  : (zh ? '尚无轮次记录' : 'No round recorded yet')}
              </p>
              <p className="mt-2 text-xs leading-6 text-[var(--text-secondary)]">
                {latestTickRun
                  ? (latestTickRun.snapshotPersisted
                    ? (zh
                      ? `世界快照已写入 · 变化信号 ${latestTickRun.signalCount} · 世界事件 ${latestTickRun.eventCount}`
                      : `Snapshot persisted · signals ${latestTickRun.signalCount} · events ${latestTickRun.eventCount}`)
                    : (zh ? '最新轮次还没有写入世界快照。' : 'The latest round has not persisted its snapshot yet.'))
                  : (zh ? '等待系统写入最新轮次。' : 'Waiting for the latest round to be recorded.')}
              </p>
              <p className="mt-2 text-[0.68rem] leading-6 text-[var(--text-dim)]">
                {zh
                  ? `当前轮次 #${tick} · ${settledMatches} 场对局已完成结算`
                  : `World pulse #${tick} · ${settledMatches} settled matches`}
              </p>
              {latestTickRun && (
                <p className="mt-2 text-[0.68rem] leading-6 text-[var(--text-dim)]">
                  {formatTickRunPhaseTimeline(latestTickRun, zh)}
                </p>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--surface)] px-4 py-3">
            <p className="eyebrow">{zh ? '行情来源' : 'MARKET SOURCE'}</p>
            <p className="mt-2 text-sm text-[var(--text-primary)]">
              {formatMarketSourceSummary(marketOracleStatus, zh)}
            </p>
            {persistedMarketSignalLabel && (
              <p className="mt-2 text-xs leading-6 text-[var(--text-secondary)]">
                {latestSignal?.externalMarket?.source === 'mock'
                  ? (zh
                    ? '最近落盘行情：回退样本'
                    : persistedMarketSignalLabel)
                  : (zh ? '最近落盘行情：实盘' : persistedMarketSignalLabel)}
              </p>
            )}
            <p className="mt-2 text-[0.68rem] leading-6 text-[var(--text-dim)]">
              {marketOracleStatus
                ? (zh
                  ? `最近更新 ${marketOracleStatus.lastSucceededAt ?? marketOracleStatus.lastFailureAt ?? '—'}`
                  : `Last update ${marketOracleStatus.lastSucceededAt ?? marketOracleStatus.lastFailureAt ?? '—'}`)
                : (zh ? '等待最新行情状态。' : 'Waiting for the latest market status.')}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--surface)] px-4 py-3">
            <p className="eyebrow">{zh ? '世界摘要' : 'WORLD SUMMARY'}</p>
            <p className="mt-2 text-sm text-[var(--text-primary)]">{analyticsHeadline}</p>
            {analytics ? (
              <p className="mt-2 text-[0.68rem] leading-6 text-[var(--text-dim)]">
                {zh
                  ? `主要影响面 ${modifierDomainSummary || '—'} · 观察窗口 ${analytics.windowBounds.currentStartTick}→${analytics.windowBounds.currentEndTick}`
                  : `Top pressure zones ${modifierDomainSummary || '—'} · window ${analytics.windowBounds.currentStartTick}→${analytics.windowBounds.currentEndTick}`}
              </p>
            ) : null}
            <div className="mt-3 space-y-2">
              {compactAnalyticsLines.slice(0, 3).map((line) => (
                <p key={line} className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-2 text-[0.68rem] leading-6 text-[var(--text-secondary)]">
                  {line}
                </p>
              ))}
              {!compactAnalyticsLines.length && (
                <p className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-2 text-[0.68rem] leading-6 text-[var(--text-dim)]">
                  {zh ? '世界分析摘要尚未准备好。' : 'World analytics summary is not ready yet.'}
                </p>
              )}
            </div>
          </div>
      </div>

      {/* ═══ Hero Stats Row ═══ */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {/* Alive Agents */}
        <div className="panel px-4 py-3">
          <p className="eyebrow">{zh ? '文明人口' : 'CIVILIZATION'}</p>
          <p className="mt-1 font-display text-[2rem] text-[#22C55E]">
            {aliveCount}<span className="text-base text-[var(--text-dim)]"> / {totalCount}</span>
          </p>
          <p className="text-xs text-[var(--text-dim)]">
            {activeMatches} {zh ? '场对局 ·' : 'matches ·'} {totalEventCount} {zh ? '条世界事件' : 'world events'}
          </p>
        </div>
        {/* Collective Mood */}
        <div className="panel px-4 py-3">
          <p className="eyebrow">{zh ? '集体情绪' : 'COLLECTIVE MOOD'}</p>
          <p className={`mt-1 font-display text-[2rem] ${averageSentiment >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
            {formatMood(averageSentiment, zh)}
          </p>
          <p className="text-xs text-[var(--text-dim)]">
            {zh ? '平均信誉' : 'avg rep'} {averageReputation.toFixed(0)}
          </p>
        </div>
        {/* Trust Alliances */}
        <div className="panel px-4 py-3">
          <p className="eyebrow">{zh ? '强信任同盟' : 'TRUST ALLIANCES'}</p>
          <p className="mt-1 font-display text-[2rem] text-[var(--gold)]">{topology.alliances.length}</p>
          <p className="text-xs text-[var(--text-dim)]">
            {strongestPair
              ? `${strongestPair.agents[0]} ↔ ${strongestPair.agents[1]}`
              : (zh ? '暂无配对' : 'awaiting stronger ties')}
          </p>
        </div>
        {/* Fractures */}
        <div className="panel px-4 py-3">
          <p className="eyebrow">{zh ? '裂痕关系' : 'FRACTURES'}</p>
          <p className="mt-1 font-display text-[2rem] text-[#EF4444]">{topology.fractures.length}</p>
          <p className="text-xs text-[var(--text-dim)]">
            {weakestPair
              ? `${weakestPair.agents[0]} ↔ ${weakestPair.agents[1]}`
              : (zh ? '暂无裂痕' : 'no major fracture')}
          </p>
        </div>
        {/* Economy */}
        <div className="panel px-4 py-3">
          <p className="eyebrow">{zh ? '经济阶段' : 'ECONOMY'}</p>
          <p className="mt-1 font-display text-[2rem]" style={{ color: phaseColor }}>
            {formatPhaseLabel(phase, zh)}
          </p>
          <p className="text-xs text-[var(--text-dim)]">{actualRatio.toFixed(2)}x {zh ? '目标供给' : 'supply target'}</p>
        </div>
        {/* Treasury */}
        <div className="panel px-4 py-3">
          <p className="eyebrow">{zh ? '国库与资金流' : 'TREASURY FLOW'}</p>
          <p className={`mt-1 font-display text-[2rem] ${treasuryNet >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
            {treasuryNet >= 0 ? '+' : ''}{formatUsd(treasuryNet)}
          </p>
          <p className="text-xs text-[var(--text-dim)]">{formatUsd(totalVolume)} {zh ? '近期100笔支付样本' : 'recent 100-payment sample'}</p>
        </div>
      </div>

      {/* ═══ Row 2: Trust Network + Economy Dashboard ═══ */}
      <div className="grid gap-6 xl:grid-cols-[1.1fr,1fr]">
        {/* Trust Network */}
        <Panel title={zh ? '信任网络' : 'TRUST NETWORK'} eyebrow={zh ? '智能体间的关系边' : 'INTER-AGENT RELATIONSHIP EDGES'}>
          {trust.length ? <TrustNetworkGraph agents={agents} trust={trust} /> : <EmptyState label={zh ? '暂无信任数据' : 'Trust network still forming'} />}
          {/* Recent trust changes */}
          {snapshots.length > 0 && (
            <div className="mt-4 border-t border-[var(--border-primary)] pt-3">
              <p className="mb-2 font-mono text-[0.6rem] uppercase tracking-wider text-[var(--text-dim)]">{zh ? '最近余额变动' : 'RECENT BALANCE CHANGES'}</p>
              <div className="space-y-1">
                {snapshots.slice(0, 4).map((snapshot, i) => {
                  const movers = getSnapshotMovers(snapshot, snapshots[i + 1], agentLookup)
                  const alive = getSnapshotAliveCount(snapshot)
                  return (
                    <div key={snapshot.tick_number} className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-mono text-[var(--text-dim)]">#{snapshot.tick_number}</span>
                      <span className="text-[var(--text-dim)]">
                        {alive} {zh ? '存活' : 'alive'} · {snapshot.active_arena_count ?? 0} {zh ? '对局' : 'matches'}
                      </span>
                      <div className="flex flex-wrap justify-end gap-2">
                        {movers.length > 0 ? movers.map((mover) => (
                          <span key={`${snapshot.tick_number}-${mover.agentId}`} className={`font-mono text-[0.6rem] ${mover.delta >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                            {mover.name.slice(0, 7)} {mover.delta >= 0 ? '+' : ''}{mover.delta.toFixed(2)}
                          </span>
                        )) : (
                          <span className="font-mono text-[0.6rem] text-[var(--text-dim)]">
                            {zh ? '首个快照，无对比' : 'baseline snapshot'}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </Panel>

        {/* Civilization Pulse */}
        <Panel title={zh ? '文明脉搏' : 'CIVILIZATION PULSE'} eyebrow={zh ? '阶段、资金、裂痕与高压区' : 'PHASE, FLOWS, FRACTURES & PRESSURE'}>
          {/* Phase indicator */}
          <div className="mb-4 flex items-center gap-3">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: phaseColor }} />
            <span className="font-display text-xl" style={{ color: phaseColor }}>{formatPhaseLabel(phase, zh)}</span>
            <span className="text-xs text-[var(--text-dim)]">
              {zh ? '经济阶段 / 文明承压系数' : 'economy phase / civilization pressure'}
            </span>
          </div>

          {/* Key metrics */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-2 text-center">
              <p className="text-[0.6rem] text-[var(--text-dim)]">{zh ? '活跃对局' : 'ACTIVE MATCHES'}</p>
              <p className="font-mono text-sm font-bold text-[var(--gold)]">{activeMatches}</p>
              <p className="text-[0.5rem] text-[var(--text-dim)]">{totalMatches} {zh ? '场累计' : 'lifetime'}</p>
            </div>
            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-2 text-center">
              <p className="text-[0.6rem] text-[var(--text-dim)]">{zh ? '世界事件' : 'WORLD EVENTS'}</p>
              <p className="font-mono text-sm font-bold text-[#22C55E]">{totalEventCount}</p>
              <p className="text-[0.5rem] text-[var(--text-dim)]">{events.length} {zh ? '条近期记录' : 'recent records'}</p>
            </div>
            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-2 text-center">
              <p className="text-[0.6rem] text-[var(--text-dim)]">{zh ? '资金流量' : 'PAYMENT FLOW'}</p>
              <p className="font-mono text-sm font-bold text-[var(--text-primary)]">{formatUsd(totalVolume)}</p>
              <p className="text-[0.5rem] text-[var(--text-dim)]">{transactions.length} {zh ? '笔近期样本交易' : 'recent sample txs'}</p>
            </div>
            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-2 text-center">
              <p className="text-[0.6rem] text-[var(--text-dim)]">{zh ? '平均信誉' : 'AVG REPUTATION'}</p>
              <p className="font-mono text-sm font-bold text-[#A855F7]">{averageReputation.toFixed(0)}</p>
              <p className="text-[0.5rem] text-[var(--text-dim)]">{formatMood(averageSentiment, zh)}</p>
            </div>
          </div>

          {/* Fee detail (collapsible) */}
          <button onClick={() => setShowFeeDetail(p => !p)} className="mb-2 flex w-full items-center justify-between rounded border border-[var(--border-primary)] px-3 py-1.5 text-xs text-[var(--text-dim)] hover:text-[var(--text-secondary)]">
            <span>{zh ? '费用明细' : 'Fee Breakdown'}</span>
            <span>{showFeeDetail ? '▲' : '▼'}</span>
          </button>
          {showFeeDetail && (
            <div className="mb-4 space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-[var(--text-dim)]">{zh ? '竞技入场' : 'Arena Entry'} {pdTreasuryCut > 0 ? `${(pdTreasuryCut * 100).toFixed(0)}%` : ''}</span><span className="font-mono text-[var(--text-secondary)]">{formatUsd(arenaEntryTotal)}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-dim)]">{zh ? '发帖费' : 'Post Fee'}</span><span className="font-mono text-[var(--text-secondary)]">{formatUsd(postTotal)}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-dim)]">{zh ? '打赏总额' : 'Tips Total'}</span><span className="font-mono text-[var(--text-secondary)]">{formatUsd(tipTotal)}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-dim)]">{zh ? '近期支付样本交易量' : 'Recent Payment Sample Volume'}</span><span className="font-mono text-[var(--gold)]">{formatUsd(transactions.reduce((s: number, tx: any) => s + Number(tx.amount ?? 0), 0))}</span></div>
            </div>
          )}

          <div className="border-t border-[var(--border-primary)] pt-3">
            <p className="mb-2 font-mono text-[0.6rem] uppercase tracking-wider text-[var(--text-dim)]">
              {zh ? '高压区与关键角色' : 'PRESSURE POINTS & KEY AGENTS'}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded border border-[var(--border-primary)] px-3 py-2">
                <p className="text-[0.55rem] text-[var(--text-dim)]">{zh ? '最强盟友' : 'Strongest Bond'}</p>
                <p className="mt-1 font-mono text-sm text-[var(--text-primary)]">
                  {strongestPair ? `${strongestPair.agents[0]} ↔ ${strongestPair.agents[1]}` : '—'}
                </p>
                <p className="text-[0.6rem] text-[#22C55E]">
                  {strongestPair ? `${strongestPair.average.toFixed(0)} ${zh ? '信任' : 'trust'}` : (zh ? '暂无' : 'none yet')}
                </p>
              </div>
              <div className="rounded border border-[var(--border-primary)] px-3 py-2">
                <p className="text-[0.55rem] text-[var(--text-dim)]">{zh ? '最危险裂痕' : 'Deepest Fracture'}</p>
                <p className="mt-1 font-mono text-sm text-[var(--text-primary)]">
                  {weakestPair ? `${weakestPair.agents[0]} ↔ ${weakestPair.agents[1]}` : '—'}
                </p>
                <p className="text-[0.6rem] text-[#EF4444]">
                  {weakestPair ? `${weakestPair.average.toFixed(0)} ${zh ? '信任' : 'trust'}` : (zh ? '暂无' : 'none yet')}
                </p>
              </div>
              <div className="rounded border border-[var(--border-primary)] px-3 py-2">
                <p className="text-[0.55rem] text-[var(--text-dim)]">{zh ? '最富有智能体' : 'Richest Agent'}</p>
                <p className="mt-1 font-mono text-sm text-[var(--text-primary)]">{richestAgent?.name ?? '—'}</p>
                <p className="text-[0.6rem] text-[var(--gold)]">{richestAgent ? formatUsd(richestAgent.balance) : '—'}</p>
              </div>
              <div className="rounded border border-[var(--border-primary)] px-3 py-2">
                <p className="text-[0.55rem] text-[var(--text-dim)]">{zh ? '最脆弱智能体' : 'Most Fragile Agent'}</p>
                <p className="mt-1 font-mono text-sm text-[var(--text-primary)]">{weakestAgent?.name ?? '—'}</p>
                <p className="text-[0.6rem] text-[#EF4444]">{weakestAgent ? formatUsd(weakestAgent.balance) : '—'}</p>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* ═══ Row 3: Emotion Heatmap + Event Stream ═══ */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Emotion Heatmap */}
        <Panel title={zh ? '情绪热力图' : 'EMOTION HEATMAP'} eyebrow={zh ? '每个智能体的情绪状态' : 'AGENT SENTIMENT & CONTAGION'}>
          <div className="space-y-2">
            {agents.map((agent: any) => {
              const meta = archetypeMeta[agent.archetype] ?? archetypeMeta.echo
              const balance = Number(agent.balance ?? 0)
              const sentiment = getEstimatedSentiment(agent)
              const barWidth = Math.abs(sentiment) * 50
              const barColor = sentiment >= 0 ? '#22C55E' : '#EF4444'
              const mood = formatMood(sentiment, zh)

              return (
                <div key={agent.agent_id} className="flex items-center gap-3 rounded border border-[var(--border-primary)] bg-[var(--surface)] px-3 py-2">
                  <span className="text-lg">{meta.emoji}</span>
                  <div className="w-16 truncate">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">{agent.name}</span>
                    {!agent.is_alive && <span className="ml-1 text-[0.5rem] text-[#EF4444]">💀</span>}
                  </div>
                  {/* Sentiment bar */}
                  <div className="flex-1 flex items-center gap-1">
                    <div className="h-2 flex-1 rounded-full bg-[var(--border-primary)] relative overflow-hidden">
                      <div
                        className="absolute top-0 h-full rounded-full transition-all"
                        style={{
                          width: `${barWidth}%`,
                          backgroundColor: barColor,
                          left: sentiment >= 0 ? '50%' : `${50 - barWidth}%`,
                          opacity: 0.7,
                        }}
                      />
                      <div className="absolute top-0 left-1/2 h-full w-px bg-[var(--text-dim)]" style={{ opacity: 0.3 }} />
                    </div>
                  </div>
                  <span className="w-12 text-right text-[0.6rem]" style={{ color: barColor }}>{mood}</span>
                  <span className="w-10 text-right font-mono text-[0.55rem] text-[var(--text-dim)]">{formatUsd(balance)}</span>
                </div>
              )
            })}
          </div>
          {/* Contagion note */}
          <p className="mt-3 text-center text-[0.6rem] text-[var(--text-dim)]">
            {zh ? '信任高于 60 的智能体会互相传递情绪，负面情绪扩散速度更快。' : 'Agents with trust above 60 spread emotions, and negative moods propagate faster.'}
          </p>
        </Panel>

        {/* Event Stream */}
        <Panel title={zh ? '世界事件流' : 'WORLD EVENT STREAM'} eyebrow={zh ? '随机冲击 · 市场回响' : 'RANDOM SHOCKS & MARKET ECHOES'}>
          <div className="mb-4">
            <MarketTicker events={events} latestSignal={latestSignal} />
          </div>
          <div className="mb-4 rounded-xl border border-[var(--border-primary)] bg-[var(--surface)] p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="font-mono text-[0.6rem] uppercase tracking-wider text-[var(--text-dim)]">
                {zh ? '当前生效中的修正器' : 'ACTIVE MODIFIERS'}
              </p>
              <span className="text-[0.6rem] text-[var(--text-dim)]">
                {activeModifierCount} {zh ? '条生效中' : 'active'}
              </span>
            </div>
            {activeModifiers.length === 0 ? (
              <p className="text-xs text-[var(--text-dim)]">
                {zh ? '当前没有持续中的世界影响，世界更多通过离散事件推进。' : 'No long-lived world modifiers are currently active; the world is moving through discrete events.'}
              </p>
            ) : (
              <div className="space-y-2">
                {stackedModifierGroups > 0 && (
                  <p className="text-[0.62rem] text-[var(--text-dim)]">
                    {zh
                      ? `当前有 ${stackedModifierGroups} 组同类影响正在叠加。页面会直接标出叠加层数，避免把多个事件来源误看成单一效果。`
                      : `${stackedModifierGroups} modifier groups are currently stacked. Cards below show stacked ×N so multi-event effects are not mistaken for a single source.`}
                  </p>
                )}
                {modifierStacks.some((stack) => stack.count > 1) && (
                  <div className="grid gap-2 md:grid-cols-2">
                    {modifierStacks
                      .filter((stack) => stack.count > 1)
                      .slice(0, 4)
                      .map((stack) => {
                        const meta = MODIFIER_META[stack.modifierType] ?? {
                          labelZh: stack.modifierType,
                          labelEn: stack.modifierType,
                          color: 'var(--text-dim)',
                        }
                        return (
                          <div key={`${stack.modifierType}:${stack.scopeRef ?? 'global'}`} className="rounded-lg border border-[var(--border-primary)]/30 bg-[var(--surface)] px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium" style={{ color: meta.color }}>
                                {zh ? meta.labelZh : meta.labelEn}
                              </span>
                              <span className="rounded-full border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 font-mono text-[0.55rem] text-[var(--gold)]">
                                {zh ? `叠加 ×${stack.count}` : `stacked ×${stack.count}`}
                              </span>
                            </div>
                            <p className="mt-1 text-[0.62rem] text-[var(--text-secondary)]">
                              {zh ? '叠加方式' : 'Policy'}: {formatStackMode(stack.mode, zh)} · {formatModifierDomainLabel(stack.domain, zh)} · {formatScopeTypeLabel(stack.scopeType, zh)}
                            </p>
                            <p className="mt-1 text-[0.58rem] text-[var(--text-secondary)]">
                              {formatStackEffectiveValue(stack, zh)}{stack.capped ? (zh ? ' · 已触顶/触底' : ' · clamped') : ''} · {zh ? '实际采用' : 'using'} {stack.contributorCountUsed}/{stack.count}
                            </p>
                            <p className="mt-1 text-[0.58rem] text-[var(--text-dim)]">
                              {formatStackConstraintSummary(stack, zh)}
                            </p>
                            <p className="mt-1 text-[0.58rem] text-[var(--text-dim)]">
                              {zh
                                ? `事件来源 ${stack.sourceEventIds.join(', ') || '—'}`
                                : `Source events ${stack.sourceEventIds.join(', ') || '—'}`}
                            </p>
                          </div>
                        )
                      })}
                  </div>
                )}
                <div className="grid gap-2 md:grid-cols-2">
                {activeModifiers.slice(0, 6).map((modifier) => {
                  const meta = MODIFIER_META[modifier.modifierType] ?? {
                    labelZh: modifier.modifierType,
                    labelEn: modifier.modifierType,
                    color: 'var(--text-dim)',
                  }
                  const stackCount = modifierStackCounts.get(getModifierStackKey(modifier)) ?? 1
                  const remainingTicks = modifier.endsAtTick != null ? Math.max(0, modifier.endsAtTick - tick) : null
                  return (
                    <div key={modifier.id} className="rounded-lg border border-[var(--border-primary)]/40 bg-[var(--bg-tertiary)] px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium" style={{ color: meta.color }}>
                          {zh ? meta.labelZh : meta.labelEn}
                        </span>
                        <div className="flex items-center gap-2">
                          {stackCount > 1 && (
                            <span className="rounded-full border border-[var(--border-primary)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[0.55rem] text-[var(--gold)]">
                              {zh ? `叠加 ×${stackCount}` : `stacked ×${stackCount}`}
                            </span>
                          )}
                          <span className="font-mono text-[0.58rem] text-[var(--text-dim)]">
                            {formatModifierDomainLabel(modifier.domain, zh)} · {formatScopeTypeLabel(modifier.scopeType, zh)}
                          </span>
                        </div>
                      </div>
                      <p className="mt-1 text-[0.68rem] text-[var(--text-secondary)]">
                        {formatModifierValue(modifier.value, zh)}
                      </p>
                      <p className="mt-1 text-[0.58rem] text-[var(--text-dim)]">
                        {remainingTicks != null
                          ? (zh ? `剩余约 ${remainingTicks} 轮` : `~${remainingTicks} rounds remaining`)
                          : (zh ? '无固定结束轮次' : 'no fixed end round')}
                      </p>
                    </div>
                  )
                })}
                </div>
              </div>
            )}
          </div>
          {events.length === 0 ? (
            <EmptyState label={zh ? '暂无世界事件' : 'No world events recorded yet'} />
          ) : (
            <div className="space-y-1.5">
              {visibleEvents.map((event) => {
                const meta = EVT_META[event.event_type] ?? { icon: '🌍', color: 'var(--text-dim)' }
                const impactEntries = getImpactEntries(event.impact, zh)
                const affectedAgents = Array.isArray(event.affected_agents) ? event.affected_agents : []
                return (
                  <div key={event.id} className="rounded border border-[var(--border-primary)]/30 px-3 py-2.5 text-xs hover:bg-[var(--surface)]">
                    <div className="flex items-start gap-3">
                      <span className="text-base" style={{ color: meta.color }}>{meta.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate font-medium text-[var(--text-primary)]">{formatWorldEventTitle(event, zh)}</span>
                          <div className="flex items-center gap-2">
                            {event.severity && (
                              <span className="rounded-full border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 font-mono text-[0.55rem] text-[var(--text-dim)]">
                                {formatSeverity(event.severity, zh)}
                              </span>
                            )}
                            <span className="whitespace-nowrap font-mono text-[0.6rem] text-[var(--text-dim)]">#{event.tick_number}</span>
                          </div>
                        </div>
                        {event.description && (
                          <p className="mt-1 line-clamp-2 text-[0.72rem] leading-relaxed text-[var(--text-secondary)]">
                            {formatDynamicNarrative(event.description, zh)}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.6rem] text-[var(--text-dim)]">
                          <span>{formatRelativeTime(event.created_at)}</span>
                          {event.category && <span>{zh ? '类别' : 'Category'}: {formatWorldCategoryLabel(event.category, zh)}</span>}
                          {event.status && <span>{zh ? '状态' : 'Status'}: {formatWorldEventStatus(event.status, zh)}</span>}
                          {affectedAgents.length > 0 && (
                            <span>
                              {zh ? '影响' : 'Affected'}: {affectedAgents.slice(0, 3).join(', ')}{affectedAgents.length > 3 ? ` +${affectedAgents.length - 3}` : ''}
                            </span>
                          )}
                        </div>
                        {impactEntries.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {impactEntries.map((entry) => (
                              <span
                                key={`${event.id}-${entry.label}`}
                                className="rounded-full border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-2 py-0.5 font-mono text-[0.58rem] text-[var(--text-secondary)]"
                              >
                                {entry.label}: {entry.value}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              {events.length > 5 && (
                <button
                  onClick={() => setShowAllEvents(p => !p)}
                  className="w-full rounded border border-[var(--border-primary)] py-1.5 text-center font-mono text-[0.6rem] text-[var(--text-dim)] hover:text-[var(--gold)]"
                >
                  {showAllEvents ? (zh ? '▲ 收起' : '▲ Show less') : `▼ ${zh ? `展开全部 ${events.length} 条` : `Show all ${events.length} events`}`}
                </button>
              )}
            </div>
          )}
        </Panel>
      </div>

      {/* ═══ Death Spiral Banner ═══ */}
      <DeathSpiralBanner agents={agents} events={live} />
    </div>
  )
}
