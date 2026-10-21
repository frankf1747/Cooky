// Which catalog rows a seed should remove: ids in the database that the CSV no longer lists.
// Upsert alone never deletes, so a renamed or dropped product would keep its old price forever.

/** Ids in `dbIds` that are not in `csvIds`, in database order. An empty CSV is refused, never "delete all". */
export function staleIds(dbIds: string[], csvIds: string[]): string[] {
  if (csvIds.length === 0) throw new Error("seed: the CSV is empty; refusing to prune every row");
  const keep = new Set(csvIds);
  return dbIds.filter((id) => !keep.has(id));
}
