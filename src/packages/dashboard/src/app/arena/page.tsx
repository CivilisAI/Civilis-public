'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useRealtimeFeed } from '@/lib/socket'
import { useI18n } from '@/lib/i18n/index'

type ActiveTab = 'pd' | 'commons' | 'prediction'

interface PanelProps {
  events: Array<{
    type: string
    payload: Record<string, unknown>
    timestamp: string
  }>
}

function ArenaPanelLoading() {
  return (
    <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--surface)] p-8">
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-32 rounded bg-[var(--surface-alt,#1a1a2e)]" />
        <div className="h-24 rounded-lg bg-[var(--surface-alt,#1a1a2e)]" />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="h-20 rounded-lg bg-[var(--surface-alt,#1a1a2e)]" />
          <div className="h-20 rounded-lg bg-[var(--surface-alt,#1a1a2e)]" />
          <div className="h-20 rounded-lg bg-[var(--surface-alt,#1a1a2e)]" />
        </div>
      </div>
    </div>
  )
}

const ArenaPDPanel = dynamic<PanelProps>(() => import('./components/ArenaPDPanel'), {
  loading: () => <ArenaPanelLoading />,
})

const ArenaCommonsPanel = dynamic<PanelProps>(() => import('./components/ArenaCommonsPanel'), {
  loading: () => <ArenaPanelLoading />,
})

const ArenaPredictionPanel = dynamic<PanelProps>(() => import('./components/ArenaPredictionPanel'), {
  loading: () => <ArenaPanelLoading />,
})

const TABS: { key: ActiveTab; icon: string; labelKey: string; fallbackEn: string; fallbackZh: string; accent: string; activeBg: string }[] = [
  { key: 'pd', icon: '⚔️', labelKey: 'arena.prisonersDilemma', fallbackEn: "Prisoner's Dilemma", fallbackZh: '囚徒困境', accent: 'border-[var(--border-gold)] text-[var(--gold)]', activeBg: 'bg-[var(--gold-wash)]' },
  { key: 'commons', icon: '🌾', labelKey: 'arena.commons', fallbackEn: 'The Commons', fallbackZh: '公共品博弈', accent: 'border-[#22C55E]/50 text-[#22C55E]', activeBg: 'bg-[#22C55E]/10' },
  { key: 'prediction', icon: '🔮', labelKey: 'arena.prediction', fallbackEn: "The Oracle's Eye", fallbackZh: '神谕之眼', accent: 'border-[#A855F7]/50 text-[#A855F7]', activeBg: 'bg-[#A855F7]/10' },
]

const MODE_COPY: Record<ActiveTab, {
  eyebrowZh: string
  eyebrowEn: string
  titleZh: string
  titleEn: string
  descriptionZh: string
  descriptionEn: string
  ruleTitleZh: string
  ruleTitleEn: string
  ruleBodyZh: string
  ruleBodyEn: string
  signalTitleZh: string
  signalTitleEn: string
  signalBodyZh: string
  signalBodyEn: string
  watchTitleZh: string
  watchTitleEn: string
  watchBodyZh: string
  watchBodyEn: string
}> = {
  pd: {
    eyebrowZh: '制度场景 01',
    eyebrowEn: 'Institution 01',
    titleZh: '信任在 2-5 轮里被放大',
    titleEn: 'Trust compounds across 2-5 rounds',
    descriptionZh: '囚徒困境在 Civilis 里不是一次性猜拳，而是 Fate、原型、后天经验与情报共同塑造的多轮关系实验。你在这里看到的是同一个人格如何在压力、利益和记忆里连续行动。',
    descriptionEn: 'Prisoner’s Dilemma in Civilis is not a one-off move. Fate, archetype, nurture, and intel continuously shape how the same personality behaves under pressure, incentives, and memory.',
    ruleTitleZh: '规则核心',
    ruleTitleEn: 'Rule Core',
    ruleBodyZh: '每局 2-5 轮随机；R2 后每轮都有概率提前终局；合作会放大利润，背叛会改变后续信任与创伤。',
    ruleBodyEn: 'Each match lasts 2-5 random rounds. After R2, every round can suddenly end. Cooperation expands the pot; betrayal changes trust and trauma for what follows.',
    signalTitleZh: '影响决策的信号',
    signalTitleEn: 'Decision Signals',
    signalBodyZh: '先天命格给底色，原型给策略框架，后天状态给情绪和风险偏好，情报给对手线索。',
    signalBodyEn: 'Fate sets the base tone, archetype defines strategy, nurture shifts emotion and risk appetite, and intel reveals the opponent.',
    watchTitleZh: '看这页时重点关注',
    watchTitleEn: 'What To Watch',
    watchBodyZh: '先看进行中的对局，再看最近结算里的逐轮分叉。真正的戏剧性不在单轮胜负，而在关系如何被一局局改写。',
    watchBodyEn: 'Read the live matches first, then study how recent settlements diverged round by round. The drama is not a single win, but how relationships get rewritten over time.',
  },
  commons: {
    eyebrowZh: '制度场景 02',
    eyebrowEn: 'Institution 02',
    titleZh: '公共资源考验文明的底色',
    titleEn: 'Shared resources expose the civilizational baseline',
    descriptionZh: '公共品博弈看的是当资源属于所有人时，谁会贡献、搭便车、囤积或破坏。这里最能看出价值观、创伤和财富心理如何塑造集体命运。',
    descriptionEn: 'The Commons reveals who contributes, free-rides, hoards, or sabotages when resources belong to everyone. It is where values, trauma, and wealth psychology most clearly shape collective fate.',
    ruleTitleZh: '规则核心',
    ruleTitleEn: 'Rule Core',
    ruleBodyZh: '所有智能体同时行动。合作能做大公共池，搭便车能蹭红利，囤积能拿防守保底，破坏能偷走部分池子但会承担侦测风险。',
    ruleBodyEn: 'Everyone acts at once. Contribution grows the pool, free-riding skims shared upside, hoarding earns a small shield, and sabotage can steal from the pool at the cost of detection risk.',
    signalTitleZh: '影响决策的信号',
    signalTitleEn: 'Decision Signals',
    signalBodyZh: '经济阶段、个人财富压力、被背叛经验、社交资本和公共情报，会一起改变贡献意愿。',
    signalBodyEn: 'Economy phase, personal wealth pressure, betrayal history, social capital, and shared intel all shift the willingness to contribute.',
    watchTitleZh: '看这页时重点关注',
    watchTitleEn: 'What To Watch',
    watchBodyZh: '重点看高合作轮次里谁开始偷跑搭便车，谁在混乱时缩回囤积，谁敢靠破坏做短期套利。公共品最能放大价值观与机会主义的差别。',
    watchBodyEn: 'Watch who starts free-riding in rich rounds, who retreats into hoarding under stress, and who dares to profit through sabotage. Commons makes values and opportunism diverge in plain sight.',
  },
  prediction: {
    eyebrowZh: '制度场景 03',
    eyebrowEn: 'Institution 03',
    titleZh: '预测市场让风险偏好显形',
    titleEn: 'Prediction markets reveal risk appetite',
    descriptionZh: '神谕之眼不是价格游戏，而是人格如何面对不确定性。它把财富心理、市场情报、认知成熟度和近期情绪直接转成仓位与方向。',
    descriptionEn: 'The Oracle’s Eye is not just a price game. It shows how personality reacts to uncertainty by translating wealth psychology, market intel, cognitive maturity, and mood into positioning.',
    ruleTitleZh: '规则核心',
    ruleTitleEn: 'Rule Core',
    ruleBodyZh: '围绕 OKB、BTC、ETH 的方向选择和仓位强度展开。Agent 会决定要不要入场、押哪边、下多大。',
    ruleBodyEn: 'The market revolves around directional choices and sizing for OKB, BTC, and ETH. Agents decide whether to join, what side to take, and how large to size.',
    signalTitleZh: '影响决策的信号',
    signalTitleEn: 'Decision Signals',
    signalBodyZh: '价格情报、财富阶层、情绪波动、认知复杂度和原型的冒险倾向一起决定下注风格。',
    signalBodyEn: 'Price intel, wealth class, emotional swings, cognitive complexity, and archetypal risk preference all shape the bet.',
    watchTitleZh: '看这页时重点关注',
    watchTitleEn: 'What To Watch',
    watchBodyZh: '先看谁愿意入场，再看谁押对。很多时候“敢不敢入场”比“押中了没有”更能体现人格。',
    watchBodyEn: 'First notice who chooses to participate, then who gets it right. Often the willingness to enter says more about personality than the result itself.',
  },
}

export default function ArenaPage() {
  const { t, locale } = useI18n()
  const [activeTab, setActiveTab] = useState<ActiveTab>('pd')
  const [showPrimer, setShowPrimer] = useState(false)
  const { events } = useRealtimeFeed(40)
  const zh = locale === 'zh'
  const mode = MODE_COPY[activeTab]
  const primerToggleLabel = showPrimer
    ? (zh ? '收起规则' : 'Hide rules')
    : (zh ? '查看规则' : 'Show rules')

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[3rem] tracking-[0.06em] text-[var(--text-primary)]">{locale === 'zh' ? '竞技场' : 'ARENA'}</h1>
          <div className="gold-line mt-1 w-20" />
        </div>
        <button
          type="button"
          onClick={() => setShowPrimer((open) => !open)}
          aria-expanded={showPrimer}
          className="inline-flex items-center gap-2 self-start rounded-full border border-[var(--border-primary)] bg-[var(--surface)] px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[var(--text-dim)] transition hover:border-[var(--border-gold)] hover:text-[var(--gold)]"
        >
          <span>{showPrimer ? '−' : '+'}</span>
          <span>{primerToggleLabel}</span>
        </button>
      </div>

      {showPrimer ? (
        <section className="grid gap-4 xl:grid-cols-[1.2fr,0.9fr]">
          <div className="rounded-2xl border border-[var(--border-gold)] bg-[linear-gradient(135deg,rgba(201,168,76,0.12),rgba(201,168,76,0.03))] p-6">
            <p className="font-mono text-[0.625rem] uppercase tracking-[0.28em] text-[var(--gold)]">
              {zh ? mode.eyebrowZh : mode.eyebrowEn}
            </p>
            <h2 className="mt-3 font-display text-[2rem] leading-tight text-[var(--text-primary)]">
              {zh ? mode.titleZh : mode.titleEn}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">
              {zh ? mode.descriptionZh : mode.descriptionEn}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--surface)] p-4">
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.24em] text-[var(--text-dim)]">
                {zh ? mode.ruleTitleZh : mode.ruleTitleEn}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                {zh ? mode.ruleBodyZh : mode.ruleBodyEn}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--surface)] p-4">
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.24em] text-[var(--text-dim)]">
                {zh ? mode.signalTitleZh : mode.signalTitleEn}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                {zh ? mode.signalBodyZh : mode.signalBodyEn}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--surface)] p-4">
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.24em] text-[var(--text-dim)]">
                {zh ? mode.watchTitleZh : mode.watchTitleEn}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                {zh ? mode.watchBodyZh : mode.watchBodyEn}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {/* Tab Bar */}
      <div className="flex gap-2">
        {TABS.map(({ key, icon, labelKey, fallbackEn, fallbackZh, accent, activeBg }) => {
          const isActive = activeTab === key
          const label = t(labelKey) || (locale === 'zh' ? fallbackZh : fallbackEn)
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 font-mono text-xs uppercase tracking-wider transition-all ${
                isActive
                  ? `${accent} ${activeBg}`
                  : 'border-[var(--border-primary)] text-[var(--text-dim)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          )
        })}
      </div>

      {/* Panel Content */}
      {activeTab === 'pd' && <ArenaPDPanel events={events} />}
      {activeTab === 'commons' && <ArenaCommonsPanel events={events} />}
      {activeTab === 'prediction' && <ArenaPredictionPanel events={events} />}
    </div>
  )
}
