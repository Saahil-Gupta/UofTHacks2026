'use client';

import { useState, useEffect } from 'react';

interface PublishedProduct {
  id: string;
  title: string;
  productType: string;
  tags: string[];
  price: string;
  description: string;
  publishedAt: string;
}

export default function Store() {
  const [products, setProducts] = useState<PublishedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const publishedData = localStorage.getItem('s2s_published_v1');
      if (publishedData) {
        setProducts(JSON.parse(publishedData));
      }
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
        <p className="text-zinc-600 dark:text-zinc-400">Loading storefront...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-black dark:text-zinc-50 mb-2">
            Storefront
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Browse your published products
          </p>
        </div>

        {products.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm p-12 text-center">
            <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-4">
              No products available yet.
            </p>
            <p className="text-zinc-500 dark:text-zinc-500 mb-6">
              Publish products from the dashboard to see them here.
            </p>
            <a
              href="/dashboard"
              className="inline-block px-6 py-3 bg-black dark:bg-zinc-50 text-white dark:text-black rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              Go to Dashboard
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="mb-3">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    {product.productType}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-black dark:text-zinc-50 mb-2 flex-1">
                  {product.title}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 line-clamp-3 flex-1">
                  {product.description}
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {product.tags.slice(0, 4).map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-zinc-200 dark:border-zinc-700">
                  <span className="text-2xl font-bold text-black dark:text-zinc-50">
                    {product.price}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {new Date(product.publishedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <a
            href="/dashboard"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
