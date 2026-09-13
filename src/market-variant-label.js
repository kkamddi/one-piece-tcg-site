export function getMarketVariantLabel(item, language = 'KR') {
  const name = String(item?.name || '');
  const text = (kr, en, jp) => language === 'JP' ? jp : language === 'EN' ? en : kr;
  const labels = [];
  if (/\b(?:comic|manga)\b/i.test(name)) labels.push(text('망가', 'Manga', 'コミック'));
  else if (/\bparallel\b|\b(?:SEC|SR|R|L)-P\b/i.test(name)) labels.push(text('패러렐', 'Parallel', 'パラレル'));
  if (/\bwanted\b/i.test(name)) labels.push(text('수배서', 'Wanted', '手配書'));
  if (/\bgold background\b/i.test(name)) labels.push(text('금색 배경', 'Gold background', '金背景'));
  if (/\bsilver background\b/i.test(name)) labels.push(text('은색 배경', 'Silver background', '銀背景'));
  const prize = name.match(/\b(\d+)(?:st|nd|rd|th)\s+prize\b/i);
  if (prize) labels.push(text(`대회 ${prize[1]}위`, `Prize: ${prize[1]}`, `大会${prize[1]}位`));
  if (/\bpromotional card\b/i.test(name)) labels.push(text('프로모', 'Promo', 'プロモ'));
  if (/\banniversary\b/i.test(name)) labels.push(text('기념판', 'Anniversary', '記念版'));
  return labels.join(' · ');
}
