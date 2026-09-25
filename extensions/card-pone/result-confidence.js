export function canShowCandidatePrice(result, candidate, confirmedKey) {
  if (!candidate || !result?.candidates?.includes(candidate)) return false;
  if (confirmedKey === candidate.key) return true;
  const visual = result.candidates.filter(item => item.artwork);
  return !result.warnings?.length && visual.length === 1 && visual[0] === candidate;
}
