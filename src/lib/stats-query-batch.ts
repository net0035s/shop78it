/** Keep dashboard fan-out within the database pool instead of opening 24 queries at once. */
export async function statsQueryBatch<T extends unknown[]>(tasks: { [K in keyof T]: () => PromiseLike<T[K]> }, concurrency = 2): Promise<T> {
  const values: unknown[] = []
  for (let start = 0; start < tasks.length; start += concurrency) values.push(...await Promise.all(tasks.slice(start, start + concurrency).map(task => task())))
  return values as T
}
