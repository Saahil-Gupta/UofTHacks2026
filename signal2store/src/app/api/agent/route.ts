import { NextResponse } from 'next/server';

interface AgentRequest {
  market: {
    id: string;
    question: string;
    endDate?: string;
  };
  recommendedProducts: Array<{
    title: string;
    productType: string;
    tags: string[];
    price: string;
  }>;
  prefsTopKeywords: string[];
}

// Fallback deterministic ad copy generation
function generateFallbackCopy(market: { question: string }, keywords: string[]): {
  headline: string;
  description: string;
  whyBundle: string;
} {
  const category = keywords[0] || 'trending';
  const questionShort = market.question.length > 40 
    ? market.question.substring(0, 37) + '...'
    : market.question;

  return {
    headline: `${category.charAt(0).toUpperCase() + category.slice(1)} trend merch drop`,
    description: `Limited edition products inspired by current market signals. Get yours now.`,
    whyBundle: `Bundle saves 15% and targets the same audience for maximum impact.`,
  };
}

export async function POST(request: Request) {
  try {
    const body: AgentRequest = await request.json();
    const { market, recommendedProducts, prefsTopKeywords } = body;

    const apiKey = process.env.OPENAI_API_KEY;

    if (apiKey) {
      try {
        // Call OpenAI Responses API (no SDK)
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are a Shopify merchandising agent. Generate concise, compelling ad copy for product drops. Headlines must be 8 words or less. Descriptions must be 20 words or less.',
              },
              {
                role: 'user',
                content: `Market signal: "${market.question}". Products: ${recommendedProducts.map(p => p.title).join(', ')}. Top keywords: ${prefsTopKeywords.join(', ')}. Generate: 1) headline (≤8 words), 2) description (≤20 words), 3) whyBundle (1 sentence). Return JSON: {headline, description, whyBundle}`,
              },
            ],
            temperature: 0.7,
            max_tokens: 150,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          
          if (content) {
            try {
              // Try to parse JSON from response
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return NextResponse.json({
                  ok: true,
                  source: 'llm',
                  headline: parsed.headline || generateFallbackCopy(market, prefsTopKeywords).headline,
                  description: parsed.description || generateFallbackCopy(market, prefsTopKeywords).description,
                  whyBundle: parsed.whyBundle || generateFallbackCopy(market, prefsTopKeywords).whyBundle,
                });
              }
            } catch {
              // Fall through to fallback
            }
          }
        }
      } catch (err) {
        console.warn('OpenAI API error:', err);
        // Fall through to fallback
      }
    }

    // Fallback: deterministic generation
    const fallback = generateFallbackCopy(market, prefsTopKeywords);
    return NextResponse.json({
      ok: true,
      source: 'fallback',
      ...fallback,
    });
  } catch (error) {
    console.error('Agent API error:', error);
    return NextResponse.json(
      { ok: false, error: 'Invalid request' },
      { status: 400 }
    );
  }
}
