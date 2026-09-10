import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { extractCardCodes, getCameraCrop, getScanVariants, validateScanFile } from './lib/card-scan';
import './card-scanner.css';

const COPY = {
  KR: {
    title: '카드 스캔', guide: '사용 가이드', close: '닫기', camera: '카메라 켜기', upload: '사진 선택', capture: '촬영', native: '휴대폰 카메라로 촬영', rotate: '사진 회전', read: '카드번호 읽기', retake: '다시 선택', cancel: '취소', code: '카드번호 확인', locale: '시세 기준 언어', jp: '일본판', en: '영문판', search: '버전 후보 보기', loading: '인식 엔진 준비 중', reading: '카드번호 읽는 중', noCode: '카드번호를 찾지 못했습니다. 사진을 다시 찍거나 번호를 입력해 주세요.', invalid: '카드번호를 확인해 주세요. 예: OP01-120', file: 'JPG, PNG, WebP 사진을 선택해 주세요.', size: '15MB 이하 사진을 선택해 주세요.', decode: '이 사진을 열 수 없습니다. JPG 또는 PNG로 다시 선택해 주세요.', denied: '카메라 권한이 차단되어 있습니다. 브라우저 설정에서 허용하거나 사진을 선택해 주세요.', cameraError: '카메라를 열 수 없습니다. 다른 앱의 카메라를 닫거나 사진을 선택해 주세요.', insecure: '카메라는 HTTPS에서 사용할 수 있습니다. 사진 선택이나 휴대폰 카메라 촬영을 이용해 주세요.', timeout: '인식 시간이 초과됐습니다. 카드번호가 선명하게 보이도록 다시 촬영해 주세요.', error: '인식 엔진을 실행하지 못했습니다. 인터넷 연결을 확인하거나 카드번호를 입력해 주세요.', preview: '촬영한 카드', ready: '사진 준비 중', multiple: '여러 카드번호가 발견됐습니다.', guideHeading: '카드 촬영과 시세 확인', guideItems: ['카드 한 장을 밝은 곳에서 촬영하고 네 모서리를 프레임에 맞춥니다. 슬리브 반사와 흔들림을 줄여 주세요.', '아래쪽 카드번호가 선명해야 합니다. 사진 선택 후 회전할 수 있으며, 번호를 직접 수정할 수도 있습니다.', '사진은 이 브라우저에서 처리하며 서버로 전송하거나 저장하지 않습니다. 첫 인식에는 OCR 엔진과 영어 문자 모델 다운로드를 위한 인터넷 연결이 필요합니다.', '카드번호만 읽는 기능입니다. 같은 번호의 다른 그림, 패러렐, 재록은 다음 화면의 이미지와 상품명으로 확인해 주세요. 진위나 PSA 등급을 판정하지 않습니다.', '시세 기준 언어는 직접 선택합니다. 현재 일본판·영문판 시세를 지원하며 한국어판 카드 가격으로 간주하면 안 됩니다.'], back: '스캔으로 돌아가기'
  },
  EN: {
    title: 'Scan card', guide: 'Guide', close: 'Close', camera: 'Open camera', upload: 'Choose photo', capture: 'Capture', native: 'Take a phone photo', rotate: 'Rotate photo', read: 'Read card number', retake: 'Choose again', cancel: 'Cancel', code: 'Confirm card number', locale: 'Price language', jp: 'Japanese', en: 'English', search: 'View variants', loading: 'Loading recognition engine', reading: 'Reading card number', noCode: 'No card number found. Retake the photo or enter the number.', invalid: 'Check the card number, e.g. OP01-120.', file: 'Choose a JPG, PNG or WebP photo.', size: 'Choose a photo smaller than 15MB.', decode: 'Cannot open this photo. Try JPG or PNG.', denied: 'Camera permission is blocked. Allow it in browser settings or choose a photo.', cameraError: 'Cannot open the camera. Close other camera apps or choose a photo.', insecure: 'The camera requires HTTPS. Choose a photo or use the phone camera option.', timeout: 'Recognition timed out. Retake a clear photo of the card number.', error: 'Cannot run recognition. Check your connection or enter the card number.', preview: 'Card photo', ready: 'Preparing photo', multiple: 'Multiple card numbers found.', guideHeading: 'Capture and identify a card', guideItems: ['Photograph one card in good light with all four corners inside the frame. Avoid glare and motion blur.', 'Keep the printed card number sharp. Rotate the photo or correct the number manually as needed.', 'Photos are processed in this browser, not uploaded or stored on a server. The first scan needs internet to download the OCR engine and English character model.', 'Recognition reads the number, not the art variant. Compare images and product names on the next screen. It does not authenticate cards or assign PSA grades.', 'Choose the price language yourself. Only Japanese and English market prices are available; these are not Korean card prices.'], back: 'Back to scan'
  },
  JP: {
    title: 'カードスキャン', guide: '使い方', close: '閉じる', camera: 'カメラを開く', upload: '写真を選ぶ', capture: '撮影', native: '端末のカメラで撮影', rotate: '写真を回転', read: 'カード番号を読み取る', retake: '選び直す', cancel: 'キャンセル', code: 'カード番号の確認', locale: '相場の言語', jp: '日本語版', en: '英語版', search: 'バージョン候補を見る', loading: '認識エンジンを準備中', reading: 'カード番号を読取中', noCode: 'カード番号が見つかりません。撮り直すか番号を入力してください。', invalid: 'カード番号を確認してください。例: OP01-120', file: 'JPG、PNG、WebPの写真を選んでください。', size: '15MB以下の写真を選んでください。', decode: '写真を開けません。JPGかPNGを選んでください。', denied: 'カメラが許可されていません。設定で許可するか写真を選んでください。', cameraError: 'カメラを開けません。他のカメラアプリを閉じるか写真を選んでください。', insecure: 'カメラにはHTTPSが必要です。写真選択か端末カメラをご利用ください。', timeout: '認識がタイムアウトしました。番号が鮮明に見えるよう撮り直してください。', error: '認識を実行できません。通信を確認するか番号を入力してください。', preview: 'カードの写真', ready: '写真を準備中', multiple: '複数のカード番号が見つかりました。', guideHeading: 'カード撮影と相場の確認', guideItems: ['明るい場所でカード1枚を撮影し、四隅を枠に合わせます。反射や手ぶれを避けてください。', '下部のカード番号を鮮明に撮影してください。写真の回転や番号の手動修正も可能です。', '写真はブラウザ内で処理し、サーバーへ送信・保存しません。初回はOCRエンジンと英語文字モデルのダウンロードに通信が必要です。', '番号の読取機能です。絵柄や再録の違いは次の画面の画像と商品名で確認してください。真贋やPSAグレードは判定しません。', '相場の言語は手動で選びます。日本語版と英語版のみ対応し、韓国語版の価格とは異なります。'], back: 'スキャンに戻る'
  }
};

export default function CardScanner({ uiLang, initialLocale, onClose, onSelect }) {
  const text = COPY[uiLang] || COPY.KR;
  const labels = uiLang === 'EN'
    ? { analyzing: 'Analyzing...', variants: 'Choose a version', confirm: 'View price', matches: 'Card found', empty: 'No matching version in this language.', change: 'Choose another version', manual: 'Enter card number', retry: 'Retake', searching: 'Finding card...' }
    : uiLang === 'JP'
      ? { analyzing: '解析中...', variants: 'バージョンを選択', confirm: '相場を見る', matches: 'カードの確認', empty: 'この言語の候補がありません。', change: '別のバージョンを選ぶ', manual: '番号を入力', retry: '撮り直す', searching: 'カードを検索中...' }
      : { analyzing: '분석 중...', variants: '버전 선택', confirm: '이 카드 시세 보기', matches: '카드 확인', empty: '이 언어로 등록된 카드가 없습니다.', change: '다른 버전 선택', manual: '카드번호 직접 입력', retry: '다시 촬영', searching: '카드 찾는 중...' };
  const [mode, setMode] = useState('requesting');
  const [guide, setGuide] = useState(false);
  const [preview, setPreview] = useState('');
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState([]);
  const [locale, setLocale] = useState(initialLocale === 'EN' ? 'EN' : 'JP');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState({ phase: 'loading', progress: 0 });
  const [cameraReady, setCameraReady] = useState(false);
  const [variants, setVariants] = useState([]);
  const [chosen, setChosen] = useState(null);
  const [manual, setManual] = useState(false);
  const [imageMatches, setImageMatches] = useState([]);
  const [imageStatus, setImageStatus] = useState('');
  const imageSessionRef = useRef(null);
  const imageLabels = uiLang === 'EN'
    ? { match: 'Similar artwork', uncertain: 'Image match uncertain', unavailable: 'Image comparison unavailable', guide: 'The card number and artwork are compared with catalog images. Similar artwork is a suggestion, not a confirmed version. Check small marks, reprints and product names yourself. Photos are processed on this device; comparison data and the image engine are downloaded. This does not authenticate cards or grade their condition.' }
    : uiLang === 'JP'
      ? { match: '似ている絵柄', uncertain: '画像の一致は不確かです', unavailable: '画像比較を利用できません', guide: 'カード番号と絵柄を登録画像と比較します。候補は確定結果ではありません。小さなマークや再録、商品名はご自身で確認してください。写真は端末内で処理し、比較データとエンジンをダウンロードします。真贋や状態の判定は行いません。' }
      : { match: '유사한 그림', uncertain: '사진 매칭 불확실', unavailable: '사진 비교 사용 불가', guide: '카드번호와 그림을 등록 이미지와 비교합니다. 유사한 그림은 추천 후보이며 확정된 버전이 아닙니다. 연필 마크, 재록 여부와 상품명은 직접 확인해 주세요. 사진은 기기에서 처리하고 비교 데이터와 이미지 엔진을 내려받습니다. 진위나 카드 상태는 판정하지 않습니다.' };
  const dialogRef = useRef(null);
  const videoRef = useRef(null);
  const frameRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const uploadRef = useRef(null);
  const captureRef = useRef(null);
  const jobRef = useRef(0);
  const controllerRef = useRef(null);
  const busy = ['reading', 'preparing', 'requesting', 'matching'].includes(mode);

  function stopCamera() {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    const previousFocus = document.activeElement;
    const mobile = window.matchMedia('(max-width: 767px)');
    const resize = () => { if (!mobile.matches) onClose(); };
    if (!mobile.matches) { onClose(); return; }
    dialogRef.current?.focus();
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const elements = Array.from(dialogRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]') || []).filter(element => element.getClientRects().length);
      const first = elements[0];
      const last = elements[elements.length - 1];
      const outside = !dialogRef.current?.contains(document.activeElement);
      if (event.shiftKey && (outside || document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (outside || document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first?.focus(); }
    };
    const hidden = () => {
      if (document.hidden && streamRef.current) { stopCamera(); setMode('start'); }
    };
    document.addEventListener('keydown', keydown);
    document.addEventListener('visibilitychange', hidden);
    mobile.addEventListener('change', resize);
    void openCamera();
    return () => {
      jobRef.current += 1;
      controllerRef.current?.abort();
      imageSessionRef.current?.dispose();
      stopCamera();
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('visibilitychange', hidden);
      mobile.removeEventListener('change', resize);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    if (mode === 'camera' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => setError(text.cameraError));
    }
  }, [mode]);

  function reset() {
    jobRef.current += 1;
    controllerRef.current?.abort();
    stopCamera();
    canvasRef.current = null;
    setPreview(''); setCode(''); setCodes([]); setVariants([]); setChosen(null); setManual(false); setError(''); setMode('start');
  }

  async function openCamera() {
    controllerRef.current?.abort(); imageSessionRef.current?.dispose(); imageSessionRef.current = null;
    setImageMatches([]); setImageStatus('');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setMode('start'); setError(text.insecure); return; }
    const job = ++jobRef.current;
    setError(''); setPreview(''); setCode(''); setCodes([]); setChosen(null); setVariants([]); setManual(false); setCameraReady(false); setMode('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
      if (job !== jobRef.current || document.hidden) {
        stream.getTracks().forEach(track => track.stop());
        if (job === jobRef.current) setMode('start');
        return;
      }
      streamRef.current = stream;
      setMode('camera');
    } catch (failure) {
      if (job !== jobRef.current) return;
      setMode('start'); setError(failure.name === 'NotAllowedError' ? text.denied : text.cameraError);
    }
  }

  function setPhoto(source, crop = { x: 0, y: 0, width: source.width, height: source.height }) {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 2200 / Math.max(crop.width, crop.height));
    canvas.width = Math.max(1, Math.round(crop.width * scale));
    canvas.height = Math.max(1, Math.round(crop.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
    canvasRef.current = canvas;
    setPreview(canvas.toDataURL('image/jpeg', 0.92)); setCode(''); setCodes([]); setError(''); setMode('review');
    return canvas;
  }

  function capture() {
    const video = videoRef.current;
    if (!video?.videoWidth || !cameraReady) return;
    const view = video.getBoundingClientRect();
    const frame = frameRef.current.getBoundingClientRect();
    const photo = setPhoto(video, getCameraCrop(video.videoWidth, video.videoHeight, view.width, view.height, { x: frame.x - view.x, y: frame.y - view.y, width: frame.width, height: frame.height }));
    stopCamera();
    void readPhoto(photo);
  }

  async function selectFile(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    const issue = validateScanFile(file);
    if (issue) { setError(text[issue]); return; }
    stopCamera();
    const job = ++jobRef.current;
    setMode('preparing'); setError('');
    const url = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = url;
      await image.decode();
      if (job !== jobRef.current) return;
      if (image.naturalWidth * image.naturalHeight > 48000000) throw new Error('decode');
      const photo = setPhoto(image, { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight });
      void readPhoto(photo);
    } catch {
      if (job === jobRef.current) { setError(text.decode); setMode(preview ? 'review' : 'start'); }
    } finally { URL.revokeObjectURL(url); }
  }

  function rotate() {
    const old = canvasRef.current;
    const rotated = document.createElement('canvas'); rotated.width = old.height; rotated.height = old.width;
    const ctx = rotated.getContext('2d'); ctx.translate(rotated.width, 0); ctx.rotate(Math.PI / 2); ctx.drawImage(old, 0, 0);
    void readPhoto(setPhoto(rotated));
  }

  async function findVariants(nextCode, nextLocale, job = ++jobRef.current) {
    setMode('matching'); setChosen(null); setVariants([]); setError(''); setManual(false);
    setImageMatches([]); setImageStatus('');
    try {
      const { default: catalog } = await import('./data/market-cards.js');
      if (job !== jobRef.current) return;
      let matches = [], status = 'unavailable';
      if (imageSessionRef.current) {
        try {
          const result = await imageSessionRef.current.match(nextCode, nextLocale);
          matches = result.matches;
          status = matches.length ? 'matched' : 'uncertain';
        } catch { status = 'unavailable'; }
      }
      if (job !== jobRef.current) return;
      const matchCodes = nextCode ? [nextCode] : [...new Set(matches.map(item => item.code))].slice(0, 3);
      const scoreByKey = new Map(matches.map(item => [item.key, item.score]));
      const items = matchCodes.flatMap(value => getScanVariants(catalog, value, nextLocale));
      items.sort((a, b) => (scoreByKey.get(`${b.locale}-${b.apparelId}`) || 0) - (scoreByKey.get(`${a.locale}-${a.apparelId}`) || 0));
      setImageMatches(matches.map(item => item.key)); setImageStatus(status);
      setVariants(items); setCode(nextCode); setMode('result');
      if (!nextCode && !items.length) { setMode('review'); setManual(true); setError(text.noCode); }
    } catch {
      if (job === jobRef.current) { setMode('review'); setError(text.error); }
    }
  }

  async function readPhoto(photo = canvasRef.current) {
    const job = ++jobRef.current;
    controllerRef.current?.abort(); imageSessionRef.current?.dispose(); imageSessionRef.current = null;
    const controller = new AbortController(); controllerRef.current = controller;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 90000);
    setMode('reading'); setError(''); setCode(''); setCodes([]); setVariants([]); setChosen(null); setManual(false); setProgress({ phase: 'loading', progress: 0 });
    // Prepare artwork in parallel so a slow image engine cannot block number OCR.
    const preparedImage = (async () => {
      let session;
      try {
        const { createCardImageSession } = await import('./lib/card-image-match.js');
        if (job !== jobRef.current || controller.signal.aborted) return null;
        session = createCardImageSession(controller.signal);
        imageSessionRef.current = session;
        return await session.prepare(photo);
      } catch {
        session?.dispose();
        if (imageSessionRef.current === session) imageSessionRef.current = null;
        return null;
      }
    })();
    try {
      const { recognizeCardCodes } = await import('./lib/card-scan-ocr');
      if (job !== jobRef.current) return;
      let ocrFailure;
      const found = await recognizeCardCodes(photo, { signal: controller.signal, getFallbackCanvas: () => preparedImage, onProgress: value => { if (job === jobRef.current) setProgress(value); } }).catch(failure => {
        ocrFailure = failure;
        if (controller.signal.aborted || !imageSessionRef.current) throw failure;
        return [];
      });
      if (job !== jobRef.current) return;
      await preparedImage;
      if (job !== jobRef.current) return;
      setCodes(found);
      if (found.length <= 1) await findVariants(found[0] || '', locale, job);
      else { setMode('review'); setManual(true); if (!found.length) setError(text.noCode); }
      if (ocrFailure && !found.length && !imageSessionRef.current) setError(text.error);
    } catch (failure) {
      if (job !== jobRef.current) return;
      setMode('review'); setError(timedOut ? text.timeout : failure.name === 'AbortError' ? '' : text.error);
    } finally { clearTimeout(timer); }
  }

  function cancelRead() {
    jobRef.current += 1; controllerRef.current?.abort(); imageSessionRef.current?.dispose(); imageSessionRef.current = null; setMode(preview ? 'review' : 'start'); setError('');
  }

  function submit(event) {
    event.preventDefault();
    const found = extractCardCodes(code);
    if (found.length !== 1) { setError(text.invalid); return; }
    void findVariants(found[0], locale);
  }

  return createPortal(
    <div className="renew-modal-backdrop card-scan-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="card-scan-dialog" role="dialog" aria-modal="true" aria-labelledby="card-scan-title" tabIndex={-1} ref={dialogRef}>
        <header><h2 id="card-scan-title">{guide ? text.guide : text.title}</h2><div>{!guide && !busy && mode !== 'camera' ? <button type="button" className="card-scan-link" onClick={() => setGuide(true)}>{text.guide}</button> : null}<button type="button" className="card-scan-close" aria-label={text.close} title={text.close} onClick={onClose}>×</button></div></header>
        {guide ? <div className="card-scan-guide"><button type="button" className="card-scan-link" onClick={() => setGuide(false)}>← {text.back}</button><h3>{text.guideHeading}</h3><ol>{text.guideItems.map((item, index) => <li key={index}>{index === 3 ? imageLabels.guide : item}</li>)}</ol></div> : <>
          <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" aria-label={text.upload} hidden onChange={selectFile} />
          <input ref={captureRef} type="file" accept="image/*" capture="environment" aria-label={text.native} hidden onChange={selectFile} />
          {mode === 'start' ? <div className="card-scan-start"><button type="button" className="card-scan-primary" onClick={openCamera}>{text.camera}</button><button type="button" onClick={() => captureRef.current.click()}>{text.native}</button><button type="button" className="card-scan-link" onClick={() => uploadRef.current.click()}>{text.upload}</button></div> : null}
          {mode === 'camera' ? <><div className="card-scan-camera"><video ref={videoRef} muted autoPlay playsInline onLoadedData={() => setCameraReady(true)} /><div className="card-scan-frame" ref={frameRef} /></div><div className="card-scan-capture-bar"><button type="button" className="card-scan-link" onClick={() => { stopCamera(); setMode('start'); uploadRef.current.click(); }}>{text.upload}</button><button type="button" className="card-scan-shutter" title={text.capture} aria-label={text.capture} disabled={!cameraReady} onClick={capture}><span /></button><span aria-hidden="true" /></div></> : null}
          {preview && ['reading', 'preparing', 'review', 'matching'].includes(mode) ? <div className={`card-scan-preview${busy ? ' is-analyzing' : ''}`}><img src={preview} alt={text.preview} />{!busy ? <button type="button" className="card-scan-rotate" title={text.rotate} aria-label={text.rotate} onClick={rotate}>↻</button> : null}</div> : null}
          {busy ? <div className="card-scan-progress" role="status"><span className="card-scan-spinner" aria-hidden="true" /><strong>{mode === 'reading' ? labels.analyzing : mode === 'matching' ? labels.searching : text.ready}</strong>{mode === 'reading' ? <progress aria-label={labels.analyzing} max="100" value={progress.phase === 'loading' ? undefined : progress.progress} /> : null}<button type="button" className="card-scan-link" onClick={cancelRead}>{text.cancel}</button></div> : null}
          {mode === 'result' ? <div className="card-scan-results">
            <div className="card-scan-result-heading"><div><small>{code}</small><h3>{chosen ? labels.matches : labels.variants}</h3></div><button type="button" className="card-scan-link" onClick={openCamera}>{labels.retry}</button></div>
            {!chosen ? <><div className="card-scan-locale" aria-label={text.locale}>{[['JP', text.jp], ['EN', text.en]].map(([value, label]) => <button type="button" key={value} aria-pressed={locale === value} onClick={() => { setLocale(value); void findVariants(code, value); }}>{label}</button>)}</div>
              {imageStatus && imageStatus !== 'matched' ? <p className="card-scan-match-status" role="status">{imageLabels[imageStatus]}</p> : null}
              {!variants.length ? <p role="status">{labels.empty}</p> : <div className="card-scan-variants">{variants.map(item => <button type="button" key={item.apparelId} onClick={() => { setChosen(item); dialogRef.current.scrollTop = 0; }}><img src={item.previewImageUrl || '/card-placeholder.svg'} alt={item.name} loading="lazy" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/card-placeholder.svg'; }} />{imageMatches.includes(`${item.locale}-${item.apparelId}`) ? <small className="card-scan-image-match">{imageLabels.match}</small> : null}<span>{item.name}</span><small>{item.setName}</small></button>)}</div>}
              <button type="button" className="card-scan-link" onClick={() => { setManual(true); setMode('review'); }}>{labels.manual}</button>
            </> : <div className="card-scan-chosen"><img src={chosen.previewImageUrl || '/card-placeholder.svg'} alt={chosen.name} /><h3>{chosen.name}</h3><p>{chosen.setName}</p><div className="card-scan-decision"><button type="button" className="card-scan-primary" onClick={() => onSelect(chosen, variants)}>{labels.confirm}</button><button type="button" className="card-scan-link" onClick={() => setChosen(null)}>{labels.change}</button></div></div>}
          </div> : null}
          {mode === 'review' ? <div className="card-scan-actions"><button type="button" className="card-scan-primary" onClick={openCamera}>{labels.retry}</button><button type="button" onClick={() => uploadRef.current.click()}>{text.upload}</button></div> : null}
          {error ? <p className="card-scan-error" role="alert">{error}</p> : null}
          {!busy && ['start', 'review'].includes(mode) && !manual ? <button type="button" className="card-scan-link" onClick={() => setManual(true)}>{labels.manual}</button> : null}
          {!busy && manual ? <form className="card-scan-confirm" onSubmit={submit}>
            {codes.length > 1 ? <fieldset><legend>{text.multiple}</legend><div className="card-scan-code-options">{codes.map(item => <label key={item}><input type="radio" name="scanned-code" checked={code === item} onChange={() => setCode(item)} />{item}</label>)}</div></fieldset> : null}
            <label htmlFor="card-scan-code">{text.code}</label><input id="card-scan-code" value={code} onChange={event => setCode(event.target.value)} placeholder="OP01-120" autoCapitalize="characters" autoCorrect="off" spellCheck={false} maxLength={20} />
            <fieldset><legend>{text.locale}</legend><div className="card-scan-locale">{[['JP', text.jp], ['EN', text.en]].map(([value, label]) => <button type="button" key={value} aria-pressed={locale === value} onClick={() => setLocale(value)}>{label}</button>)}</div></fieldset>
            <button type="submit" className="card-scan-primary" disabled={!code.trim()}>{text.search}</button>
          </form> : null}
        </>}
      </section>
    </div>, document.querySelector('.renew-app') || document.body
  );
}
