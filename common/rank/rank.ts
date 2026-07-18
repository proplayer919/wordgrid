export type Rank = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Emerald' | 'Obsidian';

/**
 * Gets the rank based on the Elo rating
 * @param elo The Elo rating of the player
 * @returns The rank as a string
 */
export function getRank(elo: number): Rank {
  if (elo < 1200) return 'Bronze';
  if (elo < 1400) return 'Silver';
  if (elo < 1600) return 'Gold';
  if (elo < 1800) return 'Platinum';
  if (elo < 2000) return 'Diamond';
  if (elo < 2200) return 'Emerald';
  return 'Obsidian';
}
