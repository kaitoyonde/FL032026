let clearBtn;
let doneBtn;
let finished = false;
let scanStartTime = 0; // Scanning animation timing reference
let allowUnload = false; // Flag to bypass the beforeunload reload confirmation prompt
const btnWidth = 260; // broad width for high accessibility
const btnHeight = 62; // shallower y-side to perfectly clear the top safe boundary (80px)
const btnMargin = 20;
const btnTopMargin = 9; // positioned at y=9, ending at y=71, leaving a clean margin above & below
const safeMargin = 80;

let strokes = [];
let currentStroke = null;
let currentShine = null;
let gridG = null;
let strokesG = null;
let logoImg = null; // Umbra logo
let backgroundImg = null;
let selectedGuestName = "";
let guestSelectTime = 0;

function preload() {
  logoImg = loadImage('umbra.svg');
  backgroundImg = loadImage('bg_ttd.png');
}


function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.position(0, 0);
  canvas.style('display', 'block');
  canvas.style('touch-action', 'none');
  canvas.style('user-select', 'none');

  // Prevent browser-level double-click behaviors on the canvas
  canvas.elt.addEventListener('dblclick', (e) => {
    e.preventDefault();
    e.stopPropagation();
  }, { passive: false });

  // Add global mouseup and touchend fallback to ensure drawing state clears
  window.addEventListener('mouseup', () => {
    if (selectedGuestName && currentStroke) {
      mouseReleased();
    }
  });
  window.addEventListener('touchend', () => {
    if (selectedGuestName && currentStroke) {
      mouseReleased();
    }
  });


  window.enterFullscreenSystem = function (guestName) {
    selectedGuestName = guestName || "VIP GUEST";
    guestSelectTime = millis();
    if (!fullscreen()) {
      fullscreen(true);
    }
  };

  window.exitFullscreenSystem = function () {
    clearSignature();
    selectedGuestName = "";
    guestSelectTime = 0;
    if (fullscreen()) {
      fullscreen(false);
    }
  };

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

  // Prevent pull-to-refresh / bounce drag-down gestures on document when signed in
  document.addEventListener('touchmove', (e) => {
    if (selectedGuestName) {
      e.preventDefault();
    }
  }, { passive: false });

  // Prevent multi-touch pinch gestures on document
  document.addEventListener('touchstart', (e) => {
    if (selectedGuestName && e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });

  // Prompt before unload so accidental pulls don't immediately navigate away
  window.addEventListener('beforeunload', (e) => {
    if (allowUnload) {
      return; // Bypass prompt when doing programmatically triggered reloads (e.g. Selesai)
    }
    e.preventDefault();
    // Some browsers require returnValue to be set
    e.returnValue = '';
    return '';
  });
}

function draw() {
  // blit cached background + guides
  // if (gridG) image(gridG, 0, 0);
  // blit strokes (incrementally rendered)
  if (backgroundImg) image(backgroundImg, 0, 0, width, height);
  if (strokesG) image(strokesG, 0, 0);

  // draw clean biometric telemetry logging panel on the bottom-left
  // drawBiometricTelemetry();

  // draw notice with umbra logo on the bottom-right outside safe zone
  // drawLogoNotice();

  // Dynamic instruction guide watermark notice (removed after first stroke!)
  // drawSignatureGuide();

  // Futuristic biometric scanner and path excitation
  drawScannerAnimation();

  // Dynamic HUD overlays (Pulsing corner brackets, secure watermarks, targets)
  drawDynamicHUD();

  // Breathing outer gradient edge glow lights (Always active!)
  drawOuterBorder();

  // minimal per-frame work
  // drawSignerIdentity();
  // drawShine();
  drawUI();

  // Dynamic Cursor Feedback (Pointer hand for clear/done buttons only)
  let clearHover = isInside(mouseX, mouseY, clearBtn);
  let doneHover = isInside(mouseX, mouseY, doneBtn) && (strokes.length > 0);
  if (clearHover || doneHover) {
    cursor('pointer');
  } else {
    cursor('default');
  }
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
  for (const strokePoints of strokes) {
    if (strokePoints.length < 2) continue;

    // 1. Draw glowing neon outer layer
    stroke(0, 243, 255, 35);
    strokeWeight(8);
    drawStrokeCore(strokePoints);

    // 2. Draw glowing neon mid layer
    stroke(0, 255, 200, 80);
    strokeWeight(5);
    drawStrokeCore(strokePoints);

    // 3. Draw bright, sharp inner core
    stroke(225, 255, 255, 240);
    strokeWeight(2.5);
    drawStrokeCore(strokePoints);
  }
}

function drawStrokeCore(strokePoints) {
  noFill();
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

function drawSafeMargin() {
  const left = safeMargin;
  const right = width - safeMargin;
  const top = safeMargin;
  const bottom = height - safeMargin;

  // Brackets
  stroke(0, 220, 255, 220);
  strokeWeight(3.5);
  noFill();

  // Draw lines from the screen corners to the safe zone corners
  stroke(0, 180, 255, 50);
  strokeWeight(1);
  line(0, 0, left, top);
  line(width, 0, right, top);
  line(0, height, left, bottom);
  line(width, height, right, bottom);

  // Draw 4 corners of the safe zone with bold lines only
  stroke(0, 220, 255, 220);
  strokeWeight(3.5);
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
  stroke(0, 220, 255, 100);
  strokeWeight(1.5);
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

  // Tactical navy background
  g.background(8, 14, 21);

  // Faint cyan minor grid
  g.stroke(0, 180, 255, 18);
  g.strokeWeight(0.7);
  for (let x = 0; x <= g.width; x += gridSize) {
    g.line(x, 0, x, g.height);
  }
  for (let y = 0; y <= g.height; y += gridSize) {
    g.line(0, y, g.width, y);
  }

  // Cyan major grid
  g.stroke(0, 180, 255, 32);
  g.strokeWeight(1.2);
  for (let x = 0; x <= g.width; x += gridSize * 4) {
    g.line(x, 0, x, g.height);
  }
  for (let y = 0; y <= g.height; y += gridSize * 4) {
    g.line(0, y, g.width, y);
  }

  // Draw tiny technical crosshair coordinate ticks
  g.stroke(0, 255, 255, 50);
  g.strokeWeight(1);
  const left = safeMargin;
  const right = g.width - safeMargin;
  const top = safeMargin;
  const bottom = g.height - safeMargin;

  for (let x = left + gridSize * 4; x < right; x += gridSize * 8) {
    for (let y = top + gridSize * 4; y < bottom; y += gridSize * 8) {
      g.line(x - 3, y, x + 3, y);
      g.line(x, y - 3, x, y + 3);
    }
  }

  // Sleek overlay
  g.noStroke();
  g.fill(3, 6, 10, 160);
  g.rect(0, 0, g.width, top);
  g.rect(0, bottom, g.width, g.height - bottom);
  g.rect(0, top, left, bottom - top);
  g.rect(right, top, g.width - right, bottom - top);

  // Brackets
  g.stroke(0, 220, 255, 220);
  g.strokeWeight(3.5);
  const cornerLen = 40;
  g.line(left, top, left + cornerLen, top);
  g.line(left, top, left, top + cornerLen);
  g.line(right, top, right - cornerLen, top);
  g.line(right, top, right, top + cornerLen);
  g.line(left, bottom, left + cornerLen, bottom);
  g.line(left, bottom, left, bottom - cornerLen);
  g.line(right, bottom, right - cornerLen, bottom);
  g.line(right, bottom, right, bottom - cornerLen);

  g.strokeWeight(1.5);
  g.stroke(0, 220, 255, 100);
  const dashLength = 12;
  const gapLength = 8;
  drawDashedLineOnGraphics(g, left + cornerLen, top, right - cornerLen, top, dashLength, gapLength);
  drawDashedLineOnGraphics(g, left + cornerLen, bottom, right - cornerLen, bottom, dashLength, gapLength);
  drawDashedLineOnGraphics(g, left, top + cornerLen, left, bottom - cornerLen, dashLength, gapLength);
  drawDashedLineOnGraphics(g, right, top + cornerLen, right, bottom - cornerLen, dashLength, gapLength);

  // Outer warning border
  g.stroke(255, 80, 80, 120);
  g.strokeWeight(2.5);
  g.noFill();
  g.rect(1.5, 1.5, g.width - 3, g.height - 3);
}

function drawSafeOverlay() {
  const left = safeMargin;
  const right = width - safeMargin;
  const top = safeMargin;
  const bottom = height - safeMargin;

  noStroke();
  fill(3, 6, 10, 160);

  rect(0, 0, width, top);
  rect(0, bottom, width, height - bottom);
  rect(0, top, left, bottom - top);
  rect(right, top, width - right, bottom - top);
}

function drawOuterBorder() {
  let breathe = 0.4 + 0.6 * sin(millis() * 0.0025);

  let edgeCol;
  if (finished) {
    let elapsed = millis() - scanStartTime;
    if (elapsed < 2500) {
      edgeCol = color(255, 80, 0); // warning orange
    } else {
      edgeCol = color(0, 255, 200); // secured cyan
    }
  } else {
    if (strokes.length > 0) {
      edgeCol = color(0, 180, 255); // drawing active cyber-blue
    } else {
      edgeCol = color(0, 90, 220); // standby deep blue
    }
  }

  push();
  noFill();

  // 1. Layer 1: Wide, highly transparent ambient edge glow (casting soft light inward)
  stroke(red(edgeCol), green(edgeCol), blue(edgeCol), 15 * breathe);
  strokeWeight(32);
  rect(16, 16, width - 32, height - 32);

  // 2. Layer 2: Medium glowing neon aura
  stroke(red(edgeCol), green(edgeCol), blue(edgeCol), 45 * breathe);
  strokeWeight(12);
  rect(6, 6, width - 12, height - 12);

  // 3. Layer 3: Crisp high-contrast inner vector core line
  stroke(red(edgeCol), green(edgeCol), blue(edgeCol), 140 + 40 * breathe);
  strokeWeight(3.0);
  rect(1.5, 1.5, width - 3, height - 3);
  pop();
}

function drawUI() {
  // Check if mouse is hovering over buttons
  let clearHover = isInside(mouseX, mouseY, clearBtn);
  let doneHover = isInside(mouseX, mouseY, doneBtn) && (strokes.length > 0);

  drawHoloButton(clearBtn, color(255, 80, 80), '[ ↺ ULANGI ]', clearHover);
  drawHoloButton(doneBtn, color(0, 255, 200), '[ ✓ SELESAI ]', doneHover, strokes.length === 0);

  if (finished) {
    let elapsed = millis() - scanStartTime;
    push();
    textFont('Space Mono', 'monospace');
    textAlign(LEFT, CENTER);

    if (elapsed < 2000) {
      let progress = elapsed / 2000;
      let pct = floor(progress * 100);

      // A. Dynamic text updates based on encrypting/uploading sub-stage percentages
      let statusText = "";
      if (pct < 25) {
        statusText = `>> SYSTEM: COMPRESSING BIOMETRIC HASH... ${pct}%`;
      } else if (pct < 55) {
        statusText = `>> SYSTEM: GENERATING SHA-512 MULTI-SIG KEYS... ${pct}%`;
      } else if (pct < 85) {
        statusText = `>> SYSTEM: TRANSMITTING BIOMETRIC PACKETS TO HOST... ${pct}%`;
      } else {
        statusText = `>> SYSTEM: DEPLOYING CRYPTO AUDIT SHIELD PROT... ${pct}%`;
      }

      // Text breathes gently in cyan during active transfer
      let pulse = 0.8 + 0.2 * sin(millis() * 0.015);
      fill(0, 255, 200, 200 * pulse);
      textSize(12);
      text(statusText, btnMargin + safeMargin, height - 42);

      // B. Advanced diagnostic calibration progress bar
      let barX = btnMargin + safeMargin;
      let barY = height - 25;
      let barW = 280;
      let barH = 6;

      // Glowing green-cyan container border
      stroke(0, 255, 200, 80);
      strokeWeight(1);
      noFill();
      rect(barX, barY, barW, barH, 2);

      // Filled cyan progress slider
      noStroke();
      fill(0, 255, 200, 200);
      rect(barX, barY, barW * progress, barH, 2);

      // Blinding white-hot leading edge spark
      stroke(255, 255, 255, 255);
      strokeWeight(2.5);
      line(barX + barW * progress, barY - 3, barX + barW * progress, barY + barH + 3);

      // Fine amber tick lines along progress bar to represent telemetry calibration
      stroke(255, 110, 0, 120);
      strokeWeight(1);
      line(barX + barW * 0.25, barY + 1, barX + barW * 0.25, barY + barH - 1);
      line(barX + barW * 0.50, barY + 1, barX + barW * 0.50, barY + barH - 1);
      line(barX + barW * 0.75, barY + 1, barX + barW * 0.75, barY + barH - 1);

    } else {
      // C. Transition complete: Show the original tap to reset secure notice
      fill(0, 255, 200, 220);
      textSize(12);
      text('>> SYSTEM: SIGNATURE SECURED & ENCRYPTED. TAP ULANGI TO RESET.', btnMargin + safeMargin, height - 35);

      // D. Draw a smooth fading progress outline locked at 100% completed state
      let fadeElapsed = elapsed - 2000;
      if (fadeElapsed < 500) {
        let barAlpha = 255 - fadeElapsed * 0.51; // fade out over 500ms
        let barX = btnMargin + safeMargin;
        let barY = height - 25;
        let barW = 280;
        let barH = 6;

        stroke(0, 255, 200, 80 * (barAlpha / 255));
        strokeWeight(1);
        noFill();
        rect(barX, barY, barW, barH, 2);

        noStroke();
        fill(0, 255, 200, 200 * (barAlpha / 255));
        rect(barX, barY, barW, barH, 2);
      }
    }
    pop();
  }
}

function drawHoloButton(btn, themeColor, labelText, isHovered, isDisabled = false) {
  push();
  textFont('Space Mono', 'monospace');

  let activeColor = themeColor;
  if (isDisabled) {
    activeColor = color(70, 85, 100); // dim faded slate-grey
    isHovered = false; // force no hover feedback
  }

  // 1. Hover glow backing (larger and more obvious!)
  if (isHovered && !isDisabled) {
    noStroke();
    fill(red(activeColor), green(activeColor), blue(activeColor), 50);
    rect(btn.x - 5, btn.y - 5, btn.w + 10, btn.h + 10, 8);
  }

  // 2. Opaque premium dark slate backdrop (100% opaque for perfect reading separation!)
  fill(12, 17, 23, 255);

  // 3. Thick glowing borders (increased strokeWeight!)
  if (isHovered && !isDisabled) {
    stroke(activeColor);
    strokeWeight(4);
  } else {
    stroke(red(activeColor), green(activeColor), blue(activeColor), isDisabled ? 80 : 200);
    strokeWeight(2.5); // very bold and crisp!
  }
  rect(btn.x, btn.y, btn.w, btn.h, 4);

  // 4. Accent corner brackets (larger corner ticks!)
  stroke(red(activeColor), green(activeColor), blue(activeColor), isDisabled ? 80 : 255);
  strokeWeight(3);
  const brk = 16; // increased bracket size for a beautiful industrial console vibe
  // top-left
  line(btn.x, btn.y, btn.x + brk, btn.y);
  line(btn.x, btn.y, btn.x, btn.y + brk);
  // bottom-right
  line(btn.x + btn.w, btn.y + btn.h, btn.x + btn.w - brk, btn.y + btn.h);
  line(btn.x + btn.w, btn.y + btn.h, btn.x + btn.w, btn.y + btn.h - brk);

  // 5. Label text (enlarged to 25px BOLD for absolute clarity and visual pop!)
  noStroke();
  if (isHovered && !isDisabled) {
    fill(255);
  } else {
    // Keep highly glowing high-contrast theme color
    fill(red(activeColor), green(activeColor), blue(activeColor), isDisabled ? 80 : 255);
  }
  textSize(25); // increased from 22 to 25!
  textStyle(BOLD);
  textAlign(CENTER, CENTER);
  text(labelText, btn.x + btn.w / 2, btn.y + btn.h / 2);
  pop();
}

function mousePressed(event) {
  // If no guest is selected, ignore all canvas clicks/touches
  if (!selectedGuestName) {
    return;
  }

  // Grace period after selecting name to prevent double-tap canvas clutter
  if (millis() - guestSelectTime < 800) {
    return;
  }

  // Prevent drawing if the click originated on an HTML element (like our overlay)
  if (event && event.target && event.target.tagName !== 'CANVAS') {
    return;
  }

  currentShine = { x: mouseX, y: mouseY };
  if (isInside(mouseX, mouseY, clearBtn)) {
    clearSignature();
    // Notify receiver to clear drawing
    if (window.globalWS && window.globalWS.readyState === 1) {
      window.globalWS.send(JSON.stringify({ type: 'clear', name: selectedGuestName }));
    }
    return false;
  }

  if (isInside(mouseX, mouseY, doneBtn)) {
    if (strokes.length > 0) {
      done();
    }
    return false;
  }

  if (!finished) {
    currentStroke = [{ x: mouseX, y: mouseY }];
    strokes.push(currentStroke);

    // Send native websocket data
    if (window.globalWS && window.globalWS.readyState === 1) { // 1 = WebSocket.OPEN
      window.globalWS.send(JSON.stringify({ type: 'start', x: mouseX / width, y: mouseY / height, name: selectedGuestName }));
    }

    // draw initial dot to strokesG in glowing cyan
    // strokesG.stroke(0, 243, 255, 220);
    strokesG.stroke(0, 0, 0, 255);
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

  // CNC guide lines from each edge to the touch point - let's make it a beautiful, fine tech cyan!
  stroke(0, 220, 255, 80);
  stroke(0, 0, 0, 255);
  strokeWeight(0.5);
  line(cx, 0, cx, cy);
  line(cx, height, cx, cy);
  line(0, cy, cx, cy);
  line(width, cy, cx, cy);

  // Faint cyan radial touch halo
  noStroke();
  const outerR = 120;
  const steps = 12;
  const peakAlpha = 140;
  for (let i = steps; i >= 1; i--) {
    const t = i / steps;
    const r = outerR * t;
    const fall = t * t;
    const alpha = peakAlpha * fall * 0.015;
    fill(0, 255, 255, alpha);
    ellipse(cx, cy, r * 2);
  }

  // Technical crosshair marker
  stroke(0, 255, 255, 200);
  strokeWeight(1);
  noFill();
  ellipse(cx, cy, 10);
  line(cx - 8, cy, cx + 8, cy);
  line(cx, cy - 8, cx, cy + 8);
}

function drawSmoothStrokeSegment(g, points) {
  const len = points.length;
  if (len === 1) {
    // g.stroke(0, 243, 255, 220);
    g.stroke(0, 0, 0, 255);
    g.strokeWeight(4);
    g.strokeJoin(ROUND);
    g.strokeCap(ROUND);
    g.point(points[0].x, points[0].y);
    return;
  }
  if (len === 2) {
    // Glow neon curves segment
    g.stroke(0, 0, 0, 255);
    g.strokeWeight(8);
    g.line(points[0].x, points[0].y, points[1].x, points[1].y);

    g.stroke(0, 0, 0, 255);
    g.strokeWeight(5);
    g.line(points[0].x, points[0].y, points[1].x, points[1].y);

    g.stroke(0, 0, 0, 255);
    g.strokeWeight(2.5);
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

  // Render multi-level glows
  // drawCurveLayer(g, startX, startY, endX, endY, p1, stepsSample, 0, 243, 255, 35, 8.0);
  // drawCurveLayer(g, startX, startY, endX, endY, p1, stepsSample, 0, 255, 200, 80, 5.0);
  // drawCurveLayer(g, startX, startY, endX, endY, p1, stepsSample, 225, 255, 255, 240, 2.5);
  drawCurveLayer(g, startX, startY, endX, endY, p1, stepsSample, 0, 0, 0, 35, 8.0);
  drawCurveLayer(g, startX, startY, endX, endY, p1, stepsSample, 0, 0, 0, 80, 5.0);
  drawCurveLayer(g, startX, startY, endX, endY, p1, stepsSample, 0, 0, 0, 240, 2.5);
}

function drawCurveLayer(g, startX, startY, endX, endY, controlPt, steps, r, gr, b, a, wt) {
  g.stroke(r, gr, b, a);
  g.strokeWeight(wt);
  g.strokeJoin(ROUND);
  g.strokeCap(ROUND);

  let prevX = startX;
  let prevY = startY;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * controlPt.x + t * t * endX;
    const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * controlPt.y + t * t * endY;
    g.line(prevX, prevY, x, y);
    prevX = x;
    prevY = y;
  }
}

function mouseDragged(event) {
  if (!selectedGuestName) {
    return;
  }
  if (millis() - guestSelectTime < 800) {
    return;
  }
  if (event && event.target && event.target.tagName !== 'CANVAS') {
    return;
  }

  if (!finished && currentStroke) {
    currentStroke.push({ x: mouseX, y: mouseY });

    // Send native websocket data
    if (window.globalWS && window.globalWS.readyState === 1) {
      window.globalWS.send(JSON.stringify({ type: 'drag', x: mouseX / width, y: mouseY / height, name: selectedGuestName }));
    }

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
  if (!selectedGuestName) {
    return;
  }
  if (currentStroke && window.globalWS && window.globalWS.readyState === 1) {
    window.globalWS.send(JSON.stringify({ type: 'end', name: selectedGuestName }));
  }
  currentStroke = null;
  currentShine = null;
}

function touchStarted(event) {
  if (!selectedGuestName) {
    return; // Don't block touch start on name selection overlay
  }
  mousePressed(event);
  return false; // Prevent default gesture behavior on the canvas
}

function touchMoved(event) {
  if (!selectedGuestName) {
    return; // Don't block scrolling/swiping on name selection overlay
  }
  mouseDragged(event);
  return false; // Prevent default scrolling/gestures
}

function touchEnded(event) {
  if (!selectedGuestName) {
    return;
  }
  mouseReleased();
  return false; // Prevent emulated mouseup events
}

function clearSignature() {
  if (finished) {
    return; // Lock canvas resetting during encryption scanning
  }
  strokes = [];
  currentStroke = null;
  finished = false;
  // clear the strokes layer
  strokesG.clear();
}

function done() {
  if (finished) {
    return; // Guard against multiple done calls during the scanning transition
  }
  finished = true;
  scanStartTime = millis();

  // Normalize absolute coordinates to 0.0 - 1.0 floating point fractions
  const normalizedStrokes = strokes.map(stroke => 
    stroke.map(pt => ({
      x: pt.x / width,
      y: pt.y / height
    }))
  );

  // Notify receiver that signature session is completed, including the normalized stroke points dataset
  if (window.globalWS && window.globalWS.readyState === 1) {
    window.globalWS.send(JSON.stringify({ 
      type: 'done', 
      name: selectedGuestName, 
      strokes: normalizedStrokes 
    }));
  }

  // Refresh page after 2.5 seconds (duration of scanning animation)
  setTimeout(() => {
    allowUnload = true; // Set flag to disable the beforeunload confirmation popup
    window.location.reload();
  }, 2500);
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

  // Redraw all strokes onto the new strokesG graphics buffer
  for (let s of strokes) {
    if (s.length < 3) {
      drawSmoothStrokeSegment(strokesG, s);
    } else {
      for (let i = 0; i <= s.length - 3; i++) {
        drawSmoothStrokeSegment(strokesG, s.slice(i, i + 3));
      }
    }
  }

  // reposition buttons
  clearBtn.x = safeMargin + btnMargin;
  doneBtn.x = width - safeMargin - btnWidth - btnMargin;
}

function isInside(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

// ==========================================
// Futuristic Biometric Telemetry Logging Panel
// ==========================================

function drawBiometricTelemetry() {
  // Always render the biometric panel to maintain the stunning high-tech terminal aesthetic!

  const left = safeMargin + 20;
  const bottom = height - safeMargin - 20;
  const w = 240;
  const h = 130;
  const x = left;
  const y = bottom - h;

  push();
  // Draw high-tech translucent slate panel background
  fill(15, 20, 25, 220); // very dark slate
  stroke(0, 180, 255, 60); // subtle cyan border
  strokeWeight(1);
  rect(x, y, w, h, 6);

  // Technical grid corner brackets
  stroke(0, 255, 255, 120);
  strokeWeight(1.5);
  // Top-left bracket
  line(x + 2, y + 2, x + 10, y + 2);
  line(x + 2, y + 2, x + 2, y + 10);
  // Bottom-right bracket
  line(x + w - 2, y + h - 2, x + w - 10, y + h - 2);
  line(x + w - 2, y + h - 2, x + w - 2, y + h - 10);

  // Pulsing stream status indicator
  noStroke();
  textFont('Space Mono', 'monospace');
  textSize(10);
  textStyle(BOLD);

  let timeSec = millis() / 1000.0;
  let dotPulse = 120 + 135 * (0.5 + 0.5 * sin(timeSec * 7.0));
  fill(0, 255, 200, dotPulse);
  ellipse(x + 12, y + 15, 6);

  fill(0, 220, 255, 220);
  textAlign(LEFT, CENTER);
  text("BIOMETRIC STREAM [ONLINE]", x + 24, y + 15);

  // Panel divider line
  stroke(0, 180, 255, 40);
  strokeWeight(1);
  line(x + 8, y + 26, x + w - 8, y + 26);

  // Stroke metrics
  noStroke();
  textStyle(NORMAL);
  fill(0, 180, 255, 180);
  let totalPoints = strokes.reduce((acc, s) => acc + s.length, 0);
  text(`PATHWAYS: ${strokes.length} | NODES: ${totalPoints}`, x + 10, y + 36);

  // Real-time mouse cursor telemetry
  let curX = mouseX >= 0 && mouseX <= width ? floor(mouseX) : 0;
  let curY = mouseY >= 0 && mouseY <= height ? floor(mouseY) : 0;
  fill(255, 215, 80, 200); // gold telemetry highlight
  text(`SENSOR_XY: [${curX}, ${curY}]`, x + 10, y + 47);

  // Active Signer ID
  fill(0, 255, 200, 200); // glowing neon green
  let signerLabel = selectedGuestName ? selectedGuestName.toUpperCase() : "STANDBY";
  text(`SIGNER_ID: ${signerLabel}`, x + 10, y + 58);

  // Scrolling log title
  fill(0, 190, 255, 140);
  text("LATEST NODE TELEMETRY:", x + 10, y + 70);

  // Fetch last 3 points in current active stroke
  let latestPoints = [];
  if (strokes.length > 0) {
    let lastStroke = strokes[strokes.length - 1];
    if (lastStroke && lastStroke.length > 0) {
      let startIdx = max(0, lastStroke.length - 3);
      for (let i = lastStroke.length - 1; i >= startIdx; i--) {
        latestPoints.push({
          pt: lastStroke[i],
          idx: i
        });
      }
    }
  }

  // Render live state-aware telemetry stream (Always active & animated in any state!)
  textSize(9);
  if (latestPoints.length > 0) {
    // A. Active Drawing: show pen coordinate inputs
    fill(0, 255, 255, 160);
    for (let i = 0; i < 3; i++) {
      let yPos = y + 82 + i * 12;
      if (i < latestPoints.length) {
        let node = latestPoints[i];
        let timeStr = nf(floor(millis() / 100) % 100, 2);
        text(`> LOG_N${nf(node.idx, 3)}: [${floor(node.pt.x)}, ${floor(node.pt.y)}] @${timeStr}ms`, x + 12, yPos);
      } else {
        fill(0, 180, 255, 50);
        text(`> LOG_N---: [---, ---]`, x + 12, yPos);
      }
    }
  } else {
    // B. State-Aware Idle and scan ticker animations!
    let elapsed = finished ? millis() - scanStartTime : 0;
    let isScanning = finished && (elapsed < 2500);

    if (finished && !isScanning) {
      // B1. Secured locked state: show crypto shields and keys
      fill(0, 255, 200, 200);
      text(`> SYS_LOCK: SECURED & SHIELDED`, x + 12, y + 82);
      fill(0, 255, 200, 150);
      text(`> INTEGRITY: SHA-512 SUCCESS // LOCK`, x + 12, y + 94);
      fill(255, 110, 0, 180);
      text(`> PACKETS: AUDITED ON SHIELD NET`, x + 12, y + 106);
    } else if (isScanning) {
      // B2. Active scan sweep: show scanner progress and laser data
      fill(255, 110, 0, 220);
      text(`> SCANNER: ACTIVE (SWEEP_${floor(elapsed / 25)}MS)`, x + 12, y + 82);
      fill(0, 255, 200, 180);
      text(`> SYNC_BUS: TRANSMITTING BIOMETRIC PACKETS`, x + 12, y + 94);
      fill(0, 255, 200, 140);
      text(`> CNC_LASER: EXCITING INK NODES`, x + 12, y + 106);
    } else {
      // B3. Standby Idle state: continuously ticking active telemetry!
      fill(0, 255, 255, 180);
      text(`> SYS_UPTIME: ${(millis() / 1000).toFixed(2)}s`, x + 12, y + 82);
      fill(0, 180, 255, 140);
      text(`> DIAG_FPS: ${floor(frameRate() || 240)}Hz [CALIBRATED]`, x + 12, y + 94);

      let db = -42 + floor(sin(millis() * 0.015) * 1.5);
      fill(255, 215, 80, 160);
      text(`> TELEM_WAVE: ${db}dBm [REALTIME_SIGNAL]`, x + 12, y + 106);
    }
  }
  pop();
}

function drawLogoNotice() {
  if (!logoImg) return;
  push();
  textFont('Space Mono', 'monospace');

  let rightEdge = width - safeMargin;
  let centerY = height - (safeMargin / 2); // Center of the 80px bottom margin

  // Dynamic scale preserving perfect original SVG viewBox aspect ratio: 2371.1 / 797.3
  let logoH = 34; // enlarged height for brand presence
  let logoW = logoH * (2371.1 / 797.3);
  let spacing = 14;

  // Text content
  textSize(12);
  textStyle(BOLD);
  textAlign(RIGHT, CENTER);

  let label1 = "Interactive Technology By";
  let label2 = "@umbrasoftworks @kaitoyonde";
  let w2 = textWidth(label2);

  // Line heights centered around centerY
  let y1 = centerY - 10;
  let y2 = centerY + 10;

  // Draw Line 1 (Static Label)
  noStroke();
  fill(0, 180, 255, 120); // faint cyan-blue
  text(label1, rightEdge - logoW - spacing, y1);

  // Draw Line 2 (Static tags handles)
  fill(0, 180, 255, 180); // clear high-contrast cyber blue-cyan
  text(label2, rightEdge - logoW - spacing, y2);

  // Draw Instagram Icon before the second line
  let xStart2 = rightEdge - logoW - spacing - w2;
  drawInstagramIcon(xStart2 - 12, y2, 11);

  // Draw Umbra LogoImg
  imageMode(CENTER);
  image(logoImg, rightEdge - (logoW / 2), centerY, logoW, logoH);
  pop();
}

function drawInstagramIcon(x, y, size) {
  push();
  rectMode(CENTER);
  noFill();
  stroke(0, 180, 255, 180);
  strokeWeight(1.4);

  // outer rounded square
  rect(x, y, size, size, size * 0.28);

  // inner circle
  ellipse(x, y, size * 0.5);

  // top-right dot
  fill(0, 180, 255, 180);
  noStroke();
  ellipse(x + size * 0.25, y - size * 0.25, size * 0.12);
  pop();
}

function drawScannerAnimation() {
  if (!finished) return;

  let scanDuration = 2500; // 2.5 seconds per confirmation scan
  let elapsed = millis() - scanStartTime;
  let isScanning = elapsed < scanDuration;

  // 1. Sprinkle up to 100 forensic fingerprint minutiae markers along the signature (PERMANENT & PERFECTLY DISTRIBUTED!)
  let allNodes = [];
  for (const strokePoints of strokes) {
    for (const pt of strokePoints) {
      allNodes.push(pt);
    }
  }
  if (allNodes.length > 0) {
    let nodeCount = min(allNodes.length, 100);
    for (let k = 0; k < nodeCount; k++) {
      // Map k linearly to ensure markers are perfectly and evenly distributed from start to end!
      let nodeIdx = floor(map(k, 0, nodeCount - 1, 0, allNodes.length - 1));
      let pt = allNodes[nodeIdx];

      // Keep markers dynamically pulsing while scanning, lock to 100% full glow once completed!
      let pulse = 1.0;
      if (isScanning) {
        pulse = 0.4 + 0.6 * sin(millis() * 0.008 + k * 0.4);
      }

      push();
      // Massive layered orange radial background glow for ultimate high-contrast presence!
      noStroke();
      fill(255, 110, 0, 15 * pulse);
      ellipse(pt.x, pt.y, 30);

      fill(255, 110, 0, 45 * pulse);
      ellipse(pt.x, pt.y, 18);

      // A. Inner Target Circle (Pronounced Cyber Orange)
      stroke(255, 110, 0, 220 * pulse);
      strokeWeight(2.0);
      noFill();
      ellipse(pt.x, pt.y, 14, 14);

      // B. Concentric Outer Targeting Ring (Sci-fi diagnostic reticle!)
      stroke(255, 110, 0, 100 * pulse);
      strokeWeight(1.0);
      ellipse(pt.x, pt.y, 24, 24);

      // C. Minutiae ridge direction tail (Fingerprint minutiae orientation in Cyber Orange)
      let angle = k * 2.4;
      let rx = pt.x + cos(angle) * 11;
      let ry = pt.y + sin(angle) * 11;
      stroke(255, 110, 0, 180 * pulse);
      strokeWeight(1.5);
      line(pt.x, pt.y, rx, ry);

      // D. Blinding white-amber center core point
      stroke(255, 230, 180, 255 * pulse);
      strokeWeight(6.0);
      point(pt.x, pt.y);

      // E. Draw technical leader lines & labels for key minutiae points (every 20th marker)
      if (k % 20 === 0) {
        stroke(255, 110, 0, 160 * pulse);
        strokeWeight(1.0);
        // diagonal pointer line
        line(pt.x + 9, pt.y - 9, pt.x + 20, pt.y - 20);
        // horizontal text shelf
        line(pt.x + 20, pt.y - 20, pt.x + 40, pt.y - 20);

        // technical text label
        noStroke();
        fill(255, 110, 0, 240 * pulse);
        textFont('Space Mono', 'monospace');
        textSize(10);
        textAlign(LEFT, CENTER);
        text(`M_${nf(k, 2)}`, pt.x + 43, pt.y - 20);

        // F. Technical horizontal projection line to the nearest canvas safe boundary
        let xEdge = (pt.x < width / 2) ? safeMargin : width - safeMargin;
        stroke(255, 110, 0, 110 * pulse); // glowing orange alignment dashed line
        strokeWeight(1.0);

        drawingContext.setLineDash([4, 4]);
        line(pt.x, pt.y, xEdge, pt.y);
        drawingContext.setLineDash([]); // clear dash immediately

        // G. Draw a technical tick mark and coordinate readouts on the canvas safe boundaries
        stroke(255, 110, 0, 180 * pulse);
        strokeWeight(1.6);
        line(xEdge, pt.y - 6, xEdge, pt.y + 6); // tick mark

        noStroke();
        fill(255, 110, 0, 200 * pulse);
        textFont('Space Mono', 'monospace');
        textSize(10);
        if (xEdge === safeMargin) {
          textAlign(RIGHT, CENTER);
          text(`[Y:${floor(pt.y)}]`, safeMargin - 8, pt.y);
        } else {
          textAlign(LEFT, CENTER);
          text(`[Y:${floor(pt.y)}]`, width - safeMargin + 8, pt.y);
        }
      }
      pop();
    }
  }

  // 2. Active scanning overlay (Only runs while scanning sweep is active!)
  if (!isScanning) return;

  let t = elapsed / scanDuration;

  // Safe area bounds
  let scanTop = safeMargin;
  let scanBottom = height - safeMargin;
  let scanLeft = safeMargin;
  let scanRight = width - safeMargin;

  // Calculate vertical position of scanner line
  let scanY = scanTop + t * (scanBottom - scanTop);

  // A. Draw phosphor trailing glow extending upwards
  noStroke();
  for (let j = 1; j <= 20; j++) {
    let trailY = scanY - j * 2;
    if (trailY >= scanTop) {
      // Fade out as it goes up
      let alpha = (20 - j) * 1.8;
      fill(0, 255, 200, alpha);
      rect(scanLeft, trailY, scanRight - scanLeft, 2);
    }
  }

  // B. Draw sweeping CRT laser scanner line
  stroke(0, 255, 200, 40); // outer glow
  strokeWeight(8);
  line(scanLeft, scanY, scanRight, scanY);

  stroke(0, 255, 200, 220); // neon core
  strokeWeight(2);
  line(scanLeft, scanY, scanRight, scanY);

  stroke(225, 255, 255, 240); // white-cyan center beam
  strokeWeight(0.8);
  line(scanLeft, scanY, scanRight, scanY);

  // C. Excite signature strokes at laser sweep intersection
  for (const strokePoints of strokes) {
    for (const pt of strokePoints) {
      let d = abs(pt.y - scanY);
      if (d < 16) {
        let factor = 1 - (d / 16);
        // Excite stroke segment nodes with ultra-bright sparks!
        push();
        stroke(0, 255, 200, 150 * factor);
        strokeWeight(15 * factor);
        point(pt.x, pt.y);

        stroke(255, 255, 255, 240 * factor);
        strokeWeight(6 * factor);
        point(pt.x, pt.y);
        pop();
      }
    }
  }

  // D. Render traveling CNC Laser engraving head & decaying trailing tail
  for (const strokePoints of strokes) {
    if (strokePoints.length === 0) continue;

    // Scale index perfectly synchronized with scan time t (stops at 1.0)
    let indexFloat = t * (strokePoints.length - 1);
    let idx = floor(indexFloat);
    let nextIdx = min(idx + 1, strokePoints.length - 1);
    let lerpT = indexFloat - idx;
    let pA = strokePoints[idx];
    let pB = strokePoints[nextIdx];
    let px = lerp(pA.x, pB.x, lerpT);
    let py = lerp(pA.y, pB.y, lerpT);

    // i. Draw decaying super-heated molten laser tail (Thermal blackbody scale!)
    let trailStart = max(0, idx - 50);
    for (let i = trailStart; i < idx; i++) {
      let p1 = strokePoints[i];
      let p2 = strokePoints[i + 1];
      let age = (i - trailStart) / (idx - trailStart || 1); // 0.0 to 1.0

      push();
      // Outer super-heated glowing trail (Cooling blackbody gradient)
      let r, g, b, a;
      if (age < 0.5) {
        let la = age / 0.5;
        r = 255; g = la * 80; b = 0; a = 70 * la;
      } else {
        let la = (age - 0.5) / 0.5;
        r = 255; g = 80 + la * 140; b = la * 100; a = 70 + 150 * la;
      }
      stroke(r, g, b, a);
      strokeWeight(4 + 8 * age);
      line(p1.x, p1.y, p2.x, p2.y);

      // Inner blinding white-hot core (Fades in near the laser cutter nozzle)
      let cr, cg, cb, ca;
      if (age >= 0.6) {
        let la = (age - 0.6) / 0.4;
        cr = 255;
        cg = 180 + la * 75;
        cb = 120 + la * 135;
        ca = 220 * la;

        stroke(cr, cg, cb, ca);
        strokeWeight(1.0 + 2.5 * age);
        line(p1.x, p1.y, p2.x, p2.y);
      }
      pop();
    }

    // ii. Draw CNC Laser Head at (px, py)
    push();

    // Faint outer radiant energy halo
    noStroke();
    fill(0, 255, 200, 30);
    ellipse(px, py, 32);

    // Neon cutting ring
    stroke(0, 255, 200, 220);
    strokeWeight(1.4);
    noFill();
    ellipse(px, py, 14);

    // Technical CNC crosshairs (more pronounced)
    stroke(0, 255, 200, 180);
    strokeWeight(1.2);
    line(px - 12, py, px - 4, py);
    line(px + 4, py, px + 12, py);
    line(px, py - 12, px, py - 4);
    line(px, py + 4, px, py + 12);

    // Blazing-hot 4-layer laser focal point!
    stroke(0, 255, 200, 45); // Layer 1: Super-wide radiant halo
    strokeWeight(36);
    point(px, py);

    stroke(0, 255, 200, 100); // Layer 2: Wide vibrant halo
    strokeWeight(24);
    point(px, py);

    stroke(0, 255, 200, 220); // Layer 3: Intense neon glow core
    strokeWeight(14);
    point(px, py);

    stroke(255, 255, 255, 255); // Layer 4: Blinding white-hot center core
    strokeWeight(7.5);
    point(px, py);

    // Dynamic fiber micro-sparks (longer and thicker!)
    stroke(0, 255, 200, 240);
    strokeWeight(1.6);
    let sAngle1 = (millis() * 0.035) % TWO_PI;
    let sAngle2 = sAngle1 + PI / 2;
    let sLen = 8 + sin(millis() * 0.06) * 3;
    line(px, py, px + cos(sAngle1) * sLen, py + sin(sAngle1) * sLen);
    line(px, py, px + cos(sAngle2) * sLen, py + sin(sAngle2) * sLen);

    // iii. Procedural ascending digital data telemetry streams! (Zero state, performance-friendly)
    let seed1 = floor(px + py + millis() * 0.005) % 4;
    let hexes = ["0x3F", "0xA7", "0xD2", "0x5E", "0xB4", "0x1C", "0xF9", "0x8E"];

    push();
    textFont('Space Mono', 'monospace');
    textSize(8.5);

    // Faint cyber-cyan hexadecimal float 1
    let tVal = (millis() * 0.008) % 1.0;
    fill(0, 255, 200, 120 * (1 - tVal));
    let dy = tVal * 32;
    text(hexes[(seed1) % 8], px + 16, py - dy);

    // Faint cyber-orange hexadecimal float 2
    let tVal2 = ((millis() + 500) * 0.008) % 1.0;
    fill(255, 110, 0, 100 * (1 - tVal2));
    let dy2 = tVal2 * 32;
    text(hexes[(seed1 + 3) % 8], px - 26, py - dy2);
    pop();

    pop();
  }
}

function drawDynamicHUD() {
  let left = safeMargin;
  let top = safeMargin;
  let right = width - safeMargin;
  let bottom = height - safeMargin;

  let col;
  let isLocked = false;

  if (finished) {
    let elapsed = millis() - scanStartTime;
    if (elapsed < 2500) {
      // Active scanning sweep: brackets pulse rapidly in warning orange-amber!
      col = lerpColor(color(255, 110, 0, 220), color(255, 110, 0, 70), 0.5 + 0.5 * sin(millis() * 0.025));
    } else {
      // Completed & Locked: solid bright neon cyan!
      col = color(0, 255, 200, 230);
      isLocked = true;
    }
  } else {
    if (strokes.length > 0) {
      // Drawing active: breathe gently in cyan
      col = color(0, 180, 255, 130 + 70 * sin(millis() * 0.007));
    } else {
      // Standby: faint slow cyber-blue
      col = color(0, 180, 255, 65 + 25 * sin(millis() * 0.003));
    }
  }

  // A. Draw L-brackets with dual offset glow layers!
  push();
  stroke(col);
  strokeWeight(isLocked ? 3.0 : 1.8);
  noFill();
  const len = 35;

  // Top-Left L
  line(left, top, left + len, top);
  line(left, top, left, top + len);

  // Top-Right L
  line(right, top, right - len, top);
  line(right, top, right, top + len);

  // Bottom-Left L
  line(left, bottom, left + len, bottom);
  line(left, bottom, left, bottom - len);

  // Bottom-Right L
  line(right, bottom, right - len, bottom);
  line(right, bottom, right, bottom - len);

  // Inner offset line for technical HUD depth!
  let offset = 4;
  let lenInner = 20;
  stroke(red(col), green(col), blue(col), alpha(col) * 0.6);
  strokeWeight(1.0);

  line(left + offset, top + offset, left + offset + lenInner, top + offset);
  line(left + offset, top + offset, left + offset, top + offset + lenInner);

  line(right - offset, top + offset, right - offset - lenInner, top + offset);
  line(right - offset, top + offset, right - offset, top + offset + lenInner);

  line(left + offset, bottom - offset, left + offset + lenInner, bottom - offset);
  line(left + offset, bottom - offset, left + offset, bottom - offset - lenInner);

  line(right - offset, bottom - offset, right - offset - lenInner, bottom - offset);
  line(right - offset, bottom - offset, right - offset, bottom - offset - lenInner);

  // B. Secondary orange diagonal ticks if locked!
  if (isLocked) {
    stroke(255, 110, 0, 200 + 55 * sin(millis() * 0.01));
    strokeWeight(2.0);
    line(left + 1, top + 1, left + 7, top + 7);
    line(right - 1, top + 1, right - 7, top + 7);
    line(left + 1, bottom - 1, left + 7, bottom - 7);
    line(right - 1, bottom - 1, right - 7, bottom - 7);

    // C. Center Faint Background Holographic Watermark
    noStroke();
    fill(0, 255, 200, 16);
    textFont('Space Mono', 'monospace');
    textSize(11);
    textAlign(CENTER, CENTER);
    text('>> BIOMETRIC VERIFICATION SECURED <<', width / 2, height / 2 - 20);
    text('LOCK STATUS: ACTIVE // PACKETS PROTOCOL SHIELD ON', width / 2, height / 2 + 0);

    // Subtle target reticle in center background
    stroke(0, 255, 200, 12);
    strokeWeight(1);
    ellipse(width / 2, height / 2 - 10, 200, 200);
    ellipse(width / 2, height / 2 - 10, 100, 100);
    line(width / 2 - 120, height / 2 - 10, width / 2 + 120, height / 2 - 10);
    line(width / 2, height / 2 - 130, width / 2, height / 2 + 110);
  }

  // D. Dynamic horizontal oscilloscope wave analyzer along the bottom margin boundary (Always active in any state!)
  let waveY = bottom - 16;
  let waveCol = isLocked ? color(0, 255, 200, 40) : color(red(col), green(col), blue(col), 35 + 15 * sin(millis() * 0.002));
  stroke(waveCol);
  strokeWeight(1.0);
  noFill();
  beginShape();
  for (let wx = left + 25; wx < right - 25; wx += 10) {
    let angle = (wx * 0.015) + (millis() * 0.005);
    // Create an undulating modulated wave!
    let dy = sin(angle) * 7 * cos(wx * 0.002 + millis() * 0.001);

    // If scanning is active, make the wave excited and hyperactive!
    if (finished && !isLocked) {
      dy = sin(angle * 2.5) * 14 * cos(wx * 0.003);
    }

    vertex(wx, waveY + dy);
  }
  endShape();

  pop();
}

function drawSignatureGuide() {
  // Only draw if there are no completed strokes AND no active stroke currently drawing!
  if (strokes.length === 0 && !currentStroke) {
    push();
    let breathe = 0.6 + 0.4 * sin(millis() * 0.0035);

    // 1. Center of signature area
    let cx = width / 2;
    let cy = height / 2;

    // 2. High-tech dotted bounding framework close to the actual safe-zone (80px safeMargin) but slightly smaller (inset by 40px)
    let marginOffset = safeMargin + 40; // 120px margin
    let boxLeft = marginOffset;
    let boxRight = width - marginOffset;
    let boxTop = marginOffset;
    let boxBottom = height - marginOffset;
    let w = boxRight - boxLeft;
    let h = boxBottom - boxTop;

    stroke(0, 180, 255, 60 * breathe);
    strokeWeight(1.2);
    noFill();
    drawingContext.setLineDash([8, 8]);
    rect(boxLeft, boxTop, w, h, 14);
    drawingContext.setLineDash([]); // clear dash

    // Draw thick corner brackets on the guide box bounds
    stroke(0, 255, 200, 120 * breathe);
    strokeWeight(2.5);
    const blen = 28;
    // Top-left corner
    line(boxLeft, boxTop, boxLeft + blen, boxTop);
    line(boxLeft, boxTop, boxLeft, boxTop + blen);
    // Top-right corner
    line(boxRight, boxTop, boxRight - blen, boxTop);
    line(boxRight, boxTop, boxRight, boxTop + blen);
    // Bottom-left corner
    line(boxLeft, boxBottom, boxLeft + blen, boxBottom);
    line(boxLeft, boxBottom, boxLeft, boxBottom - blen);
    // Bottom-right corner
    line(boxRight, boxBottom, boxRight - blen, boxBottom);
    line(boxRight, boxBottom, boxRight, boxBottom - blen);

    // 3. Giant cyber-orange targeting reticle behind text
    stroke(255, 110, 0, 35 * breathe);
    strokeWeight(1.0);
    ellipse(cx, cy - 2, 240, 240);
    line(cx - 150, cy - 2, cx + 150, cy - 2);
    line(cx, cy - 152, cx, cy + 148);

    // 4. Colossal extremely large main instruction notice text in 2 stacked lines (80px BOLD!)
    noStroke();
    fill(0, 255, 200, 250 * breathe);
    textFont('Space Mono', 'monospace');
    textStyle(BOLD);
    textSize(80);
    textAlign(CENTER, CENTER);
    text('TANDA TANGAN', cx, cy - 65);
    text('DI AREA INI', cx, cy + 5);

    // 5. Massive sub-instruction text (24px BOLD!)
    fill(0, 180, 255, 160 * breathe);
    textSize(24);
    text('DRAG MOUSE ATAU SENTUH LAYAR UNTUK MEMULAI', cx, cy + 75);
    pop();
  }
}

function drawSignerIdentity() {
  if (selectedGuestName && selectedGuestName.length > 0) {
    push();
    textFont('Space Mono', 'monospace');
    textAlign(CENTER, CENTER);
    textSize(14);
    textStyle(BOLD);

    let cx = width / 2;
    let cy = btnTopMargin + btnHeight / 2; // vertically centered with buttons

    // Measure text width to frame it dynamically
    let displayName = `AUTHORIZED SIGNER: ${selectedGuestName.toUpperCase()}`;
    let tw = textWidth(displayName) + 40;
    let th = 32;

    // Draw subtle glass backdrop
    fill(12, 17, 23, 200);
    stroke(0, 255, 200, 60);
    strokeWeight(1);
    rect(cx - tw / 2, cy - th / 2, tw, th, 4);

    // Draw micro corner brackets
    stroke(0, 255, 200, 150);
    strokeWeight(1.5);
    let bl = 6;
    // top-left
    line(cx - tw / 2, cy - th / 2, cx - tw / 2 + bl, cy - th / 2);
    line(cx - tw / 2, cy - th / 2, cx - tw / 2, cy - th / 2 + bl);
    // top-right
    line(cx + tw / 2, cy - th / 2, cx + tw / 2 - bl, cy - th / 2);
    line(cx + tw / 2, cy - th / 2, cx + tw / 2, cy - th / 2 + bl);
    // bottom-left
    line(cx - tw / 2, cy + th / 2, cx - tw / 2 + bl, cy + th / 2);
    line(cx - tw / 2, cy + th / 2, cx - tw / 2, cy + th / 2 - bl);
    // bottom-right
    line(cx + tw / 2, cy + th / 2, cx + tw / 2 - bl, cy + th / 2);
    line(cx + tw / 2, cy + th / 2, cx + tw / 2, cy + th / 2 - bl);

    // Draw text with glowing neon green color
    noStroke();
    fill(0, 255, 200, 220);
    text(displayName, cx, cy - 1);
    pop();
  }
}
