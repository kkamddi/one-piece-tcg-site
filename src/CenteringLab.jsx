import React, { useEffect, useMemo, useRef, useState } from 'react';
import './centering-lab.css';

const CARD_WIDTH_MM = 63;
const CARD_HEIGHT_MM = 88;
const CAPTURE_WIDTH = 630;
const CAPTURE_HEIGHT = 880;
const CAPTURE_SOURCE_WIDTH = 960;
const CORNER_ZOOM_PADDINGS = [0.16, 0.1, 0.055, 0.02, -0.08, -0.18, -0.28, -0.34];

const COPY = {
  KR: {
    eyebrow: 'CENTERING LAB',
    title: '센터링 측정기',
    intro: '카드 전체를 촬영하면 원근을 자동 보정하고 앞면의 좌우·상하 인쇄 비율을 기기 안에서 분석합니다.',
    start: '카메라로 측정하기',
    privacy: '촬영 이미지는 서버에 저장하거나 전송하지 않습니다.',
    guideTitle: '측정 전 확인',
    guideItems: ['슬리브와 탑로더를 제거해 주세요.', '반사가 적은 어두운 단색 바닥에 카드를 놓아 주세요.', '카드 전체가 보이도록 위에서 촬영해 주세요. 기울기는 촬영 후 보정합니다.'],
    cameraTitle: '카드를 선 안에 맞춰주세요',
    cameraBody: '네 모서리가 흰색 가이드와 일치하면 잠시 고정해 주세요.',
    manualCapture: '지금 촬영',
    cancel: '취소',
    analyzing: '센터링 분석 중',
    analyzingBody: '카드 모서리와 원근을 보정한 뒤 인쇄 경계를 확인하고 있습니다.',
    resultEyebrow: 'CENTERING REPORT',
    resultTitle: '센터링 진단서',
    score: '센터링 점수',
    horizontal: '좌우 비율',
    vertical: '상하 비율',
    confidence: '측정 신뢰도',
    retake: '다시 촬영',
    adjust: '내부 테두리 조정',
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
    eyebrow: 'CENTERING LAB', title: 'Centering Check', intro: 'Capture the full card to correct perspective and analyze front left/right and top/bottom print ratios on your device.', start: 'Start camera check', privacy: 'Images stay on this device and are never uploaded.', guideTitle: 'Before measuring', guideItems: ['Remove sleeves and top loaders.', 'Use a dark, plain surface with minimal glare.', 'Keep the whole card visible. Perspective is corrected after capture.'], cameraTitle: 'Align the card inside the guide', cameraBody: 'Hold still when all four corners match the white guide.', manualCapture: 'Capture now', cancel: 'Cancel', analyzing: 'Analyzing centering', analyzingBody: 'Correcting card corners and perspective, then locating print boundaries.', resultEyebrow: 'CENTERING REPORT', resultTitle: 'Centering report', score: 'Centering score', horizontal: 'Left / right', vertical: 'Top / bottom', confidence: 'Confidence', retake: 'Retake', adjust: 'Adjust print boundaries', adjustHelp: 'Move the lines if automatic boundaries do not match the printed area.', left: 'Left', right: 'Right', top: 'Top', bottom: 'Bottom', reference: 'Centering reference', notice: 'This is a centering-only estimate. It does not evaluate surface, corners, printing defects, or grader discretion and does not guarantee a PSA grade.', official: 'View PSA centering standards', permissionDenied: 'Camera access is blocked. Allow camera access in site settings and try again.', cameraUnavailable: 'No camera is available on this device.', cameraError: 'The camera could not start. Check whether another app is using it.', retry: 'Try again', qualityAlign: 'Frame', qualityLight: 'Light', qualityStill: 'Still', ready: 'Good', wait: 'Checking', alignCard: 'Match the card corners', tooDark: 'Add more light', tooBright: 'Reduce glare', holdStill: 'Hold the phone still', focus: 'Focusing', autoReady: 'Hold still for automatic capture', lowConfidence: 'Automatic boundary detection is uncertain. Check the print boundary lines.', highConfidence: 'Print boundaries were detected consistently.', localOnly: 'On-device analysis'
  },
  JP: {
    eyebrow: 'CENTERING LAB', title: 'センタリング測定', intro: 'カード全体を撮影すると遠近を自動補正し、表面の左右・上下の印刷比率を端末内で分析します。', start: 'カメラで測定する', privacy: '撮影画像はサーバーへ保存・送信しません。', guideTitle: '測定前の確認', guideItems: ['スリーブとローダーを外してください。', '反射の少ない暗い単色の台に置いてください。', 'カード全体が見えるように撮影してください。傾きは撮影後に補正します。'], cameraTitle: 'カードを枠内に合わせてください', cameraBody: '四隅を白いガイドに合わせ、そのまま固定してください。', manualCapture: '今すぐ撮影', cancel: 'キャンセル', analyzing: 'センタリング分析中', analyzingBody: 'カードの四隅と遠近を補正してから印刷境界を確認しています。', resultEyebrow: 'CENTERING REPORT', resultTitle: 'センタリング診断', score: 'センタリングスコア', horizontal: '左右比率', vertical: '上下比率', confidence: '測定信頼度', retake: '撮り直す', adjust: '印刷境界を調整', adjustHelp: '自動境界線が印刷領域と異なる場合はスライダーで調整してください。', left: '左', right: '右', top: '上', bottom: '下', reference: 'センタリング参考範囲', notice: 'センタリングのみの参考値です。表面、角、印刷状態、鑑定士の判断は含まず、PSAグレードを保証しません。', official: 'PSA公式基準を見る', permissionDenied: 'カメラ権限がブロックされています。サイト設定でカメラを許可してから再試行してください。', cameraUnavailable: '利用可能なカメラが見つかりません。', cameraError: 'カメラを開始できませんでした。他のアプリが使用していないか確認してください。', retry: '再試行', qualityAlign: '構図', qualityLight: '明るさ', qualityStill: '固定', ready: '良好', wait: '確認中', alignCard: 'カードの四隅を合わせてください', tooDark: 'もう少し明るくしてください', tooBright: '反射を減らしてください', holdStill: '端末を固定してください', focus: 'ピントを合わせています', autoReady: 'そのまま固定すると自動撮影します', lowConfidence: '自動境界認識が不確実です。印刷境界線を確認してください。', highConfidence: '印刷境界を安定して認識しました。', localOnly: '端末内分析'
  }
};

const CAMERA_FLOW_COPY = {
  KR: {
    title: '카드 전체가 보이게 촬영하세요',
    body: '네 모서리를 정확히 맞출 필요 없이 카드가 촬영 영역 안에 모두 들어오면 됩니다.',
    centerLabel: '중앙',
    hint: '카드 전체가 보이면 촬영 버튼을 눌러 주세요.',
    findCard: '카드를 화면 중앙에 놓아 주세요.',
    moveCenter: '카드를 중앙 표시 쪽으로 옮겨 주세요.',
    moveCloser: '카드를 조금 더 가까이 보여 주세요.',
    detected: '카드가 인식되었습니다. 촬영 버튼을 눌러 주세요.',
    upload: '사진 업로드',
    chooseAnother: '다른 사진 선택',
    invalidImage: '사진 파일을 불러오지 못했습니다. JPG, PNG 또는 WebP 파일을 선택해 주세요.',
    dark: '조금 더 밝은 곳에서 촬영해 주세요.',
    glare: '빛 반사를 줄인 뒤 촬영해 주세요.',
    burst: '가장 선명한 장면을 고르고 있습니다.',
    cornerTitle: '1단계 · 카드 외곽 맞추기',
    cornerBody: '사진은 아직 회전하거나 잘리지 않았습니다. 네 점을 카드의 실제 바깥 모서리에 맞춘 뒤 외곽을 확정해 주세요.',
    cornerApply: '카드 외곽 확정',
    cornerRetake: '다시 촬영',
    cornerLabel: '카드 모서리',
    zoomOut: '축소',
    zoomIn: '확대',
    zoomLabel: '외곽 조정 확대 배율',
    outerLegend: '실제 카드 외곽',
    innerLegend: '인쇄 경계 (다음 단계)',
    outerTip: '사진 빈 영역을 한 손가락으로 밀어 위치를 옮기고, 두 손가락으로 확대한 뒤 주황색 네 점을 실제 모서리에 맞춰 주세요.',
    readjust: '카드 외곽 다시 맞추기',
    outlineReady: '네 점이 카드의 실제 바깥 모서리에 맞는지 마지막으로 확인해 주세요.',
    outlineInvalid: '외곽점의 순서나 간격이 올바르지 않습니다. 네 점을 다시 맞춰 주세요.',
    analysisError: '이미지를 분석하지 못했습니다. 카드를 다시 촬영해 주세요.'
  },
  EN: {
    title: 'Keep the entire card in view',
    body: 'The corners do not need to match exactly. Make sure the whole card stays inside the capture area.',
    centerLabel: 'CENTER',
    hint: 'Press the shutter when the whole card is visible.',
    findCard: 'Place the card near the center of the screen.',
    moveCenter: 'Move the card toward the center marker.',
    moveCloser: 'Move the card slightly closer.',
    detected: 'Card detected. Press the shutter.',
    upload: 'Upload photo',
    chooseAnother: 'Choose another photo',
    invalidImage: 'The photo could not be loaded. Choose a JPG, PNG, or WebP file.',
    dark: 'Move to a brighter area.',
    glare: 'Reduce glare before capturing.',
    burst: 'Selecting the sharpest frame.',
    cornerTitle: 'Step 1 · Set card outline',
    cornerBody: 'The photo has not been rotated or cropped. Move all four points onto the physical outer corners, then confirm the outline.',
    cornerApply: 'Confirm card outline',
    cornerRetake: 'Retake',
    cornerLabel: 'Card corner',
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',
    zoomLabel: 'Outline adjustment zoom level',
    outerLegend: 'Physical card edge',
    innerLegend: 'Print border (next step)',
    outerTip: 'Drag the empty photo area with one finger to pan, pinch to zoom, then place the four orange points on the physical card corners.',
    readjust: 'Adjust card outline',
    outlineReady: 'Check once more that all four points match the physical outer corners.',
    outlineInvalid: 'The outline order or spacing is invalid. Reposition all four points.',
    analysisError: 'The image could not be analyzed. Please retake the card.'
  },
  JP: {
    title: 'カード全体が入るように撮影してください',
    body: '四隅を正確に合わせる必要はありません。カード全体を撮影範囲内に入れてください。',
    centerLabel: '中央',
    hint: 'カード全体が見えたら撮影ボタンを押してください。',
    findCard: 'カードを画面中央に置いてください。',
    moveCenter: 'カードを中央マークへ移動してください。',
    moveCloser: 'カードをもう少し近づけてください。',
    detected: 'カードを認識しました。撮影ボタンを押してください。',
    upload: '写真をアップロード',
    chooseAnother: '別の写真を選択',
    invalidImage: '写真を読み込めませんでした。JPG、PNG、WebPファイルを選択してください。',
    dark: 'もう少し明るい場所で撮影してください。',
    glare: '光の反射を減らしてから撮影してください。',
    burst: '最も鮮明なフレームを選択しています。',
    cornerTitle: 'ステップ1 · カード外枠を合わせる',
    cornerBody: '写真はまだ回転・切り抜きされていません。4点をカード外側の実際の角に合わせ、外枠を確定してください。',
    cornerApply: 'カード外枠を確定',
    cornerRetake: '撮り直す',
    cornerLabel: 'カードの角',
    zoomOut: '縮小',
    zoomIn: '拡大',
    zoomLabel: '外枠調整の拡大率',
    outerLegend: 'カード実物の外枠',
    innerLegend: '印刷境界（次のステップ）',
    outerTip: '写真の余白を1本指で動かして位置を調整し、2本指で拡大してから、オレンジの4点をカード実物の角に合わせてください。',
    readjust: 'カード外枠を再調整',
    outlineReady: '4点がカード外側の実際の角に合っているか、もう一度確認してください。',
    outlineInvalid: '外枠点の順序または間隔が正しくありません。4点を再調整してください。',
    analysisError: '画像を分析できませんでした。カードを撮り直してください。'
  }
};

const BOUNDARY_EDITOR_COPY = {
  KR: {
    title: '2단계 · 내부 테두리 조정',
    help: '보정된 카드 안쪽의 실제 내부 테두리에 좌·우·상·하 네 선을 맞춰 주세요.',
    edit: '내부 테두리 다시 맞추기',
    reset: '권장 위치',
    done: '경계 확정 후 결과 보기',
    back: '카드 외곽으로 돌아가기',
    advanced: '기울기 조정',
    simple: '네 선 조정',
    advancedHelp: '내부 테두리 자체가 비스듬할 때만 네 모서리 조정을 사용하세요.',
    outerLegend: '보정된 카드 외곽',
    innerLegend: '측정할 내부 테두리',
    corner: '내부 테두리 모서리',
    edge: '내부 테두리 선'
  },
  EN: {
    title: 'Step 2 · Adjust inner border',
    help: 'Align the four lines with the actual inner border on the corrected card.',
    edit: 'Adjust inner border',
    reset: 'Recommended position',
    done: 'Confirm and view result',
    back: 'Back to card outline',
    advanced: 'Adjust tilt',
    simple: 'Four-line mode',
    advancedHelp: 'Use four-corner adjustment only when the inner border itself is tilted.',
    outerLegend: 'Corrected card edge',
    innerLegend: 'Measured inner border',
    corner: 'Inner border corner',
    edge: 'Inner border edge'
  },
  JP: {
    title: 'ステップ2 · 印刷境界を調整',
    help: '補正されたカード内側の実際の印刷境界に、上下左右の4本の線を合わせてください。',
    edit: '印刷境界を再調整',
    reset: '推奨位置',
    done: '境界を確定して結果を見る',
    back: 'カード外枠に戻る',
    advanced: '傾きを調整',
    simple: '4本線調整',
    advancedHelp: '印刷境界自体が傾いている場合のみ、四隅調整を使用してください。',
    outerLegend: '補正されたカード外枠',
    innerLegend: '測定する印刷境界',
    corner: '印刷境界の角',
    edge: '印刷境界線'
  }
};

const GRADING_REFERENCE_COPY = {
  KR: {
    title: '등급사별 전면 센터링 참고',
    note: '전면 센터링만 비교한 예상값입니다. 표면·엣지·모서리·뒷면은 반영하지 않습니다.',
    psaPass: 'PSA 10 기준 충족',
    psaOutside: 'PSA 10 기준 초과',
    cgcPristine: 'Pristine 10 기준',
    cgcGem: 'Gem Mint 10 기준',
    cgcOutside: 'Gem Mint 10 기준 초과',
    brg: '공개 비율 기준 미확인',
    ccg: '센터링 참고 범위'
  },
  EN: {
    title: 'Front centering by grader',
    note: 'Front centering only. Surface, edges, corners, and the back are not evaluated.',
    psaPass: 'PSA 10 front reference',
    psaOutside: 'Outside PSA 10 reference',
    cgcPristine: 'Pristine 10 reference',
    cgcGem: 'Gem Mint 10 reference',
    cgcOutside: 'Outside Gem Mint 10 reference',
    brg: 'No public ratio table',
    ccg: 'Centering reference range'
  },
  JP: {
    title: '鑑定会社別・表面センタリング参考',
    note: '表面のセンタリングのみの参考値です。表面状態、エッジ、角、裏面は評価しません。',
    psaPass: 'PSA 10 表面基準内',
    psaOutside: 'PSA 10 表面基準外',
    cgcPristine: 'Pristine 10 基準内',
    cgcGem: 'Gem Mint 10 基準内',
    cgcOutside: 'Gem Mint 10 基準外',
    brg: '公開比率基準なし',
    ccg: 'センタリング参考範囲'
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

function sleep(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function captureViewportFrame(video, viewport) {
  const viewportBox = viewport.getBoundingClientRect();
  const canvas = document.createElement('canvas');
  canvas.width = CAPTURE_SOURCE_WIDTH;
  canvas.height = Math.max(640, Math.round(CAPTURE_SOURCE_WIDTH * viewportBox.height / Math.max(viewportBox.width, 1)));
  drawVideoCover(video, canvas);
  return canvas;
}

async function imageFileToCanvas(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('invalid-image');
  let source;
  let objectUrl = '';
  try {
    if (typeof createImageBitmap === 'function') {
      try {
        source = await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch {
        source = await createImageBitmap(file);
      }
    } else {
      objectUrl = URL.createObjectURL(file);
      source = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = objectUrl;
      });
    }
    const sourceWidth = source.width || source.naturalWidth;
    const sourceHeight = source.height || source.naturalHeight;
    if (!sourceWidth || !sourceHeight || Math.min(sourceWidth, sourceHeight) < 180) throw new Error('invalid-image');
    const scale = Math.min(1, 1800 / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    source?.close?.();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

function getFrameQuality(canvas) {
  const sample = document.createElement('canvas');
  sample.width = 180;
  sample.height = Math.max(180, Math.round(180 * canvas.height / canvas.width));
  const context = sample.getContext('2d', { willReadFrequently: true });
  context.drawImage(canvas, 0, 0, sample.width, sample.height);
  const image = context.getImageData(0, 0, sample.width, sample.height);
  const luma = getLumaData(image);
  let brightness = 0;
  let glare = 0;
  let sharpness = 0;
  let count = 0;
  for (let y = 2; y < sample.height - 2; y += 2) {
    for (let x = 2; x < sample.width - 2; x += 2) {
      const index = y * sample.width + x;
      const value = luma[index];
      brightness += value;
      glare += value > 246 ? 1 : 0;
      sharpness += Math.abs(value - luma[index - 2]) + Math.abs(value - luma[index - sample.width * 2]);
      count += 1;
    }
  }
  brightness /= Math.max(count, 1);
  glare /= Math.max(count, 1);
  sharpness /= Math.max(count, 1);
  const exposurePenalty = Math.abs(brightness - 135) * 0.08 + glare * 80;
  return sharpness - exposurePenalty;
}

function getDefaultCornerPoints(width, height) {
  const targetRatio = CARD_WIDTH_MM / CARD_HEIGHT_MM;
  let cardHeight = height * 0.6;
  let cardWidth = cardHeight * targetRatio;
  if (cardWidth > width * 0.64) {
    cardWidth = width * 0.64;
    cardHeight = cardWidth / targetRatio;
  }
  const left = (width - cardWidth) / 2;
  const top = (height - cardHeight) / 2;
  return {
    tl: { x: left, y: top },
    tr: { x: left + cardWidth, y: top },
    br: { x: left + cardWidth, y: top + cardHeight },
    bl: { x: left, y: top + cardHeight }
  };
}

function polygonArea(points) {
  const ordered = [points.tl, points.tr, points.br, points.bl];
  let area = 0;
  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index];
    const next = ordered[(index + 1) % ordered.length];
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area) / 2;
}

function pointDistance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function getInsetOutline(points, amount = 0.075) {
  const center = Object.values(points).reduce((result, point) => ({
    x: result.x + point.x / 4,
    y: result.y + point.y / 4
  }), { x: 0, y: 0 });
  return Object.fromEntries(Object.entries(points).map(([key, point]) => [key, {
    x: point.x + (center.x - point.x) * amount,
    y: point.y + (center.y - point.y) * amount
  }]));
}

function getCornerViewport(points, padding = 0.16) {
  const values = Object.values(points || {});
  if (values.length !== 4) return { left: 0, top: 0, width: 100, height: 100 };
  const minX = Math.min(...values.map((point) => point.x));
  const maxX = Math.max(...values.map((point) => point.x));
  const minY = Math.min(...values.map((point) => point.y));
  const maxY = Math.max(...values.map((point) => point.y));
  const cardWidth = Math.max(maxX - minX, 1);
  const cardHeight = Math.max(maxY - minY, 1);
  const width = Math.min(100, cardWidth * (1 + padding * 2));
  const height = Math.min(100, cardHeight * (1 + padding * 2));
  return {
    left: Number(clamp(minX - (width - cardWidth) / 2, 0, 100 - width).toFixed(2)),
    top: Number(clamp(minY - (height - cardHeight) / 2, 0, 100 - height).toFixed(2)),
    width: Number(width.toFixed(2)),
    height: Number(height.toFixed(2))
  };
}

function getCornerViewportForZoom(points, zoomLevel = 0) {
  const safeLevel = clamp(Number(zoomLevel) || 0, 0, CORNER_ZOOM_PADDINGS.length - 1);
  const lower = Math.floor(safeLevel);
  const upper = Math.ceil(safeLevel);
  const progress = safeLevel - lower;
  const padding = CORNER_ZOOM_PADDINGS[lower] + (CORNER_ZOOM_PADDINGS[upper] - CORNER_ZOOM_PADDINGS[lower]) * progress;
  return getCornerViewport(points, padding);
}

function projectPointToViewport(point, viewport) {
  return {
    x: (point.x - viewport.left) / viewport.width * 100,
    y: (point.y - viewport.top) / viewport.height * 100
  };
}

function getLineContrast(pixels, width, height, axis, position, start, end) {
  const values = [];
  const offset = 2;
  const safePosition = clamp(Math.round(position), offset, (axis === 'horizontal' ? height : width) - offset - 1);
  for (let cursor = Math.round(start); cursor <= Math.round(end); cursor += 2) {
    const x1 = axis === 'horizontal' ? clamp(cursor, 0, width - 1) : safePosition - offset;
    const y1 = axis === 'horizontal' ? safePosition - offset : clamp(cursor, 0, height - 1);
    const x2 = axis === 'horizontal' ? clamp(cursor, 0, width - 1) : safePosition + offset;
    const y2 = axis === 'horizontal' ? safePosition + offset : clamp(cursor, 0, height - 1);
    const first = (Math.round(y1) * width + Math.round(x1)) * 4;
    const second = (Math.round(y2) * width + Math.round(x2)) * 4;
    values.push(Math.hypot(
      pixels[first] - pixels[second],
      pixels[first + 1] - pixels[second + 1],
      pixels[first + 2] - pixels[second + 2]
    ));
  }
  return median(values);
}

function findStrongestEdge(pixels, width, height, axis, from, to, lineStart, lineEnd) {
  let bestPosition = from;
  let bestScore = -1;
  for (let position = Math.round(from); position <= Math.round(to); position += 1) {
    const score = getLineContrast(pixels, width, height, axis, position, lineStart, lineEnd);
    if (score > bestScore) {
      bestScore = score;
      bestPosition = position;
    }
  }
  return { position: bestPosition, score: bestScore };
}

function detectCenteredCardBounds(pixels, width, height) {
  const top = findStrongestEdge(pixels, width, height, 'horizontal', height * 0.1, height * 0.46, width * 0.28, width * 0.72);
  const bottom = findStrongestEdge(pixels, width, height, 'horizontal', height * 0.54, height * 0.94, width * 0.28, width * 0.72);
  const left = findStrongestEdge(pixels, width, height, 'vertical', width * 0.08, width * 0.46, height * 0.3, height * 0.76);
  const right = findStrongestEdge(pixels, width, height, 'vertical', width * 0.54, width * 0.92, height * 0.3, height * 0.76);
  const detectedWidth = right.position - left.position;
  const detectedHeight = bottom.position - top.position;
  const ratio = detectedWidth / Math.max(detectedHeight, 1);
  const areaRatio = detectedWidth * detectedHeight / Math.max(width * height, 1);
  const valid = detectedWidth >= width * 0.22
    && detectedWidth <= width * 0.72
    && detectedHeight >= height * 0.34
    && detectedHeight <= height * 0.86
    && ratio >= 0.5
    && ratio <= 0.9
    && areaRatio >= 0.08
    && Math.min(top.score, bottom.score, left.score, right.score) >= 11;
  if (!valid) return null;
  return {
    points: {
      tl: { x: left.position, y: top.position },
      tr: { x: right.position, y: top.position },
      br: { x: right.position, y: bottom.position },
      bl: { x: left.position, y: bottom.position }
    },
    areaRatio,
    edgeScore: Math.min(top.score, bottom.score, left.score, right.score)
  };
}

function refineCardBounds(pixels, width, height, bounds) {
  const roughWidth = Math.max(bounds.maxX - bounds.minX, 1);
  const roughHeight = Math.max(bounds.maxY - bounds.minY, 1);
  const searchLeft = clamp(bounds.minX - roughWidth * 0.14, 3, width - 4);
  const searchRight = clamp(bounds.maxX + roughWidth * 0.14, 3, width - 4);
  const searchTop = clamp(bounds.minY - roughHeight * 0.14, 3, height - 4);
  const searchBottom = clamp(bounds.maxY + roughHeight * 0.14, 3, height - 4);
  const horizontalStart = searchLeft + (searchRight - searchLeft) * 0.22;
  const horizontalEnd = searchRight - (searchRight - searchLeft) * 0.22;
  const verticalStart = searchTop + (searchBottom - searchTop) * 0.22;
  const verticalEnd = searchBottom - (searchBottom - searchTop) * 0.22;
  const top = findStrongestEdge(pixels, width, height, 'horizontal', searchTop, bounds.minY + roughHeight * 0.3, horizontalStart, horizontalEnd);
  const bottom = findStrongestEdge(pixels, width, height, 'horizontal', bounds.maxY - roughHeight * 0.3, searchBottom, horizontalStart, horizontalEnd);
  const left = findStrongestEdge(pixels, width, height, 'vertical', searchLeft, bounds.minX + roughWidth * 0.3, verticalStart, verticalEnd);
  const right = findStrongestEdge(pixels, width, height, 'vertical', bounds.maxX - roughWidth * 0.3, searchRight, verticalStart, verticalEnd);
  const refinedWidth = right.position - left.position;
  const refinedHeight = bottom.position - top.position;
  const ratio = refinedWidth / Math.max(refinedHeight, 1);
  const valid = refinedWidth >= width * 0.12
    && refinedHeight >= height * 0.12
    && ratio >= 0.48
    && ratio <= 0.94
    && Math.min(top.score, bottom.score, left.score, right.score) >= 9;
  if (!valid) return null;
  return {
    tl: { x: left.position, y: top.position },
    tr: { x: right.position, y: top.position },
    br: { x: right.position, y: bottom.position },
    bl: { x: left.position, y: bottom.position }
  };
}

function detectCardCorners(canvas) {
  const sample = document.createElement('canvas');
  sample.width = Math.min(280, canvas.width);
  sample.height = Math.round(sample.width * canvas.height / canvas.width);
  const context = sample.getContext('2d', { willReadFrequently: true });
  context.drawImage(canvas, 0, 0, sample.width, sample.height);
  const image = context.getImageData(0, 0, sample.width, sample.height);
  const pixels = image.data;
  const borderSize = Math.max(4, Math.round(Math.min(sample.width, sample.height) * 0.055));
  const borderR = [];
  const borderG = [];
  const borderB = [];
  const borderLuma = [];
  for (let y = 0; y < sample.height; y += 2) {
    for (let x = 0; x < sample.width; x += 2) {
      if (x >= borderSize && x < sample.width - borderSize && y >= borderSize && y < sample.height - borderSize) continue;
      const offset = (y * sample.width + x) * 4;
      const red = pixels[offset];
      const green = pixels[offset + 1];
      const blue = pixels[offset + 2];
      borderR.push(red);
      borderG.push(green);
      borderB.push(blue);
      borderLuma.push(red * 0.299 + green * 0.587 + blue * 0.114);
    }
  }
  const background = { r: median(borderR), g: median(borderG), b: median(borderB), luma: median(borderLuma) };
  const deviations = borderLuma.map((value) => Math.abs(value - background.luma));
  const colorThreshold = clamp(25 + median(deviations) * 2.8, 25, 58);
  let mask = new Uint8Array(sample.width * sample.height);
  for (let y = 2; y < sample.height - 2; y += 1) {
    for (let x = 2; x < sample.width - 2; x += 1) {
      const index = y * sample.width + x;
      const offset = index * 4;
      const red = pixels[offset];
      const green = pixels[offset + 1];
      const blue = pixels[offset + 2];
      const luma = red * 0.299 + green * 0.587 + blue * 0.114;
      const distance = Math.hypot(red - background.r, green - background.g, blue - background.b);
      const centerWeight = 1 - Math.min(1, Math.hypot((x / sample.width) - 0.5, (y / sample.height) - 0.5));
      if ((distance > colorThreshold && Math.abs(luma - background.luma) > 7) || (luma > background.luma + 22 - centerWeight * 5)) mask[index] = 1;
    }
  }
  for (let pass = 0; pass < 2; pass += 1) {
    const expanded = mask.slice();
    for (let y = 1; y < sample.height - 1; y += 1) {
      for (let x = 1; x < sample.width - 1; x += 1) {
        const index = y * sample.width + x;
        if (mask[index]) continue;
        if (mask[index - 1] || mask[index + 1] || mask[index - sample.width] || mask[index + sample.width]) expanded[index] = 1;
      }
    }
    mask = expanded;
  }
  const visited = new Uint8Array(mask.length);
  let best = null;
  const queue = new Int32Array(mask.length);
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    let count = 0;
    let minX = sample.width;
    let maxX = 0;
    let minY = sample.height;
    let maxY = 0;
    let sumX = 0;
    let sumY = 0;
    let tl = { x: sample.width, y: sample.height, value: Number.POSITIVE_INFINITY };
    let tr = { x: 0, y: sample.height, value: Number.NEGATIVE_INFINITY };
    let br = { x: 0, y: 0, value: Number.NEGATIVE_INFINITY };
    let bl = { x: sample.width, y: 0, value: Number.POSITIVE_INFINITY };
    while (head < tail) {
      const index = queue[head++];
      const x = index % sample.width;
      const y = Math.floor(index / sample.width);
      count += 1;
      sumX += x;
      sumY += y;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      if (x + y < tl.value) tl = { x, y, value: x + y };
      if (x - y > tr.value) tr = { x, y, value: x - y };
      if (x + y > br.value) br = { x, y, value: x + y };
      if (x - y < bl.value) bl = { x, y, value: x - y };
      const neighbors = [index - 1, index + 1, index - sample.width, index + sample.width];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= mask.length || visited[neighbor] || !mask[neighbor]) continue;
        const neighborX = neighbor % sample.width;
        if (Math.abs(neighborX - x) > 1) continue;
        visited[neighbor] = 1;
        queue[tail++] = neighbor;
      }
    }
    if (count < 100) continue;
    const width = maxX - minX;
    const height = maxY - minY;
    const centerDistance = Math.hypot(sumX / count / sample.width - 0.5, sumY / count / sample.height - 0.5);
    const boxArea = Math.max((width + 1) * (height + 1), 1);
    const fillRatio = count / boxArea;
    const boxRatio = width / Math.max(height, 1);
    const targetRatio = CARD_WIDTH_MM / CARD_HEIGHT_MM;
    const ratioScore = clamp(1 - Math.abs(Math.log(boxRatio / targetRatio)) / 0.48, 0, 1);
    const boxAreaRatio = boxArea / (sample.width * sample.height);
    if (fillRatio < 0.12 || ratioScore < 0.12 || boxAreaRatio < 0.025 || boxAreaRatio > 0.78) continue;
    const score = Math.sqrt(boxArea)
      * Math.pow(fillRatio, 1.35)
      * Math.pow(ratioScore, 2.6)
      * clamp(1.2 - centerDistance, 0.35, 1.2);
    if (!best || score > best.score) best = {
      score, count, width, height, tl, tr, br, bl, centerDistance, minX, maxX, minY, maxY, fillRatio
    };
  }
  if (!best) {
    const centered = detectCenteredCardBounds(pixels, sample.width, sample.height);
    if (!centered) return { points: getDefaultCornerPoints(canvas.width, canvas.height), confidence: 0, areaRatio: 0, centerDistance: 1 };
    const scaleX = canvas.width / sample.width;
    const scaleY = canvas.height / sample.height;
    const points = Object.fromEntries(Object.entries(centered.points).map(([key, point]) => [key, {
      x: point.x * scaleX,
      y: point.y * scaleY
    }]));
    return { points, confidence: clamp(centered.edgeScore / 90, 0.18, 0.58), areaRatio: centered.areaRatio, centerDistance: 0 };
  }
  const scaleX = canvas.width / sample.width;
  const scaleY = canvas.height / sample.height;
  const roughPoints = { tl: best.tl, tr: best.tr, br: best.br, bl: best.bl };
  const maximumSlope = Math.max(
    Math.abs(best.tl.y - best.tr.y) / Math.max(best.width, 1),
    Math.abs(best.bl.y - best.br.y) / Math.max(best.width, 1),
    Math.abs(best.tl.x - best.bl.x) / Math.max(best.height, 1),
    Math.abs(best.tr.x - best.br.x) / Math.max(best.height, 1)
  );
  const refinedPoints = maximumSlope < 0.14 ? refineCardBounds(pixels, sample.width, sample.height, best) : null;
  const selectedPoints = refinedPoints || roughPoints;
  const points = Object.fromEntries(Object.entries(selectedPoints).map(([key, point]) => [key, {
    x: point.x * scaleX,
    y: point.y * scaleY
  }]));
  const averageWidth = (pointDistance(points.tl, points.tr) + pointDistance(points.bl, points.br)) / 2;
  const averageHeight = (pointDistance(points.tl, points.bl) + pointDistance(points.tr, points.br)) / 2;
  const detectedRatio = averageWidth / Math.max(averageHeight, 1);
  const targetRatio = CARD_WIDTH_MM / CARD_HEIGHT_MM;
  const ratioScore = clamp(1 - Math.abs(Math.log(detectedRatio / targetRatio)) / 0.65, 0, 1);
  const areaRatio = polygonArea(points) / (canvas.width * canvas.height);
  const areaScore = clamp((areaRatio - 0.04) / 0.26, 0, 1);
  const sizeScore = clamp(Math.min(best.width / sample.width, best.height / sample.height) / 0.34, 0, 1);
  const centerScore = clamp(1 - best.centerDistance / 0.52, 0, 1);
  const confidence = ratioScore * 0.3 + areaScore * 0.24 + sizeScore * 0.16 + centerScore * 0.14 + clamp(best.fillRatio, 0, 1) * 0.16;
  return { points, confidence, areaRatio, centerDistance: best.centerDistance };
}

function normalizeCornerPoints(points, width, height) {
  return Object.fromEntries(Object.entries(points).map(([key, point]) => [key, {
    x: clamp(point.x / width * 100, 1, 99),
    y: clamp(point.y / height * 100, 1, 99)
  }]));
}

function denormalizeCornerPoints(points, width, height) {
  return Object.fromEntries(Object.entries(points).map(([key, point]) => [key, {
    x: clamp(point.x / 100 * width, 0, width - 1),
    y: clamp(point.y / 100 * height, 0, height - 1)
  }]));
}

function getOutlineValidation(points, width, height) {
  const actual = denormalizeCornerPoints(points, width, height);
  const ordered = [actual.tl, actual.tr, actual.br, actual.bl];
  const crossProducts = ordered.map((point, index) => {
    const next = ordered[(index + 1) % ordered.length];
    const after = ordered[(index + 2) % ordered.length];
    return (next.x - point.x) * (after.y - next.y) - (next.y - point.y) * (after.x - next.x);
  });
  const sameDirection = crossProducts.every((value) => value > 0) || crossProducts.every((value) => value < 0);
  const top = pointDistance(actual.tl, actual.tr);
  const right = pointDistance(actual.tr, actual.br);
  const bottom = pointDistance(actual.bl, actual.br);
  const left = pointDistance(actual.tl, actual.bl);
  const areaRatio = polygonArea(actual) / Math.max(width * height, 1);
  const averageRatio = ((top + bottom) / 2) / Math.max((left + right) / 2, 1);
  const horizontalPerspective = Math.max(top, bottom) / Math.max(Math.min(top, bottom), 1);
  const verticalPerspective = Math.max(left, right) / Math.max(Math.min(left, right), 1);
  const minimumEdge = Math.min(top, right, bottom, left);
  const valid = sameDirection
    && areaRatio >= 0.045
    && minimumEdge >= Math.min(width, height) * 0.12
    && averageRatio >= 0.42
    && averageRatio <= 1.08
    && horizontalPerspective <= 2.2
    && verticalPerspective <= 2.2;
  return { valid, areaRatio, horizontalPerspective, verticalPerspective };
}

function solveLinearSystem(matrix, values) {
  const size = values.length;
  const rows = matrix.map((row, index) => [...row, values[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (Math.abs(rows[pivot][column]) < 1e-10) throw new Error('invalid-corners');
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    for (let index = column; index <= size; index += 1) rows[column][index] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let index = column; index <= size; index += 1) rows[row][index] -= factor * rows[column][index];
    }
  }
  return rows.map((row) => row[size]);
}

function getPerspectiveTransform(points, width, height) {
  const sourcePoints = [points.tl, points.tr, points.br, points.bl];
  const targetPoints = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: width - 1, y: height - 1 },
    { x: 0, y: height - 1 }
  ];
  const matrix = [];
  const values = [];
  targetPoints.forEach((target, index) => {
    const source = sourcePoints[index];
    matrix.push([target.x, target.y, 1, 0, 0, 0, -source.x * target.x, -source.x * target.y]);
    values.push(source.x);
    matrix.push([0, 0, 0, target.x, target.y, 1, -source.y * target.x, -source.y * target.y]);
    values.push(source.y);
  });
  return solveLinearSystem(matrix, values);
}

function warpCardCanvas(source, points) {
  const output = document.createElement('canvas');
  output.width = CAPTURE_WIDTH;
  output.height = CAPTURE_HEIGHT;
  const sourceContext = source.getContext('2d', { willReadFrequently: true });
  const sourceImage = sourceContext.getImageData(0, 0, source.width, source.height);
  const targetContext = output.getContext('2d');
  const targetImage = targetContext.createImageData(output.width, output.height);
  const sourcePixels = sourceImage.data;
  const targetPixels = targetImage.data;
  const transform = getPerspectiveTransform(points, output.width, output.height);
  for (let y = 0; y < output.height; y += 1) {
    for (let x = 0; x < output.width; x += 1) {
      const denominator = transform[6] * x + transform[7] * y + 1;
      const sourceX = (transform[0] * x + transform[1] * y + transform[2]) / denominator;
      const sourceY = (transform[3] * x + transform[4] * y + transform[5]) / denominator;
      const x0 = clamp(Math.floor(sourceX), 0, source.width - 1);
      const y0 = clamp(Math.floor(sourceY), 0, source.height - 1);
      const x1 = Math.min(x0 + 1, source.width - 1);
      const y1 = Math.min(y0 + 1, source.height - 1);
      const fx = sourceX - x0;
      const fy = sourceY - y0;
      const targetOffset = (y * output.width + x) * 4;
      const offsets = [(y0 * source.width + x0) * 4, (y0 * source.width + x1) * 4, (y1 * source.width + x0) * 4, (y1 * source.width + x1) * 4];
      for (let channel = 0; channel < 4; channel += 1) {
        const topValue = sourcePixels[offsets[0] + channel] * (1 - fx) + sourcePixels[offsets[1] + channel] * fx;
        const bottomValue = sourcePixels[offsets[2] + channel] * (1 - fx) + sourcePixels[offsets[3] + channel] * fx;
        targetPixels[targetOffset + channel] = topValue * (1 - fy) + bottomValue * fy;
      }
    }
  }
  targetContext.putImageData(targetImage, 0, 0);
  return output;
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

const RECOMMENDED_PRINT_BOUNDARIES = Object.freeze({ left: 4.5, right: 4.5, top: 4.5, bottom: 4.5 });

function getRecommendedPrintBoundaries() {
  return { ...RECOMMENDED_PRINT_BOUNDARIES };
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
  const boundaries = getRecommendedPrintBoundaries();
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

function getBgsCenteringGrade(horizontalWorst, verticalWorst) {
  if (horizontalWorst <= 50 && verticalWorst <= 50) return '10';
  if ((horizontalWorst <= 50 && verticalWorst <= 55) || (verticalWorst <= 50 && horizontalWorst <= 55)) return '9.5';
  if (horizontalWorst <= 55 && verticalWorst <= 55) return '9';
  if (horizontalWorst <= 60 && verticalWorst <= 60) return '8';
  if (horizontalWorst <= 65 && verticalWorst <= 65) return '7';
  if (horizontalWorst <= 70 && verticalWorst <= 70) return '6';
  if (horizontalWorst <= 75 && verticalWorst <= 75) return '5';
  if (horizontalWorst <= 80 && verticalWorst <= 80) return '4';
  if (horizontalWorst <= 85 && verticalWorst <= 85) return '3';
  if (horizontalWorst <= 90 && verticalWorst <= 90) return '2';
  return '1';
}

function getCcgCenteringRange(worst) {
  if (worst <= 50) return '10';
  if (worst <= 55) return '10–9.5';
  if (worst <= 60) return '9.5–9';
  if (worst <= 65) return '9–8.5';
  if (worst <= 70) return '8.5–8';
  if (worst <= 75) return '7';
  return '<7';
}

function getGraderCenteringReferences(report) {
  const horizontalWorst = Math.max(report.left, report.right);
  const verticalWorst = Math.max(report.top, report.bottom);
  const worst = Math.max(horizontalWorst, verticalWorst);
  return {
    psa10: worst <= 55,
    bgs: getBgsCenteringGrade(horizontalWorst, verticalWorst),
    cgc: worst <= 50 ? 'pristine' : worst <= 55 ? 'gem' : 'outside',
    ccg: getCcgCenteringRange(worst)
  };
}

function CenteringGuide() {
  return (
    <svg className="centering-guide-svg" viewBox="0 0 63 88" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect x="0.5" y="0.5" width="62" height="87" rx="2" />
      <path d="M0.5 11V0.5H11M52 0.5h10.5V11M62.5 77v10.5H52M11 87.5H0.5V77" className="is-corner" />
      <rect x="3.2" y="4.5" width="56.6" height="79" rx="1.4" className="is-inner" />
      <rect x="5.7" y="8" width="51.6" height="72" rx="1" className="is-inner is-dashed" />
      <path d="M31.5 0.5v87M0.5 44h62" className="is-axis" />
      <circle cx="31.5" cy="44" r="1.8" className="is-center" />
      <text x="31.5" y="3.4" textAnchor="middle">63 x 88 mm</text>
      <text x="31.5" y="85.8" textAnchor="middle">CARD PONE CENTER</text>
    </svg>
  );
}

function boundariesToFrame(boundaries) {
  return {
    tl: { x: boundaries.left, y: boundaries.top },
    tr: { x: 100 - boundaries.right, y: boundaries.top },
    br: { x: 100 - boundaries.right, y: 100 - boundaries.bottom },
    bl: { x: boundaries.left, y: 100 - boundaries.bottom }
  };
}

function frameToBoundaries(frame) {
  return {
    left: Number(clamp((frame.tl.x + frame.bl.x) / 2, 0.5, 35).toFixed(1)),
    right: Number(clamp(100 - (frame.tr.x + frame.br.x) / 2, 0.5, 35).toFixed(1)),
    top: Number(clamp((frame.tl.y + frame.tr.y) / 2, 0.5, 35).toFixed(1)),
    bottom: Number(clamp(100 - (frame.bl.y + frame.br.y) / 2, 0.5, 35).toFixed(1))
  };
}

function getFramePoints(frame) {
  return `${frame.tl.x},${frame.tl.y} ${frame.tr.x},${frame.tr.y} ${frame.br.x},${frame.br.y} ${frame.bl.x},${frame.bl.y}`;
}

function getEdgePosition(frame, edge) {
  const edgePoints = {
    top: [frame.tl, frame.tr],
    right: [frame.tr, frame.br],
    bottom: [frame.bl, frame.br],
    left: [frame.tl, frame.bl]
  }[edge];
  return {
    x: (edgePoints[0].x + edgePoints[1].x) / 2,
    y: (edgePoints[0].y + edgePoints[1].y) / 2
  };
}

function constrainFrameCorner(frame, key, point) {
  const gap = 2;
  const limits = {
    tl: { minX: 1, maxX: frame.tr.x - gap, minY: 1, maxY: frame.bl.y - gap },
    tr: { minX: frame.tl.x + gap, maxX: 99, minY: 1, maxY: frame.br.y - gap },
    br: { minX: frame.bl.x + gap, maxX: 99, minY: frame.tr.y + gap, maxY: 99 },
    bl: { minX: 1, maxX: frame.br.x - gap, minY: frame.tl.y + gap, maxY: 99 }
  }[key];
  return {
    x: clamp(point.x, limits.minX, limits.maxX),
    y: clamp(point.y, limits.minY, limits.maxY)
  };
}

function shiftFrameEdge(frame, edge, deltaX, deltaY) {
  const next = Object.fromEntries(Object.entries(frame).map(([key, point]) => [key, { ...point }]));
  const gap = 2;
  if (edge === 'left') {
    const delta = clamp(deltaX, 1 - Math.min(frame.tl.x, frame.bl.x), Math.min(frame.tr.x - frame.tl.x, frame.br.x - frame.bl.x) - gap);
    next.tl.x += delta;
    next.bl.x += delta;
  } else if (edge === 'right') {
    const delta = clamp(deltaX, gap - Math.min(frame.tr.x - frame.tl.x, frame.br.x - frame.bl.x), 99 - Math.max(frame.tr.x, frame.br.x));
    next.tr.x += delta;
    next.br.x += delta;
  } else if (edge === 'top') {
    const delta = clamp(deltaY, 1 - Math.min(frame.tl.y, frame.tr.y), Math.min(frame.bl.y - frame.tl.y, frame.br.y - frame.tr.y) - gap);
    next.tl.y += delta;
    next.tr.y += delta;
  } else if (edge === 'bottom') {
    const delta = clamp(deltaY, gap - Math.min(frame.bl.y - frame.tl.y, frame.br.y - frame.tr.y), 99 - Math.max(frame.bl.y, frame.br.y));
    next.bl.y += delta;
    next.br.y += delta;
  }
  return next;
}

function BoundaryEditor({ frame, labels, onChange, advanced = false }) {
  const editorRef = useRef(null);
  const dragRef = useRef(null);

  const getPointerPosition = (event) => {
    const rect = editorRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: clamp((event.clientX - rect.left) / Math.max(rect.width, 1) * 100, 0, 100),
      y: clamp((event.clientY - rect.top) / Math.max(rect.height, 1) * 100, 0, 100)
    };
  };

  const startDrag = (type, key, event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      type,
      key,
      start: getPointerPosition(event),
      frame: Object.fromEntries(Object.entries(frame).map(([name, point]) => [name, { ...point }]))
    };
  };

  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const pointer = getPointerPosition(event);
    if (drag.type === 'corner') {
      onChange({ ...drag.frame, [drag.key]: constrainFrameCorner(drag.frame, drag.key, pointer) });
      return;
    }
    onChange(shiftFrameEdge(drag.frame, drag.key, pointer.x - drag.start.x, pointer.y - drag.start.y));
  };

  const stopDrag = (event) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  };

  return (
    <div className="centering-boundary-editor" ref={editorRef}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polygon points={getFramePoints(frame)} />
        <path d="M50 0V100M0 50H100" />
      </svg>
      {advanced ? Object.entries(frame).map(([key, point]) => (
        <button
          type="button"
          className="centering-boundary-handle is-corner"
          key={key}
          style={{ left: `${point.x}%`, top: `${point.y}%` }}
          aria-label={`${labels.corner} ${key}`}
          onPointerDown={(event) => startDrag('corner', key, event)}
          onPointerMove={moveDrag}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
        />
      )) : null}
      {['top', 'right', 'bottom', 'left'].map((edge) => {
        const position = getEdgePosition(frame, edge);
        return (
          <button
            type="button"
            className={`centering-boundary-handle is-edge is-${edge}`}
            key={edge}
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
            aria-label={`${labels.edge} ${edge}`}
            onPointerDown={(event) => startDrag('edge', edge, event)}
            onPointerMove={moveDrag}
            onPointerUp={stopDrag}
            onPointerCancel={stopDrag}
          />
        );
      })}
      <span className="centering-boundary-editor-badge">PRINT BORDER</span>
    </div>
  );
}

function ResultOverlay({ boundaries, frame, report }) {
  const tightHorizontal = report.left <= report.right ? 'left' : 'right';
  const tightVertical = report.top <= report.bottom ? 'top' : 'bottom';
  return (
    <div className="centering-result-overlay" aria-hidden="true">
      <span className={`centering-result-margin is-left${tightHorizontal === 'left' ? ' is-tight' : ''}`} style={{ width: `${boundaries.left}%` }} />
      <span className={`centering-result-margin is-right${tightHorizontal === 'right' ? ' is-tight' : ''}`} style={{ width: `${boundaries.right}%` }} />
      <span className={`centering-result-margin is-top${tightVertical === 'top' ? ' is-tight' : ''}`} style={{ height: `${boundaries.top}%` }} />
      <span className={`centering-result-margin is-bottom${tightVertical === 'bottom' ? ' is-tight' : ''}`} style={{ height: `${boundaries.bottom}%` }} />
      <svg className="centering-result-boundary" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon points={getFramePoints(frame)} />
      </svg>
      <span className="centering-result-axis is-vertical" />
      <span className="centering-result-axis is-horizontal" />
      <b className={`centering-result-ratio is-left${tightHorizontal === 'left' ? ' is-tight' : ''}`}>L {report.left.toFixed(1)}</b>
      <b className={`centering-result-ratio is-right${tightHorizontal === 'right' ? ' is-tight' : ''}`}>R {report.right.toFixed(1)}</b>
      <b className={`centering-result-ratio is-top${tightVertical === 'top' ? ' is-tight' : ''}`}>T {report.top.toFixed(1)}</b>
      <b className={`centering-result-ratio is-bottom${tightVertical === 'bottom' ? ' is-tight' : ''}`}>B {report.bottom.toFixed(1)}</b>
      <span className="centering-result-corner is-tl" />
      <span className="centering-result-corner is-tr" />
      <span className="centering-result-corner is-bl" />
      <span className="centering-result-corner is-br" />
    </div>
  );
}

export default function CenteringLab({ uiLang = 'KR', onOpenGuide }) {
  const text = COPY[uiLang] || COPY.KR;
  const flow = CAMERA_FLOW_COPY[uiLang] || CAMERA_FLOW_COPY.KR;
  const editorText = BOUNDARY_EDITOR_COPY[uiLang] || BOUNDARY_EDITOR_COPY.KR;
  const gradingText = GRADING_REFERENCE_COPY[uiLang] || GRADING_REFERENCE_COPY.KR;
  const demoMode = import.meta.env.DEV && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('centeringDemo') : '';
  const demoResult = demoMode === 'result';
  const demoCamera = demoMode === 'camera';
  const demoCorners = demoMode === 'corners';
  const initialBoundaries = demoResult ? { left: 6.2, right: 5.5, top: 5.8, bottom: 6.1 } : { left: 6, right: 6, top: 6, bottom: 6 };
  const [phase, setPhase] = useState(demoResult ? 'result' : demoCamera ? 'camera' : demoCorners ? 'corners' : 'intro');
  const [error, setError] = useState('');
  const [qualityMessage, setQualityMessage] = useState(flow.hint);
  const [sourceMode, setSourceMode] = useState('camera');
  const [imageUrl, setImageUrl] = useState('');
  const [rawImageUrl, setRawImageUrl] = useState('');
  const [rawAspectRatio, setRawAspectRatio] = useState('3 / 4');
  const [cornerPoints, setCornerPoints] = useState({
    tl: { x: 14, y: 10 }, tr: { x: 86, y: 10 }, br: { x: 86, y: 90 }, bl: { x: 14, y: 90 }
  });
  const [cornerViewport, setCornerViewport] = useState(() => getCornerViewportForZoom({
    tl: { x: 14, y: 10 }, tr: { x: 86, y: 10 }, br: { x: 86, y: 90 }, bl: { x: 14, y: 90 }
  }));
  const [cornerZoom, setCornerZoom] = useState(0);
  const [boundaries, setBoundaries] = useState(initialBoundaries);
  const [boundaryFrame, setBoundaryFrame] = useState(() => boundariesToFrame(initialBoundaries));
  const [automaticBoundaryFrame, setAutomaticBoundaryFrame] = useState(() => boundariesToFrame(initialBoundaries));
  const [isAdvancedBoundary, setIsAdvancedBoundary] = useState(false);
  const [confidence, setConfidence] = useState(demoResult ? 0.88 : 0);
  const videoRef = useRef(null);
  const viewportRef = useRef(null);
  const uploadInputRef = useRef(null);
  const streamRef = useRef(null);
  const monitorCanvasRef = useRef(null);
  const rawCanvasRef = useRef(null);
  const cornerFrameRef = useRef(null);
  const animationRef = useRef(0);
  const lastMeasuredRef = useRef(0);
  const captureLockedRef = useRef(false);
  const pinchRef = useRef({ points: new Map(), startDistance: 0, startZoom: 0 });
  const panRef = useRef({ pointerId: null, startX: 0, startY: 0, viewport: null });

  const report = useMemo(() => getCenteringReport(boundaries), [boundaries]);
  const graderReferences = useMemo(() => getGraderCenteringReferences(report), [report]);
  const confidencePercent = Math.round(confidence * 100);
  const outlineValidation = useMemo(() => {
    const source = rawCanvasRef.current;
    return getOutlineValidation(cornerPoints, source?.width || 100, source?.height || 100);
  }, [cornerPoints, rawImageUrl]);
  const innerGuidePoints = useMemo(() => getInsetOutline(cornerPoints), [cornerPoints]);
  const displayedCornerPoints = useMemo(() => Object.fromEntries(
    Object.entries(cornerPoints).map(([key, point]) => [key, projectPointToViewport(point, cornerViewport)])
  ), [cornerPoints, cornerViewport]);
  const displayedInnerGuidePoints = useMemo(() => Object.fromEntries(
    Object.entries(innerGuidePoints).map(([key, point]) => [key, projectPointToViewport(point, cornerViewport)])
  ), [innerGuidePoints, cornerViewport]);
  const cornerFrameAspectRatio = useMemo(() => {
    const [width = 3, height = 4] = rawAspectRatio.split('/').map((value) => Number(value.trim()) || 1);
    return `${width * cornerViewport.width} / ${height * cornerViewport.height}`;
  }, [cornerViewport, rawAspectRatio]);
  const cornerImageStyle = useMemo(() => ({
    width: `${10000 / cornerViewport.width}%`,
    height: `${10000 / cornerViewport.height}%`,
    left: `${-cornerViewport.left / cornerViewport.width * 100}%`,
    top: `${-cornerViewport.top / cornerViewport.height * 100}%`
  }), [cornerViewport]);
  useEffect(() => {
    if (!demoResult && !demoCorners) return;
    const canvas = document.createElement('canvas');
    canvas.width = demoCorners ? 720 : CAPTURE_WIDTH;
    canvas.height = demoCorners ? 1040 : CAPTURE_HEIGHT;
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#d55a3e');
    gradient.addColorStop(0.55, '#eee7dc');
    gradient.addColorStop(1, '#2b3442');
    context.fillStyle = demoCorners ? '#26282c' : gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (demoCorners) {
      context.save();
      context.beginPath();
      context.moveTo(118, 94);
      context.lineTo(620, 126);
      context.lineTo(588, 930);
      context.lineTo(92, 900);
      context.closePath();
      context.clip();
      context.fillStyle = gradient;
      context.fillRect(70, 70, 570, 890);
      context.restore();
    }
    context.strokeStyle = 'rgba(255,255,255,.86)';
    context.lineWidth = 8;
    if (!demoCorners) context.strokeRect(38, 52, 557, 775);
    context.fillStyle = 'rgba(0,0,0,.68)';
    context.font = `bold ${demoCorners ? 38 : 42}px sans-serif`;
    context.textAlign = 'center';
    context.fillText('CENTERING PREVIEW', canvas.width / 2, canvas.height / 2);
    if (demoCorners) {
      const demoDetection = detectCardCorners(canvas);
      const demoPoints = normalizeCornerPoints(demoDetection.points, canvas.width, canvas.height);
      rawCanvasRef.current = canvas;
      setRawImageUrl(canvas.toDataURL('image/jpeg', 0.9));
      setRawAspectRatio(`${canvas.width} / ${canvas.height}`);
      setCornerPoints(demoPoints);
      setCornerZoom(0);
      setCornerViewport(getCornerViewportForZoom(demoPoints));
    } else {
      setImageUrl(canvas.toDataURL('image/jpeg', 0.9));
    }
  }, [demoCorners, demoResult]);

  useEffect(() => {
    if (!demoCamera) return;
    setQualityMessage(flow.hint);
  }, [demoCamera, flow.hint]);

  function stopCamera() {
    window.cancelAnimationFrame(animationRef.current);
    animationRef.current = 0;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  useEffect(() => () => stopCamera(), []);

  useEffect(() => {
    if (phase !== 'camera') return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [phase]);

  async function prepareSourceCanvas(canvas) {
    setPhase('analyzing');
    rawCanvasRef.current = canvas;
    setRawImageUrl(canvas.toDataURL('image/jpeg', 0.91));
    setRawAspectRatio(`${canvas.width} / ${canvas.height}`);
    const detection = detectCardCorners(canvas);
    const normalizedPoints = normalizeCornerPoints(detection.points, canvas.width, canvas.height);
    setCornerPoints(normalizedPoints);
    setCornerZoom(0);
    setCornerViewport(getCornerViewportForZoom(normalizedPoints));
    await sleep(260);
    setPhase('corners');
  }

  async function captureCard() {
    if (captureLockedRef.current) return;
    const video = videoRef.current;
    const viewport = viewportRef.current;
    if (!video?.videoWidth || !viewport) return;
    captureLockedRef.current = true;
    try {
      setQualityMessage(flow.burst);
      const frames = [];
      for (let index = 0; index < 4; index += 1) {
        frames.push(captureViewportFrame(video, viewport));
        if (index < 3) await sleep(85);
      }
      const canvas = frames.reduce((best, frame) => getFrameQuality(frame) > getFrameQuality(best) ? frame : best, frames[0]);
      stopCamera();
      await prepareSourceCanvas(canvas);
    } catch {
      stopCamera();
      setError(flow.analysisError);
      setPhase('error');
    } finally {
      captureLockedRef.current = false;
    }
  }

  function monitorCamera(timestamp) {
    animationRef.current = window.requestAnimationFrame(monitorCamera);
    if (timestamp - lastMeasuredRef.current < 220) return;
    lastMeasuredRef.current = timestamp;
    const video = videoRef.current;
    const viewport = viewportRef.current;
    if (!video?.videoWidth || !viewport || captureLockedRef.current) return;
    const viewportBox = viewport.getBoundingClientRect();
    if (!viewportBox.width || !viewportBox.height) return;
    const canvas = monitorCanvasRef.current || document.createElement('canvas');
    monitorCanvasRef.current = canvas;
    canvas.width = 220;
    canvas.height = Math.max(180, Math.round(220 * viewportBox.height / viewportBox.width));
    drawVideoCover(video, canvas);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const luma = getLumaData(image);
    let brightness = 0;
    let glare = 0;
    for (let index = 0; index < luma.length; index += 4) {
      brightness += luma[index];
      if (luma[index] > 246) glare += 1;
    }
    const count = Math.ceil(luma.length / 4);
    brightness /= Math.max(count, 1);
    glare /= Math.max(count, 1);
    const detection = detectCardCorners(canvas);
    let message = flow.detected;
    if (brightness < 42) message = flow.dark;
    else if (brightness > 226 || glare > 0.16) message = flow.glare;
    else if (detection.confidence < 0.24) message = flow.findCard;
    else if (detection.centerDistance > 0.19) message = flow.moveCenter;
    else if (detection.areaRatio < 0.055) message = flow.moveCloser;
    setQualityMessage(message);
  }

  async function startCamera() {
    stopCamera();
    setError('');
    setImageUrl('');
    setRawImageUrl('');
    rawCanvasRef.current = null;
    setSourceMode('camera');
    setQualityMessage(flow.hint);
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
    captureLockedRef.current = false;
  }

  async function handleImageUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    stopCamera();
    setError('');
    setImageUrl('');
    setRawImageUrl('');
    rawCanvasRef.current = null;
    setSourceMode('upload');
    setPhase('analyzing');
    try {
      const canvas = await imageFileToCanvas(file);
      await prepareSourceCanvas(canvas);
    } catch {
      setError(flow.invalidImage);
      setPhase('error');
    }
  }

  function retryCurrentSource() {
    if (sourceMode === 'upload') uploadInputRef.current?.click();
    else startCamera();
  }

  async function applyCornerAnalysis(points = cornerPoints) {
    const source = rawCanvasRef.current;
    if (!source) return;
    const validation = getOutlineValidation(points, source.width, source.height);
    if (!validation.valid) {
      setPhase('corners');
      return;
    }
    try {
      setPhase('analyzing');
      await sleep(60);
      const denormalized = denormalizeCornerPoints(points, source.width, source.height);
      const corrected = warpCardCanvas(source, denormalized);
      const analysis = analyzeCapturedCanvas(corrected);
      const nextBoundaryFrame = boundariesToFrame(analysis.boundaries);
      setImageUrl(corrected.toDataURL('image/jpeg', 0.92));
      setBoundaries(analysis.boundaries);
      setBoundaryFrame(nextBoundaryFrame);
      setAutomaticBoundaryFrame(nextBoundaryFrame);
      setIsAdvancedBoundary(false);
      const perspectiveScore = 1 - clamp((Math.max(validation.horizontalPerspective, validation.verticalPerspective) - 1) / 1.2, 0, 1);
      setConfidence(clamp(0.55 + analysis.confidence * 0.25 + perspectiveScore * 0.2, 0, 1));
      await sleep(240);
      setPhase('boundary');
    } catch {
      setError(flow.analysisError);
      setPhase('error');
    }
  }

  function updateCornerFromPointer(key, event) {
    if (pinchRef.current.points.size >= 2) return;
    const frame = cornerFrameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const next = {
      x: clamp(cornerViewport.left + (event.clientX - rect.left) / Math.max(rect.width, 1) * cornerViewport.width, 1, 99),
      y: clamp(cornerViewport.top + (event.clientY - rect.top) / Math.max(rect.height, 1) * cornerViewport.height, 1, 99)
    };
    setCornerPoints((current) => ({ ...current, [key]: next }));
  }

  function returnToCornerAdjustment() {
    setCornerViewport(getCornerViewportForZoom(cornerPoints, cornerZoom));
    setPhase('corners');
  }

  function changeCornerZoom(delta) {
    const next = delta > 0
      ? Math.min(Math.floor(cornerZoom + 1), CORNER_ZOOM_PADDINGS.length - 1)
      : Math.max(Math.ceil(cornerZoom - 1), 0);
    setCornerZoomLevel(next);
  }

  function setCornerZoomLevel(nextZoom) {
    const next = clamp(nextZoom, 0, CORNER_ZOOM_PADDINGS.length - 1);
    const nextViewport = getCornerViewportForZoom(cornerPoints, next);
    const centerX = cornerViewport.left + cornerViewport.width / 2;
    const centerY = cornerViewport.top + cornerViewport.height / 2;
    setCornerZoom(next);
    setCornerViewport({
      ...nextViewport,
      left: clamp(centerX - nextViewport.width / 2, 0, 100 - nextViewport.width),
      top: clamp(centerY - nextViewport.height / 2, 0, 100 - nextViewport.height)
    });
  }

  function handleCornerFramePointerDown(event) {
    if (event.pointerType !== 'touch') return;
    const points = pinchRef.current.points;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (points.size === 1 && !event.target.closest?.('.centering-corner-handle')) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
      panRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        viewport: { ...cornerViewport }
      };
      return;
    }
    if (points.size !== 2) return;
    panRef.current.pointerId = null;
    const [first, second] = [...points.values()];
    pinchRef.current.startDistance = Math.hypot(first.x - second.x, first.y - second.y);
    pinchRef.current.startZoom = cornerZoom;
  }

  function handleCornerFramePointerMove(event) {
    if (event.pointerType !== 'touch') return;
    const points = pinchRef.current.points;
    if (!points.has(event.pointerId)) return;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (points.size < 2) {
      const pan = panRef.current;
      if (pan.pointerId !== event.pointerId || !pan.viewport) return;
      const frame = cornerFrameRef.current;
      if (!frame) return;
      const rect = frame.getBoundingClientRect();
      const next = {
        ...pan.viewport,
        left: clamp(pan.viewport.left - (event.clientX - pan.startX) / Math.max(rect.width, 1) * pan.viewport.width, 0, 100 - pan.viewport.width),
        top: clamp(pan.viewport.top - (event.clientY - pan.startY) / Math.max(rect.height, 1) * pan.viewport.height, 0, 100 - pan.viewport.height)
      };
      event.preventDefault();
      setCornerViewport(next);
      return;
    }
    if (!pinchRef.current.startDistance) return;
    const [first, second] = [...points.values()];
    const distance = Math.hypot(first.x - second.x, first.y - second.y);
    const zoomDelta = (distance / pinchRef.current.startDistance - 1) * 3.2;
    event.preventDefault();
    setCornerZoomLevel(pinchRef.current.startZoom + zoomDelta);
  }

  function handleCornerFramePointerEnd(event) {
    if (event.pointerType !== 'touch') return;
    pinchRef.current.points.delete(event.pointerId);
    if (pinchRef.current.points.size < 2) pinchRef.current.startDistance = 0;
    if (panRef.current.pointerId === event.pointerId) panRef.current.pointerId = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function updateBoundaryFrame(nextFrame) {
    setBoundaryFrame(nextFrame);
    setBoundaries(frameToBoundaries(nextFrame));
  }

  function resetBoundaryFrame() {
    const nextFrame = Object.fromEntries(Object.entries(automaticBoundaryFrame).map(([key, point]) => [key, { ...point }]));
    updateBoundaryFrame(nextFrame);
    setIsAdvancedBoundary(false);
  }

  function confirmBoundaryFrame() {
    setPhase('result');
  }

  const referenceLabel = report.band === 'OUTSIDE'
    ? (uiLang === 'JP' ? 'PSA 8の表面基準外' : uiLang === 'EN' ? 'Outside PSA 8 front reference' : 'PSA 8 앞면 참고 범위 밖')
    : `${report.band} ${uiLang === 'JP' ? '表面参考範囲' : uiLang === 'EN' ? 'front reference' : '앞면 참고 범위'}`;

  return (
    <main className={`renew-subpage centering-lab${phase === 'camera' ? ' is-camera-open' : ''}${phase === 'corners' ? ' is-corner-open' : ''}${phase === 'boundary' ? ' is-boundary-open' : ''}`}>
      <section className="centering-lab-head renew-profit-head">
        <div>
          <span>CENTERING TOOL</span>
        </div>
        <button type="button" className="renew-profit-primary-button" onClick={onOpenGuide}>
          {uiLang === 'JP' ? '利用ガイド' : uiLang === 'EN' ? 'User guide' : '사용 가이드'}
        </button>
      </section>
      <input
        ref={uploadInputRef}
        className="centering-upload-input"
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
      />

      {phase === 'intro' ? (
        <section className="centering-intro-panel">
          <div className="centering-intro-visual">
            <div className="centering-intro-card"><CenteringGuide /></div>
            <span>{text.localOnly}</span>
          </div>
          <div className="centering-intro-copy">
            <h2>{text.guideTitle}</h2>
            <ol>{text.guideItems.map((item, index) => <li key={item}><b>{index + 1}</b><span>{item}</span></li>)}</ol>
            <div className="centering-intro-actions">
              <button type="button" className="centering-start-option is-camera" onClick={startCamera}>
                <span className="centering-start-option-icon is-camera" aria-hidden="true" />
                <span className="centering-start-option-copy"><small>CAMERA</small><strong>{text.start}</strong></span>
              </button>
              <button type="button" className="centering-start-option is-upload" onClick={() => uploadInputRef.current?.click()}>
                <span className="centering-start-option-icon is-upload" aria-hidden="true" />
                <span className="centering-start-option-copy"><small>UPLOAD</small><strong>{flow.upload}</strong></span>
              </button>
            </div>
            <small>{text.privacy}</small>
          </div>
        </section>
      ) : null}

      {phase === 'camera' ? (
        <section className="centering-camera-panel">
          <div className="centering-camera-copy">
            <div><span>LIVE CHECK</span><h2>{flow.title}</h2><p>{flow.body}</p></div>
            <button type="button" onClick={cancelCamera}>{text.cancel}</button>
          </div>
          <div className="centering-camera-stage" ref={viewportRef}>
            <video ref={videoRef} autoPlay muted playsInline />
            <div className="centering-camera-shade" />
            <div className="centering-camera-guide" aria-hidden="true">
              <CenteringGuide />
            </div>
            <div className="centering-center-target" aria-hidden="true">
              <span />
              <b>{flow.centerLabel}</b>
            </div>
          </div>
          <div className="centering-camera-controls">
            <div className="centering-camera-status"><strong>{qualityMessage}</strong></div>
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
          <button type="button" className="centering-primary-button" onClick={retryCurrentSource}>{sourceMode === 'upload' ? flow.chooseAnother : text.retry}</button>
        </section>
      ) : null}

      {phase === 'corners' ? (
        <section className="centering-corner-panel">
          <header className="centering-corner-head">
            <div><span>STEP 1 / 2 · CARD OUTLINE</span><h2>{flow.cornerTitle}</h2><p>{flow.cornerBody}</p></div>
          </header>
          <div className="centering-corner-layout">
            <div className="centering-editor-visual">
              <div className="centering-corner-toolbar">
                <div className="centering-editor-legend" aria-hidden="true">
                  <span className="is-outer"><i />{flow.outerLegend}</span>
                  <span className="is-inner"><i />{flow.innerLegend}</span>
                </div>
                <div className="centering-corner-zoom" aria-label={flow.zoomLabel}>
                  <button type="button" className="is-zoom-out" onClick={() => changeCornerZoom(-1)} disabled={cornerZoom === 0} title={flow.zoomOut} aria-label={flow.zoomOut}><span aria-hidden="true" /></button>
                  <button type="button" className="is-zoom-in" onClick={() => changeCornerZoom(1)} disabled={cornerZoom === CORNER_ZOOM_PADDINGS.length - 1} title={flow.zoomIn} aria-label={flow.zoomIn}><span aria-hidden="true" /></button>
                </div>
              </div>
              <div
                className="centering-corner-frame"
                ref={cornerFrameRef}
                style={{ aspectRatio: cornerFrameAspectRatio }}
                onPointerDownCapture={handleCornerFramePointerDown}
                onPointerMoveCapture={handleCornerFramePointerMove}
                onPointerUpCapture={handleCornerFramePointerEnd}
                onPointerCancelCapture={handleCornerFramePointerEnd}
              >
                {rawImageUrl ? <img className="centering-corner-source" src={rawImageUrl} style={cornerImageStyle} alt="" /> : null}
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <polygon className="is-outer" points={`${displayedCornerPoints.tl.x},${displayedCornerPoints.tl.y} ${displayedCornerPoints.tr.x},${displayedCornerPoints.tr.y} ${displayedCornerPoints.br.x},${displayedCornerPoints.br.y} ${displayedCornerPoints.bl.x},${displayedCornerPoints.bl.y}`} />
                  <polygon className="is-inner" points={`${displayedInnerGuidePoints.tl.x},${displayedInnerGuidePoints.tl.y} ${displayedInnerGuidePoints.tr.x},${displayedInnerGuidePoints.tr.y} ${displayedInnerGuidePoints.br.x},${displayedInnerGuidePoints.br.y} ${displayedInnerGuidePoints.bl.x},${displayedInnerGuidePoints.bl.y}`} />
                </svg>
                {Object.entries(cornerPoints).map(([key, point], index) => (
                  <button
                    type="button"
                    className="centering-corner-handle"
                    key={key}
                    style={{ left: `${displayedCornerPoints[key].x}%`, top: `${displayedCornerPoints[key].y}%` }}
                    aria-label={`${flow.cornerLabel} ${index + 1}`}
                    onPointerDown={(event) => {
                      event.currentTarget.setPointerCapture(event.pointerId);
                      updateCornerFromPointer(key, event);
                    }}
                    onPointerMove={(event) => {
                      if (event.currentTarget.hasPointerCapture(event.pointerId)) updateCornerFromPointer(key, event);
                    }}
                    onPointerUp={(event) => {
                      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                    }}
                  ><span aria-hidden="true" /></button>
                ))}
              </div>
            </div>
            <aside className="centering-step-controls">
              <p className="centering-step-tip">{flow.outerTip}</p>
              <p className={`centering-outline-status${outlineValidation.valid ? ' is-ready' : ' is-invalid'}`}>
                {outlineValidation.valid ? flow.outlineReady : flow.outlineInvalid}
              </p>
              <div className="centering-corner-actions">
                <button type="button" onClick={retryCurrentSource}>{sourceMode === 'upload' ? flow.chooseAnother : flow.cornerRetake}</button>
                <button type="button" className="centering-primary-button" disabled={!outlineValidation.valid} onClick={() => applyCornerAnalysis(cornerPoints)}>{flow.cornerApply}</button>
              </div>
            </aside>
          </div>
        </section>
      ) : null}

      {phase === 'boundary' ? (
        <section className="centering-boundary-panel">
          <header className="centering-corner-head">
            <div><span>STEP 2 / 2 · INNER BORDER</span><h2>{editorText.title}</h2><p>{editorText.help}</p></div>
          </header>
          <div className="centering-boundary-layout">
            <div className="centering-editor-visual">
              <div className="centering-editor-legend" aria-hidden="true">
                <span className="is-outer"><i />{editorText.outerLegend}</span>
                <span className="is-inner"><i />{editorText.innerLegend}</span>
              </div>
              <div className="centering-result-image">
                {imageUrl ? <img src={imageUrl} alt="" /> : <div className="centering-result-image-loading" aria-hidden="true" />}
                <span className="centering-physical-edge" aria-hidden="true" />
                <BoundaryEditor frame={boundaryFrame} labels={editorText} onChange={updateBoundaryFrame} advanced={isAdvancedBoundary} />
              </div>
            </div>
            <aside className="centering-step-controls">
              <div className="centering-boundary-mode">
                <span>{editorText.advancedHelp}</span>
                <button type="button" aria-pressed={isAdvancedBoundary} onClick={() => setIsAdvancedBoundary((current) => !current)}>
                  {isAdvancedBoundary ? editorText.simple : editorText.advanced}
                </button>
              </div>
              <div className="centering-boundary-confirm-actions">
                <button type="button" onClick={returnToCornerAdjustment}>{editorText.back}</button>
                <button type="button" onClick={resetBoundaryFrame}>{editorText.reset}</button>
                <button type="button" className="centering-primary-button" onClick={confirmBoundaryFrame}>{editorText.done}</button>
              </div>
            </aside>
          </div>
        </section>
      ) : null}

      {phase === 'result' ? (
        <section className="centering-result-panel">
          <header className="centering-result-head">
            <div><span>{text.resultEyebrow}</span><h2>{text.resultTitle}</h2></div>
            <div className="centering-result-actions">
              {rawImageUrl ? <button type="button" onClick={returnToCornerAdjustment}>{flow.readjust}</button> : null}
              <button type="button" onClick={retryCurrentSource}>{sourceMode === 'upload' ? flow.chooseAnother : text.retake}</button>
            </div>
          </header>
          <div className="centering-result-grid">
            <div className="centering-result-image-shell">
              <div className="centering-result-image">
                {imageUrl ? <img src={imageUrl} alt="" /> : <div className="centering-result-image-loading" aria-hidden="true" />}
                <ResultOverlay boundaries={boundaries} frame={boundaryFrame} report={report} />
              </div>
              <div className="centering-boundary-toolbar">
                <div><b>{editorText.title}</b><span>{editorText.help}</span></div>
                <button type="button" className="is-primary" onClick={() => setPhase('boundary')}>{editorText.edit}</button>
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
              <section className="centering-grading-reference">
                <header><b>{gradingText.title}</b><span>{gradingText.note}</span></header>
                <div className="centering-grading-reference-grid">
                  <div className={graderReferences.psa10 ? 'is-pass' : ''}>
                    <a href="https://www.psacard.com/gradingstandards" target="_blank" rel="noreferrer">PSA</a>
                    <strong>{graderReferences.psa10 ? '10' : '—'}</strong>
                    <small>{graderReferences.psa10 ? gradingText.psaPass : gradingText.psaOutside}</small>
                  </div>
                  <div>
                    <a href="https://www.beckett.com/grading/scale" target="_blank" rel="noreferrer">BGS</a>
                    <strong>{graderReferences.bgs}</strong>
                    <small>Centering subgrade</small>
                  </div>
                  <div className={graderReferences.cgc !== 'outside' ? 'is-pass' : ''}>
                    <a href="https://www.cgccards.com/card-grading/grading-scale/" target="_blank" rel="noreferrer">CGC</a>
                    <strong>{graderReferences.cgc === 'pristine' || graderReferences.cgc === 'gem' ? '10' : '—'}</strong>
                    <small>{graderReferences.cgc === 'pristine' ? gradingText.cgcPristine : graderReferences.cgc === 'gem' ? gradingText.cgcGem : gradingText.cgcOutside}</small>
                  </div>
                  <div>
                    <a href="https://break.co.kr/" target="_blank" rel="noreferrer">BRG</a>
                    <strong>—</strong>
                    <small>{gradingText.brg}</small>
                  </div>
                  <div>
                    <a href="https://ccgcard.kr/HowWeGrade" target="_blank" rel="noreferrer">CCG</a>
                    <strong>{graderReferences.ccg}</strong>
                    <small>{gradingText.ccg}</small>
                  </div>
                </div>
              </section>
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
              <p className="centering-disclaimer">{text.notice}</p>
              <a className="centering-official-link" href="https://www.psacard.com/gradingstandards" target="_blank" rel="noreferrer">{text.official} ↗</a>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
