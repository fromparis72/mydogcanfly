// TEMPORARY build-sharding helper.
// Lets the large static build run in smaller passes to fit sandbox time limits.
// No effect on a normal build (env vars unset) → returns all paths unchanged.
//   BUILD_ONLY   : if set, only the matching route group emits pages (others → [])
//   BUILD_SHARDS : total number of shards (default 1)
//   BUILD_SHARD  : this pass's shard index, 0-based (default 0)
export function shardPaths<T>(name: string, paths: T[]): T[] {
  const env = (globalThis as any).process?.env ?? {};
  const only = env.BUILD_ONLY;
  if (only && only !== name) return [];
  const shards = Number(env.BUILD_SHARDS ?? "1");
  const shard = Number(env.BUILD_SHARD ?? "0");
  if (!Number.isFinite(shards) || shards <= 1) return paths;
  return paths.filter((_, i) => i % shards === shard);
}
