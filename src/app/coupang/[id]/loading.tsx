export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-3 h-3 w-32 rounded bg-gray-200 dark:bg-gray-800" />
      <div className="mb-6 grid gap-5 md:grid-cols-2">
        <div className="aspect-square rounded-xl bg-gray-200 dark:bg-gray-800" />
        <div className="space-y-3">
          <div className="h-5 w-16 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-7 w-3/4 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-9 w-40 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-gray-200 dark:bg-gray-800" />
            ))}
          </div>
          <div className="h-11 w-full rounded-lg bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>
      <div className="h-48 rounded-2xl bg-gray-200 dark:bg-gray-800" />
    </div>
  );
}
