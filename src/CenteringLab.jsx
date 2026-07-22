import React, { useEffect, useMemo, useRef, useState } from 'react';
import './centering-lab.css';

const CARD_WIDTH_MM = 63;
const CARD_HEIGHT_MM = 88;
const CAPTURE_WIDTH = 630;
const CAPTURE_HEIGHT = 880;
const AUTO_CAPTURE_HOLD_MS = 1100;

const COPY = {
  KR: {
    eyebrow: 'CARD LAB',
    title: '센터링 측정기',
    intro: '카드를 가이드에 맞춰 촬영하면 앞면의 좌우·상하 인쇄 비율을 기기 안에서 분석합니다.',
    start: '카메라로 측정하기',
    privacy: '촬영 이미지는 서버에 저장하거나 전송하지 않습니다.',
    guideTitle: '측정 전 확인',
    guideItems: ['슬리브와 탑로더를 제거해 주세요.', '반사가 적은 어두운 단색 바닥에 카드를 놓아 주세요.', '휴대폰과 카드가 평행하도록 위에서 촬영해 주세요.'],
    cameraTitle: '카드를 선 안에 맞춰주세요',
    cameraBody: '네 모서리가 흰색 가이드와 일치하면 잠시 고정해 주세요.',
    manualCapture: '지금 촬영',
    cancel: '취소',
    analyzing: '센터링 분석 중',
    analyzingBody: '촬영 영역을 정리하고 인쇄 경계를 확인하고 있습니다.',
    resultEyebrow: 'CENTERING REPORT',
    resultTitle: '센터링 진단서',
    score: '센터링 점수',
    horizontal: '좌우 비율',
    vertical: '상하 비율',
    confidence: '측정 신뢰도',
    retake: '다시 촬영',
    adjust: '인쇄 경계 조정',
    adjustHelp: '자동 경계선이 인쇄 영역과 다르면 슬라이더로 선을 맞춰 주세요.',
    left: '왼쪽',
    right: '오른쪽',
    top: '위',
    bottom: '아래',
    reference: '센터링 참고 구간',
    notice: '센터링만 분석한 참고값입니다. 표면, 모서리, 인쇄 상태와 감정사의 판단은 포함하지 않으므로 실제 PSA 등급을 보장하지 않습니다.',
    official: 'PSA 공식 센터링 기준 보기',
    permissionDenied: '카메라 권한이 차단되어 있습니다. 브라우저의 사이트 설정에서 카메라를 허용한 뒤 다시 시도해 주세요.',
    cameraUnavailable: '사용 가능한 카메라를 찾지 못했습니다. 카메라가 연결된 기기에서 다시 시도해 주세요.',
    cameraError: '카메라를 시작하지 못했습니다. 다른 앱이 카메라를 사용 중인지 확인해 주세요.',
    retry: '다시 시도',
    qualityAlign: '구도',
    qualityLight: '밝기',
    qualityStill: '고정',
    ready: '좋음',
    wait: '확인 중',
    alignCard: '카드 모서리를 맞춰주세요',
    tooDark: '조금 더 밝게 해주세요',
    tooBright: '빛 반사를 줄여주세요',
    holdStill: '휴대폰을 고정해 주세요',
    focus: '초점을 맞추고 있습니다',
    autoReady: '그대로 유지하면 자동 촬영됩니다',
    lowConfidence: '자동 경계 인식이 불확실합니다. 인쇄 경계선을 확인해 주세요.',
    highConfidence: '인쇄 경계가 안정적으로 인식되었습니다.',
    localOnly: '기기 내 분석'
  },
  EN: {
    eyebrow: 'CARD LAB', title: 'Centering Check', intro: 'Align the card with the guide to analyze front left/right and top/bottom print ratios on your device.', start: 'Start camera check', privacy: 'Images stay on this device and are never uploaded.', guideTitle: 'Before measuring', guideItems: ['Remove sleeves and top loaders.', 'Use a dark, plain surface with minimal glare.', 'Keep the phone parallel to the card.'], cameraTitle: 'Align the card inside the guide', cameraBody: 'Hold still when all four corners match the white guide.', manualCapture: 'Capture now', cancel: 'Cancel', analyzing: 'Analyzing centering', analyzingBody: 'Preparing the captured frame and locating print boundaries.', resultEyebrow: 'CENTERING REPORT', resultTitle: 'Centering report', score: 'Centering score', horizontal: 'Left / right', vertical: 'Top / bottom', confidence: 'Confidence', retake: 'Retake', adjust: 'Adjust print boundaries', adjustHelp: 'Move the lines if automatic boundaries do not match the printed area.', left: 'Left', right: 'Right', top: 'Top', bottom: 'Bottom', reference: 'Centering reference', notice: 'This is a centering-only estimate. It does not evaluate surface, corners, printing defects, or grader discretion and does not guarantee a PSA grade.', official: 'View PSA centering standards', permissionDenied: 'Camera access is blocked. Allow camera access in site settings and try again.', cameraUnavailable: 'No camera is available on this device.', cameraError: 'The camera could not start. Check whether another app is using it.', retry: 'Try again', qualityAlign: 'Frame', qualityLight: 'Light', qualityStill: 'Still', ready: 'Good', wait: 'Checking', alignCard: 'Match the card corners', tooDark: 'Add more light', tooBright: 'Reduce glare', holdStill: 'Hold the phone still', focus: 'Focusing', autoReady: 'Hold still for automatic capture', lowConfidence: 'Automatic boundary detection is uncertain. Check the print boundary lines.', highConfidence: 'Print boundaries were detected consistently.', localOnly: 'On-device analysis'
  },
  JP: {
    eyebrow: 'CARD LAB', title: 'センタリング測定', intro: 'カードをガイドに合わせて撮影し、表面の左右・上下の印刷比率を端末内で分析します。', start: 'カメラで測定する', privacy: '撮影画像はサーバーへ保存・送信しません。', guideTitle: '測定前の確認', guideItems: ['スリーブとローダーを外してください。', '反射の少ない暗い単色の台に置いてください。', 'スマートフォンとカードを平行にしてください。'], cameraTitle: 'カードを枠内に合わせてください', cameraBody: '四隅を白いガイドに合わせ、そのまま固定してください。', manualCapture: '今すぐ撮影', cancel: 'キャンセル', analyzing: 'センタリング分析中', analyzingBody: '撮影範囲を整え、印刷境界を確認しています。', resultEyebrow: 'CENTERING REPORT', resultTitle: 'センタリング診断', score: 'センタリングスコア', horizontal: '左右比率', vertical: '上下比率', confidence: '測定信頼度', retake: '撮り直す', adjust: '印刷境界を調整', adjustHelp: '自動境界線が印刷領域と異なる場合はスライダーで調整してください。', left: '左', right: '右', top: '上', bottom: '下', reference: 'センタリング参考範囲', notice: 'センタリングのみの参考値です。表面、角、印刷状態、鑑定士の判断は含まず、PSAグレードを保証しません。', official: 'PSA公式基準を見る', permissionDenied: 'カメラ権限がブロックされています。サイト設定でカメラを許可してから再試行してください。', cameraUnavailable: '利用可能なカメラが見つかりません。', cameraError: 'カメラを開始できませんでした。他のアプリが使用していないか確認してください。', retry: '再試行', qualityAlign: '構図', qualityLight: '明るさ', qualityStill: '固定', ready: '良好', wait: '確認中', alignCard: 'カードの四隅を合わせてください', tooDark: 'もう少し明るくしてください', tooBright: '反射を減らしてください', holdStill: '端末を固定してください', focus: 'ピントを合わせています', autoReady: 'そのまま固定すると自動撮影します', lowConfidence: '自動境界認識が不確実です。印刷境界線を確認してください。', highConfidence: '印刷境界を安定して認識しました。', localOnly: '端末内分析'
  }
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function drawVideoCover(video, canvas, sourceRect = null) {
  const targetWidth = canvas.width;
  const targetHeight = canvas.height;
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  if (!videoWidth || !videoHeight || !targetWidth || !targetHeight) return false;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!sourceRect) {
    const targetRatio = targetWidth / targetHeight;
    const videoRatio = videoWidth / videoHeight;
    let sx = 0;
    let sy = 0;
    let sw = videoWidth;
    let sh = videoHeight;
    if (videoRatio > targetRatio) {
      sw = videoHeight * targetRatio;
      sx = (videoWidth - sw) / 2;
    } else {
      sh = videoWidth / targetRatio;
      sy = (videoHeight - sh) / 2;
    }
    context.drawImage(video, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
    return true;
  }
  const { viewportWidth, viewportHeight, x, y, width, height } = sourceRect;
  const scale = Math.max(viewportWidth / videoWidth, viewportHeight / videoHeight);
  const renderedWidth = videoWidth * scale;
  const renderedHeight = videoHeight * scale;
  const offsetX = (viewportWidth - renderedWidth) / 2;
  const offsetY = (viewportHeight - renderedHeight) / 2;
  const sx = clamp((x - offsetX) / scale, 0, videoWidth - 1);
  const sy = clamp((y - offsetY) / scale, 0, videoHeight - 1);
  const sw = clamp(width / scale, 1, videoWidth - sx);
  const sh = clamp(height / scale, 1, videoHeight - sy);
  context.drawImage(video, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
  return true;
}

function getLumaData(imageData) {
  const pixels = imageData.data;
  const luma = new Float32Array(imageData.width * imageData.height);
  for (let index = 0, pixel = 0; index < pixels.length; index += 4, pixel += 1) {
    luma[pixel] = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
  }
  return luma;
}

function measureFrame(canvas, guideRect, previousLuma) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const luma = getLumaData(image);
  const x0 = clamp(Math.round(guideRect.x * canvas.width), 2, canvas.width - 3);
  const y0 = clamp(Math.round(guideRect.y * canvas.height), 2, canvas.height - 3);
  const x1 = clamp(Math.round((guideRect.x + guideRect.width) * canvas.width), 2, canvas.width - 3);
  const y1 = clamp(Math.round((guideRect.y + guideRect.height) * canvas.height), 2, canvas.height - 3);
  let brightness = 0;
  let glare = 0;
  let sharpness = 0;
  let motion = 0;
  let count = 0;
  for (let y = y0 + 3; y < y1 - 3; y += 3) {
    for (let x = x0 + 3; x < x1 - 3; x += 3) {
      const index = y * canvas.width + x;
      const value = luma[index];
      brightness += value;
      glare += value > 244 ? 1 : 0;
      sharpness += Math.abs(value - luma[index - 2]) + Math.abs(value - luma[index - canvas.width * 2]);
      if (previousLuma?.length === luma.length) motion += Math.abs(value - previousLuma[index]);
      count += 1;
    }
  }
  const edgeSamples = [];
  const sampleVertical = (x) => {
    for (let y = y0 + Math.round((y1 - y0) * 0.12); y < y1 - Math.round((y1 - y0) * 0.12); y += 4) {
      const index = y * canvas.width + x;
      edgeSamples.push(Math.abs(luma[index + 2] - luma[index - 2]));
    }
  };
  const sampleHorizontal = (y) => {
    for (let x = x0 + Math.round((x1 - x0) * 0.12); x < x1 - Math.round((x1 - x0) * 0.12); x += 4) {
      const index = y * canvas.width + x;
      edgeSamples.push(Math.abs(luma[index + canvas.width * 2] - luma[index - canvas.width * 2]));
    }
  };
  sampleVertical(x0);
  sampleVertical(x1);
  sampleHorizontal(y0);
  sampleHorizontal(y1);
  return {
    luma,
    brightness: brightness / Math.max(count, 1),
    glare: glare / Math.max(count, 1),
    sharpness: sharpness / Math.max(count, 1),
    motion: previousLuma ? motion / Math.max(count, 1) : 99,
    edge: median(edgeSamples)
  };
}

function detectBoundary(luma, width, height, axis, startRatio, endRatio) {
  const size = axis === 'x' ? width : height;
  const crossSize = axis === 'x' ? height : width;
  const start = Math.max(3, Math.round(size * startRatio));
  const end = Math.min(size - 4, Math.round(size * endRatio));
  const scores = [];
  for (let position = start; position <= end; position += 1) {
    let score = 0;
    let count = 0;
    const crossStart = Math.round(crossSize * 0.1);
    const crossEnd = Math.round(crossSize * 0.9);
    for (let cross = crossStart; cross < crossEnd; cross += 2) {
      const index = axis === 'x' ? cross * width + position : position * width + cross;
      const offset = axis === 'x' ? 2 : width * 2;
      score += Math.abs(luma[index + offset] - luma[index - offset]);
      count += 1;
    }
    scores.push({ position, score: score / Math.max(count, 1) });
  }
  const baseline = median(scores.map((item) => item.score));
  const best = scores.reduce((current, item) => item.score > current.score ? item : current, scores[0] || { position: start, score: 0 });
  return {
    position: best.position,
    confidence: clamp((best.score - baseline) / Math.max(best.score + 8, 1), 0, 1)
  };
}

function analyzeCapturedCanvas(canvas) {
  const sample = document.createElement('canvas');
  sample.width = 315;
  sample.height = 440;
  const context = sample.getContext('2d', { willReadFrequently: true });
  context.drawImage(canvas, 0, 0, sample.width, sample.height);
  const image = context.getImageData(0, 0, sample.width, sample.height);
  const luma = getLumaData(image);
  const left = detectBoundary(luma, sample.width, sample.height, 'x', 0.025, 0.22);
  const right = detectBoundary(luma, sample.width, sample.height, 'x', 0.78, 0.975);
  const top = detectBoundary(luma, sample.width, sample.height, 'y', 0.025, 0.22);
  const bottom = detectBoundary(luma, sample.width, sample.height, 'y', 0.78, 0.975);
  const boundaries = {
    left: Number((left.position / sample.width * 100).toFixed(1)),
    right: Number(((sample.width - right.position) / sample.width * 100).toFixed(1)),
    top: Number((top.position / sample.height * 100).toFixed(1)),
    bottom: Number(((sample.height - bottom.position) / sample.height * 100).toFixed(1))
  };
  return {
    boundaries,
    confidence: (left.confidence + right.confidence + top.confidence + bottom.confidence) / 4
  };
}

function getCenteringReport(boundaries) {
  const horizontalTotal = Math.max(boundaries.left + boundaries.right, 0.1);
  const verticalTotal = Math.max(boundaries.top + boundaries.bottom, 0.1);
  const left = boundaries.left / horizontalTotal * 100;
  const right = 100 - left;
  const top = boundaries.top / verticalTotal * 100;
  const bottom = 100 - top;
  const worst = Math.max(left, right, top, bottom);
  const score = Math.round(clamp(100 - Math.max(Math.abs(left - 50), Math.abs(top - 50)) * 2, 0, 100));
  const band = worst <= 55 ? 'PSA 10' : worst <= 60 ? 'PSA 9' : worst <= 65 ? 'PSA 8' : 'OUTSIDE';
  return { left, right, top, bottom, score, band };
}

function CenteringGuide() {
  return (
    <svg className="centering-guide-svg" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
      <rect x="1" y="1" width="98" height="138" rx="3" />
      <path d="M1 18V1h17M82 1h17v17M99 122v17H82M18 139H1v-17" className="is-corner" />
      <rect x="5" y="7" width="90" height="126" rx="2" className="is-inner" />
      <rect x="9" y="13" width="82" height="114" rx="1" className="is-inner is-dashed" />
      <path d="M50 1v138M1 70h98" className="is-axis" />
      <circle cx="50" cy="70" r="3" className="is-center" />
      <text x="50" y="6" textAnchor="middle">63 × 88</text>
      <text x="50" y="136" textAnchor="middle">CARD PONE CENTER</text>
    </svg>
  );
}

function ResultOverlay({ boundaries }) {
  const style = {
    left: `${boundaries.left}%`,
    right: `${boundaries.right}%`,
    top: `${boundaries.top}%`,
    bottom: `${boundaries.bottom}%`
  };
  return (
    <div className="centering-result-overlay" aria-hidden="true">
      <div className="centering-result-boundary" style={style} />
      <span className="centering-result-axis is-vertical" />
      <span className="centering-result-axis is-horizontal" />
      <span className="centering-result-corner is-tl" />
      <span className="centering-result-corner is-tr" />
      <span className="centering-result-corner is-bl" />
      <span className="centering-result-corner is-br" />
    </div>
  );
}

export default function CenteringLab({ uiLang = 'KR' }) {
  const text = COPY[uiLang] || COPY.KR;
  const demoResult = import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('centeringDemo') === 'result';
  const [phase, setPhase] = useState(demoResult ? 'result' : 'intro');
  const [error, setError] = useState('');
  const [quality, setQuality] = useState({ align: false, light: false, still: false, message: text.alignCard });
  const [autoProgress, setAutoProgress] = useState(0);
  const [imageUrl, setImageUrl] = useState('');
  const [boundaries, setBoundaries] = useState(demoResult ? { left: 6.2, right: 5.5, top: 5.8, bottom: 6.1 } : { left: 6, right: 6, top: 6, bottom: 6 });
  const [confidence, setConfidence] = useState(demoResult ? 0.88 : 0);
  const videoRef = useRef(null);
  const viewportRef = useRef(null);
  const guideRef = useRef(null);
  const streamRef = useRef(null);
  const monitorCanvasRef = useRef(null);
  const previousLumaRef = useRef(null);
  const animationRef = useRef(0);
  const stableSinceRef = useRef(0);
  const lastMeasuredRef = useRef(0);
  const captureLockedRef = useRef(false);

  const report = useMemo(() => getCenteringReport(boundaries), [boundaries]);
  const confidencePercent = Math.round(confidence * 100);

  useEffect(() => {
    if (!demoResult) return;
    const canvas = document.createElement('canvas');
    canvas.width = CAPTURE_WIDTH;
    canvas.height = CAPTURE_HEIGHT;
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT);
    gradient.addColorStop(0, '#d55a3e');
    gradient.addColorStop(0.55, '#eee7dc');
    gradient.addColorStop(1, '#2b3442');
    context.fillStyle = gradient;
    context.fillRect(0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT);
    context.strokeStyle = 'rgba(255,255,255,.86)';
    context.lineWidth = 8;
    context.strokeRect(38, 52, 557, 775);
    context.fillStyle = 'rgba(0,0,0,.68)';
    context.font = 'bold 42px sans-serif';
    context.textAlign = 'center';
    context.fillText('CENTERING PREVIEW', CAPTURE_WIDTH / 2, CAPTURE_HEIGHT / 2);
    setImageUrl(canvas.toDataURL('image/jpeg', 0.9));
  }, [demoResult]);

  function stopCamera() {
    window.cancelAnimationFrame(animationRef.current);
    animationRef.current = 0;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    previousLumaRef.current = null;
    stableSinceRef.current = 0;
  }

  useEffect(() => () => stopCamera(), []);

  async function captureCard() {
    if (captureLockedRef.current) return;
    const video = videoRef.current;
    const viewport = viewportRef.current;
    const guide = guideRef.current;
    if (!video?.videoWidth || !viewport || !guide) return;
    captureLockedRef.current = true;
    const viewportBox = viewport.getBoundingClientRect();
    const guideBox = guide.getBoundingClientRect();
    const canvas = document.createElement('canvas');
    canvas.width = CAPTURE_WIDTH;
    canvas.height = CAPTURE_HEIGHT;
    drawVideoCover(video, canvas, {
      viewportWidth: viewportBox.width,
      viewportHeight: viewportBox.height,
      x: guideBox.left - viewportBox.left,
      y: guideBox.top - viewportBox.top,
      width: guideBox.width,
      height: guideBox.height
    });
    stopCamera();
    setPhase('analyzing');
    setAutoProgress(1);
    const url = canvas.toDataURL('image/jpeg', 0.92);
    window.setTimeout(() => {
      const analysis = analyzeCapturedCanvas(canvas);
      setImageUrl(url);
      setBoundaries(analysis.boundaries);
      setConfidence(analysis.confidence);
      setPhase('result');
      captureLockedRef.current = false;
    }, 850);
  }

  function monitorCamera(timestamp) {
    animationRef.current = window.requestAnimationFrame(monitorCamera);
    if (timestamp - lastMeasuredRef.current < 150) return;
    lastMeasuredRef.current = timestamp;
    const video = videoRef.current;
    const viewport = viewportRef.current;
    const guide = guideRef.current;
    if (!video?.videoWidth || !viewport || !guide || captureLockedRef.current) return;
    const viewportBox = viewport.getBoundingClientRect();
    const guideBox = guide.getBoundingClientRect();
    if (!viewportBox.width || !viewportBox.height) return;
    const canvas = monitorCanvasRef.current || document.createElement('canvas');
    monitorCanvasRef.current = canvas;
    canvas.width = 220;
    canvas.height = Math.max(180, Math.round(220 * viewportBox.height / viewportBox.width));
    drawVideoCover(video, canvas);
    const guideRect = {
      x: (guideBox.left - viewportBox.left) / viewportBox.width,
      y: (guideBox.top - viewportBox.top) / viewportBox.height,
      width: guideBox.width / viewportBox.width,
      height: guideBox.height / viewportBox.height
    };
    const metrics = measureFrame(canvas, guideRect, previousLumaRef.current);
    previousLumaRef.current = metrics.luma;
    const align = metrics.edge >= 2.2;
    const light = metrics.brightness >= 48 && metrics.brightness <= 222 && metrics.glare <= 0.17;
    const focused = metrics.sharpness >= 7;
    const still = metrics.motion <= 6;
    let message = text.autoReady;
    if (!align) message = text.alignCard;
    else if (metrics.brightness < 48) message = text.tooDark;
    else if (metrics.brightness > 222 || metrics.glare > 0.17) message = text.tooBright;
    else if (!focused) message = text.focus;
    else if (!still) message = text.holdStill;
    const good = align && light && focused && still;
    if (good) {
      if (!stableSinceRef.current) stableSinceRef.current = timestamp;
      const progress = clamp((timestamp - stableSinceRef.current) / AUTO_CAPTURE_HOLD_MS, 0, 1);
      setAutoProgress(progress);
      if (progress >= 1) captureCard();
    } else {
      stableSinceRef.current = 0;
      setAutoProgress(0);
    }
    setQuality({ align, light, still: still && focused, message });
  }

  async function startCamera() {
    stopCamera();
    setError('');
    setImageUrl('');
    setAutoProgress(0);
    setPhase('camera');
    captureLockedRef.current = false;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unavailable');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });
      streamRef.current = stream;
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      const video = videoRef.current;
      if (!video) throw new Error('unavailable');
      video.srcObject = stream;
      await video.play();
      const track = stream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities?.();
      if (Array.isArray(capabilities?.focusMode) && capabilities.focusMode.includes('continuous')) {
        track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
      }
      animationRef.current = window.requestAnimationFrame(monitorCamera);
    } catch (cameraError) {
      stopCamera();
      const name = String(cameraError?.name || cameraError?.message || '');
      setError(name.includes('NotAllowed') || name.includes('Permission') ? text.permissionDenied : name.includes('NotFound') || name.includes('unavailable') ? text.cameraUnavailable : text.cameraError);
      setPhase('error');
    }
  }

  function cancelCamera() {
    stopCamera();
    setPhase('intro');
    setAutoProgress(0);
    captureLockedRef.current = false;
  }

  function updateBoundary(key, value) {
    setBoundaries((current) => ({ ...current, [key]: Number(value) }));
    setConfidence((current) => Math.max(current, 0.7));
  }

  const referenceLabel = report.band === 'OUTSIDE'
    ? (uiLang === 'JP' ? 'PSA 8の表面基準外' : uiLang === 'EN' ? 'Outside PSA 8 front reference' : 'PSA 8 앞면 참고 범위 밖')
    : `${report.band} ${uiLang === 'JP' ? '表面参考範囲' : uiLang === 'EN' ? 'front reference' : '앞면 참고 범위'}`;

  return (
    <main className="renew-subpage centering-lab">
      <section className="centering-lab-head">
        <div>
          <span>{text.eyebrow}</span>
          <h1>{text.title}</h1>
          <p>{text.intro}</p>
        </div>
        <strong>{CARD_WIDTH_MM} × {CARD_HEIGHT_MM} mm</strong>
      </section>

      {phase === 'intro' ? (
        <section className="centering-intro-panel">
          <div className="centering-intro-visual">
            <div className="centering-intro-card"><CenteringGuide /></div>
            <span>{text.localOnly}</span>
          </div>
          <div className="centering-intro-copy">
            <h2>{text.guideTitle}</h2>
            <ol>{text.guideItems.map((item, index) => <li key={item}><b>{index + 1}</b><span>{item}</span></li>)}</ol>
            <button type="button" className="centering-primary-button" onClick={startCamera}>{text.start}</button>
            <small>{text.privacy}</small>
          </div>
        </section>
      ) : null}

      {phase === 'camera' ? (
        <section className="centering-camera-panel">
          <div className="centering-camera-copy">
            <div><span>LIVE CHECK</span><h2>{text.cameraTitle}</h2><p>{text.cameraBody}</p></div>
            <button type="button" onClick={cancelCamera}>{text.cancel}</button>
          </div>
          <div className="centering-camera-stage" ref={viewportRef}>
            <video ref={videoRef} autoPlay muted playsInline />
            <div className="centering-camera-shade" />
            <div className="centering-card-guide" ref={guideRef}><CenteringGuide /></div>
            <div className="centering-camera-status">
              <div className="centering-quality-list">
                <span className={quality.align ? 'is-good' : ''}>{text.qualityAlign}<b>{quality.align ? text.ready : text.wait}</b></span>
                <span className={quality.light ? 'is-good' : ''}>{text.qualityLight}<b>{quality.light ? text.ready : text.wait}</b></span>
                <span className={quality.still ? 'is-good' : ''}>{text.qualityStill}<b>{quality.still ? text.ready : text.wait}</b></span>
              </div>
              <strong>{quality.message}</strong>
              <div className="centering-auto-progress"><span style={{ width: `${autoProgress * 100}%` }} /></div>
            </div>
            <button type="button" className="centering-shutter" onClick={captureCard} aria-label={text.manualCapture}><span /></button>
          </div>
        </section>
      ) : null}

      {phase === 'analyzing' ? (
        <section className="centering-analysis-panel" aria-live="polite">
          <div className="centering-analysis-mark"><span /><span /><span /></div>
          <h2>{text.analyzing}</h2>
          <p>{text.analyzingBody}</p>
        </section>
      ) : null}

      {phase === 'error' ? (
        <section className="centering-error-panel" role="alert">
          <span>!</span>
          <h2>{text.title}</h2>
          <p>{error}</p>
          <button type="button" className="centering-primary-button" onClick={startCamera}>{text.retry}</button>
        </section>
      ) : null}

      {phase === 'result' ? (
        <section className="centering-result-panel">
          <header className="centering-result-head">
            <div><span>{text.resultEyebrow}</span><h2>{text.resultTitle}</h2></div>
            <button type="button" onClick={startCamera}>{text.retake}</button>
          </header>
          <div className="centering-result-grid">
            <div className="centering-result-image-shell">
              <div className="centering-result-image">
                {imageUrl ? <img src={imageUrl} alt="" /> : <div className="centering-result-image-loading" aria-hidden="true" />}
                <ResultOverlay boundaries={boundaries} />
              </div>
              <small>{confidence < 0.35 ? text.lowConfidence : text.highConfidence}</small>
            </div>
            <div className="centering-report">
              <div className="centering-score-block">
                <span>{text.score}</span>
                <strong>{report.score}</strong>
                <b className={report.band === 'PSA 10' ? 'is-top' : ''}>{referenceLabel}</b>
              </div>
              <div className="centering-metrics">
                <div><span>{text.horizontal}</span><strong>{report.left.toFixed(1)} <i>/</i> {report.right.toFixed(1)}</strong></div>
                <div><span>{text.vertical}</span><strong>{report.top.toFixed(1)} <i>/</i> {report.bottom.toFixed(1)}</strong></div>
                <div><span>{text.confidence}</span><strong>{confidencePercent}%</strong></div>
              </div>
              <div className="centering-direction-note">
                <b>{text.reference}</b>
                <p>{Math.abs(report.left - 50) < 0.6
                  ? (uiLang === 'JP' ? '左右の偏りはほとんどありません。' : uiLang === 'EN' ? 'No meaningful horizontal shift was detected.' : '좌우 치우침은 거의 없습니다.')
                  : report.left > report.right
                    ? (uiLang === 'JP' ? '印刷領域が右側に寄っています。' : uiLang === 'EN' ? 'The printed area shifts to the right.' : '인쇄 영역이 오른쪽으로 치우쳐 있습니다.')
                    : (uiLang === 'JP' ? '印刷領域が左側に寄っています。' : uiLang === 'EN' ? 'The printed area shifts to the left.' : '인쇄 영역이 왼쪽으로 치우쳐 있습니다.')}</p>
                <p>{Math.abs(report.top - 50) < 0.6
                  ? (uiLang === 'JP' ? '上下の偏りはほとんどありません。' : uiLang === 'EN' ? 'No meaningful vertical shift was detected.' : '상하 치우침은 거의 없습니다.')
                  : report.top > report.bottom
                    ? (uiLang === 'JP' ? '印刷領域が下側に寄っています。' : uiLang === 'EN' ? 'The printed area shifts downward.' : '인쇄 영역이 아래쪽으로 치우쳐 있습니다.')
                    : (uiLang === 'JP' ? '印刷領域が上側に寄っています。' : uiLang === 'EN' ? 'The printed area shifts upward.' : '인쇄 영역이 위쪽으로 치우쳐 있습니다.')}</p>
              </div>
              <details className="centering-adjustments" open={confidence < 0.35}>
                <summary>{text.adjust}</summary>
                <p>{text.adjustHelp}</p>
                <div className="centering-adjustment-grid">
                  {['left', 'right', 'top', 'bottom'].map((key) => (
                    <label key={key}><span>{text[key]} <b>{boundaries[key].toFixed(1)}%</b></span><input type="range" min="1.5" max="24" step="0.1" value={boundaries[key]} onChange={(event) => updateBoundary(key, event.target.value)} /></label>
                  ))}
                </div>
              </details>
              <p className="centering-disclaimer">{text.notice}</p>
              <a className="centering-official-link" href="https://www.psacard.com/gradingstandards" target="_blank" rel="noreferrer">{text.official} ↗</a>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
