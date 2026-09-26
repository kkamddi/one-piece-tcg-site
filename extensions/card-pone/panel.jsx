import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { recognizeForLab } from '../../src/lib/card-recognition-lab.js';
import { resultLinks } from './result-links.js';
import { canShowCandidatePrice } from './result-confidence.js';
import { recognitionContact } from './contact.js';
import manifest from './manifest.json';
import { loadReferenceData, resilientReferenceReader } from './reference-data.js';
import { fetchPrices, formatPriceWon, JPY_TO_KRW } from './prices.js';
import { createImageWorker } from './image-worker-bridge.js';
import { cropPixels } from './capture.js';
import './panel.css';
import { requireMember, MEMBER_REQUIRED } from './member.js';

function CardImage({ candidate }) {
  const [index, setIndex] = useState(0);
  const src = candidate.images[index];
  return src ? <img src={src} alt={candidate.code} className={src.startsWith('https://cdn.snkrdunk.com/upload_bg_removed/') ? 'product-image' : ''} referrerPolicy="no-referrer" onError={() => setIndex(value => value + 1)} /> : <span className="missing-image">{candidate.code}</span>;
}

function Prices({ apparelId }) {
  const [state, setState] = useState({ loading: true });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true });
    fetchPrices(Number(apparelId), controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ data });
    }).catch(() => { if (!controller.signal.aborted) setState({ error: true }); });
    return () => controller.abort();
  }, [apparelId, attempt]);
  const money = formatPriceWon;
  return <div className="price-summary" aria-label="카드 시세" aria-live="polite">
    {state.loading ? <p className="price-note">시세 불러오는 중…</p> : state.error ? <p className="price-note">시세를 불러오지 못했습니다. <button onClick={() => setAttempt(value => value + 1)}>다시 시도</button></p> : <>
      <dl><div><dt>Single</dt><dd>{money(state.data.single)}</dd><p className="price-note">{state.data.singleDate || '거래 기록 없음'}</p></div><div><dt>PSA10</dt><dd>{money(state.data.psa10)}</dd><p className="price-note">{state.data.psa10Date || '거래 기록 없음'}</p></div></dl>
      <p className="price-note">최근 거래일 중앙값 · 1엔={JPY_TO_KRW}원</p>
    </>}
  </div>;
}

function Panel() {
  const [phase, setPhase] = useState('idle');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [confirmedKey, setConfirmedKey] = useState(null);
  const [limit, setLimit] = useState(3);
  const job = useRef(null);
  const file = useRef(null);
  const isExtension = Boolean(globalThis.chrome?.runtime?.id);
  const [member, setMember] = useState(null);
  const memberRef = useRef(null);
  const memberCheck = useRef(0);
  async function checkMember() {
    const sequence = ++memberCheck.current;
    try {
      const next = await requireMember();
      if (sequence !== memberCheck.current) return null;
      if (memberRef.current && memberRef.current !== next.memberId) {
        job.current?.abort(); setResult(null); setConfirmedKey(null); setPhase('idle');
      }
      memberRef.current = next.memberId; setMember(next); setError('');
      return next;
    } catch {
      if (sequence !== memberCheck.current) return null;
      memberRef.current = null; setMember(null); job.current?.abort();
      setResult(null); setConfirmedKey(null); setPhase('idle'); setError(MEMBER_REQUIRED);
      return null;
    }
  }
  useEffect(() => {
    let active = true;
    const check = () => { if (active) void checkMember(); };
    check();
    const timer = setInterval(check, 30000);
    window.addEventListener('focus', check);
    return () => { active = false; memberCheck.current++; clearInterval(timer); window.removeEventListener('focus', check); };
  }, []);
  useEffect(() => () => job.current?.abort(), []);

  async function scan(upload) {
    job.current?.abort();
    const controller = new AbortController(); job.current = controller;
    setError(''); setResult(null); setConfirmedKey(null); setLimit(3);
    setPhase('capture'); setStatus(isExtension ? '카드 영역 선택 중' : '스캔 준비 중');
    let canvas, worker;
    try {
      const identity = await requireMember();
      controller.signal.throwIfAborted();
      let source, rect;
      if (isExtension) {
        const currentWindow = await chrome.windows.getCurrent();
        const response = await chrome.runtime.sendMessage({ type: 'card-pone-scan', windowId: currentWindow.id });
        if (response?.error) throw new Error(response.error);
        if (!response?.capture) { setPhase('idle'); return; }
        const screenshot = new Image(); screenshot.src = response.capture.dataUrl;
        await screenshot.decode();
        source = await createImageBitmap(screenshot);
        rect = cropPixels(response.capture.rect, source.width, source.height);
      } else {
        if (!upload || !['image/png', 'image/jpeg', 'image/webp'].includes(upload.type) || upload.size > 15 * 1024 * 1024) throw new Error('15MB 이하의 PNG, JPG, WebP 사진을 선택해 주세요.');
        source = await createImageBitmap(upload);
        rect = { x: 0, y: 0, width: source.width, height: source.height };
      }
      try {
        controller.signal.throwIfAborted();
        const scale = Math.min(1, 2200 / Math.max(rect.width, rect.height));
        canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(rect.width * scale)); canvas.height = Math.max(1, Math.round(rect.height * scale));
        const context = canvas.getContext('2d');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, canvas.width, canvas.height);
      } finally { source.close(); }
      setPhase('scanning'); setStatus('카드 확인 중');
      worker = await createImageWorker(controller.signal);
      let referenceData;
      if (isExtension) {
        try { referenceData = await loadReferenceData(controller.signal); }
        catch { controller.signal.throwIfAborted(); }
      }
      const found = await recognizeForLab(canvas, {
        signal: controller.signal,
        referenceData,
        imageOptions: { worker, readIndex: resilientReferenceReader(referenceData, controller.signal, { baseUrl: new URL('./card-scan/', location.href) }) },
        ocrOptions: { workerPath: new URL('./ocr/worker.min.js', location.href).href, workerBlobURL: false, corePath: new URL('./ocr/', location.href).href, langPath: new URL('./ocr/', location.href).href, gzip: false, cacheMethod: 'none' },
        onStage: () => setStatus('카드 확인 중')
      });
      controller.signal.throwIfAborted();
      if ((await requireMember()).memberId !== identity.memberId) throw new Error(MEMBER_REQUIRED);
      controller.signal.throwIfAborted();
      setResult(found); setPhase('done');
    } catch (failure) {
      if (job.current !== controller) return;
      if (failure.name !== 'AbortError') setError(failure.message || '스캔하지 못했습니다. 다시 시도해 주세요.');
      setPhase('idle');
    } finally {
      worker?.terminate();
      if (canvas) canvas.width = canvas.height = 1;
      if (job.current === controller) job.current = null;
    }
  }

  const busy = phase === 'capture' || phase === 'scanning';
  return <main className="scan-panel">
    <header><img src="./logo.png" alt="Card Pone" />
    <button className="scan-button" disabled={busy || !member} onClick={() => isExtension ? scan() : file.current.click()}>
      <span className={busy ? 'scan-mark scanning' : 'scan-mark'} aria-hidden="true" />
      {busy ? status : result ? '다시 스캔' : '스캔'}
    </button>
    </header>
    {isExtension && !member && <section className="member-login" aria-labelledby="member-login-title">
      <span className="member-login-icon" aria-hidden="true"><span className="scan-mark" /></span>
      <h1 id="member-login-title">로그인하고<br />카드를 스캔하세요</h1>
      <button className="member-login-primary" onClick={async () => {
        try { await chrome.runtime.sendMessage({ type: 'card-pone-member-login' }); }
        catch { setError(MEMBER_REQUIRED); }
      }}>Card Pone 로그인 <span aria-hidden="true">↗</span></button>
      <div className="member-login-recheck"><button onClick={checkMember}>연결 확인</button></div>
    </section>}
    {!isExtension && <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event => { const image = event.target.files?.[0]; event.target.value = ''; if (image) scan(image); }} />}
    {phase === 'scanning' && <button className="cancel-scan" onClick={() => job.current?.abort()}>취소</button>}
    <div role="status" aria-live="polite" className="status">{error || (phase === 'done' && !result?.candidates.length ? (result?.warnings.length ? '분석을 완료하지 못했습니다. 다시 스캔해 주세요.' : '일치하는 카드를 찾지 못했습니다.') : '')}</div>
    {result?.warnings.length > 0 && <p className="warning" role="status">{result.warnings.join(' ')}</p>}
    {result?.candidates.length > 0 && <section aria-label="스캔 결과">
      <div className="result-heading"><h1>카드 후보</h1><span>{result.candidates.length}</span></div>
      {result.candidates.slice(0, limit).map((candidate, index) => {
        const links = resultLinks(candidate);
        const showPrice = canShowCandidatePrice(result, candidate, confirmedKey);
        return <article className={`result-row${index === 0 ? ' is-featured' : ''}`} key={candidate.key}>
          <div className="card-image"><CardImage candidate={candidate} /></div>
          <div className="card-info"><p className="card-code">{candidate.code}<span>{candidate.locale}</span></p><h2>{candidate.name}</h2><p className="card-set">{candidate.setName}</p>
            {!candidate.artwork && <p className="warning">카드번호만 일치</p>}
            {links?.price && !showPrice && <button className="more" onClick={() => setConfirmedKey(candidate.key)}>이 카드로 시세 확인</button>}
            {links?.price && showPrice && <Prices key={candidate.key} apparelId={candidate.apparelId} />}
            {links && <nav className="result-actions" aria-label={`${candidate.code} ${candidate.locale} 바로가기`}>
              {links.catalog && <a className="catalog-link" href={`https://www.optcgkorea.com${links.catalog}`} target="_blank" rel="noopener noreferrer">{links.catalogLabel} <span aria-hidden="true">↗</span></a>}
              {links.price && showPrice && <a className="price-link" href={`https://www.optcgkorea.com${links.price}`} target="_blank" rel="noopener noreferrer">차트·거래 내역 <span aria-hidden="true">↗</span></a>}
            </nav>}
          </div>
        </article>;
      })}
      {result.candidates.length > limit && <button className="more" onClick={() => setLimit(value => value + 5)}>후보 더 보기</button>}
    </section>}
    <footer className="contact-footer"><a href="https://www.optcgkorea.com/card-pone-scan-privacy.html" target="_blank" rel="noopener noreferrer">개인정보처리방침</a><a href={recognitionContact(manifest.version, result?.candidates)}>인식 오류 문의</a></footer>
  </main>;
}

createRoot(document.getElementById('root')).render(<Panel />);
