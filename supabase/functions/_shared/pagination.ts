// ─── Pagination helper ──────────────────────────────────────────────────────
// Supabase returns a maximum of 1000 rows per query. This helper fetches ALL
// rows by paginating through the result set in chunks of 1000.
// Usage:
//   const allRows = await fetchAll(query, 'created_at')
// where `query` is a Supabase query builder (e.g. supabase.from('children').select('*'))

export async function fetchAll(
  query: any,
  orderColumn: string = 'created_at',
  pageSize: number = 1000
): Promise<any[]> {
  const all: any[] = []
  let from = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await query
      .order(orderColumn, { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw error
    if (!data || data.length === 0) {
      hasMore = false
      break
    }

    all.push(...data)
    from += data.length

    // If we got fewer rows than the page size, we've reached the end
    if (data.length < pageSize) {
      hasMore = false
    }
  }

  return all
}