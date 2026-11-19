export function StockStatusBadge({ low }: { low: boolean }) {
  return <span className={`store-stock-badge ${low ? 'is-low' : 'is-ok'}`}>{low ? 'Low Stock' : 'OK'}</span>
}
