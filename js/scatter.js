/**
 * scatter.js - SVG散布図レンダラー
 * 4象限、45度線、1次回帰線、スマートラベル・引き出し線、ドラッグ操作、SVG/PNG書き出し
 */

class ScatterPlot {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`要素 #${containerId} が見つかりません。`);
    }

    this.options = {
      width: 900,
      height: 650,
      margin: { top: 50, right: 60, bottom: 65, left: 75 },
      theme: 'modernNavy',
      pointRadius: 6,
      pointOpacity: 0.75,
      showQuadrant: true,
      quadrantSplitType: 'mean', // 'mean' or 'median'
      showQuadrantBg: true,
      quadrantLabels: {
        q1: '第1象限 (高X・高Y)',
        q2: '第2象限 (低X・高Y)',
        q3: '第3象限 (低X・低Y)',
        q4: '第4象限 (高X・低Y)'
      },
      showLine45: false,
      lockAspect1to1: false,
      showRegression: true,
      showConfidenceInterval: true,
      labelMode: 'all', // 'all', 'outliers', 'top5', 'none'
      showLeaderLines: true,
      fontSize: 11,
      title: '',
      xTitle: '',
      yTitle: '',
      ...options
    };

    this.data = null; // { rows, xKey, yKey, labelKey }
    this.layoutEngine = new LabelLayoutEngine();
    this.isDragging = false;
    this.draggedLabelId = null;
    this.dragStart = { x: 0, y: 0 };
    this.svg = null;

    // テーマ定義
    this.themes = {
      modernNavy: {
        bg: '#ffffff',
        plotBg: '#f8fafc',
        grid: '#e2e8f0',
        axis: '#475569',
        text: '#1e293b',
        pointFill: '#2563eb',
        pointStroke: '#ffffff',
        regLine: '#dc2626',
        regBand: 'rgba(220, 38, 38, 0.12)',
        line45: '#059669',
        quadrantLine: '#94a3b8',
        quadrantBg: ['#eff6ff', '#f0fdf4', '#f8fafc', '#fff7ed'], // Q1, Q2, Q3, Q4
        leaderLine: '#64748b',
        labelBg: 'rgba(255, 255, 255, 0.92)',
        labelBorder: '#cbd5e1',
        labelText: '#0f172a'
      },
      emerald: {
        bg: '#ffffff',
        plotBg: '#f0fdfa',
        grid: '#ccfbf1',
        axis: '#115e59',
        text: '#134e4a',
        pointFill: '#0d9488',
        pointStroke: '#ffffff',
        regLine: '#e11d48',
        regBand: 'rgba(225, 29, 72, 0.12)',
        line45: '#2563eb',
        quadrantLine: '#5eead4',
        quadrantBg: ['#ecfdf5', '#f0fdf4', '#f0fdfa', '#fefce8'],
        leaderLine: '#14b8a6',
        labelBg: 'rgba(255, 255, 255, 0.92)',
        labelBorder: '#99f6e4',
        labelText: '#042f2e'
      },
      vibrant: {
        bg: '#ffffff',
        plotBg: '#faf5ff',
        grid: '#f3e8ff',
        axis: '#6b21a8',
        text: '#3b0764',
        pointFill: '#9333ea',
        pointStroke: '#ffffff',
        regLine: '#ea580c',
        regBand: 'rgba(234, 88, 12, 0.12)',
        line45: '#0284c7',
        quadrantLine: '#d8b4fe',
        quadrantBg: ['#faf5ff', '#eff6ff', '#fdf2f8', '#fffbeb'],
        leaderLine: '#a855f7',
        labelBg: 'rgba(255, 255, 255, 0.92)',
        labelBorder: '#e9d5ff',
        labelText: '#2e1065'
      },
      academic: {
        bg: '#ffffff',
        plotBg: '#ffffff',
        grid: '#e5e5e5',
        axis: '#171717',
        text: '#171717',
        pointFill: '#404040',
        pointStroke: '#ffffff',
        regLine: '#000000',
        regBand: 'rgba(0, 0, 0, 0.08)',
        line45: '#737373',
        quadrantLine: '#a3a3a3',
        quadrantBg: ['#fafafa', '#f5f5f5', '#fafafa', '#f5f5f5'],
        leaderLine: '#525252',
        labelBg: 'rgba(255, 255, 255, 0.95)',
        labelBorder: '#a3a3a3',
        labelText: '#171717'
      }
    };

    this.initEvents();
  }

  getTheme() {
    return this.themes[this.options.theme] || this.themes.modernNavy;
  }

  // イベント初期化 (ドラッグ＆ドロップ)
  initEvents() {
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', () => this.onMouseUp());
  }

  onMouseDownLabel(e, labelId) {
    e.stopPropagation();
    this.isDragging = true;
    this.draggedLabelId = labelId;
    this.dragStart = { x: e.clientX, y: e.clientY };
  }

  onMouseMove(e) {
    if (!this.isDragging || !this.draggedLabelId || !this.svg) return;
    const dx = e.clientX - this.dragStart.x;
    const dy = e.clientY - this.dragStart.y;
    this.dragStart = { x: e.clientX, y: e.clientY };

    const label = this.layoutEngine.labels.find(l => l.id === this.draggedLabelId);
    if (label) {
      this.layoutEngine.updateLabelPosition(label.id, label.lx + dx, label.ly + dy);
      this.updateSingleLabelDOM(label);
    }
  }

  onMouseUp() {
    if (this.isDragging) {
      this.isDragging = false;
      this.draggedLabelId = null;
    }
  }

  // 単一ラベルのDOM位置更新 (スムーズなドラッグ用)
  updateSingleLabelDOM(label) {
    const labelGroup = this.svg.querySelector(`[data-label-id="${label.id}"]`);
    if (labelGroup) {
      labelGroup.setAttribute('transform', `translate(${label.lx}, ${label.ly})`);
    }

    const leader = this.layoutEngine.getLeaderLine(label);
    const lineEl = this.svg.querySelector(`[data-leader-id="${label.id}"]`);
    if (lineEl) {
      if (leader && this.options.showLeaderLines) {
        lineEl.setAttribute('x1', leader.x1);
        lineEl.setAttribute('y1', leader.y1);
        lineEl.setAttribute('x2', leader.x2);
        lineEl.setAttribute('y2', leader.y2);
        lineEl.style.display = 'block';
      } else {
        lineEl.style.display = 'none';
      }
    }
  }

  // Nice Numbers アルゴリズム (見やすい目盛間隔の計算)
  calcNiceScale(min, max, targetTicks = 6) {
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const range = max - min;
    const rawStep = range / targetTicks;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const magFraction = rawStep / mag;

    let niceFraction;
    if (magFraction < 1.5) niceFraction = 1;
    else if (magFraction < 3) niceFraction = 2;
    else if (magFraction < 7) niceFraction = 5;
    else niceFraction = 10;

    const step = niceFraction * mag;
    const niceMin = Math.floor(min / step) * step;
    const niceMax = Math.ceil(max / step) * step;

    const ticks = [];
    for (let v = niceMin; v <= niceMax + step * 0.5; v += step) {
      // 浮動小数点誤差の対策
      ticks.push(Number(v.toFixed(6)));
    }

    return { min: niceMin, max: niceMax, step, ticks };
  }

  // 描画実行
  render(data, options = {}) {
    if (options) {
      this.options = { ...this.options, ...options };
    }
    this.data = data;
    this.container.innerHTML = '';

    const { rows, xKey, yKey, labelKey } = data;
    if (!rows || rows.length === 0 || !xKey || !yKey) {
      this.container.innerHTML = '<div class="empty-state">データが選択されていません。</div>';
      return;
    }

    // 有効なデータポイントを抽出
    const validRows = [];
    const xValues = [];
    const yValues = [];

    rows.forEach((r, idx) => {
      const x = r[xKey];
      const y = r[yKey];
      if (typeof x === 'number' && !isNaN(x) && typeof y === 'number' && !isNaN(y)) {
        validRows.push({ ...r, _id: r._rowId || idx + 1, _x: x, _y: y, _name: r[labelKey] || `No.${idx + 1}` });
        xValues.push(x);
        yValues.push(y);
      }
    });

    if (validRows.length === 0) {
      this.container.innerHTML = '<div class="empty-state">選択された列に有効な数値データがありません。</div>';
      return;
    }

    // 統計計算
    const meanX = Stats.mean(xValues);
    const meanY = Stats.mean(yValues);
    const medianX = Stats.median(xValues);
    const medianY = Stats.median(yValues);
    const stdX = Stats.stdDev(xValues, meanX);
    const stdY = Stats.stdDev(yValues, meanY);
    const regression = Stats.linearRegression(xValues, yValues);

    const splitX = this.options.quadrantSplitType === 'median' ? medianX : meanX;
    const splitY = this.options.quadrantSplitType === 'median' ? medianY : meanY;

    // 外れ値判定 (Zスコア > 2.0 または距離)
    validRows.forEach(r => {
      const zX = stdX > 0 ? Math.abs(r._x - meanX) / stdX : 0;
      const zY = stdY > 0 ? Math.abs(r._y - meanY) / stdY : 0;
      r._isOutlier = Math.hypot(zX, zY) >= 2.0;
    });

    // ランク付け (上位判定)
    const sortedX = [...validRows].sort((a, b) => b._x - a._x);
    sortedX.forEach((r, rank) => { r._rankX = rank + 1; });
    const sortedY = [...validRows].sort((a, b) => b._y - a._y);
    sortedY.forEach((r, rank) => { r._rankY = rank + 1; });

    // スケール計算 (マージンとプロットエリア)
    const { width, height, margin } = this.options;
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;

    let xMin = Math.min(...xValues);
    let xMax = Math.max(...xValues);
    let yMin = Math.min(...yValues);
    let yMax = Math.max(...yValues);

    // 45度線・1:1比率の場合はスケール範囲を統合
    if (this.options.lockAspect1to1 || this.options.showLine45) {
      const globalMin = Math.min(xMin, yMin);
      const globalMax = Math.max(xMax, yMax);
      if (this.options.lockAspect1to1) {
        xMin = globalMin;
        xMax = globalMax;
        yMin = globalMin;
        yMax = globalMax;
      }
    }

    // 余白率 (5%〜10%のパディング)
    const padX = (xMax - xMin) * 0.08 || 1;
    const padY = (yMax - yMin) * 0.08 || 1;
    const scaleX = this.calcNiceScale(xMin - padX, xMax + padX, 7);
    const scaleY = this.calcNiceScale(yMin - padY, yMax + padY, 7);

    // 座標変換関数
    const toPx = (val) => margin.left + ((val - scaleX.min) / (scaleX.max - scaleX.min)) * plotW;
    const toPy = (val) => margin.top + plotH - ((val - scaleY.min) / (scaleY.max - scaleY.min)) * plotH;

    // SVG構築
    const theme = this.getTheme();
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("xmlns", svgNS);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.style.fontFamily = "system-ui, -apple-system, sans-serif";
    svg.style.userSelect = "none";
    this.svg = svg;

    // 背景
    const bgRect = document.createElementNS(svgNS, "rect");
    bgRect.setAttribute("width", width);
    bgRect.setAttribute("height", height);
    bgRect.setAttribute("fill", theme.bg);
    svg.appendChild(bgRect);

    // プロットエリア背景
    const plotBg = document.createElementNS(svgNS, "rect");
    plotBg.setAttribute("x", margin.left);
    plotBg.setAttribute("y", margin.top);
    plotBg.setAttribute("width", plotW);
    plotBg.setAttribute("height", plotH);
    plotBg.setAttribute("fill", theme.plotBg);
    svg.appendChild(plotBg);

    // 1. 4象限背景ハイライト
    if (this.options.showQuadrant && this.options.showQuadrantBg) {
      const qSplitPx = toPx(splitX);
      const qSplitPy = toPy(splitY);

      // 有効エリア内に収まるようにクリップ
      const boundedSplitX = Math.max(margin.left, Math.min(margin.left + plotW, qSplitPx));
      const boundedSplitY = Math.max(margin.top, Math.min(margin.top + plotH, qSplitPy));

      const quadrants = [
        // Q1 (右上)
        { x: boundedSplitX, y: margin.top, w: margin.left + plotW - boundedSplitX, h: boundedSplitY - margin.top, fill: theme.quadrantBg[0] },
        // Q2 (左上)
        { x: margin.left, y: margin.top, w: boundedSplitX - margin.left, h: boundedSplitY - margin.top, fill: theme.quadrantBg[1] },
        // Q3 (左下)
        { x: margin.left, y: boundedSplitY, w: boundedSplitX - margin.left, h: margin.top + plotH - boundedSplitY, fill: theme.quadrantBg[2] },
        // Q4 (右下)
        { x: boundedSplitX, y: boundedSplitY, w: margin.left + plotW - boundedSplitX, h: margin.top + plotH - boundedSplitY, fill: theme.quadrantBg[3] }
      ];

      quadrants.forEach(q => {
        if (q.w > 0 && q.h > 0) {
          const r = document.createElementNS(svgNS, "rect");
          r.setAttribute("x", q.x);
          r.setAttribute("y", q.y);
          r.setAttribute("width", q.w);
          r.setAttribute("height", q.h);
          r.setAttribute("fill", q.fill);
          r.setAttribute("opacity", "0.65");
          svg.appendChild(r);
        }
      });
    }

    // 2. グリッド線
    scaleX.ticks.forEach(tick => {
      const x = toPx(tick);
      if (x >= margin.left && x <= margin.left + plotW) {
        const line = document.createElementNS(svgNS, "line");
        line.setAttribute("x1", x);
        line.setAttribute("y1", margin.top);
        line.setAttribute("x2", x);
        line.setAttribute("y2", margin.top + plotH);
        line.setAttribute("stroke", theme.grid);
        line.setAttribute("stroke-width", "1");
        svg.appendChild(line);
      }
    });

    scaleY.ticks.forEach(tick => {
      const y = toPy(tick);
      if (y >= margin.top && y <= margin.top + plotH) {
        const line = document.createElementNS(svgNS, "line");
        line.setAttribute("x1", margin.left);
        line.setAttribute("y1", y);
        line.setAttribute("x2", margin.left + plotW);
        line.setAttribute("y2", y);
        line.setAttribute("stroke", theme.grid);
        line.setAttribute("stroke-width", "1");
        svg.appendChild(line);
      }
    });

    // 3. 45度線 (y = x)
    if (this.options.showLine45) {
      const minVal = Math.max(scaleX.min, scaleY.min);
      const maxVal = Math.min(scaleX.max, scaleY.max);
      const line45 = document.createElementNS(svgNS, "line");
      line45.setAttribute("x1", toPx(minVal));
      line45.setAttribute("y1", toPy(minVal));
      line45.setAttribute("x2", toPx(maxVal));
      line45.setAttribute("y2", toPy(maxVal));
      line45.setAttribute("stroke", theme.line45);
      line45.setAttribute("stroke-width", "1.8");
      line45.setAttribute("stroke-dasharray", "6,4");
      svg.appendChild(line45);

      // 45度線ラベル
      const label45 = document.createElementNS(svgNS, "text");
      label45.setAttribute("x", toPx(maxVal) - 10);
      label45.setAttribute("y", toPy(maxVal) + 18);
      label45.setAttribute("fill", theme.line45);
      label45.setAttribute("font-size", "11");
      label45.setAttribute("font-weight", "600");
      label45.setAttribute("text-anchor", "end");
      label45.textContent = "45°線 (y = x)";
      svg.appendChild(label45);
    }

    // 4. 1次回帰直線と信頼区間
    if (this.options.showRegression && regression.valid) {
      // 95%信頼区間バンドの描画
      if (this.options.showConfidenceInterval && regression.n > 2) {
        const bandSteps = 40;
        const upperPts = [];
        const lowerPts = [];

        for (let i = 0; i <= bandSteps; i++) {
          const xVal = scaleX.min + (i / bandSteps) * (scaleX.max - scaleX.min);
          const ci = Stats.getConfidenceInterval(xVal, regression);
          if (ci) {
            upperPts.push(`${toPx(xVal)},${toPy(ci.upper)}`);
            lowerPts.unshift(`${toPx(xVal)},${toPy(ci.lower)}`);
          }
        }

        if (upperPts.length > 0) {
          const poly = document.createElementNS(svgNS, "polygon");
          poly.setAttribute("points", `${upperPts.join(' ')} ${lowerPts.join(' ')}`);
          poly.setAttribute("fill", theme.regBand);
          svg.appendChild(poly);
        }
      }

      // 回帰直線
      const yAtMin = regression.slope * scaleX.min + regression.intercept;
      const yAtMax = regression.slope * scaleX.max + regression.intercept;

      const regLine = document.createElementNS(svgNS, "line");
      regLine.setAttribute("x1", toPx(scaleX.min));
      regLine.setAttribute("y1", toPy(yAtMin));
      regLine.setAttribute("x2", toPx(scaleX.max));
      regLine.setAttribute("y2", toPy(yAtMax));
      regLine.setAttribute("stroke", theme.regLine);
      regLine.setAttribute("stroke-width", "2");
      svg.appendChild(regLine);

      // 回帰統計ボックス (右下または左上の空きスペースに表示)
      const statBox = document.createElementNS(svgNS, "g");
      const boxW = 195;
      const boxH = 48;
      const boxX = margin.left + plotW - boxW - 12;
      const boxY = margin.top + 12;

      const boxBg = document.createElementNS(svgNS, "rect");
      boxBg.setAttribute("x", boxX);
      boxBg.setAttribute("y", boxY);
      boxBg.setAttribute("width", boxW);
      boxBg.setAttribute("height", boxH);
      boxBg.setAttribute("rx", "6");
      boxBg.setAttribute("fill", "rgba(255, 255, 255, 0.92)");
      boxBg.setAttribute("stroke", theme.regLine);
      boxBg.setAttribute("stroke-width", "1");
      statBox.appendChild(boxBg);

      const sign = regression.intercept >= 0 ? '+' : '-';
      const absIntercept = Math.abs(regression.intercept).toFixed(2);
      const eqText = `y = ${regression.slope.toFixed(2)}x ${sign} ${absIntercept}`;
      const statText = `R² = ${regression.r2.toFixed(3)}  (r = ${regression.r.toFixed(3)})`;

      const t1 = document.createElementNS(svgNS, "text");
      t1.setAttribute("x", boxX + 10);
      t1.setAttribute("y", boxY + 20);
      t1.setAttribute("fill", theme.regLine);
      t1.setAttribute("font-size", "11");
      t1.setAttribute("font-weight", "bold");
      t1.textContent = eqText;
      statBox.appendChild(t1);

      const t2 = document.createElementNS(svgNS, "text");
      t2.setAttribute("x", boxX + 10);
      t2.setAttribute("y", boxY + 38);
      t2.setAttribute("fill", theme.text);
      t2.setAttribute("font-size", "11");
      t2.textContent = statText;
      statBox.appendChild(t2);

      svg.appendChild(statBox);
    }

    // 5. 4象限十字線 & 象限ラベル
    if (this.options.showQuadrant) {
      const qPx = toPx(splitX);
      const qPy = toPy(splitY);

      // X分割線
      if (qPx >= margin.left && qPx <= margin.left + plotW) {
        const vLine = document.createElementNS(svgNS, "line");
        vLine.setAttribute("x1", qPx);
        vLine.setAttribute("y1", margin.top);
        vLine.setAttribute("x2", qPx);
        vLine.setAttribute("y2", margin.top + plotH);
        vLine.setAttribute("stroke", theme.quadrantLine);
        vLine.setAttribute("stroke-width", "1.5");
        vLine.setAttribute("stroke-dasharray", "4,3");
        svg.appendChild(vLine);

        // 基準値表示
        const splitLabelX = document.createElementNS(svgNS, "text");
        splitLabelX.setAttribute("x", qPx + 4);
        splitLabelX.setAttribute("y", margin.top + 14);
        splitLabelX.setAttribute("fill", theme.axis);
        splitLabelX.setAttribute("font-size", "10");
        splitLabelX.setAttribute("font-weight", "600");
        splitLabelX.textContent = `${this.options.quadrantSplitType === 'median' ? '中央値' : '平均'}X: ${splitX.toFixed(1)}`;
        svg.appendChild(splitLabelX);
      }

      // Y分割線
      if (qPy >= margin.top && qPy <= margin.top + plotH) {
        const hLine = document.createElementNS(svgNS, "line");
        hLine.setAttribute("x1", margin.left);
        hLine.setAttribute("y1", qPy);
        hLine.setAttribute("x2", margin.left + plotW);
        hLine.setAttribute("y2", qPy);
        hLine.setAttribute("stroke", theme.quadrantLine);
        hLine.setAttribute("stroke-width", "1.5");
        hLine.setAttribute("stroke-dasharray", "4,3");
        svg.appendChild(hLine);

        // 基準値表示
        const splitLabelY = document.createElementNS(svgNS, "text");
        splitLabelY.setAttribute("x", margin.left + plotW - 6);
        splitLabelY.setAttribute("y", qPy - 4);
        splitLabelY.setAttribute("text-anchor", "end");
        splitLabelY.setAttribute("fill", theme.axis);
        splitLabelY.setAttribute("font-size", "10");
        splitLabelY.setAttribute("font-weight", "600");
        splitLabelY.textContent = `${this.options.quadrantSplitType === 'median' ? '中央値' : '平均'}Y: ${splitY.toFixed(1)}`;
        svg.appendChild(splitLabelY);
      }

      // 4象限の名称ラベル
      const qLabels = this.options.quadrantLabels;
      const cornerOffsets = [
        { label: qLabels.q1, x: margin.left + plotW - 12, y: margin.top + 20, anchor: 'end' },
        { label: qLabels.q2, x: margin.left + 12, y: margin.top + 20, anchor: 'start' },
        { label: qLabels.q3, x: margin.left + 12, y: margin.top + plotH - 12, anchor: 'start' },
        { label: qLabels.q4, x: margin.left + plotW - 12, y: margin.top + plotH - 12, anchor: 'end' }
      ];

      cornerOffsets.forEach(co => {
        if (co.label) {
          const t = document.createElementNS(svgNS, "text");
          t.setAttribute("x", co.x);
          t.setAttribute("y", co.y);
          t.setAttribute("text-anchor", co.anchor);
          t.setAttribute("fill", theme.axis);
          t.setAttribute("font-size", "11");
          t.setAttribute("font-weight", "bold");
          t.setAttribute("opacity", "0.75");
          t.textContent = co.label;
          svg.appendChild(t);
        }
      });
    }

    // 6. プロット点の描画データ準備
    const points = validRows.map(r => ({
      id: r._id,
      name: r._name,
      x: r._x,
      y: r._y,
      px: toPx(r._x),
      py: toPy(r._y),
      isOutlier: r._isOutlier,
      rankX: r._rankX,
      rankY: r._rankY
    }));

    // ラベルレイアウト計算
    const labels = this.layoutEngine.initLabels(points, {
      mode: this.options.labelMode,
      fontSize: this.options.fontSize,
      bounds: {
        minX: margin.left + 10,
        maxX: margin.left + plotW - 10,
        minY: margin.top + 10,
        maxY: margin.top + plotH - 10
      }
    });

    // 7. 引き出し線の描画グループ
    const leaderLinesGroup = document.createElementNS(svgNS, "g");
    leaderLinesGroup.setAttribute("class", "leader-lines");
    labels.forEach(label => {
      const leader = this.layoutEngine.getLeaderLine(label);
      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("data-leader-id", label.id);
      line.setAttribute("stroke", theme.leaderLine);
      line.setAttribute("stroke-width", "1");
      line.setAttribute("stroke-dasharray", "2,2");
      if (leader && this.options.showLeaderLines && label.visible) {
        line.setAttribute("x1", leader.x1);
        line.setAttribute("y1", leader.y1);
        line.setAttribute("x2", leader.x2);
        line.setAttribute("y2", leader.y2);
      } else {
        line.style.display = 'none';
      }
      leaderLinesGroup.appendChild(line);
    });
    svg.appendChild(leaderLinesGroup);

    // 8. プロット点の描画グループ
    const pointsGroup = document.createElementNS(svgNS, "g");
    pointsGroup.setAttribute("class", "plot-points");

    points.forEach(p => {
      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("cx", p.px);
      circle.setAttribute("cy", p.py);
      circle.setAttribute("r", this.options.pointRadius);
      circle.setAttribute("fill", theme.pointFill);
      circle.setAttribute("stroke", theme.pointStroke);
      circle.setAttribute("stroke-width", "1.5");
      circle.setAttribute("fill-opacity", this.options.pointOpacity);
      circle.style.cursor = "pointer";
      circle.style.transition = "transform 0.15s ease, r 0.15s ease";

      // ツールチップ用タイトル要素
      const titleEl = document.createElementNS(svgNS, "title");
      titleEl.textContent = `${p.name}\n${xKey}: ${p.x.toLocaleString()}\n${yKey}: ${p.y.toLocaleString()}`;
      circle.appendChild(titleEl);

      // ホバーハイライト
      circle.addEventListener('mouseenter', () => {
        circle.setAttribute("r", this.options.pointRadius + 3);
        circle.setAttribute("fill-opacity", "1");
        circle.setAttribute("stroke-width", "2.5");
      });
      circle.addEventListener('mouseleave', () => {
        circle.setAttribute("r", this.options.pointRadius);
        circle.setAttribute("fill-opacity", this.options.pointOpacity);
        circle.setAttribute("stroke-width", "1.5");
      });

      pointsGroup.appendChild(circle);
    });
    svg.appendChild(pointsGroup);

    // 9. ラベルの描画グループ (最前面・ドラッグ可能)
    const labelsGroup = document.createElementNS(svgNS, "g");
    labelsGroup.setAttribute("class", "plot-labels");

    labels.forEach(label => {
      if (!label.visible) return;

      const g = document.createElementNS(svgNS, "g");
      g.setAttribute("data-label-id", label.id);
      g.setAttribute("transform", `translate(${label.lx}, ${label.ly})`);
      g.style.cursor = "move";

      // ラベル背景のピル
      const rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", -label.width / 2);
      rect.setAttribute("y", -label.height / 2);
      rect.setAttribute("width", label.width);
      rect.setAttribute("height", label.height);
      rect.setAttribute("rx", "4");
      rect.setAttribute("fill", theme.labelBg);
      rect.setAttribute("stroke", label.userMoved ? theme.regLine : theme.labelBorder);
      rect.setAttribute("stroke-width", label.userMoved ? "1.5" : "1");
      g.appendChild(rect);

      // テキスト
      const txt = document.createElementNS(svgNS, "text");
      txt.setAttribute("text-anchor", "middle");
      txt.setAttribute("dominant-baseline", "central");
      txt.setAttribute("fill", theme.labelText);
      txt.setAttribute("font-size", this.options.fontSize);
      txt.setAttribute("font-weight", label.userMoved ? "bold" : "normal");
      txt.textContent = label.name;
      g.appendChild(txt);

      // ドラッグイベント登録
      g.addEventListener('mousedown', (e) => this.onMouseDownLabel(e, label.id));

      labelsGroup.appendChild(g);
    });
    svg.appendChild(labelsGroup);

    // 10. 軸線・目盛値・軸タイトル
    // X軸
    const xAxisLine = document.createElementNS(svgNS, "line");
    xAxisLine.setAttribute("x1", margin.left);
    xAxisLine.setAttribute("y1", margin.top + plotH);
    xAxisLine.setAttribute("x2", margin.left + plotW);
    xAxisLine.setAttribute("y2", margin.top + plotH);
    xAxisLine.setAttribute("stroke", theme.axis);
    xAxisLine.setAttribute("stroke-width", "1.5");
    svg.appendChild(xAxisLine);

    scaleX.ticks.forEach(tick => {
      const x = toPx(tick);
      if (x >= margin.left && x <= margin.left + plotW) {
        const tickLine = document.createElementNS(svgNS, "line");
        tickLine.setAttribute("x1", x);
        tickLine.setAttribute("y1", margin.top + plotH);
        tickLine.setAttribute("x2", x);
        tickLine.setAttribute("y2", margin.top + plotH + 5);
        tickLine.setAttribute("stroke", theme.axis);
        svg.appendChild(tickLine);

        const tickText = document.createElementNS(svgNS, "text");
        tickText.setAttribute("x", x);
        tickText.setAttribute("y", margin.top + plotH + 18);
        tickText.setAttribute("text-anchor", "middle");
        tickText.setAttribute("fill", theme.text);
        tickText.setAttribute("font-size", "11");
        tickText.textContent = tick.toLocaleString();
        svg.appendChild(tickText);
      }
    });

    const xLabel = document.createElementNS(svgNS, "text");
    xLabel.setAttribute("x", margin.left + plotW / 2);
    xLabel.setAttribute("y", height - 15);
    xLabel.setAttribute("text-anchor", "middle");
    xLabel.setAttribute("fill", theme.text);
    xLabel.setAttribute("font-size", "13");
    xLabel.setAttribute("font-weight", "600");
    xLabel.textContent = this.options.xTitle || xKey;
    svg.appendChild(xLabel);

    // Y軸
    const yAxisLine = document.createElementNS(svgNS, "line");
    yAxisLine.setAttribute("x1", margin.left);
    yAxisLine.setAttribute("y1", margin.top);
    yAxisLine.setAttribute("x2", margin.left);
    yAxisLine.setAttribute("y2", margin.top + plotH);
    yAxisLine.setAttribute("stroke", theme.axis);
    yAxisLine.setAttribute("stroke-width", "1.5");
    svg.appendChild(yAxisLine);

    scaleY.ticks.forEach(tick => {
      const y = toPy(tick);
      if (y >= margin.top && y <= margin.top + plotH) {
        const tickLine = document.createElementNS(svgNS, "line");
        tickLine.setAttribute("x1", margin.left - 5);
        tickLine.setAttribute("y1", y);
        tickLine.setAttribute("x2", margin.left);
        tickLine.setAttribute("y2", y);
        tickLine.setAttribute("stroke", theme.axis);
        svg.appendChild(tickLine);

        const tickText = document.createElementNS(svgNS, "text");
        tickText.setAttribute("x", margin.left - 8);
        tickText.setAttribute("y", y + 4);
        tickText.setAttribute("text-anchor", "end");
        tickText.setAttribute("fill", theme.text);
        tickText.setAttribute("font-size", "11");
        tickText.textContent = tick.toLocaleString();
        svg.appendChild(tickText);
      }
    });

    const yLabel = document.createElementNS(svgNS, "text");
    yLabel.setAttribute("transform", `rotate(-90)`);
    yLabel.setAttribute("x", -(margin.top + plotH / 2));
    yLabel.setAttribute("y", 22);
    yLabel.setAttribute("text-anchor", "middle");
    yLabel.setAttribute("fill", theme.text);
    yLabel.setAttribute("font-size", "13");
    yLabel.setAttribute("font-weight", "600");
    yLabel.textContent = this.options.yTitle || yKey;
    svg.appendChild(yLabel);

    // グラフメインタイトル
    if (this.options.title) {
      const mainTitle = document.createElementNS(svgNS, "text");
      mainTitle.setAttribute("x", margin.left);
      mainTitle.setAttribute("y", margin.top - 18);
      mainTitle.setAttribute("fill", theme.text);
      mainTitle.setAttribute("font-size", "16");
      mainTitle.setAttribute("font-weight", "bold");
      mainTitle.textContent = this.options.title;
      svg.appendChild(mainTitle);
    }

    this.container.appendChild(svg);

    // 統計サマリーの戻り値
    const quadClass = Stats.classifyQuadrants(validRows, '_x', '_y', splitX, splitY);
    return {
      totalCount: validRows.length,
      meanX,
      meanY,
      medianX,
      medianY,
      stdX,
      stdY,
      splitX,
      splitY,
      regression,
      quadrants: quadClass
    };
  }

  // SVG文字列の取得
  getSVGString() {
    if (!this.svg) return null;
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(this.svg);
    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    return source;
  }

  // SVGダウンロード
  downloadSVG(fileName = 'scatter_plot.svg') {
    const svgStr = this.getSVGString();
    if (!svgStr) return;
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // PNG画像 (Canvas経由) のダウンロード
  downloadPNG(fileName = 'scatter_plot.png', scale = 2) {
    const svgStr = this.getSVGString();
    if (!svgStr) return;

    const width = this.options.width * scale;
    const height = this.options.height * scale;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);

      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        const pngUrl = URL.createObjectURL(pngBlob);
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(pngUrl);
      }, 'image/png');
    };
    img.src = url;
  }

  // クリップボードへPNG画像をコピー
  async copyPNGToClipboard(scale = 2) {
    const svgStr = this.getSVGString();
    if (!svgStr) throw new Error("グラフが作成されていません。");

    const width = this.options.width * scale;
    const height = this.options.height * scale;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);

        canvas.toBlob(async (pngBlob) => {
          if (!pngBlob) {
            reject(new Error("PNGの生成に失敗しました。"));
            return;
          }
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': pngBlob })
            ]);
            resolve(true);
          } catch (err) {
            reject(err);
          }
        }, 'image/png');
      };
      img.onerror = reject;
      img.src = url;
    });
  }
}

window.ScatterPlot = ScatterPlot;
