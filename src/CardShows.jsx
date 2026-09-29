import React from 'react';
import { cardShowEvents } from './data/card-show-events';
import { filterShows, reviewedShows, koreaToday, showRoute, safeEventUrl } from './card-shows';
import './card-shows.css';

export default function CardShows({ search = '', onNavigate, onOpenCalendar, events = cardShowEvents, today = koreaToday() }) {
  const params = new URLSearchParams(search);
  const tab = params.get('tab') === 'past' ? 'past' : 'upcoming';
  const region = ['capital', 'other'].includes(params.get('region')) ? params.get('region') : 'all';
  const id = params.get('event');
  const selected = reviewedShows(events).find(event => event.id === id);
  const listing = showRoute({ tab, region });
  const follow = (event, href) => {
    if (!onNavigate || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); onNavigate(href);
  };
  const title = event => event.titleKo || event.title;
  const dates = event => event.endDate !== event.date ? `${event.date} ~ ${event.endDate}` : event.date;
  const status = event => event.status === 'cancelled' ? '취소' : event.status === 'postponed' ? '연기 · 일정 재확인 필요'
    : event.endDate < today ? '종료' : event.date <= today ? '진행 중' : '예정';
  const fee = event => event.admission || '입장료 미확인';
  const safeLink = (url, label) => { const href = safeEventUrl(url); return href ? <a href={href} target="_blank" rel="noreferrer">{label} ↗</a> : null; };
  if (id) return <section className="renew-panel card-shows" aria-labelledby="card-show-title">
    <a className="card-show-back" href={listing} onClick={event => follow(event, listing)}>← 뒤로가기</a>
    {!selected ? <><h1 id="card-show-title">행사를 찾을 수 없습니다</h1><p role="status">공개가 확인되지 않았거나 변경된 행사입니다.</p></> : <>
      <h1 id="card-show-title">{title(selected)}</h1>
      <span className={`card-show-status is-${selected.status}`}>{status(selected)}</span>
      <dl className="card-show-details">
        <div><dt>날짜</dt><dd>{dates(selected)}</dd></div>
        <div><dt>운영 시간</dt><dd>{selected.hours || '미확인'}</dd></div>
        <div><dt>장소</dt><dd>{selected.venue}</dd></div>
        <div><dt>입장료</dt><dd>{fee(selected)}</dd></div>
        <div><dt>원피스 관련 행사</dt><dd>{selected.onePieceConfirmed === true ? '공식 안내에 포함' : '미확인'}</dd></div>
      </dl>
      {selected.programs?.length > 0 && <section><h2>주요 프로그램</h2><ul>{selected.programs.map(program => <li key={program}>{program}</li>)}</ul></section>}
      <nav className="renew-chip-group card-show-actions" aria-label="행사 링크">
        {safeLink(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.venue)}`, '지도 보기')}
        {safeLink(selected.url, '공식 안내')}
        {selected.status === 'confirmed' && selected.endDate >= today && safeLink(selected.registrationUrl, '예매·등록')}
      </nav>
      <p className="card-show-verified">{selected.sourceLabel} · 마지막 확인 {selected.verifiedAt}</p>
    </>}
  </section>;
  const visible = filterShows(events, { tab, region, today });
  return <section className="renew-panel card-shows" aria-labelledby="card-shows-title">
    <header className="card-shows-heading"><h1 id="card-shows-title">카드쇼·행사</h1>
      {onOpenCalendar && <button type="button" onClick={onOpenCalendar}>캘린더 보기</button>}
    </header>
    <nav className="renew-chip-group card-show-filters" aria-label="행사 기간">
      {[['upcoming', '예정'], ['past', '종료']].map(([key, label]) => {
        const href = showRoute({ tab: key, region });
        return <a key={key} href={href} className={tab === key ? 'is-active' : ''} aria-current={tab === key ? 'page' : undefined} onClick={event => follow(event, href)}>{label}</a>;
      })}
    </nav>
    <nav className="renew-chip-group card-show-filters" aria-label="행사 지역">
      {[['all', '전체'], ['capital', '수도권'], ['other', '그 외 지역']].map(([key, label]) => {
        const href = showRoute({ tab, region: key });
        return <a key={key} href={href} className={region === key ? 'is-active' : ''} aria-current={region === key ? 'page' : undefined} onClick={event => follow(event, href)}>{label}</a>;
      })}
    </nav>
    <div className="card-show-list">
      {visible.map(event => { const href = showRoute({ tab, region, id: event.id }); return <article key={event.id}>
        <a className="card-show-row" href={href} onClick={click => follow(click, href)}>
          <div className="card-show-date"><time dateTime={event.date}>{dates(event)}</time><span>{event.hours || '시간 미확인'}</span></div>
          <div className="card-show-name"><h2>{title(event)}</h2><span>{event.venue}</span>
            {event.onePieceConfirmed === true && <span className="card-show-status">원피스</span>}</div>
          <div className="card-show-row-end"><span className={`card-show-status is-${event.status}`}>{status(event)}</span><span>{fee(event)}</span></div>
        </a>
      </article>; })}
      {!visible.length && <p role="status">{tab === 'past' ? '등록된 종료 행사가 없습니다.' : '확인된 예정 행사가 없습니다.'}</p>}
    </div>
  </section>;
}
