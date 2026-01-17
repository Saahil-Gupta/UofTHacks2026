import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black">
        <div className="flex flex-col items-center gap-8 text-center">
          <h1 className="text-5xl font-bold leading-tight tracking-tight text-black dark:text-zinc-50">
            Signal2Store
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Transform market signals into storefront products. Manage opportunities, generate drafts, and publish to your store.
          </p>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row mt-8">
          <Link
            href="/dashboard"
            className="flex h-14 w-full items-center justify-center rounded-full bg-black dark:bg-zinc-50 text-white dark:text-black px-8 transition-colors hover:bg-zinc-800 dark:hover:bg-zinc-200 sm:w-auto"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/store"
            className="flex h-14 w-full items-center justify-center rounded-full border-2 border-solid border-black dark:border-zinc-50 px-8 transition-colors hover:bg-black hover:text-white dark:hover:bg-zinc-50 dark:hover:text-black sm:w-auto"
          >
            View Store
          </Link>
        </div>
      </main>
    </div>
  );
}
