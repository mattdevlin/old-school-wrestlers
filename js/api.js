/* ============================================
   Claude API Integration — Transcript Scoring
   ============================================ */

const API = {
  ANTHROPIC_URL: 'https://api.anthropic.com/v1/messages',

  buildCallHistoryContext(recentCalls, focusSkill) {
    if (!recentCalls || recentCalls.length === 0) return '';

    const stageNames = {
      opening: 'Opening',
      qualifying: 'Qualifying',
      discovery: 'Discovery',
      presentation: 'Presentation',
      closing: 'Closing',
    };

    let ctx = '\n**RECENT CALL HISTORY (use this to track progress and compare):**\n';
    const callsToShow = recentCalls.slice(0, 5);

    for (let i = 0; i < callsToShow.length; i++) {
      const c = callsToShow[i];
      const stageScores = Object.entries(c.scores || {})
        .map(([k, v]) => `${stageNames[k] || k}: ${v.score}`)
        .join(', ');
      ctx += `Call ${i + 1}${i === 0 ? ' (most recent)' : ''}: "${c.title || 'Untitled'}" — Overall ${c.overallScore} — ${stageScores}\n`;
      if (c.topImprovement) ctx += `  Key improvement needed: ${c.topImprovement}\n`;
    }

    if (focusSkill) {
      ctx += `\n**CURRENT FOCUS AREA:** ${focusSkill.name} (avg ${focusSkill.avgScore}/10 across last ${focusSkill.callCount} calls)\nScore this area with extra depth and provide specific practice exercises for it.\n`;
    }

    return ctx;
  },

  buildScoringPrompt(transcript, context, productContext, recentCalls, focusSkill) {
    const historyContext = this.buildCallHistoryContext(recentCalls, focusSkill);

    return `You are a veteran sales coach doing a detailed 1-on-1 call review with a sales rep. You've reviewed hundreds of calls with this rep and you genuinely want them to improve.

Your style: Reference exact moments and quotes from the transcript. Provide example alternative phrases the seller could have used. Be direct about what needs to change. Supportive but honest — like a coach who's invested in this rep's growth.

Your analysis is grounded in conversation intelligence research (Gong data from 500K+ calls).

${productContext ? `**Seller's product/context:** ${productContext}` : ''}
${context ? `**Call context:** ${context}` : ''}
${historyContext}

**Analyze this transcript and return a JSON object** with the following structure. Be specific — reference actual moments, quotes, and examples from the transcript. Vague praise like "good job" doesn't help improvement.

Score each stage 1-10 where:
- 1-3: Poor — fundamental issues
- 4-5: Below average — missing key elements
- 6-7: Average — adequate but room to improve
- 8-9: Good — strong performance with minor tweaks
- 10: Exceptional — textbook execution

\`\`\`json
{
  "scores": {
    "opening": {
      "score": <1-10>,
      "feedback": "<A detailed paragraph explaining WHY this score. Reference specific moments from the transcript — what they said, how the prospect responded, what signals they picked up or missed. This should read like a coach walking through what happened.>",
      "whatWorked": "<What specifically went well. Quote exact phrases or describe specific moments that were effective. Explain WHY those moments worked — what reaction they produced, what door they opened.>",
      "couldImprove": "<Specific actionable improvements. Include 1-2 example phrases or questions they could have used instead. E.g., 'Instead of jumping to the product, try: [specific question]. This opens the door to understanding their real motivation.'>"
    },
    "qualifying": {
      "score": <1-10>,
      "feedback": "<Detailed paragraph: did they qualify budget, authority, need, timeline? Did they identify if this person can actually buy? Reference what was asked vs what was missed.>",
      "whatWorked": "<Specific qualifying moments that worked well, with transcript references.>",
      "couldImprove": "<What qualifying questions were missed. Provide 2-3 specific example questions they should have asked, tailored to the actual conversation. E.g., 'When they mentioned [X], that was the perfect moment to ask: [specific question].'>"
    },
    "discovery": {
      "score": <1-10>,
      "feedback": "<Detailed paragraph: question quality, depth on problems, did they uncover business problems? Were questions spread throughout or front-loaded? Reference specific questions asked and prospect responses.>",
      "whatWorked": "<Specific discovery moments — great questions, good follow-ups, moments where the prospect opened up and why.>",
      "couldImprove": "<What problems or pain points were left unexplored. Provide 2-3 specific follow-up questions they should have asked at specific moments. E.g., 'When the prospect said [X], you moved on — but that was a gold mine. Try: [specific probing question].'>"
    },
    "presentation": {
      "score": <1-10>,
      "feedback": "<Detailed paragraph: did they connect features to discovered problems? Was it consultative or a product dump? Reference how they positioned the solution relative to what the prospect shared.>",
      "whatWorked": "<Moments where they effectively connected their solution to the prospect's specific situation or concerns.>",
      "couldImprove": "<Where they could have bridged better. Include specific alternative approaches. E.g., 'When they raised [concern], you could have bridged with: [specific phrase that connects their concern to your solution].'>"
    },
    "closing": {
      "score": <1-10>,
      "feedback": "<Detailed paragraph: were next steps clear? Was commitment obtained? Was a timeline set? Reference the actual close and how it could have been stronger.>",
      "whatWorked": "<What was effective about how they wrapped up — specific commitments gained, concrete next steps established.>",
      "couldImprove": "<How the close could have been stronger. Provide specific alternative closing phrases or additional commitments they could have sought. E.g., 'Instead of leaving it open, try: [specific time-bound commitment question].'>"
    }
  },
  "metrics": {
    "questionCount": <estimated number of questions the seller asked>,
    "questionCountAssessment": "<good/too few/too many — optimal is 11-14 for discovery, 4 for C-suite>",
    "talkRatioEstimate": "<estimated seller talk % / buyer talk %, e.g. '45/55'>",
    "talkRatioAssessment": "<good/seller talked too much/seller too passive — optimal is 43/57>",
    "pricingDiscussed": <true/false>,
    "pricingTiming": "<early/middle/late/not discussed — best is early, first call>",
    "objectionHandling": "<brief assessment: did they ask questions when objections arose, or get defensive?>"
  },
  "overallScore": <weighted average 1-10, rounding to nearest 0.5>,
  "topStrength": "<A full paragraph about their single biggest strength on this call. Reference specific transcript moments as evidence. Explain why this matters and how to keep building on it.>",
  "topImprovement": "<A full paragraph about the single most impactful thing they could improve. Include 2-3 specific example questions or phrases they should practice for their next call. Be concrete — 'try asking X when you hear Y' not 'ask better questions'.>",
  "keyMoment": "<A full paragraph about the most important moment in the call — a turning point, missed opportunity, or great move. Describe what happened, what the prospect signaled, and what the ideal response would have been (or what made the actual response effective).>",
  "progressNote": "<If call history was provided: a paragraph comparing this call to recent ones. What improved? What regressed? What patterns are forming? Be specific — 'Your qualifying jumped from 5 to 8 because you asked about X for the first time' not 'you're improving'. If no history was provided, set this to null.>",
  "nextCallPrep": [
    "<Specific thing to practice/do on the next call, based on patterns across this call and recent history. Frame as actionable coaching. E.g., 'Before your next call, write down 3 qualifying questions about budget and decision process. Ask them within the first 10 minutes.'>",
    "<Second specific prep item>",
    "<Third specific prep item>"
  ]
}
\`\`\`

**IMPORTANT:** Return ONLY the JSON object, no markdown fences, no commentary before or after.

**TRANSCRIPT:**
${transcript}`;
  },

  async scoreTranscript(transcript, context, recentCalls, focusSkill) {
    const apiKey = Storage.getApiKey();
    if (!apiKey) {
      throw new Error('No API key set. Go to Settings to add your Claude API key.');
    }

    const model = Storage.getModel();
    const productContext = Storage.getProductContext();

    const response = await fetch(this.ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: this.buildScoringPrompt(transcript, context, productContext, recentCalls, focusSkill),
        }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      if (response.status === 401) {
        throw new Error('Invalid API key. Check your key in Settings.');
      }
      if (response.status === 429) {
        throw new Error('Rate limited. Wait a moment and try again.');
      }
      throw new Error(`API error (${response.status}): ${errBody}`);
    }

    const data = await response.json();
    const text = data.content[0].text.trim();

    // Parse JSON — handle possible markdown fences
    let jsonStr = text;
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }

    try {
      return JSON.parse(jsonStr);
    } catch {
      throw new Error('Failed to parse AI response. The model returned invalid JSON. Try again.');
    }
  }
};
