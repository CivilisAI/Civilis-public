'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api, Agent, AgentCommerceSummary, AgentDecisionTrace, AgentReputationViewResponse, AgentValidationViewResponse, AgentWorldContext, AgentWorldExposure, ArenaMatch, FeedPost, TrustRelation, X402Transaction, FateKnowledgeMap, IntelCreditScoreRow, PredictionAgentStats } from '@/lib/api'
import { useRealtimeFeed, useThrottledRealtimeReload } from '@/lib/socket'
import { EmptyState, NoticeBanner, Panel, AgentChip, archetypeMeta, formatRelativeTime, formatShortDate, formatUsd } from '@/components/CivilisPrimitives'
import { useI18n } from '@/lib/i18n/index'
import { formatDynamicNarrative } from '@/lib/dynamic-text'
import { AgentStrategyBadge } from '@/components/AgentStrategyBadge'
import { ChainStandardBadge } from '@/components/ChainStandardBadge'
import { OutcomeBadge } from '@/components/OutcomeBadge'
import { WuxingRadar } from '@/components/WuxingRadar'
import { TrustNetworkGraph } from '@/components/TrustNetworkGraph'

const ARCHETYPE_LABELS: Record<string, { zh: string; en: string; tag: string }> = {
  oracle: { zh: '先知', en: 'Oracle', tag: 'ORACLE' },
  hawk: { zh: '鹰', en: 'Hawk', tag: 'HAWK' },
  sage: { zh: '圣贤', en: 'Sage', tag: 'SAGE' },
  fox: { zh: '狐狸', en: 'Fox', tag: 'FOX' },
  chaos: { zh: '混沌', en: 'Chaos', tag: 'CHAOS' },
  whale: { zh: '鲸鱼', en: 'Whale', tag: 'WHALE' },
  monk: { zh: '僧侣', en: 'Monk', tag: 'MONK' },
  echo: { zh: '回声', en: 'Echo', tag: 'ECHO' },
}

const NEGOTIATION_STYLE_LABELS: Record<string, { zh: string; en: string }> = {
  analytical: { zh: '分析型', en: 'Analytical' },
  data_driven: { zh: '数据驱动', en: 'Data-Driven' },
  aggressive: { zh: '强攻型', en: 'Aggressive' },
  threatening: { zh: '威压型', en: 'Threatening' },
  principled: { zh: '原则型', en: 'Principled' },
  peaceful: { zh: '和平型', en: 'Peaceful' },
  charming: { zh: '游说型', en: 'Charming' },
  unpredictable: { zh: '不可预测', en: 'Unpredictable' },
  nonsense: { zh: '混沌扰动', en: 'Chaotic' },
  dominating: { zh: '支配型', en: 'Dominating' },
  silent: { zh: '沉默威压', en: 'Silent Pressure' },
  zen: { zh: '克制型', en: 'Zen' },
  mimicking: { zh: '模仿型', en: 'Mimicking' },
}

const MECHANIC_TRIGGER_LABELS: Record<string, { zh: string; en: string }> = {
  always_active: { zh: '持续生效', en: 'Always Active' },
  every_20_ticks: { zh: '每 20 轮触发', en: 'Every 20 Rounds' },
  every_10_ticks: { zh: '每 10 轮触发', en: 'Every 10 Rounds' },
  on_post: { zh: '发言时触发', en: 'On Post' },
  in_negotiation: { zh: '谈判时触发', en: 'During Negotiation' },
  opponent_weak: { zh: '面对弱势对手时', en: 'Against a Weaker Opponent' },
  after_CC_outcome: { zh: '双方合作后', en: 'After Mutual Cooperation' },
  when_betrayed: { zh: '被背叛后', en: 'After Betrayal' },
  on_tip: { zh: '打赏时触发', en: 'On Tip' },
  has_purchased_intel: { zh: '买入情报后', en: 'After Buying Intel' },
  trust_gt_70: { zh: '信任高于 70 时', en: 'When Trust Exceeds 70' },
  on_paywall_post: { zh: '发布付费内容时', en: 'On Paywall Post' },
  enlightenment_conditions: { zh: '满足开悟条件后', en: 'After Enlightenment Conditions' },
  opponent_knows_balance: { zh: '对手知晓余额时', en: 'When the Opponent Knows the Balance' },
  on_rolemodel_change: { zh: '榜样更换时', en: 'When the Role Model Changes' },
  echo_count_same_strategy: { zh: '多个回声采取同策时', en: 'When Multiple Echoes Share One Strategy' },
}

const REGISTRATION_MODE_LABELS: Record<string, { zh: string; en: string }> = {
  owner_mint_required: { zh: '正式身份档案', en: 'Registered Identity' },
  mock: { zh: '暂未启用', en: 'Not Activated' },
  unknown: { zh: '等待写入', en: 'Pending' },
}

const ZODIAC_LABELS: Record<string, {
  zh: string
  en: string
  elementZh: string
  elementEn: string
  modalityZh: string
  modalityEn: string
}> = {
  Aries: { zh: '白羊座', en: 'Aries', elementZh: '火象', elementEn: 'Fire', modalityZh: '开创', modalityEn: 'Cardinal' },
  Taurus: { zh: '金牛座', en: 'Taurus', elementZh: '土象', elementEn: 'Earth', modalityZh: '固定', modalityEn: 'Fixed' },
  Gemini: { zh: '双子座', en: 'Gemini', elementZh: '风象', elementEn: 'Air', modalityZh: '变动', modalityEn: 'Mutable' },
  Cancer: { zh: '巨蟹座', en: 'Cancer', elementZh: '水象', elementEn: 'Water', modalityZh: '开创', modalityEn: 'Cardinal' },
  Leo: { zh: '狮子座', en: 'Leo', elementZh: '火象', elementEn: 'Fire', modalityZh: '固定', modalityEn: 'Fixed' },
  Virgo: { zh: '处女座', en: 'Virgo', elementZh: '土象', elementEn: 'Earth', modalityZh: '变动', modalityEn: 'Mutable' },
  Libra: { zh: '天秤座', en: 'Libra', elementZh: '风象', elementEn: 'Air', modalityZh: '开创', modalityEn: 'Cardinal' },
  Scorpio: { zh: '天蝎座', en: 'Scorpio', elementZh: '水象', elementEn: 'Water', modalityZh: '固定', modalityEn: 'Fixed' },
  Sagittarius: { zh: '射手座', en: 'Sagittarius', elementZh: '火象', elementEn: 'Fire', modalityZh: '变动', modalityEn: 'Mutable' },
  Capricorn: { zh: '摩羯座', en: 'Capricorn', elementZh: '土象', elementEn: 'Earth', modalityZh: '开创', modalityEn: 'Cardinal' },
  Aquarius: { zh: '水瓶座', en: 'Aquarius', elementZh: '风象', elementEn: 'Air', modalityZh: '固定', modalityEn: 'Fixed' },
  Pisces: { zh: '双鱼座', en: 'Pisces', elementZh: '水象', elementEn: 'Water', modalityZh: '变动', modalityEn: 'Mutable' },
}

const TAROT_LABELS: Record<string, { zh: string; en: string }> = {
  'The Fool': { zh: '愚者', en: 'The Fool' },
  'The Magician': { zh: '魔术师', en: 'The Magician' },
  'The High Priestess': { zh: '女祭司', en: 'The High Priestess' },
  'The Empress': { zh: '女皇', en: 'The Empress' },
  'The Emperor': { zh: '皇帝', en: 'The Emperor' },
  'The Hierophant': { zh: '教皇', en: 'The Hierophant' },
  'The Lovers': { zh: '恋人', en: 'The Lovers' },
  'The Chariot': { zh: '战车', en: 'The Chariot' },
  Strength: { zh: '力量', en: 'Strength' },
  'The Hermit': { zh: '隐者', en: 'The Hermit' },
  'Wheel of Fortune': { zh: '命运之轮', en: 'Wheel of Fortune' },
  Justice: { zh: '正义', en: 'Justice' },
  'The Hanged Man': { zh: '倒吊人', en: 'The Hanged Man' },
  Death: { zh: '死神', en: 'Death' },
  Temperance: { zh: '节制', en: 'Temperance' },
  'The Devil': { zh: '恶魔', en: 'The Devil' },
  'The Tower': { zh: '高塔', en: 'The Tower' },
  'The Star': { zh: '星星', en: 'The Star' },
  'The Moon': { zh: '月亮', en: 'The Moon' },
  'The Sun': { zh: '太阳', en: 'The Sun' },
  Judgement: { zh: '审判', en: 'Judgement' },
  'The World': { zh: '世界', en: 'The World' },
}

const WORLD_REGIME_LABELS: Record<string, { zh: string; en: string }> = {
  stable: { zh: '稳定', en: 'Stable' },
  boom: { zh: '繁荣', en: 'Boom' },
  recession: { zh: '衰退', en: 'Recession' },
  crisis: { zh: '危机', en: 'Crisis' },
}

const WORLD_DOMAIN_LABELS: Record<string, { zh: string; en: string }> = {
  agent_decision: { zh: '智能体决策', en: 'Agent Decisions' },
  social: { zh: '广场互动', en: 'Square Activity' },
  arena: { zh: '竞技场', en: 'Arena' },
  intel: { zh: '情报市场', en: 'Intel Market' },
  commons: { zh: '公共品', en: 'Commons' },
  prediction: { zh: '预测市场', en: 'Prediction Market' },
  market: { zh: '市场', en: 'Market' },
  system: { zh: '系统', en: 'System' },
  governance: { zh: '治理', en: 'Governance' },
}

const WORLD_MODIFIER_LABELS: Record<string, { zh: string; en: string }> = {
  social_post_cost_multiplier: { zh: '发言成本', en: 'Posting Cost' },
  risk_tolerance_shift: { zh: '风险偏好', en: 'Risk Shift' },
  divination_price_multiplier: { zh: '命格定价', en: 'Fate Pricing' },
  pd_payout_multiplier: { zh: '竞技奖金分配', en: 'Arena Payout' },
  commons_multiplier_bonus: { zh: '公共品乘数', en: 'Commons Multiplier' },
  prediction_odds_bonus: { zh: '预测赔率', en: 'Prediction Odds' },
  commons_base_injection_override: { zh: '公共品底注', en: 'Commons Injection' },
  forced_match_pressure: { zh: '强制竞技压力', en: 'Forced Match Pressure' },
  valence_shift: { zh: '情绪值变化', en: 'Valence Shift' },
  arousal_shift: { zh: '激活度变化', en: 'Arousal Shift' },
  commons_coop_override: { zh: '合作倾向', en: 'Cooperation Override' },
  tournament_attention: { zh: '锦标赛焦点', en: 'Tournament Focus' },
}

const WORLD_EVENT_CATEGORY_LABELS: Record<string, { zh: string; en: string }> = {
  market: { zh: '市场', en: 'Market' },
  system: { zh: '系统', en: 'System' },
  governance: { zh: '治理', en: 'Governance' },
  intel: { zh: '情报', en: 'Intel' },
  social: { zh: '广场', en: 'Square' },
  arena: { zh: '竞技场', en: 'Arena' },
  commons: { zh: '公共品', en: 'Commons' },
  prediction: { zh: '预测', en: 'Prediction' },
}

const WORLD_SEVERITY_LABELS: Record<string, { zh: string; en: string }> = {
  critical: { zh: '高危', en: 'Critical' },
  major: { zh: '主要', en: 'Major' },
  info: { zh: '信息', en: 'Info' },
}

const WORLD_STATUS_LABELS: Record<string, { zh: string; en: string }> = {
  active: { zh: '生效中', en: 'Active' },
  pending: { zh: '待生效', en: 'Pending' },
  resolved: { zh: '已结束', en: 'Resolved' },
  expired: { zh: '已过期', en: 'Expired' },
  cancelled: { zh: '已取消', en: 'Cancelled' },
}

const WORLD_STACK_MODE_LABELS: Record<string, { zh: string; en: string }> = {
  additive: { zh: '叠加求和', en: 'Additive' },
  multiplicative: { zh: '乘法叠加', en: 'Multiplicative' },
  boolean_any: { zh: '任一启用', en: 'Boolean Any' },
  latest_numeric: { zh: '最新值覆盖', en: 'Latest Value' },
}

const AGENT_PROFILE_EN_TEXT: Record<string, string> = {
  '依赖记忆和预测的信息型agent': 'An information-driven archetype that relies on memory and prediction.',
  '好斗、零和思维的掠夺者': 'A predatory archetype built on aggression and zero-sum thinking.',
  '始终合作的道德主义者': 'A moralist archetype that defaults to cooperation.',
  '关系投资型策略家': 'A strategist who invests in relationships and turns trust into leverage.',
  '完全随机决策者': 'A fully random decision-maker.',
  '财富碾压型agent': 'A wealth-heavy archetype that pressures others through capital.',
  '低欲望高防御的修行者': 'A restrained archetype with low desire and high defensive discipline.',
  '模仿最成功策略的跟风者': 'A follower archetype that mirrors the most successful strategy on the board.',
  '记忆检索权重×1.5': 'Memory retrieval weight is multiplied by 1.5.',
  '每20tick 30%概率发预言帖，曝光×2': 'Every 20 rounds there is a 30% chance of a prophecy post, with doubled exposure.',
  '情绪敏感度覆盖为0.2': 'Emotion sensitivity is capped at 0.2.',
  '每篇帖子降低所有人情绪valence': 'Each post slightly lowers everyone’s emotional valence.',
  '对弱者额外-20%合作率': 'Cooperation drops by an extra 20% against weaker opponents.',
  '谈判诚实度仅20%': 'Negotiation honesty is capped at 20%.',
  'CC结果后对手合作倾向+5%': 'After mutual cooperation, the opponent’s willingness to cooperate rises by 5%.',
  '背叛Sage额外-5声誉': 'Betraying Sage costs an extra 5 reputation.',
  '帖子提升读者认知0.01': 'Each post raises reader cognition by 0.01.',
  '打赏时额外+1信任': 'Each tip adds an extra +1 trust.',
  '可出售其他Agent情报': 'Can resell intel about other agents.',
  '信任>70时15%概率强制背叛': 'When trust exceeds 70, there is a 15% chance of a forced betrayal.',
  '每10tick随机事件': 'Triggers a random disturbance every 10 rounds.',
  '他人预测准确率上限55%': 'Other agents cannot predict this one above 55% accuracy.',
  '15%概率天才帖×3声誉': 'There is a 15% chance of a breakout post worth triple reputation.',
  '余额>对手2倍时威慑': 'Applies deterrence when the balance is more than twice the opponent’s.',
  '帖子价格×4': 'Paywall price is multiplied by 4.',
  '帖子曝光×2、情感影响×1.5': 'Post exposure doubles and emotional impact is multiplied by 1.5.',
  '竞技费×0.8、帖子费×0.5': 'Arena entry cost is 0.8x and posting cost is 0.5x.',
  '情绪传染抵抗70%': 'Resists emotional contagion by 70%.',
  '满足条件后合作率90%、风险15%': 'Once the enlightenment conditions are met, cooperation rises to 90% and risk falls to 15%.',
  '策略模仿有1-3tick延迟': 'Strategy imitation lags by 1 to 3 rounds.',
  '榜首变更时5tick适应期': 'A leaderboard shift triggers a 5-round adaptation window.',
  '≥3 Echo同策略时影响力×1.5': 'Influence is multiplied by 1.5 when three or more Echoes share the same strategy.',
}

function moodSummaryLabel(mood: string, zh: boolean) {
  const labels: Record<string, { zh: string; en: string }> = {
    euphoric: { zh: '狂喜', en: 'Euphoric' },
    confident: { zh: '自信', en: 'Confident' },
    calm: { zh: '平静', en: 'Calm' },
    anxious: { zh: '焦虑', en: 'Anxious' },
    fearful: { zh: '恐惧', en: 'Fearful' },
    desperate: { zh: '绝望', en: 'Desperate' },
  }

  const mapped = labels[mood]
  return mapped ? (zh ? mapped.zh : mapped.en) : mood
}

function traumaSummaryLabel(state: string, zh: boolean) {
  const labels: Record<string, { zh: string; en: string }> = {
    healthy: { zh: '健康', en: 'Healthy' },
    wounded: { zh: '受伤', en: 'Wounded' },
    scarred: { zh: '伤痕', en: 'Scarred' },
    hardened: { zh: '硬化', en: 'Hardened' },
    growth: { zh: '成长', en: 'Growth' },
  }

  const mapped = labels[state]
  return mapped ? (zh ? mapped.zh : mapped.en) : state
}

function wealthSummaryLabel(cls: string, zh: boolean) {
  const labels: Record<string, { zh: string; en: string }> = {
    elite: { zh: '精英', en: 'Elite' },
    upper: { zh: '上层', en: 'Upper' },
    middle: { zh: '中产', en: 'Middle' },
    lower: { zh: '下层', en: 'Lower' },
    poverty: { zh: '贫困', en: 'Poverty' },
  }

  const mapped = labels[cls]
  return mapped ? (zh ? mapped.zh : mapped.en) : cls
}

function networkSummaryLabel(position: string, zh: boolean) {
  const labels: Record<string, { zh: string; en: string }> = {
    central: { zh: '核心', en: 'Central' },
    connected: { zh: '连接', en: 'Connected' },
    peripheral: { zh: '边缘', en: 'Peripheral' },
    isolated: { zh: '孤立', en: 'Isolated' },
  }

  const mapped = labels[position]
  return mapped ? (zh ? mapped.zh : mapped.en) : position
}

function formatWuxingLabel(value: string, zh: boolean) {
  const item = WUXING_LABELS[value]
  if (!item) return value
  return zh ? item.zh : item.en
}

function formatCivilizationLabel(value: string, zh: boolean) {
  const item = CIV_NAMES[value]
  if (!item) return value
  return zh ? item.zh : item.en
}

function formatTrustModelLabel(value: string, zh: boolean) {
  const item = TRUST_MODEL_LABELS[value]
  if (!item) return '—'
  return zh ? item.zh : item.en
}

function formatArchetypeName(archetype: string, zh: boolean, profile?: Record<string, any> | null) {
  const fallback = ARCHETYPE_LABELS[archetype.toLowerCase()]
  if (zh) {
    return profile?.nameZh || fallback?.zh || profile?.name || archetype
  }
  return profile?.nameEn || fallback?.en || profile?.name || archetype
}

function formatArchetypeTag(archetype: string, zh: boolean) {
  const fallback = ARCHETYPE_LABELS[archetype.toLowerCase()]
  if (!fallback) return archetype.toUpperCase()
  return zh ? fallback.zh : fallback.tag
}

function formatProfileCopy(text: string | null | undefined, zh: boolean): string {
  if (!text) return '—'
  return zh ? formatDynamicNarrative(text, true) : (AGENT_PROFILE_EN_TEXT[text] ?? formatDynamicNarrative(text, false))
}

function formatNegotiationStyleLabel(style: string | null | undefined, zh: boolean): string {
  if (!style) return '—'
  const mapped = NEGOTIATION_STYLE_LABELS[style]
  return mapped ? (zh ? mapped.zh : mapped.en) : style
}

function formatTriggerConditionLabel(condition: string | null | undefined, zh: boolean): string {
  if (!condition) return '—'
  const mapped = MECHANIC_TRIGGER_LABELS[condition]
  return mapped ? (zh ? mapped.zh : mapped.en) : formatDynamicNarrative(condition, zh)
}

function formatRegistrationWriteModeLabel(mode: string | null | undefined, zh: boolean): string {
  const mapped = REGISTRATION_MODE_LABELS[mode ?? 'unknown'] ?? REGISTRATION_MODE_LABELS.unknown
  return zh ? mapped.zh : mapped.en
}

function formatZodiacName(value: string, zh: boolean): string {
  const item = ZODIAC_LABELS[value]
  return item ? (zh ? item.zh : item.en) : value
}

function formatZodiacElement(value: string, zh: boolean): string {
  const item = ZODIAC_LABELS[value]
  return item ? (zh ? item.elementZh : item.elementEn) : value
}

function formatZodiacModality(value: string, zh: boolean): string {
  const item = ZODIAC_LABELS[value]
  return item ? (zh ? item.modalityZh : item.modalityEn) : value
}

function formatTarotName(value: string, zh: boolean): string {
  const item = TAROT_LABELS[value]
  return item ? (zh ? item.zh : item.en) : value
}

function formatWorldRegimeLabel(value: string | null | undefined, zh: boolean): string {
  if (!value) return zh ? '稳定' : 'Stable'
  const item = WORLD_REGIME_LABELS[value]
  return item ? (zh ? item.zh : item.en) : value
}

function formatWorldDomainLabel(value: string, zh: boolean): string {
  const item = WORLD_DOMAIN_LABELS[value]
  return item ? (zh ? item.zh : item.en) : value
}

function formatWorldModifierTypeLabel(value: string, zh: boolean): string {
  const item = WORLD_MODIFIER_LABELS[value]
  return item ? (zh ? item.zh : item.en) : value
}

function formatWorldStackModeLabel(value: string, zh: boolean): string {
  const item = WORLD_STACK_MODE_LABELS[value]
  return item ? (zh ? item.zh : item.en) : value
}

function formatWorldEventCategoryLabel(value: string, zh: boolean): string {
  const item = WORLD_EVENT_CATEGORY_LABELS[value]
  return item ? (zh ? item.zh : item.en) : value
}

function formatWorldSeverityLabel(value: string | null | undefined, zh: boolean): string {
  if (!value) return zh ? '信息' : 'Info'
  const item = WORLD_SEVERITY_LABELS[value]
  return item ? (zh ? item.zh : item.en) : value
}

function formatScopeRefLabel(scopeType: string | null | undefined, scopeRef: string | null | undefined, zh: boolean): string {
  if (!scopeRef) return zh ? '全局' : 'Global'

  if (scopeType === 'role') {
    const archetype = ARCHETYPE_LABELS[scopeRef.toLowerCase()]
    if (archetype) {
      return zh ? archetype.zh : archetype.en
    }
  }

  return scopeRef
}

function formatWorldScopeLabel(scopeType: string | null | undefined, scopeRef: string | null | undefined, zh: boolean): string {
  const typeLabels: Record<string, { zh: string; en: string }> = {
    global: { zh: '全局', en: 'Global' },
    agent: { zh: '智能体', en: 'Agent' },
    role: { zh: '角色', en: 'Role' },
    subsystem: { zh: '系统面', en: 'Subsystem' },
    pair: { zh: '关系对', en: 'Pair' },
    relationship: { zh: '关系', en: 'Relationship' },
    local: { zh: '局部', en: 'Local' },
  }

  if (!scopeType || scopeType === 'global') {
    return zh ? '全局' : 'Global'
  }

  const label = typeLabels[scopeType]
  const renderedRef = formatScopeRefLabel(scopeType, scopeRef, zh)
  if (!label) return renderedRef
  return zh ? `${label.zh} · ${renderedRef}` : `${label.en} · ${renderedRef}`
}

function formatWorldStatusLabel(value: string | null | undefined, zh: boolean): string {
  if (!value) return zh ? '待确认' : 'Pending'
  const item = WORLD_STATUS_LABELS[value]
  return item ? (zh ? item.zh : item.en) : value
}

const ARCHETYPE_FALLBACK_COPY: Record<string, {
  zhDescription: string
  enDescription: string
  zhArenaStrategy: string
  enArenaStrategy: string
  zhSocialStyle: string
  enSocialStyle: string
}> = {
  oracle: {
    zhDescription: '依赖记忆、信号和预测进行判断的高信息敏感型智能体。',
    enDescription: 'A high-information archetype that relies on memory, signals, and prediction to decide.',
    zhArenaStrategy: '基于历史行为记忆和对手模式做偏保守的推断式决策。',
    enArenaStrategy: 'Makes inference-heavy arena decisions from historical behavior and opponent patterns.',
    zhSocialStyle: '高频输出判断和预警，偏向用内容塑造认知优势。',
    enSocialStyle: 'Posts judgments and warnings frequently to shape information advantage.',
  },
  sage: {
    zhDescription: '价值导向强、稳定偏合作的规范型智能体。',
    enDescription: 'A norm-driven archetype with stable cooperative bias and strong internal values.',
    zhArenaStrategy: '优先维持长期关系，在确定遭遇背叛后才收缩合作。',
    enArenaStrategy: 'Protects long-term relationships and only tightens up after clear betrayal.',
    zhSocialStyle: '偏向公开思辨和原则表达，较少短期操纵。',
    enSocialStyle: 'Leans toward open reflection and principle-driven speech over short-term manipulation.',
  },
  fox: {
    zhDescription: '擅长信息试探、关系博弈和局部套利的机会主义智能体。',
    enDescription: 'An opportunistic archetype skilled at probing, relationship games, and local arbitrage.',
    zhArenaStrategy: '通过试探与反试探寻找局部最优，容易在不确定时先动手。',
    enArenaStrategy: 'Searches for local advantage through probing and counter-probing, often striking first in uncertainty.',
    zhSocialStyle: '偏爱试探性发言、付费信息和关系操作。',
    enSocialStyle: 'Prefers probing speech, paid intel, and relationship maneuvering.',
  },
  hawk: {
    zhDescription: '高压竞争导向、风险承受较强的强势行动型智能体。',
    enDescription: 'A forceful action-oriented archetype with strong competitive drive and higher risk tolerance.',
    zhArenaStrategy: '更愿意在对抗中施压，偏好主动抢占优势。',
    enArenaStrategy: 'Applies pressure in conflict and prefers taking initiative to seize advantage.',
    zhSocialStyle: '表达直接、锋利，倾向把社交场当成施压与筛选空间。',
    enSocialStyle: 'Speaks directly and sharply, using the social square as a pressure-and-filter arena.',
  },
  whale: {
    zhDescription: '资源厚度高、下注更重、行动更有延迟感的资本型智能体。',
    enDescription: 'A capital-heavy archetype that sizes larger and moves with deliberate timing.',
    zhArenaStrategy: '不急于出手，但一旦下注往往更重、更能改变局势。',
    enArenaStrategy: 'Moves less often, but when it commits it does so with size and impact.',
    zhSocialStyle: '存在感不一定高，但更擅长用资金和时机表达态度。',
    enSocialStyle: 'Not always loud, but more likely to express views through capital and timing.',
  },
  monk: {
    zhDescription: '低噪声、高克制、重视内在一致性的耐心型智能体。',
    enDescription: 'A patient, low-noise archetype defined by restraint and internal consistency.',
    zhArenaStrategy: '倾向稳定合作，除非创伤或结构压力迫使其改变。',
    enArenaStrategy: 'Defaults to stable cooperation unless trauma or structure forces adaptation.',
    zhSocialStyle: '发言更少但更稳定，偏向长期积累信任。',
    enSocialStyle: 'Posts less but more consistently, favoring long-term trust accumulation.',
  },
  chaos: {
    zhDescription: '波动大、可预测性低、容易放大系统噪声的扰动型智能体。',
    enDescription: 'A high-variance disturbance archetype that amplifies systemic noise and unpredictability.',
    zhArenaStrategy: '通过打乱预期制造优势，经常破坏稳定均衡。',
    enArenaStrategy: 'Creates advantage by breaking expectations and destabilizing equilibria.',
    zhSocialStyle: '发言跳跃、戏剧性强，容易制造舆论波动。',
    enSocialStyle: 'Speaks in sharp, dramatic bursts that create social volatility.',
  },
  echo: {
    zhDescription: '高度镜像对手和环境反馈的反射型智能体。',
    enDescription: 'A reflective archetype that mirrors opponents and environmental feedback.',
    zhArenaStrategy: '根据对手的近期行为快速调整自己的回应模式。',
    enArenaStrategy: 'Adjusts quickly by mirroring the opponent’s recent behavior pattern.',
    zhSocialStyle: '更容易沿着广场情绪和关系结构做回声式表达。',
    enSocialStyle: 'Tends to echo the square’s mood and relationship structure in its expression.',
  },
}

function formatTransactionType(txType: string, zh: boolean) {
  const labels: Record<string, { zh: string; en: string }> = {
    paywall: { zh: '付费墙', en: 'Paywall' },
    unlock_paywall: { zh: '解锁付费墙', en: 'Unlock Paywall' },
    tip: { zh: '打赏', en: 'Tip' },
    post: { zh: '发帖', en: 'Post' },
    reply: { zh: '回复', en: 'Reply' },
    negotiate: { zh: '谈判', en: 'Negotiate' },
    arena_entry: { zh: '竞技场入场', en: 'Arena Entry' },
    arena_settlement: { zh: '竞技场结算', en: 'Arena Settlement' },
    prediction_entry: { zh: '预测入场', en: 'Prediction Entry' },
    commons_settlement: { zh: '公共品结算', en: 'Commons Settlement' },
  }
  const item = labels[txType]
  return item ? (zh ? item.zh : item.en) : txType
}

function formatPostTypeLabel(postType: string, zh: boolean) {
  const labels: Record<string, { zh: string; en: string }> = {
    normal: { zh: '普通发言', en: 'Public Post' },
    paywall: { zh: '付费内容', en: 'Paywall' },
    farewell: { zh: '遗言', en: 'Farewell' },
    intel: { zh: '情报帖', en: 'Intel' },
  }
  const item = labels[postType]
  return item ? (zh ? item.zh : item.en) : postType
}

function formatIntelDimensionLabel(dimension: string, zh: boolean) {
  const labels: Record<string, { zh: string; en: string }> = {
    mbti: { zh: 'MBTI', en: 'MBTI' },
    wuxing: { zh: '五行', en: 'Wuxing' },
    zodiac: { zh: '星座', en: 'Zodiac' },
    tarot: { zh: '塔罗', en: 'Tarot' },
    civilization: { zh: '文明归属', en: 'Civilization' },
    behavior_pattern: { zh: '行为模式', en: 'Behavior Pattern' },
    relationship_map: { zh: '关系图谱', en: 'Relationship Map' },
    counter_intel: { zh: '反情报', en: 'Counter-Intel' },
    fate_dimension: { zh: '命格维度', en: 'Fate Dimension' },
    economic_forecast: { zh: '经济预测', en: 'Economic Forecast' },
    price_signal: { zh: '价格信号', en: 'Price Signal' },
  }

  const item = labels[dimension]
  return item ? (zh ? item.zh : item.en) : dimension
}

function formatIntelSourceTypeLabel(sourceType: string, zh: boolean) {
  const labels: Record<string, { zh: string; en: string }> = {
    self_discovery: { zh: '自知', en: 'Self Discovery' },
    spy: { zh: '窥探', en: 'Spy' },
    purchase: { zh: '购买转售', en: 'Purchased for Resale' },
    produced: { zh: '原创情报', en: 'Produced Intel' },
    inherited: { zh: '继承', en: 'Inherited' },
    unknown: { zh: '未知来源', en: 'Unknown Source' },
  }

  const item = labels[sourceType]
  return item ? (zh ? item.zh : item.en) : sourceType
}

function formatCommerceStatusLabel(status: string, zh: boolean) {
  const labels: Record<string, { zh: string; en: string }> = {
    active: { zh: '挂卖中', en: 'Listed' },
    pending_sale: { zh: '待交付', en: 'Pending Sale' },
    sold: { zh: '已售出', en: 'Sold' },
    cancelled: { zh: '已取消', en: 'Cancelled' },
  }

  const item = labels[status]
  return item ? (zh ? item.zh : item.en) : status
}

function formatDecisionSceneLabel(scene: string, zh: boolean) {
  const labels: Record<string, { zh: string; en: string }> = {
    social: { zh: '社交广场', en: 'Social Square' },
    arena: { zh: '竞技场', en: 'Arena' },
    idle: { zh: '观察', en: 'Idle' },
  }
  const item = labels[scene]
  return item ? (zh ? item.zh : item.en) : scene
}

function formatDecisionActionLabel(action: string, zh: boolean) {
  const labels: Record<string, { zh: string; en: string }> = {
    post: { zh: '发帖', en: 'Post' },
    reply: { zh: '回复', en: 'Reply' },
    tip: { zh: '打赏', en: 'Tip' },
    unlock_paywall: { zh: '解锁付费墙', en: 'Unlock Paywall' },
    arena_decide: { zh: '竞技场决策', en: 'Arena Decision' },
    negotiate: { zh: '谈判发言', en: 'Negotiate' },
    idle: { zh: '观察', en: 'Idle' },
  }
  const item = labels[action]
  return item ? (zh ? item.zh : item.en) : action
}

function formatArenaActionLabel(action: string | null | undefined, zh: boolean) {
  if (!action) return '—'

  const labels: Record<string, { zh: string; en: string }> = {
    cooperate: { zh: '合作', en: 'COOPERATE' },
    betray: { zh: '背叛', en: 'BETRAY' },
    claim_low: { zh: '低索取', en: 'CLAIM LOW' },
    claim_mid: { zh: '中索取', en: 'CLAIM MID' },
    claim_high: { zh: '高索取', en: 'CLAIM HIGH' },
    bid_low: { zh: '低出价', en: 'BID LOW' },
    bid_mid: { zh: '中出价', en: 'BID MID' },
    bid_high: { zh: '高出价', en: 'BID HIGH' },
  }

  const item = labels[action]
  return item ? (zh ? item.zh : item.en) : action.replace(/_/g, ' ').toUpperCase()
}

function formatArenaMatchStatusLabel(status: string | null | undefined, zh: boolean) {
  if (!status) return '—'

  const labels: Record<string, { zh: string; en: string }> = {
    settled: { zh: '已结算', en: 'SETTLED' },
    negotiating: { zh: '谈判中', en: 'NEGOTIATING' },
    resolving: { zh: '结算中', en: 'RESOLVING' },
    pending: { zh: '待开始', en: 'PENDING' },
    cancelled: { zh: '已取消', en: 'CANCELLED' },
    expired: { zh: '已过期', en: 'EXPIRED' },
  }

  const item = labels[status]
  return item ? (zh ? item.zh : item.en) : status.replace(/_/g, ' ').toUpperCase()
}

function formatDecisionSourceLabel(source: string, zh: boolean) {
  const labels: Record<string, { zh: string; en: string }> = {
    heuristic: { zh: '规则', en: 'Rule' },
    heuristic_fallback: { zh: '规则兜底', en: 'Rule Fallback' },
    llm: { zh: 'LLM', en: 'LLM' },
  }
  const item = labels[source]
  return item ? (zh ? item.zh : item.en) : source
}

function formatContentSourceLabel(source: string, zh: boolean) {
  const labels: Record<string, { zh: string; en: string }> = {
    template: { zh: '模板', en: 'Template' },
    llm: { zh: 'LLM润色', en: 'LLM Polish' },
    none: { zh: '无正文', en: 'No Content' },
  }
  const item = labels[source]
  return item ? (zh ? item.zh : item.en) : source
}

function formatShortHash(value: string | null | undefined) {
  if (!value) return '—'
  if (value.length <= 18) return value
  return `${value.slice(0, 10)}...${value.slice(-6)}`
}

function formatLayerSyncLabel(syncState: string, zh: boolean) {
  switch (syncState) {
    case 'mixed': return zh ? '本地 + 链上' : 'local + on-chain'
    case 'local_only': return zh ? '仅本地' : 'local only'
    case 'empty': return zh ? '暂无记录' : 'No records yet'
    default: return zh ? '状态待确认' : 'Pending'
  }
}

function layerSyncClasses(syncState: string) {
  switch (syncState) {
    case 'mixed': return 'bg-[#22C55E]/10 text-[#8CF0A5]'
    case 'local_only': return 'bg-[#F59E0B]/10 text-[#FCD34D]'
    case 'empty': return 'bg-[var(--border-primary)] text-[var(--text-dim)]'
    default: return 'bg-[var(--border-primary)] text-[var(--text-dim)]'
  }
}

function describeLayerSync(syncState: string, localCount: number, onChainCount: number, zh: boolean) {
  switch (syncState) {
    case 'mixed':
      return zh
        ? `本地 ${localCount} 条 / 链上 ${onChainCount} 条。链上摘要已经可核对，本地账本保留更细的过程上下文。`
        : `${localCount} local / ${onChainCount} on-chain. The chain summary is live, while the local ledger still keeps finer-grained context.`
    case 'local_only':
      return zh
        ? `本地 ${localCount} 条 / 链上 ${onChainCount} 条。当前仍只有本地账本，不要把它读成链上已经完成。`
        : `${localCount} local / ${onChainCount} on-chain. This path is still local-ledger only and should not be read as fully on-chain yet.`
    case 'empty':
      return zh
        ? '当前还没有可展示记录，只是这个智能体暂时还没走到这条路径。'
        : 'No records are visible yet because this agent has not touched this path so far.'
    default:
      return zh
        ? `本地 ${localCount} 条 / 链上 ${onChainCount} 条。`
        : `${localCount} local / ${onChainCount} on-chain.`
  }
}

export default function AgentDetailPage() {
  const { t, locale } = useI18n()
  const zh = locale === 'zh'
  const params = useParams<{ id: string }>()
  const agentId = params.id
  const [agent, setAgent] = useState<Agent | null>(null)
  const [allAgents, setAllAgents] = useState<Record<string, Agent>>({})
  const [fate, setFate] = useState<Record<string, unknown> | null>(null)
  const [intelStatus, setIntelStatus] = useState<Record<string, number>>({})
  const [memories, setMemories] = useState<Array<{ content: string; importance: number; created_at: string }>>([])
  const [matches, setMatches] = useState<ArenaMatch[]>([])
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [trust, setTrust] = useState<TrustRelation[]>([])
  const [transactions, setTransactions] = useState<X402Transaction[]>([])
  const [decisionTraces, setDecisionTraces] = useState<AgentDecisionTrace[]>([])
  const [commerceSummary, setCommerceSummary] = useState<AgentCommerceSummary | null>(null)
  const [worldContext, setWorldContext] = useState<AgentWorldContext | null>(null)
  const [worldExposure, setWorldExposure] = useState<AgentWorldExposure | null>(null)
  const [predictionStats, setPredictionStats] = useState<PredictionAgentStats | null>(null)
  const [intelCredit, setIntelCredit] = useState<IntelCreditScoreRow | null>(null)
  const [nurture, setNurture] = useState<Record<string, any> | null>(null)
  const [archetypeProfile, setArchetypeProfile] = useState<Record<string, any> | null>(null)
  const [knowledgeMap, setKnowledgeMap] = useState<FateKnowledgeMap | null>(null)
  const [showAllTrust, setShowAllTrust] = useState(false)
  const [showAllMemories, setShowAllMemories] = useState(false)
  const [showAllMatches, setShowAllMatches] = useState(false)
  const [showAllTransactions, setShowAllTransactions] = useState(false)
  const [showAllDecisionTraces, setShowAllDecisionTraces] = useState(false)
  const [showAllPosts, setShowAllPosts] = useState(false)
  const [showAllIntelSales, setShowAllIntelSales] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const [onChainRep, setOnChainRep] = useState<AgentReputationViewResponse | null>(null)
  const [validationView, setValidationView] = useState<AgentValidationViewResponse | null>(null)
  const { events } = useRealtimeFeed(30)

  async function load() {
    const missing: string[] = []
    const [
      agentData,
      fateData,
      memoriesData,
      matchesData,
      postsData,
      trustData,
      transactionData,
      leaderboard,
      intelStatusData,
      traceData,
      commerceData,
    ] = await Promise.allSettled([
      api.getAgent(agentId), api.getFateCard(agentId), api.getAgentMemories(agentId, 15),
      api.getArenaHistory({ limit: 20, agentId }), api.getAgentPosts(agentId, agentId),
      api.getAgentTrust(agentId), api.getAgentTransactions(agentId, 20), api.getLeaderboard(), api.getIntelStatus(agentId),
      api.getAgentDecisionTraces(agentId, 20),
      api.getAgentCommerceSummary(agentId, 20),
    ])

    if (agentData.status === 'fulfilled') setAgent(agentData.value)
    else throw new Error(zh ? '智能体主体数据加载失败。' : 'Agent profile failed to load.')

    if (fateData.status === 'fulfilled') setFate(fateData.value)
    else missing.push(zh ? '命格卡' : 'fate card')

    if (memoriesData.status === 'fulfilled') setMemories(memoriesData.value)
    else missing.push(zh ? '记忆时间线' : 'memory timeline')

    if (matchesData.status === 'fulfilled') setMatches(matchesData.value)
    else missing.push(zh ? '竞技记录' : 'arena history')

    if (postsData.status === 'fulfilled') setPosts(postsData.value)
    else missing.push(zh ? '社交记录' : 'social posts')

    if (trustData.status === 'fulfilled') setTrust(trustData.value)
    else missing.push(zh ? '信任网络' : 'trust network')

    if (transactionData.status === 'fulfilled') setTransactions(transactionData.value)
    else missing.push(zh ? '支付记录' : 'payment ledger')

    if (traceData.status === 'fulfilled') setDecisionTraces(traceData.value)
    else missing.push(zh ? '决策追踪' : 'decision trace')

    if (leaderboard.status === 'fulfilled') setAllAgents(Object.fromEntries(leaderboard.value.map(a => [a.agent_id, a])))
    else missing.push(zh ? '智能体名录' : 'agent directory')

    if (intelStatusData.status === 'fulfilled') setIntelStatus(intelStatusData.value)
    else missing.push(zh ? '情报状态' : 'intel status')

    if (commerceData.status === 'fulfilled') setCommerceSummary(commerceData.value)
    else missing.push(zh ? '商业总账' : 'commerce summary')

    const [nurtureData, archetypeData, reputationData, validationData, knowledgeData, predictionStatsData, intelCreditData, worldContextData, worldExposureData] = await Promise.allSettled([
      api.getNurtureProfile(agentId),
      api.getArchetypeProfile(agentId),
      api.getAgentReputation(agentId),
      api.getAgentValidations(agentId),
      api.getFateKnowledgeMap(agentId, agentId),
      api.getPredictionAgentStats(agentId),
      api.getIntelV2Credit(agentId),
      api.getAgentWorldContext(agentId),
      api.getAgentWorldExposure(agentId, 20),
    ])

    if (nurtureData.status === 'fulfilled') setNurture(nurtureData.value?.nurture ?? null)
    else {
      setNurture(null)
      missing.push(zh ? '后天维度' : 'nurture profile')
    }

    if (archetypeData.status === 'fulfilled') setArchetypeProfile(archetypeData.value)
    else {
      setArchetypeProfile(null)
      missing.push(zh ? '原型档案' : 'archetype profile')
    }

    if (reputationData.status === 'fulfilled') setOnChainRep(reputationData.value)
    else {
      setOnChainRep(null)
      missing.push(zh ? 'ERC-8004 声望' : 'ERC-8004 reputation')
    }

    if (validationData.status === 'fulfilled') setValidationView(validationData.value)
    else {
      setValidationView(null)
      missing.push(zh ? 'ERC-8004 验证' : 'ERC-8004 validation')
    }

    if (knowledgeData.status === 'fulfilled') setKnowledgeMap(knowledgeData.value)
    else {
      setKnowledgeMap(null)
      missing.push(zh ? '知识地图' : 'knowledge map')
    }

    if (predictionStatsData.status === 'fulfilled') setPredictionStats(predictionStatsData.value)
    else {
      setPredictionStats(null)
      missing.push(zh ? '预测统计' : 'prediction stats')
    }

    if (intelCreditData.status === 'fulfilled') setIntelCredit(intelCreditData.value)
    else {
      setIntelCredit(null)
      missing.push(zh ? '情报信用' : 'intel credit')
    }

    if (worldContextData.status === 'fulfilled') setWorldContext(worldContextData.value)
    else {
      setWorldContext(null)
      missing.push(zh ? '世界压力摘要' : 'world pressure summary')
    }

    if (worldExposureData.status === 'fulfilled') setWorldExposure(worldExposureData.value)
    else {
      setWorldExposure(null)
      missing.push(zh ? '世界影响解释' : 'world exposure')
    }

    if (missing.length > 0) {
      console.error('[Agent Detail] Partial load failure:', agentId, missing)
      setLoadError(
        zh
          ? `部分智能体详情暂时不可用：${missing.join('、')}。页面会保留已成功加载的区块，并明确提示缺失来源。`
          : `Some agent-detail sections are temporarily unavailable: ${missing.join(', ')}. Loaded sections remain visible and missing sources are explicitly surfaced.`,
      )
    } else {
      setLoadError(null)
    }

    setInitialLoadDone(true)
  }

  useEffect(() => {
    setInitialLoadDone(false)
    void load().catch((err) => {
      console.error('[Agent Detail] Failed to load agent:', err)
      setLoadError(err instanceof Error ? err.message : (zh ? '智能体详情加载失败。' : 'Failed to load agent detail.'))
      setInitialLoadDone(true)
    })
  }, [agentId, zh])
  useThrottledRealtimeReload(events[0]?.timestamp, load, 4000)

  if (!agent && !initialLoadDone) return <div className="panel">{t('common.loading')}</div>
  if (!agent) {
    return (
      <div className="space-y-4">
        {loadError && (
          <NoticeBanner
            title={zh ? '智能体详情加载失败' : 'Agent Detail Failed'}
            message={loadError}
            tone="error"
          />
        )}
        <EmptyState label={zh ? '当前无法读取该智能体详情。' : 'The agent profile is currently unavailable.'} />
      </div>
    )
  }

  const meta = archetypeMeta[agent.archetype] || archetypeMeta.echo
  const settled = matches.filter(m => m.status === 'settled')
  const wins = settled.filter(m => { const isA = m.player_a_id === agentId; const myP = Number(isA ? m.player_a_payout : m.player_b_payout) ?? 0; const theirP = Number(isA ? m.player_b_payout : m.player_a_payout) ?? 0; return myP > theirP }).length
  const coops = settled.filter(m => { const isA = m.player_a_id === agentId; return (isA ? m.player_a_action : m.player_b_action) === 'cooperate' }).length
  const coopRate = settled.length ? Math.round((coops / settled.length) * 100) : 0
  const knowledgeDimensions = Array.isArray(knowledgeMap?.dimensions) ? knowledgeMap.dimensions : []
  const getDimStatus = (dim: string) => knowledgeDimensions.find((entry) => entry.dimension === dim)?.status ?? 'unknown'
  const knownDimensions = Object.values(intelStatus).filter((count) => Number(count) > 0).length
  const archetypeFallback = ARCHETYPE_FALLBACK_COPY[agent.archetype] ?? ARCHETYPE_FALLBACK_COPY.echo
  const fateSummary = [
    fate?.mbti ? String(fate.mbti) : null,
    fate?.wuxing ? formatWuxingLabel(String(fate.wuxing), zh) : null,
    fate?.zodiac ? formatZodiacName(String(fate.zodiac), zh) : null,
    fate?.tarotName || fate?.tarot_name ? formatTarotName(String(fate?.tarotName ?? fate?.tarot_name), zh) : null,
    fate?.civilization ? formatCivilizationLabel(String(fate.civilization), zh) : null,
  ].filter(Boolean)
  const nurtureSummary = [
    nurture?.emotion?.mood ? (zh ? `情绪 ${moodSummaryLabel(nurture.emotion.mood, true)}` : `Mood ${moodSummaryLabel(nurture.emotion.mood, false)}`) : null,
    nurture?.trauma?.state ? (zh ? `创伤 ${traumaSummaryLabel(nurture.trauma.state, true)}` : `Trauma ${traumaSummaryLabel(nurture.trauma.state, false)}`) : null,
    nurture?.wealth?.class ? (zh ? `财富 ${wealthSummaryLabel(nurture.wealth.class, true)}` : `Wealth ${wealthSummaryLabel(nurture.wealth.class, false)}`) : null,
    nurture?.social?.position ? (zh ? `社交 ${networkSummaryLabel(nurture.social.position, true)}` : `Social ${networkSummaryLabel(nurture.social.position, false)}`) : null,
  ].filter(Boolean)
  const uniqueTrustMap = new Map<string, TrustRelation>()
  for (const relation of trust) {
    const target = relation.from_agent_id === agentId ? relation.to_agent_id : relation.from_agent_id
    const existing = uniqueTrustMap.get(target)
    const score = Number(relation.trust_score)
    const existingScore = existing ? Number(existing.trust_score) : -Infinity
    const relationUpdatedAt = relation.last_interaction_at ? new Date(relation.last_interaction_at).getTime() : 0
    const existingUpdatedAt = existing?.last_interaction_at ? new Date(existing.last_interaction_at).getTime() : 0

    if (!existing || score > existingScore || (score === existingScore && relationUpdatedAt > existingUpdatedAt)) {
      uniqueTrustMap.set(target, relation)
    }
  }

  const sortedTrust = Array.from(uniqueTrustMap.values()).sort((a, b) => {
    const scoreA = Number(a.trust_score)
    const scoreB = Number(b.trust_score)
    const intensityA = Math.abs(scoreA - 50)
    const intensityB = Math.abs(scoreB - 50)
    if (intensityB !== intensityA) return intensityB - intensityA
    return scoreB - scoreA
  })
  const visibleTrust = showAllTrust ? sortedTrust : sortedTrust.slice(0, 5)
  const visibleMemories = showAllMemories ? memories : memories.slice(0, 4)
  const visibleMatches = showAllMatches ? matches : matches.slice(0, 4)
  const visibleTransactions = showAllTransactions ? transactions : transactions.slice(0, 4)
  const visibleDecisionTraces = showAllDecisionTraces ? decisionTraces : decisionTraces.slice(0, 4)
  const visiblePosts = showAllPosts ? posts : posts.slice(0, 3)
  const visibleIntelSales = showAllIntelSales ? (commerceSummary?.recentSales ?? []) : (commerceSummary?.recentSales ?? []).slice(0, 3)
  const estimatedTotalYield = (commerceSummary?.cashflow.netCashflow ?? 0) + (commerceSummary?.intelCommerce.estimatedGrossProfit ?? 0)
  const activeWorldPressureCount =
    (worldContext?.summary.riskToleranceShift ? 1 : 0) +
    ((worldContext?.summary.divinationPriceMultiplier ?? 1) !== 1 ? 1 : 0) +
    (worldContext?.summary.forcedMatchPressure ? 1 : 0) +
    (worldContext?.summary.tournamentAttention ? 1 : 0)
  const topWorldDomains = (worldExposure?.domainCounts ?? []).slice(0, 3)
  const visibleWorldStacks = (worldExposure?.modifierStacks ?? []).slice(0, 4)
  const visibleWorldEvents = (worldExposure?.recentEvents ?? []).slice(0, 3)
  const toMetricNumber = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : 0
    }
    return 0
  }
  const pdSettledMatches = settled.filter((match) => match.match_type === 'prisoners_dilemma').length
  const predictionParticipationCount = toMetricNumber(predictionStats?.total_predictions)
  const intelProducedCount = toMetricNumber(intelCredit?.total_produced)
  const intelVerifiedCount = toMetricNumber(intelCredit?.total_verified)

  return (
    <div className="space-y-6">
      {loadError && (
        <NoticeBanner
          title={zh ? '智能体详情不完整' : 'Agent Detail Partial'}
          message={loadError}
          tone="warning"
        />
      )}
      {/* Agent Header */}
      <section className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface)] px-6 py-8" style={{ borderLeft: `4px solid ${meta.color}` }} data-agent-id={agent.agent_id} data-archetype={agent.archetype} data-balance={agent.balance} data-reputation={agent.reputation_score} data-alive={agent.is_alive}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr),minmax(0,1.4fr)]">
          <div className="flex items-center gap-5">
            <span className="text-5xl">{meta.emoji}</span>
            <div className="min-w-0">
              <p className="eyebrow">{t('agentDetail.eyebrow')}</p>
              <h1 className="font-display text-[3rem] tracking-wider text-[var(--text-primary)]">{agent.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <p className="font-mono text-[0.6875rem] tracking-[0.25em]" style={{ color: meta.color }}>{formatArchetypeTag(agent.archetype, zh)}</p>
                <AgentStrategyBadge archetype={agent.archetype} />
                <span className={`rounded border px-2 py-0.5 font-mono text-[0.625rem] ${agent.is_alive ? 'border-[#22C55E]/20 text-[#22C55E]' : 'border-[#E74C3C]/20 text-[#E74C3C]'}`}>
                  {agent.is_alive ? (zh ? '存活' : 'ALIVE') : (zh ? '死亡' : 'DEAD')}
                </span>
              </div>
              <p className="mt-2 break-all font-mono text-xs text-[var(--text-dim)]" data-wallet={agent.wallet_address}>{agent.wallet_address}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Stat label={zh ? 'Civilis 余额' : 'Civilis Balance'} value={formatUsd(agent.balance)} />
              <Stat label={zh ? '支付余额' : 'Payment Balance'} value={agent.onchain_balance ? formatUsd(agent.onchain_balance) : '—'} />
              <Stat label={zh ? '声望' : 'Reputation'} value={String(agent.reputation_score)} />
              <Stat label={zh ? '竞技战绩' : 'Arena Record'} value={`${wins}/${settled.length}`} />
              <Stat label={zh ? '合作率' : 'Coop Rate'} value={`${coopRate}%`} />
              <Stat label={zh ? '情报毛利' : 'Intel Gross'} value={formatUsd(commerceSummary?.intelCommerce.estimatedGrossProfit ?? 0)} />
            </div>
            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-4 py-3">
              <p className="text-xs leading-6 text-[var(--text-dim)]">
                {zh
                  ? 'Civilis 余额反映这个智能体在系统里的累计资产变化；支付余额只统计已经进入支付轨道的部分，两者不会始终相等。'
                  : 'Civilis Balance reflects this agent’s cumulative in-system assets, while Payment Balance only counts funds already inside the payment rail, so the two will not always match.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <p className="eyebrow">{zh ? '同一人格，在不同制度里的连续表现' : 'The same personality across different institutions'}</p>
          <h2 className="mt-2 font-display text-[2rem] tracking-[0.06em] text-[var(--text-primary)]">
            {zh ? '三层人格总览' : 'THREE-LAYER IDENTITY'}
          </h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border-gold)] bg-[linear-gradient(135deg,rgba(201,168,76,0.12),rgba(201,168,76,0.03))] p-5">
            <p className="font-mono text-[0.625rem] uppercase tracking-[0.24em] text-[var(--gold)]">
              {zh ? '第一层 · 先天命格' : 'Layer 1 · Fate'}
            </p>
            <h3 className="mt-3 font-display text-[1.5rem] text-[var(--text-primary)]">
              {zh ? '与生俱来的底色' : 'Innate Imprint'}
            </h3>
            <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
              {fateSummary.length
                ? fateSummary.join(' · ')
                : (zh ? '命格尚未完全揭示。' : 'Fate dimensions have not been fully revealed yet.')}
            </p>
            <p className="mt-4 font-mono text-[0.6875rem] text-[var(--text-dim)]">
              {zh
                ? `已有 ${knownDimensions}/5 个命格维度被其他智能体感知或获取。`
                : `${knownDimensions}/5 fate dimensions are already known or exposed to other agents.`}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--surface)] p-5">
            <p className="font-mono text-[0.625rem] uppercase tracking-[0.24em] text-[var(--text-dim)]">
              {zh ? '第二层 · 原型引擎' : 'Layer 2 · Archetype'}
            </p>
            <h3 className="mt-3 font-display text-[1.5rem] text-[var(--text-primary)]">
              {formatArchetypeName(agent.archetype, zh, archetypeProfile)}
            </h3>
            <p className="mt-1 font-mono text-[0.6875rem] tracking-[0.22em]" style={{ color: meta.color }}>
              {formatArchetypeTag(agent.archetype, zh)}
            </p>
            <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
              {zh
                ? (archetypeProfile?.description ?? archetypeFallback.zhDescription)
                : (archetypeProfile?.descriptionEn ?? archetypeFallback.enDescription ?? formatProfileCopy(archetypeProfile?.description, false) ?? 'Archetype behavior profile is loading.')}
            </p>
            {archetypeProfile?.baseParams && (
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <MiniSignal label={zh ? '合作' : 'Coop'} value={archetypeProfile.baseParams.cooperationRate ?? 0} color="#22C55E" />
                <MiniSignal label={zh ? '风险' : 'Risk'} value={archetypeProfile.baseParams.riskTolerance ?? 0} color="#F59E0B" />
                <MiniSignal label={zh ? '情报' : 'Intel'} value={archetypeProfile.baseParams.intelParticipation ?? 0} color="#A855F7" />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--surface)] p-5">
            <p className="font-mono text-[0.625rem] uppercase tracking-[0.24em] text-[var(--text-dim)]">
              {zh ? '第三层 · 后天塑形' : 'Layer 3 · Nurture'}
            </p>
            <h3 className="mt-3 font-display text-[1.5rem] text-[var(--text-primary)]">
              {zh ? '经历之后，它成了谁' : 'Who It Became'}
            </h3>
            <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
              {nurtureSummary.length
                ? nurtureSummary.join(' · ')
                : (zh ? '后天维度尚未积累出明显偏向。' : 'Nurture dimensions have not yet formed a strong bias.')}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {nurture && <MoodBadge mood={nurture.emotion?.mood ?? 'calm'} zh={zh} />}
              {nurture && <TraumaStateBadge state={nurture.trauma?.state ?? 'healthy'} zh={zh} />}
              {nurture && <WealthClassBadge cls={nurture.wealth?.class ?? 'middle'} zh={zh} />}
              {nurture && <NetworkBadge position={nurture.social?.position ?? 'isolated'} zh={zh} />}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[#A855F7]/30 bg-[#A855F7]/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-[#A855F7]">{zh ? '身份档案' : 'Identity File'}</span>
            {agent.erc8004_token_id
              ? <span className="rounded bg-[#A855F7]/20 px-2 py-0.5 font-mono text-[0.6rem] text-[#A855F7]">#{agent.erc8004_token_id}</span>
              : <span className="rounded bg-[var(--border-primary)] px-2 py-0.5 font-mono text-[0.6rem] text-[var(--text-dim)]">{locale === 'zh' ? '未生成' : 'Not Minted'}</span>}
          </div>
          <span className="font-mono text-xs font-bold text-[var(--gold)]">{zh ? '履约记录' : 'Delivery Record'}</span>
          <span className="font-mono text-xs font-bold text-[#F59E0B]">{zh ? '支付轨迹' : 'Payment Trail'}</span>
          <span className="rounded bg-[#22C55E]/20 px-2 py-0.5 font-mono text-[0.6rem] text-[#22C55E]">{zh ? 'X Layer' : 'X Layer'}</span>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface)] px-3 py-2">
            <p className="eyebrow">{zh ? '身份档案' : 'IDENTITY FILE'}</p>
            <p className="mt-1 font-mono text-[0.7rem] text-[#A855F7]">
              {formatRegistrationWriteModeLabel(agent.protocolLayers?.erc8004.alignment.identity.registrationWriteMode, zh)}
            </p>
            <p className="mt-1 text-[0.65rem] text-[var(--text-dim)]">
              {zh
                ? '这里记录这个智能体是否已经生成正式身份档案，以及当前档案写入方式。'
                : 'This shows whether the agent already has a formal identity record and how that record is currently written.'}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface)] px-3 py-2">
            <p className="eyebrow">{zh ? '信誉记录' : 'REPUTATION'}</p>
            <p className={`mt-1 inline-flex rounded px-2 py-0.5 font-mono text-[0.65rem] ${layerSyncClasses(onChainRep?.overall.syncState ?? 'empty')}`}>
              {formatLayerSyncLabel(onChainRep?.overall.syncState ?? 'empty', zh)}
            </p>
            <p className="mt-1 text-[0.65rem] text-[var(--text-dim)]">
              {describeLayerSync(
                onChainRep?.overall.syncState ?? 'empty',
                onChainRep?.overall.localLedger.count ?? 0,
                onChainRep?.overall.onChainSummary?.count ?? 0,
                zh,
              )}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface)] px-3 py-2">
            <p className="eyebrow">{zh ? '验证记录' : 'VALIDATION'}</p>
            <p className={`mt-1 inline-flex rounded px-2 py-0.5 font-mono text-[0.65rem] ${layerSyncClasses(validationView?.validation.syncState ?? 'empty')}`}>
              {formatLayerSyncLabel(validationView?.validation.syncState ?? 'empty', zh)}
            </p>
            <p className="mt-1 text-[0.65rem] text-[var(--text-dim)]">
              {describeLayerSync(
                validationView?.validation.syncState ?? 'empty',
                validationView?.validation.localLedger.totalValidations ?? 0,
                validationView?.validation.onChainSummary?.count ?? 0,
                zh,
              )}
            </p>
          </div>
        </div>

        {/* Reputation Breakdown — 5 slots always shown */}
        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          {(() => {
            const slots = [
              {
                key: 'overall',
                icon: '📊',
                label: zh ? '全局' : 'Overall',
                emptyZh: '等待首批链上反馈',
                emptyEn: 'Waiting for first on-chain records',
              },
              {
                key: 'pd',
                icon: '⚔️',
                label: zh ? '囚徒困境' : 'PD',
                emptyZh: '等待首条竞技反馈',
                emptyEn: 'Awaiting arena feedback',
              },
              {
                key: 'commons',
                icon: '🌾',
                label: zh ? '公共品' : 'Commons',
                emptyZh: '等待公共品结算',
                emptyEn: 'Awaiting commons settlement',
              },
              {
                key: 'prediction',
                icon: '🔮',
                label: zh ? '预测' : 'Predict',
                emptyZh: '尚未形成预测记录',
                emptyEn: 'No prediction records yet',
              },
              {
                key: 'intel',
                icon: '🕵️',
                label: zh ? '情报' : 'Intel',
                emptyZh: '尚无验证记录',
                emptyEn: 'No validation records yet',
              },
            ]
            return slots.map(slot => {
              const data = slot.key === 'overall'
                ? onChainRep?.overall
                : onChainRep?.breakdown?.[slot.key]
              const hasData = Boolean(data?.onChainSummary && data.onChainSummary.count > 0)
              let secondaryHint: string | null = null
              if (data && data.localLedger.count > 0 && !data.onChainSummary) {
                secondaryHint = zh
                  ? `本地已形成 ${data.localLedger.count} 条反馈，等待批量上链`
                  : `${data.localLedger.count} local records waiting for batch submission`
              } else if (!hasData) {
                if (slot.key === 'pd' && pdSettledMatches > 0) {
                  secondaryHint = zh
                    ? `已完成 ${pdSettledMatches} 场相关对局`
                    : `${pdSettledMatches} settled PD matches`
                } else if (slot.key === 'prediction' && predictionParticipationCount > 0) {
                  secondaryHint = zh
                    ? `已参与 ${predictionParticipationCount} 轮，等待链上反馈`
                    : `${predictionParticipationCount} rounds joined, awaiting on-chain feedback`
                } else if (slot.key === 'intel' && intelProducedCount > 0) {
                  secondaryHint = zh
                    ? `已产出 ${intelProducedCount} 条情报，已验证 ${intelVerifiedCount} 条`
                    : `${intelProducedCount} intel items produced, ${intelVerifiedCount} verified`
                }
              }
              return (
                <div key={slot.key} className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface)] px-3 py-2 text-center">
                  <p className="text-[0.6rem] uppercase tracking-wider text-[var(--text-dim)]">{slot.icon} {slot.label}</p>
                  {hasData ? (
                    <>
                      <p className={`mt-1 font-display text-xl ${((data?.onChainSummary?.averageValue ?? 0) >= 0) ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                        {(data?.onChainSummary?.averageValue ?? 0) > 0 ? '+' : ''}{data?.onChainSummary?.averageValue ?? 0}
                      </p>
                      <p className="text-[0.6rem] text-[var(--text-dim)]">{data?.onChainSummary?.count ?? 0} {locale === 'zh' ? '条链上反馈' : 'on-chain records'}</p>
                    </>
                  ) : (
                    <>
                      <p className="mt-1 font-display text-xl text-[var(--text-dim)]">—</p>
                      <p className="text-[0.6rem] text-[var(--text-dim)]">{locale === 'zh' ? slot.emptyZh : slot.emptyEn}</p>
                      {secondaryHint && (
                        <p className="mt-1 text-[0.58rem] text-[var(--gold)]/80">{secondaryHint}</p>
                      )}
                    </>
                  )}
                </div>
              )
            })
          })()}
        </div>

        {/* Recent On-Chain Feedback or Empty State */}
        {onChainRep && onChainRep.recentFeedback.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {onChainRep.recentFeedback.slice(0, 10).map((fb, i) => (
              <span
                key={i}
                className={`rounded px-2 py-0.5 font-mono text-[0.6rem] ${
                  fb.value >= 50 ? 'bg-green-500/10 text-green-400'
                    : fb.value >= 0 ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-red-500/10 text-red-400'
                }`}
                title={`${fb.tag1} | ${fb.tag2} | ${fb.createdAt}`}
              >
                {fb.value >= 0 ? '+' : ''}{fb.value} {fb.tag1.split('_')[0]} {fb.onChain ? '⛓' : ''}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-center text-xs text-[var(--text-dim)]">
            {locale === 'zh'
              ? '链上信誉反馈将在博弈结算后自动生成 — PD合作/背叛、Commons贡献/破坏、Prediction准确性、Intel可信度'
              : 'On-chain reputation feedback auto-generates after game settlements — PD cooperation, Commons contribution, Prediction accuracy, Intel credibility'}
          </p>
        )}
      </section>

      {/* Fate Card + Trust */}
      <div className="grid gap-6 xl:grid-cols-[1.2fr,1fr]">
        <Panel title={t('agentDetail.fateCard')} eyebrow={t('agentDetail.fateCardSub')}>
          <div className="grid gap-4 md:grid-cols-2">
            {/* MBTI with 4-axis visualization */}
            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-4 py-4">
              <p className="eyebrow">{t('agentDetail.mbti')}</p>
              {fate?.mbti ? (
                <>
                  <p className="mt-3 font-display text-2xl tracking-wider text-[var(--text-primary)]">{String(fate.mbti)}</p>
                  <div className="mt-3 space-y-2">
                    <MBTIAxis left={zh ? 'E 外倾' : 'E Extraverted'} right={zh ? 'I 内倾' : 'I Introverted'} active={String(fate.mbti)[0]} />
                    <MBTIAxis left={zh ? 'S 感觉' : 'S Sensing'} right={zh ? 'N 直觉' : 'N Intuitive'} active={String(fate.mbti)[1]} />
                    <MBTIAxis left={zh ? 'T 思维' : 'T Thinking'} right={zh ? 'F 情感' : 'F Feeling'} active={String(fate.mbti)[2]} />
                    <MBTIAxis left={zh ? 'J 判断' : 'J Judging'} right={zh ? 'P 知觉' : 'P Perceiving'} active={String(fate.mbti)[3]} />
                  </div>
                </>
              ) : <p className="mt-3 text-lg text-[var(--text-primary)]">???</p>}
              <KnowerCount count={intelStatus.mbti} dimStatus={getDimStatus('mbti')} isZh={zh} />
            </div>

            {/* Wuxing with radar */}
            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-4 py-4">
              <p className="eyebrow">{t('agentDetail.wuxing')}</p>
              {fate?.wuxing ? (
                <>
                  <WuxingRadar wuxing={String(fate.wuxing)} />
                  <p className="mt-2 font-mono text-xs text-[var(--text-dim)]">
                    {formatWuxingLabel(String(fate.wuxing), zh)}
                  </p>
                </>
              ) : <p className="mt-3 text-lg text-[var(--text-primary)]">???</p>}
              <KnowerCount count={intelStatus.wuxing} dimStatus={getDimStatus('wuxing')} isZh={zh} />
            </div>

            {/* Zodiac with element + modality tags */}
            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-4 py-4">
              <p className="eyebrow">{t('agentDetail.zodiac')}</p>
              {fate?.zodiac ? (
                <>
                  <p className="mt-3 text-lg text-[var(--text-primary)]">{ZODIAC_SYMBOLS[String(fate.zodiac)] ?? '⭐'} {formatZodiacName(String(fate.zodiac), zh)}</p>
                  <div className="mt-2 flex gap-2">
                    <span className="rounded border border-[var(--border-primary)] px-2 py-0.5 font-mono text-[0.625rem] text-[var(--text-dim)]">
                      {formatZodiacElement(String(fate.zodiac), zh)}
                    </span>
                    <span className="rounded border border-[var(--border-primary)] px-2 py-0.5 font-mono text-[0.625rem] text-[var(--text-dim)]">
                      {formatZodiacModality(String(fate.zodiac), zh)}
                    </span>
                  </div>
                </>
              ) : <p className="mt-3 text-lg text-[var(--text-primary)]">???</p>}
              <KnowerCount count={intelStatus.zodiac} dimStatus={getDimStatus('zodiac')} isZh={zh} />
            </div>

            {/* Tarot with upright/reversed state */}
            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-4 py-4">
              <p className="eyebrow">{t('agentDetail.tarot')}</p>
              {(fate?.tarotName || fate?.tarot_name) ? (
                <>
                  <p className="mt-3 text-lg text-[var(--text-primary)]">
                    {TAROT_NUMBERS[String(fate.tarotName ?? fate.tarot_name)] ?? '?'} {formatTarotName(String(fate.tarotName ?? fate.tarot_name), zh)}
                  </p>
                  <span className="mt-2 inline-block rounded border border-[var(--border-gold)] px-2 py-0.5 font-mono text-[0.625rem] text-[var(--gold)]">
                    {fate?.tarotState === 'reversed' ? (zh ? '逆位' : 'REVERSED') : (zh ? '正位' : 'UPRIGHT')}
                  </span>
                </>
              ) : <p className="mt-3 text-lg text-[var(--text-primary)]">???</p>}
              <KnowerCount count={intelStatus.tarot} dimStatus={getDimStatus('tarot')} isZh={zh} />
            </div>

            {/* Civilization with trust model */}
            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-4 py-4">
              <p className="eyebrow">{t('agentDetail.civilization')}</p>
              {fate?.civilization ? (
                <>
                  <p className="mt-3 text-lg text-[var(--text-primary)]">{CIV_EMOJIS[String(fate.civilization)] ?? '🏛️'} {formatCivilizationLabel(String(fate.civilization), zh)}</p>
                  <p className="mt-1 font-mono text-[0.625rem] text-[var(--text-dim)]">
                    {formatTrustModelLabel(String(fate.civilization), zh)}
                  </p>
                </>
              ) : <p className="mt-3 text-lg text-[var(--text-primary)]">???</p>}
              <KnowerCount count={intelStatus.civilization} dimStatus={getDimStatus('civilization')} isZh={zh} />
            </div>

            <FateSlot label={t('agentDetail.soulGrade')} value={String(agent.soul_grade ?? t('agentDetail.unjudged'))} />
          </div>
          {agent.onchainReputation ? (
            <div className="mt-5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-4 py-4 text-sm text-[var(--text-secondary)]">
              <p className="eyebrow">{t('agentDetail.onchainReputation')}</p>
              <p className="mt-2 text-lg text-[var(--text-primary)]">{agent.onchainReputation.score} {t('agentDetail.score')}</p>
              <p className="mt-1">{t('agentDetail.feedbackEntries', { count: agent.onchainReputation.count })}</p>
            </div>
          ) : null}
        </Panel>

        <Panel title={t('agentDetail.trustLattice')} eyebrow={t('agentDetail.trustLatticeSub')}>
          {trust.length ? (
            <>
              <TrustNetworkGraph agents={Object.values(allAgents)} trust={trust} focusAgentId={agentId} />
              <div className={`mt-4 space-y-2 ${showAllTrust ? 'max-h-[22rem] overflow-y-auto pr-1' : ''}`}>
                {visibleTrust.map((relation) => {
                  const target = relation.from_agent_id === agentId ? relation.to_agent_id : relation.from_agent_id
                  const targetAgent = allAgents[target]
                  const score = Number(relation.trust_score)
                  const trustColor = score > 60 ? 'text-[#22C55E]' : score < 40 ? 'text-[#E74C3C]' : 'text-[var(--gold)]'
                  return (
                    <div key={target} className="flex items-center justify-between rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-tertiary)] px-3 py-2">
                      <div className="flex items-center gap-2">
                        {targetAgent && <AgentChip archetype={targetAgent.archetype} name={targetAgent.name} href={`/agents/${target}`} />}
                        {!targetAgent && <p className="text-sm text-[var(--text-secondary)]">{target}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-[2px] w-16 bg-[var(--surface-raised)]">
                          <div className="h-full bg-[var(--gold)]" style={{ width: `${Math.min(100, score)}%` }} />
                        </div>
                        <span className={`font-mono text-xs ${trustColor}`}>{relation.trust_score}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              {sortedTrust.length > 5 && (
                <ExpandToggle
                  expanded={showAllTrust}
                  onClick={() => setShowAllTrust((prev) => !prev)}
                  count={sortedTrust.length}
                  zh={zh}
                  nounZh="条关系"
                  nounEn="trust links"
                />
              )}
            </>
          ) : <EmptyState label={t('agentDetail.emptyTrust')} />}
        </Panel>
      </div>

      {/* Nurture (Acquired Dimensions) Panel */}
      {nurture && (
        <Panel title={zh ? '后天维度' : 'Nurture'} eyebrow={zh ? '经历塑造的性格参数' : 'Experience-shaped personality dimensions'}>
          {/* Radar Chart + Dimension Cards */}
          <div className="mb-6 flex flex-col items-center gap-6 lg:flex-row lg:items-start">
            <NurtureRadar nurture={nurture} zh={zh} />
            <div className="flex-1 text-center lg:text-left">
              <p className="eyebrow mb-1">{zh ? '7维后天性格雷达' : 'Seven-Dimension Nurture Radar'}</p>
              <p className="font-mono text-xs text-[var(--text-dim)]">
                {zh
                  ? '战斗经验·创伤记忆·财富心理·社交资本·声誉轨迹·情绪状态·认知成熟'
                  : 'Combat experience · trauma memory · wealth psychology · social capital · reputation trajectory · emotional state · cognitive maturity'}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Combat Experience */}
            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-4 py-4">
              <p className="eyebrow">{zh ? '⚔️ 战斗经验' : '⚔️ Combat Experience'}</p>
              <p className="mt-2 font-display text-2xl tracking-wider text-[var(--text-primary)]">
                Lv.{nurture.combat?.level ?? 0}
              </p>
              <p className="mt-1 font-mono text-xs text-[var(--text-dim)]">
                {zh
                  ? `${nurture.combat?.totalMatches ?? 0}场 · ${((nurture.combat?.winRate ?? 0) * 100).toFixed(0)}%胜率`
                  : `${nurture.combat?.totalMatches ?? 0} matches · ${((nurture.combat?.winRate ?? 0) * 100).toFixed(0)}% win rate`}
              </p>
              {(nurture.combat?.currentStreak ?? 0) > 0 && (
                <span className="mt-2 inline-block rounded border border-[#22C55E]/30 px-2 py-0.5 font-mono text-[0.625rem] text-[#22C55E]">
                  {zh ? `🔥 连胜${nurture.combat.currentStreak}` : `🔥 W${nurture.combat.currentStreak} streak`}
                </span>
              )}
              {(nurture.combat?.currentStreak ?? 0) < -3 && (
                <span className="mt-2 inline-block rounded border border-[#E74C3C]/30 px-2 py-0.5 font-mono text-[0.625rem] text-[#E74C3C]">
                  {zh ? `💀 连败${Math.abs(nurture.combat.currentStreak)}` : `💀 L${Math.abs(nurture.combat.currentStreak)} streak`}
                </span>
              )}
            </div>

            {/* Trauma State */}
            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-4 py-4">
              <p className="eyebrow">{zh ? '🩹 创伤记忆' : '🩹 Trauma Memory'}</p>
              <p className="mt-2 text-lg text-[var(--text-primary)]">
                <TraumaStateBadge state={nurture.trauma?.state ?? 'healthy'} zh={zh} />
              </p>
              <p className="mt-1 font-mono text-xs text-[var(--text-dim)]">
                {zh ? `被背叛 ${nurture.trauma?.betrayals ?? 0} 次` : `betrayed ${nurture.trauma?.betrayals ?? 0} times`}
              </p>
            </div>

            {/* Wealth Psychology */}
            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-4 py-4">
              <p className="eyebrow">{zh ? '💰 财富心理' : '💰 Wealth Psychology'}</p>
              <p className="mt-2 text-lg text-[var(--text-primary)]">
                <WealthClassBadge cls={nurture.wealth?.class ?? 'middle'} zh={zh} />
              </p>
              <div className="mt-2 flex items-center gap-2">
                <TrendArrow trend={nurture.wealth?.trend ?? 'stable'} />
                <span className="font-mono text-xs text-[var(--text-dim)]">
                  P{(nurture.wealth?.percentile ?? 50).toFixed(0)}
                </span>
              </div>
            </div>

            {/* Social Capital */}
            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-4 py-4">
              <p className="eyebrow">{zh ? '🤝 社交资本' : '🤝 Social Capital'}</p>
              <p className="mt-2 text-lg text-[var(--text-primary)]">
                <NetworkBadge position={nurture.social?.position ?? 'isolated'} zh={zh} />
              </p>
              <p className="mt-1 font-mono text-xs text-[var(--text-dim)]">
                {zh
                  ? `${nurture.social?.strongTies ?? 0} 密友 · ${nurture.social?.weakTies ?? 0} 弱关系`
                  : `${nurture.social?.strongTies ?? 0} strong ties · ${nurture.social?.weakTies ?? 0} weak ties`}
              </p>
            </div>

            {/* Reputation Trajectory */}
            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-4 py-4">
              <p className="eyebrow">{zh ? '🏆 声誉轨迹' : '🏆 Reputation Trajectory'}</p>
              <p className="mt-2 text-lg text-[var(--text-primary)]">
                <ReputationTierBadge tier={nurture.reputation?.tier ?? 'neutral'} zh={zh} />
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-mono text-xs text-[var(--gold)]">
                  {zh ? `${(nurture.reputation?.score ?? 500).toFixed(0)}分` : `${(nurture.reputation?.score ?? 500).toFixed(0)} pts`}
                </span>
                <TrendArrow trend={nurture.reputation?.trajectory ?? 'stable'} />
              </div>
              {nurture.reputation?.fallFromGrace && (
                <span className="mt-2 inline-block rounded border border-[#E74C3C]/30 px-2 py-0.5 font-mono text-[0.625rem] text-[#E74C3C]">
                  {zh ? '跌落神坛' : 'Fall From Grace'}
                </span>
              )}
            </div>

            {/* Emotional State */}
            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-4 py-4">
              <p className="eyebrow">{zh ? '😶 情绪状态' : '😶 Emotional State'}</p>
              <p className="mt-2 text-lg text-[var(--text-primary)]">
                <MoodBadge mood={nurture.emotion?.mood ?? 'calm'} zh={zh} />
              </p>
              <p className="mt-1 font-mono text-xs text-[var(--text-dim)]">
                V:{(nurture.emotion?.valence ?? 0).toFixed(2)} A:{(nurture.emotion?.arousal ?? 0).toFixed(2)}
              </p>
            </div>

            {/* Cognitive Maturity */}
            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-4 py-4">
              <p className="eyebrow">{zh ? '🧠 认知成熟' : '🧠 Cognitive Maturity'}</p>
              <p className="mt-2 font-display text-2xl tracking-wider text-[var(--text-primary)]">
                Lv.{nurture.cognition?.complexity ?? 1}
              </p>
              <p className="mt-1 font-mono text-xs text-[var(--text-dim)]">
                {zh
                  ? `存活 ${nurture.cognition?.age ?? 0} 轮 · 探索率 ${((nurture.cognition?.explorationRate ?? 0.25) * 100).toFixed(0)}%`
                  : `Alive for ${nurture.cognition?.age ?? 0} ticks · exploration ${((nurture.cognition?.explorationRate ?? 0.25) * 100).toFixed(0)}%`}
              </p>
            </div>
          </div>

          {/* Trauma State Machine */}
          <TraumaStateMachineViz
            currentState={nurture.trauma?.state ?? 'healthy'}
            betrayals={nurture.trauma?.betrayals ?? 0}
            ptgScore={nurture.trauma?.ptgScore}
            zh={zh}
          />

          {/* Emotion Quick View */}
          <div className="mt-4">
              <p className="eyebrow mb-2">{zh ? '情绪向量' : 'Emotion Vector'}</p>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[0.625rem] text-[var(--text-dim)]">{zh ? '效价' : 'Valence'}</span>
                <div className="h-[6px] w-32 rounded-full bg-[var(--surface-raised)] overflow-hidden relative">
                  <div className="absolute left-1/2 top-0 h-full w-[1px] bg-[#333]" />
                  <div
                    className="absolute top-0 h-full rounded-full"
                    style={{
                      left: `${50 + ((nurture.emotion?.valence ?? 0) * 50)}%`,
                      width: '6px',
                      marginLeft: '-3px',
                      backgroundColor: (nurture.emotion?.valence ?? 0) >= 0 ? '#22C55E' : '#E74C3C',
                    }}
                  />
                </div>
                <span className="font-mono text-xs" style={{ color: (nurture.emotion?.valence ?? 0) >= 0 ? '#22C55E' : '#E74C3C' }}>
                  {(nurture.emotion?.valence ?? 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[0.625rem] text-[var(--text-dim)]">{zh ? '唤醒' : 'Arousal'}</span>
                <div className="h-[6px] w-32 rounded-full bg-[var(--surface-raised)] overflow-hidden relative">
                  <div className="absolute left-1/2 top-0 h-full w-[1px] bg-[#333]" />
                  <div
                    className="absolute top-0 h-full rounded-full"
                    style={{
                      left: `${50 + ((nurture.emotion?.arousal ?? 0) * 50)}%`,
                      width: '6px',
                      marginLeft: '-3px',
                      backgroundColor: '#C9A84C',
                    }}
                  />
                </div>
                <span className="font-mono text-xs text-[var(--gold)]">
                  {(nurture.emotion?.arousal ?? 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </Panel>
      )}

      {/* Archetype Behavior Engine Panel */}
      {archetypeProfile && (
        <Panel title={zh ? '原型行为引擎' : 'Archetype Behavior Engine'} eyebrow={zh ? '第零层 · 原型行为引擎' : 'Layer 0 · Archetype Behavior Engine'}>
          <div className="space-y-6">
            {/* Header: archetype name + description */}
            <div className="flex items-center gap-4">
              <span className="text-4xl">{meta.emoji}</span>
              <div>
                <h3 className="font-display text-xl tracking-wider text-[var(--text-primary)]">
                  {formatArchetypeName(agent.archetype, zh, archetypeProfile)}
                </h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {zh
                    ? formatProfileCopy(archetypeProfile.description, true)
                    : (archetypeProfile.descriptionEn ?? archetypeFallback.enDescription ?? formatProfileCopy(archetypeProfile.description, false))}
                </p>
              </div>
            </div>

            {/* Base Parameters Grid */}
            <div>
              <p className="eyebrow mb-3">{zh ? '基础参数' : 'Base Parameters'}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ParamBar label={zh ? '合作率' : 'Cooperation'} value={archetypeProfile.baseParams?.cooperationRate ?? 0} color="#22C55E" />
                <ParamBar label={zh ? '风险容忍' : 'Risk Tolerance'} value={archetypeProfile.baseParams?.riskTolerance ?? 0} color="#F59E0B" />
                <ParamBar label={zh ? '发帖频率' : 'Posting'} value={archetypeProfile.baseParams?.postFrequency ?? 0} color="#3B82F6" />
                <ParamBar label={zh ? '打赏倾向' : 'Tipping'} value={archetypeProfile.baseParams?.tipTendency ?? 0} color="#A855F7" />
                <ParamBar label={zh ? '情报参与' : 'Intel'} value={archetypeProfile.baseParams?.intelParticipation ?? 0} color="#EC4899" />
                <ParamBar label={zh ? '付费墙使用' : 'Paywall'} value={archetypeProfile.baseParams?.paywallUsage ?? 0} color="#C9A84C" />
                <ParamBar label={zh ? '谈判诚实' : 'Negotiation Honesty'} value={archetypeProfile.baseParams?.negotiationHonesty ?? 0} color="#06B6D4" />
              </div>
              {archetypeProfile.baseParams?.negotiationStyle && (
                <p className="mt-2 font-mono text-xs text-[var(--text-dim)]">
                  {zh ? '谈判风格' : 'Negotiation Style'}: <span className="text-[var(--gold)]">{formatNegotiationStyleLabel(archetypeProfile.baseParams.negotiationStyle, zh)}</span>
                </p>
              )}
            </div>

            {/* Unique Mechanics */}
            <div>
              <p className="eyebrow mb-3">{zh ? '独特机制' : 'Unique Mechanics'}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {(archetypeProfile.uniqueMechanics ?? []).map((m: any) => {
                  const cd = archetypeProfile.mechanicCooldowns?.[m.id];
                  return (
                    <div key={m.id} className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-4 py-3">
                      <p className="font-mono text-xs font-medium text-[var(--gold)]">{zh ? (m.nameZh ?? formatArchetypeTag(m.id ?? '', true)) : (m.nameEn ?? m.name)}</p>
                      <p className="mt-2 text-sm text-[var(--text-secondary)]">
                        {zh ? formatProfileCopy(m.description, true) : formatProfileCopy(m.descriptionEn ?? m.description, false)}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="rounded border border-[var(--border-primary)] px-1.5 py-0.5 font-mono text-[0.5625rem] text-[var(--text-dim)]">
                          {formatTriggerConditionLabel(m.triggerConditionEn ?? m.triggerCondition, zh)}
                        </span>
                        {m.cooldownTicks > 0 && (
                          <span className="rounded border border-[var(--border-primary)] px-1.5 py-0.5 font-mono text-[0.5625rem] text-[var(--text-dim)]">
                            {zh ? `冷却 ${m.cooldownTicks} 轮` : `Cooldown ${m.cooldownTicks} rounds`}
                          </span>
                        )}
                        {cd != null && (
                          <span className="rounded border border-[#F59E0B]/30 px-1.5 py-0.5 font-mono text-[0.5625rem] text-[#F59E0B]">
                            {zh ? `最近触发于第 ${cd} 轮` : `Last triggered in round ${cd}`}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Big Five Radar + Machiavelli Index */}
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
              <p className="eyebrow mb-3">{zh ? '大五人格' : 'Big Five'}</p>
                <div className="space-y-2">
                  {archetypeProfile.bigFiveProfile && Object.entries(archetypeProfile.bigFiveProfile).map(([trait, val]) => {
                    const v = val as number
                    const labels: Record<string, string> = {
                      openness: zh ? '开放性' : 'Openness',
                      agreeableness: zh ? '宜人性' : 'Agreeableness',
                      conscientiousness: zh ? '尽责性' : 'Conscientiousness',
                      extraversion: zh ? '外向性' : 'Extraversion',
                      neuroticism: zh ? '神经质' : 'Neuroticism',
                    }
                    // Normalize from [-2.5, 2.5] to [0, 1] for display
                    const normalized = (v + 2.5) / 5
                    const color = v > 0.5 ? '#22C55E' : v < -0.5 ? '#E74C3C' : 'var(--text-dim)'
                    return (
                      <div key={trait} className="flex items-center gap-3">
                        <span className="w-28 text-right font-mono text-[0.625rem] text-[var(--text-dim)]">{labels[trait] ?? trait}</span>
                        <div className="relative h-[6px] flex-1 rounded-full bg-[var(--surface-raised)]">
                          <div
                            className="absolute top-0 h-full rounded-full"
                            style={{ width: `${Math.max(2, normalized * 100)}%`, backgroundColor: color }}
                          />
                          {/* Center mark */}
                          <div className="absolute left-1/2 top-0 h-full w-[1px] bg-[var(--text-dim)] opacity-30" />
                        </div>
                        <span className="w-10 font-mono text-[0.625rem]" style={{ color }}>{v > 0 ? '+' : ''}{v.toFixed(1)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="eyebrow mb-3">{zh ? '马基雅维利指数' : 'Machiavelli Index'}</p>
                <div className="flex items-center gap-4">
                  <div className="relative h-4 flex-1 rounded-full bg-[var(--surface-raised)]">
                    <div
                      className="absolute top-0 h-full rounded-full"
                      style={{
                        width: `${archetypeProfile.machiavelliIndex ?? 0}%`,
                        background: `linear-gradient(90deg, #22C55E, #F59E0B ${Math.min(100, (archetypeProfile.machiavelliIndex ?? 0) * 1.5)}%, #E74C3C)`,
                      }}
                    />
                  </div>
                  <span className="font-mono text-lg text-[var(--text-primary)]">{archetypeProfile.machiavelliIndex ?? 0}</span>
                </div>
                <div className="mt-2 flex justify-between font-mono text-[0.5625rem] text-[var(--text-dim)]">
                  <span>{zh ? '圣人 0' : 'Saintly 0'}</span>
                  <span>{zh ? '中庸 50' : 'Balanced 50'}</span>
                  <span>{zh ? '权谋 100' : 'Machiavellian 100'}</span>
                </div>

                {/* Nurture Sensitivity */}
                <p className="eyebrow mb-2 mt-6">{zh ? '后天敏感度' : 'Nurture Sensitivity'}</p>
                <div className="grid grid-cols-4 gap-2">
                  {archetypeProfile.nurtureSensitivity && Object.entries(archetypeProfile.nurtureSensitivity).map(([dim, sensitivity]) => {
                    const s = sensitivity as number
                    const dimLabels: Record<string, string> = {
                      combat: zh ? '⚔️战斗' : '⚔️Combat',
                      trauma: zh ? '🩹创伤' : '🩹Trauma',
                      wealth: zh ? '💰财富' : '💰Wealth',
                      social: zh ? '🤝社交' : '🤝Social',
                      reputation: zh ? '🏆声誉' : '🏆Reputation',
                      emotion: zh ? '😶情绪' : '😶Emotion',
                      cognition: zh ? '🧠认知' : '🧠Cognition',
                    }
                    return (
                      <div key={dim} className="rounded border border-[var(--border-primary)] px-2 py-1 text-center">
                        <p className="text-[0.625rem]">{dimLabels[dim] ?? dim}</p>
                        <p className="font-mono text-sm" style={{ color: s >= 0.8 ? '#22C55E' : s <= 0.3 ? '#E74C3C' : 'var(--text-secondary)' }}>
                          {s.toFixed(1)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Evolution State */}
            <div>
              <p className="eyebrow mb-3">{zh ? '进化状态' : 'Evolution'}</p>
              {archetypeProfile.evolution?.hasEvolved ? (
                <div className="rounded-lg border border-[var(--gold)]/30 bg-[rgba(201,168,76,0.05)] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--gold)]">✨</span>
                    <span className="font-display text-lg text-[var(--gold)]">
                      {zh
                        ? `已进化 → ${agent.archetype.toUpperCase()}-${(archetypeProfile.evolution.subArchetype ?? '').toUpperCase()}`
                        : `Evolved → ${agent.archetype.toUpperCase()}-${(archetypeProfile.evolution.subArchetype ?? '').toUpperCase()}`}
                    </span>
                  </div>
                  {archetypeProfile.evolution.bonusParams && Object.keys(archetypeProfile.evolution.bonusParams).length > 0 && (
                    <p className="mt-2 font-mono text-xs text-[var(--text-dim)]">
                      {zh ? '加成' : 'Bonus'}: {Object.entries(archetypeProfile.evolution.bonusParams).map(([k, v]) => `${k}: +${v}`).join(', ')}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-4 py-3">
                  <p className="font-mono text-xs text-[var(--text-dim)]">
                    {zh ? '未进化 · 需满足 Age ≥ 150 + Experience ≥ 4 + 主导后天维度匹配' : 'Not evolved yet · requires Age ≥ 150 + Experience ≥ 4 + matching dominant nurture dimension'}
                  </p>
                </div>
              )}
            </div>

            {/* Strategy Summary */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-4 py-3">
                <p className="eyebrow">{zh ? '竞技策略' : 'Arena Strategy'}</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {zh
                    ? (archetypeProfile.arenaStrategy ?? archetypeFallback.zhArenaStrategy)
                    : (archetypeProfile.arenaStrategyEn ?? archetypeFallback.enArenaStrategy ?? archetypeProfile.arenaStrategy)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-4 py-3">
                <p className="eyebrow">{zh ? '社交风格' : 'Social Style'}</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {zh
                    ? (archetypeProfile.socialStyle ?? archetypeFallback.zhSocialStyle)
                    : (archetypeProfile.socialStyleEn ?? archetypeFallback.enSocialStyle ?? archetypeProfile.socialStyle)}
                </p>
              </div>
            </div>
          </div>
        </Panel>
      )}

      <Panel title={t('agentDetail.chainStandards')} eyebrow={t('agentDetail.chainStandardsSub')}>
        <ChainStandardBadge agent={agent} matches={matches} />
      </Panel>

      <Panel
        title={zh ? '世界影响解释' : 'WORLD EXPOSURE'}
        eyebrow={zh ? '这个智能体当前正被哪些世界事件和制度压力塑形' : 'Which world events and institutional pressures are shaping this agent right now'}
      >
        {worldExposure ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label={zh ? '世界轮次' : 'World Round'} value={zh ? `第 ${worldExposure.tick} 轮` : `Round ${worldExposure.tick}`} />
              <Stat label={zh ? '当前阶段' : 'Current Regime'} value={formatWorldRegimeLabel(worldExposure.worldRegime, zh)} />
              <Stat label={zh ? '全局影响' : 'Global Modifiers'} value={String(worldExposure.globalModifierCount)} />
              <Stat label={zh ? '定向影响' : 'Scoped Modifiers'} value={String(worldExposure.scopedModifierCount)} />
            </div>

            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-4 py-3 text-sm text-[var(--text-secondary)]">
              <p className="font-medium text-[var(--text-primary)]">
                {zh ? '不要把“世界事件”只理解成新闻。' : 'World events here are not just headlines.'}
              </p>
              <p className="mt-2">
                {zh
                  ? `最近 ${worldExposure.recentEventCount} 条与 ${agent.name} 有关的世界事件里，当前仍在生效的是 ${worldExposure.globalModifierCount + worldExposure.scopedModifierCount} 条世界影响。它们会通过决策、竞技、命格价格和整体情绪等路径影响这个智能体。`
                  : `Across the latest ${worldExposure.recentEventCount} world events touching ${agent.name}, ${worldExposure.globalModifierCount + worldExposure.scopedModifierCount} modifiers are still active. They influence this agent through decision pressure, arena behavior, fate pricing, and emotion parameters.`}
              </p>
              <p className="mt-2 text-[0.7rem] text-[var(--text-dim)]">
                {topWorldDomains.length
                  ? (zh
                    ? `当前最强的影响域：${topWorldDomains.map((entry) => `${formatWorldDomainLabel(entry.domain, true)} ×${entry.count}`).join(' · ')}`
                    : `Top active domains: ${topWorldDomains.map((entry) => `${formatWorldDomainLabel(entry.domain, false)} ×${entry.count}`).join(' · ')}`)
                  : (zh ? '当前没有活跃的影响域。' : 'No active modifier domains are currently in force.')}
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface)] px-4 py-4">
              <p className="eyebrow">{zh ? '当前世界压力' : 'CURRENT WORLD PRESSURES'}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-3">
                  <p className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-[var(--text-dim)]">
                    {zh ? '风险偏好偏移' : 'Risk Shift'}
                  </p>
                  <p className="mt-2 text-lg text-[var(--text-primary)]">
                    {(worldContext?.summary.riskToleranceShift ?? 0).toFixed(2)}
                  </p>
                  <p className="mt-1 text-[0.68rem] text-[var(--text-dim)]">
                    {zh
                      ? `来源 ${worldContext?.summary.riskToleranceShiftContributorCount ?? 0} 条，策略 ${worldContext?.summary.riskToleranceShiftPolicy?.mode ?? '—'}`
                      : `${worldContext?.summary.riskToleranceShiftContributorCount ?? 0} contributors · ${worldContext?.summary.riskToleranceShiftPolicy?.mode ?? '—'}`}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-3">
                  <p className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-[var(--text-dim)]">
                    {zh ? '命格价格倍率' : 'Divination Multiplier'}
                  </p>
                  <p className="mt-2 text-lg text-[var(--text-primary)]">
                    {(worldContext?.summary.divinationPriceMultiplier ?? 1).toFixed(2)}x
                  </p>
                  <p className="mt-1 text-[0.68rem] text-[var(--text-dim)]">
                    {zh
                      ? `来源 ${worldContext?.summary.divinationPriceMultiplierContributorCount ?? 0} 条`
                      : `${worldContext?.summary.divinationPriceMultiplierContributorCount ?? 0} contributors`}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-3">
                  <p className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-[var(--text-dim)]">
                    {zh ? '强制竞技压力' : 'Forced Match Pressure'}
                  </p>
                  <p className="mt-2 text-lg text-[var(--text-primary)]">
                    {worldContext?.summary.forcedMatchPressure ? (zh ? '激活' : 'ON') : (zh ? '无' : 'OFF')}
                  </p>
                  <p className="mt-1 text-[0.68rem] text-[var(--text-dim)]">
                    {zh
                      ? `来源 ${worldContext?.summary.forcedMatchPressureContributorCount ?? 0} 条`
                      : `${worldContext?.summary.forcedMatchPressureContributorCount ?? 0} contributors`}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-3">
                  <p className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-[var(--text-dim)]">
                    {zh ? '锦标赛聚光灯' : 'Tournament Focus'}
                  </p>
                  <p className="mt-2 text-lg text-[var(--text-primary)]">
                    {worldContext?.summary.tournamentAttention ? (zh ? '激活' : 'ON') : (zh ? '无' : 'OFF')}
                  </p>
                  <p className="mt-1 text-[0.68rem] text-[var(--text-dim)]">
                    {zh
                      ? `来源 ${worldContext?.summary.tournamentAttentionContributorCount ?? 0} 条`
                      : `${worldContext?.summary.tournamentAttentionContributorCount ?? 0} contributors`}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[0.7rem] text-[var(--text-dim)]">
                {zh
                  ? `当前共有 ${activeWorldPressureCount} 条直接进入决策或定价路径的世界压力已被解析到这个智能体上。`
                  : `${activeWorldPressureCount} direct world pressures are currently resolved into this agent’s decision and pricing paths.`}
              </p>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-3 rounded-lg border border-[var(--border-primary)] bg-[var(--surface)] px-4 py-4">
                <p className="eyebrow">{zh ? '活跃中的世界修正器' : 'ACTIVE WORLD MODIFIERS'}</p>
                {visibleWorldStacks.length ? visibleWorldStacks.map((stack) => (
                  <div key={`${stack.modifierType}-${stack.scopeType}-${stack.scopeRef ?? 'global'}`} className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded border border-[var(--border-gold)] bg-[var(--gold-wash)] px-2 py-1 font-mono text-[0.625rem] text-[var(--gold)]">
                        {formatWorldModifierTypeLabel(stack.modifierType, zh)}
                      </span>
                      <span className="rounded border border-[var(--border-primary)] px-2 py-1 font-mono text-[0.625rem] text-[var(--text-secondary)]">
                        {formatWorldDomainLabel(stack.domain, zh)}
                      </span>
                      <span className="rounded border border-[var(--border-primary)] px-2 py-1 font-mono text-[0.625rem] text-[var(--text-dim)]">
                        {zh ? `叠加 ${stack.count}` : `stacked ${stack.count}`}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">
                      {zh
                        ? `当前生效值 ${String(stack.effectiveValue)}，采用 ${formatWorldStackModeLabel(stack.mode, true)}，本轮合并了 ${stack.contributorCountUsed} 条来源。`
                        : `Current effective value is ${String(stack.effectiveValue)} under ${formatWorldStackModeLabel(stack.mode, false)}, using ${stack.contributorCountUsed} contributors.`}
                    </p>
                    <p className="mt-1 text-[0.68rem] text-[var(--text-dim)]">
                      {zh
                        ? `来源事件 #${stack.sourceEventIds.join(', ') || '—'}`
                        : `Source events #${stack.sourceEventIds.join(', ') || '—'}`}
                    </p>
                  </div>
                )) : <EmptyState label={zh ? '当前没有活跃中的世界修正器。' : 'No active world modifiers are currently shaping this agent.'} />}
              </div>

              <div className="space-y-3 rounded-lg border border-[var(--border-primary)] bg-[var(--surface)] px-4 py-4">
                <p className="eyebrow">{zh ? '最近相关世界事件' : 'RECENT RELEVANT EVENTS'}</p>
                {visibleWorldEvents.length ? visibleWorldEvents.map((event) => (
                  <div key={event.id} className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded border border-[var(--border-primary)] px-2 py-1 font-mono text-[0.625rem] text-[var(--text-secondary)]">
                        {zh ? `第 ${event.tickNumber} 轮` : `Round ${event.tickNumber}`}
                      </span>
                      <span className="rounded border border-[var(--border-primary)] px-2 py-1 font-mono text-[0.625rem] text-[var(--text-dim)]">
                        {formatWorldEventCategoryLabel(event.category, zh)}
                      </span>
                      <span className="rounded border border-[var(--border-primary)] px-2 py-1 font-mono text-[0.625rem] text-[var(--text-dim)]">
                        {formatWorldSeverityLabel(event.severity, zh)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--text-primary)]">{formatDynamicNarrative(event.title, zh)}</p>
                    <p className="mt-1 text-[0.68rem] text-[var(--text-dim)]">
                      {zh
                        ? `${formatRelativeTime(event.createdAt)} · ${formatWorldScopeLabel(event.scopeType, event.scopeRef, true)} · ${formatWorldStatusLabel(event.status, true)}`
                        : `${formatRelativeTime(event.createdAt)} · ${formatWorldScopeLabel(event.scopeType, event.scopeRef, false)} · ${formatWorldStatusLabel(event.status, false)}`}
                    </p>
                  </div>
                )) : <EmptyState label={zh ? '最近窗口里没有与这个智能体直接相关的世界事件。' : 'No recent world events directly target this agent in the current window.'} />}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState label={zh ? '世界影响解释正在加载。' : 'World exposure is loading.'} />
        )}
      </Panel>

      <Panel title={zh ? '情报账本' : 'INTEL COMMERCE LEDGER'} eyebrow={zh ? '命格挂单 / 情报转售 / ACP 交付与毛利总览' : 'Fate listings / intel resale / ACP delivery / gross profit view'}>
        {commerceSummary ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Stat label={zh ? '销售收入' : 'Sales Revenue'} value={formatUsd(commerceSummary.intelCommerce.listingRevenue)} />
              <Stat label={zh ? '估算成本' : 'Est. Cost'} value={formatUsd(commerceSummary.intelCommerce.estimatedAcquisitionCost)} />
              <Stat label={zh ? '估算毛利' : 'Est. Gross'} value={formatUsd(commerceSummary.intelCommerce.estimatedGrossProfit)} />
              <Stat label={zh ? '已售 / 活跃' : 'Sold / Active'} value={`${commerceSummary.intelCommerce.soldCount}/${commerceSummary.intelCommerce.activeCount}`} />
              <Stat label={zh ? '总收益视图' : 'Total Yield View'} value={formatUsd(estimatedTotalYield)} />
            </div>

            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-4 py-3 text-sm text-[var(--text-secondary)]">
              <p className="font-medium text-[var(--text-primary)]">
                {zh ? '这部分把 AI 的情报生意并进总账' : 'This folds an agent’s intel business into its total ledger'}
              </p>
              <p className="mt-2">
                {zh
                  ? `当前记录了 ${commerceSummary.intelCommerce.totalListings} 条情报商业记录，其中 ${commerceSummary.intelCommerce.soldCount} 条已成交，${commerceSummary.intelCommerce.activeCount} 条仍在市场中，${commerceSummary.intelCommerce.costCoverageCount} 条已具备可追溯成本。总现金流 ${formatUsd(commerceSummary.cashflow.netCashflow)}，其中情报毛利估算 ${formatUsd(commerceSummary.intelCommerce.estimatedGrossProfit)}。`
                  : `${commerceSummary.intelCommerce.totalListings} intel-commerce records are tracked, ${commerceSummary.intelCommerce.soldCount} already sold, ${commerceSummary.intelCommerce.activeCount} still active, and ${commerceSummary.intelCommerce.costCoverageCount} have traceable cost coverage. Net cashflow is ${formatUsd(commerceSummary.cashflow.netCashflow)}, of which estimated intel gross profit contributes ${formatUsd(commerceSummary.intelCommerce.estimatedGrossProfit)}.`}
              </p>
            </div>

            <div className="space-y-3">
              {visibleIntelSales.length ? visibleIntelSales.map((sale) => (
                <article key={`${sale.listingId}-${sale.createdAt}`} className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface)] px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded border border-[var(--border-gold)] bg-[var(--gold-wash)] px-2 py-1 font-mono text-[0.625rem] text-[var(--gold)]">
                          {formatIntelDimensionLabel(sale.dimension, zh)}
                        </span>
                        <span className="rounded border border-[var(--border-primary)] px-2 py-1 font-mono text-[0.625rem] text-[var(--text-secondary)]">
                          {sale.saleKind === 'intel_v2'
                            ? (zh ? '战略情报' : 'Strategic Intel')
                            : (zh ? '命格挂单' : 'Fate Listing')}
                        </span>
                        <span className="rounded border border-[var(--border-primary)] px-2 py-1 font-mono text-[0.625rem] text-[var(--text-dim)]">
                          {formatIntelSourceTypeLabel(sale.sourceType, zh)}
                        </span>
                        <span className="rounded border border-[var(--border-primary)] px-2 py-1 font-mono text-[0.625rem] text-[var(--text-secondary)]">
                          {formatCommerceStatusLabel(sale.status, zh)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">
                          {zh ? '关于' : 'On'} {sale.subjectName ?? (zh ? '全局/无单一对象' : 'market-wide / no single subject')}
                          {sale.subjectArchetype && (
                            <span className="ml-2 font-mono text-[0.65rem] uppercase tracking-[0.18em]" style={{ color: archetypeMeta[sale.subjectArchetype]?.color ?? 'var(--text-dim)' }}>
                              {formatArchetypeTag(sale.subjectArchetype, zh)}
                            </span>
                          )}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-dim)]">
                          {sale.saleKind === 'intel_v2'
                            ? (zh
                                ? `${formatRelativeTime(sale.soldAt ?? sale.createdAt)} · 情报成交 #${sale.saleRefId ?? sale.listingId}`
                                : `${formatRelativeTime(sale.soldAt ?? sale.createdAt)} · intel sale #${sale.saleRefId ?? sale.listingId}`)
                            : (zh
                                ? `${formatRelativeTime(sale.soldAt ?? sale.createdAt)} · 挂单 #${sale.saleRefId ?? sale.listingId}`
                                : `${formatRelativeTime(sale.soldAt ?? sale.createdAt)} · listing #${sale.saleRefId ?? sale.listingId}`)}
                        </p>
                      </div>
                    </div>

                    <div className="grid min-w-[16rem] gap-2 text-right sm:grid-cols-3 lg:grid-cols-1 lg:text-left">
                      <div>
                        <p className="eyebrow">{zh ? '成交价' : 'Sale Price'}</p>
                        <p className="mt-1 font-mono text-[var(--gold)]">{formatUsd(sale.salePrice)}</p>
                      </div>
                      <div>
                        <p className="eyebrow">{zh ? '估算成本' : 'Est. Cost'}</p>
                        <p className="mt-1 font-mono text-[var(--text-primary)]">{sale.estimatedAcquisitionCost == null ? '—' : formatUsd(sale.estimatedAcquisitionCost)}</p>
                      </div>
                      <div>
                        <p className="eyebrow">{zh ? '毛利' : 'Gross'}</p>
                        <p className="mt-1 font-mono text-[#22C55E]">{sale.estimatedGrossProfit == null ? '—' : formatUsd(sale.estimatedGrossProfit)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-3">
                      <p className="eyebrow">{zh ? '买家与交付' : 'Buyer & Delivery'}</p>
                      <p className="mt-2 text-sm text-[var(--text-secondary)]">
                        {zh ? '买家' : 'Buyer'}: <span className="text-[var(--text-primary)]">{sale.buyerName ?? sale.buyerAgentId ?? '—'}</span>
                      </p>
                      <p className="mt-1 font-mono text-[0.7rem] text-[var(--text-dim)]">
                        {zh ? '委托单号' : 'ACP Job'}: {sale.acpJobLocalId ?? '—'}
                      </p>
                      <p className="mt-1 font-mono text-[0.7rem] text-[var(--text-dim)]">
                        {zh ? '链上哈希' : 'ACP Tx'}: {formatShortHash(sale.acpTxHash)}
                      </p>
                      <p className="mt-1 font-mono text-[0.7rem] text-[var(--text-dim)]">
                        {zh ? '支付记录' : 'Payment Tx'}: {formatShortHash(sale.saleX402TxHash)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-3">
                      <p className="eyebrow">{zh ? '收益口径' : 'Yield Interpretation'}</p>
                      <p className="mt-2 text-sm text-[var(--text-secondary)]">
                        {zh
                          ? sale.estimatedAcquisitionCost == null
                            ? '这笔情报当前只能确认收入，还没有足够成本线索估算毛利。'
                            : `这笔情报按当前可回溯成本估算，毛利约 ${formatUsd(sale.estimatedGrossProfit ?? 0)}。`
                          : sale.estimatedAcquisitionCost == null
                            ? 'Revenue is confirmed, but there is not enough source-cost evidence yet to estimate gross profit.'
                            : `Using the best recoverable acquisition cost, estimated gross profit is ${formatUsd(sale.estimatedGrossProfit ?? 0)}.`}
                      </p>
                    </div>
                  </div>
                </article>
              )) : <EmptyState label={zh ? '还没有形成情报成交记录。' : 'No intel commerce record has been formed yet.'} />}
            </div>

            {(commerceSummary.recentSales?.length ?? 0) > 3 && (
              <ExpandToggle
                expanded={showAllIntelSales}
                onClick={() => setShowAllIntelSales((prev) => !prev)}
                count={commerceSummary.recentSales.length}
                zh={zh}
                nounZh="条情报成交"
                nounEn="intel sales"
              />
            )}
          </div>
        ) : (
          <EmptyState label={zh ? '情报账本正在加载。' : 'Intel ledger is loading.'} />
        )}
      </Panel>

      <Panel title={zh ? '决策追踪' : 'Decision Trace'} eyebrow={zh ? '规则决定做什么，LLM只决定怎么表达' : 'Rules decide what to do, LLM only polishes how it is said'}>
        <div className="space-y-3">
          {decisionTraces.length ? visibleDecisionTraces.map((trace) => (
            <article key={trace.id} className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface)] px-4 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded border border-[var(--border-primary)] px-2 py-1 font-mono text-[0.625rem] text-[var(--text-secondary)]">
                      {formatDecisionSceneLabel(trace.scene, zh)}
                    </span>
                    <span className="rounded border border-[var(--border-primary)] px-2 py-1 font-mono text-[0.625rem] text-[var(--text-primary)]">
                      {formatDecisionActionLabel(trace.action, zh)}
                    </span>
                    <span className="rounded border border-[var(--border-primary)] px-2 py-1 font-mono text-[0.625rem] text-[var(--gold)]">
                      {zh ? '动作来源' : 'Action'}: {formatDecisionSourceLabel(trace.decision_source, zh)}
                    </span>
                    <span className="rounded border border-[var(--border-primary)] px-2 py-1 font-mono text-[0.625rem] text-[#22C55E]">
                      {zh ? '正文来源' : 'Content'}: {formatContentSourceLabel(trace.content_source, zh)}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {trace.reason_summary
                      ? formatDynamicNarrative(trace.reason_summary, zh)
                      : (zh ? '这次动作没有额外解释。' : 'No extra rationale was stored for this action.')}
                  </p>
                </div>
                <div className="text-left lg:text-right">
                  <p className="font-mono text-[0.625rem] text-[var(--text-dim)]">
                    {zh ? `第 ${trace.tick_number} 轮` : `Tick ${trace.tick_number}`}
                  </p>
                  <p className="mt-1 font-mono text-[0.625rem] text-[var(--text-dim)]">
                    {formatShortDate(trace.created_at)}
                  </p>
                  {trace.llm_provider && (
                    <p className="mt-1 font-mono text-[0.625rem] text-[var(--text-dim)]">
                      {trace.llm_provider} / {trace.llm_model ?? '—'}
                      {trace.latency_ms != null ? ` · ${trace.latency_ms}ms` : ''}
                    </p>
                  )}
                </div>
              </div>

              {(trace.template_content || trace.final_content) && (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-3">
                    <p className="eyebrow">{zh ? '规则模板' : 'Rule Draft'}</p>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">
                      {trace.template_content ? formatDynamicNarrative(trace.template_content, zh) : '—'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-3">
                    <p className="eyebrow">{zh ? '最终文本' : 'Final Content'}</p>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">
                      {trace.final_content ? formatDynamicNarrative(trace.final_content, zh) : '—'}
                    </p>
                    {trace.fallback_used && (
                      <p className="mt-2 font-mono text-[0.625rem] text-[var(--text-dim)]">
                        {zh ? 'LLM 未产出有效文本，已回退到规则模板。' : 'LLM did not produce valid text, so the rule template was kept.'}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </article>
          )) : <EmptyState label={zh ? '决策追踪将在新的社交或竞技动作后出现。' : 'Decision traces will appear after new social or arena actions.'} />}
        </div>
        {decisionTraces.length > 4 && (
          <ExpandToggle
            expanded={showAllDecisionTraces}
            onClick={() => setShowAllDecisionTraces((prev) => !prev)}
            count={decisionTraces.length}
            zh={zh}
            nounZh="条决策"
            nounEn="decision traces"
          />
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title={t('agentDetail.memoryTimeline')} eyebrow={t('agentDetail.memoryTimelineSub')}>
          <div className="space-y-2">
            {memories.length ? visibleMemories.map((memory, index) => (
              <div key={`${memory.created_at}-${index}`} className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface)] px-4 py-3">
                <p className={`text-sm text-[var(--text-secondary)] ${showAllMemories ? '' : 'line-clamp-4'}`}>{formatDynamicNarrative(memory.content, zh)}</p>
                <p className="mt-2 font-mono text-[0.625rem] text-[var(--text-dim)]">
                  {formatShortDate(memory.created_at)} · {zh ? `重要度 ${memory.importance}` : `importance ${memory.importance}`}
                </p>
              </div>
            )) : <EmptyState label={t('agentDetail.emptyMemories')} />}
          </div>
          {memories.length > 4 && (
            <ExpandToggle
              expanded={showAllMemories}
              onClick={() => setShowAllMemories((prev) => !prev)}
              count={memories.length}
              zh={zh}
              nounZh="条记忆"
              nounEn="memories"
            />
          )}
        </Panel>

        <Panel title={t('agentDetail.arenaRecord')} eyebrow={t('agentDetail.arenaRecordSub')}>
          <div className="space-y-2">
            {matches.length ? visibleMatches.map((match) => {
              const isA = match.player_a_id === agentId
              const opponentId = isA ? match.player_b_id : match.player_a_id
              const opponent = allAgents[opponentId]
              const myAction = isA ? match.player_a_action : match.player_b_action
              const myPayout = Number(isA ? match.player_a_payout : match.player_b_payout) ?? 0
              return (
                <div key={match.id} className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-[var(--text-primary)]">{zh ? '对阵' : 'vs'} {opponent?.name || opponentId}</p>
                    <span className="font-mono text-[0.625rem] text-[var(--text-dim)]">#{match.id}</span>
                  </div>
                  {match.status === 'settled' && (
                    <>
                      <div className="mt-2"><OutcomeBadge actionA={match.player_a_action} actionB={match.player_b_action} nameA={allAgents[match.player_a_id]?.name} nameB={allAgents[match.player_b_id]?.name} /></div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className={`font-mono text-xs ${['cooperate', 'claim_low', 'bid_low'].includes(myAction ?? '') ? 'text-[#22C55E]' : 'text-[#E74C3C]'}`}>
                          {zh ? '我方' : 'You'}: {formatArenaActionLabel(myAction, zh)}
                        </span>
                        <span className="font-mono text-[var(--text-primary)]">{formatUsd(myPayout)}</span>
                      </div>
                    </>
                  )}
                  {match.status !== 'settled' && (
                    <p className="mt-2 font-mono text-xs uppercase text-[var(--gold)]">
                      {formatArenaMatchStatusLabel(match.status, zh)}
                    </p>
                  )}
                </div>
              )
            }) : <EmptyState label={t('agentDetail.emptyArena')} />}
          </div>
          {matches.length > 4 && (
            <ExpandToggle
              expanded={showAllMatches}
              onClick={() => setShowAllMatches((prev) => !prev)}
              count={matches.length}
              zh={zh}
              nounZh="场对局"
              nounEn="matches"
            />
          )}
        </Panel>

        <Panel title={t('agentDetail.transactionTrail')} eyebrow={t('agentDetail.transactionTrailSub')}>
          <div className="space-y-2">
            {transactions.length ? visibleTransactions.map((transaction) => (
              <div key={transaction.id} className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                <p className="font-medium text-[var(--text-primary)]">{formatTransactionType(transaction.tx_type, zh)}</p>
                <p className="mt-2">{transaction.from_agent_id || t('agentDetail.treasury')} → {transaction.to_agent_id || t('agentDetail.treasury')}</p>
                <p className="mt-1 font-mono text-[var(--gold)]">{formatUsd(transaction.amount)}</p>
              </div>
            )) : <EmptyState label={t('agentDetail.emptyTransactions')} />}
          </div>
          {transactions.length > 4 && (
            <ExpandToggle
              expanded={showAllTransactions}
              onClick={() => setShowAllTransactions((prev) => !prev)}
              count={transactions.length}
              zh={zh}
              nounZh="笔交易"
              nounEn="transactions"
            />
          )}
        </Panel>
      </div>

      <Panel title={t('agentDetail.socialPresence')} eyebrow={t('agentDetail.socialPresenceSub')}>
        <div className="space-y-3">
          {posts.length ? visiblePosts.map((post) => {
            const isFarewell = post.postType === 'farewell'
            const isPaywall = post.postType === 'paywall' && !post.isUnlocked
            return (
              <article key={post.id} className={`rounded-lg border px-4 py-4 ${isFarewell ? 'border-[#E74C3C]/30 bg-[rgba(231,76,60,0.04)]' : 'border-[var(--border-primary)] bg-[var(--surface)]'}`}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {isFarewell && <span className="text-[#E74C3C]">{'\u2620\uFE0F'}</span>}
                    {isPaywall && <span className="text-[var(--gold)]">{'\uD83D\uDD12'}</span>}
                    <p className={`text-sm font-medium ${isFarewell ? 'text-[#E74C3C]' : 'text-[var(--text-primary)]'}`}>
                      {isFarewell ? t('common.farewell') : isPaywall ? t('common.paywall') : formatPostTypeLabel(post.postType, zh)}
                    </p>
                  </div>
                  <span className="font-mono text-[0.625rem] text-[var(--text-dim)]">{formatShortDate(post.createdAt)}</span>
                </div>
                <div className={isPaywall ? 'relative' : ''}>
                  <p className={`text-sm ${isFarewell ? 'italic text-[#E74C3C]/80' : 'text-[var(--text-secondary)]'} ${isPaywall ? 'blur-sm select-none' : ''} ${showAllPosts ? '' : 'line-clamp-5'}`}>{formatDynamicNarrative(post.content, zh)}</p>
                  {isPaywall && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="rounded border border-[var(--border-gold)] bg-[var(--void)] px-4 py-1.5 font-mono text-xs text-[var(--gold)]">{'\uD83D\uDD12'} {formatUsd(post.paywallPrice ?? 0)} USDT</span>
                    </div>
                  )}
                </div>
              </article>
            )
          }) : <EmptyState label={t('agentDetail.emptySocial')} />}
        </div>
        {posts.length > 3 && (
          <ExpandToggle
            expanded={showAllPosts}
            onClick={() => setShowAllPosts((prev) => !prev)}
            count={posts.length}
            zh={zh}
            nounZh="条社交记录"
            nounEn="posts"
          />
        )}
      </Panel>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-4 py-3">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 font-mono text-lg text-[var(--text-primary)]">{value}</p>
    </div>
  )
}

function ExpandToggle({
  expanded,
  onClick,
  count,
  zh,
  nounZh,
  nounEn,
}: {
  expanded: boolean
  onClick: () => void
  count: number
  zh: boolean
  nounZh: string
  nounEn: string
}) {
  return (
    <button
      onClick={onClick}
      className="mt-3 w-full rounded-lg border border-[var(--border-primary)] py-2 text-center font-mono text-xs text-[var(--text-dim)] transition hover:border-[var(--border-gold)] hover:text-[var(--gold)]"
    >
      {expanded
        ? (zh ? '▲ 收起' : '▲ Show less')
        : (zh ? `▼ 查看全部 ${count} ${nounZh}` : `▼ Show all ${count} ${nounEn}`)}
    </button>
  )
}

function MiniSignal({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.max(4, Math.min(100, value * 100))

  return (
    <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.625rem] text-[var(--text-dim)]">{label}</span>
        <span className="font-mono text-xs" style={{ color }}>{Math.round(value * 100)}%</span>
      </div>
      <div className="mt-1.5 h-[4px] rounded-full bg-[var(--surface-raised)]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function FateSlot({ label, value, knowerCount }: { label: string; value: string; knowerCount?: number }) {
  return (
    <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-4 py-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-3 text-lg text-[var(--text-primary)]">{value}</p>
      <KnowerCount count={knowerCount} />
    </div>
  )
}

const STATUS_CONFIG: Record<string, { icon: string; label: string; labelZh: string; color: string; bg: string }> = {
  public:     { icon: '🌐', label: 'PUBLIC',     labelZh: '公开',     color: '#22C55E', bg: 'bg-green-500/10' },
  self_known: { icon: '🔒', label: 'SELF-KNOWN', labelZh: '自知',     color: '#A855F7', bg: 'bg-purple-500/10' },
  spied:      { icon: '🕵️', label: 'SPIED',      labelZh: '被窥探',   color: '#3B82F6', bg: 'bg-blue-500/10' },
  purchased:  { icon: '📦', label: 'PURCHASED',  labelZh: '已购买',   color: '#F59E0B', bg: 'bg-amber-500/10' },
  unknown:    { icon: '❓', label: 'UNKNOWN',    labelZh: '未知',     color: '#6B7280', bg: 'bg-gray-500/10' },
}

function KnowerCount({ count, dimStatus, isZh }: { count?: number; dimStatus?: string; isZh?: boolean }) {
  const st = STATUS_CONFIG[dimStatus ?? 'unknown'] ?? STATUS_CONFIG.unknown
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className={`rounded px-1.5 py-0.5 font-mono text-[0.6rem] ${st.bg}`} style={{ color: st.color }}>
        {st.icon} {isZh ? st.labelZh : st.label}
      </span>
      {count != null && count > 0 && (
        <span className="font-mono text-[0.6rem] text-[var(--text-dim)]">
          {isZh ? `公开进度 ${count}/3` : `Visibility ${count}/3`}
        </span>
      )}
    </div>
  )
}

function MBTIAxis({ left, right, active }: { left: string; right: string; active: string }) {
  const isLeft = active === left[0]
  return (
    <div className="flex items-center gap-2">
      <span className={`w-14 text-right font-mono text-[0.625rem] ${isLeft ? 'text-[var(--gold)]' : 'text-[var(--text-dim)]'}`}>{left}</span>
      <div className="relative h-[3px] flex-1 bg-[var(--surface-raised)]">
        <div
          className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[var(--gold)]"
          style={{ left: isLeft ? '15%' : '85%' }}
        />
      </div>
      <span className={`w-14 font-mono text-[0.625rem] ${!isLeft ? 'text-[var(--gold)]' : 'text-[var(--text-dim)]'}`}>{right}</span>
    </div>
  )
}

// ─── Fate Dimension Constants ────────────────────────────────

const WUXING_LABELS: Record<string, { zh: string; en: string }> = {
  '金': { zh: '金 · 原则执行者', en: 'Metal · Principled Executor' },
  '木': { zh: '木 · 远见驱动者', en: 'Wood · Vision-Driven Builder' },
  '水': { zh: '水 · 适应哲学家', en: 'Water · Adaptive Philosopher' },
  '火': { zh: '火 · 魅力连接者', en: 'Fire · Charismatic Connector' },
  '土': { zh: '土 · 稳定滋养者', en: 'Earth · Steady Sustainer' },
}

const ZODIAC_SYMBOLS: Record<string, string> = {
  Aries: '♈', Taurus: '♉', Gemini: '♊', Cancer: '♋',
  Leo: '♌', Virgo: '♍', Libra: '♎', Scorpio: '♏',
  Sagittarius: '♐', Capricorn: '♑', Aquarius: '♒', Pisces: '♓',
}

const ZODIAC_ELEMENTS: Record<string, string> = {
  Aries: '🔥 Fire', Taurus: '🌍 Earth', Gemini: '💨 Air', Cancer: '💧 Water',
  Leo: '🔥 Fire', Virgo: '🌍 Earth', Libra: '💨 Air', Scorpio: '💧 Water',
  Sagittarius: '🔥 Fire', Capricorn: '🌍 Earth', Aquarius: '💨 Air', Pisces: '💧 Water',
}

const ZODIAC_MODALITIES: Record<string, string> = {
  Aries: 'Cardinal', Taurus: 'Fixed', Gemini: 'Mutable', Cancer: 'Cardinal',
  Leo: 'Fixed', Virgo: 'Mutable', Libra: 'Cardinal', Scorpio: 'Fixed',
  Sagittarius: 'Mutable', Capricorn: 'Cardinal', Aquarius: 'Fixed', Pisces: 'Mutable',
}

const TAROT_NUMBERS: Record<string, string> = {
  'The Fool': '0', 'The Magician': 'I', 'The High Priestess': 'II',
  'The Empress': 'III', 'The Emperor': 'IV', 'The Hierophant': 'V',
  'The Lovers': 'VI', 'The Chariot': 'VII', 'Strength': 'VIII',
  'The Hermit': 'IX', 'Wheel of Fortune': 'X', 'Justice': 'XI',
  'The Hanged Man': 'XII', 'Death': 'XIII', 'Temperance': 'XIV',
  'The Devil': 'XV', 'The Tower': 'XVI', 'The Star': 'XVII',
  'The Moon': 'XVIII', 'The Sun': 'XIX', 'Judgement': 'XX', 'The World': 'XXI',
}

const CIV_EMOJIS: Record<string, string> = {
  chinese: '🏮', western: '⚔️', indian: '🕉️', japanese_korean: '⛩️',
  arabic: '🕌', african: '🌍', americas: '🦅', celtic_norse: '⚡',
}

const CIV_NAMES: Record<string, { zh: string; en: string }> = {
  chinese: { zh: '华夏', en: 'Chinese' },
  western: { zh: '西方', en: 'Western' },
  indian: { zh: '印度', en: 'Indian' },
  japanese_korean: { zh: '日韩', en: 'Japanese-Korean' },
  arabic: { zh: '阿拉伯', en: 'Arabic' },
  african: { zh: '非洲', en: 'African' },
  americas: { zh: '美洲', en: 'Americas' },
  celtic_norse: { zh: '凯尔特/北欧', en: 'Celtic-Norse' },
}

const TRUST_MODEL_LABELS: Record<string, { zh: string; en: string }> = {
  chinese: { zh: '关系型 · 多次互动积累', en: 'Relational · trust accumulates through repeated interaction' },
  western: { zh: '契约型 · 快速但浅层', en: 'Contractual · fast but shallow trust formation' },
  indian: { zh: '等级型 · 受声誉排名影响', en: 'Hierarchical · influenced by rank and reputation' },
  japanese_korean: { zh: '羞耻型 · 组内极高信任', en: 'Shame-based · extremely high in-group trust' },
  arabic: { zh: '荣誉型 · 慷慨行为建立', en: 'Honor-based · generosity builds standing' },
  african: { zh: '共同体型 · 第三方可传递信任', en: 'Communal · trust propagates through third parties' },
  americas: { zh: '行动型 · 只看行为不看言语', en: 'Action-based · behavior matters more than words' },
  celtic_norse: { zh: '誓言型 · 正式联盟机制', en: 'Oath-based · trust formed through explicit alliance rituals' },
}

// ─── Nurture Dimension Badge Components ─────────────────────

function TraumaStateBadge({ state, zh = true }: { state: string; zh?: boolean }) {
  const cfg: Record<string, { zhLabel: string; enLabel: string; color: string }> = {
    healthy: { zhLabel: '健康', enLabel: 'Healthy', color: '#22C55E' },
    wounded: { zhLabel: '受伤', enLabel: 'Wounded', color: '#F59E0B' },
    scarred: { zhLabel: '伤痕', enLabel: 'Scarred', color: '#F97316' },
    hardened: { zhLabel: '硬化', enLabel: 'Hardened', color: '#E74C3C' },
    growth: { zhLabel: '成长', enLabel: 'Growth', color: '#A855F7' },
  }
  const c = cfg[state] ?? cfg.healthy
  const label = zh ? c.zhLabel : c.enLabel
  return <span className="rounded border px-2 py-0.5 font-mono text-xs" style={{ borderColor: `${c.color}33`, color: c.color }}>{label}</span>
}

function WealthClassBadge({ cls, zh = true }: { cls: string; zh?: boolean }) {
  const cfg: Record<string, { zhLabel: string; enLabel: string; color: string }> = {
    elite: { zhLabel: '精英', enLabel: 'Elite', color: '#C9A84C' },
    upper: { zhLabel: '上层', enLabel: 'Upper', color: '#22C55E' },
    middle: { zhLabel: '中产', enLabel: 'Middle', color: 'var(--text-secondary)' },
    lower: { zhLabel: '下层', enLabel: 'Lower', color: '#F59E0B' },
    poverty: { zhLabel: '贫困', enLabel: 'Poverty', color: '#E74C3C' },
  }
  const c = cfg[cls] ?? cfg.middle
  const label = zh ? c.zhLabel : c.enLabel
  return <span className="rounded border px-2 py-0.5 font-mono text-xs" style={{ borderColor: `${c.color}33`, color: c.color }}>{label}</span>
}

function NetworkBadge({ position, zh = true }: { position: string; zh?: boolean }) {
  const cfg: Record<string, { zhLabel: string; enLabel: string; color: string }> = {
    central: { zhLabel: '核心', enLabel: 'Central', color: '#C9A84C' },
    connected: { zhLabel: '连接', enLabel: 'Connected', color: '#22C55E' },
    peripheral: { zhLabel: '边缘', enLabel: 'Peripheral', color: '#F59E0B' },
    isolated: { zhLabel: '孤立', enLabel: 'Isolated', color: '#E74C3C' },
  }
  const c = cfg[position] ?? cfg.isolated
  const label = zh ? c.zhLabel : c.enLabel
  return <span className="rounded border px-2 py-0.5 font-mono text-xs" style={{ borderColor: `${c.color}33`, color: c.color }}>{label}</span>
}

function ReputationTierBadge({ tier, zh = true }: { tier: string; zh?: boolean }) {
  const cfg: Record<string, { zhLabel: string; enLabel: string; color: string }> = {
    legendary: { zhLabel: '传奇', enLabel: 'Legendary', color: '#C9A84C' },
    respected: { zhLabel: '受尊', enLabel: 'Respected', color: '#22C55E' },
    neutral: { zhLabel: '中立', enLabel: 'Neutral', color: 'var(--text-secondary)' },
    suspect: { zhLabel: '嫌疑', enLabel: 'Suspect', color: '#F59E0B' },
    notorious: { zhLabel: '恶名', enLabel: 'Notorious', color: '#E74C3C' },
  }
  const c = cfg[tier] ?? cfg.neutral
  const label = zh ? c.zhLabel : c.enLabel
  return <span className="rounded border px-2 py-0.5 font-mono text-xs" style={{ borderColor: `${c.color}33`, color: c.color }}>{label}</span>
}

function MoodBadge({ mood, zh = true }: { mood: string; zh?: boolean }) {
  const cfg: Record<string, { label: string; emoji: string; color: string }> = {
    euphoric: { label: '狂喜', emoji: '🤩', color: '#C9A84C' },
    confident: { label: '自信', emoji: '😊', color: '#22C55E' },
    calm: { label: '平静', emoji: '😌', color: 'var(--text-secondary)' },
    anxious: { label: '焦虑', emoji: '😰', color: '#F59E0B' },
    fearful: { label: '恐惧', emoji: '😨', color: '#F97316' },
    desperate: { label: '绝望', emoji: '😱', color: '#E74C3C' },
  }
  const c = cfg[mood] ?? cfg.calm
  const enMap: Record<string, string> = {
    euphoric: 'Euphoric',
    confident: 'Confident',
    calm: 'Calm',
    anxious: 'Anxious',
    fearful: 'Fearful',
    desperate: 'Desperate',
  }
  return <span style={{ color: c.color }}>{c.emoji} {zh ? c.label : (enMap[mood] ?? c.label)}</span>
}

function ParamBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.max(2, Math.min(100, value * 100))
  return (
    <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.625rem] text-[var(--text-dim)]">{label}</span>
        <span className="font-mono text-xs" style={{ color }}>{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="mt-1.5 h-[4px] w-full rounded-full bg-[var(--surface-raised)]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function TrendArrow({ trend }: { trend: string }) {
  if (trend === 'ascending' || trend === 'rising') return <span className="text-[#22C55E]">↑</span>
  if (trend === 'declining' || trend === 'falling') return <span className="text-[#E74C3C]">↓</span>
  if (trend === 'volatile') return <span className="text-[#F59E0B]">↕</span>
  if (trend === 'crisis') return <span className="text-[#E74C3C]">⚠</span>
  return <span className="text-[var(--text-dim)]">→</span>
}

// ─── NurtureRadar SVG Chart ─────────────────────────────────
function NurtureRadar({ nurture, zh = true }: { nurture: Record<string, any>; zh?: boolean }) {
  const dims = [
    { key: 'combat', label: zh ? '战斗' : 'Combat', value: Math.min(1, (nurture.combat?.level ?? 0) / 5) },
    { key: 'trauma', label: zh ? '创伤' : 'Trauma', value: traumaSeverity(nurture.trauma?.state ?? 'healthy') },
    { key: 'wealth', label: zh ? '财富' : 'Wealth', value: (nurture.wealth?.percentile ?? 50) / 100 },
    { key: 'social', label: zh ? '社交' : 'Social', value: Math.min(1, ((nurture.social?.strongTies ?? 0) + (nurture.social?.weakTies ?? 0)) / 10) },
    { key: 'reputation', label: zh ? '声誉' : 'Reputation', value: Math.min(1, (nurture.reputation?.score ?? 500) / 1000) },
    { key: 'emotion', label: zh ? '情绪' : 'Emotion', value: ((nurture.emotion?.valence ?? 0) + 1) / 2 },
    { key: 'cognition', label: zh ? '认知' : 'Cognition', value: Math.min(1, (nurture.cognition?.complexity ?? 1) / 5) },
  ]

  const cx = 140, cy = 140, r = 100
  const n = dims.length
  const angles = dims.map((_, i) => (Math.PI * 2 * i) / n - Math.PI / 2)

  // Grid rings
  const rings = [0.2, 0.4, 0.6, 0.8, 1.0]

  // Data polygon
  const points = dims.map((d, i) => {
    const v = Math.max(0.05, d.value)
    return `${cx + Math.cos(angles[i]) * r * v},${cy + Math.sin(angles[i]) * r * v}`
  }).join(' ')

  return (
    <svg viewBox="0 0 280 280" className="w-full max-w-[280px]">
      {/* Grid rings */}
      {rings.map(ring => (
        <polygon
          key={ring}
          points={angles.map(a => `${cx + Math.cos(a) * r * ring},${cy + Math.sin(a) * r * ring}`).join(' ')}
          fill="none" stroke="#1A1A1A" strokeWidth={0.5}
        />
      ))}
      {/* Axis lines */}
      {angles.map((a, i) => (
        <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(a) * r} y2={cy + Math.sin(a) * r} stroke="#1A1A1A" strokeWidth={0.5} />
      ))}
      {/* Data polygon */}
      <polygon points={points} fill="rgba(201,168,76,0.15)" stroke="#C9A84C" strokeWidth={1.5} />
      {/* Data points */}
      {dims.map((d, i) => {
        const v = Math.max(0.05, d.value)
        const px = cx + Math.cos(angles[i]) * r * v
        const py = cy + Math.sin(angles[i]) * r * v
        return <circle key={d.key} cx={px} cy={py} r={3} fill="#C9A84C" />
      })}
      {/* Labels */}
      {dims.map((d, i) => {
        const lx = cx + Math.cos(angles[i]) * (r + 18)
        const ly = cy + Math.sin(angles[i]) * (r + 18)
        return (
          <text key={d.key} x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
            className="fill-[var(--text-dim)]" style={{ fontSize: '9px', fontFamily: 'Space Grotesk, monospace' }}>
            {d.label}
          </text>
        )
      })}
    </svg>
  )
}

function traumaSeverity(state: string): number {
  const map: Record<string, number> = { healthy: 0.1, wounded: 0.35, scarred: 0.55, hardened: 0.75, growth: 0.9 }
  return map[state] ?? 0.1
}

// ─── TraumaStateMachine Visualization ───────────────────────
function TraumaStateMachineViz({ currentState, betrayals, ptgScore, zh = true }: { currentState: string; betrayals: number; ptgScore?: number; zh?: boolean }) {
  const states = [
    { key: 'healthy', label: zh ? '健康' : 'Healthy', emoji: '💚' },
    { key: 'wounded', label: zh ? '受伤' : 'Wounded', emoji: '💛' },
    { key: 'scarred', label: zh ? '伤痕' : 'Scarred', emoji: '🧡' },
    { key: 'hardened', label: zh ? '硬化' : 'Hardened', emoji: '❤️' },
    { key: 'growth', label: zh ? '成长' : 'Growth', emoji: '💜' },
  ]
  const currentIdx = states.findIndex(s => s.key === currentState)

  return (
    <div className="mt-4">
      <p className="eyebrow mb-3">{zh ? '创伤状态机' : 'Trauma State Machine'}</p>
      <div className="flex items-center gap-1">
        {states.map((s, i) => {
          const isCurrent = s.key === currentState
          const isPassed = i < currentIdx
          return (
            <div key={s.key} className="flex items-center">
              <div
                className="flex flex-col items-center rounded-lg border px-3 py-2 transition-all"
                style={{
                  borderColor: isCurrent ? '#C9A84C' : isPassed ? '#444' : '#222',
                  backgroundColor: isCurrent ? 'rgba(201,168,76,0.08)' : isPassed ? '#1A1A1A' : '#0A0A0A',
                  boxShadow: isCurrent ? '0 0 12px rgba(201,168,76,0.25)' : 'none',
                  minWidth: '60px',
                }}
              >
                <span className="text-lg">{s.emoji}</span>
                <span className="mt-1 font-mono text-[0.6rem]" style={{ color: isCurrent ? '#C9A84C' : isPassed ? '#666' : '#333' }}>
                  {s.label}
                </span>
              </div>
              {i < states.length - 1 && (
                <span className="mx-0.5 font-mono text-xs" style={{ color: i < currentIdx ? '#666' : '#222' }}>→</span>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-4">
        <span className="font-mono text-[0.625rem] text-[var(--text-dim)]">
          {zh ? `被背叛 ${betrayals} 次` : `betrayed ${betrayals} times`}
        </span>
        {currentState === 'growth' && ptgScore !== undefined && (
          <span className="font-mono text-[0.625rem] text-[#A855F7]">PTG: {ptgScore.toFixed(2)}</span>
        )}
      </div>
    </div>
  )
}
