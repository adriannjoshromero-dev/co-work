export default function Loading() {
  return (
    <main className="shell" aria-busy="true" aria-label="Loading your workspace">
      <div className="skeleton skeleton-header" />
      <div className="skeleton skeleton-hero" />
      <div className="card-grid">
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
      </div>
    </main>
  );
}
