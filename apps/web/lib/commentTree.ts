// Immutable helpers for the forum comment tree.
//
// The API has always returned comments nested (each node carries `children`);
// the client used to render only the root array, which meant a reply existed in
// the database and was invisible on screen. These keep the nested shape intact
// through voting, replying and deleting so state edits never flatten it.

export type TreeNode<T> = T & { id: string; children: TreeNode<T>[] };

/** The API rejects a reply whose parent is already this deep (COMMENT_MAX_DEPTH
 *  in apps/api/src/routes/forum.ts). Kept in sync by hand: the alternative is a
 *  round trip that fails only after someone has typed a paragraph. */
export const MAX_DEPTH = 8;

/** Past this level the conversation keeps nesting but stops eating the column —
 *  eight indents at 22px would leave a phone with nothing to read. */
export const INDENT_CAP = 5;

/** Total nodes in a forest, so a collapsed comment can say what it is hiding. */
export function treeCount<T>(nodes: TreeNode<T>[]): number {
  let n = 0;
  for (const c of nodes) n += 1 + treeCount(c.children || []);
  return n;
}

/** Replace one node anywhere in the tree, leaving every other branch identical. */
export function treeMap<T>(
  nodes: TreeNode<T>[],
  id: string,
  fn: (n: TreeNode<T>) => TreeNode<T>,
): TreeNode<T>[] {
  return nodes.map((n) => {
    if (n.id === id) return fn(n);
    const kids = n.children || [];
    if (!kids.length) return n;
    const next = treeMap(kids, id, fn);
    return next === kids ? n : { ...n, children: next };
  });
}

/** Add a reply under its parent, or at the root when parentId is null.
 *  Appended rather than sorted in: a comment that jumps somewhere else the
 *  instant you post it reads as though it failed. */
export function treeInsert<T>(
  nodes: TreeNode<T>[],
  parentId: string | null,
  node: TreeNode<T>,
): TreeNode<T>[] {
  if (!parentId) return [...nodes, node];
  return nodes.map((n) => {
    if (n.id === parentId) return { ...n, children: [...(n.children || []), node] };
    const kids = n.children || [];
    if (!kids.length) return n;
    return { ...n, children: treeInsert(kids, parentId, node) };
  });
}

/** Drop a node and everything under it. Returns the new forest and how many
 *  comments went with it, because deleting a comment with replies decrements the
 *  post's count by more than one. */
export function treeRemove<T>(
  nodes: TreeNode<T>[],
  id: string,
): { nodes: TreeNode<T>[]; removed: number } {
  let removed = 0;
  const out: TreeNode<T>[] = [];
  for (const n of nodes) {
    if (n.id === id) {
      removed += 1 + treeCount(n.children || []);
      continue;
    }
    const kids = n.children || [];
    if (kids.length) {
      const r = treeRemove(kids, id);
      removed += r.removed;
      out.push(r.removed ? { ...n, children: r.nodes } : n);
    } else {
      out.push(n);
    }
  }
  return { nodes: out, removed };
}
