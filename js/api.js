/* ============================================
   Claude API Integration — Transcript Scoring
   ============================================ */

const API = {
  ANTHROPIC_URL: 'https://api.anthropic.com/v1/messages',

  buildScoringPrompt(transcript, context, productContext) {
    return `You are an expert sales coach analyzing a B2B sales call transcript. Your analysis is based on conversation intelligence research (Gong data from 500K+ calls).

${productContext ? `**Seller's product/context:** ${productContext}` : ''}
${context ? `**Call context:** ${context}` : ''}

**Analyze this transcript and return a JSON object** with the following structure. Be honest and specific — vague praise doesn't help improvement.

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
      "feedback": "<2-3 sentences: what they did well/poorly in rapport, tone, agenda setting>"
    },
    "qualifying": {
      "score": <1-10>,
      "feedback": "<2-3 sentences: did they qualify budget, authority, need, timeline? Did they identify if this person can actually buy?>"
    },
    "discovery": {
      "score": <1-10>,
      "feedback": "<2-3 sentences: question quality, depth on problems, did they uncover 3-4 business problems? Were questions spread throughout or front-loaded?>"
    },
    "presentation": {
      "score": <1-10>,
      "feedback": "<2-3 sentences: did they connect features to discovered problems? Was it consultative or a product dump?>"
    },
    "closing": {
      "score": <1-10>,
      "feedback": "<2-3 sentences: clear next steps? Commitment obtained? Timeline set?>"
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
  "topStrength": "<one sentence: their single biggest strength on this call>",
  "topImprovement": "<one sentence: the single most impactful thing they could improve>",
  "keyMoment": "<one sentence: the most important moment in the call — a turning point, missed opportunity, or great move>"
}
\`\`\`

**IMPORTANT:** Return ONLY the JSON object, no markdown fences, no commentary before or after.

**TRANSCRIPT:**
${transcript}`;
  },

  async scoreTranscript(transcript, context) {
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
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: this.buildScoringPrompt(transcript, context, productContext),
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
