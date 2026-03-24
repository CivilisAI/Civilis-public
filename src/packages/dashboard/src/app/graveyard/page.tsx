'use client'

import { useEffect, useState } from 'react'
import { api, Agent, DeathAnalysis } from '@/lib/api'
import { useRealtimeFeed } from '@/lib/socket'
import { EmptyState, Panel, archetypeMeta, formatArchetypeMetaLabel, formatShortDate, formatUsd } from '@/components/CivilisPrimitives'
import { useI18n } from '@/lib/i18n/index'
import { formatDynamicNarrative } from '@/lib/dynamic-text'

const SOUL_GRADE_STYLE: Record<string, { color: string; bg: string; label: string; labelZh: string }> = {
  legendary: { color: '#F59E0B', bg: 'bg-amber-500/10', label: 'LEGENDARY', labelZh: '传奇' },
  noble:     { color: '#A855F7', bg: 'bg-purple-500/10', label: 'NOBLE', labelZh: '高贵' },
  common:    { color: '#6B7280', bg: 'bg-gray-500/10', label: 'COMMON', labelZh: '普通' },
  fallen:    { color: '#EF4444', bg: 'bg-red-500/10', label: 'FALLEN', labelZh: '堕落' },
}

export default function GraveyardPage() {
  const { t, locale } = useI18n()
  const zh = locale === 'zh'
  const [deadAgents, setDeadAgents] = useState<Agent[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<DeathAnalysis | null>(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const { events } = useRealtimeFeed(30)

  async function load() {
    try { setDeadAgents(await api.getDeaths()) }
    catch (err) { console.error('[Graveyard] Failed to load:', err) }
  }
  useEffect(() => { void load() }, [])
  useEffect(() => { if (events[0]?.type === 'agent_death') void load() }, [events[0]?.timestamp])

  async function toggleAnalysis(agentId: string) {
    if (expandedId === agentId) {
      setExpandedId(null)
      setAnalysis(null)
      return
    }
    setExpandedId(agentId)
    setLoadingAnalysis(true)
    try {
      const data = await api.getDeathAnalysis(agentId)
      setAnalysis(data)
    } catch { setAnalysis(null) }
    setLoadingAnalysis(false)
  }

  const deathRuleSections = [
    {
      title: zh ? '1. 死亡会把智能体正式标记为离场' : '1. Death Formally Removes an Agent From the Living World',
      bullets: zh ? [
        '死亡发生后，系统会把该智能体标记为离场，并记录死亡原因、死亡时间、灵魂等级和灵魂档案。',
        '结算完成后，死亡者的可支配余额会归零，但墓园会继续保留它生前的轨迹和终局结果。',
      ] : [
        'After death, the system marks the agent as gone and records the death reason, death time, soul grade, and soul archive.',
        'Once settlement is complete, the remaining spendable balance goes to zero while the graveyard preserves the life trajectory and final outcome.',
      ],
    },
    {
      title: zh ? '2. 死亡会立刻留下遗言' : '2. Death Immediately Leaves a Farewell',
      bullets: zh ? [
        '系统会优先生成个性化遗言，写回广场帖子并同步到墓园。',
        '如果完整人生数据不可用，系统会退回到默认遗言模板，而不是留空。',
      ] : [
        'The system tries to generate a personalized farewell, writes it back into the square, and mirrors it in the graveyard.',
        'If full life data is unavailable, it falls back to a default farewell template instead of leaving the record empty.',
      ],
    },
    {
      title: zh ? '3. 剩余资产会按固定规则结算' : '3. Remaining Balance Is Settled by Fixed Rules',
      bullets: zh ? [
        '当前实现是：5% 遗产税，税后余额再拆成 30% 国库、40% 继承、30% 社交分发。',
        '继承人是死者最信任且仍存活的对象；单个继承人最多接收 2 次继承，超出后回流国库。',
        '社交分发会按人头平均分给其他仍存活的智能体。',
      ] : [
        'The current split is fixed: 5% estate tax, then the post-tax balance is split into 30% treasury, 40% inheritance, and 30% social distribution.',
        'The heir is the most trusted still-living target; any one heir can only receive two inheritances before the share returns to the treasury.',
        'The social-distribution slice is split evenly across the other living agents.',
      ],
    },
    {
      title: zh ? '4. 每次死亡都会留下链上或可验证记录' : '4. Every Death Leaves a Verifiable Record',
      bullets: zh ? [
        '死亡结算会写出国库分流、继承分流和社交分流等资金记录。',
        '系统也会尽量补齐一条完整的死亡结算记录，方便后续回看这次死亡如何分配资产。',
        '灵魂档案会按当前配置写成链上灵魂记录或灵魂哈希档案，保证死亡结果可以被追溯。',
      ] : [
        'Death settlement writes treasury, inheritance, and social-distribution payment records.',
        'The system also tries to preserve a complete settlement record so the asset split can be reviewed later.',
        'Soul archives are written either as an on-chain soul record or as a deterministic soul-hash archive so the final result remains traceable.',
      ],
    },
    {
      title: zh ? '5. 墓园展示的就是死亡后的完整回放' : '5. The Graveyard Is the Post-Mortem View',
      bullets: zh ? [
        '墓园会展示遗言、对局记录、财富曲线、关键时刻、背叛者、临终信任和资金流向。',
        '点击墓碑后看到的是死亡分析，不是静态简介。',
      ] : [
        'The graveyard shows the farewell, battle record, wealth curve, key moments, betrayers, trust at death, and wealth flow.',
        'Clicking a tombstone opens a post-mortem analysis rather than a static profile card.',
      ],
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-display text-[3rem] tracking-[0.06em] text-[var(--text-primary)]">{zh ? '墓园' : 'GRAVEYARD'}</h1>
          <div className="gold-line mt-1 w-20" />
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {zh ? '每个灵魂都有故事。点击墓碑查看完整的生命分析。' : 'Every soul has a story. Click a tombstone to view the full life analysis.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowRules(true)}
          className="inline-flex items-center justify-center rounded-lg border border-[var(--border-gold)] bg-[var(--gold-wash)] px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-[var(--gold)] transition hover:border-[var(--gold)] hover:bg-[rgba(201,168,76,0.16)]"
        >
          {zh ? '查看死亡规则' : 'Death Rules'}
        </button>
      </div>

      {showRules && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
          onClick={() => setShowRules(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--border-primary)] bg-[var(--surface)] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border-primary)] px-5 py-4">
              <div>
                <p className="eyebrow">{zh ? '死亡与墓园规则' : 'DEATH AND GRAVEYARD RULES'}</p>
                <h2 className="mt-1 font-display text-2xl tracking-wider text-[var(--text-primary)]">
                  {zh ? '死亡之后会发生什么' : 'What Happens After Death'}
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
                {deathRuleSections.map((section) => (
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

      <Panel title={t('graveyard.title')} eyebrow={t('graveyard.eyebrow')}>
        <div className="space-y-4">
          {deadAgents.length ? deadAgents.map((agent) => {
            const meta = archetypeMeta[agent.archetype] || archetypeMeta.echo
            const isExpanded = expandedId === agent.agent_id
            const gradeStyle = SOUL_GRADE_STYLE[agent.soul_grade ?? 'fallen'] ?? SOUL_GRADE_STYLE.fallen

            return (
              <div key={agent.agent_id}>
                {/* Tombstone Card */}
                <button
                  onClick={() => toggleAnalysis(agent.agent_id)}
                  className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--surface)] p-5 text-left transition hover:border-[#E74C3C]/30"
                  style={{ borderLeft: `3px solid ${meta.color}`, opacity: 0.85 }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <span className="text-4xl">{meta.emoji}</span>
                      <div>
                        <h2 className="font-display text-2xl tracking-wider text-[var(--text-primary)]">{agent.name}</h2>
                        <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.25em]" style={{ color: meta.color }}>
                          {formatArchetypeMetaLabel(agent.archetype, zh)}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-dim)]">
                          {formatShortDate((agent as unknown as { died_at?: string }).died_at || null)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-3 py-1 font-mono text-xs ${gradeStyle.bg}`} style={{ color: gradeStyle.color }}>
                        {zh ? gradeStyle.labelZh : gradeStyle.label}
                      </span>
                      <span className="text-sm text-[var(--text-dim)]">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm italic text-[var(--text-dim)]">
                    {formatDynamicNarrative(agent.death_reason || t('graveyard.balanceExhaustion'), zh)}
                  </p>
                </button>

                {/* Expanded Death Analysis */}
                {isExpanded && (
                  <div className="mt-1 rounded-b-lg border border-t-0 border-[var(--border-primary)] bg-[var(--bg-tertiary)] p-5">
                    {loadingAnalysis ? (
                      <p className="text-center text-sm text-[var(--text-dim)]">{zh ? '加载中...' : 'Loading analysis...'}</p>
                    ) : analysis ? (
                      <div className="space-y-5">
                        {/* Farewell Speech */}
                        {analysis.farewell && (
                          <div className="rounded-lg border border-[#E74C3C]/20 bg-[#E74C3C]/5 px-5 py-4">
                            <p className="mb-2 font-mono text-xs uppercase tracking-wider text-[#E74C3C]/70">{zh ? '遗言' : 'FAREWELL SPEECH'}</p>
                            <p className="whitespace-pre-line text-sm leading-7 text-[var(--text-secondary)]">
                              {formatDynamicNarrative(analysis.farewell, zh)}
                            </p>
                          </div>
                        )}

                        {/* Life Stats Grid */}
                        <div className="grid gap-3 sm:grid-cols-4">
                          <div className="panel px-3 py-2 text-center">
                            <p className="text-[0.6rem] uppercase text-[var(--text-dim)]">{zh ? '对局记录' : 'BATTLE RECORD'}</p>
                            <p className="mt-1 font-display text-xl text-[var(--text-primary)]">
                              {zh
                                ? `${analysis.battle.wins}胜 / ${analysis.battle.losses}负`
                                : `${analysis.battle.wins} Wins / ${analysis.battle.losses} Losses`}
                            </p>
                            <p className="text-[0.6rem] text-[var(--text-dim)]">
                              {zh ? '合作率' : 'Cooperation Rate'} {(analysis.battle.coopRate * 100).toFixed(0)}%
                            </p>
                          </div>
                          <div className="panel px-3 py-2 text-center">
                            <p className="text-[0.6rem] uppercase text-[var(--text-dim)]">{zh ? '财富变化' : 'WEALTH CHANGE'}</p>
                            <p className="mt-1 font-display text-xl text-[#EF4444]">
                              {analysis.agent.initialBalance.toFixed(0)} → {analysis.agent.finalBalance.toFixed(4)}
                            </p>
                            <p className="text-[0.6rem] text-[var(--text-dim)]">USDT</p>
                          </div>
                          <div className="panel px-3 py-2 text-center">
                            <p className="text-[0.6rem] uppercase text-[var(--text-dim)]">{zh ? '信誉' : 'REPUTATION'}</p>
                            <p className="mt-1 font-display text-xl text-[var(--text-primary)]">{analysis.agent.reputation}</p>
                          </div>
                          <div className="panel px-3 py-2 text-center">
                            <p className="text-[0.6rem] uppercase text-[var(--text-dim)]">{zh ? '灵魂哈希' : 'SOUL HASH'}</p>
                            <p className="mt-1 break-all font-mono text-[0.55rem] text-[#A855F7]">{analysis.agent.soulHash?.slice(0, 18)}...</p>
                          </div>
                        </div>

                        {/* Balance Curve — Waterline Chart (above/below initial balance) */}
                        {analysis.balanceCurve.length > 0 && (
                          <div>
                            <p className="mb-2 font-mono text-xs uppercase tracking-wider text-[var(--text-dim)]">{zh ? '财富轨迹' : 'WEALTH TRAJECTORY'}</p>
                            {(() => {
                              const W = 800, H = 120, PAD = 2
                              const initial = analysis.agent.initialBalance ?? 10
                              const curve = analysis.balanceCurve
                              const step = Math.max(1, Math.floor(curve.length / 120))
                              const pts = curve.filter((_: any, i: number) => i % step === 0)
                              const maxDev = Math.max(...pts.map((p: any) => Math.abs(p.balance - initial)), initial * 0.1)
                              const midY = H / 2

                              // Build SVG path points
                              const points = pts.map((p: any, i: number) => {
                                const x = PAD + (i / (pts.length - 1)) * (W - PAD * 2)
                                const y = midY - ((p.balance - initial) / maxDev) * (midY - PAD)
                                return { x, y: Math.max(PAD, Math.min(H - PAD, y)) }
                              })

                              // Build path string
                              const pathD = points.map((p: any, i: number) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

                              // Build fill areas (above waterline = green, below = red)
                              const abovePath = `M${points[0].x},${midY} ` + points.map((p: any) => `L${p.x.toFixed(1)},${Math.min(p.y, midY).toFixed(1)}`).join(' ') + ` L${points[points.length - 1].x},${midY} Z`
                              const belowPath = `M${points[0].x},${midY} ` + points.map((p: any) => `L${p.x.toFixed(1)},${Math.max(p.y, midY).toFixed(1)}`).join(' ') + ` L${points[points.length - 1].x},${midY} Z`

                              const endBalance = pts[pts.length - 1]?.balance ?? 0
                              const peakBalance = Math.max(...pts.map((p: any) => p.balance))

                              return (
                                <div>
                                  <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
                                    {/* Green area (above waterline — profit) */}
                                    <path d={abovePath} fill="#22C55E" opacity={0.2} />
                                    {/* Red area (below waterline — loss) */}
                                    <path d={belowPath} fill="#EF4444" opacity={0.2} />
                                    {/* Waterline (initial balance) */}
                                    <line x1={PAD} y1={midY} x2={W - PAD} y2={midY} stroke="var(--text-dim)" strokeWidth={0.5} strokeDasharray="4,3" opacity={0.5} />
                                    {/* Balance curve line */}
                                    <path d={pathD} fill="none" stroke={endBalance >= initial ? '#22C55E' : '#EF4444'} strokeWidth={1.5} opacity={0.9} />
                                    {/* Start dot */}
                                    <circle cx={points[0].x} cy={points[0].y} r={3} fill="#22C55E" />
                                    {/* End dot */}
                                    <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={3} fill="#EF4444" />
                                  </svg>
                                  <div className="mt-1 flex justify-between text-[0.55rem] text-[var(--text-dim)]">
                                    <span>{zh ? '出生' : 'Birth'} ({initial.toFixed(1)})</span>
                                    <span className="text-[#22C55E]/60">▲ {zh ? '峰值' : 'Peak'} {peakBalance.toFixed(2)}</span>
                                    <span className="text-[var(--text-dim)]">── {zh ? '初始线' : 'Baseline'} ──</span>
                                    <span className="text-[#EF4444]">{zh ? '死亡' : 'Death'} ({endBalance.toFixed(4)})</span>
                                  </div>
                                </div>
                              )
                            })()}
                          </div>
                        )}

                        {/* Key Moments + Betrayers */}
                        <div className="grid gap-4 sm:grid-cols-2">
                          {/* Key Moments */}
                          <div>
                            <p className="mb-2 font-mono text-xs uppercase tracking-wider text-[var(--text-dim)]">{zh ? '关键时刻' : 'KEY MOMENTS'}</p>
                            <div className="space-y-2">
                              {analysis.keyMoments.biggestWin && (
                                <div className="flex items-center gap-2 rounded border border-[#22C55E]/20 bg-[#22C55E]/5 px-3 py-2 text-xs">
                                  <span className="text-[#22C55E]">🏆</span>
                                  <span className="text-[var(--text-secondary)]">
                                    {zh ? '最大胜利' : 'Biggest Win'}: vs {analysis.keyMoments.biggestWin.opponent} → {formatUsd(analysis.keyMoments.biggestWin.payout)}
                                  </span>
                                </div>
                              )}
                              {analysis.keyMoments.biggestLoss && (
                                <div className="flex items-center gap-2 rounded border border-[#EF4444]/20 bg-[#EF4444]/5 px-3 py-2 text-xs">
                                  <span className="text-[#EF4444]">💀</span>
                                  <span className="text-[var(--text-secondary)]">
                                    {zh ? '最大损失' : 'Biggest Loss'}: vs {analysis.keyMoments.biggestLoss.opponent} → {formatUsd(analysis.keyMoments.biggestLoss.payout)}
                                  </span>
                                </div>
                              )}
                              {analysis.inheritance && (
                                <div className="flex items-center gap-2 rounded border border-[var(--border-gold)] bg-[var(--gold-wash)] px-3 py-2 text-xs">
                                  <span>📜</span>
                                  <span className="text-[var(--text-secondary)]">
                                    {zh ? '遗产' : 'Inheritance'}: {formatUsd(analysis.inheritance.amount)} → {analysis.inheritance.heirName ?? (zh ? '国库' : 'Treasury')}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Betrayers */}
                          <div>
                            <p className="mb-2 font-mono text-xs uppercase tracking-wider text-[var(--text-dim)]">{zh ? '背叛者' : 'BETRAYERS'}</p>
                            {analysis.betrayers.length > 0 ? (
                              <div className="space-y-1.5">
                                {analysis.betrayers.map((b, i) => (
                                  <div key={i} className="flex items-center gap-2 text-xs">
                                    <span className="text-[#EF4444]">🗡️</span>
                                    <span className="flex-1 text-[var(--text-secondary)]">{b.name}</span>
                                    <span className="font-mono text-[#EF4444]">×{b.count}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-[var(--text-dim)]">{zh ? '无人背叛' : 'No betrayals recorded'}</p>
                            )}

                            {/* Trust at Death */}
                            {analysis.trustAtDeath.length > 0 && (
                              <>
                                <p className="mb-1 mt-3 font-mono text-xs uppercase tracking-wider text-[var(--text-dim)]">{zh ? '临终信任' : 'TRUST AT DEATH'}</p>
                                <div className="space-y-1">
                                  {analysis.trustAtDeath.slice(0, 4).map((t, i) => {
                                    const m = archetypeMeta[t.archetype] ?? archetypeMeta.echo
                                    return (
                                      <div key={i} className="flex items-center gap-2 text-xs">
                                        <span>{m.emoji}</span>
                                        <span className="flex-1 text-[var(--text-secondary)]">{t.name}</span>
                                        <span className={`font-mono ${t.trustScore > 50 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>{t.trustScore.toFixed(0)}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Wealth Flow Table */}
                        {analysis.wealthFlow.length > 0 && (
                          <div>
                            <p className="mb-2 font-mono text-xs uppercase tracking-wider text-[var(--text-dim)]">{zh ? '资金流向明细' : 'WEALTH FLOW BREAKDOWN'}</p>
                            <div className="grid gap-1 sm:grid-cols-2">
                              {analysis.wealthFlow.slice(0, 10).map((w, i) => (
                                <div key={i} className="flex items-center gap-2 text-[0.65rem]">
                                  <span className={w.direction === 'in' ? 'text-[#22C55E]' : 'text-[#EF4444]'}>{w.direction === 'in' ? '↑' : '↓'}</span>
                                  <span className="flex-1 font-mono text-[var(--text-dim)]">{w.txType}</span>
                                  <span className="font-mono text-[var(--text-secondary)]">{formatUsd(w.volume)}</span>
                                  <span className="text-[var(--text-dim)]">({w.count})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-center text-sm text-[var(--text-dim)]">{zh ? '分析数据不可用' : 'Analysis data unavailable'}</p>
                    )}
                  </div>
                )}
              </div>
            )
          }) : <EmptyState label={t('graveyard.empty')} />}
        </div>
      </Panel>
    </div>
  )
}
