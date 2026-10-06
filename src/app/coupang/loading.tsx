export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-4 h-6 w-32 rounded bg-gray-200 dark:bg-gray-800" />
      <div className="mb-5 flex gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-16 rounded-full bg-gray-200 dark:bg-gray-800" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i}>
            <div className="aspect-square rounded-xl bg-gray-200 dark:bg-gray-800" />
            <div className="mt-2 h-3 w-full rounded bg-gray-200 dark:bg-gray-800" />
            <div className="mt-1 h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-800" />
          </div>
        ))}
      </div>
    </div>
  );
}
