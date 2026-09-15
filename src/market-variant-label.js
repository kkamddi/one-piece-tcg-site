export function getMarketArtTags(item) {
  const name = String(item?.name || '');
  return [
    ['manga', /\b(?:comic|manga)\b/i],
    ['wanted', /\bwanted\b/i],
    ['gold', /\bgold background\b/i],
    ['silver', /\bsilver background\b/i]
  ].filter(([, pattern]) => pattern.test(name)).map(([key]) => key);
}

export function getMarketVariantLabel(item, language = 'KR') {
  const name = String(item?.name || '');
  const text = (kr, en, jp) => language === 'JP' ? jp : language === 'EN' ? en : kr;
  const labels = [];
  const artTags = getMarketArtTags(item);
  if (artTags.includes('manga')) labels.push(text('망가', 'Manga', 'コミック'));
  else if (/\bparallel\b|\b(?:SEC|SR|R|L)-P\b/i.test(name)) labels.push(text('패러렐', 'Parallel', 'パラレル'));
  if (artTags.includes('wanted')) labels.push(text('수배서', 'Wanted', '手配書'));
  if (artTags.includes('gold')) labels.push(text('금색 배경', 'Gold background', '金背景'));
  if (artTags.includes('silver')) labels.push(text('은색 배경', 'Silver background', '銀背景'));
  const prize = name.match(/\b(\d+)(?:st|nd|rd|th)\s+prize\b/i);
  if (prize) labels.push(text(`대회 ${prize[1]}위`, `Prize: ${prize[1]}`, `大会${prize[1]}位`));
  if (/\bpromotional card\b/i.test(name)) labels.push(text('프로모', 'Promo', 'プロモ'));
  if (/\banniversary\b/i.test(name)) labels.push(text('기념판', 'Anniversary', '記念版'));
  return labels.join(' · ');
}
