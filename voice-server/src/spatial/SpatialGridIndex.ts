export class SpatialGridIndex<T = string> {
  private readonly cellSize: number;
  // Use numeric cell keys for zero string allocation in 27-cell neighbor queries
  private readonly cells = new Map<number, Set<T>>();
  private readonly itemToCell = new Map<T, number>();

  // Safe integer coordinate offsets (21 bits X, 10 bits Y, 21 bits Z -> fits in JS safe integer < 2^53)
  private static readonly OFFSET_XZ = 1048576;
  private static readonly OFFSET_Y = 512;
  private static readonly MULTIPLIER_Y = 2097152; // 2^21
  private static readonly MULTIPLIER_X = 2147483648; // 1024 * 2097152 = 2^31

  constructor(cellSize = 32.0) {
    this.cellSize = cellSize > 0 ? cellSize : 32.0;
  }

  public getCellSize(): number {
    return this.cellSize;
  }

  public getCellKey(x: number, y: number, z: number): number {
    const cx = Math.floor(x / this.cellSize) + SpatialGridIndex.OFFSET_XZ;
    const cy = Math.floor(y / this.cellSize) + SpatialGridIndex.OFFSET_Y;
    const cz = Math.floor(z / this.cellSize) + SpatialGridIndex.OFFSET_XZ;
    return cx * SpatialGridIndex.MULTIPLIER_X + cy * SpatialGridIndex.MULTIPLIER_Y + cz;
  }

  public insert(item: T, x: number, y: number, z: number): void {
    const cellKey = this.getCellKey(x, y, z);
    const prevCell = this.itemToCell.get(item);

    if (prevCell !== undefined && prevCell !== cellKey) {
      const oldSet = this.cells.get(prevCell);
      if (oldSet) {
        oldSet.delete(item);
        if (oldSet.size === 0) {
          this.cells.delete(prevCell);
        }
      }
    }

    let cell = this.cells.get(cellKey);
    if (!cell) {
      cell = new Set<T>();
      this.cells.set(cellKey, cell);
    }
    cell.add(item);
    this.itemToCell.set(item, cellKey);
  }

  public update(item: T, x: number, y: number, z: number): void {
    const newCellKey = this.getCellKey(x, y, z);
    const currentCellKey = this.itemToCell.get(item);

    if (currentCellKey === newCellKey) {
      return; // Still in the same cell, no map mutations needed
    }

    this.insert(item, x, y, z);
  }

  public remove(item: T): boolean {
    const cellKey = this.itemToCell.get(item);
    if (cellKey === undefined) {
      return false;
    }

    this.itemToCell.delete(item);
    const cell = this.cells.get(cellKey);
    if (cell) {
      cell.delete(item);
      if (cell.size === 0) {
        this.cells.delete(cellKey);
      }
    }
    return true;
  }

  /**
   * Retrieves all items in the 27 cells surrounding and including the target position.
   * Performs zero string allocations.
   */
  public getNearby(x: number, y: number, z: number): T[] {
    const cx = Math.floor(x / this.cellSize) + SpatialGridIndex.OFFSET_XZ;
    const cy = Math.floor(y / this.cellSize) + SpatialGridIndex.OFFSET_Y;
    const cz = Math.floor(z / this.cellSize) + SpatialGridIndex.OFFSET_XZ;

    const result: T[] = [];

    for (let dx = -1; dx <= 1; dx++) {
      const xPart = (cx + dx) * SpatialGridIndex.MULTIPLIER_X;
      for (let dy = -1; dy <= 1; dy++) {
        const xyPart = xPart + (cy + dy) * SpatialGridIndex.MULTIPLIER_Y;
        for (let dz = -1; dz <= 1; dz++) {
          const key = xyPart + (cz + dz);
          const cell = this.cells.get(key);
          if (cell && cell.size > 0) {
            for (const item of cell) {
              result.push(item);
            }
          }
        }
      }
    }
    return result;
  }

  /**
   * Iterates through all items in the 27 adjacent cells with zero array allocations.
   */
  public forEachNearby(x: number, y: number, z: number, callback: (item: T) => void): void {
    const cx = Math.floor(x / this.cellSize) + SpatialGridIndex.OFFSET_XZ;
    const cy = Math.floor(y / this.cellSize) + SpatialGridIndex.OFFSET_Y;
    const cz = Math.floor(z / this.cellSize) + SpatialGridIndex.OFFSET_XZ;

    for (let dx = -1; dx <= 1; dx++) {
      const xPart = (cx + dx) * SpatialGridIndex.MULTIPLIER_X;
      for (let dy = -1; dy <= 1; dy++) {
        const xyPart = xPart + (cy + dy) * SpatialGridIndex.MULTIPLIER_Y;
        for (let dz = -1; dz <= 1; dz++) {
          const key = xyPart + (cz + dz);
          const cell = this.cells.get(key);
          if (cell) {
            for (const item of cell) {
              callback(item);
            }
          }
        }
      }
    }
  }

  public getCellCount(): number {
    return this.cells.size;
  }

  public getItemCount(): number {
    return this.itemToCell.size;
  }

  public clear(): void {
    this.cells.clear();
    this.itemToCell.clear();
  }
}
