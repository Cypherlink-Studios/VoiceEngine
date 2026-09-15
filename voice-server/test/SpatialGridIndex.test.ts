import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialGridIndex } from '../src/spatial/SpatialGridIndex.js';

describe('SpatialGridIndex', () => {
  let grid: SpatialGridIndex;

  beforeEach(() => {
    grid = new SpatialGridIndex(32.0);
  });

  it('inserts and retrieves items from current and adjacent cells', () => {
    grid.insert('player-1', 0, 64, 0);
    grid.insert('player-2', 15, 64, 15); // Same cell (0, 2, 0)
    grid.insert('player-3', 35, 64, 0);  // Neighbor cell (1, 2, 0)
    grid.insert('player-far', 500, 64, 500); // Distant cell (15, 2, 15)

    const nearby = grid.getNearby(0, 64, 0);
    expect(nearby).toContain('player-1');
    expect(nearby).toContain('player-2');
    expect(nearby).toContain('player-3');
    expect(nearby).not.toContain('player-far');
    expect(nearby.length).toBe(3);
  });

  it('updates item position across cells seamlessly', () => {
    grid.insert('player-1', 0, 64, 0);
    expect(grid.getCellCount()).toBe(1);

    // Move slightly within same cell
    grid.update('player-1', 5, 64, 5);
    expect(grid.getCellCount()).toBe(1);

    // Move to adjacent cell
    grid.update('player-1', 40, 64, 0);
    expect(grid.getCellCount()).toBe(1);
    expect(grid.getNearby(40, 64, 0)).toContain('player-1');
    expect(grid.getNearby(500, 64, 500)).not.toContain('player-1');
  });

  it('removes items and cleans up empty cell sets', () => {
    grid.insert('player-1', 0, 64, 0);
    expect(grid.getItemCount()).toBe(1);
    expect(grid.getCellCount()).toBe(1);

    expect(grid.remove('player-1')).toBe(true);
    expect(grid.getItemCount()).toBe(0);
    expect(grid.getCellCount()).toBe(0);
    expect(grid.getNearby(0, 64, 0)).toHaveLength(0);

    // Removing non-existent item returns false
    expect(grid.remove('unknown')).toBe(false);
  });

  it('handles negative coordinates correctly', () => {
    grid.insert('player-neg', -10, 64, -10);
    grid.insert('player-pos', 5, 64, 5);

    const nearby = grid.getNearby(-5, 64, -5);
    expect(nearby).toContain('player-neg');
    expect(nearby).toContain('player-pos');
  });

  it('clears all items and cells', () => {
    grid.insert('p1', 0, 0, 0);
    grid.insert('p2', 100, 100, 100);
    expect(grid.getItemCount()).toBe(2);

    grid.clear();
    expect(grid.getItemCount()).toBe(0);
    expect(grid.getCellCount()).toBe(0);
  });
});
