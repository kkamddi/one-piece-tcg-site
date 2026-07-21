export const COMMUNITY_GRADES = [
  { key: 'apprentice', min: 0, kr: '견습 선원', en: 'Apprentice', jp: '見習い船員' },
  { key: 'crew', min: 10, kr: '선원', en: 'Crew', jp: '船員' },
  { key: 'supernova', min: 30, kr: '초신성', en: 'Supernova', jp: '超新星' },
  { key: 'warlord', min: 80, kr: '칠무해', en: 'Warlord', jp: '王下七武海' },
  { key: 'emperor', min: 200, kr: '사황', en: 'Emperor', jp: '四皇' },
  { key: 'pirate-king', min: 500, kr: '해적왕', en: 'Pirate King', jp: '海賊王' }
];

export function getCommunityGrade(points) {
  const totalPoints = Math.max(0, Number(points) || 0);
  let gradeIndex = 0;
  for (let index = 1; index < COMMUNITY_GRADES.length; index += 1) {
    if (totalPoints < COMMUNITY_GRADES[index].min) break;
    gradeIndex = index;
  }
  const current = COMMUNITY_GRADES[gradeIndex];
  const next = COMMUNITY_GRADES[gradeIndex + 1] || null;
  return {
    ...current,
    next,
    remaining: next ? Math.max(0, next.min - totalPoints) : 0
  };
}

export function getCommunityGradeLabel(gradeKey, uiLang = 'KR') {
  const grade = COMMUNITY_GRADES.find((item) => item.key === gradeKey) || COMMUNITY_GRADES[0];
  if (uiLang === 'EN') return grade.en;
  if (uiLang === 'JP') return grade.jp;
  return grade.kr;
}
