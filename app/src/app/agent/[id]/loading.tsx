export default function Loading() {
  return (
    <main className="min-h-screen py-20 lg:py-32">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="space-y-8">
          <div className="h-12 skeleton w-1/2" />
          <div className="h-6 skeleton w-3/4" />
          <div className="grid grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 skeleton" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
