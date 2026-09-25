import React, { useEffect, useRef, useState } from 'react';
import { validateScanFile, extractCardCodes } from './lib/card-scan.js';
import { normalizedCrop, recognizeForLab, recognitionPriceUrl } from './lib/card-recognition-lab.js';
import sampleUrl from '../artifacts/card-scan-OP01-120.png?url';
import './card-recognition-lab.css';

function CandidateImage({ item }) {
  const [index, setIndex] = useState(0);
  return index < item.images.length ? <img src={item.images[index]} alt={item.name} loading="lazy" onError={() => setIndex(value => value + 1)} /> : <span className="recognition-image-missing">이미지 없음</span>;
}

export default function CardRecognitionLab() {
  const [preview, setPreview] = useState('');
  const [locale, setLocale] = useState('auto');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [cropping, setCropping] = useState(false);
  const [crop, setCrop] = useState(null);
  const [guide, setGuide] = useState(false);
  const canvasRef = useRef(null), inputRef = useRef(null), job = useRef(0), controller = useRef(null), start = useRef(null);

  function cancel() { job.current += 1; controller.current?.abort(); controller.current = null; setBusy(false); setStage(''); }
  function invalidate() { cancel(); setResult(null); setSelected(''); setConfirmed(false); setExpanded(false); setError(''); }
  useEffect(() => () => { job.current += 1; controller.current?.abort(); }, []);
  useEffect(() => {
    const paste = event => { const file = [...(event.clipboardData?.items || [])].find(item => item.kind === 'file' && item.type.startsWith('image/'))?.getAsFile(); if (file) { event.preventDefault(); void openFile(file); } };
    window.addEventListener('paste', paste);
    return () => window.removeEventListener('paste', paste);
  }, []);

  async function openFile(file) {
    invalidate();
    const issue = validateScanFile(file);
    if (issue) { setError(issue === 'size' ? '15MB 이하 이미지를 선택해 주세요.' : 'JPG, PNG, WebP 이미지를 선택해 주세요.'); return; }
    const ticket = ++job.current;
    const url = URL.createObjectURL(file);
    setBusy(true); setStage('이미지 준비 중');
    try {
      const image = new Image(); image.src = url; await image.decode();
      if (ticket !== job.current) return;
      if (image.naturalWidth * image.naturalHeight > 48000000) throw new Error('large');
      const scale = Math.min(1, 2200 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvasRef.current = canvas; setPreview(canvas.toDataURL('image/jpeg', .94)); setCrop(null); setCropping(false); setCode('');
    } catch { if (ticket === job.current) setError('이미지를 열 수 없습니다. JPG 또는 PNG로 다시 선택해 주세요.'); }
    finally { URL.revokeObjectURL(url); if (ticket === job.current) { setBusy(false); setStage(''); } }
  }

  async function analyze() {
    if (!canvasRef.current) return;
    invalidate();
    if (code.trim() && extractCardCodes(code).length !== 1) { setError('카드번호 하나를 입력해 주세요. 예: OP01-120'); return; }
    const ticket = ++job.current, abort = new AbortController(); controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 120000);
    setBusy(true); setStage('분석 준비 중');
    try {
      const data = await recognizeForLab(canvasRef.current, { signal: abort.signal, locale, code, onStage: value => { if (ticket === job.current) setStage(value); } });
      if (ticket === job.current) setResult(data);
    } catch { if (ticket === job.current) setError(abort.signal.aborted ? '분석 시간이 초과됐습니다. 카드 영역을 좁혀 다시 시도해 주세요.' : '분석하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.'); }
    finally { clearTimeout(timer); if (ticket === job.current) { setBusy(false); setStage(''); } }
  }

  function replaceCanvas(canvas) { invalidate(); canvasRef.current = canvas; setPreview(canvas.toDataURL('image/jpeg', .94)); setCrop(null); setCropping(false); }
  function rotate() {
    const old = canvasRef.current, next = document.createElement('canvas'); next.width = old.height; next.height = old.width;
    const ctx = next.getContext('2d'); ctx.translate(next.width, 0); ctx.rotate(Math.PI / 2); ctx.drawImage(old, 0, 0); replaceCanvas(next);
  }
  function applyCrop() {
    if (!crop || crop.width < .03 || crop.height < .03) return;
    const old = canvasRef.current, next = document.createElement('canvas'); next.width = Math.max(1, Math.round(old.width * crop.width)); next.height = Math.max(1, Math.round(old.height * crop.height));
    next.getContext('2d').drawImage(old, old.width * crop.x, old.height * crop.y, old.width * crop.width, old.height * crop.height, 0, 0, next.width, next.height); replaceCanvas(next);
  }
  function point(event) { const r = event.currentTarget.getBoundingClientRect(); return { x: (event.clientX - r.left) / r.width, y: (event.clientY - r.top) / r.height }; }
  const candidate = result?.candidates.find(item => item.key === selected);
  const priceUrl = recognitionPriceUrl(candidate, confirmed);
  return <main className="recognition-lab">
    <header className="recognition-head"><a href="/">CARD <span>Pone</span></a><span>로컬 테스트</span></header>
    <div className="recognition-title"><h1>카드 이미지 인식</h1><button type="button" onClick={() => setGuide(!guide)} aria-expanded={guide}>사용 가이드</button></div>
    {guide && <section className="recognition-guide"><h2>이미지와 판본 확인</h2><p>이미지를 업로드하거나 붙여넣은 뒤 카드 영역을 선택하고 분석합니다. 현재 비교 자료는 JP·EN 시세 상품 기준이며, KR과 모든 도감 카드를 포함하지 않습니다. 판본은 자동 확정하지 않습니다.</p><p>사진은 브라우저 메모리에서만 처리합니다. 원본·캡처는 업로드하거나 저장하지 않습니다. 비교 자료와 OCR 모델 다운로드에는 인터넷 연결이 필요합니다. 정품·상태·PSA 등급은 판정하지 않습니다.</p></section>}
    <div className="recognition-workspace">
      <section className="recognition-source" aria-label="분석 이미지">
        <div className="recognition-upload" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void openFile(file); }}>
          {preview ? <div className={`recognition-photo ${cropping ? 'is-cropping' : ''}`} onPointerDown={event => { if (!cropping) return; start.current = point(event); setCrop(null); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { if (cropping && start.current) setCrop(normalizedCrop(start.current, point(event))); }} onPointerUp={event => { if (cropping && start.current) setCrop(normalizedCrop(start.current, point(event))); start.current = null; }} onPointerCancel={() => { start.current = null; }}>
            <img src={preview} alt="분석할 카드" draggable="false" />
            {cropping && crop && <span className="recognition-crop" style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }} />}
          </div> : <button className="recognition-empty" type="button" onClick={() => inputRef.current.click()}>이미지 선택</button>}
        </div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => { const file = event.target.files[0]; event.target.value = ''; if (file) void openFile(file); }} />
        <div className="recognition-tools"><button type="button" onClick={() => inputRef.current.click()}>사진 선택</button><button type="button" disabled={!preview || busy} title="오른쪽으로 90도 회전" aria-label="사진 회전" onClick={rotate}>↻</button><button type="button" disabled={!preview || busy} aria-pressed={cropping} onClick={() => { setCropping(!cropping); setCrop(null); }}>영역 선택</button>{cropping && <button type="button" disabled={!crop || crop.width < .03 || crop.height < .03} onClick={applyCrop}>자르기 적용</button>}</div>
        <fieldset disabled={busy}><legend>비교 조건</legend><label>판본<select value={locale} onChange={event => { invalidate(); setLocale(event.target.value); }}><option value="auto">JP + EN</option><option value="JP">JP</option><option value="EN">EN</option></select></label><label>카드번호<input value={code} placeholder="자동 인식" onChange={event => { invalidate(); setCode(event.target.value); }} /></label></fieldset>
        <div className="recognition-run"><button type="button" className="is-primary" disabled={!preview || busy || cropping} onClick={analyze}>후보 찾기</button>{busy && <button type="button" onClick={cancel}>취소</button>}<button type="button" disabled={busy} onClick={async () => { try { const response = await fetch(sampleUrl); if (!response.ok) throw new Error(); const blob = await response.blob(); await openFile(new File([blob], 'OP01-120.png', { type: 'image/png' })); } catch { setError('샘플을 열 수 없습니다.'); } }}>샘플 열기</button></div>
        <p role="status" className="recognition-status">{stage || (result ? `분석 완료 · ${result.codes.join(', ') || '번호 미인식'}` : '')}</p>
        {error && <p role="alert" className="recognition-error">{error}</p>}
      </section>
      <section className="recognition-results" aria-label="카드 후보" aria-busy={busy}>
        <h2>인식 후보 {result && <span>{result.candidates.length}</span>}</h2>
        {!result && <div className="recognition-pending">{busy ? '카드 비교 중' : '대기 중'}</div>}
        {result?.warnings.map(warning => <p role="status" className="recognition-error" key={warning}>{warning}</p>)}
        {result && !result.candidates.length && <p>일치 후보가 없습니다.</p>}
        <div className="recognition-candidates">{(expanded ? result?.candidates : result?.candidates.slice(0, 3))?.map(item => <button type="button" key={item.key} className={`recognition-candidate ${selected === item.key ? 'is-selected' : ''}`} aria-pressed={selected === item.key} onClick={() => { setSelected(item.key); setConfirmed(false); }}>
          <CandidateImage key={item.images.join('|')} item={item} />
          <span className="recognition-candidate-info"><small>{item.locale} · {item.code}</small><strong>{item.name}</strong><span>{item.artwork ? '이미지 유사 후보' : '번호 일치 · 이미지 미확인'}</span><small>{item.catalogCards.length === 1 ? `도감 ${item.catalogCards[0].id}` : item.catalogCards.length > 1 ? '복수 도감 연결 · 확인 필요' : '도감 연결 미확인'}</small></span>
        </button>)}</div>
        {!expanded && result?.candidates.length > 3 && <button type="button" onClick={() => setExpanded(true)}>나머지 {result.candidates.length - 3}개 후보</button>}
        {candidate && <section className="recognition-selection"><h3>선택한 후보</h3><p>{candidate.name}</p><p>{candidate.catalogCards[0]?.name || candidate.code}</p><label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={candidate.catalogCards.length !== 1} />이미지·판본 확인</label>{priceUrl ? <a className="recognition-price" href={priceUrl} target="_blank" rel="noreferrer">카드폰 시세 보기 ↗</a> : <button type="button" disabled>카드폰 시세 보기</button>}</section>}
      </section>
    </div>
  </main>;
}
