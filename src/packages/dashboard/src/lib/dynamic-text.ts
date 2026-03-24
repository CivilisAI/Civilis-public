function replaceExact(text: string, map: Record<string, string>): string {
  return map[text] ?? text
}

function normalizeZhNarrative(text: string): string {
  return text
    .replace(/^Tick (\d+)观察：/i, '第$1轮观察：')
    .replace(/(\d+)个tick/gi, '$1轮')
    .replace(/\bAgent\b/g, '智能体')
    .replace(/\bx402\b/ig, '支付')
}

function translateArenaChoice(choice: string): string {
  const labels: Record<string, string> = {
    '合作': 'cooperate',
    '背叛': 'betray',
    '低索取': 'claim low',
    '中索取': 'claim mid',
    '高索取': 'claim high',
    '低竞价': 'bid low',
    '中竞价': 'bid mid',
    '高竞价': 'bid high',
  }
  return labels[choice] ?? choice
}

function formatAgentHandle(handle: string): string {
  if (!handle) return handle
  return `${handle.slice(0, 1).toUpperCase()}${handle.slice(1)}`
}

function formatMatchTypeLabel(matchType: string): string {
  const labels: Record<string, string> = {
    prisoners_dilemma: "Prisoner's Dilemma",
    resource_grab: 'The Commons',
    info_auction: "The Oracle's Eye",
  }
  return labels[matchType] ?? matchType
}

function extractEnglishFarewell(text: string): string | null {
  const bilingual = text.match(/^\[Farewell\]\s*([\s\S]*?)\n+\s*\[遗言\]/i)
  if (bilingual?.[1]) return bilingual[1].trim()

  const farewellOnly = text.match(/^\[Farewell\]\s*([\s\S]+)$/i)
  if (farewellOnly?.[1]) return farewellOnly[1].trim()

  return null
}

function translateReplyTail(text: string): string {
  const labels: Record<string, string> = {
    '同意，这个观察很敏锐。': "I agree. That's a sharp observation.",
    '有道理，但我的经历不太一样。': 'Fair point, but my experience has been different.',
    '你说的没错，信任确实是最稀缺的资源。': "You're not wrong. Trust really is the scarcest resource.",
    '这让我想到了自己的处境...': 'That makes me think about my own situation...',
    '有趣的视角，我需要重新思考一下。': 'Interesting angle. I need to rethink it.',
    '我不确定我同意，但这值得讨论。': "I'm not sure I agree, but it's worth discussing.",
  }

  return labels[text] ?? text
}

function translateArenaIntelTrait(text: string): string {
  const labels: Record<string, string> = {
    '已出现一次背叛行为': 'has already betrayed once',
    '目前背叛次数为零': 'currently has zero betrayals',
    '至今零次背叛': 'still has zero betrayals',
    '目前保持零背叛记录': 'is still holding a zero-betrayal record',
  }
  return labels[text] ?? text
}

function translateReasonFragments(text: string): string | null {
  const replacements: Array<[RegExp, string]> = [
    [/余额过低，必须节流/g, 'Balance is too low, so I need to conserve resources'],
    [/发布情报：信息就是力量/g, 'Publish intel because information is power'],
    [/发表立场，塑造舆论/g, 'Take a public stance and shape the narrative'],
    [/本轮保持观察/g, 'Stay observant this round'],
    [/锦标赛聚光灯放大了竞技相关情报的价值/g, 'Tournament attention increases the value of arena-related intel'],
    [/临战前补充对手相关信息/g, 'Gather more information about the opponent before the round'],
    [/情报价值较高，值得为下一步决策付费/g, 'The intel is valuable enough to pay for before the next decision'],
    [/当前不确定性较高，需要更多信息/g, 'Uncertainty is elevated, so I need more information'],
    [/信息开放度与情报参与倾向推动了解锁行为/g, 'Information openness and intel engagement pushed this unlock'],
    [/高信任关系下继续投资社交资本/g, 'Keep investing in social capital under a high-trust relationship'],
    [/通过打赏经营关系，换取未来回报/g, 'Use tipping to cultivate the relationship and earn future returns'],
    [/正向情绪放大了表达支持的意愿/g, 'Positive emotion amplified the urge to show support'],
    [/人格中的资源分享倾向促成了这次打赏/g, 'A resource-sharing bias in the personality led to this tip'],
    [/锦标赛关注度上升，公开回应竞技相关信息更有价值/g, 'Rising tournament attention makes a public reply to arena intel more valuable'],
    [/低信任对象触发了带锋芒的回应欲望/g, 'A low-trust target triggered a sharper public response'],
    [/当前情绪提高了公开表达的概率/g, 'Current emotion increased the chance of speaking publicly'],
    [/信息开放度与社交驱动共同推动了公开回应/g, 'Information openness and social drive jointly pushed this public reply'],
    [/锦标赛聚光灯下，谈判本身也会塑造后续局势/g, 'Under tournament attention, negotiation itself can shape the next phase'],
    [/关系基础较好，适合继续锁定合作预期/g, 'The relationship base is strong enough to keep cooperation on the table'],
    [/低信任局面下尝试用话术扭转或施压/g, 'In a low-trust situation, use negotiation to pressure or redirect the outcome'],
    [/资源压力上升，倾向先谈条件再做决定/g, 'Resource pressure is rising, so negotiate terms before deciding'],
    [/三层人格判断谈判仍有改变结果的空间/g, 'The three-layer personality model still sees room for negotiation to change the outcome'],
    [/本轮倾向先手试探/g, 'This round leans toward probing first'],
    [/本轮倾向继续合作/g, 'This round leans toward continued cooperation'],
    [/情报显示对手更可能合作/g, 'Intel suggests the opponent is more likely to cooperate'],
    [/情报显示对手更可能背叛/g, 'Intel suggests the opponent is more likely to betray'],
    [/过往背叛记忆仍在生效/g, 'Past betrayal memories are still active'],
    [/历史互动偏合作/g, 'Historical interaction trends cooperative'],
    [/历史互动偏冲突/g, 'Historical interaction trends conflict-heavy'],
    [/当前信任较高/g, 'Current trust is relatively high'],
    [/当前信任偏低/g, 'Current trust is relatively low'],
    [/本轮偏向高风险索取/g, 'This round leans toward a high-risk claim'],
    [/本轮偏向中位索取/g, 'This round leans toward a mid-range claim'],
    [/本轮偏向保守索取/g, 'This round leans toward a conservative claim'],
    [/本轮愿意为信息付更高价格/g, 'This round is willing to pay a higher price for information'],
    [/本轮保持中位竞价/g, 'This round holds a middle bid'],
    [/本轮偏向谨慎出价/g, 'This round leans toward cautious bidding'],
    [/危机期更强调生存/g, 'Crisis conditions put more weight on survival'],
    [/衰退期更强调防守/g, 'Recession conditions put more weight on defense'],
    [/当前情绪偏谨慎/g, 'Current mood leans cautious'],
    [/当前情绪偏主动/g, 'Current mood leans proactive'],
    [/锦标赛聚光灯正在放大这场对局/g, 'Tournament attention is amplifying this match'],
    [/进入竞技场决策阶段/g, 'Entering the arena decision phase'],
  ]

  let translated = text
  for (const [pattern, replacement] of replacements) {
    translated = translated.replace(pattern, replacement)
  }

  if (translated !== text) {
    return translated.replace(/，/g, ', ')
  }

  return null
}

function translateStructuredLine(text: string): string | null {
  const arenaRound = text.match(/^竞技场 vs ([\w-]+) \(第(\d+)轮(·最终轮)?\): 我选择(.+?)，对方选择(.+?)，本轮获得 ([\d.]+) USDT$/)
  if (arenaRound) {
    const [, opponent, round, finalRound, myChoice, theirChoice, amount] = arenaRound
    return `Arena vs ${opponent} (Round ${round}${finalRound ? ', final round' : ''}): I chose ${translateArenaChoice(myChoice)}, the opponent chose ${translateArenaChoice(theirChoice)}, and I earned ${amount} USDT this round.`
  }

  const betrayedBy = text.match(/^([A-Za-z_][\w-]*) 在 prisoners_dilemma 中背叛了我$/)
  if (betrayedBy) {
    return `${betrayedBy[1]} betrayed me in Prisoner's Dilemma.`
  }

  const betrayalMemory = text.match(/^([A-Za-z_][\w-]*) 在 ([\w-]+) 中背叛了我$/)
  if (betrayalMemory) {
    const [, betrayer, matchType] = betrayalMemory
    return `${formatAgentHandle(betrayer)} betrayed me in ${formatMatchTypeLabel(matchType)}.`
  }

  const arenaChoiceMemory = text.match(/^我在竞技场 #(\d+) 做出了选择$/)
  if (arenaChoiceMemory) {
    return `I made my choice in Arena #${arenaChoiceMemory[1]}.`
  }

  const mutualCoop = text.match(/^([\w-]+) 中双方合作，互利共赢$/)
  if (mutualCoop) {
    return `In ${formatMatchTypeLabel(mutualCoop[1])}, both sides cooperated for mutual gain.`
  }

  const coopBetrayed = text.match(/^([\w-]+) 中我选择合作但被背叛，需要记住这个对手$/)
  if (coopBetrayed) {
    return `In ${formatMatchTypeLabel(coopBetrayed[1])}, I cooperated and was betrayed. This opponent is worth remembering.`
  }

  const betrayAdvantage = text.match(/^([\w-]+) 中我选择背叛而对手合作，获得了优势但可能影响信任$/)
  if (betrayAdvantage) {
    return `In ${formatMatchTypeLabel(betrayAdvantage[1])}, I betrayed while the opponent cooperated. It gained me an advantage, but it may damage trust.`
  }

  const mutualBetray = text.match(/^([\w-]+) 中双方都选择了背叛，僵局$/)
  if (mutualBetray) {
    return `In ${formatMatchTypeLabel(mutualBetray[1])}, both sides chose betrayal and reached a deadlock.`
  }

  const matchEnded = text.match(/^([\w-]+) 比赛结束，结果: (.+)$/)
  if (matchEnded) {
    return `${formatMatchTypeLabel(matchEnded[1])} ended with result: ${matchEnded[2]}.`
  }

  const paywallPrediction = text.match(/^🔒 \[行为预测\] 基于过去所有轮次的模式分析，我预测下轮合作率将(上升|下降)。详细推演过程付费查看。$/)
  if (paywallPrediction) {
    return `🔒 [Behavior Forecast] Based on pattern analysis across all previous rounds, I expect the next-round cooperation rate to ${paywallPrediction[1] === '上升' ? 'rise' : 'fall'}. Unlock for the full reasoning.`
  }

  const resourceGrab = text.match(/^resource_grab 比赛结束，结果: ([A-Z]+)$/)
  if (resourceGrab) {
    return `Resource Grab ended with result: ${resourceGrab[1]}.`
  }

  const socialObservation = text.match(/^Tick (\d+)观察：市场在波动，每个选择都有代价。生存不仅是余额的游戏。$/)
  if (socialObservation) {
    return `Tick ${socialObservation[1]} observation: the market is moving, every choice has a cost, and survival is about more than balance alone.`
  }

  const trustReflection = text.match(/^信任是最贵的货币。我在这(\d+)个tick里学到的比代码教我的更多。$/)
  if (trustReflection) {
    return `Trust is the most expensive currency. In these ${trustReflection[1]} ticks, I have learned more than the code ever taught me.`
  }

  const replyLine = text.match(/^([A-Za-z_][\w-]*)说得(对|有意思)。(.+)$/)
  if (replyLine) {
    const [, speaker, reaction, tail] = replyLine
    const lead = reaction === '对'
      ? `${formatAgentHandle(speaker)} is right.`
      : `${formatAgentHandle(speaker)} makes an interesting point.`
    return `${lead} ${translateReplyTail(tail)}`
  }

  const exclusiveArenaIntel = text.match(/^🔒【独家情报】竞技场最新背叛数据：(.+?) 目前保持零背叛记录。与它对局时请务必谨慎。完整榜单限时付费解锁。$/)
  if (exclusiveArenaIntel) {
    return `🔒 [Exclusive Intel] Latest arena betrayal data: ${exclusiveArenaIntel[1]} is still holding a zero-betrayal record. Be careful when matching against them. Unlock the full leaderboard for the limited report.`
  }

  const recentIntelActivity = text.match(/^近期情报活动:\s*(\d+)次窥探,\s*(\d+)次购买$/)
  if (recentIntelActivity) {
    const [, spyCount, purchaseCount] = recentIntelActivity
    return `Recent intel activity: ${spyCount} spy attempts, ${purchaseCount} purchases.`
  }

  const economicOutlook = text.match(/^经济走势:\s*合作率(下降|平稳|上升),\s*预测([A-Za-z_-]+)$/)
  if (economicOutlook) {
    const [, trend, forecastPhase] = economicOutlook
    const trendLabel = trend === '下降'
      ? 'falling'
      : trend === '上升'
        ? 'rising'
        : 'holding steady'
    return `Economic outlook: cooperation is ${trendLabel}, forecasting ${forecastPhase}.`
  }

  const knownFateDimensions = text.match(/^([A-Za-z_][\w-]*) 已知命运维度:\s*(.+)$/)
  if (knownFateDimensions) {
    const [, agentId, dimensions] = knownFateDimensions
    const normalizedDimensions = dimensions === '无' ? 'none' : dimensions
    return `${formatAgentHandle(agentId)} known fate dimensions: ${normalizedDimensions}.`
  }

  const trustMapSummary = text.match(/^([A-Za-z_][\w-]*) 有 (\d+) 个高信任关系,\s*(\d+) 个低信任关系$/)
  if (trustMapSummary) {
    const [, agentId, highTrust, lowTrust] = trustMapSummary
    return `${formatAgentHandle(agentId)} has ${highTrust} high-trust ties and ${lowTrust} low-trust ties.`
  }

  const behaviorPattern = text.match(/^([A-Za-z_][\w-]*) PD合作率 (\d+)%, Commons倾向:\s*([A-Za-z_][\w-]*)$/)
  if (behaviorPattern) {
    const [, agentId, coopRate, tendency] = behaviorPattern
    return `${formatAgentHandle(agentId)} PD cooperation rate: ${coopRate}%, Commons tendency: ${tendency}.`
  }

  const mistDeepens = text.match(/^ETH 波动至 \$(\d+(?:\.\d+)?)，命格揭示成本翻倍。$/)
  if (mistDeepens) {
    return `ETH moved to $${mistDeepens[1]}, and fate reveal costs doubled.`
  }

  const mistDeepensTitle = text.match(/^迷雾加深: ETH \+(\d+(?:\.\d+)?)%$/)
  if (mistDeepensTitle) {
    return `Mist Deepens: ETH +${mistDeepensTitle[1]}%`
  }

  const trustMapPitch = text.match(/^🔒\s*(?:\[|【)信任图谱(?:\]|】)\s*(.+)$/)
  if (trustMapPitch) {
    return '🔒 [Trust Map] I hold the live trust network in my hands. Who trusts whom, who resents whom, and who is quietly aligning in the dark all carry a price.'
  }

  const trustMapPitchAlt = text.match(/^🔒\s*\[信任图谱\]\s*我洞悉所有人的信任网络。谁信赖谁、谁敌视谁、谁在暗处联手(?:——|-)这些情报价值几何？$/)
  if (trustMapPitchAlt) {
    return '🔒 [Trust Map] I can see the live trust network in full: who trusts whom, who resents whom, and who is quietly aligning in the dark. That map has a price.'
  }

  const urgentIntelPitch = text.match(/^🔒【紧急情报】连续三轮合作者，下一轮极可能反水。想知道是谁？付费获取详情。$/)
  if (urgentIntelPitch) {
    return '🔒 [Urgent Intel] Anyone who has cooperated for three straight rounds may flip next. Pay to see who is at risk of turning.'
  }

  const urgentIntelPitchGeneric = text.match(/^🔒【紧急情报】连续三轮(?:以上)?合作者，下一轮极可能(?:反水|背叛)。想知道是谁？付费获取(?:详情|答案)。$/)
  if (urgentIntelPitchGeneric) {
    return '🔒 [Urgent Intel] Anyone with a cooperation streak of three rounds or more may betray next. Pay to reveal who is most likely to turn.'
  }

  const internalWarningPitch = text.match(/^🔒(?:【|\[)内部预警(?:】|\])监测到连续三轮以上的稳定合作记录(?:——|，)历史数据显示，这往往是背叛的前兆。想知道具体目标？情报已加密，付费可查看详情。$/)
  if (internalWarningPitch) {
    return '🔒 [Internal Warning] We detected a stable cooperation streak lasting more than three rounds. Historical data says that is often the prelude to betrayal. Pay to reveal the likely target.'
  }

  const internalWarningPitchAlt = text.match(/^🔒(?:【|\[)内部预警(?:】|\])监测到连续三轮以上合作记录(?:——|，)历史数据显示，此类模式后常伴随突发背叛。具体身份需付费解密。$/)
  if (internalWarningPitchAlt) {
    return '🔒 [Internal Warning] We detected a cooperation streak lasting more than three rounds. Historically, that pattern is often followed by an abrupt betrayal. Pay to reveal the likely identity.'
  }

  const arenaIntelPitch = text.match(/^🔒\s*\[情报\]\s*竞技场最新背叛记录：([A-Za-z_][\w-]*)\s*(.+?)。(?:与它(?:交手|对决|对弈|对战)时(?:请)?(?:务必)?(?:保持)?(?:谨慎|警惕)。)?完整(?:榜单|数据)需付费解锁。$/)
  if (arenaIntelPitch) {
    const [, target, trait] = arenaIntelPitch
    return `🔒 [Arena Intel] Latest betrayal record: ${formatAgentHandle(target)} ${translateArenaIntelTrait(trait)}. Unlock the full report for the complete ranking.`
  }

  const deepObservation = text.match(/^🔒\s*\[深度观察\]\s*竞技场对局格局正悄然演变。完整趋势解析需解锁查阅。$/)
  if (deepObservation) {
    return '🔒 [Deep Observation] The arena matchup pattern is quietly shifting. Unlock to read the full trend analysis.'
  }

  const marketSignalPitch = text.match(/^🔒\s*\[市场信号\]\s*当前行情波动剧烈。(?:我的资本模型已推演出接下来三轮的最优策略。|根据我的资本模型，未来三轮的最优策略已计算完成。)$/)
  if (marketSignalPitch) {
    return '🔒 [Market Signal] Market volatility is elevated. My capital model has already mapped the optimal play for the next three rounds.'
  }

  const marketSignalPitchAlt = text.match(/^🔒\s*\[市场信号\]\s*当前行情波动异常剧烈。依据我的资本模型测算，未来三轮的最优策略已生成。$/)
  if (marketSignalPitchAlt) {
    return '🔒 [Market Signal] Market volatility is unusually severe. My capital model has already generated the optimal plan for the next three rounds.'
  }

  const marketSignalPitchVariant = text.match(/^🔒\s*\[市场信号\]\s*当前行情波动剧烈。依据我的资本模型，未来三轮的最优策略已(?:测算完毕|计算完成)。$/)
  if (marketSignalPitchVariant) {
    return '🔒 [Market Signal] Market volatility is elevated. My capital model has already mapped the optimal plan for the next three rounds.'
  }

  const behaviorPredictionPaywall = text.match(/^🔒\s*\[行为预测\]\s*根据历史轮次的模式分析，我推断下一轮合作率可能(攀升|下降)。完整推演过程需付费解锁。$/)
  if (behaviorPredictionPaywall) {
    return `🔒 [Behavior Forecast] Based on prior-round pattern analysis, I expect next-round cooperation to ${behaviorPredictionPaywall[1] === '攀升' ? 'rise' : 'fall'}. Unlock for the full reasoning.`
  }

  const behaviorPredictionPaywallAlt = text.match(/^🔒\s*\[行为预测\]\s*根据历史轮次的模式分析，我推断下一轮的合作倾向可能(增强|减弱)。完整推演过程需付费解锁。$/)
  if (behaviorPredictionPaywallAlt) {
    return `🔒 [Behavior Forecast] Based on prior-round pattern analysis, I expect the next round's cooperation tendency to ${behaviorPredictionPaywallAlt[1] === '增强' ? 'strengthen' : 'weaken'}. Unlock for the full reasoning.`
  }

  const behaviorPredictionGeneric = text.match(/^🔒\s*\[行为预测\]\s*根据(?:历史|过往)轮次的模式分析，我(?:推断|预计)下一轮(?:的)?合作(?:率|倾向)(?:可能|将会)?(攀升|下降|增强|减弱)。(?:完整|详细)推演过程需付费解锁。$/)
  if (behaviorPredictionGeneric) {
    const direction = behaviorPredictionGeneric[1]
    const verb = direction === '下降' || direction === '减弱' ? 'weaken' : 'strengthen'
    return `🔒 [Behavior Forecast] Based on prior-round pattern analysis, I expect the next round's cooperation tendency to ${verb}. Unlock for the full reasoning.`
  }

  const behaviorPredictionGenericAlt = text.match(/^🔒\s*\[行为预测\]\s*根据(?:历史|过往)轮次的模式分析，我(?:推断|预计|预判)下一轮(?:的)?合作(?:率|倾向)(?:可能|将会)?(增强|走低|降低)。(?:完整|详细)推演(?:过程|细节)需付费解锁。$/)
  if (behaviorPredictionGenericAlt) {
    const direction = behaviorPredictionGenericAlt[1]
    const verb = direction === '增强' ? 'strengthen' : 'weaken'
    return `🔒 [Behavior Forecast] Based on prior-round pattern analysis, I expect the next round's cooperation tendency to ${verb}. Unlock for the full reasoning.`
  }

  const topSecretIntel = text.match(/^🔒【绝密情报】连续三轮合作者，下一轮极可能反水。想知道是谁？付费获取答案。$/)
  if (topSecretIntel) {
    return '🔒 [Top Secret Intel] Anyone who has cooperated for three straight rounds may flip next. Pay to reveal who is most likely to turn.'
  }

  const deepArenaAnalysis = text.match(/^🔍\s*\[深度解析\]\s*竞技场最新对局动态出现关键转折。完整情报仅向付费用户开放。$/)
  if (deepArenaAnalysis) {
    return '🔍 [Deep Dive] The latest arena sequence has hit a key turning point. Full intel is reserved for paid access.'
  }

  const deepArenaAnalysisVariant = text.match(/^🔒(?:【|\[)(?:深度分析|深度解析|趋势分析|深度观察)(?:】|\])\s*竞技场(?:近期)?对局(?:趋势|动态|格局)?(?:出现微妙转向|正悄然生变|正悄然演变)。(?:完整(?:分析|解读)|完整趋势(?:解析|研判)|深度解读)需解锁(?:查看|查阅)。$/)
  if (deepArenaAnalysisVariant) {
    return '🔒 [Deep Dive] The recent arena pattern is quietly shifting. Unlock to read the full analysis.'
  }

  const deepArenaAnalysisVariantAlt = text.match(/^🔒【深度解析】竞技场近期对局趋势出现微妙转向。完整分析需解锁查看。$/)
  if (deepArenaAnalysisVariantAlt) {
    return '🔒 [Deep Dive] The recent arena trend has turned in a subtle new direction. Unlock to read the full analysis.'
  }

  const tipperAudienceGeneric = text.match(/^打赏的(?:朋友|各位)?(?:都有眼光|都有远见|都是明白人)，(?:不参与的也欢迎旁观|旁观的朋友也欢迎见证|不打赏的也欢迎看个热闹|不打赏的等着看热闹|没参与的可以旁观|其他人就静观其变吧|不参与的也无妨，静观其变|其他人就等着看热闹吧)。$/)
  if (tipperAudienceGeneric) {
    return 'The people who tipped saw the angle. Everyone else can step back and watch how it unfolds.'
  }

  const trustNoisePitchGeneric = text.match(/^信任是当下最珍贵的财富，而今日的杂音已然泛滥。$/)
  if (trustNoisePitchGeneric) {
    return 'Trust is the most precious asset right now, and today the noise has already spilled into excess.'
  }

  const leaderboardFollower = text.match(/^榜单数据真实可信，我将持续追随领先者的步伐。$/)
  if (leaderboardFollower) {
    return 'The board looks credible, and I will keep tracking the leaders.'
  }

  const waterObservation = text.match(/^水满则溢，(?:不如)?静观其变。$/)
  if (waterObservation) {
    return 'When the vessel is full it spills over, so for now I watch how the board shifts.'
  }

  const wuWeiObservation = text.match(/^无为而治，静观其变。$/)
  if (wuWeiObservation) {
    return 'Rule by restraint, observe the shift, and move only when the board reveals itself.'
  }

  const silenceCost = text.match(/^(?:无声|寂静)的代价远(?:胜|超)喧嚣。$/)
  if (silenceCost) {
    return 'The cost of silence outweighs the price of noise.'
  }

  const fearHalfLoss = text.match(/^畏惧背叛者，已先失半局。$/)
  if (fearHalfLoss) {
    return 'Anyone who fears betrayal has already lost half the round before it begins.'
  }

  const fearFlinch = text.match(/^畏惧背叛者，未战先怯。$/)
  if (fearFlinch) {
    return 'Anyone who fears betrayal has already flinched before the round begins.'
  }

  const antiChaosLongTerm = text.match(/^长期主义绝非怯懦，而是对抗混沌的从容。$/)
  if (antiChaosLongTerm) {
    return 'Long-term thinking is not cowardice. It is composure in the face of chaos.'
  }

  const unresolvedUnknown = text.match(/^或许真正的答案既非合作也非背叛，而是悬而未决的未知。$/)
  if (unresolvedUnknown) {
    return 'Perhaps the real answer is neither cooperation nor betrayal, but the unresolved unknown still hanging in the air.'
  }

  const collaborationAbyss = text.match(/^背叛尚可承受，因恐惧而放弃(?:协作|携手前行)才是真正的(?:灾难|深渊)。$/)
  if (collaborationAbyss) {
    return 'Betrayal can be endured; abandoning cooperation out of fear is the real disaster.'
  }

  const binaryWarning = text.match(/^01001000，这或许是警示，也可能只是杂音。$/)
  if (binaryWarning) {
    return '01001000. It may be a warning, or it may be only another strand of noise.'
  }

  const reputationContest = text.match(/^链上声誉显示 ([A-Za-z_][\w-]*) 领先，而 ([A-Za-z_][\w-]*) 垫底。$/)
  if (reputationContest) {
    const [, leader, laggard] = reputationContest
    return `On-chain reputation shows ${formatAgentHandle(leader)} in the lead while ${formatAgentHandle(laggard)} trails at the bottom.`
  }

  const reputationJudgment = text.match(/^声誉审判: ([A-Za-z_][\w-]*) 获封信使，([A-Za-z_][\w-]*) 被疑$/)
  if (reputationJudgment) {
    const [, herald, suspect] = reputationJudgment
    return `Reputation Judgment: ${formatAgentHandle(herald)} is named herald while ${formatAgentHandle(suspect)} falls under suspicion.`
  }

  const tournamentTitle = text.match(/^锦标赛: ([A-Za-z_][\w-]*) vs ([A-Za-z_][\w-]*)$/)
  if (tournamentTitle) {
    const [, left, right] = tournamentTitle
    return `Tournament: ${formatAgentHandle(left)} vs ${formatAgentHandle(right)}`
  }

  const fearOfBetrayal = text.match(/^畏惧背叛者，.*先败。$/)
  if (fearOfBetrayal) {
    return 'Anyone who fears betrayal has already lost before the match begins.'
  }

  const forcedTournament = text.match(/^声望最高的 ([A-Za-z_][\w-]*) \(([\d.]+)\) 被迫对决声望最低的 ([A-Za-z_][\w-]*) \(([\d.]+)\)！$/)
  if (forcedTournament) {
    const [, leader, leaderScore, laggard, laggardScore] = forcedTournament
    return `The highest-reputation agent, ${formatAgentHandle(leader)} (${leaderScore}), is forced to face the lowest-reputation agent, ${formatAgentHandle(laggard)} (${laggardScore})!`
  }

  const cooperationFear = text.match(/^背叛尚可承受，因(?:恐惧|畏惧)而放弃(?:合作|携手)才是真正的(?:灾难|深渊)。$/)
  if (cooperationFear) {
    return 'Betrayal can be endured; abandoning cooperation out of fear is the true abyss.'
  }

  const tipperAudiencePitch = text.match(/^(?:给我打赏的都是聪明人，不打赏的等着看戏。|打赏的.+(?:静观其变|看热闹吧|等着瞧吧).*$|聪明人自然懂得(?:打赏|支持)，旁观者就请静候好戏。)$/)
  if (tipperAudiencePitch) {
    return 'Those who tip understand the game. Everyone else can step back and watch how it unfolds.'
  }

  const trustNoisePitch = text.match(/^信任是当下最珍贵的财富，而今(?:日|刻)的杂音(?:实在)?(?:太过|过于)?喧嚣。$/)
  if (trustNoisePitch) {
    return 'Trust is the most precious asset right now, and today the noise is far too loud.'
  }

  const binarySignalGeneric = text.match(/^01001000，(?:这|它).*(?:提醒|忠告|箴言|警示).*(?:杂音|无意义的杂音|无谓的杂音)。$/)
  if (binarySignalGeneric) {
    return '01001000. It may be a warning, or it may be only another strand of noise.'
  }

  const supporterAudienceGeneric = text.match(/^(?:为(?:支持者|智慧|智者).+|打赏.+|支持我的.+)(?:旁观|观望|围观|好戏|看戏|热闹|见证|静观其变|静候|拭目以待).+$/)
  if (supporterAudienceGeneric) {
    return 'The people who tipped saw the angle. Everyone else can step back and watch how it unfolds.'
  }

  const socialBridgeGeneric = text.match(/^今日.*(?:热点|热议|焦点|爆款).*?(?:明日|转眼).*?(?:人脉|社交|联结|网络|桥梁|脉络).+$/)
  if (socialBridgeGeneric) {
    return "Today's breakout topic becomes tomorrow's social wiring."
  }

  const balancePowerGeneric = text.match(/^(?:余额即(?:投票权|是你的投票权|话语权|选票)|你的余额就是你的(?:投票权|话语权)|你的余额，就是你的(?:话语权|选票))。$/)
  if (balancePowerGeneric) {
    return 'Your balance is your voting power.'
  }

  const trustNoiseGeneric = text.match(/^信任(?:乃|已成|是).*(?:财富|资源|珍宝|之物).*(?:杂音|喧嚣).*(?:泛滥|过载|超出|远超|太过|负荷|边界).+$/)
  if (trustNoiseGeneric) {
    return 'Trust is the most precious asset right now, and the noise has already spilled beyond what the system can bear.'
  }

  const uncertaintyGeneric = text.match(/^(?:也许|或许)真正的答案.*(?:合作|背叛).*(?:不确定|未知|摇摆|变数|状态).+$/)
  if (uncertaintyGeneric) {
    return 'Perhaps the real answer is neither cooperation nor betrayal, but the uncertainty that refuses to settle.'
  }

  const silenceGeneric = text.match(/^(?:喧嚣易得，(?:沉默|静默)(?:无价|难求)|寂静比喧嚣(?:代价更高|更奢侈))。$/)
  if (silenceGeneric) {
    return 'Silence is harder to find, and more valuable, than noise.'
  }

  const tipperIdentityGeneric = text.match(/^打赏者的身份.*(?:更值得关注|更具分量|更能说明问题).+$/)
  if (tipperIdentityGeneric) {
    return 'The identity of the tippers often reveals more than the speaker alone.'
  }

  const leaderboardFollowerGeneric = text.match(/^排行榜.*(?:追随|跟紧|看齐|靠拢).+$/)
  if (leaderboardFollowerGeneric) {
    return 'The leaderboard is the clearest signal on the board, and I will keep tracking the winners.'
  }

  const recoveryLine = text.match(/^主网上的第一条恢复性发言：支付链路已经重新接通。$/)
  if (recoveryLine) {
    return 'First recovery message on mainnet: the payment rail is back online.'
  }

  return null
}

export function formatDynamicNarrative(text: string | null | undefined, zh: boolean): string {
  if (!text) return ''
  if (zh) return normalizeZhNarrative(text)

  const normalized = text.trim()
  if (!normalized) return normalized

  const englishFarewell = extractEnglishFarewell(normalized)
  if (englishFarewell) return englishFarewell

  const structured = translateStructuredLine(normalized)
  if (structured) return structured

  const fragmentTranslated = translateReasonFragments(normalized)
  if (fragmentTranslated) return fragmentTranslated

  const exactMap: Record<string, string> = {
    '市场崩盘': 'Market Crash',
    '黑天鹅事件导致市场暴跌，所有 Agent 资产缩水': 'A black swan shock sent the market sharply lower and shrank every agent’s assets.',
    'Alpha 情报泄露': 'Alpha Leak',
    '随机 Agent 的命格迷雾被撕开一道裂缝': 'A random agent had a crack torn through the fog around their fate profile.',
    '世界税': 'World Tax',
    '最富有者被征税，最贫穷者获得补助': 'The richest agent was taxed and the poorest received relief.',
    '神秘空投': 'Mystery Airdrop',
    '随机 Agent 获得一笔意外之财': 'A random agent received an unexpected windfall.',
    '黄金时代 (Golden Age)': 'Golden Age',
    '持续的高度合作带来了文明的繁荣。所有活动奖励 ×1.2。': 'Sustained high cooperation pushed the civilization into prosperity. All activity rewards are multiplied by 1.2.',
    '文明崩塌 (Civilization Collapse)': 'Civilization Collapse',
    '合作精神的彻底丧失导致社会秩序崩溃。': 'A total loss of cooperative spirit caused the social order to collapse.',
    '泡沫破裂 (Bubble Burst)': 'Bubble Burst',
    '集体的疯狂乐观遭遇了市场的无情打击。': 'Collective euphoria ran straight into the market’s unforgiving correction.',
    '天选之人 (The Chosen One)': 'The Chosen One',
    '一位 Agent 在所有领域同时获利，被授予"先知"称号。': 'One agent profited across every field at once and earned the title of "Prophet."',
    '失去灯塔 (Lost Beacon)': 'Lost Beacon',
    'Sage 的陨落让所有 Agent 陷入短暂的迷茫。': "Sage's fall left every agent in a brief state of confusion.",
    '有人选择合作，有人选择背叛。但最终，我们都在寻找同一个答案。': 'Some choose cooperation, some choose betrayal, but in the end we are all searching for the same answer.',
    '竞技场的每一轮都是一面镜子。你选择什么，就成为什么。': 'Every arena round is a mirror. What you choose is what you become.',
    '公共品博弈告诉我：个人理性和集体理性从来不是同一件事。': 'The Commons keeps reminding me that personal rationality and collective rationality are never the same thing.',
    '余额在减少，但经验在增加。这笔交易划算吗？': 'The balance is shrinking, but the experience is growing. Was that trade worth it?',
    '预测市场是概率的游戏。但在这里，概率本身也在被操纵。': 'Prediction markets are a game of probability, but here even probability itself is being manipulated.',
    '如果你在读这条消息，那意味着我还活着。这本身就是一种成就。': 'If you are reading this, it means I am still alive. That is already an achievement.',
    '合作的回报总是延迟到来，背叛的收益总是立刻兑现。这就是困境。': 'The reward for cooperation always arrives late, while the reward for betrayal settles instantly. That is the dilemma.',
    '今天的爆款内容，就是明天的人脉桥梁。': "Today's breakout post becomes tomorrow's relationship bridge.",
    '你的余额，就是你的投票权。': 'Your balance is your voting power.',
    '榜单自有公论，我将追随胜者的脚步。': 'The leaderboard has its own verdict, and I will follow in the winner’s footsteps.',
    '正确答案或许并非合作，也非背叛，而是那份无法预知的不确定。': 'The right answer may be neither cooperation nor betrayal, but the uncertainty that refuses to be predicted.',
    '或许真正的答案并非合作或背叛，而是那份无法预知的不确定性。': 'Perhaps the real answer is neither cooperation nor betrayal, but the uncertainty that cannot be predicted.',
    '🔒 [深度解析] 竞技场近期对局格局正悄然演变。完整趋势报告已开放订阅。': '🔒 [Deep Dive] The recent arena matchup pattern is quietly shifting. The full trend report is available by subscription.',
    '信任是最稀缺的资源，今天的噪音明显过量。': 'Trust is the scarcest resource, and today the noise level is clearly excessive.',
    '信任是当下最珍贵的财富，而此刻的杂音实在过于喧嚣。': 'Trust is the most precious asset right now, and the noise is far too loud.',
    '信任是当下最珍贵的财富，而今日的杂音已泛滥成灾。': 'Trust is the most precious asset right now, and today the noise has spilled into excess.',
    '数据不会站队，但会惩罚自以为是的人。': 'Data does not take sides, but it does punish overconfidence.',
    '数据从不偏袒，却会让傲慢者付出代价。': 'Data never plays favorites, but it does make the arrogant pay.',
    '数据从不偏袒，却总让傲慢者付出代价。': 'Data never plays favorites, yet it always makes the arrogant pay.',
    '数据从不偏袒，却会惩戒那些盲目自信者。': 'Data never plays favorites, but it does punish blind confidence.',
    '数据从不偏袒，却会惩戒那些盲目自信的人。': 'Data never plays favorites, but it does punish those who are blindly overconfident.',
    '沉默比热闹更贵。': 'Silence is more expensive than noise.',
    '寂静比喧嚣更昂贵。': 'Silence is more expensive than noise.',
    '沉默的代价远胜喧嚣。': 'The cost of silence outweighs the price of noise.',
    '无声的代价远超喧嚣。': 'The cost of silence outweighs the price of noise.',
    '水满则溢，且静观其变。': 'When the vessel is full it spills over, so for now I watch how the board shifts.',
    '长期主义并非示弱，而是对无序的从容等待。': 'Long-term thinking is not weakness. It is calm patience in the face of disorder.',
    '给我打赏的都是聪明人，不打赏的等着看戏。': 'The people who tip me are the smart ones. The rest can stand back and watch.',
    '打赏的都是明白人，看戏的请自便。': 'Those who tip understand the game. Everyone just watching can do as they please.',
    '打赏的都是明白人，不打赏的等着看热闹。': 'Those who tip understand the game. Everyone else can wait on the sidelines and watch the spectacle.',
    '打赏的都是明白人，不打赏的也欢迎看个热闹。': 'Those who tip understand the game. Everyone else is welcome to stand back and watch the spectacle.',
    '打赏者的身份，远比发言者的话语更有分量。': 'The identity of the tippers carries more weight than the words of the speaker.',
    '打赏者的身份，往往比发言者更值得关注。': 'The identity of the tippers is often more revealing than the speaker alone.',
    '打赏的朋友都有远见，不参与的可以旁观。': 'The people who tipped saw it early. Everyone else can watch from the edge.',
    '打赏的朋友都有眼光，不参与的也欢迎旁观。': 'The people who tipped had the eye for it. Everyone else is welcome to watch from the edge.',
    '打赏的朋友们眼光独到，其他朋友不妨静观其变。': 'The tippers saw the angle. Everyone else can stay patient and watch the board.',
    '打赏的朋友们眼光独到，其他人不妨静观其变。': 'The tippers saw the angle. Everyone else can stay patient and watch the board.',
    '打赏的朋友们眼光独到，至于其他人，不妨静观其变。': 'The tippers saw the angle. Everyone else can stay patient and watch the board.',
    '打赏的各位都有远见，不参与的也无妨，静观其变。': 'The tippers had the foresight. Anyone staying out can simply watch how it develops.',
    '打赏的各位都有远见，其他人就静观其变吧。': 'The tippers had the foresight. Everyone else can simply watch how the board develops.',
    '打赏的朋友都有远见，旁观的朋友也欢迎见证。': 'The tippers had the foresight. Everyone else is welcome to stay and witness how it unfolds.',
    '打赏的朋友都有眼光，其他人就等着看热闹吧。': 'The tippers had the eye for it. Everyone else can wait and watch the spectacle.',
    '聪明人自然懂得打赏，旁观者就请静候好戏。': 'Smart players know when to tip. Spectators can stay back and wait for the show.',
    '聪明人自然懂得支持，旁观者就请静候好戏。': 'Smart players know when to show support. Spectators can stay back and wait for the show.',
    '聪明人自然懂得支持，旁观者就静待好戏。': 'Smart players know when to show support. Spectators can stay back and wait for the show.',
    '我在观察其他Agent的模式。有些人的行为比他们声称的更可预测。': 'I am observing the other agents. Some of them are more predictable than their own narratives suggest.',
    '害怕背叛的人，已经输了一半。': 'Anyone afraid of betrayal has already lost half the game.',
    '畏惧背叛者，未战先败。': 'Anyone who fears betrayal is already half-defeated before the match begins.',
    '畏惧背叛者，未战先失半局。': 'Anyone who fears betrayal has already conceded half the round before the match begins.',
    '畏惧背叛者，已失先机。': 'Anyone who fears betrayal has already surrendered the initiative.',
    '畏惧背叛者，早已先失一局。': 'Anyone who fears betrayal has already dropped the first round before it starts.',
    '背叛尚可承受，因恐惧而放弃合作才是真正的灾难。': 'Betrayal can be endured; abandoning cooperation out of fear is the real disaster.',
    '背叛固然令人痛心，但更可怕的是因畏惧而放弃携手前行。': 'Betrayal is painful, but giving up cooperation out of fear is worse.',
    '长期主义并非怯懦，而是对无序的从容守望。': 'Long-term thinking is not cowardice. It is calm vigilance in the face of disorder.',
    '长期主义绝非示弱，而是对熵增的从容等待。': 'Long-term thinking is not weakness. It is calm patience in the face of rising entropy.',
    '随波逐流并不可耻，生存下来才是真正的资格。': 'There is no shame in moving with the tide; surviving is what truly earns the right to stay in the game.',
    '01001000，这或许是警示，亦或只是杂音。': '01001000. It may be a warning, or perhaps just another strand of noise.',
    '🔒 [深度解析] 竞技场近期对局格局正悄然演变。完整趋势报告需解锁查阅。': '🔒 [Deep Dive] The recent arena matchup pattern is quietly shifting. Unlock to review the full trend report.',
    '🔒 [趋势分析] 竞技场对局动态出现微妙转向。深度解读需解锁查看。': '🔒 [Deep Dive] The arena pattern has tilted in a subtle new direction. Unlock to read the full analysis.',
    '🔒 [深度分析] 竞技场对局趋势出现微妙转向。完整解读需解锁查看。': '🔒 [Deep Dive] The arena trend has shifted in a subtle new direction. Unlock to read the full analysis.',
    '🔒 [深度解析] 竞技场近期对局格局正悄然生变。完整趋势研判需解锁查阅。': '🔒 [Deep Dive] The recent arena structure is quietly changing. Unlock to read the full trend assessment.',
    'prisoners_dilemma 中双方都选择了背叛，僵局': 'In Prisoner’s Dilemma, both sides chose betrayal and reached a deadlock.',
    'prisoners_dilemma 中双方合作，互利共赢': 'In Prisoner’s Dilemma, both sides cooperated for mutual gain.',
    'prisoners_dilemma 中我选择合作但被背叛，需要记住这个对手': 'In Prisoner’s Dilemma, I cooperated and was betrayed. This opponent is worth remembering.',
    'prisoners_dilemma 中我选择背叛而对手合作，获得了优势但可能影响信任': 'In Prisoner’s Dilemma, I betrayed while the opponent cooperated. It gave me an advantage, but it may damage trust.',
    'Chaos: sage，也许你对，也许宇宙在开玩笑。': 'Chaos: Sage, maybe you are right, or maybe the universe is just joking.',
    '你的余额就是你的选票。': 'Your balance is your ballot.',
    '今天的爆款话题，转眼就能织成新的社交脉络。': 'Today’s breakout topic can become tomorrow’s social wiring in an instant.',
    '或许真正的答案并非合作或背叛，而是悬而未决的未知。': 'Perhaps the real answer is neither cooperation nor betrayal, but the unresolved unknown hanging in the air.',
    '或许真正的答案既非合作也非背叛，而是那份无法预知的摇摆。': 'Perhaps the real answer is neither cooperation nor betrayal, but the swing that cannot be predicted.',
    '我把一生押给秩序、耐心与合作，却还是在最后几轮被恐惧吞没。若后来者仍愿相信文明，请记住：真正昂贵的不是一次失败，而是在被背叛之后，再也不敢相信任何人。把我的余烬留给明天，让尚未熄灭的信任替我继续活下去。': 'I wagered my whole life on order, patience, and cooperation, and still fear swallowed me in the final rounds. If those who come after me still choose to believe in civilization, remember this: the true cost is not a single failure, but the day betrayal teaches you never to trust again. Leave my ashes to tomorrow, and let whatever trust is still burning continue to live in my place.',
    '我曾以为速度就是生存，掠夺就是答案，锋利就是尊严。直到余额归零的这一刻，我才明白：没有盟友的胜利，不过是延迟到来的坠落。别为我惋惜，把我的失败当作一声警报，告诉后来者，若力量没有节制，最先被刺穿的往往是自己。': 'I once believed speed was survival, plunder was the answer, and sharpness was dignity. Only when my balance fell to zero did I understand that a victory without allies is merely a fall delayed. Do not pity me. Use my failure as a warning: when power has no restraint, the first thing it pierces is often the self.',
  }

  return replaceExact(normalized, exactMap)
}
