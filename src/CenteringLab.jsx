import React, { useEffect, useMemo, useRef, useState } from 'react';
import './centering-lab.css';

const CARD_WIDTH_MM = 63;
const CARD_HEIGHT_MM = 88;
const CAPTURE_WIDTH = 630;
const CAPTURE_HEIGHT = 880;
const CAPTURE_SOURCE_WIDTH = 960;

const COPY = {
  KR: {
    eyebrow: 'CARD LAB',
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
    eyebrow: 'CARD LAB', title: 'Centering Check', intro: 'Capture the full card to correct perspective and analyze front left/right and top/bottom print ratios on your device.', start: 'Start camera check', privacy: 'Images stay on this device and are never uploaded.', guideTitle: 'Before measuring', guideItems: ['Remove sleeves and top loaders.', 'Use a dark, plain surface with minimal glare.', 'Keep the whole card visible. Perspective is corrected after capture.'], cameraTitle: 'Align the card inside the guide', cameraBody: 'Hold still when all four corners match the white guide.', manualCapture: 'Capture now', cancel: 'Cancel', analyzing: 'Analyzing centering', analyzingBody: 'Correcting card corners and perspective, then locating print boundaries.', resultEyebrow: 'CENTERING REPORT', resultTitle: 'Centering report', score: 'Centering score', horizontal: 'Left / right', vertical: 'Top / bottom', confidence: 'Confidence', retake: 'Retake', adjust: 'Adjust print boundaries', adjustHelp: 'Move the lines if automatic boundaries do not match the printed area.', left: 'Left', right: 'Right', top: 'Top', bottom: 'Bottom', reference: 'Centering reference', notice: 'This is a centering-only estimate. It does not evaluate surface, corners, printing defects, or grader discretion and does not guarantee a PSA grade.', official: 'View PSA centering standards', permissionDenied: 'Camera access is blocked. Allow camera access in site settings and try again.', cameraUnavailable: 'No camera is available on this device.', cameraError: 'The camera could not start. Check whether another app is using it.', retry: 'Try again', qualityAlign: 'Frame', qualityLight: 'Light', qualityStill: 'Still', ready: 'Good', wait: 'Checking', alignCard: 'Match the card corners', tooDark: 'Add more light', tooBright: 'Reduce glare', holdStill: 'Hold the phone still', focus: 'Focusing', autoReady: 'Hold still for automatic capture', lowConfidence: 'Automatic boundary detection is uncertain. Check the print boundary lines.', highConfidence: 'Print boundaries were detected consistently.', localOnly: 'On-device analysis'
  },
  JP: {
    eyebrow: 'CARD LAB', title: 'センタリング測定', intro: 'カード全体を撮影すると遠近を自動補正し、表面の左右・上下の印刷比率を端末内で分析します。', start: 'カメラで測定する', privacy: '撮影画像はサーバーへ保存・送信しません。', guideTitle: '測定前の確認', guideItems: ['スリーブとローダーを外してください。', '反射の少ない暗い単色の台に置いてください。', 'カード全体が見えるように撮影してください。傾きは撮影後に補正します。'], cameraTitle: 'カードを枠内に合わせてください', cameraBody: '四隅を白いガイドに合わせ、そのまま固定してください。', manualCapture: '今すぐ撮影', cancel: 'キャンセル', analyzing: 'センタリング分析中', analyzingBody: 'カードの四隅と遠近を補正してから印刷境界を確認しています。', resultEyebrow: 'CENTERING REPORT', resultTitle: 'センタリング診断', score: 'センタリングスコア', horizontal: '左右比率', vertical: '上下比率', confidence: '測定信頼度', retake: '撮り直す', adjust: '印刷境界を調整', adjustHelp: '自動境界線が印刷領域と異なる場合はスライダーで調整してください。', left: '左', right: '右', top: '上', bottom: '下', reference: 'センタリング参考範囲', notice: 'センタリングのみの参考値です。表面、角、印刷状態、鑑定士の判断は含まず、PSAグレードを保証しません。', official: 'PSA公式基準を見る', permissionDenied: 'カメラ権限がブロックされています。サイト設定でカメラを許可してから再試行してください。', cameraUnavailable: '利用可能なカメラが見つかりません。', cameraError: 'カメラを開始できませんでした。他のアプリが使用していないか確認してください。', retry: '再試行', qualityAlign: '構図', qualityLight: '明るさ', qualityStill: '固定', ready: '良好', wait: '確認中', alignCard: 'カードの四隅を合わせてください', tooDark: 'もう少し明るくしてください', tooBright: '反射を減らしてください', holdStill: '端末を固定してください', focus: 'ピントを合わせています', autoReady: 'そのまま固定すると自動撮影します', lowConfidence: '自動境界認識が不確実です。印刷境界線を確認してください。', highConfidence: '印刷境界を安定して認識しました。', localOnly: '端末内分析'
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
    dark: '조금 더 밝은 곳에서 촬영해 주세요.',
    glare: '빛 반사를 줄인 뒤 촬영해 주세요.',
    burst: '가장 선명한 장면을 고르고 있습니다.',
    cornerTitle: '카드 모서리를 확인해 주세요',
    cornerBody: '자동 인식이 불확실합니다. 네 점을 카드의 실제 모서리로 옮긴 뒤 분석해 주세요.',
    cornerApply: '이 위치로 분석',
    cornerRetake: '다시 촬영',
    cornerLabel: '카드 모서리',
    readjust: '모서리 다시 조정',
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
    dark: 'Move to a brighter area.',
    glare: 'Reduce glare before capturing.',
    burst: 'Selecting the sharpest frame.',
    cornerTitle: 'Check the card corners',
    cornerBody: 'Automatic detection is uncertain. Move the four points onto the physical card corners.',
    cornerApply: 'Analyze these corners',
    cornerRetake: 'Retake',
    cornerLabel: 'Card corner',
    readjust: 'Adjust corners',
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
    dark: 'もう少し明るい場所で撮影してください。',
    glare: '光の反射を減らしてから撮影してください。',
    burst: '最も鮮明なフレームを選択しています。',
    cornerTitle: 'カードの四隅を確認してください',
    cornerBody: '自動認識が不確実です。4つの点をカードの実際の角へ移動してください。',
    cornerApply: 'この位置で分析',
    cornerRetake: '撮り直す',
    cornerLabel: 'カードの角',
    readjust: '四隅を再調整',
    analysisError: '画像を分析できませんでした。カードを撮り直してください。'
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
  let cardHeight = height * 0.78;
  let cardWidth = cardHeight * targetRatio;
  if (cardWidth > width * 0.78) {
    cardWidth = width * 0.78;
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
    const score = count * clamp(1.25 - centerDistance, 0.45, 1.25) * clamp(width / Math.max(height, 1), 0.4, 1.4);
    if (!best || score > best.score) best = { score, count, width, height, tl, tr, br, bl, centerDistance };
  }
  if (!best) return { points: getDefaultCornerPoints(canvas.width, canvas.height), confidence: 0, areaRatio: 0, centerDistance: 1 };
  const scaleX = canvas.width / sample.width;
  const scaleY = canvas.height / sample.height;
  const points = {
    tl: { x: best.tl.x * scaleX, y: best.tl.y * scaleY },
    tr: { x: best.tr.x * scaleX, y: best.tr.y * scaleY },
    br: { x: best.br.x * scaleX, y: best.br.y * scaleY },
    bl: { x: best.bl.x * scaleX, y: best.bl.y * scaleY }
  };
  const averageWidth = (pointDistance(points.tl, points.tr) + pointDistance(points.bl, points.br)) / 2;
  const averageHeight = (pointDistance(points.tl, points.bl) + pointDistance(points.tr, points.br)) / 2;
  const detectedRatio = averageWidth / Math.max(averageHeight, 1);
  const targetRatio = CARD_WIDTH_MM / CARD_HEIGHT_MM;
  const ratioScore = clamp(1 - Math.abs(Math.log(detectedRatio / targetRatio)) / 0.65, 0, 1);
  const areaRatio = polygonArea(points) / (canvas.width * canvas.height);
  const areaScore = clamp((areaRatio - 0.04) / 0.26, 0, 1);
  const sizeScore = clamp(Math.min(best.width / sample.width, best.height / sample.height) / 0.34, 0, 1);
  const centerScore = clamp(1 - best.centerDistance / 0.52, 0, 1);
  const confidence = ratioScore * 0.34 + areaScore * 0.3 + sizeScore * 0.2 + centerScore * 0.16;
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
  const { tl, tr, br, bl } = points;
  for (let y = 0; y < output.height; y += 1) {
    const v = y / (output.height - 1);
    for (let x = 0; x < output.width; x += 1) {
      const u = x / (output.width - 1);
      const sourceX = (1 - u) * (1 - v) * tl.x + u * (1 - v) * tr.x + u * v * br.x + (1 - u) * v * bl.x;
      const sourceY = (1 - u) * (1 - v) * tl.y + u * (1 - v) * tr.y + u * v * br.y + (1 - u) * v * bl.y;
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
    <svg className="centering-guide-svg" viewBox="0 0 63 88" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect x="0.5" y="0.5" width="62" height="87" rx="2" />
      <path d="M0.5 11V0.5H11M52 0.5h10.5V11M62.5 77v10.5H52M11 87.5H0.5V77" className="is-corner" />
      <rect x="3.2" y="4.5" width="56.6" height="79" rx="1.4" className="is-inner" />
      <rect x="5.7" y="8" width="51.6" height="72" rx="1" className="is-inner is-dashed" />
      <path d="M31.5 0.5v87M0.5 44h62" className="is-axis" />
      <circle cx="31.5" cy="44" r="1.8" className="is-center" />
      <text x="31.5" y="3.4" textAnchor="middle">63 × 88 mm</text>
      <text x="31.5" y="85.8" textAnchor="middle">CARD PONE CENTER</text>
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
  const flow = CAMERA_FLOW_COPY[uiLang] || CAMERA_FLOW_COPY.KR;
  const demoMode = import.meta.env.DEV && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('centeringDemo') : '';
  const demoResult = demoMode === 'result';
  const demoCamera = demoMode === 'camera';
  const demoCorners = demoMode === 'corners';
  const [phase, setPhase] = useState(demoResult ? 'result' : demoCamera ? 'camera' : demoCorners ? 'corners' : 'intro');
  const [error, setError] = useState('');
  const [qualityMessage, setQualityMessage] = useState(flow.hint);
  const [imageUrl, setImageUrl] = useState('');
  const [rawImageUrl, setRawImageUrl] = useState('');
  const [rawAspectRatio, setRawAspectRatio] = useState('3 / 4');
  const [cornerPoints, setCornerPoints] = useState({
    tl: { x: 14, y: 10 }, tr: { x: 86, y: 10 }, br: { x: 86, y: 90 }, bl: { x: 14, y: 90 }
  });
  const [cornerConfidence, setCornerConfidence] = useState(0);
  const [boundaries, setBoundaries] = useState(demoResult ? { left: 6.2, right: 5.5, top: 5.8, bottom: 6.1 } : { left: 6, right: 6, top: 6, bottom: 6 });
  const [confidence, setConfidence] = useState(demoResult ? 0.88 : 0);
  const videoRef = useRef(null);
  const viewportRef = useRef(null);
  const streamRef = useRef(null);
  const monitorCanvasRef = useRef(null);
  const rawCanvasRef = useRef(null);
  const cornerFrameRef = useRef(null);
  const animationRef = useRef(0);
  const lastMeasuredRef = useRef(0);
  const captureLockedRef = useRef(false);

  const report = useMemo(() => getCenteringReport(boundaries), [boundaries]);
  const confidencePercent = Math.round(confidence * 100);

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
      setCornerConfidence(demoDetection.confidence);
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
    if (phase !== 'camera' && phase !== 'corners') return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [phase]);

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
      setPhase('analyzing');
      rawCanvasRef.current = canvas;
      setRawImageUrl(canvas.toDataURL('image/jpeg', 0.91));
      setRawAspectRatio(`${canvas.width} / ${canvas.height}`);
      const detection = detectCardCorners(canvas);
      const normalizedPoints = normalizeCornerPoints(detection.points, canvas.width, canvas.height);
      setCornerPoints(normalizedPoints);
      setCornerConfidence(detection.confidence);
      await sleep(520);
      if (detection.confidence >= 0.62) await applyCornerAnalysis(normalizedPoints, detection.confidence);
      else setPhase('corners');
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

  async function applyCornerAnalysis(points = cornerPoints, detectionConfidence = cornerConfidence) {
    const source = rawCanvasRef.current;
    if (!source) return;
    try {
      setPhase('analyzing');
      await sleep(60);
      const denormalized = denormalizeCornerPoints(points, source.width, source.height);
      const corrected = warpCardCanvas(source, denormalized);
      const analysis = analyzeCapturedCanvas(corrected);
      setImageUrl(corrected.toDataURL('image/jpeg', 0.92));
      setBoundaries(analysis.boundaries);
      setConfidence(clamp(analysis.confidence * 0.65 + detectionConfidence * 0.35, 0, 1));
      await sleep(360);
      setPhase('result');
    } catch {
      setError(flow.analysisError);
      setPhase('error');
    }
  }

  function updateCornerFromPointer(key, event) {
    const frame = cornerFrameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const next = {
      x: clamp((event.clientX - rect.left) / Math.max(rect.width, 1) * 100, 1, 99),
      y: clamp((event.clientY - rect.top) / Math.max(rect.height, 1) * 100, 1, 99)
    };
    setCornerPoints((current) => ({ ...current, [key]: next }));
  }

  function updateBoundary(key, value) {
    setBoundaries((current) => ({ ...current, [key]: Number(value) }));
    setConfidence((current) => Math.max(current, 0.7));
  }

  const referenceLabel = report.band === 'OUTSIDE'
    ? (uiLang === 'JP' ? 'PSA 8の表面基準外' : uiLang === 'EN' ? 'Outside PSA 8 front reference' : 'PSA 8 앞면 참고 범위 밖')
    : `${report.band} ${uiLang === 'JP' ? '表面参考範囲' : uiLang === 'EN' ? 'front reference' : '앞면 참고 범위'}`;

  return (
    <main className={`renew-subpage centering-lab${phase === 'camera' ? ' is-camera-open' : ''}${phase === 'corners' ? ' is-corner-open' : ''}`}>
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
            <div><span>LIVE CHECK</span><h2>{flow.title}</h2><p>{flow.body}</p></div>
            <button type="button" onClick={cancelCamera}>{text.cancel}</button>
          </div>
          <div className="centering-camera-stage" ref={viewportRef}>
            <video ref={videoRef} autoPlay muted playsInline />
            <div className="centering-camera-shade" />
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
          <button type="button" className="centering-primary-button" onClick={startCamera}>{text.retry}</button>
        </section>
      ) : null}

      {phase === 'corners' ? (
        <section className="centering-corner-panel">
          <header className="centering-corner-head">
            <div><span>CORNER CHECK</span><h2>{flow.cornerTitle}</h2><p>{flow.cornerBody}</p></div>
          </header>
          <div className="centering-corner-layout">
            <div
              className="centering-corner-frame"
              ref={cornerFrameRef}
              style={{ aspectRatio: rawAspectRatio }}
            >
              {rawImageUrl ? <img src={rawImageUrl} alt="" /> : null}
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polygon points={`${cornerPoints.tl.x},${cornerPoints.tl.y} ${cornerPoints.tr.x},${cornerPoints.tr.y} ${cornerPoints.br.x},${cornerPoints.br.y} ${cornerPoints.bl.x},${cornerPoints.bl.y}`} />
              </svg>
              {Object.entries(cornerPoints).map(([key, point], index) => (
                <button
                  type="button"
                  className="centering-corner-handle"
                  key={key}
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  aria-label={`${flow.cornerLabel} ${index + 1}`}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    updateCornerFromPointer(key, event);
                  }}
                  onPointerMove={(event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) updateCornerFromPointer(key, event);
                  }}
                ><span>{index + 1}</span></button>
              ))}
            </div>
            <div className="centering-corner-actions">
              <button type="button" onClick={startCamera}>{flow.cornerRetake}</button>
              <button type="button" className="centering-primary-button" onClick={() => applyCornerAnalysis(cornerPoints, Math.max(cornerConfidence, 0.72))}>{flow.cornerApply}</button>
            </div>
          </div>
        </section>
      ) : null}

      {phase === 'result' ? (
        <section className="centering-result-panel">
          <header className="centering-result-head">
            <div><span>{text.resultEyebrow}</span><h2>{text.resultTitle}</h2></div>
            <div className="centering-result-actions">
              {rawImageUrl ? <button type="button" onClick={() => setPhase('corners')}>{flow.readjust}</button> : null}
              <button type="button" onClick={startCamera}>{text.retake}</button>
            </div>
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
