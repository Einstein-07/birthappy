export default function Loading() {
  return (
    <div className="loading-page" aria-label="正在加载">
      <span className="loading-page__cake" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <p>正在把今天摆上桌…</p>
    </div>
  );
}
