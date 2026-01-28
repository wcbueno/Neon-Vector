
import { Vector } from './Vector';

export class SpatialHash<T extends { pos: Vector }> {
  private cellSize: number;
  private buckets: Map<string, T[]>;

  constructor(cellSize: number) {
    this.cellSize = cellSize;
    this.buckets = new Map();
  }

  clear() {
    this.buckets.clear();
  }

  getKey(v: Vector): string {
    const x = Math.floor(v.x / this.cellSize);
    const y = Math.floor(v.y / this.cellSize);
    return `${x},${y}`;
  }

  insert(item: T) {
    const key = this.getKey(item.pos);
    if (!this.buckets.has(key)) {
      this.buckets.set(key, []);
    }
    this.buckets.get(key)!.push(item);
  }

  // Returns items in the cell of the vector and the 8 surrounding cells
  query(pos: Vector): T[] {
    const results: T[] = [];
    const cx = Math.floor(pos.x / this.cellSize);
    const cy = Math.floor(pos.y / this.cellSize);

    for (let x = cx - 1; x <= cx + 1; x++) {
      for (let y = cy - 1; y <= cy + 1; y++) {
        const key = `${x},${y}`;
        const items = this.buckets.get(key);
        if (items) {
          for (const item of items) {
            results.push(item);
          }
        }
      }
    }
    return results;
  }
}
