import { collectorIndexComponents } from './market-index-components.js';

// Audited against SNKRDUNK releasedAt metadata and official product release periods.
export const pre2025IndexApparelIds = Object.freeze([
  93519,
  93520,
  94909,
  95888,
  98592,
  102434,
  102650,
  108050,
  112979,
  112982,
  112983,
  112984,
  112985,
  119360,
  126134,
  135425,
  135438,
  135439,
  135440,
  135449,
  159664,
  167350,
  171995,
  184326,
  198723,
  230771,
  265745,
  300067,
  311594,
  315324,
  323700,
  348126,
  349418,
  349419,
  349441,
  349442,
  349460,
  349461,
  349472,
  349475,
  349476,
  442287,
  478751,
  605546
]);

const targetIds = new Set(pre2025IndexApparelIds);

export const pre2025IndexComponents = collectorIndexComponents.filter((component) => (
  targetIds.has(Number(component.apparelId))
));

export default pre2025IndexComponents;
