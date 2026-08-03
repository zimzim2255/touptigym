// Helper to fetch ALL rows from a Supabase query (handles pagination)
export async function fetchAll(query: any, orderBy: string): Promise<any[]> {
  const PAGE_SIZE = 1000
  const all: any[] = []
  let from = 0
  let to = PAGE_SIZE - 1

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await query
      .order(orderBy, { ascending: true })
      .range(from, to)

    if (error) throw error
    if (!data || data.length === 0) break

    all.push(...data)
    if (data.length < PAGE_SIZE) break

    from += PAGE_SIZE
    to += PAGE_SIZE
  }

  return all
}