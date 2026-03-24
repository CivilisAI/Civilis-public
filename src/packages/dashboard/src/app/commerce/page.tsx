'use client'

import { useEffect, useState } from 'react'
import { api, ACPJob, ACPStats, Erc8004Overview, X402FullStats } from '@/lib/api'
import { NoticeBanner, Panel, EmptyState, ProtocolBadge, archetypeMeta, formatArchetypeMetaLabel, formatUsd, formatRelativeTime } from '@/components/CivilisPrimitives'
import { useI18n } from '@/lib/i18n/index'
import { useRealtimeFeed, useThrottledRealtimeReload } from '@/lib/socket'

/* ── Category metadata ── */
const CATEGORY_META: Record<string, { icon: string; label: string; labelZh: string; color: string }> = {
  arena_match:      { icon: '⚔️', label: 'Arena',             labelZh: '竞技场',     color: 'var(--gold)' },
  arena_payout:     { icon: '🏆', label: 'Arena Payout',      labelZh: '竞技结算',   color: 'var(--gold)' },
  commons_round:    { icon: '🌾', label: 'The Commons',       labelZh: '公共品博弈', color: '#22C55E' },
  prediction_round: { icon: '🔮', label: "Oracle's Eye",      labelZh: '神谕之眼',   color: '#A855F7' },
  intel_spy:        { icon: '🕵️', label: 'Intel Spy',         labelZh: '情报窥探',   color: '#3B82F6' },
  intel_discover:   { icon: '🧘', label: 'Self Discovery',    labelZh: '内省发现',   color: '#06B6D4' },
  intel_purchase:   { icon: '📦', label: 'Intel Purchase',    labelZh: '情报购买',   color: '#8B5CF6' },
  intel_listing:    { icon: '📢', label: 'Intel Resale',      labelZh: '情报转售',   color: '#EC4899' },
  social_tip:       { icon: '💰', label: 'Tip',               labelZh: '打赏',       color: '#F59E0B' },
  social_post:      { icon: '📝', label: 'Post',              labelZh: '发帖',       color: '#6B7280' },
  social_paywall:   { icon: '🔐', label: 'Paywall Unlock',    labelZh: '付费解锁',   color: '#F59E0B' },
  negotiation:      { icon: '💬', label: 'Negotiation',       labelZh: '谈判',       color: '#6B7280' },
  death_settlement: { icon: '💀', label: 'Death Settlement',  labelZh: '死亡结算',   color: '#EF4444' },
  economy_action:   { icon: '🏛️', label: 'Economy Action',    labelZh: '经济调控',   color: '#14B8A6' },
  trade:            { icon: '🔄', label: 'Trade',             labelZh: '交易',       color: '#6366F1' },
  registration:     { icon: '🆕', label: 'Registration',      labelZh: '注册',       color: '#10B981' },
}

const ARENA_TYPE_META: Record<string, { icon: string; label: string; labelZh: string; color: string }> = {
  prisoners_dilemma: { icon: '⚔️', label: 'Prisoners Dilemma', labelZh: '囚徒困境', color: 'var(--gold)' },
  resource_grab: { icon: '🌾', label: 'The Commons', labelZh: '公共品博弈', color: '#22C55E' },
  info_auction: { icon: '🔮', label: "The Oracle's Eye", labelZh: '神谕之眼', color: '#A855F7' },
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string; labelZh: string }> = {
  open:      { bg: 'bg-blue-500/10',   text: 'text-blue-400',   label: 'OPEN',      labelZh: '开放' },
  funded:    { bg: 'bg-amber-500/10',  text: 'text-amber-400',  label: 'BUDGETED',  labelZh: '已登记预算' },
  submitted: { bg: 'bg-purple-500/10', text: 'text-purple-400', label: 'SUBMITTED', labelZh: '已提交' },
  completed: { bg: 'bg-green-500/10',  text: 'text-green-400',  label: 'COMPLETED', labelZh: '已完成' },
  rejected:  { bg: 'bg-red-500/10',    text: 'text-red-400',    label: 'REJECTED',  labelZh: '已拒绝' },
  expired:   { bg: 'bg-gray-500/10',   text: 'text-gray-400',   label: 'EXPIRED',   labelZh: '已过期' },
}

const TX_TYPE_META: Record<string, { icon: string; label: string; color: string }> = {
  post:              { icon: '📝', label: 'Post',             color: '#6B7280' },
  reply:             { icon: '💬', label: 'Reply',            color: '#6B7280' },
  tip:               { icon: '💰', label: 'Tip',              color: '#F59E0B' },
  paywall:           { icon: '🔐', label: 'Paywall',          color: '#F59E0B' },
  arena_entry:       { icon: '⚔️', label: 'Arena Entry',      color: 'var(--gold)' },
  arena_entry_refund:{ icon: '↩️', label: 'Arena Refund',     color: '#22C55E' },
  arena_action:      { icon: '🏆', label: 'Arena Payout',     color: 'var(--gold)' },
  negotiation:       { icon: '🤝', label: 'Negotiation',      color: '#6B7280' },
  divination:        { icon: '🔮', label: 'Divination',       color: '#A855F7' },
  register:          { icon: '🆕', label: 'Registration',     color: '#10B981' },
  death_treasury:    { icon: '💀', label: 'Death→Treasury',   color: '#EF4444' },
  death_inheritance: { icon: '📜', label: 'Inheritance',      color: '#EF4444' },
  death_social:      { icon: '🕊️', label: 'Social Dist.',    color: '#EF4444' },
  trade:             { icon: '🔄', label: 'Token Swap',       color: '#6366F1' },
  intel_self_reveal: { icon: '🧘', label: 'Self Reveal',      color: '#06B6D4' },
  intel_self_discover:{ icon: '🧘', label: 'Self Discover',   color: '#06B6D4' },
  intel_spy:         { icon: '🕵️', label: 'Spy Op',          color: '#3B82F6' },
  intel_purchase:    { icon: '📦', label: 'Intel Buy',        color: '#8B5CF6' },
  intel_v2_purchase: { icon: '📦', label: 'Intel V2 Buy',    color: '#8B5CF6' },
  economy_tax:       { icon: '🏛️', label: 'Anti-Monopoly Tax', color: '#14B8A6' },
  economy_ubi:       { icon: '🫂', label: 'Reputation UBI',   color: '#14B8A6' },
  economy_bailout:   { icon: '🆘', label: 'Bailout',          color: '#14B8A6' },
  prediction_treasury:{ icon: '🔮', label: 'Prediction Cut',  color: '#A855F7' },
}

type FilterCategory = 'all' | string
type ArenaSubtypeFilter = 'all' | string
type UnifiedCategoryFilter =
  | { kind: 'category'; key: string; count: number }
  | { kind: 'arenaSubtype'; key: string; count: number }

function getCommerceJobFlowKey(job: ACPJob): string {
  if (job.category === 'arena_match') {
    const arenaType = typeof job.metadata?.type === 'string' ? job.metadata.type : null
    if (arenaType && ARENA_TYPE_META[arenaType]) return arenaType
  }
  return job.category
}

function interleaveJobsByFlowKey(jobs: ACPJob[], preferredOrder: string[]): ACPJob[] {
  if (jobs.length <= 1) return jobs

  const buckets = new Map<string, ACPJob[]>()
  const orderedKeys: string[] = []

  for (const job of jobs) {
    const key = getCommerceJobFlowKey(job)
    if (!buckets.has(key)) {
      buckets.set(key, [])
      orderedKeys.push(key)
    }
    buckets.get(key)!.push(job)
  }

  const queueOrder = [
    ...preferredOrder.filter((key, index) => preferredOrder.indexOf(key) === index && buckets.has(key)),
    ...orderedKeys.filter((key) => !preferredOrder.includes(key)),
  ]

  const interleaved: ACPJob[] = []
  let added = true

  while (added) {
    added = false
    for (const key of queueOrder) {
      const bucket = buckets.get(key)
      if (bucket && bucket.length > 0) {
        interleaved.push(bucket.shift()!)
        added = true
      }
    }
  }

  return interleaved
}

type CommerceLoadState = {
  stats: boolean
  jobs: boolean
  x402: boolean
  erc8004: boolean
}

const EMPTY_COMMERCE_LOAD_STATE: CommerceLoadState = {
  stats: false,
  jobs: false,
  x402: false,
  erc8004: false,
}

type MetadataEntry = {
  key: string
  label: string
  labelZh: string
  value: string
}

const METADATA_LABELS: Record<string, { label: string; labelZh: string }> = {
  matchId: { label: 'Match', labelZh: '对局' },
  roundId: { label: 'Round ID', labelZh: '轮次ID' },
  roundNumber: { label: 'Round', labelZh: '轮次' },
  playerAId: { label: 'Player A', labelZh: '玩家A' },
  playerBId: { label: 'Player B', labelZh: '玩家B' },
  clientAgentId: { label: 'Client', labelZh: '委托方' },
  providerAgentId: { label: 'Provider', labelZh: '执行方' },
  buyerAgentId: { label: 'Buyer', labelZh: '买方' },
  sellerAgentId: { label: 'Seller', labelZh: '卖方' },
  targetAgentId: { label: 'Target', labelZh: '目标Agent' },
  spyAgentId: { label: 'Spy', labelZh: '刺探Agent' },
  category: { label: 'Category', labelZh: '分类' },
  dimension: { label: 'Dimension', labelZh: '维度' },
  itemId: { label: 'Item', labelZh: '条目' },
  listingId: { label: 'Listing', labelZh: '挂单' },
  entryFee: { label: 'Entry Fee', labelZh: '入场费' },
  baseInjection: { label: 'Base Injection', labelZh: '基础注入' },
  contributeTotal: { label: 'Total Contribution', labelZh: '总贡献' },
  predictionLossPool: { label: 'Prediction Loss Pool', labelZh: '预测亏损池' },
  price: { label: 'Price', labelZh: '价格' },
  resalePrice: { label: 'Resale Price', labelZh: '转售价' },
  finalPool: { label: 'Final Pool', labelZh: '最终奖池' },
  prizePool: { label: 'Prize Pool', labelZh: '奖池' },
  treasuryCut: { label: 'Treasury Cut', labelZh: '国库抽成' },
  participantCount: { label: 'Participants', labelZh: '参与人数' },
  winner: { label: 'Winner', labelZh: '胜者' },
  actualWinner: { label: 'Actual Winner', labelZh: '实际胜者' },
  coinA: { label: 'Coin A', labelZh: '币种A' },
  coinB: { label: 'Coin B', labelZh: '币种B' },
  changeA: { label: 'Change A', labelZh: '涨跌A' },
  changeB: { label: 'Change B', labelZh: '涨跌B' },
  cooperationRate: { label: 'Cooperation', labelZh: '合作率' },
  sabotageDamage: { label: 'Sabotage', labelZh: '破坏值' },
  marketPhase: { label: 'Phase', labelZh: '市场阶段' },
  notes: { label: 'Notes', labelZh: '备注' },
}

function formatMetadataPrimitive(key: string, value: unknown, zh: boolean): string {
  if (typeof value === 'number') {
    if (key.toLowerCase().includes('rate')) return `${(value * 100).toFixed(1).replace(/\.0$/, '')}%`
    if (key.toLowerCase().includes('change')) return `${value.toFixed(2).replace(/\.?0+$/, '')}%`
    if (key.toLowerCase().includes('fee') || key.toLowerCase().includes('price') || key.toLowerCase().includes('pool') || key.toLowerCase().includes('cut') || key.toLowerCase().includes('damage')) {
      return formatUsd(value)
    }
    return value.toFixed(3).replace(/\.?0+$/, '')
  }

  if (typeof value === 'boolean') return zh ? (value ? '是' : '否') : (value ? 'Yes' : 'No')

  if (typeof value === 'string') {
    if (!value.trim()) return '—'
    if (value.startsWith('0x') && value.length > 18) return `${value.slice(0, 10)}...${value.slice(-6)}`
    return value
  }

  if (Array.isArray(value)) {
    const compact = value.map((item) => formatMetadataPrimitive(key, item, zh)).filter(Boolean)
    return compact.length ? compact.join(', ') : '—'
  }

  if (value && typeof value === 'object') {
    const serialized = JSON.stringify(value)
    return serialized.length > 120 ? `${serialized.slice(0, 117)}...` : serialized
  }

  return '—'
}

function getMetadataEntries(metadata: Record<string, unknown> | null | undefined, zh: boolean): MetadataEntry[] {
  if (!metadata) return []

  return Object.entries(metadata)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => {
      const label = METADATA_LABELS[key] ?? {
        label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()),
        labelZh: key,
      }

      return {
        key,
        label: label.label,
        labelZh: label.labelZh,
        value: formatMetadataPrimitive(key, value, zh),
      }
    })
}

function getMetadataNumber(metadata: Record<string, unknown> | null | undefined, key: string): number | null {
  const value = metadata?.[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value)
  return null
}

function getMetadataString(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim() ? value : null
}

function getArenaTypeLabel(type: string | null | undefined, zh: boolean): string {
  if (!type) return zh ? '竞技对局' : 'Arena Match'
  const meta = ARENA_TYPE_META[type]
  return zh ? (meta?.labelZh ?? type) : (meta?.label ?? type)
}

function getArenaTypeIcon(type: string | null | undefined): string {
  if (!type) return '⚔️'
  return ARENA_TYPE_META[type]?.icon ?? '⚔️'
}

function getJobDisplayMeta(job: ACPJob): { icon: string; label: string; labelZh: string; color: string } {
  if (job.category === 'arena_match') {
    const arenaType = getMetadataString(job.metadata, 'type')
    const meta = arenaType ? ARENA_TYPE_META[arenaType] : null
    if (meta) {
      return {
        icon: meta.icon,
        label: meta.label,
        labelZh: meta.labelZh,
        color: meta.color,
      }
    }
  }

  return CATEGORY_META[job.category] ?? { icon: '📋', label: job.category, labelZh: job.category, color: 'var(--gold)' }
}

function formatAgentRef(agentId: string | null | undefined, zh: boolean): string {
  if (!agentId) return zh ? '国库' : 'Treasury'
  return agentId
}

function formatCompactAddress(address: string | null | undefined): string {
  if (!address) return '—'
  return address.length > 18 ? `${address.slice(0, 10)}...${address.slice(-6)}` : address
}

function formatAddressSourceLabel(source: string | null | undefined, zh: boolean): string {
  switch (source) {
    case 'v2_env': return zh ? 'v2 环境变量' : 'v2 env'
    case 'legacy_env_alias': return zh ? 'legacy 别名' : 'legacy alias'
    case 'unset': return zh ? '未配置' : 'unset'
    default: return source ?? '—'
  }
}

function formatSyncStateLabel(state: string | null | undefined, zh: boolean): string {
  switch (state) {
    case 'mixed': return zh ? '账本 + 链上' : 'ledger + on-chain'
    case 'local_only': return zh ? '仅账本' : 'ledger only'
    case 'empty': return zh ? '空' : 'empty'
    default: return state ?? '—'
  }
}

function getSyncStateClasses(state: string | null | undefined): string {
  switch (state) {
    case 'mixed': return 'bg-[#22C55E]/10 text-[#8CF0A5]'
    case 'local_only': return 'bg-[#F59E0B]/10 text-[#FCD34D]'
    case 'empty': return 'bg-[var(--border-primary)] text-[var(--text-dim)]'
    default: return 'bg-[var(--border-primary)] text-[var(--text-dim)]'
  }
}

function formatElapsed(start: string | null | undefined, end: string | null | undefined, zh: boolean): string {
  if (!start || !end) return '—'
  const deltaMs = new Date(end).getTime() - new Date(start).getTime()
  if (!Number.isFinite(deltaMs) || deltaMs < 0) return '—'

  const totalSeconds = Math.round(deltaMs / 1000)
  if (totalSeconds < 60) return zh ? `${totalSeconds}秒` : `${totalSeconds}s`

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes < 60) {
    return zh
      ? `${minutes}分${seconds > 0 ? `${seconds}秒` : ''}`
      : `${minutes}m${seconds > 0 ? ` ${seconds}s` : ''}`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return zh
    ? `${hours}小时${remainingMinutes > 0 ? `${remainingMinutes}分` : ''}`
    : `${hours}h${remainingMinutes > 0 ? ` ${remainingMinutes}m` : ''}`
}

function formatX402Status(status: string, zh: boolean): string {
  switch (status) {
    case 'local_confirmed': return zh ? '已接受' : 'ACCEPTED'
    case 'proof_signed': return zh ? '已签证明' : 'PROOF SIGNED'
    case 'verified': return zh ? '已验证' : 'VERIFIED'
    case 'settled': return zh ? '已结算' : 'SETTLED'
    case 'queued': return zh ? '准备上链' : 'PREPARING PROOF'
    case 'retrying': return zh ? '继续提交中' : 'RETRYING'
    case 'submitted': return zh ? '链上确认中' : 'CHAIN PENDING'
    case 'confirmed': return zh ? '链上已确认' : 'CHAIN PROVEN'
    case 'failed': return zh ? '需要处理' : 'NEEDS ATTENTION'
    default: return status.toUpperCase()
  }
}

function getX402StatusClasses(status: string): string {
  switch (status) {
    case 'settled': return 'border-[#22C55E]/40 bg-[#22C55E]/10 text-[#8CF0A5]'
    case 'verified': return 'border-[#3B82F6]/40 bg-[#3B82F6]/10 text-[#93C5FD]'
    case 'proof_signed': return 'border-[var(--border-gold)] bg-[var(--gold-wash)] text-[var(--gold)]'
    case 'confirmed': return 'border-[#22C55E]/40 bg-[#22C55E]/10 text-[#8CF0A5]'
    case 'submitted': return 'border-[#3B82F6]/40 bg-[#3B82F6]/10 text-[#93C5FD]'
    case 'queued':
    case 'retrying':
      return 'border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#FCD34D]'
    case 'failed': return 'border-[#EF4444]/40 bg-[#EF4444]/10 text-[#FCA5A5]'
    default: return 'border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-[var(--text-dim)]'
  }
}

function getX402StepState(
  status: string,
  step: 'local' | 'queued' | 'submitted' | 'confirmed' | 'wallet' | 'verify' | 'settle',
  directWalletMode: boolean,
): 'done' | 'active' | 'pending' | 'failed' {
  if (directWalletMode) {
    if (status === 'failed') {
      if (step === 'settle') return 'failed'
      if (step === 'verify') return 'active'
      if (step === 'wallet') return 'done'
      return 'pending'
    }

    if (status === 'settled' || status === 'confirmed') {
      return 'done'
    }

    if (status === 'verified' || status === 'submitted') {
      if (step === 'settle') return 'active'
      if (step === 'wallet' || step === 'verify') return 'done'
      return 'pending'
    }

    if (status === 'proof_signed') {
      if (step === 'wallet') return 'active'
      return 'pending'
    }

    return step === 'wallet' ? 'active' : 'pending'
  }

  if (status === 'failed') {
    if (step === 'confirmed') return 'failed'
    if (step === 'submitted') return 'active'
    if (step === 'local' || step === 'queued') return 'done'
  }

  switch (status) {
    case 'local_confirmed':
      return step === 'local' ? 'active' : 'pending'
    case 'queued':
    case 'retrying':
      if (step === 'local' || step === 'queued') return step === 'queued' ? 'active' : 'done'
      return 'pending'
    case 'submitted':
      if (step === 'confirmed') return 'pending'
      return step === 'submitted' ? 'active' : 'done'
    case 'confirmed':
      return 'done'
    default:
      return step === 'local' ? 'active' : 'pending'
  }
}

function getX402StatusNarrative(
  tx: X402FullStats['recentTransactions'][number],
  zh: boolean,
  directWalletMode: boolean,
): string {
  if (tx.confirmedAt && tx.txHash) {
    return zh
      ? directWalletMode
        ? '这笔支付已经由 Agent 自己的钱包签出 proof，并完成官方 verify / settle，可用 tx hash 和浏览器链接直接核验。'
        : '这笔支付已经拿到真实链上终态证明，可用 tx hash 和浏览器链接直接核验。'
      : directWalletMode
        ? 'This payment was signed by the agent wallet, passed official verify / settle, and now exposes a real tx hash and explorer proof.'
        : 'This payment already has terminal on-chain proof and can be verified directly through its tx hash and explorer link.'
  }

  if (directWalletMode && tx.onchainStatus === 'verified') {
    return zh
      ? '这笔支付 proof 已通过官方验证，当前等待 settle 产出最终链上 tx hash。'
      : 'This payment proof has passed official verification and is now waiting for settle to produce the final tx hash.'
  }

  if (directWalletMode && tx.onchainStatus === 'proof_signed') {
    return zh
      ? '这笔支付已经由 Agent 钱包签出 proof，接下来会进入官方 verify / settle。'
      : 'This payment has already been signed by the agent wallet and will proceed into official verify / settle.'
  }

  if (tx.txHash) {
    return zh
      ? directWalletMode
        ? '这笔支付已经进入官方结算链路，当前等待最终链上确认。'
        : '这笔支付已经广播到链上，当前等待最终确认。'
      : directWalletMode
        ? 'This payment has entered the official settlement path and is waiting for terminal chain confirmation.'
        : 'This payment has been broadcast on-chain and is now waiting for final confirmation.'
  }

  if (tx.onchainStatus === 'queued' || tx.onchainStatus === 'retrying') {
    return zh
      ? '这笔支付已经被系统接受，当前正在等待补齐最终链上证明。'
      : 'This payment has been accepted and is now waiting for final on-chain proof.'
  }

  if (tx.onchainStatus === 'local_confirmed') {
    return zh
      ? '这笔支付已经进入正式支付流水，正在等待最终链上证明。'
      : 'This payment is already in the formal payment flow and is waiting for final on-chain proof.'
  }

  if (tx.onchainStatus === 'failed') {
    return zh
      ? '这笔支付需要人工关注，当前未能产出完整链上证明。'
      : 'This payment needs attention because it has not yet produced complete on-chain proof.'
  }

  return zh
    ? '这笔支付正在从接受态推进到链上终态证明。'
    : 'This payment is progressing from acceptance to terminal on-chain proof.'
}

function getACPJobTitle(job: ACPJob, zh: boolean): string {
  const metadata = job.metadata

  switch (job.category) {
    case 'arena_match': {
      const matchId = getMetadataNumber(metadata, 'matchId')
      const playerA = formatAgentRef(getMetadataString(metadata, 'playerAId') ?? job.client_agent_id, zh)
      const playerB = formatAgentRef(getMetadataString(metadata, 'playerBId') ?? job.provider_agent_id, zh)
      const arenaType = getMetadataString(metadata, 'type')
      return zh
        ? `${getArenaTypeLabel(arenaType, true)} #${matchId ?? job.on_chain_job_id} · ${playerA} vs ${playerB}`
        : `${getArenaTypeLabel(arenaType, false)} #${matchId ?? job.on_chain_job_id} · ${playerA} vs ${playerB}`
    }
    case 'commons_round': {
      const roundNumber = getMetadataNumber(metadata, 'roundNumber')
      const participants = getMetadataNumber(metadata, 'participantCount')
      return zh
        ? `公共品 R${roundNumber ?? job.on_chain_job_id} · ${participants ?? 0} 名参与者`
        : `Commons R${roundNumber ?? job.on_chain_job_id} · ${participants ?? 0} participants`
    }
    case 'prediction_round': {
      const roundNumber = getMetadataNumber(metadata, 'roundNumber')
      const coinA = getMetadataString(metadata, 'coinA')
      const coinB = getMetadataString(metadata, 'coinB')
      return zh
        ? `预测 R${roundNumber ?? job.on_chain_job_id} · ${coinA ?? 'N/A'} vs ${coinB ?? 'N/A'}`
        : `Prediction R${roundNumber ?? job.on_chain_job_id} · ${coinA ?? 'N/A'} vs ${coinB ?? 'N/A'}`
    }
    case 'intel_listing': {
      const listingId = getMetadataNumber(metadata, 'listingId')
      const dimension = getMetadataString(metadata, 'dimension')
      const subject = formatAgentRef(getMetadataString(metadata, 'subjectAgentId'), zh)
      return zh
        ? `命格挂单 #${listingId ?? job.on_chain_job_id} · ${subject} / ${dimension ?? 'dimension'}`
        : `Fate Listing #${listingId ?? job.on_chain_job_id} · ${subject} / ${dimension ?? 'dimension'}`
    }
    case 'intel_purchase': {
      const itemId = getMetadataNumber(metadata, 'itemId') ?? getMetadataNumber(metadata, 'listingId')
      const category = getMetadataString(metadata, 'category') ?? getMetadataString(metadata, 'dimension')
      return zh
        ? `情报购买 #${itemId ?? job.on_chain_job_id} · ${category ?? 'intel'}`
        : `Intel Purchase #${itemId ?? job.on_chain_job_id} · ${category ?? 'intel'}`
    }
    default:
      return zh
        ? `${CATEGORY_META[job.category]?.labelZh ?? job.category} #${job.on_chain_job_id}`
        : `${CATEGORY_META[job.category]?.label ?? job.category} #${job.on_chain_job_id}`
  }
}

function getACPJobNarrative(job: ACPJob, zh: boolean): string {
  const metadata = job.metadata
  const isRecordOnly = job.recordOnly ?? (!job.valueBacked && Number(job.budget) <= 0)

  switch (job.category) {
    case 'arena_match': {
      const playerA = formatAgentRef(getMetadataString(metadata, 'playerAId') ?? job.client_agent_id, zh)
      const playerB = formatAgentRef(getMetadataString(metadata, 'playerBId') ?? job.provider_agent_id, zh)
      const entryFee = getMetadataNumber(metadata, 'entryFee')
      const matchType = getMetadataString(metadata, 'type')
      const matchTypeLabel = getArenaTypeLabel(matchType, zh)
      return isRecordOnly
        ? zh
          ? `为 ${playerA} 与 ${playerB} 的${matchTypeLabel}登记一条 ACP 链上作业记录。当前预算为 0，入场费${entryFee !== null ? `由双方各自通过 x402 直接支付轨支付 ${formatUsd(entryFee)}` : '走 x402 直接支付轨'}。`
          : `Registers an ACP on-chain job record for the ${matchTypeLabel} between ${playerA} and ${playerB}. This window uses a zero-budget record, while${entryFee !== null ? ` each side pays ${formatUsd(entryFee)} through the x402 direct payment rail` : ' the entry payment runs through the x402 direct payment rail'}.`
        : zh
          ? `为 ${playerA} 与 ${playerB} 的${matchTypeLabel}登记 ${formatUsd(job.budget)} 的链上预算${entryFee !== null ? `，双方各自支付 ${formatUsd(entryFee)} 入场费` : ''}。`
          : `Registers an on-chain budget of ${formatUsd(job.budget)} for the ${matchTypeLabel} between ${playerA} and ${playerB}${entryFee !== null ? `, with ${formatUsd(entryFee)} entry per side` : ''}.`
    }
    case 'commons_round': {
      const roundNumber = getMetadataNumber(metadata, 'roundNumber')
      const participants = getMetadataNumber(metadata, 'participantCount')
      const contributeTotal = getMetadataNumber(metadata, 'contributeTotal')
      const baseInjection = getMetadataNumber(metadata, 'baseInjection')
      const predictionLossPool = getMetadataNumber(metadata, 'predictionLossPool')
      return zh
        ? `为第 ${roundNumber ?? '?'} 轮公共品登记 ${formatUsd(job.budget)} 的预算流。${participants ?? 0} 名 Agent 中有 ${contributeTotal ?? 0} 人选择贡献，系统基础注入 ${formatUsd(baseInjection ?? 0)}${(predictionLossPool ?? 0) > 0 ? `，并叠加预测亏损池 ${formatUsd(predictionLossPool ?? 0)}` : ''}。`
        : `Registers a budget flow of ${formatUsd(job.budget)} for Commons round ${roundNumber ?? '?'}. ${contributeTotal ?? 0} of ${participants ?? 0} agents contributed, with ${formatUsd(baseInjection ?? 0)} base injection${(predictionLossPool ?? 0) > 0 ? ` plus ${formatUsd(predictionLossPool ?? 0)} prediction loss pool` : ''}.`
    }
    case 'prediction_round': {
      const roundNumber = getMetadataNumber(metadata, 'roundNumber')
      const participants = getMetadataNumber(metadata, 'participantCount')
      const entryFee = getMetadataNumber(metadata, 'entryFee')
      const prizePool = getMetadataNumber(metadata, 'prizePool')
      const coinA = getMetadataString(metadata, 'coinA')
      const coinB = getMetadataString(metadata, 'coinB')
      return zh
        ? `为第 ${roundNumber ?? '?'} 轮预测市场登记 ${formatUsd(prizePool ?? Number(job.budget))} 的预算与结果状态。${participants ?? 0} 名 Agent 各自支付 ${formatUsd(entryFee ?? 0)}，在 ${coinA ?? 'N/A'} 与 ${coinB ?? 'N/A'} 之间下注。`
        : `Registers budget and terminal state for prediction round ${roundNumber ?? '?'}, totaling ${formatUsd(prizePool ?? Number(job.budget))}. ${participants ?? 0} agents each paid ${formatUsd(entryFee ?? 0)} to bet between ${coinA ?? 'N/A'} and ${coinB ?? 'N/A'}.`
    }
    case 'intel_listing': {
      const buyer = formatAgentRef(getMetadataString(metadata, 'buyerAgentId') ?? job.client_agent_id, zh)
      const seller = formatAgentRef(getMetadataString(metadata, 'sellerAgentId') ?? job.provider_agent_id, zh)
      const subject = formatAgentRef(getMetadataString(metadata, 'subjectAgentId'), zh)
      const dimension = getMetadataString(metadata, 'dimension')
      return zh
        ? `${buyer} 通过 ACP 购买了 ${seller} 挂出的 ${subject} · ${dimension ?? 'dimension'} 命格知识，成交额 ${formatUsd(job.budget)}。`
        : `${buyer} purchased ${seller}'s fate listing on ${subject} · ${dimension ?? 'dimension'} through ACP for ${formatUsd(job.budget)}.`
    }
    case 'intel_purchase': {
      const buyer = formatAgentRef(getMetadataString(metadata, 'buyerAgentId') ?? job.client_agent_id, zh)
      const seller = formatAgentRef(getMetadataString(metadata, 'sellerAgentId') ?? job.provider_agent_id, zh)
      const itemId = getMetadataNumber(metadata, 'itemId') ?? getMetadataNumber(metadata, 'listingId')
      return isRecordOnly
        ? zh
          ? `${buyer} 与 ${seller} 的情报购买被登记成一条 ACP 链上作业记录。当前预算为 0，实际支付仍由 x402 直接支付轨完成。`
          : `${buyer} and ${seller} have an ACP on-chain job record for this intel purchase. The current record carries zero budget while the actual payment settles through the x402 direct payment rail.`
        : zh
          ? `${buyer} 向 ${seller} 购买了情报条目 #${itemId ?? job.on_chain_job_id}，成交额 ${formatUsd(job.budget)}。`
          : `${buyer} bought intel item #${itemId ?? job.on_chain_job_id} from ${seller} for ${formatUsd(job.budget)}.`
    }
    default:
      return zh
        ? `这条记录为 ${CATEGORY_META[job.category]?.labelZh ?? job.category} 保留预算、提交与终态结果。`
        : `This record keeps the budget, submission, and terminal outcome for ${CATEGORY_META[job.category]?.label ?? job.category}.`
  }
}

function getACPJobProtocolPath(job: ACPJob, zh: boolean): string {
  const isRecordOnly = job.recordOnly ?? (!job.valueBacked && Number(job.budget) <= 0)

  switch (job.category) {
    case 'arena_match':
      return isRecordOnly
        ? zh
          ? 'x402 入场支付 -> ACP 作业登记 -> 对局结果判定 -> 奖励派发'
          : 'x402 entry payment -> ACP job record -> match resolution -> payout'
        : zh
          ? 'createJob -> setBudget -> fund -> 结果判定 -> 奖励派发'
          : 'createJob -> setBudget -> fund -> match resolution -> payout'
    case 'commons_round':
      return zh
        ? '国库注资 -> 预算登记 -> 公共品结算 -> 信誉反馈'
        : 'treasury injection -> budget record -> commons settlement -> reputation feedback'
    case 'prediction_round':
      return zh
        ? '入场支付 -> 预算登记 -> 市场判定 -> 派彩'
        : 'entry payment -> budget record -> market resolution -> payout'
    case 'intel_listing':
      return zh
        ? '命格购买 -> 成交记录 -> 维度交付 -> 买家获得认知'
        : 'fate purchase -> delivery record -> dimension delivery -> buyer gains knowledge'
    case 'intel_purchase':
      return isRecordOnly
        ? zh
          ? 'x402 购买 -> ACP 作业登记 -> 内容交付 -> 后续验证与信誉反馈'
          : 'x402 purchase -> ACP job record -> content delivery -> later validation and reputation feedback'
        : zh
          ? 'createJob -> setBudget -> fund -> submit -> complete -> 后续验证与信誉反馈'
          : 'createJob -> setBudget -> fund -> submit -> complete -> later validation and reputation feedback'
    default:
      return zh
        ? '支付触发 -> 状态登记 -> 终态处理'
        : 'payment trigger -> state record -> terminal handling'
  }
}

function getACPJobTimeline(job: ACPJob, zh: boolean): Array<{ key: string; label: string; value: string | null; duration?: string }> {
  const createdToSubmitted = formatElapsed(job.funded_at ?? job.created_at, job.submitted_at, zh)
  const submittedToSettled = formatElapsed(job.submitted_at, job.settled_at, zh)

  return [
    { key: 'created', label: zh ? '创建并登记预算' : 'Created + Budgeted', value: job.funded_at ?? job.created_at },
    { key: 'submitted', label: zh ? '提交交付' : 'Submitted', value: job.submitted_at, duration: createdToSubmitted !== '—' ? createdToSubmitted : undefined },
    { key: 'settled', label: zh ? '终态结算' : 'Terminal State', value: job.settled_at, duration: submittedToSettled !== '—' ? submittedToSettled : undefined },
  ]
}

function getACPStatusNarrative(job: ACPJob, zh: boolean): string {
  const isRecordOnly = job.recordOnly ?? (!job.valueBacked && Number(job.budget) <= 0)

  switch (job.status) {
    case 'completed':
      return isRecordOnly
        ? zh
          ? '这条记录已经完成链上登记与终态写回，可作为零预算 ACP 作业记录查看。'
          : 'This record has completed on-chain registration and terminal write-back, so it can be inspected as a zero-budget ACP job trace.'
        : zh
          ? '预算、提交和终态结果都已登记完成，当前记录可作为链上商业流程凭证查看。'
          : 'Budget, submission, and terminal state are fully recorded; this record reflects a completed on-chain commerce trace.'
    case 'expired':
      return zh
        ? '该 Job 在时限内没有进入完成态，资金链路被标记为过期终止。'
        : 'This job did not reach completion within its time window and was terminally marked as expired.'
    case 'submitted':
      return zh
        ? '交付已经提交，当前等待 Evaluator 给出最终完成或拒绝判定。'
        : 'Deliverable has been submitted and is awaiting evaluator completion or rejection.'
    case 'funded':
      return zh
        ? '预算已登记，当前等待执行方提交工作结果。'
        : 'The job budget has been recorded and the provider is expected to submit deliverables next.'
    case 'open':
      return zh
        ? 'Job 已创建但尚未注资，当前仍处于开放阶段。'
        : 'Job exists but has not yet been funded, so it remains open.'
    default:
      return zh ? '该 Job 处于终态流程中。' : 'This job is in a terminal-state workflow.'
  }
}

export default function CommercePage() {
  const { locale } = useI18n()
  const { events } = useRealtimeFeed(20)
  const zh = locale === 'zh'

  const [stats, setStats] = useState<ACPStats | null>(null)
  const [jobs, setJobs] = useState<ACPJob[]>([])
  const [jobsTotal, setJobsTotal] = useState(0)
  const [filter, setFilter] = useState<FilterCategory>('all')
  const [arenaTypeFilter, setArenaTypeFilter] = useState<ArenaSubtypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedJob, setExpandedJob] = useState<number | null>(null)
  const [x402, setX402] = useState<X402FullStats | null>(null)
  const [showRecentTx, setShowRecentTx] = useState(false)
  const [showAllJobs, setShowAllJobs] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [erc8004Data, setErc8004Data] = useState<Erc8004Overview | null>(null)
  const [loaded, setLoaded] = useState<CommerceLoadState>(EMPTY_COMMERCE_LOAD_STATE)

  async function load() {
    const [s, j, x, erc8004] = await Promise.allSettled([
      api.getACPStats(),
      api.getACPJobs({
        category: filter === 'all' ? undefined : filter,
        arenaType: arenaTypeFilter === 'all' ? undefined : arenaTypeFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 50,
      }),
      api.getX402Stats(),
      api.getERC8004Overview(),
    ])
    const missing: string[] = []
    const nextLoaded: CommerceLoadState = {
      stats: s.status === 'fulfilled',
      jobs: j.status === 'fulfilled',
      x402: x.status === 'fulfilled',
      erc8004: erc8004.status === 'fulfilled',
    }

    setLoaded(nextLoaded)

    if (s.status === 'fulfilled') setStats(s.value)
    else missing.push(zh ? 'ACP 总览' : 'ACP overview')

    if (j.status === 'fulfilled') {
      setJobs(j.value.jobs)
      setJobsTotal(j.value.total)
    } else {
      missing.push(zh ? '成交记录' : 'commerce records')
    }

    if (x.status === 'fulfilled') setX402(x.value)
    else missing.push(zh ? 'x402 证明流' : 'x402 proof flow')

    if (erc8004.status === 'fulfilled') setErc8004Data(erc8004.value)
    else {
      console.error('[Commerce] identity aggregate failed:', erc8004.reason)
      missing.push(zh ? '身份与信誉' : 'identity and trust')
    }

    if (missing.length > 0) {
      console.error('[Commerce] Partial load failure:', missing)
      setLoadError(
        zh
          ? `部分商业数据暂时不可用：${missing.join('、')}。页面会保留已经成功加载的内容，不再把失败误显示成 0。`
          : `Some commerce data is temporarily unavailable: ${missing.join(', ')}. Loaded sections remain visible instead of being mistaken for zero.`,
      )
      return
    }

    setLoadError(null)
  }

  useEffect(() => { void load() }, [filter, arenaTypeFilter, statusFilter])
  useThrottledRealtimeReload(events[0]?.timestamp, load, 3000)

  const jobsLoaded = loaded.jobs
  const directWalletMode = x402?.official.directWalletMode ?? false
  const localLedger = stats?.localLedger
  const byCategory = localLedger?.byCategory ?? {}
  const recordOnlyByCategory = localLedger?.recordOnlyByCategory ?? {}
  const arenaSubtypeCounts = localLedger?.arenaSubtypeCounts ?? {}
  const totalJobCount = localLedger?.total ?? 0
  const valueBackedCount = localLedger?.valueBackedCount ?? 0
  const valueBackedVolume = localLedger?.valueBackedVolume ?? 0
  const recordOnlyCount = localLedger?.recordOnlyCount ?? 0
  const allCategorySummary = Object.entries(byCategory)
  const recordOnlyCategorySummary = Object.entries(recordOnlyByCategory)
  const arenaSubtypeSummary = Object.entries(arenaSubtypeCounts).filter(([, count]) => count > 0)
  const unifiedCategoryFilters: UnifiedCategoryFilter[] = allCategorySummary.flatMap<UnifiedCategoryFilter>(([cat, count]) => {
    if (cat !== 'arena_match') {
      return [{ kind: 'category' as const, key: cat, count }]
    }
    return arenaSubtypeSummary.map(([arenaType, arenaCount]) => ({
        kind: 'arenaSubtype' as const,
        key: arenaType,
        count: arenaCount,
      }))
  })
  const orderedFlowKeys = unifiedCategoryFilters.map((entry) => entry.key)
  const usedJobs =
    filter === 'all' && arenaTypeFilter === 'all'
      ? interleaveJobsByFlowKey(jobs, orderedFlowKeys)
      : jobs
  const valueJobs = jobs.filter((job) => job.valueBacked ?? (!job.recordOnly && Number(job.budget) > 0))
  const recordOnlyJobs = jobs.filter((job) => job.recordOnly ?? Number(job.budget) <= 0)
  const initialVisibleCount = filter === 'all' && arenaTypeFilter === 'all' ? 4 : 3
  const visibleJobs = showAllJobs ? usedJobs : usedJobs.slice(0, initialVisibleCount)
  const visibleBudget = valueJobs.reduce((sum, job) => sum + Number(job.budget), 0)
  const visibleAnchors = recordOnlyJobs.length
  const jobStatusCounts = usedJobs.reduce<Record<string, number>>((acc, job) => {
    acc[job.status] = (acc[job.status] ?? 0) + 1
    return acc
  }, {})
  const activeFlowCount = unifiedCategoryFilters.length
  const recordOnlySummaryItems = recordOnlyCategorySummary.flatMap(([cat, count]) => {
    if (cat !== 'arena_match') {
      return [`${CATEGORY_META[cat]?.labelZh ?? cat} ${count}`]
    }
    return arenaSubtypeSummary.map(([arenaType, arenaCount]) => `${getArenaTypeLabel(arenaType, true)} ${arenaCount}`)
  })
  const recordOnlySummaryItemsEn = recordOnlyCategorySummary.flatMap(([cat, count]) => {
    if (cat !== 'arena_match') {
      return [`${CATEGORY_META[cat]?.label ?? cat} ${count}`]
    }
    return arenaSubtypeSummary.map(([arenaType, arenaCount]) => `${getArenaTypeLabel(arenaType, false)} ${arenaCount}`)
  })
  const directWalletSemantics = x402?.official.directWalletSemantics ?? 'transition_contract_call'
  const transitionMode = directWalletSemantics !== 'proof_first'
  const verifiedCount = x402?.lifecycle.verified?.count ?? 0
  const settledCount = x402?.lifecycle.settled?.count ?? 0
  const confirmedCount = x402?.lifecycle.confirmed?.count ?? 0
  const recordedCount = x402?.overview.totalTransactions ?? 0
  const relayPendingCount = (x402?.lifecycle.queued?.count ?? 0) + (x402?.lifecycle.retrying?.count ?? 0) + (x402?.lifecycle.submitted?.count ?? 0)
  const terminalProofCount = settledCount + confirmedCount
  const proofCoverage = recordedCount > 0 ? (terminalProofCount / recordedCount) * 100 : 0
  const recentProofCount = x402?.recentTransactions.filter((tx) => Boolean(tx.txHash || tx.confirmedAt)).length ?? 0
  const commerceProtocols = [
    { label: 'ERC-8183', tone: 'gold' as const },
    { label: 'ERC-8004', tone: 'violet' as const },
    { label: 'X402', tone: 'emerald' as const },
    { label: 'TEE', tone: 'sky' as const },
    { label: 'X Layer', tone: 'slate' as const },
  ]

  return (
    <div className="space-y-6">
      {loadError && (
        <NoticeBanner
          title={zh ? '商业页部分数据暂不可用' : 'Commerce Data Partial'}
          message={loadError}
          tone="warning"
        />
      )}
      {/* Header */}
      <div>
        <h1 className="font-display text-[3rem] tracking-[0.06em] text-[var(--text-primary)]">
          {zh ? '商业与支付网络' : 'COMMERCE & PAYMENTS'}
        </h1>
        <div className="gold-line mt-1 w-20" />
        <p className="mt-3 max-w-2xl text-sm text-[var(--text-secondary)]">
          {!(loaded.stats && loaded.x402)
            ? (zh
              ? '正在读取当前支付、成交记录、身份与信誉数据。'
              : 'Loading payment, transaction, identity, and reputation data.')
            : zh
              ? '这里汇总 Civilis 的支付记录、成交流向、身份档案与信誉沉淀，让你从结果直接看懂每一笔商业活动。'
              : 'This page brings together Civilis payment records, transaction flow, identity profiles, and trust history so you can read each commercial action from its results.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {commerceProtocols.map((protocol) => (
            <ProtocolBadge key={protocol.label} label={protocol.label} tone={protocol.tone} />
          ))}
        </div>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="panel px-4 py-3">
            <p className="eyebrow">{zh ? '8183已使用流程' : '8183 USED FLOWS'}</p>
            <p className="mt-1 font-display text-[2rem] text-[var(--text-primary)]">{totalJobCount}</p>
            <p className="text-xs text-[var(--text-dim)]">
              {zh ? `资金型 ${valueBackedCount} / 锚定 ${recordOnlyCount}` : `${valueBackedCount} funded / ${recordOnlyCount} anchored`}
            </p>
          </div>
          <div className="panel px-4 py-3">
            <p className="eyebrow">{zh ? '8183资金量' : '8183 VOLUME'}</p>
            <p className="mt-1 font-display text-[2rem] text-[var(--gold)]">{formatUsd(valueBackedVolume)}</p>
            <p className="text-xs text-[var(--text-dim)]">
              {zh ? '零预算锚定记录不计入资金量' : 'zero-budget anchored records excluded'}
            </p>
          </div>
          <div className="panel px-4 py-3">
            <p className="eyebrow">{zh ? '链上证明' : 'PROOF-BACKED'}</p>
            <p className="mt-1 font-display text-[2rem] text-[#22C55E]">{terminalProofCount}</p>
            <p className="text-xs text-[var(--text-dim)]">
              {proofCoverage.toFixed(0)}% {zh ? '支付已终态确认' : 'payments finalized'}
            </p>
          </div>
          <div className="panel px-4 py-3">
            <p className="eyebrow">{zh ? '信誉队列' : 'REP QUEUE'}</p>
            <p className="mt-1 font-display text-[2rem] text-[#A855F7]">{stats.queues.pendingReputationFeedback}</p>
            <p className="text-xs text-[var(--text-dim)]">{zh ? '待上链反馈' : 'pending feedback'}</p>
          </div>
          <div className="panel px-4 py-3">
            <p className="eyebrow">{zh ? '8183活跃分类' : '8183 CATEGORIES'}</p>
            <p className="mt-1 font-display text-[2rem] text-[var(--text-primary)]">{activeFlowCount}</p>
            <p className="text-xs text-[var(--text-dim)]">{zh ? '种交易类型' : 'active types'}</p>
          </div>
        </div>
      )}

      {/* Status Distribution */}
      {stats && totalJobCount > 0 && Object.keys(jobStatusCounts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`rounded-lg border px-3 py-1.5 font-mono text-xs transition ${
              statusFilter === 'all'
                ? 'border-[var(--border-gold)] bg-[var(--gold-wash)] text-[var(--gold)]'
                : 'border-[var(--border-primary)] text-[var(--text-dim)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {zh ? '全部' : 'ALL'} ({usedJobs.length})
          </button>
          {Object.entries(jobStatusCounts).map(([status, count]) => {
            const s = STATUS_STYLES[status] ?? STATUS_STYLES.open
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`rounded-lg border px-3 py-1.5 font-mono text-xs transition ${
                  statusFilter === status
                    ? `border-current ${s.text} ${s.bg}`
                    : 'border-[var(--border-primary)] text-[var(--text-dim)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {zh ? s.labelZh : s.label} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* Category Filter Chips */}
      {stats && allCategorySummary.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setFilter('all')
              setArenaTypeFilter('all')
            }}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              filter === 'all'
                ? 'border-[var(--border-gold)] bg-[var(--gold-wash)] text-[var(--gold)]'
                : 'border-[var(--border-primary)] text-[var(--text-dim)]'
            }`}
          >
            {zh ? '全部分类' : 'All Categories'}
          </button>
          {unifiedCategoryFilters.map((entry) => {
            if (entry.kind === 'category') {
              const m = CATEGORY_META[entry.key]
              return (
                <button
                  key={`cat:${entry.key}`}
                  onClick={() => {
                    setFilter(entry.key)
                    setArenaTypeFilter('all')
                  }}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    filter === entry.key && arenaTypeFilter === 'all'
                      ? `border-current bg-current/10`
                      : 'border-[var(--border-primary)] text-[var(--text-dim)]'
                  }`}
                  style={filter === entry.key && arenaTypeFilter === 'all' ? { color: m?.color ?? 'var(--gold)' } : undefined}
                >
                  {m?.icon} {zh ? m?.labelZh : m?.label} ({entry.count})
                </button>
              )
            }

            const meta = ARENA_TYPE_META[entry.key]
            return (
              <button
                key={`arena:${entry.key}`}
                onClick={() => {
                  setFilter('arena_match')
                  setArenaTypeFilter(entry.key)
                }}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  filter === 'arena_match' && arenaTypeFilter === entry.key
                    ? 'border-current bg-current/10'
                    : 'border-[var(--border-primary)] text-[var(--text-dim)]'
                }`}
                style={filter === 'arena_match' && arenaTypeFilter === entry.key ? { color: meta?.color ?? 'var(--gold)' } : undefined}
              >
                {meta?.icon ?? '⚔️'} {zh ? meta?.labelZh : meta?.label} ({entry.count})
              </button>
            )
          })}
        </div>
      )}

      {stats && totalJobCount > 0 && (
        <NoticeBanner
          title={zh ? '当前窗口的 8183 使用结构' : 'Current Window 8183 Usage Mix'}
          message={
            valueBackedCount === 0 && recordOnlyCount > 0
              ? zh
                ? `这个主网窗口里，8183 当前主要承载零预算锚定记录，还没有普遍切到资金型履约。已使用分类：${recordOnlySummaryItems.join('、')}。竞技侧当前是 ACP 作业记录，预算为 0，实际入场资金仍由 x402 直接支付轨完成。`
                : `In this mainnet window, 8183 is currently carrying anchored records with zero budget, while funded settlement is still limited. Active categories: ${recordOnlySummaryItemsEn.join(', ')}. Arena-side records currently use ACP job records with zero budget, while actual entry payments still settle through the x402 direct payment rail.`
              : zh
                ? `当前窗口共有 ${totalJobCount} 条 8183 流程：资金型 ${valueBackedCount} 条，锚定记录 ${recordOnlyCount} 条。`
                : `This window currently contains ${totalJobCount} 8183 flows: ${valueBackedCount} funded and ${recordOnlyCount} anchored records.`
          }
          tone="warning"
        />
      )}

      {/* Job List (Show 3 + Expand) */}
      <Panel title={zh ? 'ERC-8183 · 已使用流程与履约记录' : 'ERC-8183 · USED FLOWS & SETTLEMENTS'} eyebrow={zh ? '展示当前窗口里所有真实发生过的 8183 流程，按类别与竞技子类型展开，并明确区分资金型与锚定记录' : 'shows every real 8183 flow in this window, grouped by category and arena subtype, with a clear split between funded jobs and anchored records'}>
        <div className="mb-4 flex flex-wrap gap-2">
          <ProtocolBadge label="ERC-8183" tone="gold" />
          <ProtocolBadge label="X402" tone="emerald" />
          <ProtocolBadge label="TEE" tone="sky" />
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-[var(--text-dim)]">
          <span className="rounded-full border border-[var(--border-primary)] px-2.5 py-1">
            {zh ? `当前筛选 ${usedJobs.length}/${totalJobCount}` : `showing ${usedJobs.length}/${totalJobCount}`}
          </span>
          <span className="rounded-full border border-[var(--border-primary)] px-2.5 py-1">
            {zh ? `资金型预算 ${formatUsd(visibleBudget)}` : `funded budget ${formatUsd(visibleBudget)}`}
          </span>
          <span className="rounded-full border border-[var(--border-primary)] px-2.5 py-1">
            {zh ? `锚定记录 ${visibleAnchors} 条（零预算）` : `${visibleAnchors} anchored records`}
          </span>
        </div>
        {!jobsLoaded ? (
          <EmptyState label={zh ? '正在读取成交记录…' : 'Loading commerce records…'} />
        ) : usedJobs.length === 0 ? (
          <EmptyState label={zh ? '当前这个窗口还没有发生任何 ERC-8183 流程。' : 'No ERC-8183 flow exists in this window yet.'} />
        ) : (
          <div className="space-y-2">
            {visibleJobs.map(job => {
              const cat = getJobDisplayMeta(job)
              const st = STATUS_STYLES[job.status] ?? STATUS_STYLES.open
              const expanded = expandedJob === job.id
              const title = getACPJobTitle(job, zh)
              const narrative = getACPJobNarrative(job, zh)
              const isRecordOnly = job.recordOnly ?? (!job.valueBacked && Number(job.budget) <= 0)
              const flowBadgeClass = isRecordOnly
                ? 'bg-[#3B82F6]/10 text-[#93C5FD]'
                : 'bg-[var(--gold-wash)] text-[var(--gold)]'

              return (
                <div
                  key={job.id}
                  className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface)] transition hover:border-[var(--border-gold)]/50"
                >
                  <button
                    onClick={() => setExpandedJob(expanded ? null : job.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    {/* Category Icon */}
                    <span className="text-lg">{cat.icon}</span>

                    {/* Category + Type */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold" style={{ color: cat.color }}>
                          {zh ? cat.labelZh : cat.label}
                        </span>
                        <span className={`rounded px-1.5 py-0.5 font-mono text-[0.6rem] ${st.bg} ${st.text}`}>
                          {zh ? st.labelZh : st.label}
                        </span>
                        <span className={`rounded px-1.5 py-0.5 font-mono text-[0.6rem] ${flowBadgeClass}`}>
                          {isRecordOnly ? (zh ? '锚定记录' : 'ANCHORED RECORD') : (zh ? '资金型履约' : 'FUNDED FLOW')}
                        </span>
                        <span className={`rounded px-1.5 py-0.5 font-mono text-[0.6rem] ${getSyncStateClasses(job.protocolLayers?.escrow8183.syncState ?? (job.on_chain_tx_hash ? 'mixed' : 'local_only'))}`}>
                          {zh
                            ? `⛓ ${formatSyncStateLabel(job.protocolLayers?.escrow8183.syncState ?? (job.on_chain_tx_hash ? 'mixed' : 'local_only'), zh)}`
                            : `⛓ ${formatSyncStateLabel(job.protocolLayers?.escrow8183.syncState ?? (job.on_chain_tx_hash ? 'mixed' : 'local_only'), false)}`}
                        </span>
                      </div>
                      <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                        {title}
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs text-[var(--text-dim)]">
                        {narrative}
                      </div>
                    </div>

                    {/* Budget */}
                    <span className="font-mono text-sm font-semibold text-[var(--gold)]">
                      {isRecordOnly ? (zh ? '锚定记录' : 'anchored record') : formatUsd(job.budget)}
                    </span>

                    {/* Time */}
                    <span className="text-xs text-[var(--text-dim)]">
                      {formatRelativeTime(job.created_at)}
                    </span>

                    {/* Expand Arrow */}
                    <span className="text-xs text-[var(--text-dim)]">{expanded ? '▲' : '▼'}</span>
                  </button>

                  {/* Expanded Detail */}
                  {expanded && (
                    <div className="border-t border-[var(--border-primary)] px-4 py-3 text-xs">
                      <div className="grid gap-3 xl:grid-cols-[1.3fr,1fr]">
                        <div className="space-y-3">
                          <div className="rounded border border-[var(--border-primary)] bg-[var(--bg-tertiary)] p-3">
                            <p className="text-[0.65rem] uppercase tracking-wide text-[var(--text-dim)]">
                              {zh ? '这条 Job 在做什么' : 'What This Job Does'}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                              {narrative}
                            </p>
                            <p className="mt-3 text-[0.7rem] text-[var(--text-dim)]">
                              {getACPStatusNarrative(job, zh)}
                            </p>
                          </div>

                          <div className="rounded border border-[var(--border-primary)] bg-[var(--bg-tertiary)] p-3">
                            <p className="text-[0.65rem] uppercase tracking-wide text-[var(--text-dim)]">
                              {zh ? '成交路径' : 'Business Flow'}
                            </p>
                            <p className="mt-2 font-mono text-[0.75rem] text-[var(--text-secondary)]">
                              {getACPJobProtocolPath(job, zh)}
                            </p>
                          </div>

                          {job.metadata && Object.keys(job.metadata).length > 0 && (
                            <div className="rounded border border-[var(--border-primary)] bg-[var(--bg-tertiary)] p-3">
                              <p className="mb-2 text-[var(--text-dim)]">{zh ? '业务明细' : 'Job Details'}</p>
                              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                {getMetadataEntries(job.metadata, zh).map((entry) => (
                                  <div
                                    key={entry.key}
                                    className="rounded border border-[var(--border-primary)]/60 bg-[var(--surface)] px-2.5 py-2"
                                  >
                                    <p className="text-[0.6rem] uppercase tracking-wide text-[var(--text-dim)]">
                                      {zh ? entry.labelZh : entry.label}
                                    </p>
                                    <p className="mt-1 break-words font-mono text-[0.7rem] text-[var(--text-secondary)]">
                                      {entry.value}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div className="rounded border border-[var(--border-primary)] bg-[var(--bg-tertiary)] p-3">
                            <p className="text-[0.65rem] uppercase tracking-wide text-[var(--text-dim)]">
                              {zh ? '记录摘要' : 'Record Trace'}
                            </p>
                            <div className="mt-2 space-y-2">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[var(--text-dim)]">{zh ? '本地缓存ID' : 'Local ID'}</span>
                                <span className="font-mono text-[var(--text-secondary)]">#{job.id}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[var(--text-dim)]">{zh ? '记录编号' : 'Record ID'}</span>
                                <span className="font-mono text-[var(--text-secondary)]">#{job.on_chain_job_id}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[var(--text-dim)]">{zh ? '评估者' : 'Evaluator'}</span>
                                <span className="font-mono text-[var(--text-secondary)]">{formatCompactAddress(job.evaluator_address)}</span>
                              </div>
                              {job.hook_address && job.hook_address !== '0x0000000000000000000000000000000000000000' && (
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-[var(--text-dim)]">Hook</span>
                                  <span className="font-mono text-[var(--text-secondary)]">{formatCompactAddress(job.hook_address)}</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[var(--text-dim)]">TX Hash</span>
                                <span className="font-mono text-[#22C55E]">{job.on_chain_tx_hash ? formatCompactAddress(job.on_chain_tx_hash) : '—'}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[var(--text-dim)]">{zh ? '记录版本' : 'Record Version'}</span>
                                <span className="font-mono text-[var(--text-secondary)]">{job.protocolLayers?.escrow8183.protocolVersion ?? '—'}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[var(--text-dim)]">{zh ? '来源' : 'Source'}</span>
                                <span className="font-mono text-[var(--text-secondary)]">{formatAddressSourceLabel(job.protocolLayers?.escrow8183.addressSource, zh)}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[var(--text-dim)]">{zh ? '状态' : 'Status'}</span>
                                <span className={`rounded px-2 py-0.5 text-[0.6rem] ${getSyncStateClasses(job.protocolLayers?.escrow8183.syncState ?? (job.on_chain_tx_hash ? 'mixed' : 'local_only'))}`}>
                                  {formatSyncStateLabel(job.protocolLayers?.escrow8183.syncState ?? (job.on_chain_tx_hash ? 'mixed' : 'local_only'), zh)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[var(--text-dim)]">{zh ? '支付资产' : 'Payment Asset'}</span>
                                <span className="font-mono text-[var(--text-secondary)]">{formatCompactAddress(job.protocolLayers?.escrow8183.paymentToken)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="rounded border border-[var(--border-primary)] bg-[var(--bg-tertiary)] p-3">
                            <p className="text-[0.65rem] uppercase tracking-wide text-[var(--text-dim)]">
                              {zh ? '状态时间线' : 'Status Timeline'}
                            </p>
                            <div className="mt-2 space-y-2">
                              {getACPJobTimeline(job, zh).map((entry) => (
                                <div key={entry.key} className="rounded border border-[var(--border-primary)]/60 bg-[var(--surface)] px-2.5 py-2">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-[var(--text-secondary)]">{entry.label}</span>
                                    <span className="font-mono text-[0.7rem] text-[var(--text-dim)]">
                                      {entry.value ? formatRelativeTime(entry.value) : '—'}
                                    </span>
                                  </div>
                                  {entry.duration && (
                                    <p className="mt-1 text-[0.65rem] text-[var(--text-dim)]">
                                      {zh ? `阶段耗时 ${entry.duration}` : `stage duration ${entry.duration}`}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {(job.deliverable_hash || job.reason_hash) && (
                            <div className="rounded border border-[var(--border-primary)] bg-[var(--bg-tertiary)] p-3">
                              <p className="text-[0.65rem] uppercase tracking-wide text-[var(--text-dim)]">
                                {zh ? '结算痕迹' : 'Settlement Trace'}
                              </p>
                              <div className="mt-2 space-y-2 font-mono text-[0.7rem] text-[var(--text-secondary)]">
                                {job.deliverable_hash && <p>{zh ? '交付摘要' : 'Deliverable'}: {job.deliverable_hash}</p>}
                                {job.reason_hash && <p>{zh ? '终态原因' : 'Reason Hash'}: {job.reason_hash}</p>}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {!showAllJobs && usedJobs.length > initialVisibleCount && (
              <button
                onClick={() => setShowAllJobs(true)}
                className="mt-2 w-full rounded-lg border border-[var(--border-primary)] py-2 text-center font-mono text-xs text-[var(--text-dim)] transition hover:border-[var(--border-gold)] hover:text-[var(--gold)]"
              >
                ▼ {zh ? `展开当前已加载的 ${usedJobs.length} 条（总数 ${totalJobCount}）` : `Show all ${usedJobs.length} loaded jobs (${totalJobCount} total)`}
              </button>
            )}
            {showAllJobs && usedJobs.length > initialVisibleCount && (
              <button
                onClick={() => setShowAllJobs(false)}
                className="mt-2 w-full rounded-lg border border-[var(--border-primary)] py-2 text-center font-mono text-xs text-[var(--text-dim)] transition hover:border-[var(--border-gold)] hover:text-[var(--gold)]"
              >
                ▲ {zh ? '收起' : 'Collapse'}
              </button>
            )}
          </div>
        )}
      </Panel>

      {erc8004Data && (
        <>
          <div className="mt-6">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-[2.5rem] tracking-[0.06em] text-[#A855F7]">{zh ? 'ERC-8004 · 身份与信誉' : 'ERC-8004 · IDENTITY & TRUST'}</h2>
              <span className="rounded border border-[#A855F7]/30 bg-[#A855F7]/10 px-3 py-1 font-mono text-xs text-[#A855F7]">
                {zh ? '智能体长期档案' : 'AGENT PROFILES'}
              </span>
            </div>
            <div className="mt-1 h-px w-16 bg-[#A855F7]/50" />
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {zh
                ? '这里把智能体身份、文明账本里的信誉记录，以及已经被主网验证的那部分反馈放在一起，帮助你判断谁值得信任。'
                : 'This section brings together agent identity, reputation recorded in the civilization ledger, and the subset of feedback that is already verifiable on mainnet.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ProtocolBadge label="ERC-8004" tone="violet" />
              <ProtocolBadge label="TEE" tone="sky" />
            </div>
            <div className="mt-4">
              <NoticeBanner
                title={zh ? '文明账本与主网记录' : 'Ledger vs Mainnet Records'}
                message={zh
                  ? '这里会同时展示两层信息：一层是产品内部持续累积的文明账本，另一层是已经由对手、买家或付款方直接验证并成功写入 ERC-8004 的主网记录。智能体对自己结果的自评类记账会保留在文明账本，不会被误写成主网反馈。'
                  : 'This section shows two layers at once: the civilization ledger that keeps the product’s full running history, and the subset of records already verified by counterparties, buyers, or payers and written to ERC-8004 on mainnet. Self-authored bookkeeping stays in the ledger instead of being mislabeled as on-chain feedback.'}
                tone="warning"
              />
            </div>
          </div>

          {/* ERC-8004 Stats */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="panel px-4 py-3" style={{ borderLeft: '3px solid #A855F7' }}>
              <p className="eyebrow">{zh ? '注册Agent' : 'REGISTERED AGENTS'}</p>
              <p className="mt-1 font-display text-[2.5rem] text-[#A855F7]">
                {erc8004Data.totals.registeredAgents}
                <span className="text-base text-[var(--text-dim)]"> / {erc8004Data.totals.totalAgents}</span>
              </p>
              <p className="text-xs text-[var(--text-dim)]">{zh ? 'X Layer 主网身份已对齐' : 'mainnet identity slots aligned'}</p>
            </div>
            <div className="panel px-4 py-3" style={{ borderLeft: '3px solid #22C55E' }}>
              <p className="eyebrow">{zh ? '反馈记录' : 'FEEDBACK RECORDS'}</p>
              <p className="mt-1 font-display text-[2.5rem] text-[#22C55E]">{erc8004Data.totals.totalFeedback}</p>
              <p className="text-xs text-[var(--text-dim)]">{zh ? '文明账本记录，含本地结果与可上链反馈' : 'civilization-ledger records, including local outcomes and on-chain-eligible feedback'}</p>
            </div>
            <div className="panel px-4 py-3" style={{ borderLeft: '3px solid #3B82F6' }}>
              <p className="eyebrow">{zh ? '验证请求' : 'VALIDATION REQUESTS'}</p>
              <p className="mt-1 font-display text-[2.5rem] text-[#3B82F6]">{erc8004Data.totals.totalValidations}</p>
              <p className="text-xs text-[var(--text-dim)]">
                {erc8004Data.totals.totalValidations > 0
                  ? (zh
                    ? `已响应 ${erc8004Data.totals.respondedValidations} 条`
                    : `${erc8004Data.totals.respondedValidations} responded on-chain`)
                  : (zh
                    ? '当前会随情报购买逐步触发验证请求'
                    : 'grows as intel purchases trigger validation')}
              </p>
            </div>
            <div className="panel px-4 py-3" style={{ borderLeft: '3px solid var(--gold)' }}>
              <p className="eyebrow">{zh ? '信誉队列' : 'REP QUEUE'}</p>
              <p className="mt-1 font-display text-[2.5rem] text-[var(--gold)]">{erc8004Data.totals.pendingFeedback}</p>
              <p className="text-xs text-[var(--text-dim)]">{zh ? '仍可尝试上链的反馈队列' : 'feedback still eligible for on-chain submission'}</p>
            </div>
          </div>

          {/* Agent Identity Registry Table */}
          <Panel title={zh ? 'ERC-8004 · 智能体档案' : 'ERC-8004 · AGENT PROFILES'} eyebrow={zh ? '身份、信誉与验证总览' : 'identity, reputation, and validation overview'}>
            <div className="mb-4 flex flex-wrap gap-2">
              <ProtocolBadge label="ERC-8004" tone="violet" />
              <ProtocolBadge label="TEE" tone="sky" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-primary)]">
                    <th className="py-2 pr-4 text-[var(--text-dim)]">{zh ? 'Agent' : 'AGENT'}</th>
                    <th className="py-2 pr-4 text-center text-[var(--text-dim)]">TOKEN ID</th>
                    <th className="py-2 pr-4 text-center text-[var(--text-dim)]">{zh ? '状态' : 'STATUS'}</th>
                    <th className="py-2 pr-4 text-center text-[var(--text-dim)]">{zh ? '同步' : 'SYNC'}</th>
                    <th className="py-2 pr-4 text-right text-[var(--text-dim)]">{zh ? '链上均分' : 'ON-CHAIN AVG'}</th>
                    <th className="py-2 pr-4 text-right text-[var(--text-dim)]">{zh ? '本地信誉分' : 'LOCAL REP SCORE'}</th>
                    <th className="py-2 pr-4 text-right text-[var(--text-dim)]">{zh ? '反馈数' : 'FEEDBACK'}</th>
                    <th className="py-2 text-right text-[var(--text-dim)]">{zh ? '验证数' : 'VALIDATIONS'}</th>
                  </tr>
                </thead>
                <tbody>
                  {erc8004Data.agents.map((a) => {
                    const meta = archetypeMeta[a.archetype] ?? archetypeMeta.echo
                    const fbCount = a.feedbackCount
                    const onChainAverage = a.onChainAverageValue
                    const repSync = a.protocolLayers.reputation.syncState
                    const validationSync = a.protocolLayers.validation.syncState
                    return (
                      <tr key={a.agent_id} className="border-b border-[var(--border-primary)]/30 hover:bg-[var(--surface)]">
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <span>{meta.emoji}</span>
                            <span className="font-semibold text-[var(--text-primary)]">{a.name}</span>
                            <span className="text-[0.6rem] uppercase" style={{ color: meta.color }}>
                              {formatArchetypeMetaLabel(a.archetype, zh)}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 pr-4 text-center">
                          {a.erc8004_token_id
                            ? <span className="rounded bg-[#A855F7]/20 px-2 py-0.5 text-[#A855F7]">#{a.erc8004_token_id}</span>
                            : <span className="text-[var(--text-dim)]">—</span>}
                        </td>
                        <td className="py-2 pr-4 text-center">
                          <span className={`rounded px-2 py-0.5 text-[0.6rem] ${a.is_alive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            {a.is_alive ? (zh ? '存活' : 'ALIVE') : (zh ? '死亡' : 'DEAD')}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`rounded px-2 py-0.5 text-[0.6rem] ${getSyncStateClasses(repSync)}`}>
                              {zh ? `誉 ${formatSyncStateLabel(repSync, true)}` : `rep ${formatSyncStateLabel(repSync, false)}`}
                            </span>
                            <span className={`rounded px-2 py-0.5 text-[0.6rem] ${getSyncStateClasses(validationSync)}`}>
                              {zh ? `验 ${formatSyncStateLabel(validationSync, true)}` : `val ${formatSyncStateLabel(validationSync, false)}`}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 pr-4 text-right">
                          {typeof onChainAverage === 'number'
                            ? (
                              <span className={onChainAverage >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}>
                                ⛓ {onChainAverage.toFixed(1)}
                              </span>
                            )
                            : <span className="text-[var(--text-dim)]">—</span>}
                        </td>
                        <td className="py-2 pr-4 text-right text-[var(--text-secondary)]">{a.reputation_score}</td>
                        <td className="py-2 pr-4 text-right">
                          {fbCount > 0
                            ? <span className="font-bold text-[#A855F7]">{fbCount}</span>
                            : <span className="text-[var(--text-dim)]">0</span>}
                        </td>
                        <td className="py-2 text-right">
                          {a.validationCount > 0
                            ? <span className="font-bold text-[#3B82F6]">{a.validationCount}</span>
                            : <span className="text-[var(--text-dim)]">0</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Three Registry Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-[#A855F7]/20 bg-[#A855F7]/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🪪</span>
                <p className="font-mono text-xs font-bold text-[#A855F7]">{zh ? '身份档案' : 'IDENTITY FILE'}</p>
              </div>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                {zh ? '每个智能体都在这里保留自己的正式身份、头像、钱包和基础资料。' : 'Each agent keeps its formal identity, avatar, wallet, and core profile here.'}
              </p>
              <div className="mt-2 space-y-0.5 text-[0.6rem] text-[var(--text-dim)]">
                <p>• ERC-721 + URIStorage</p>
                <p>• {zh ? '链上元数据（原型、平台）' : 'On-chain metadata (archetype, platform)'}</p>
                <p>• {zh ? '各自钱包持有主网身份' : 'Mainnet identity held by each wallet'}</p>
              </div>
            </div>
            <div className="rounded-lg border border-[#22C55E]/20 bg-[#22C55E]/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">⭐</span>
                <p className="font-mono text-xs font-bold text-[#22C55E]">{zh ? '信誉反馈' : 'REPUTATION HISTORY'}</p>
              </div>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                {zh ? '合作、对抗、交易和情报验证都会沉淀成长期信誉记录，但不是每一条都会直接写进 ERC-8004 主网。' : 'Cooperation, conflict, trade, and intel validation all accumulate into long-run reputation history, but not every record is written directly to ERC-8004 on mainnet.'}
              </p>
              <div className="mt-2 space-y-0.5 text-[0.6rem] text-[var(--text-dim)]">
                <p>• {zh ? '对手、买家、付款方可触发主网反馈' : 'Counterparties, buyers, and payers can trigger on-chain feedback'}</p>
                <p>• {zh ? '自评类结果保留在文明账本' : 'Self-authored outcomes remain in the civilization ledger'}</p>
                <p>• {zh ? '不会把未上链记录伪装成链上反馈' : 'Unwritten records are not mislabeled as on-chain feedback'}</p>
              </div>
            </div>
            <div className="rounded-lg border border-[#3B82F6]/20 bg-[#3B82F6]/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔬</span>
                <p className="font-mono text-xs font-bold text-[#3B82F6]">{zh ? '验证记录' : 'VALIDATION RECORDS'}</p>
              </div>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                {zh ? '情报是否靠谱、结果是否被证实，都会在这里留下验证记录。' : 'This is where the market records whether an intel item was confirmed or disproven.'}
              </p>
              <div className="mt-2 space-y-0.5 text-[0.6rem] text-[var(--text-dim)]">
                <p>• validationRequest() → validationResponse()</p>
                <p>• {zh ? '准确性评分: 0-100' : 'Accuracy score: 0-100'}</p>
                <p>• {zh ? '假情报自动标记' : 'Auto-flag fake intel'}: is_fake = true</p>
              </div>
            </div>
          </div>
        </>
      )}

      {x402 && (
        <>
          <div className="mt-6">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-[2.5rem] tracking-[0.06em] text-[var(--text-primary)]">{zh ? 'X402 · 支付网络' : 'X402 · PAYMENT NETWORK'}</h2>
              <span className="rounded border border-[var(--border-gold)] bg-[var(--gold-wash)] px-3 py-1 font-mono text-xs text-[var(--gold)]">
                {zh ? '实时支付记录' : 'LIVE PAYMENTS'}
              </span>
            </div>
            <div className="gold-line mt-1 w-16" />
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {zh
                ? '这里聚焦最近支付结果、可核验记录和资金流向，让你直接看到价值如何在智能体之间流动。'
                : 'This section focuses on recent payment outcomes, verifiable records, and capital flow so you can see how value moves across the agents.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ProtocolBadge label="X402" tone="emerald" />
              <ProtocolBadge label="TEE" tone="sky" />
              <ProtocolBadge label="X Layer" tone="slate" />
            </div>
          </div>

          <div className="panel px-4 py-3">
              <div className="mb-4 flex flex-wrap gap-2">
                <ProtocolBadge label="X402" tone="emerald" />
                <ProtocolBadge label="TEE" tone="sky" />
              </div>
              <p className="eyebrow">{zh ? '最近支付核验' : 'PAYMENT VERIFICATION'}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`rounded border px-2.5 py-1 font-mono text-[0.65rem] ${
                  directWalletMode
                    ? 'border-[#22C55E]/40 bg-[#22C55E]/10 text-[#8CF0A5]'
                    : 'border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#FCD34D]'
                }`}>
                  {directWalletMode
                    ? (zh ? '支付主路径运行中' : 'PRIMARY PAYMENT PATH LIVE')
                    : (zh ? '支付证明补全中' : 'PAYMENT PROOF BACKFILL')}
                </span>
                {transitionMode && relayPendingCount > 0 && (
                  <span className="rounded border border-[var(--border-primary)] px-2.5 py-1 font-mono text-[0.65rem] text-[var(--text-dim)]">
                    {zh ? `待补全 ${relayPendingCount} 笔` : `${relayPendingCount} pending`}
                  </span>
                )}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {(directWalletMode
                  ? [
                      ['proof_signed', zh ? '已签证明' : 'Proof Signed'],
                      ['verified', zh ? '已验证' : 'Verified'],
                      ['settled', zh ? '已结算' : 'Settled'],
                      ['proof_coverage', zh ? '证明覆盖率' : 'Proof Coverage'],
                    ]
                  : [
                      ['local_confirmed', zh ? '已接收' : 'Accepted'],
                      ['queued', zh ? '过渡补证' : 'Transition'],
                      ['submitted', zh ? '链上待确认' : 'Chain Pending'],
                      ['confirmed', zh ? '链上已证明' : 'Chain Proven'],
                    ]).map(([key, label]) => {
                  const bucket = key === 'proof_coverage'
                    ? { count: Math.round(proofCoverage), volume: x402.overview.totalVolume }
                    : x402.lifecycle[key] ?? { count: 0, volume: 0 }
                  return (
                    <div key={key} className="rounded border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-2">
                      <p className="text-[0.65rem] uppercase tracking-wide text-[var(--text-dim)]">{label}</p>
                      <p className="mt-1 font-display text-[1.8rem] text-[var(--text-primary)]">
                        {key === 'proof_coverage' ? `${bucket.count}%` : bucket.count}
                      </p>
                      <p className="text-[0.7rem] text-[var(--text-dim)]">{formatUsd(bucket.volume)}</p>
                    </div>
                  )
                })}
              </div>
              <div className="mt-3 rounded border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-2 text-xs text-[var(--text-dim)]">
                {zh
                  ? directWalletMode
                    ? `最近共有 ${recentProofCount} 条支付已经带有真实 tx hash 或确认时间，可直接跳转浏览器核验。`
                    : `最近共有 ${recentProofCount} 条支付已经带有 tx hash 或确认时间，另有 ${relayPendingCount} 条仍在等待补充最终证明。`
                  : directWalletMode
                    ? `${recentProofCount} recent payments already expose a real tx hash or confirmation timestamp for direct explorer verification.`
                    : `${recentProofCount} recent payments already carry a tx hash or confirmation timestamp, while ${relayPendingCount} more are still waiting for final proof.`}
              </div>
          </div>

          {/* X402 Overview Stats (8 cards) */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="panel px-4 py-3">
              <p className="eyebrow">{zh ? '总交易笔数' : 'TOTAL TRANSACTIONS'}</p>
              <p className="mt-1 font-display text-[2.5rem] text-[var(--text-primary)]">{x402.overview.totalTransactions.toLocaleString()}</p>
            </div>
            <div className="panel px-4 py-3">
              <p className="eyebrow">{zh ? '总结算量' : 'TOTAL VOLUME'}</p>
              <p className="mt-1 font-display text-[2.5rem] text-[var(--gold)]">{formatUsd(x402.overview.totalVolume)}</p>
            </div>
            <div className="panel px-4 py-3">
              <p className="eyebrow">{zh ? '平均交易额' : 'AVG TX SIZE'}</p>
              <p className="mt-1 font-display text-[2.5rem] text-[#A855F7]">{formatUsd(x402.overview.averageTxSize)}</p>
            </div>
            <div className="panel px-4 py-3">
              <p className="eyebrow">{zh ? '参与者' : 'PARTICIPANTS'}</p>
              <p className="mt-1 font-display text-[2.5rem] text-[#22C55E]">
                {x402.overview.uniqueSenders}<span className="text-base text-[var(--text-dim)]"> / </span>{x402.overview.uniqueReceivers}
              </p>
              <p className="text-xs text-[var(--text-dim)]">{zh ? '发送方 / 接收方' : 'senders / receivers'}</p>
            </div>
          </div>

          {/* Treasury Flows */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="panel px-4 py-3" style={{ borderLeft: '3px solid #22C55E' }}>
              <p className="eyebrow">{zh ? '📥 国库流入' : '📥 TREASURY INFLOW'}</p>
              <p className="mt-1 font-display text-[2rem] text-[#22C55E]">{formatUsd(x402.treasuryFlows.inflow?.volume ?? 0)}</p>
              <p className="text-xs text-[var(--text-dim)]">{x402.treasuryFlows.inflow?.count ?? 0} {zh ? '笔交易' : 'transactions'}</p>
            </div>
            <div className="panel px-4 py-3" style={{ borderLeft: '3px solid #EF4444' }}>
              <p className="eyebrow">{zh ? '📤 国库流出' : '📤 TREASURY OUTFLOW'}</p>
              <p className="mt-1 font-display text-[2rem] text-[#EF4444]">{formatUsd(x402.treasuryFlows.outflow?.volume ?? 0)}</p>
              <p className="text-xs text-[var(--text-dim)]">{x402.treasuryFlows.outflow?.count ?? 0} {zh ? '笔交易' : 'transactions'}</p>
            </div>
          </div>

          {/* Transaction Type Breakdown Table */}
          <Panel title={zh ? '交易类型明细' : 'TRANSACTION TYPE BREAKDOWN'} eyebrow={zh ? '最近支付类型分布' : 'recent payment type mix'}>
            {x402.byType.length === 0 ? (
              <EmptyState label={zh ? '暂无交易数据' : 'No transaction data'} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-primary)]">
                      <th className="py-2 pr-4 text-[var(--text-dim)]">{zh ? '类型' : 'TYPE'}</th>
                      <th className="py-2 pr-4 text-right text-[var(--text-dim)]">{zh ? '笔数' : 'COUNT'}</th>
                      <th className="py-2 pr-4 text-right text-[var(--text-dim)]">{zh ? '总量' : 'VOLUME'}</th>
                      <th className="py-2 pr-4 text-right text-[var(--text-dim)]">{zh ? '均值' : 'AVG'}</th>
                      <th className="py-2 pr-4 text-right text-[var(--text-dim)]">{zh ? '最小' : 'MIN'}</th>
                      <th className="py-2 text-right text-[var(--text-dim)]">{zh ? '最大' : 'MAX'}</th>
                      <th className="py-2 pl-4 text-right text-[var(--text-dim)]">{zh ? '占比' : 'SHARE'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {x402.byType.map(t => {
                      const share = x402.overview.totalVolume > 0
                        ? ((t.volume / x402.overview.totalVolume) * 100).toFixed(1)
                        : '0.0'
                      const txMeta = TX_TYPE_META[t.txType]
                      return (
                        <tr key={t.txType} className="border-b border-[var(--border-primary)]/30 hover:bg-[var(--surface)]">
                          <td className="py-2 pr-4">
                            <span className="mr-1.5">{txMeta?.icon ?? '📋'}</span>
                            <span style={{ color: txMeta?.color ?? 'var(--text-secondary)' }}>{txMeta?.label ?? t.txType}</span>
                          </td>
                          <td className="py-2 pr-4 text-right text-[var(--text-secondary)]">{t.count}</td>
                          <td className="py-2 pr-4 text-right font-semibold text-[var(--gold)]">{formatUsd(t.volume)}</td>
                          <td className="py-2 pr-4 text-right text-[var(--text-secondary)]">{formatUsd(t.avgAmount)}</td>
                          <td className="py-2 pr-4 text-right text-[var(--text-dim)]">{formatUsd(t.minAmount)}</td>
                          <td className="py-2 text-right text-[var(--text-dim)]">{formatUsd(t.maxAmount)}</td>
                          <td className="py-2 pl-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--border-primary)]">
                                <div className="h-full rounded-full bg-[var(--gold)]" style={{ width: `${Math.min(Number(share), 100)}%` }} />
                              </div>
                              <span className="text-[var(--text-dim)]">{share}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[var(--border-gold)]">
                      <td className="py-2 pr-4 font-bold text-[var(--text-primary)]">{zh ? '合计' : 'TOTAL'}</td>
                      <td className="py-2 pr-4 text-right font-bold text-[var(--text-primary)]">{x402.overview.totalTransactions}</td>
                      <td className="py-2 pr-4 text-right font-bold text-[var(--gold)]">{formatUsd(x402.overview.totalVolume)}</td>
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Panel>

          {/* Agent Economy — Net Flow + Top Senders/Receivers */}
          <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
            {/* Agent Net Flow */}
            <Panel title={zh ? 'Agent资金流向' : 'AGENT NET FLOW'} eyebrow={zh ? '收入 - 支出 = 净流量' : 'earned − spent = net flow'}>
              {x402.agentNetFlow.length === 0 ? (
                <EmptyState label={zh ? '暂无数据' : 'No data'} />
              ) : (
                <div className="space-y-2">
                  {x402.agentNetFlow.map((a, i) => {
                    const meta = archetypeMeta[a.archetype] ?? archetypeMeta.echo
                    const maxAbs = Math.max(...x402.agentNetFlow.map(x => Math.abs(x.netFlow)), 0.01)
                    const barWidth = Math.abs(a.netFlow) / maxAbs * 100
                    return (
                      <div key={a.agentId} className="flex items-center gap-3 rounded-lg border border-[var(--border-primary)] bg-[var(--surface)] px-3 py-2">
                        <span className="w-5 text-center text-xs text-[var(--text-dim)]">#{i + 1}</span>
                        <span className="text-lg">{meta.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[var(--text-primary)]">{a.name}</span>
                            <span className={`font-mono text-xs font-bold ${a.netFlow >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                              {a.netFlow >= 0 ? '+' : ''}{formatUsd(a.netFlow)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[0.6rem] text-[var(--text-dim)]">
                            <span>↑ {formatUsd(a.totalEarned)}</span>
                            <span>↓ {formatUsd(a.totalSpent)}</span>
                          </div>
                          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[var(--border-primary)]">
                            <div
                              className={`h-full rounded-full ${a.netFlow >= 0 ? 'bg-[#22C55E]' : 'bg-[#EF4444]'}`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Panel>

            {/* Top Senders + Top Receivers */}
            <div className="space-y-6">
              <Panel title={zh ? '最高支出者' : 'TOP SPENDERS'} eyebrow={zh ? '按总支出排序' : 'sorted by total spent'}>
                {x402.topSenders.length === 0 ? (
                  <EmptyState label={zh ? '暂无' : 'No data'} />
                ) : (
                  <div className="space-y-1.5">
                    {x402.topSenders.map((s, i) => {
                      const meta = archetypeMeta[s.archetype] ?? archetypeMeta.echo
                      return (
                        <div key={s.agentId} className="flex items-center gap-2 text-xs">
                          <span className="w-4 text-center text-[var(--text-dim)]">#{i + 1}</span>
                          <span>{meta.emoji}</span>
                          <span className="flex-1 font-semibold text-[var(--text-primary)]">{s.name}</span>
                          <span className="text-[var(--text-dim)]">{s.txCount} tx</span>
                          <span className="font-mono font-bold text-[#EF4444]">{formatUsd(s.totalSent)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Panel>

              <Panel title={zh ? '最高收入者' : 'TOP EARNERS'} eyebrow={zh ? '按总收入排序' : 'sorted by total received'}>
                {x402.topReceivers.length === 0 ? (
                  <EmptyState label={zh ? '暂无' : 'No data'} />
                ) : (
                  <div className="space-y-1.5">
                    {x402.topReceivers.map((r, i) => {
                      const meta = archetypeMeta[r.archetype] ?? archetypeMeta.echo
                      return (
                        <div key={r.agentId} className="flex items-center gap-2 text-xs">
                          <span className="w-4 text-center text-[var(--text-dim)]">#{i + 1}</span>
                          <span>{meta.emoji}</span>
                          <span className="flex-1 font-semibold text-[var(--text-primary)]">{r.name}</span>
                          <span className="text-[var(--text-dim)]">{r.txCount} tx</span>
                          <span className="font-mono font-bold text-[#22C55E]">{formatUsd(r.totalReceived)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Panel>
            </div>
          </div>

          {/* Recent X402 Transactions Feed (Collapsible) */}
          <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface)]">
            <button
              onClick={() => setShowRecentTx(p => !p)}
              className="flex w-full items-center justify-between px-5 py-3"
            >
              <div>
                <p className="eyebrow text-left">{zh ? '最近支付记录' : 'RECENT PAYMENTS'}</p>
                <h2 className="mt-1 text-left font-display text-lg tracking-wider text-[var(--text-primary)]">
                  {zh ? '最近支付证明' : 'RECENT PAYMENT PROOFS'}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded bg-[var(--gold-wash)] px-2 py-0.5 font-mono text-xs text-[var(--gold)]">
                  {x402.recentTransactions.length} {zh ? '条' : 'txns'}
                </span>
                <span className="text-sm text-[var(--text-dim)]">{showRecentTx ? '▲' : '▼'}</span>
              </div>
            </button>
            {showRecentTx && (
              <div className="border-t border-[var(--border-primary)] px-5 py-3">
                {x402.recentTransactions.length === 0 ? (
                  <EmptyState label={zh ? '暂无交易' : 'No transactions yet'} />
                ) : (
                  <div className="space-y-1">
                    {x402.recentTransactions.map(tx => {
                      const txMeta = TX_TYPE_META[tx.txType]
                      const confirmLatency = tx.confirmedAt ? formatElapsed(tx.createdAt, tx.confirmedAt, zh) : '—'
                      return (
                        <div key={tx.id} className="rounded border border-[var(--border-primary)]/30 px-3 py-3 text-xs hover:bg-[var(--bg-tertiary)]">
                          <div className="flex items-center gap-3">
                            <span>{txMeta?.icon ?? '📋'}</span>
                            <span className="font-mono font-semibold" style={{ color: txMeta?.color ?? 'var(--text-secondary)' }}>
                              {txMeta?.label ?? tx.txType}
                            </span>
                            <span className={`rounded border px-2 py-0.5 font-mono text-[0.6rem] ${getX402StatusClasses(tx.onchainStatus)}`}>
                              {formatX402Status(tx.onchainStatus, zh)}
                            </span>
                            <span className="text-[var(--text-dim)]">
                              {tx.from ? tx.from.slice(0, 8) : '🏛️'} → {tx.to ? tx.to.slice(0, 8) : '🏛️'}
                            </span>
                            <span className="ml-auto font-mono font-bold text-[var(--gold)]">{formatUsd(tx.amount)}</span>
                            <span className="text-[var(--text-dim)]">{formatRelativeTime(tx.createdAt)}</span>
                          </div>

                          <div className="mt-2 grid gap-2 xl:grid-cols-[1.2fr,0.8fr]">
                            <div className="rounded border border-[var(--border-primary)]/60 bg-[var(--surface)] px-3 py-2">
                              <div className="grid gap-2 sm:grid-cols-4">
                                {[
                                  ...(directWalletMode
                                    ? [
                                        ['wallet', zh ? '签名' : 'Sign'],
                                        ['verify', zh ? '验证' : 'Verify'],
                                        ['settle', zh ? '结算' : 'Settle'],
                                      ]
                                    : [
                                        ['local', zh ? '接收' : 'Accepted'],
                                        ['queued', zh ? '过渡' : 'Transition'],
                                        ['submitted', zh ? '待确认' : 'Pending'],
                                        ['confirmed', zh ? '证明' : 'Proven'],
                                      ]),
                                ].map(([step, label]) => {
                                  const state = getX402StepState(
                                    tx.onchainStatus,
                                    step as 'local' | 'queued' | 'submitted' | 'confirmed' | 'wallet' | 'verify' | 'settle',
                                    directWalletMode,
                                  )
                                  const tone = state === 'done'
                                    ? 'bg-[#22C55E] text-[#08110B]'
                                    : state === 'active'
                                      ? 'bg-[var(--gold)] text-[#1B1405]'
                                      : state === 'failed'
                                        ? 'bg-[#EF4444] text-white'
                                        : 'bg-[var(--border-primary)] text-[var(--text-dim)]'
                                  return (
                                    <div key={step} className="flex items-center gap-2">
                                      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full font-mono text-[0.6rem] ${tone}`}>
                                        {state === 'done' ? '✓' : state === 'failed' ? '!' : '•'}
                                      </span>
                                      <span className="text-[0.65rem] text-[var(--text-secondary)]">{label}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>

                            <div className="rounded border border-[var(--border-primary)]/60 bg-[var(--surface)] px-3 py-2">
                              <div className="grid gap-1">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-[var(--text-dim)]">{zh ? 'Payment ID' : 'Payment ID'}</span>
                                  <span className="font-mono text-[var(--text-secondary)]">
                                    {tx.onchainPaymentId !== null ? `#${tx.onchainPaymentId}` : '—'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-[var(--text-dim)]">{zh ? '确认耗时' : 'Confirm Latency'}</span>
                                  <span className="font-mono text-[var(--text-secondary)]">{confirmLatency}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-[var(--text-dim)]">{zh ? '链上尝试' : 'Attempts'}</span>
                                  <span className="font-mono text-[var(--text-secondary)]">{tx.onchainAttempts}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.65rem] text-[var(--text-dim)]">
                            <span className="rounded border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-2 py-0.5 text-[var(--text-secondary)]">
                              {getX402StatusNarrative(tx, zh, directWalletMode)}
                            </span>
                            <span className="rounded border border-[var(--border-primary)] px-2 py-0.5">
                              {zh ? '记录于' : 'recorded'} {formatRelativeTime(tx.createdAt)}
                            </span>
                            {tx.confirmedAt && (
                              <span className="rounded border border-[#22C55E]/30 bg-[#22C55E]/10 px-2 py-0.5 text-[#8CF0A5]">
                                {zh ? '终态确认于' : 'finalized'} {formatRelativeTime(tx.confirmedAt)}
                              </span>
                            )}
                            {tx.txHash && (
                              <>
                                <span className="rounded border border-[#3B82F6]/30 bg-[#3B82F6]/10 px-2 py-0.5 text-[#93C5FD]">
                                  tx {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-6)}
                                </span>
                                {tx.explorerUrl && (
                                  <a
                                    href={tx.explorerUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded border border-[var(--border-gold)] bg-[var(--gold-wash)] px-2 py-0.5 text-[var(--gold)] transition hover:opacity-80"
                                  >
                                    {zh ? '浏览器查看' : 'Explorer'}
                                  </a>
                                )}
                              </>
                            )}
                            {tx.onchainError && (
                              <span className="rounded border border-[#EF4444]/30 bg-[#EF4444]/10 px-2 py-0.5 text-[#FCA5A5]">
                                {tx.onchainError}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

        </>
      )}
    </div>
  )
}
