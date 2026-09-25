export function recognitionContact(version, candidates = []) {
  const cards = candidates.slice(0, 3).map(card => `${card.code} (${card.locale})`).join(', ');
  const query = new URLSearchParams({
    subject: '[Card Pone Scan] 인식 오류 문의',
    body: `확장 프로그램 버전: ${version}\n인식된 카드: ${cards || '없음'}\n\n문제 내용:\n`
  });
  return `mailto:optkr26@gmail.com?${query.toString().replace(/\+/g, '%20')}`;
}
