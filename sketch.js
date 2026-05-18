let clearBtn;
let doneBtn;
let finished = false;
const btnWidth = 180;
const btnHeight = 56;
const btnMargin = 20;
const btnTopMargin = 12;
const safeMargin = 80;

let strokes = [];
let currentStroke = null;
let currentShine = null;
let gridG = null;
let strokesG = null;

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.position(0, 0);
  canvas.style('display', 'block');

  pixelDensity(1);
  noFill();
  stroke(0);
  strokeWeight(4);
  strokeJoin(ROUND);
  strokeCap(ROUND);

  clearBtn = {
    x: safeMargin + btnMargin,
    y: btnTopMargin,
    w: btnWidth,
    h: btnHeight,
    label: 'Ulangi',
  };

  doneBtn = {
    x: width - safeMargin - btnWidth - btnMargin,
    y: btnTopMargin,
    w: btnWidth,
    h: btnHeight,
    label: 'Selesai',
  };

  // Disable non-canvas interactions to prevent accidental reloads/navigation
  disableOutsideInteractions();
  // prepare offscreen layers
  gridG = createGraphics(windowWidth, windowHeight);
  gridG.pixelDensity(1);
  strokesG = createGraphics(windowWidth, windowHeight);
  strokesG.pixelDensity(1);
  strokesG.clear();
  renderGrid();
}

function disableOutsideInteractions() {
  // Disable right-click context menu
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  // Prevent drag and drop from navigating away
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());

  // Block common navigation / reload keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    const k = (e.key || '').toLowerCase();
    // F5, Ctrl/Cmd+R, Ctrl/Cmd+W, Ctrl+Shift+R, Backspace (when not in input)
    if (
      k === 'f5' ||
      (k === 'r' && (e.ctrlKey || e.metaKey)) ||
      (k === 'w' && (e.ctrlKey || e.metaKey)) ||
      (k === 'r' && e.ctrlKey && e.shiftKey) ||
      (k === 'backspace' && !['input', 'textarea'].includes(document.activeElement.tagName.toLowerCase()))
    ) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, { passive: false });

  // Prompt before unload so accidental pulls don't immediately navigate away
  window.addEventListener('beforeunload', (e) => {
    e.preventDefault();
    // Some browsers require returnValue to be set
    e.returnValue = '';
    return '';
  });
}

function draw() {
    frameRate(10000);
  // blit cached background + guides
  if (gridG) image(gridG, 0, 0);
  // blit strokes (incrementally rendered)
  if (strokesG) image(strokesG, 0, 0);

  // minimal per-frame work
  drawShine();
  drawUI();
}

function drawGridBackground() {
  const gridSize = 32;
  background(28);
  stroke(54);
  strokeWeight(1);

  for (let x = 0; x <= width; x += gridSize) {
    line(x, 0, x, height);
  }
  for (let y = 0; y <= height; y += gridSize) {
    line(0, y, width, y);
  }

  stroke(68);
  for (let x = 0; x <= width; x += gridSize * 4) {
    line(x, 0, x, height);
  }
  for (let y = 0; y <= height; y += gridSize * 4) {
    line(0, y, width, y);
  }
}

function drawStrokes() {
  stroke(255);
  strokeWeight(4);
  noFill();

  for (const strokePoints of strokes) {
    if (strokePoints.length < 2) {
      continue;
    }

    beginShape();
    curveVertex(strokePoints[0].x, strokePoints[0].y);
    curveVertex(strokePoints[0].x, strokePoints[0].y);

    for (const pt of strokePoints) {
      curveVertex(pt.x, pt.y);
    }

    const last = strokePoints[strokePoints.length - 1];
    curveVertex(last.x, last.y);
    curveVertex(last.x, last.y);
    endShape();
  }
}

function drawSafeMargin() {
  const left = safeMargin;
  const right = width - safeMargin;
  const top = safeMargin;
  const bottom = height - safeMargin;

  stroke(255, 215, 80, 240);
  strokeWeight(6);
  noFill();

  // Draw lines from the screen corners to the safe zone corners
  line(0, 0, left, top);
  line(width, 0, right, top);
  line(0, height, left, bottom);
  line(width, height, right, bottom);

  // Draw 4 corners of the safe zone with bold lines only
  const cornerLen = 40;
  line(left, top, left + cornerLen, top);
  line(left, top, left, top + cornerLen);

  line(right, top, right - cornerLen, top);
  line(right, top, right, top + cornerLen);

  line(left, bottom, left + cornerLen, bottom);
  line(left, bottom, left, bottom - cornerLen);

  line(right, bottom, right - cornerLen, bottom);
  line(right, bottom, right, bottom - cornerLen);

  // Draw dotted safe zone edges between the corners
  strokeWeight(2);
  const dashLength = 12;
  const gapLength = 8;
  drawDashedLine(left + cornerLen, top, right - cornerLen, top, dashLength, gapLength);
  drawDashedLine(left + cornerLen, bottom, right - cornerLen, bottom, dashLength, gapLength);
  drawDashedLine(left, top + cornerLen, left, bottom - cornerLen, dashLength, gapLength);
  drawDashedLine(right, top + cornerLen, right, bottom - cornerLen, dashLength, gapLength);
}

function drawDashedLine(x1, y1, x2, y2, dashLength, gapLength) {
  const distance = dist(x1, y1, x2, y2);
  const dx = (x2 - x1) / distance;
  const dy = (y2 - y1) / distance;
  let drawn = 0;

  while (drawn < distance) {
    const startX = x1 + dx * drawn;
    const startY = y1 + dy * drawn;
    drawn += dashLength;
    const endX = x1 + dx * min(drawn, distance);
    const endY = y1 + dy * min(drawn, distance);
    line(startX, startY, endX, endY);
    drawn += gapLength;
  }
}

function drawDashedLineOnGraphics(g, x1, y1, x2, y2, dashLength, gapLength) {
  const distance = dist(x1, y1, x2, y2);
  const dx = (x2 - x1) / distance;
  const dy = (y2 - y1) / distance;
  let drawn = 0;
  while (drawn < distance) {
    const startX = x1 + dx * drawn;
    const startY = y1 + dy * drawn;
    drawn += dashLength;
    const endX = x1 + dx * min(drawn, distance);
    const endY = y1 + dy * min(drawn, distance);
    g.line(startX, startY, endX, endY);
    drawn += gapLength;
  }
}

function renderGrid() {
  if (!gridG) return;
  const g = gridG;
  const gridSize = 32;
  g.clear();
  g.background(28);
  g.stroke(54);
  g.strokeWeight(1);

  for (let x = 0; x <= g.width; x += gridSize) {
    g.line(x, 0, x, g.height);
  }
  for (let y = 0; y <= g.height; y += gridSize) {
    g.line(0, y, g.width, y);
  }

  g.stroke(68);
  for (let x = 0; x <= g.width; x += gridSize * 4) {
    g.line(x, 0, x, g.height);
  }
  for (let y = 0; y <= g.height; y += gridSize * 4) {
    g.line(0, y, g.width, y);
  }

  // overlays and safe guides
  const left = safeMargin;
  const right = g.width - safeMargin;
  const top = safeMargin;
  const bottom = g.height - safeMargin;
  g.noStroke();
  g.fill(0, 70);
  g.rect(0, 0, g.width, top);
  g.rect(0, bottom, g.width, g.height - bottom);
  g.rect(0, top, left, bottom - top);
  g.rect(right, top, g.width - right, bottom - top);

  g.stroke(255, 215, 80, 240);
  g.strokeWeight(6);
  const cornerLen = 40;
  g.line(left, top, left + cornerLen, top);
  g.line(left, top, left, top + cornerLen);
  g.line(right, top, right - cornerLen, top);
  g.line(right, top, right, top + cornerLen);
  g.line(left, bottom, left + cornerLen, bottom);
  g.line(left, bottom, left, bottom - cornerLen);
  g.line(right, bottom, right - cornerLen, bottom);
  g.line(right, bottom, right, bottom - cornerLen);

  g.strokeWeight(2);
  const dashLength = 12;
  const gapLength = 8;
  drawDashedLineOnGraphics(g, left + cornerLen, top, right - cornerLen, top, dashLength, gapLength);
  drawDashedLineOnGraphics(g, left + cornerLen, bottom, right - cornerLen, bottom, dashLength, gapLength);
  drawDashedLineOnGraphics(g, left, top + cornerLen, left, bottom - cornerLen, dashLength, gapLength);
  drawDashedLineOnGraphics(g, right, top + cornerLen, right, bottom - cornerLen, dashLength, gapLength);

  // outer border
  g.stroke(255, 90, 90, 220);
  g.strokeWeight(3);
  g.noFill();
  g.rect(1.5, 1.5, g.width - 3, g.height - 3);
}

function drawSafeOverlay() {
  const left = safeMargin;
  const right = width - safeMargin;
  const top = safeMargin;
  const bottom = height - safeMargin;

  noStroke();
  fill(0, 70);

  rect(0, 0, width, top);
  rect(0, bottom, width, height - bottom);
  rect(0, top, left, bottom - top);
  rect(right, top, width - right, bottom - top);
}

function drawOuterBorder() {
  stroke(255, 90, 90, 220);
  strokeWeight(3);
  noFill();
  rect(1.5, 1.5, width - 3, height - 3);
}

function drawUI() {
  drawButton(clearBtn, color(220, 60, 60));
  drawButton(doneBtn, color(80, 180, 90));

  if (finished) {
    fill(255);
    textSize(20);
    textAlign(LEFT, CENTER);
    text('Signature complete. Tap Clear to redraw.', btnMargin, height - 30);
  }
}

function drawButton(btn, fillColor) {
  noStroke();
  fill(fillColor);
  rect(btn.x, btn.y, btn.w, btn.h, 12);

  noStroke();
  fill(255);
  textSize(24);
  textStyle(BOLD);
  textAlign(CENTER, CENTER);
  text(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
  textStyle(NORMAL);
}

function mousePressed() {
  currentShine = { x: mouseX, y: mouseY };
  if (isInside(mouseX, mouseY, clearBtn)) {
    clearSignature();
    return false;
  }

  if (isInside(mouseX, mouseY, doneBtn)) {
    done();
    return false;
  }

  if (!finished) {
    currentStroke = [{ x: mouseX, y: mouseY }];
    strokes.push(currentStroke);
    // draw initial dot to strokesG
    strokesG.stroke(255);
    strokesG.strokeWeight(4);
    strokesG.strokeJoin(ROUND);
    strokesG.strokeCap(ROUND);
    strokesG.point(mouseX, mouseY);
  }
}

function drawShine() {
  if (!currentShine) return;
  const cx = currentShine.x;
  const cy = currentShine.y;

  // CNC guide lines from each edge to the touch point
  stroke(255, 200, 80, 160);
  strokeWeight(1);
  line(cx, 0, cx, cy);
  line(cx, height, cx, cy);
  line(0, cy, cx, cy);
  line(width, cy, cx, cy);

  // radial gradient glow (simulated with a few concentric ellipses for perf)
  noStroke();
  const outerR = 160;
  const steps = 18;
  const peakAlpha = 160;
  for (let i = steps; i >= 1; i--) {
    const t = i / steps;
    const r = outerR * t;
    const fall = t * t;
    const alpha = peakAlpha * fall * 0.02;
    fill(255, 250, 220, alpha);
    ellipse(cx, cy, r * 2);
  }

  fill(255, 245, 200, 120);
  ellipse(cx, cy, 12);
}

function drawSmoothStrokeSegment(g, points) {
  const len = points.length;
  g.stroke(255);
  g.strokeWeight(4);
  g.strokeJoin(ROUND);
  g.strokeCap(ROUND);
  if (len === 1) {
    g.point(points[0].x, points[0].y);
    return;
  }
  if (len === 2) {
    g.line(points[0].x, points[0].y, points[1].x, points[1].y);
    return;
  }
  const p0 = points[len - 3];
  const p1 = points[len - 2];
  const p2 = points[len - 1];
  const startX = (p0.x + p1.x) / 2;
  const startY = (p0.y + p1.y) / 2;
  const endX = (p1.x + p2.x) / 2;
  const endY = (p1.y + p2.y) / 2;
  const stepsSample = 12;
  let prevX = startX;
  let prevY = startY;
  for (let i = 1; i <= stepsSample; i++) {
    const t = i / stepsSample;
    const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * p1.x + t * t * endX;
    const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * p1.y + t * t * endY;
    g.line(prevX, prevY, x, y);
    prevX = x;
    prevY = y;
  }
}

function mouseDragged() {
  if (!finished && currentStroke) {
    currentStroke.push({ x: mouseX, y: mouseY });
    if (currentStroke.length < 3) {
      drawSmoothStrokeSegment(strokesG, currentStroke);
    } else {
      const recent = currentStroke.slice(-3);
      drawSmoothStrokeSegment(strokesG, recent);
    }
  }
  currentShine = { x: mouseX, y: mouseY };
}

function mouseReleased() {
  currentStroke = null;
  currentShine = null;
}

function touchStarted() {
  return mousePressed();
}

function touchMoved() {
  mouseDragged();
  return false;
}

function clearSignature() {
  strokes = [];
  currentStroke = null;
  finished = false;
  // clear the strokes layer
  strokesG.clear();
}

function done() {
  finished = true;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // recreate layers at new size
  gridG = createGraphics(windowWidth, windowHeight);
  gridG.pixelDensity(1);
  strokesG = createGraphics(windowWidth, windowHeight);
  strokesG.pixelDensity(1);
  strokesG.clear();
  renderGrid();

  // reposition buttons
  clearBtn.x = safeMargin + btnMargin;
  doneBtn.x = width - safeMargin - btnWidth - btnMargin;
}

function isInside(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}
