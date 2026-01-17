'use client';

import { useState, useEffect, useMemo } from 'react';
import { track, isAmplitudeEnabled } from '@/lib/analytics';

interface Market {
  id: string;
  question: string;
  slug?: string;
  volume?: number;
  liquidity?: number;
  endDate?: string;
  [key: string]: any;
}

interface RecommendedProduct {
  id: string;
  title: string;
  productType: string;
  tags: string[];
  price: string;
  description: string;
}

interface DemandSignal {
  id: string;
  question: string;
  confidence: number; // 0-1 scale
  why: string[];
  recommendedProducts: RecommendedProduct[]; // 3 products per signal
  market: Market;
}

interface Draft {
  id: string;
  title: string;
  productType: string;
  tags: string[];
  price: string;
  description: string;
  confidence: number;
  createdAt: string;
  signalId: string;
  productKey: string;
  status: 'draft' | 'published' | 'rejected';
}

interface PublishedProduct {
  id: string;
  title: string;
  productType: string;
  tags: string[];
  price: string;
  description: string;
  publishedAt: string;
  productKey: string;
}

interface Event {
  id: string;
  type: 'draft_generated' | 'published' | 'rejected';
  message: string;
  timestamp: string;
}

interface Preferences {
  confidence: number;
  keywords: { [key: string]: number }; // keyword -> score (boosted/downranked)
}

interface AgentPlan {
  targetAudience: string;
  recommendedBundle: {
    products: RecommendedProduct[];
    bundlePrice: string;
  };
  launchTiming: 'Rush drop' | 'Test drop';
  channelRecommendation: string;
  collectionName: string;
  adCopy: {
    headline: string;
    description: string;
    whyBundle?: string;
  };
  riskCheck: {
    avoidsTrademarks: boolean;
    usesGenericLanguage: boolean;
  };
}

const STORAGE_KEYS = {
  drafts: 's2s_drafts_v1',
  published: 's2s_published_v1',
  events: 's2s_events_v1',
  prefs: 's2s_prefs_v1',
};

interface ApiResponse {
  markets: Market[];
  source: 'live' | 'fallback';
}

// Normalize title for productKey: lowercase, trim, collapse whitespace, remove non-alphanumerics except spaces
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/[^a-z0-9\s]/g, '') // Remove non-alphanumerics except spaces
    .replace(/\s+/g, ' ') // Collapse again after removal
    .trim();
}

// Generate productKey
function generateProductKey(marketId: string, productType: string, title: string): string {
  return `${marketId}::${productType}::${normalizeTitle(title)}`;
}

// Extract keywords from question
function extractKeywords(question: string): string[] {
  const lower = question.toLowerCase();
  const keywords: string[] = [];
  
  // Common categories
  if (lower.includes('bitcoin') || lower.includes('btc') || lower.includes('crypto') || lower.includes('ethereum') || lower.includes('eth')) {
    keywords.push('crypto');
  }
  if (lower.includes('stock') || lower.includes('s&p') || lower.includes('nasdaq') || lower.includes('dow') || lower.includes('tesla') || lower.includes('apple')) {
    keywords.push('stocks');
  }
  if (lower.includes('ai') || lower.includes('artificial intelligence') || lower.includes('agi') || lower.includes('tech')) {
    keywords.push('tech');
  }
  if (lower.includes('president') || lower.includes('election') || lower.includes('politics') || lower.includes('fed') || lower.includes('government')) {
    keywords.push('politics');
  }
  if (lower.includes('recession') || lower.includes('economy') || lower.includes('gdp') || lower.includes('inflation')) {
    keywords.push('economics');
  }
  
  return keywords.length > 0 ? keywords : ['general'];
}

// Generate commerce-focused why bullets
function generateWhyBullets(market: Market, confidence: number, hasBoostedKeywords: boolean): string[] {
  const bullets: string[] = [];
  const totalActivity = (market.volume || 0) + (market.liquidity || 0);
  
  bullets.push('Demand likely to spike if this event happens');
  
  if (totalActivity > 3000000) {
    bullets.push('High signal activity suggests trend attention');
  } else if (totalActivity > 2000000) {
    bullets.push('Strong signal activity indicates growing interest');
  }
  
  if (hasBoostedKeywords) {
    bullets.push('Matches your past published categories');
  }
  
  if (confidence > 0.7) {
    bullets.push('High confidence signal for product demand');
  }
  
  return bullets.slice(0, 3); // Max 3 bullets
}

// Generate product type based on category
function getProductType(category: string): string {
  const typeMap: { [key: string]: string } = {
    crypto: 'Apparel',
    stocks: 'Accessories',
    tech: 'Electronics',
    politics: 'Apparel',
    economics: 'Accessories',
    general: 'Merchandise',
  };
  return typeMap[category] || 'Merchandise';
}

// Generate 3 recommended products from market
function generateRecommendedProducts(market: Market): RecommendedProduct[] {
  const keywords = extractKeywords(market.question);
  const category = keywords[0] || 'general';
  const productType = getProductType(category);
  const totalActivity = (market.volume || 0) + (market.liquidity || 0);
  
  // Base price calculation
  let basePrice = '$9.99';
  if (totalActivity > 3000000) {
    basePrice = '$29.99';
  } else if (totalActivity > 2000000) {
    basePrice = '$19.99';
  } else if (totalActivity > 1000000) {
    basePrice = '$14.99';
  }
  
  // Generate 3 product variations
  const products: RecommendedProduct[] = [];
  
  // Product 1: T-shirt/Apparel
  products.push({
    id: `${market.id}-product-1`,
    title: `${category.charAt(0).toUpperCase() + category.slice(1)} Trend ${market.question.substring(0, 30)}... T-Shirt`,
    productType: 'Apparel',
    tags: [...keywords, 't-shirt', 'trending'],
    price: basePrice,
    description: `Stay ahead of the trend with this ${category}-themed t-shirt. Inspired by current market signals suggesting high interest in this topic.`,
  });
  
  // Product 2: Accessory/Sticker
  products.push({
    id: `${market.id}-product-2`,
    title: `${category.charAt(0).toUpperCase() + category.slice(1)} Signal Sticker Pack`,
    productType: 'Accessories',
    tags: [...keywords, 'sticker', 'collectible'],
    price: `$${(parseFloat(basePrice.replace('$', '')) * 0.4).toFixed(2)}`,
    description: `Express your interest with this limited edition sticker pack. Based on trending prediction market signals.`,
  });
  
  // Product 3: Premium item
  products.push({
    id: `${market.id}-product-3`,
    title: `${category.charAt(0).toUpperCase() + category.slice(1)} Premium ${productType}`,
    productType: productType,
    tags: [...keywords, 'premium', 'limited'],
    price: `$${(parseFloat(basePrice.replace('$', '')) * 1.5).toFixed(2)}`,
    description: `Premium ${productType.toLowerCase()} inspired by high-confidence market signals. Limited availability based on demand indicators.`,
  });
  
  return products;
}

// Generate AI Agent Plan
function generateAgentPlan(signal: DemandSignal): AgentPlan {
  const keywords = extractKeywords(signal.question);
  const category = keywords[0] || 'general';
  
  // Target Audience
  const audienceMap: { [key: string]: string } = {
    crypto: 'Crypto enthusiasts and trend followers',
    stocks: 'Finance-savvy consumers and investors',
    tech: 'Early adopters and tech enthusiasts',
    politics: 'Politically engaged consumers',
    economics: 'Economically aware shoppers',
    general: 'Trend-conscious consumers',
  };
  const targetAudience = audienceMap[category] || 'Trend-conscious consumers';
  
  // Recommended Bundle (pick first 2 products)
  const bundleProducts = signal.recommendedProducts.slice(0, 2);
  const bundlePrice = `$${(
    bundleProducts.reduce((sum, p) => sum + parseFloat(p.price.replace('$', '')), 0) * 0.85
  ).toFixed(2)}`;
  
  // Launch Timing
  const launchTiming = signal.market.endDate && 
    (new Date(signal.market.endDate).getTime() - Date.now()) < (60 * 24 * 60 * 60 * 1000)
    ? 'Rush drop'
    : 'Test drop';
  
  // Channel Recommendation
  const channelMap: { [key: string]: string } = {
    crypto: 'TikTok/IG',
    stocks: 'Email',
    tech: 'On-site banner',
    politics: 'Search ads',
    economics: 'Email',
    general: 'On-site banner',
  };
  const channelRecommendation = channelMap[category] || 'On-site banner';
  
  // Collection Name
  const collectionName = `${category.charAt(0).toUpperCase() + category.slice(1)} Trend Drops`;
  
  // Ad Copy (fallback, will be replaced by LLM if available)
  const headline = `Get Ready: ${signal.question.substring(0, 40)}...`;
  const description = `Join the trend with exclusive merch inspired by current market signals. Limited time offer.`;
  
  // Risk Check
  const questionLower = signal.question.toLowerCase();
  const avoidsTrademarks = !questionLower.includes('tesla') && 
                           !questionLower.includes('apple') && 
                           !questionLower.includes('bitcoin') &&
                           !questionLower.includes('ethereum');
  const usesGenericLanguage = questionLower.includes('trend') || 
                              questionLower.includes('signal') ||
                              questionLower.includes('market');
  
  return {
    targetAudience,
    recommendedBundle: {
      products: bundleProducts,
      bundlePrice,
    },
    launchTiming,
    channelRecommendation,
    collectionName,
    adCopy: {
      headline,
      description,
    },
    riskCheck: {
      avoidsTrademarks,
      usesGenericLanguage: usesGenericLanguage || avoidsTrademarks,
    },
  };
}

// Create demand signals from markets
function createDemandSignals(markets: Market[], boostedKeywords: { [key: string]: number }): DemandSignal[] {
  // Find max volume+liquidity for scaling
  const maxActivity = Math.max(
    ...markets.map(m => (m.volume || 0) + (m.liquidity || 0)),
    1 // Avoid division by zero
  );
  
  return markets.map(market => {
    const totalActivity = (market.volume || 0) + (market.liquidity || 0);
    // Scale confidence to 0-1 range, with minimum 0.3 for visibility
    const confidence = Math.max(0.3, Math.min(1.0, totalActivity / maxActivity));
    
    const keywords = extractKeywords(market.question);
    const hasBoostedKeywords = keywords.some(k => (boostedKeywords[k] || 0) > 0);
    
    return {
      id: market.id,
      question: market.question,
      confidence,
      why: generateWhyBullets(market, confidence, hasBoostedKeywords),
      recommendedProducts: generateRecommendedProducts(market),
      market,
    };
  });
}

export default function Dashboard() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [dataSource, setDataSource] = useState<'live' | 'fallback' | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [published, setPublished] = useState<PublishedProduct[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [confidenceFilter, setConfidenceFilter] = useState<number>(55); // Min confidence % (0-100)
  const [prefs, setPrefs] = useState<Preferences>({ confidence: 75, keywords: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set());
  const [agentCopyCache, setAgentCopyCache] = useState<Map<string, AgentPlan['adCopy']>>(new Map());
  const [loadingCopy, setLoadingCopy] = useState<Set<string>>(new Set());

  // Load data from localStorage on mount
  useEffect(() => {
    const loadFromStorage = () => {
      try {
        const draftsData = localStorage.getItem(STORAGE_KEYS.drafts);
        const publishedData = localStorage.getItem(STORAGE_KEYS.published);
        const eventsData = localStorage.getItem(STORAGE_KEYS.events);
        const prefsData = localStorage.getItem(STORAGE_KEYS.prefs);

        if (draftsData) {
          setDrafts(JSON.parse(draftsData));
        }
        if (publishedData) {
          setPublished(JSON.parse(publishedData));
        }
        if (eventsData) {
          setEvents(JSON.parse(eventsData));
        }
        if (prefsData) {
          const loadedPrefs: Preferences = JSON.parse(prefsData);
          setPrefs(loadedPrefs);
          setConfidenceFilter(loadedPrefs.confidence || 55);
        }
      } catch (err) {
        console.error('Error loading from localStorage:', err);
      }
    };

    loadFromStorage();
  }, []);

  // Fetch markets from API
  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/polymarket');
        if (!response.ok) {
          throw new Error('Failed to fetch markets');
        }
        const data: ApiResponse = await response.json();
        
        // Handle both old format (array) and new format (object)
        if (Array.isArray(data)) {
          setMarkets(data);
          setDataSource('fallback');
        } else {
          setMarkets(data.markets || []);
          setDataSource(data.source || 'fallback');
        }
        
        track('SIGNALS_LOADED', { count: Array.isArray(data) ? data.length : (data.markets?.length || 0), source: Array.isArray(data) ? 'fallback' : data.source });
      } catch (err) {
        setError('Unable to fetch signals. Using fallback data.');
        setDataSource('fallback');
        console.error('Error fetching markets:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMarkets();
  }, []);

  // Create demand signals from markets
  const demandSignals = useMemo(() => {
    return createDemandSignals(markets, prefs.keywords);
  }, [markets, prefs.keywords]);

  // Filter signals by confidence (min 0.55 = 55%)
  const filteredSignals = useMemo(() => {
    const minConfidence = confidenceFilter / 100;
    return demandSignals.filter(signal => signal.confidence >= minConfidence).slice(0, 20);
  }, [demandSignals, confidenceFilter]);

  // Get top learned signals (boosted keywords)
  const topLearnedSignals = useMemo(() => {
    return Object.entries(prefs.keywords)
      .filter(([_, score]) => score > 0)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 5)
      .map(([keyword, score]) => ({ keyword, score }));
  }, [prefs.keywords]);

  // Performance metrics
  const performanceMetrics = useMemo(() => {
    const draftsCreated = drafts.length + published.length;
    const publishedCount = published.length;
    const rejectedCount = drafts.filter(d => d.status === 'rejected').length;
    const publishRate = draftsCreated > 0 ? Math.round((publishedCount / draftsCreated) * 100) : 0;
    
    return {
      draftsCreated,
      publishedCount,
      rejectedCount,
      publishRate,
    };
  }, [drafts, published]);

  // Check if product is already drafted (check both drafts AND published)
  const isProductDrafted = (productKey: string): boolean => {
    // Check drafts (excluding rejected)
    if (drafts.some(d => d.productKey === productKey && d.status !== 'rejected')) {
      return true;
    }
    // Check published items
    if (published.some(p => p.productKey === productKey)) {
      return true;
    }
    return false;
  };

  // Save to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.drafts, JSON.stringify(drafts));
    } catch (err) {
      console.error('Error saving drafts:', err);
    }
  }, [drafts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.published, JSON.stringify(published));
    } catch (err) {
      console.error('Error saving published:', err);
    }
  }, [published]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.events, JSON.stringify(events));
    } catch (err) {
      console.error('Error saving events:', err);
    }
  }, [events]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify(prefs));
    } catch (err) {
      console.error('Error saving preferences:', err);
    }
  }, [prefs]);

  const addEvent = (type: Event['type'], message: string) => {
    const newEvent: Event = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type,
      message,
      timestamp: new Date().toISOString(),
    };
    setEvents((prev) => [newEvent, ...prev]);
  };

  const updateKeywords = (question: string, tags: string[], boost: boolean) => {
    const keywords = extractKeywords(question);
    const allKeywords = [...keywords, ...tags];
    const uniqueKeywords = Array.from(new Set(allKeywords));
    
    const boosted: string[] = [];
    const downranked: string[] = [];
    
    setPrefs(prev => {
      const newKeywords = { ...prev.keywords };
      uniqueKeywords.forEach(keyword => {
        const oldValue = newKeywords[keyword] || 0;
        newKeywords[keyword] = oldValue + (boost ? 1 : -1);
        if (boost) {
          boosted.push(keyword);
        } else {
          downranked.push(keyword);
        }
      });
      track('PREFS_UPDATED', { boosted, downranked });
      return { ...prev, keywords: newKeywords };
    });
  };

  const handleCreateDraft = (signal: DemandSignal, product: RecommendedProduct) => {
    const productKey = generateProductKey(signal.id, product.productType, product.title);
    
    // Check for duplicates
    if (isProductDrafted(productKey)) {
      addEvent('draft_generated', `Skipped duplicate draft: "${product.title}"`);
      track('DRAFT_SKIPPED_DUPLICATE', { productKey, marketId: signal.id, productType: product.productType });
      return;
    }

    const newDraft: Draft = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      title: product.title,
      productType: product.productType,
      tags: product.tags,
      price: product.price,
      description: product.description,
      confidence: Math.round(signal.confidence * 100),
      createdAt: new Date().toISOString(),
      signalId: signal.id,
      productKey,
      status: 'draft',
    };

    setDrafts((prev) => [...prev, newDraft]);
    addEvent('draft_generated', `Created Shopify draft: "${product.title}"`);
    track('DRAFT_CREATED', { productKey, marketId: signal.id, productType: product.productType, price: product.price });
  };

  const handlePublish = (draftId: string) => {
    const draft = drafts.find((d) => d.id === draftId);
    if (!draft) return;

    const product: PublishedProduct = {
      id: draft.id,
      title: draft.title,
      productType: draft.productType,
      tags: draft.tags,
      price: draft.price,
      description: draft.description,
      publishedAt: new Date().toISOString(),
      productKey: draft.productKey,
    };

    setPublished((prev) => [...prev, product]);
    setDrafts((prev) => prev.map(d => d.id === draftId ? { ...d, status: 'published' as const } : d));
    updateKeywords(draft.title + ' ' + draft.description, draft.tags, true);
    addEvent('published', `Published: "${draft.title}"`);
    track('DRAFT_PUBLISHED', { productKey: draft.productKey, marketId: draft.signalId });
  };

  const handleReject = (draftId: string) => {
    const draft = drafts.find((d) => d.id === draftId);
    if (!draft) return;

    setDrafts((prev) => prev.map(d => d.id === draftId ? { ...d, status: 'rejected' as const } : d));
    updateKeywords(draft.title + ' ' + draft.description, draft.tags, false);
    addEvent('rejected', `Rejected: "${draft.title}"`);
    track('DRAFT_REJECTED', { productKey: draft.productKey, marketId: draft.signalId });
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all demo data? This cannot be undone.')) {
      localStorage.removeItem(STORAGE_KEYS.drafts);
      localStorage.removeItem(STORAGE_KEYS.published);
      localStorage.removeItem(STORAGE_KEYS.events);
      localStorage.removeItem(STORAGE_KEYS.prefs);
      setDrafts([]);
      setPublished([]);
      setEvents([]);
      setPrefs({ confidence: 75, keywords: {} });
      setConfidenceFilter(55);
      addEvent('draft_generated', 'Demo data reset');
    }
  };

  const toggleAgentPlan = (signalId: string) => {
    setExpandedPlans(prev => {
      const newSet = new Set(prev);
      if (newSet.has(signalId)) {
        newSet.delete(signalId);
      } else {
        newSet.add(signalId);
        const signal = demandSignals.find(s => s.id === signalId);
        if (signal) {
          track('AGENT_PLAN_VIEWED', { marketId: signal.market.id });
          // Lazy-load LLM copy if not cached
          loadAgentCopy(signal);
        }
      }
      return newSet;
    });
  };

  // Load agent copy from API (with caching)
  const loadAgentCopy = async (signal: DemandSignal) => {
    if (agentCopyCache.has(signal.id) || loadingCopy.has(signal.id)) {
      return; // Already loaded or loading
    }

    setLoadingCopy(prev => new Set(prev).add(signal.id));

    try {
      const topKeywords = topLearnedSignals.map(s => s.keyword).slice(0, 5);
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market: signal.market,
          recommendedProducts: signal.recommendedProducts,
          prefsTopKeywords: topKeywords,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.ok) {
          setAgentCopyCache(prev => {
            const newMap = new Map(prev);
            newMap.set(signal.id, {
              headline: data.headline,
              description: data.description,
              whyBundle: data.whyBundle,
            });
            return newMap;
          });
          track('AGENT_COPY_GENERATED', { marketId: signal.market.id, source: data.source });
        }
      }
    } catch (err) {
      console.warn('Failed to load agent copy:', err);
    } finally {
      setLoadingCopy(prev => {
        const newSet = new Set(prev);
        newSet.delete(signal.id);
        return newSet;
      });
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2 flex-wrap">
            <h1 className="text-4xl font-bold text-black dark:text-zinc-50">
              Signal2Store Dashboard
            </h1>
            {dataSource && (
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  dataSource === 'live'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                    : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                }`}
              >
                Data source: {dataSource === 'live' ? 'Live' : 'Fallback'}
              </span>
            )}
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                isAmplitudeEnabled()
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
            >
              Amplitude: {isAmplitudeEnabled() ? 'enabled' : 'disabled'}
            </span>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400">
            Use prediction market signals to discover trending products for your Shopify store
          </p>
        </div>

        {/* Performance Summary */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-4">Performance</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Drafts Created</p>
              <p className="text-2xl font-bold text-black dark:text-zinc-50">{performanceMetrics.draftsCreated}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Published</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{performanceMetrics.publishedCount}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Rejected</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{performanceMetrics.rejectedCount}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Publish Rate</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{performanceMetrics.publishRate}%</p>
            </div>
          </div>
          {topLearnedSignals.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">Top Boosted Keywords:</p>
              <div className="flex flex-wrap gap-2">
                {topLearnedSignals.map(({ keyword, score }) => (
                  <span
                    key={keyword}
                    className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded text-xs font-medium"
                  >
                    {keyword} (+{score})
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
            Recommendations are re-ranked based on your publish/reject behavior.
          </p>
        </div>

        {/* Confidence Filter Slider */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm p-6 mb-6">
          <label className="block text-sm font-medium text-black dark:text-zinc-50 mb-2">
            Minimum Confidence Filter: {confidenceFilter}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={confidenceFilter}
            onChange={(e) => {
              const value = Number(e.target.value);
              setConfidenceFilter(value);
              setPrefs(prev => ({ ...prev, confidence: value }));
            }}
            className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Showing {filteredSignals.length} of {demandSignals.length} demand signals
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-yellow-800 dark:text-yellow-200">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="mb-6 p-4 text-zinc-600 dark:text-zinc-400">
            Loading demand signals...
          </div>
        )}

        {/* Demand Signals Section */}
        {!loading && filteredSignals.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-black dark:text-zinc-50 mb-6">
              Demand Signals ({filteredSignals.length})
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredSignals.map((signal) => {
                const baseAgentPlan = generateAgentPlan(signal);
                const cachedCopy = agentCopyCache.get(signal.id);
                const agentPlan: AgentPlan = {
                  ...baseAgentPlan,
                  adCopy: cachedCopy || baseAgentPlan.adCopy,
                };
                const isPlanExpanded = expandedPlans.has(signal.id);
                const isLoadingCopy = loadingCopy.has(signal.id);
                
                return (
                  <div
                    key={signal.id}
                    className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-lg font-semibold text-black dark:text-zinc-50 flex-1 pr-4">
                        {signal.question}
                      </h3>
                      <div className="flex-shrink-0">
                        <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium">
                          {Math.round(signal.confidence * 100)}%
                        </span>
                      </div>
                    </div>

                    {/* Why bullets */}
                    <div className="mb-4">
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Why this signal:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                        {signal.why.map((bullet, idx) => (
                          <li key={idx}>{bullet}</li>
                        ))}
                      </ul>
                    </div>

                    {/* AI Agent Plan */}
                    <div className="mb-4">
                      <button
                        onClick={() => toggleAgentPlan(signal.id)}
                        className="w-full text-left p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-black dark:text-zinc-50">
                            AI Agent Plan
                          </span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {isPlanExpanded ? '▼' : '▶'}
                          </span>
                        </div>
                      </button>
                      {isPlanExpanded && (
                        <div className="mt-2 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg space-y-3 text-sm">
                          <div>
                            <p className="font-medium text-zinc-600 dark:text-zinc-400 mb-1">Target Audience:</p>
                            <p className="text-zinc-700 dark:text-zinc-300">{agentPlan.targetAudience}</p>
                          </div>
                          <div>
                            <p className="font-medium text-zinc-600 dark:text-zinc-400 mb-1">Recommended Bundle:</p>
                            <ul className="list-disc list-inside text-zinc-700 dark:text-zinc-300 mb-1">
                              {agentPlan.recommendedBundle.products.map((p, idx) => (
                                <li key={idx}>{p.title}</li>
                              ))}
                            </ul>
                            <p className="text-zinc-700 dark:text-zinc-300 font-medium">
                              Bundle Price: {agentPlan.recommendedBundle.bundlePrice}
                            </p>
                          </div>
                          <div>
                            <p className="font-medium text-zinc-600 dark:text-zinc-400 mb-1">Launch Timing:</p>
                            <p className="text-zinc-700 dark:text-zinc-300">{agentPlan.launchTiming}</p>
                          </div>
                          <div>
                            <p className="font-medium text-zinc-600 dark:text-zinc-400 mb-1">Channel Recommendation:</p>
                            <p className="text-zinc-700 dark:text-zinc-300">{agentPlan.channelRecommendation}</p>
                          </div>
                          <div>
                            <p className="font-medium text-zinc-600 dark:text-zinc-400 mb-1">Collection Name:</p>
                            <p className="text-zinc-700 dark:text-zinc-300">{agentPlan.collectionName}</p>
                          </div>
                          <div>
                            <p className="font-medium text-zinc-600 dark:text-zinc-400 mb-1">Ad Copy:</p>
                            {isLoadingCopy ? (
                              <p className="text-zinc-500 dark:text-zinc-400 text-xs">Generating copy...</p>
                            ) : (
                              <>
                                <p className="text-zinc-700 dark:text-zinc-300 font-semibold mb-1">{agentPlan.adCopy.headline}</p>
                                <p className="text-zinc-700 dark:text-zinc-300 mb-1">{agentPlan.adCopy.description}</p>
                                {agentPlan.adCopy.whyBundle && (
                                  <p className="text-zinc-600 dark:text-zinc-400 text-xs italic">{agentPlan.adCopy.whyBundle}</p>
                                )}
                              </>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-zinc-600 dark:text-zinc-400 mb-1">Risk Check:</p>
                            <div className="space-y-1">
                              <p className="text-zinc-700 dark:text-zinc-300">
                                {agentPlan.riskCheck.avoidsTrademarks ? '✓' : '✗'} Avoids trademarks
                              </p>
                              <p className="text-zinc-700 dark:text-zinc-300">
                                {agentPlan.riskCheck.usesGenericLanguage ? '✓' : '✗'} Uses generic trend language
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Recommended Merch Drops */}
                    <div className="mb-4">
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-3">Recommended Merch Drops:</p>
                      <div className="space-y-3">
                        {signal.recommendedProducts.map((product) => {
                          const productKey = generateProductKey(signal.id, product.productType, product.title);
                          const isDrafted = isProductDrafted(productKey);
                          
                          return (
                            <div
                              key={product.id}
                              className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <h4 className="font-medium text-black dark:text-zinc-50 text-sm mb-1">{product.title}</h4>
                                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">{product.productType}</p>
                                </div>
                                <span className="ml-2 font-semibold text-black dark:text-zinc-50 text-sm">
                                  {product.price}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mb-2">
                                {product.tags.slice(0, 3).map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded text-xs"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                              <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-2">
                                {product.description}
                              </p>
                              {isDrafted && (
                                <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-2">Already drafted</p>
                              )}
                              <button
                                onClick={() => handleCreateDraft(signal, product)}
                                disabled={isDrafted}
                                className={`w-full px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                  isDrafted
                                    ? 'bg-zinc-300 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 cursor-not-allowed'
                                    : 'bg-black dark:bg-zinc-50 text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200'
                                }`}
                              >
                                {isDrafted ? 'Drafted' : 'Create Shopify Draft'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Draft Products Section */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-4">
            Draft Products ({drafts.filter(d => d.status === 'draft').length})
          </h2>
          {drafts.filter(d => d.status === 'draft').length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400">No draft products yet. Create a draft from a recommended product above.</p>
          ) : (
            <div className="space-y-4">
              {drafts.filter(d => d.status === 'draft').map((draft) => (
                <div
                  key={draft.id}
                  className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="text-black dark:text-zinc-50 mb-1 font-medium">{draft.title}</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">{draft.productType}</p>
                      <div className="flex items-center gap-2 mb-2">
                        {draft.tags.slice(0, 3).map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                        <span className="ml-auto font-semibold text-black dark:text-zinc-50">
                          {draft.price}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      Confidence: {draft.confidence}%
                    </span>
                    <div className="flex gap-2 ml-auto">
                      <button
                        onClick={() => handlePublish(draft.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-medium"
                      >
                        Publish
                      </button>
                      <button
                        onClick={() => handleReject(draft.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Published Products Count */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-2">
            Published Products ({published.length})
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            View all published products on the{' '}
            <a href="/store" className="text-blue-600 dark:text-blue-400 hover:underline">
              View Storefront
            </a>
            .
          </p>
        </div>

        {/* Event Log */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-4">
            Event Log ({events.length})
          </h2>
          {events.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400">No events yet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded text-sm"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        event.type === 'published'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                          : event.type === 'rejected'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                      }`}
                    >
                      {event.type.toUpperCase()}
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400 text-xs">
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-zinc-700 dark:text-zinc-300">{event.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reset Button */}
        <div className="mb-6">
          <button
            onClick={handleReset}
            className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            Reset Demo Data
          </button>
        </div>
      </div>
    </div>
  );
}
