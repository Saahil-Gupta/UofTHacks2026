import { NextResponse } from 'next/server';

// Fallback dataset for when API fails
const FALLBACK_MARKETS = [
  {
    id: 'fallback-1',
    question: 'Will Bitcoin reach $100,000 by end of 2024?',
    slug: 'will-bitcoin-reach-100k-2024',
    volume: 2500000,
    liquidity: 1800000,
    endDate: '2024-12-31T23:59:59Z',
  },
  {
    id: 'fallback-2',
    question: 'Will the S&P 500 close above 6000 in 2024?',
    slug: 'sp500-above-6000-2024',
    volume: 1800000,
    liquidity: 1200000,
    endDate: '2024-12-31T23:59:59Z',
  },
  {
    id: 'fallback-3',
    question: 'Will there be a recession in the US by Q2 2025?',
    slug: 'us-recession-q2-2025',
    volume: 2200000,
    liquidity: 1500000,
    endDate: '2025-06-30T23:59:59Z',
  },
  {
    id: 'fallback-4',
    question: 'Will AI achieve AGI before 2026?',
    slug: 'ai-agi-before-2026',
    volume: 1900000,
    liquidity: 1400000,
    endDate: '2025-12-31T23:59:59Z',
  },
  {
    id: 'fallback-5',
    question: 'Will Ethereum reach $5000 by end of 2024?',
    slug: 'ethereum-5000-2024',
    volume: 1600000,
    liquidity: 1100000,
    endDate: '2024-12-31T23:59:59Z',
  },
  {
    id: 'fallback-6',
    question: 'Will the Fed cut rates by 0.5% or more in 2024?',
    slug: 'fed-rate-cut-2024',
    volume: 2100000,
    liquidity: 1600000,
    endDate: '2024-12-31T23:59:59Z',
  },
  {
    id: 'fallback-7',
    question: 'Will Tesla stock reach $300 by end of 2024?',
    slug: 'tesla-300-2024',
    volume: 1400000,
    liquidity: 1000000,
    endDate: '2024-12-31T23:59:59Z',
  },
  {
    id: 'fallback-8',
    question: 'Will there be a major cyber attack on US infrastructure in 2024?',
    slug: 'cyber-attack-us-2024',
    volume: 1700000,
    liquidity: 1300000,
    endDate: '2024-12-31T23:59:59Z',
  },
  {
    id: 'fallback-9',
    question: 'Will Apple release a foldable iPhone by 2025?',
    slug: 'apple-foldable-iphone-2025',
    volume: 1500000,
    liquidity: 1100000,
    endDate: '2025-12-31T23:59:59Z',
  },
  {
    id: 'fallback-10',
    question: 'Will the US have a new president in 2025?',
    slug: 'us-new-president-2025',
    volume: 2300000,
    liquidity: 1700000,
    endDate: '2025-01-20T23:59:59Z',
  },
];

interface Market {
  id: string;
  question: string;
  slug?: string;
  volume?: number;
  liquidity?: number;
  endDate?: string;
  [key: string]: any;
}

function normalizeMarket(market: any): Market | null {
  // Ensure we have at least an id and question
  if (!market || (!market.id && !market.slug)) {
    return null;
  }

  return {
    id: market.id || market.slug || `market-${Date.now()}-${Math.random()}`,
    question: market.question || market.title || market.name || 'Unknown market',
    slug: market.slug || market.id,
    volume: typeof market.volume === 'number' ? market.volume : (market.volume24h || 0),
    liquidity: typeof market.liquidity === 'number' ? market.liquidity : (market.liquidity24h || 0),
    endDate: market.endDate || market.end_date || market.endDateISO || undefined,
    ...market, // Preserve other fields
  };
}

export async function GET() {
  let liveCount = 0;
  let status = 'unknown';
  let parsedType = 'unknown';

  try {
    const response = await fetch(
      'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=50',
      {
        headers: {
          'Accept': 'application/json',
        },
        cache: 'no-store',
      }
    );

    status = response.ok ? 'ok' : `error_${response.status}`;

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    const data = await response.json();
    
    // Safely parse response - handle array OR {data: array} OR {markets: array}
    let rawMarkets: any[] = [];
    
    if (Array.isArray(data)) {
      parsedType = 'array';
      rawMarkets = data;
    } else if (data && typeof data === 'object') {
      if (Array.isArray(data.data)) {
        parsedType = 'object.data';
        rawMarkets = data.data;
      } else if (Array.isArray(data.markets)) {
        parsedType = 'object.markets';
        rawMarkets = data.markets;
      } else if (Array.isArray(data.results)) {
        parsedType = 'object.results';
        rawMarkets = data.results;
      } else {
        parsedType = 'object.unknown';
        rawMarkets = [];
      }
    } else {
      parsedType = 'invalid';
      rawMarkets = [];
    }

    // Normalize to Market objects
    const normalizedMarkets = rawMarkets
      .map(normalizeMarket)
      .filter((market): market is Market => market !== null);

    liveCount = normalizedMarkets.length;

    // If normalizedMarkets.length === 0, return fallback
    if (normalizedMarkets.length === 0) {
      throw new Error('No valid markets found after normalization');
    }

    // Rank markets by volume + liquidity
    const rankedMarkets = normalizedMarkets
      .map((market) => ({
        ...market,
        score: (market.volume || 0) + (market.liquidity || 0),
      }))
      .filter((market) => market.score > 0) // Only include markets with valid scores
      .sort((a, b) => b.score - a.score)
      .slice(0, 20); // Top 20

    // Only return source="live" if we have markets
    if (rankedMarkets.length === 0) {
      throw new Error('No markets after ranking');
    }

    return NextResponse.json(
      {
        markets: rankedMarkets,
        source: 'live',
        debug: {
          liveCount: rankedMarkets.length,
          status,
          parsedType,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Polymarket API error:', error);
    
    // Return fallback dataset
    const rankedFallback = FALLBACK_MARKETS
      .map((market) => ({
        ...market,
        score: market.volume + market.liquidity,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    return NextResponse.json(
      {
        markets: rankedFallback,
        source: 'fallback',
        debug: {
          liveCount,
          status: status || 'error',
          parsedType,
        },
      },
      { status: 200 }
    );
  }
}
