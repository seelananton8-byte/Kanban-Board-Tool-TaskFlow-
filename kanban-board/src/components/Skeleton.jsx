export function BoardsSkeleton() {
  return (
    <div className="board-grid" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="board-tile skeleton-tile">
          <span className="sk sk-icon" />
          <span className="sk sk-line sk-w60" />
          <span className="sk sk-line sk-w40" />
        </div>
      ))}
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div className="board-page" aria-busy="true">
      <header className="board-head">
        <div>
          <span className="sk sk-title" />
          <span className="sk sk-line sk-w40" />
        </div>
      </header>
      <div className="board-scroll">
        <div className="kanban-board">
          {[3, 2, 1, 2].map((n, i) => (
            <div key={i} className="kanban-column">
              <span className="sk sk-line sk-w50" />
              {Array.from({ length: n }).map((_, j) => <div key={j} className="sk sk-card" />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}