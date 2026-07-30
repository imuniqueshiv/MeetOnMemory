/**
 * Line-oriented text diff for policy version comparison.
 * Uses LCS for readable hunks; truncates oversized documents.
 */

const DEFAULT_MAX_LINES = 8000;

/**
 * @param {string} oldText
 * @param {string} newText
 * @param {{ maxLines?: number }} [options]
 * @returns {{
 *   rows: Array<{
 *     type: 'equal' | 'add' | 'remove',
 *     left: string | null,
 *     right: string | null,
 *     leftLine: number | null,
 *     rightLine: number | null,
 *   }>,
 *   stats: { added: number, removed: number, unchanged: number },
 *   truncated: boolean,
 * }}
 */
export function computeLineDiff(oldText = "", newText = "", options = {}) {
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
  let oldLines = String(oldText).split(/\r?\n/);
  let newLines = String(newText).split(/\r?\n/);
  let truncated = false;

  if (oldLines.length > maxLines || newLines.length > maxLines) {
    truncated = true;
    oldLines = oldLines.slice(0, maxLines);
    newLines = newLines.slice(0, maxLines);
  }

  const n = oldLines.length;
  const m = newLines.length;

  // LCS lengths
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const rows = [];
  let i = 0;
  let j = 0;
  let leftLine = 1;
  let rightLine = 1;
  let added = 0;
  let removed = 0;
  let unchanged = 0;

  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      rows.push({
        type: "equal",
        left: oldLines[i],
        right: newLines[j],
        leftLine: leftLine++,
        rightLine: rightLine++,
      });
      unchanged++;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({
        type: "remove",
        left: oldLines[i],
        right: null,
        leftLine: leftLine++,
        rightLine: null,
      });
      removed++;
      i++;
    } else {
      rows.push({
        type: "add",
        left: null,
        right: newLines[j],
        leftLine: null,
        rightLine: rightLine++,
      });
      added++;
      j++;
    }
  }

  while (i < n) {
    rows.push({
      type: "remove",
      left: oldLines[i++],
      right: null,
      leftLine: leftLine++,
      rightLine: null,
    });
    removed++;
  }

  while (j < m) {
    rows.push({
      type: "add",
      left: null,
      right: newLines[j++],
      leftLine: null,
      rightLine: rightLine++,
    });
    added++;
  }

  return {
    rows,
    stats: { added, removed, unchanged },
    truncated,
  };
}
