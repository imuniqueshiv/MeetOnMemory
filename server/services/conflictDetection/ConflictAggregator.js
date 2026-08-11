// ==============================================
// 📘 ConflictAggregator.js
// Scans a list of active memories pairwise for contradictions and groups
// the results into conflict clusters, reusing the union-find approach
// from MemoryAggregator.js (Memory Consolidation) so transitively-linked
// conflicts (A contradicts B, B contradicts C) surface as one review set
// instead of two overlapping ones.
// ==============================================

import { detectContradiction } from "./ContradictionAnalyzer.js";

class DisjointSet {
  constructor(ids) {
    this.parent = new Map(ids.map((id) => [id, id]));
  }

  find(id) {
    let root = id;
    while (this.parent.get(root) !== root) root = this.parent.get(root);
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
 * Runs pairwise contradiction analysis across every candidate pair in
 * `records` and groups the ones that conflict into clusters.
 *
 * Returns `{ clusters, pairwiseByCluster }` where `clusters` is an array
 * of record arrays (2+ members each) and `pairwiseByCluster` maps the
 * same index to the list of pairwise conflict results that justified the
 * grouping, for storage on the ConflictSet document.
 *
 * O(n^2) pairwise comparisons, same complexity class and same
 * organization-scoped/limited-population assumption as
 * buildDuplicateClusters — the knowledge graph is a workspace's decisions
 * and action items, not the whole database.
 */
export async function buildConflictClusters(records, options = {}) {
  const ids = records.map((r) => r._id.toString());
  const dsu = new DisjointSet(ids);
  const byId = new Map(records.map((r) => [r._id.toString(), r]));
  const pairwiseResults = [];

  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i];
      const b = records[j];
      const result = await detectContradiction(a, b, options);
      if (result.isContradiction) {
        dsu.union(a._id.toString(), b._id.toString());
        pairwiseResults.push({
          memberA: a._id,
          memberB: b._id,
          ...result,
        });
      }
    }
  }

  const groups = dsu.groups().filter((group) => group.length > 1);
  const clusters = groups.map((group) => group.map((id) => byId.get(id)));

  const pairwiseByCluster = clusters.map((cluster) => {
    const memberSet = new Set(cluster.map((r) => r._id.toString()));
    return pairwiseResults.filter(
      (p) =>
        memberSet.has(p.memberA.toString()) &&
        memberSet.has(p.memberB.toString()),
    );
  });

  return { clusters, pairwiseByCluster };
}

/**
 * Fetches active (non-superseded) memories as contradiction-scan input.
 * Superseded records are excluded — they've already been folded into a
 * canonical memory by Consolidation, so flagging them separately would
 * just create noise pointing at a record nobody reads anymore.
 */
export async function fetchMemoriesForConflictScan(Model, organization) {
  return Model.find({
    organization: organization || null,
    supersededByMemory: null,
  });
}
