import { areMemoriesSimilar } from "./Consolidationaiprocessor.js";

// ------------------------------------------------------------------
// Union-Find (Disjoint Set) — groups records into duplicate clusters
// ------------------------------------------------------------------
class DisjointSet {
  constructor(ids) {
    this.parent = new Map(ids.map((id) => [id, id]));
  }

  find(id) {
    let root = id;
    while (this.parent.get(root) !== root) root = this.parent.get(root);
    // Path compression
    let curr = id;
    while (this.parent.get(curr) !== root) {
      const next = this.parent.get(curr);
      this.parent.set(curr, root);
      curr = next;
    }
    return root;
  }

  union(a, b) {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootB, rootA);
  }

  groups() {
    const clusters = new Map();
    for (const id of this.parent.keys()) {
      const root = this.find(id);
      if (!clusters.has(root)) clusters.set(root, []);
      clusters.get(root).push(id);
    }
    return [...clusters.values()];
  }
}

/**
 * Groups a flat list of memory records into duplicate/paraphrase clusters.
 * Only clusters with 2+ members represent actual consolidation work.
 */
export function buildDuplicateClusters(records, options = {}) {
  const ids = records.map((r) => r._id.toString());
  const dsu = new DisjointSet(ids);
  const byId = new Map(records.map((r) => [r._id.toString(), r]));

  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i];
      const b = records[j];
      const { isDuplicate } = areMemoriesSimilar(a, b, options);
      if (isDuplicate) {
        dsu.union(a._id.toString(), b._id.toString());
      }
    }
  }

  return dsu
    .groups()
    .filter((group) => group.length > 1)
    .map((group) => group.map((id) => byId.get(id)));
}

/**
 * Fetches active, still-canonical memories as clustering input.
 */
export async function fetchMemoriesForConsolidation(Model, organization) {
  return Model.find({
    organization: organization || null,
    supersededByMemory: null,
  });
}
