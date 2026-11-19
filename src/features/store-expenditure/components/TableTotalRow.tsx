import type { ReactNode } from 'react'

export function TableTotalRow({ cells }: { cells: ReactNode[] }) {
  return <tfoot className="store-table-total"><tr>{cells.map((cell, index) => <td key={index}>{cell}</td>)}</tr></tfoot>
}
