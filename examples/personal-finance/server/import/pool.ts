// A bounded pool: do the work for each item, but not more than `limit` at the same time.
// The results come back in the sequence of the items, not in the sequence in which the work ended.
// A worker must not throw; if it does, the pool stops and the error goes up.

export async function mapPool<T, R>(items: readonly T[], limit: number, work: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function lane(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1; // no await between the read and the write of `next`: two lanes cannot take the same item
      results[index] = await work(items[index]!, index);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, lane));
  return results;
}
