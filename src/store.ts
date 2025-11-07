export interface Transaction {
  set: (node: TreeNode) => void;
  delete: (nodeId: string) => void;
}

export interface TreeNode {
  nodeId: string;
  parentId: string | undefined;
  index: string;
  meta?: undefined;
}

export const compareTreeNodes = (a: TreeNode, b: TreeNode) => {
  if (a.index < b.index) {
    return -1;
  }
  if (a.index > b.index) {
    return 1;
  }
  return 0;
};

export class TreeStore {
  #nodes = new Map<string, TreeNode>();
  #subscribers = new Set<() => void>();

  transact(callback: (tx: Transaction) => void): void {
    callback({
      set: (node) => {
        this.#nodes.set(node.nodeId, node);
      },
      delete: (nodeId): void => {
        this.#nodes.delete(nodeId);
      },
    });
    this.#notify();
  }

  values(): TreeNode[] {
    return Array.from(this.#nodes.values());
  }

  getChildren(nodeId: string | undefined): TreeNode[] {
    return Array.from(this.#nodes.values())
      .filter((node) => node.parentId === nodeId)
      .sort(compareTreeNodes);
  }

  subscribe(callback: () => void): () => void {
    this.#subscribers.add(callback);
    return () => {
      this.#subscribers.delete(callback);
    };
  }

  #notify(): void {
    this.#subscribers.forEach((callback) => callback());
  }
}
