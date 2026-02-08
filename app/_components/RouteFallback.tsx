export default function RouteFallback() {
  return (
    <div style={{ padding: 16 }} aria-busy="true" aria-live="polite">
      불러오는 중...
    </div>
  );
}
