type Props = {
  cards?: number;
};

export default function PageSkeleton({ cards = 4 }: Props) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8" aria-busy="true" aria-label="Ачаалж байна">
      <div className="h-8 w-52 animate-pulse rounded-lg bg-gray-200" />
      <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded bg-gray-100" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }, (_, index) => (
          <div key={index} className="overflow-hidden rounded-2xl border bg-white p-3 shadow-sm">
            <div className="aspect-[4/3] animate-pulse rounded-xl bg-gray-100" />
            <div className="mt-4 h-5 w-2/3 animate-pulse rounded bg-gray-200" />
            <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </main>
  );
}
