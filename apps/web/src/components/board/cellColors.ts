/**
 * Adjacent-mine number palette. The glyph itself (1-8) is the primary signal —
 * color is reinforcement only, so this stays legible under any color-vision
 * deficiency. Deliberately avoids the danger/red family, which is reserved
 * for mines and penalties.
 */
export const NUMBER_COLOR: Record<number, string> = {
  1: "#5ac8f5",
  2: "#35d99a",
  3: "#e8c545",
  4: "#9b86ff",
  5: "#ff9f4d",
  6: "#4fe0d8",
  7: "#f472b6",
  8: "#ffffff",
};
