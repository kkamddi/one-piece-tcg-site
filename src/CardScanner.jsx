import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { extractCardCodes, getCameraCrop, getScanVariants, validateScanFile } from './lib/card-scan';
import { canShowCandidatePrice } from '../extensions/card-pone/result-confidence.js';
import { resultLinks } from '../extensions/card-pone/result-links.js';
import { formatPriceWon, priceSummary } from '../extensions/card-pone/prices.js';
import './card-scanner.css';

const COPY = {
  KR: {
    title: '카드 스캔', guide: '사용 가이드', close: '닫기', camera: '카메라 켜기', upload: '사진 선택', capture: '촬영', native: '휴대폰 카메라로 촬영', rotate: '사진 회전', read: '카드번호 읽기', retake: '다시 선택', cancel: '취소', code: '카드번호 확인', locale: '시세 기준 언어', jp: '일본판', en: '영문판', search: '카드 찾기', loading: '인식 엔진 준비 중', reading: '카드번호 읽는 중', notFound: '이 번호와 일치하는 카드가 없습니다. 번호를 다시 확인해 주세요.', noCode: '카드번호를 찾지 못했습니다. 사진을 다시 찍거나 번호를 입력해 주세요.', invalid: '카드번호를 확인해 주세요. 예: OP01-120', file: 'JPG, PNG, WebP 사진을 선택해 주세요.', size: '15MB 이하 사진을 선택해 주세요.', decode: '이 사진을 열 수 없습니다. JPG 또는 PNG로 다시 선택해 주세요.', denied: '카메라 권한이 차단되어 있습니다. 브라우저 설정에서 허용하거나 사진을 선택해 주세요.', cameraError: '카메라를 열 수 없습니다. 다른 앱의 카메라를 닫거나 사진을 선택해 주세요.', insecure: '카메라는 HTTPS에서 사용할 수 있습니다. 사진 선택이나 휴대폰 카메라 촬영을 이용해 주세요.', timeout: '인식 시간이 초과됐습니다. 카드번호가 선명하게 보이도록 다시 촬영해 주세요.', error: '인식 엔진을 실행하지 못했습니다. 인터넷 연결을 확인하거나 카드번호를 입력해 주세요.', preview: '촬영한 카드', ready: '사진 준비 중', multiple: '여러 카드번호가 발견됐습니다.', guideHeading: '카드 촬영과 시세 확인', guideItems: ['카드 한 장을 밝은 곳에서 촬영하고 네 모서리를 프레임에 맞춥니다. 슬리브 반사와 흔들림을 줄여 주세요.', '아래쪽 카드번호가 선명해야 합니다. 사진 선택 후 회전할 수 있으며, 번호를 직접 수정할 수도 있습니다.', '사진은 이 브라우저에서 처리하며 서버로 전송하거나 저장하지 않습니다. 첫 인식에는 OCR 엔진과 영어 문자 모델 다운로드를 위한 인터넷 연결이 필요합니다.', '카드번호만 읽는 기능입니다. 같은 번호의 다른 그림, 패러렐, 재록은 다음 화면의 이미지와 상품명으로 확인해 주세요. 진위나 PSA 등급을 판정하지 않습니다.', '일본판·영문판 후보를 함께 찾습니다. 가격은 SNKRDUNK 최근 거래일 중앙값(Single·PSA10, 1엔=9.4원)이며 한국어판 카드 가격으로 간주하면 안 됩니다.'], back: '스캔으로 돌아가기'
  },
  EN: {
    title: 'Scan card', guide: 'Guide', close: 'Close', camera: 'Open camera', upload: 'Choose photo', capture: 'Capture', native: 'Take a phone photo', rotate: 'Rotate photo', read: 'Read card number', retake: 'Choose again', cancel: 'Cancel', code: 'Confirm card number', locale: 'Price language', jp: 'Japanese', en: 'English', search: 'Find card', loading: 'Loading recognition engine', reading: 'Reading card number', notFound: 'No card matches this number. Check the number and try again.', noCode: 'No card number found. Retake the photo or enter the number.', invalid: 'Check the card number, e.g. OP01-120.', file: 'Choose a JPG, PNG or WebP photo.', size: 'Choose a photo smaller than 15MB.', decode: 'Cannot open this photo. Try JPG or PNG.', denied: 'Camera permission is blocked. Allow it in browser settings or choose a photo.', cameraError: 'Cannot open the camera. Close other camera apps or choose a photo.', insecure: 'The camera requires HTTPS. Choose a photo or use the phone camera option.', timeout: 'Recognition timed out. Retake a clear photo of the card number.', error: 'Cannot run recognition. Check your connection or enter the card number.', preview: 'Card photo', ready: 'Preparing photo', multiple: 'Multiple card numbers found.', guideHeading: 'Capture and identify a card', guideItems: ['Photograph one card in good light with all four corners inside the frame. Avoid glare and motion blur.', 'Keep the printed card number sharp. Rotate the photo or correct the number manually as needed.', 'Photos are processed in this browser, not uploaded or stored on a server. The first scan needs internet to download the OCR engine and English character model.', 'Recognition reads the number, not the art variant. Compare images and product names on the next screen. It does not authenticate cards or assign PSA grades.', 'Japanese and English versions are searched together. Prices are the SNKRDUNK median of the latest trade day (Single and PSA10) and are not Korean card prices.'], back: 'Back to scan'
  },
  JP: {
    title: 'カードスキャン', guide: '使い方', close: '閉じる', camera: 'カメラを開く', upload: '写真を選ぶ', capture: '撮影', native: '端末のカメラで撮影', rotate: '写真を回転', read: 'カード番号を読み取る', retake: '選び直す', cancel: 'キャンセル', code: 'カード番号の確認', locale: '相場の言語', jp: '日本語版', en: '英語版', search: 'カードを探す', loading: '認識エンジンを準備中', reading: 'カード番号を読取中', notFound: 'この番号に一致するカードがありません。番号をご確認ください。', noCode: 'カード番号が見つかりません。撮り直すか番号を入力してください。', invalid: 'カード番号を確認してください。例: OP01-120', file: 'JPG、PNG、WebPの写真を選んでください。', size: '15MB以下の写真を選んでください。', decode: '写真を開けません。JPGかPNGを選んでください。', denied: 'カメラが許可されていません。設定で許可するか写真を選んでください。', cameraError: 'カメラを開けません。他のカメラアプリを閉じるか写真を選んでください。', insecure: 'カメラにはHTTPSが必要です。写真選択か端末カメラをご利用ください。', timeout: '認識がタイムアウトしました。番号が鮮明に見えるよう撮り直してください。', error: '認識を実行できません。通信を確認するか番号を入力してください。', preview: 'カードの写真', ready: '写真を準備中', multiple: '複数のカード番号が見つかりました。', guideHeading: 'カード撮影と相場の確認', guideItems: ['明るい場所でカード1枚を撮影し、四隅を枠に合わせます。反射や手ぶれを避けてください。', '下部のカード番号を鮮明に撮影してください。写真の回転や番号の手動修正も可能です。', '写真はブラウザ内で処理し、サーバーへ送信・保存しません。初回はOCRエンジンと英語文字モデルのダウンロードに通信が必要です。', '番号の読取機能です。絵柄や再録の違いは次の画面の画像と商品名で確認してください。真贋やPSAグレードは判定しません。', '日本語版と英語版の候補を同時に探します。相場はSNKRDUNKの直近取引日の中央値（Single・PSA10）で、韓国語版の価格とは異なります。'], back: 'スキャンに戻る'
  }
};

const PRICE_COPY = {
  KR: { loading: '시세 불러오는 중…', error: '시세를 불러오지 못했습니다.', retry: '다시 시도', noTrade: '거래 기록 없음', none: '시세 없음' },
  EN: { loading: 'Loading prices…', error: 'Could not load prices.', retry: 'Retry', noTrade: 'No trades', none: 'No price' },
  JP: { loading: '相場を読み込み中…', error: '相場を読み込めませんでした。', retry: '再試行', noTrade: '取引記録なし', none: '相場なし' }
};

// Recognition warnings come in Korean; EN/JP get these translations and a generic line for the rest.
const WARNING_COPY = {
  '이미지 비교 엔진을 실행하지 못했습니다.': { EN: 'Image comparison could not start.', JP: '画像比較エンジンを起動できませんでした。' },
  '카드번호를 읽지 못해 이미지로 검색했습니다.': { EN: "Couldn't read the card number, so it searched by image.", JP: 'カード番号を読み取れなかったため、画像で検索しました。' }
};

function ScanPrices({ apparelId, uiLang }) {
  const text = PRICE_COPY[uiLang] || PRICE_COPY.KR;
  const [state, setState] = useState({ loading: true });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true });
    fetch(`/api/market?summary=trade-latest&apparelIds=${apparelId}`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('price_unavailable'); return response.json(); })
      .then(payload => { if (!controller.signal.aborted) setState({ data: priceSummary(payload, apparelId) }); })
      .catch(() => { if (!controller.signal.aborted) setState({ error: true }); });
    return () => controller.abort();
  }, [apparelId, attempt]);
  // Korean UI follows the extension's won conversion; other languages keep the source yen.
  const money = value => !(value > 0) ? text.none : uiLang === 'EN' || uiLang === 'JP' ? `¥${Math.round(value).toLocaleString('ja-JP')}` : formatPriceWon(value);
  if (state.loading) return <p className="card-scan-price-note" role="status">{text.loading}</p>;
  if (state.error) return <p className="card-scan-price-note" role="status">{text.error} <button type="button" className="card-scan-link" onClick={() => setAttempt(value => value + 1)}>{text.retry}</button></p>;
  return <dl className="card-scan-prices">{[['Single', state.data.single, state.data.singleDate], ['PSA10', state.data.psa10, state.data.psa10Date]].map(([label, value, date]) => <div key={label}><dt>{label}</dt><dd>{money(value)}</dd><small>{date || text.noTrade}</small></div>)}</dl>;
}

function CandidateImage({ candidate }) {
  const [index, setIndex] = useState(0);
  const src = candidate.images[index] || '/card-placeholder.svg';
  // SNKRDUNK product photos pad the card with white space; fill the frame like the rest of the site.
  return <span className="card-scan-candidate-image"><img src={src} data-product-photo={String(src.includes('cdn.snkrdunk.com/upload_bg_removed/'))} alt={candidate.name || candidate.code} loading="lazy" referrerPolicy="no-referrer" onError={() => setIndex(value => value < candidate.images.length ? value + 1 : value)} /></span>;
}

export default function CardScanner({ uiLang, initialLocale, onClose, onSelect, onOpenCatalog }) {
  const text = COPY[uiLang] || COPY.KR;
  const labels = uiLang === 'EN'
    ? { analyzing: 'Analyzing...', candidates: 'Card matches', codeOnly: 'Number match only', checkPrice: 'Check price for this card', chart: 'Chart & trades', catalog: 'View in catalog', catalogSearch: 'Search catalog', more: 'More matches', incomplete: 'Some comparison data could not be loaded.', manual: 'Enter card number', retry: 'Retake', searching: 'Finding card...' }
    : uiLang === 'JP'
      ? { analyzing: '解析中...', candidates: 'カード候補', codeOnly: '番号のみ一致', checkPrice: 'このカードの相場を見る', chart: 'チャート・取引履歴', catalog: '図鑑で見る', catalogSearch: '図鑑で検索', more: '候補をもっと見る', incomplete: '一部の比較データを読み込めませんでした。', manual: '番号を入力', retry: '撮り直す', searching: 'カードを検索中...' }
      : { analyzing: '분석 중...', candidates: '카드 후보', codeOnly: '카드번호만 일치', checkPrice: '이 카드로 시세 확인', chart: '차트·거래 내역', catalog: '도감 보기', catalogSearch: '도감 검색', more: '후보 더 보기', incomplete: '일부 비교 자료를 불러오지 못했습니다.', manual: '카드번호 직접 입력', retry: '다시 촬영', searching: '카드 찾는 중...' };
  const imageGuide = uiLang === 'EN'
    ? 'The card number and artwork are compared with catalog images. A number match only means the artwork was not confirmed. Check small marks, reprints and product names yourself. Photos are processed on this device; comparison data and the image engine are downloaded. This does not authenticate cards or grade their condition.'
    : uiLang === 'JP'
      ? 'カード番号と絵柄を登録画像と比較します。「番号のみ一致」は絵柄が確認できなかった候補です。小さなマークや再録、商品名はご自身で確認してください。写真は端末内で処理し、比較データとエンジンをダウンロードします。真贋や状態の判定は行いません。'
      : '카드번호와 그림을 등록 이미지와 비교합니다. "카드번호만 일치"는 그림이 확인되지 않은 후보입니다. 연필 마크, 재록 여부와 상품명은 직접 확인해 주세요. 사진은 기기에서 처리하고 비교 데이터와 이미지 엔진을 내려받습니다. 진위나 카드 상태는 판정하지 않습니다.';
  const preferredLocale = initialLocale === 'EN' ? 'EN' : 'JP';
  const [mode, setMode] = useState('requesting');
  const [guide, setGuide] = useState(false);
  const [preview, setPreview] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [manual, setManual] = useState(false);
  const [result, setResult] = useState(null);
  const [confirmedKey, setConfirmedKey] = useState(null);
  const [limit, setLimit] = useState(3);
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
    void import('./lib/card-recognition-lab.js').then(module => module.warmRecognition());
    return () => {
      jobRef.current += 1;
      controllerRef.current?.abort();
      stopCamera();
      void import('./lib/card-recognition-lab.js').then(module => module.releaseRecognition());
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

  function clearResult() {
    setResult(null); setConfirmedKey(null); setLimit(3);
  }

  async function openCamera() {
    controllerRef.current?.abort();
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setMode('start'); setError(text.insecure); return; }
    const job = ++jobRef.current;
    setError(''); setPreview(''); setCode(''); clearResult(); setManual(false); setCameraReady(false); setMode('requesting');
    canvasRef.current = null;
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
    setPreview(canvas.toDataURL('image/jpeg', 0.92)); setCode(''); setError(''); setMode('review');
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

  function showResult(found) {
    // Artwork evidence keeps its rank; number-only ties start with the market's current language.
    const local = item => !item.artwork && item.locale === preferredLocale ? -1 : 0;
    const candidates = found.candidates.slice().sort((a, b) => Number(b.artwork) - Number(a.artwork) || local(a) - local(b));
    if (!candidates.length) {
      clearResult(); setManual(true); setMode(canvasRef.current ? 'review' : 'start');
      setError(found.warnings.length ? text.error : found.codes?.length ? text.notFound : text.noCode);
      return;
    }
    setResult({ ...found, candidates }); setConfirmedKey(null); setLimit(3); setMode('result');
  }

  // Same recognition as the extension: OCR and artwork cross-checked across JP and EN.
  async function readPhoto(photo = canvasRef.current, typedCode = '') {
    const job = ++jobRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController(); controllerRef.current = controller;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 90000);
    setMode('reading'); setError(''); clearResult(); setManual(false);
    try {
      const { recognizeForLab } = await import('./lib/card-recognition-lab.js');
      if (job !== jobRef.current) return;
      const found = await recognizeForLab(photo, { signal: controller.signal, locale: 'auto', code: typedCode });
      if (job !== jobRef.current) return;
      showResult(found);
    } catch (failure) {
      if (job !== jobRef.current) return;
      setMode('review'); setError(timedOut ? text.timeout : failure.name === 'AbortError' ? '' : text.error);
    } finally { clearTimeout(timer); }
  }

  // A typed number without a photo can only match by number, so every result needs confirmation.
  async function findByCode(value) {
    const job = ++jobRef.current;
    setMode('matching'); setError(''); clearResult();
    try {
      const [{ buildRecognitionCandidates }, { default: market }, { default: links }, { default: cards }, { default: special }] = await Promise.all([
        import('./lib/card-recognition-lab.js'), import('./data/market-cards.js'), import('./data/card-market-links.js'), import('./data/cards.json'), import('./data/special-promo-cards.js')
      ]);
      if (job !== jobRef.current) return;
      showResult({ codes: [value], candidates: buildRecognitionCandidates({ codes: [value], market, links, cards: [...cards, ...special] }), warnings: [] });
    } catch {
      if (job === jobRef.current) { setMode('start'); setManual(true); setError(text.error); }
    }
  }

  function cancelRead() {
    jobRef.current += 1; controllerRef.current?.abort(); setMode(preview ? 'review' : 'start'); setError('');
  }

  function submit(event) {
    event.preventDefault();
    const found = extractCardCodes(code);
    if (found.length !== 1) { setError(text.invalid); return; }
    if (canvasRef.current) void readPhoto(canvasRef.current, found[0]);
    else void findByCode(found[0]);
  }

  async function openPrice(candidate) {
    const { default: catalog } = await import('./data/market-cards.js');
    const variants = getScanVariants(catalog, candidate.code, candidate.locale);
    const chosen = variants.find(entry => Number(entry.apparelId) === candidate.apparelId);
    if (chosen) onSelect(chosen, variants);
  }

  function openCatalog(candidate, exact) {
    const card = exact ? candidate.catalogCards[0] : null;
    onOpenCatalog?.({ id: card?.id || '', locale: card?.locale || (candidate.locale === 'KR' ? 'KR' : 'JP'), code: candidate.code });
  }

  const localizeWarning = message => uiLang === 'EN' || uiLang === 'JP' ? WARNING_COPY[message]?.[uiLang] || labels.incomplete : message;
  const warning = result?.warnings.length ? [...new Set(result.warnings.map(localizeWarning))].join(' ') : '';

  return createPortal(
    <div className="renew-modal-backdrop card-scan-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="card-scan-dialog" role="dialog" aria-modal="true" aria-labelledby="card-scan-title" tabIndex={-1} ref={dialogRef}>
        <header><h2 id="card-scan-title">{guide ? text.guide : text.title}</h2><div>{!guide && !busy && mode !== 'camera' ? <button type="button" className="card-scan-link" onClick={() => setGuide(true)}>{text.guide}</button> : null}<button type="button" className="card-scan-close" aria-label={text.close} title={text.close} onClick={onClose}>×</button></div></header>
        {guide ? <div className="card-scan-guide"><button type="button" className="card-scan-link" onClick={() => setGuide(false)}>← {text.back}</button><h3>{text.guideHeading}</h3><ol>{text.guideItems.map((item, index) => <li key={index}>{index === 3 ? imageGuide : item}</li>)}</ol></div> : <>
          <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" aria-label={text.upload} hidden onChange={selectFile} />
          <input ref={captureRef} type="file" accept="image/*" capture="environment" aria-label={text.native} hidden onChange={selectFile} />
          {mode === 'start' ? <div className="card-scan-start"><button type="button" className="card-scan-primary" onClick={openCamera}>{text.camera}</button><button type="button" onClick={() => captureRef.current.click()}>{text.native}</button><button type="button" className="card-scan-link" onClick={() => uploadRef.current.click()}>{text.upload}</button></div> : null}
          {mode === 'camera' ? <><div className="card-scan-camera"><video ref={videoRef} muted autoPlay playsInline onLoadedData={() => setCameraReady(true)} /><div className="card-scan-frame" ref={frameRef} /></div><div className="card-scan-capture-bar"><button type="button" className="card-scan-link" onClick={() => { stopCamera(); setMode('start'); uploadRef.current.click(); }}>{text.upload}</button><button type="button" className="card-scan-shutter" title={text.capture} aria-label={text.capture} disabled={!cameraReady} onClick={capture}><span /></button><span aria-hidden="true" /></div></> : null}
          {preview && ['reading', 'preparing', 'review', 'matching'].includes(mode) ? <div className={`card-scan-preview${busy ? ' is-analyzing' : ''}`}><img src={preview} alt={text.preview} />{!busy ? <button type="button" className="card-scan-rotate" title={text.rotate} aria-label={text.rotate} onClick={rotate}>↻</button> : null}</div> : null}
          {busy ? <div className="card-scan-progress" role="status"><span className="card-scan-spinner" aria-hidden="true" /><strong>{mode === 'reading' ? labels.analyzing : mode === 'matching' ? labels.searching : text.ready}</strong>{mode === 'reading' ? <progress aria-label={labels.analyzing} max="100" /> : null}<button type="button" className="card-scan-link" onClick={cancelRead}>{text.cancel}</button></div> : null}
          {mode === 'result' && result ? <div className="card-scan-results">
            <div className="card-scan-result-heading"><h3>{labels.candidates} <small>{result.candidates.length}</small></h3><button type="button" className="card-scan-link" onClick={openCamera}>{labels.retry}</button></div>
            {warning ? <p className="card-scan-match-status" role="status">{warning}</p> : null}
            <div className="card-scan-candidates">{result.candidates.slice(0, limit).map(candidate => {
              const links = resultLinks(candidate);
              const showPrice = canShowCandidatePrice(result, candidate, confirmedKey);
              const exactCatalog = links?.catalogLabel === '도감 보기';
              return <article className="card-scan-candidate" key={candidate.key}>
                <CandidateImage candidate={candidate} />
                <div>
                  <p className="card-scan-candidate-code">{candidate.code}<span>{candidate.locale}</span></p>
                  <h4>{candidate.name}</h4>
                  <small>{candidate.setName}</small>
                  {!candidate.artwork ? <p className="card-scan-warning">{labels.codeOnly}</p> : null}
                  {links?.price && !showPrice ? <button type="button" onClick={() => setConfirmedKey(candidate.key)}>{labels.checkPrice}</button> : null}
                  {links?.price && showPrice ? <ScanPrices key={candidate.key} apparelId={candidate.apparelId} uiLang={uiLang} /> : null}
                  {links ? <div className="card-scan-candidate-actions">
                    {links.catalog ? <button type="button" className="card-scan-link" onClick={() => openCatalog(candidate, exactCatalog)}>{exactCatalog ? labels.catalog : labels.catalogSearch}</button> : null}
                    {links.price && showPrice ? <button type="button" className="card-scan-link" onClick={() => void openPrice(candidate)}>{labels.chart}</button> : null}
                  </div> : null}
                </div>
              </article>;
            })}</div>
            {result.candidates.length > limit ? <button type="button" className="card-scan-more" onClick={() => setLimit(value => value + 5)}>{labels.more}</button> : null}
            <button type="button" className="card-scan-link" onClick={() => { setManual(true); setMode(canvasRef.current ? 'review' : 'start'); }}>{labels.manual}</button>
          </div> : null}
          {mode === 'review' ? <div className="card-scan-actions"><button type="button" className="card-scan-primary" onClick={openCamera}>{labels.retry}</button><button type="button" onClick={() => uploadRef.current.click()}>{text.upload}</button></div> : null}
          {error ? <p className="card-scan-error" role="alert">{error}</p> : null}
          {!busy && ['start', 'review'].includes(mode) && !manual ? <button type="button" className="card-scan-link" onClick={() => setManual(true)}>{labels.manual}</button> : null}
          {!busy && manual && mode !== 'result' ? <form className="card-scan-confirm" onSubmit={submit}>
            <label htmlFor="card-scan-code">{text.code}</label><input id="card-scan-code" value={code} onChange={event => setCode(event.target.value)} placeholder="OP01-120" autoCapitalize="characters" autoCorrect="off" spellCheck={false} maxLength={20} />
            <button type="submit" className="card-scan-primary" disabled={!code.trim()}>{text.search}</button>
          </form> : null}
        </>}
      </section>
    </div>, document.querySelector('.renew-app') || document.body
  );
}
