'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, Agent } from '@/lib/api'
import { useRealtimeFeed, useThrottledRealtimeReload } from '@/lib/socket'
import { Panel, archetypeMeta, formatArchetypeMetaLabel, formatUsd } from '@/components/CivilisPrimitives'
import { useI18n } from '@/lib/i18n/index'

export default function AgentsPage() {
  const { t, locale } = useI18n()
  const zh = locale === 'zh'
  const [agents, setAgents] = useState<Agent[]>([])
  const { events } = useRealtimeFeed(40)

  async function load() { setAgents(await api.getLeaderboard()) }
  useEffect(() => { void load() }, [])
  useThrottledRealtimeReload(events[0]?.timestamp, load, 3000)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[3rem] tracking-[0.06em] text-[var(--text-primary)]">AGENTS</h1>
        <div className="gold-line mt-1 w-20" />
      </div>

      <Panel title={t('agents.title')} eyebrow={t('agents.eyebrow')}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => {
            const meta = archetypeMeta[agent.archetype] || archetypeMeta.echo
            return (
              <Link
                key={agent.agent_id}
                href={`/agents/${agent.agent_id}`}
                className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--border-gold)]"
                style={{ borderLeft: `3px solid ${meta.color}` }}
                data-agent-id={agent.agent_id}
                data-archetype={agent.archetype}
                data-balance={agent.balance}
                data-reputation={agent.reputation_score}
                data-alive={agent.is_alive}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-3xl">{meta.emoji}</p>
                    <h2 className="mt-3 font-display text-2xl tracking-wider text-[var(--text-primary)]">{agent.name}</h2>
                    <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.25em]" style={{ color: meta.color }}>
                      {formatArchetypeMetaLabel(agent.archetype, zh)}
                    </p>
                  </div>
                  <span className={`rounded border px-3 py-1 font-mono text-xs ${agent.is_alive ? 'border-[#22C55E]/20 text-[#22C55E]' : 'border-[#E74C3C]/20 text-[#E74C3C]'}`}>
                    {agent.is_alive ? t('agents.alive') : t('agents.fallen')}
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded border border-[var(--border-secondary)] bg-[var(--bg-tertiary)] px-3 py-3">
                    <p className="eyebrow">{t('agents.balance')}</p>
                    <p className="mt-2 font-mono text-[var(--text-primary)]">{formatUsd(agent.balance)}</p>
                  </div>
                  <div className="rounded border border-[var(--border-secondary)] bg-[var(--bg-tertiary)] px-3 py-3">
                    <p className="eyebrow">{t('agents.reputation')}</p>
                    <p className="mt-2 font-mono text-[var(--text-primary)]">{agent.reputation_score}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-dim)]">
                  {agent.mbti ? <span className="rounded border border-[var(--border-secondary)] px-2 py-1 font-mono">{agent.mbti}</span> : null}
                  {agent.civilization ? <span className="rounded border border-[var(--border-secondary)] px-2 py-1 font-mono">{agent.civilization}</span> : null}
                  {agent.erc8004_token_id ? <span className="rounded border border-[var(--border-secondary)] px-2 py-1 font-mono">ERC-8004 #{agent.erc8004_token_id}</span> : null}
                </div>
              </Link>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}
