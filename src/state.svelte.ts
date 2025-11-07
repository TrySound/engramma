import { createSubscriber } from "svelte/reactivity";
import { TreeStore, type Transaction, type TreeNode } from "./store";

export class TreeState {
  #store = new TreeStore();
  #subscribe = createSubscriber((update) => this.#store.subscribe(update));

  transact(callback: (tx: Transaction) => void): void {
    this.#store.transact(callback);
  }

  values(): TreeNode[] {
    this.#subscribe();
    return this.#store.values();
  }

  getChildren(nodeId: string | undefined): TreeNode[] {
    this.#subscribe();
    return this.#store.getChildren(nodeId);
  }
}

export const treeState = new TreeState();
