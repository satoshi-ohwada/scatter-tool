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
      width: 960,
      height: 640,
      margin: { top: 40, right: 32, bottom: 48, left: 58 },
      theme: 'modernNavy',
      pointRadius: 6,
      pointOpacity: 0.75,
      showQuadrant: true,
      quadrantSplitType: 'mean', // 'mean', 'median', 'geometric', or 'weighted'
      quadrantWeightKey: null,
      showQuadrantBg: true,
      colorPointsByQuadrant: false,
      clusterMode: false,
      clusterK: 3,
      showCentroids: true,
      showClusterHulls: true,
      showClusterLabels: true,
      clusterAspect1to1: true,
      clusterColors: ['#005aff', '#ea580c', '#16a34a', '#9333ea', '#d97706', '#0891b2', '#e11d48', '#4b5563'],
      quadrantLabels: {
        q1: '第1象限 (高X・高Y)',
        q2: '第2象限 (低X・高Y)',
        q3: '第3象限 (低X・低Y)',
        q4: '第4象限 (高X・低Y)'
      },
      showLine45: false,
      lockAspect1to1: false,
      showRegression: true,
      showRegressionEquation: false, // 回帰式・決定係数のグラフ内表示 (デフォルト控えめ/非表示)
      showConfidenceInterval: false,
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
    this.regBadgePos = null; // 回帰式バッジの位置 (null時は右上プロット外定位置)
    this.regBadgeRel = null; // プロット枠に対する相対位置 (全画面/リサイズ時も位置関係を完全維持)
    this.svg = null;

    // テーマ定義
    this.themes = {
      modernNavy: {
        bg: '#ffffff',
        plotBg: '#f8fafc',
        grid: '#e2e8f0',
        axis: '#475569',
        text: '#1e293b',
        pointFill: '#2563eb', // ロイヤルブルー
        pointStroke: '#ffffff',
        regLine: '#dc2626',   // クリムゾンレッド
        regBand: '#dc2626',
        regBandOpacity: '0.12',
        line45: '#059669',    // フォレストグリーン
        quadrantLine: '#94a3b8',
        quadrantBg: ['#bae6fd', '#fef08a', '#e2e8f0', '#fed7aa'], // CUD完全準拠(緑不使用): Q1(青), Q2(黄), Q3(灰), Q4(橙)
        quadrantFg: ['#005aff', '#b45309', '#44403c', '#c2410c'], // CUD・高コントラスト
        quadrantOpacity: '0.68',
        leaderLine: '#64748b',
        labelBg: '#ffffff',
        labelBgOpacity: '0.95',
        labelBorder: '#cbd5e1',
        labelText: '#0f172a',
        // 強調表示スタイル (コーラルオレンジ)
        hlPoint: '#ea580c',
        hlPointStroke: '#ffffff',
        hlLine: '#ea580c',
        hlLabelBg: '#fff7ed',
        hlLabelBorder: '#ea580c',
        hlLabelText: '#c2410c',
        hlShadow: 'drop-shadow(0 1px 2px rgba(234, 88, 12, 0.4))'
      },
      emerald: {
        bg: '#ffffff',
        plotBg: '#f0fdf4', // 淡いミントグリーン
        grid: '#dcfce7',
        axis: '#166534',
        text: '#14532d',
        pointFill: '#059669', // エメラルドグリーン
        pointStroke: '#ffffff',
        regLine: '#0284c7',   // スカイブルー
        regBand: '#0284c7',
        regBandOpacity: '0.12',
        line45: '#d97706',    // アンバー
        quadrantLine: '#86efac',
        // エメラルド専用のフレッシュな淡色4象限
        quadrantBg: ['#a7f3d0', '#fef08a', '#e0f2fe', '#fed7aa'], // Q1(ミント), Q2(レモン), Q3(アイスブルー), Q4(ピーチ)
        quadrantFg: ['#047857', '#a16207', '#0369a1', '#c2410c'],
        quadrantOpacity: '0.65',
        leaderLine: '#059669',
        labelBg: '#ffffff',
        labelBgOpacity: '0.95',
        labelBorder: '#a7f3d0',
        labelText: '#064e3b',
        // 強調表示スタイル (ローズレッド)
        hlPoint: '#e11d48',
        hlPointStroke: '#ffffff',
        hlLine: '#e11d48',
        hlLabelBg: '#fff1f2',
        hlLabelBorder: '#f43f5e',
        hlLabelText: '#be123c',
        hlShadow: 'drop-shadow(0 1px 2px rgba(225, 29, 72, 0.4))'
      },
      vibrant: {
        bg: '#ffffff',
        plotBg: '#faf5ff', // 淡いラベンダー
        grid: '#f3e8ff',
        axis: '#581c87',
        text: '#3b0764',
        pointFill: '#7c3aed', // バイオレット
        pointStroke: '#ffffff',
        regLine: '#f43f5e',   // ビビッドローズ
        regBand: '#f43f5e',
        regBandOpacity: '0.12',
        line45: '#06b6d4',    // シアン
        quadrantLine: '#c084fc',
        // バイブラント専用の華やかなパステル4象限
        quadrantBg: ['#ddd6fe', '#fbcfe8', '#cffafe', '#fef08a'], // Q1(バイオレット), Q2(ピンク), Q3(シアン), Q4(イエロー)
        quadrantFg: ['#6d28d9', '#be185d', '#0e7490', '#a16207'],
        quadrantOpacity: '0.65',
        leaderLine: '#7c3aed',
        labelBg: '#ffffff',
        labelBgOpacity: '0.95',
        labelBorder: '#d8b4fe',
        labelText: '#3b0764',
        // 強調表示スタイル (ブライトオレンジ)
        hlPoint: '#f97316',
        hlPointStroke: '#ffffff',
        hlLine: '#f97316',
        hlLabelBg: '#fff7ed',
        hlLabelBorder: '#ea580c',
        hlLabelText: '#c2410c',
        hlShadow: 'drop-shadow(0 1px 2px rgba(249, 115, 22, 0.4))'
      },
      academic: {
        bg: '#ffffff',
        plotBg: '#ffffff', // 純白
        grid: '#e5e5e5',
        axis: '#171717',   // 濃黒
        text: '#171717',
        pointFill: '#525252', // ニュートラルグレー
        pointStroke: '#ffffff',
        regLine: '#000000',   // 純黒
        regBand: '#000000',
        regBandOpacity: '0.07',
        line45: '#737373',    // 中灰
        quadrantLine: '#737373',
        // 完全モノクロ4象限 (有彩色ゼロ: スレートグレー4階調)
        quadrantBg: ['#e2e8f0', '#f8fafc', '#cbd5e1', '#f1f5f9'], // Q1(薄灰), Q2(最淡灰), Q3(中灰), Q4(淡灰)
        quadrantFg: ['#0f172a', '#334155', '#475569', '#1e293b'], // 無彩色チャコール〜黒
        quadrantPointFg: ['#0f172a', '#475569', '#94a3b8', '#64748b'], // 点の象限色分け時も無彩色4階調
        quadrantOpacity: '0.50',
        leaderLine: '#525252',
        labelBg: '#ffffff',
        labelBgOpacity: '0.95',
        labelBorder: '#737373',
        labelText: '#171717',
        // 強調表示スタイル (有彩色ゼロ: 純黒プロット ＆ 反転黒ベタ白抜きラベル)
        hlPoint: '#000000',
        hlPointStroke: '#ffffff',
        hlLine: '#000000',
        hlLabelBg: '#171717',
        hlLabelBorder: '#000000',
        hlLabelText: '#ffffff',
        hlShadow: 'none'
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
    if (!this.isDragging || this.draggedLabelId === null || this.draggedLabelId === undefined || !this.svg) return;
    const svgRect = this.svg.getBoundingClientRect();
    const scaleFactorX = svgRect.width > 0 ? (this.currentRenderWidth || this.options.width) / svgRect.width : 1;
    const scaleFactorY = svgRect.height > 0 ? (this.currentRenderHeight || this.options.height) / svgRect.height : 1;

    const dx = (e.clientX - this.dragStart.x) * scaleFactorX;
    const dy = (e.clientY - this.dragStart.y) * scaleFactorY;
    this.dragStart = { x: e.clientX, y: e.clientY };

    if (this.draggedLabelId === '__reg_badge__') {
      if (this.regBadgePos) {
        this.regBadgePos.x += dx;
        this.regBadgePos.y += dy;
        const badgeEl = this.svg.querySelector('.regression-stat-badge');
        if (badgeEl) {
          badgeEl.setAttribute('transform', `translate(${this.regBadgePos.x}, ${this.regBadgePos.y})`);
        }
        // プロット枠右端・上端からの相対オフセットを保持
        const plotRight = (this.lastMarginLeft || 52) + (this.lastPlotW || 600);
        const plotTop = this.lastMarginTop || 42;
        this.regBadgeRel = {
          dx: this.regBadgePos.x - plotRight,
          dy: this.regBadgePos.y - plotTop
        };
      }
      return;
    }

    const label = this.layoutEngine.labels.find(l => l.id === this.draggedLabelId);
    if (label) {
      this.layoutEngine.updateLabelPosition(label.id, label.lx + dx, label.ly + dy);
      this.updateSingleLabelDOM(label);
    }
  }

  onMouseUp() {
    if (this.isDragging) {
      if (this.draggedLabelId === '__reg_badge__') {
        const badgeEl = this.svg ? this.svg.querySelector('.regression-stat-badge') : null;
        if (badgeEl) {
          badgeEl.style.cursor = 'grab';
        }
      }
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
      this.svg = null;
      this.container.innerHTML = '<div class="empty-state">データが選択されていません。</div>';
      return null;
    }

    // 有効なデータポイントを抽出
    const validRows = [];
    const xValues = [];
    const yValues = [];

    rows.forEach((r, idx) => {
      const x = r[xKey];
      const y = r[yKey];
      if (typeof x === 'number' && !isNaN(x) && typeof y === 'number' && !isNaN(y)) {
        validRows.push({ ...r, _id: typeof r._rowId === 'number' ? r._rowId : idx, _x: x, _y: y, _name: r[labelKey] || `No.${idx + 1}` });
        xValues.push(x);
        yValues.push(y);
      }
    });

    if (validRows.length === 0) {
      this.svg = null;
      this.container.innerHTML = '<div class="empty-state">選択された列に有効な数値データがありません。</div>';
      return null;
    }

    // 統計計算
    const meanX = Stats.mean(xValues);
    const meanY = Stats.mean(yValues);
    const medianX = Stats.median(xValues);
    const medianY = Stats.median(yValues);
    const geomX = Stats.geometricMean(xValues);
    const geomY = Stats.geometricMean(yValues);
    const stdX = Stats.stdDev(xValues, meanX);
    const stdY = Stats.stdDev(yValues, meanY);
    const regression = Stats.linearRegression(xValues, yValues);

    let weightedX = null;
    let weightedY = null;
    if (this.options.quadrantWeightKey) {
      const weightKey = this.options.quadrantWeightKey;
      const weights = validRows.map(r => {
        const rawW = r[weightKey];
        if (rawW === undefined || rawW === null || rawW === '') return 0;
        const w = typeof rawW === 'number' ? rawW : parseFloat(String(rawW).replace(/,/g, ''));
        return (!isNaN(w) && isFinite(w) && w >= 0) ? w : 0;
      });
      weightedX = Stats.weightedMean(xValues, weights);
      weightedY = Stats.weightedMean(yValues, weights);
    }

    let splitX = meanX;
    let splitY = meanY;
    let splitTypeName = '平均';

    if (this.options.quadrantSplitType === 'median') {
      splitX = medianX;
      splitY = medianY;
      splitTypeName = '中央値';
    } else if (this.options.quadrantSplitType === 'geometric') {
      if (geomX !== null && geomY !== null) {
        splitX = geomX;
        splitY = geomY;
        splitTypeName = '幾何平均';
      } else {
        // 0以下の値が含まれる場合は算術平均に安全にフォールバック
        splitX = meanX;
        splitY = meanY;
        splitTypeName = '平均(幾何不可)';
      }
    } else if (this.options.quadrantSplitType === 'weighted') {
      if (weightedX !== null && weightedY !== null) {
        splitX = weightedX;
        splitY = weightedY;
        splitTypeName = '加重平均';
      } else {
        splitX = meanX;
        splitY = meanY;
        splitTypeName = '平均(重み未設定)';
      }
    }

    // Zスコア標準化
    validRows.forEach(r => {
      r._zx = stdX > 0 ? (r._x - meanX) / stdX : 0;
      r._zy = stdY > 0 ? (r._y - meanY) / stdY : 0;
      r._isOutlier = Math.hypot(r._zx, r._zy) >= 2.0;
    });

    // クラスター分析の実行 (clusterMode時)
    const isCluster = Boolean(this.options.clusterMode);
    let clusterResult = null;
    if (isCluster) {
      const clusterK = Math.max(2, Math.min(8, parseInt(this.options.clusterK, 10) || 3));
      const clusterPts = validRows.map(r => ({ id: r._id, x: r._zx, y: r._zy, name: r._name }));
      clusterResult = Stats.kMeans(clusterPts, clusterK);
      validRows.forEach(r => {
        r._clusterId = clusterResult.assignments.get(r._id) ?? 0;
      });
      // クラスターモード時は原点(0,0)に平均十字線を配置
      splitX = 0;
      splitY = 0;
      splitTypeName = '平均(Z=0)';
    }

    // ランク付け (上位判定)
    const sortedX = [...validRows].sort((a, b) => b._x - a._x);
    sortedX.forEach((r, rank) => { r._rankX = rank + 1; });
    const sortedY = [...validRows].sort((a, b) => b._y - a._y);
    sortedY.forEach((r, rank) => { r._rankY = rank + 1; });

    // 一般的な散布図の縦横比 (通常時は自然で美しい 4:3 = 1.333、1:1比率固定時は 1.0)
    const isAspect1to1 = Boolean(
      this.options.lockAspect1to1 ||
      (isCluster && (this.options.clusterAspect1to1 ?? true))
    );
    const targetAspect = isAspect1to1 ? 1.0 : 1.333;
    let renderW = 800;
    let renderH = 600;

    if (this.container) {
      const rect = this.container.getBoundingClientRect();
      const contW = rect.width > 100 ? rect.width : 800;
      const contH = rect.height > 100 ? rect.height : 600;

      if (contW / contH > targetAspect) {
        // コンテナが横長の場合: コンテナの高さに合わせて幅を制限 (縦潰れ防止)
        renderH = Math.max(280, Math.floor(contH));
        renderW = Math.round(renderH * targetAspect);
      } else {
        // コンテナが縦長の場合: コンテナの幅に合わせて高さを設定
        renderW = Math.max(380, Math.floor(contW));
        renderH = Math.round(renderW / targetAspect);
      }
    }

    const width = renderW;
    const height = renderH;
    this.currentRenderWidth = width;
    this.currentRenderHeight = height;

    let xMin, xMax, yMin, yMax;
    let scaleX, scaleY;

    if (isCluster) {
      const zxVals = validRows.map(r => r._zx);
      const zyVals = validRows.map(r => r._zy);
      const rawMinX = Math.min(...zxVals);
      const rawMaxX = Math.max(...zxVals);
      const rawMinY = Math.min(...zyVals);
      const rawMaxY = Math.max(...zyVals);
      
      // X軸・Y軸それぞれのデータの広がり(偏差)に合わせて独立して枠いっぱいに拡大
      // 軸の偏りによる「図の縮小・余白の増大」を解消し、正方形・横長枠の全体をダイナミックに使用
      const maxAbsX = Math.max(Math.abs(rawMinX), Math.abs(rawMaxX), 0.8);
      const limitX = Math.ceil(maxAbsX * 1.15 * 2) / 2; // 0.5刻みで切り上げ
      xMin = -limitX;
      xMax = limitX;

      const maxAbsY = Math.max(Math.abs(rawMinY), Math.abs(rawMaxY), 0.8);
      const limitY = Math.ceil(maxAbsY * 1.15 * 2) / 2;
      yMin = -limitY;
      yMax = limitY;

      scaleX = this.calcNiceScale(xMin, xMax, 6);
      scaleY = this.calcNiceScale(yMin, yMax, 6);
    } else {
      xMin = Math.min(...xValues);
      xMax = Math.max(...xValues);
      yMin = Math.min(...yValues);
      yMax = Math.max(...yValues);

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
      scaleX = this.calcNiceScale(xMin - padX, xMax + padX, 7);
      scaleY = this.calcNiceScale(yMin - padY, yMax + padY, 7);
    }

    // 目盛りフォーマットヘルパー (マージン計算および目盛り描画で共用)
    const formatTick = (val) => {
      if (isCluster) {
        if (Math.abs(val) < 1e-6) return '0.0 (平均)';
        const sign = val > 0 ? '+' : '';
        return `${sign}${val.toFixed(1)}σ`;
      }
      return val.toLocaleString();
    };

    // Y軸目盛り数値の最大文字幅を正確に動的計算 (全角日本語「0.0 (平均)」や桁数の多い数値と縦軸タイトルの重なりを完全防止)
    let maxYTickTextWidth = 24;
    scaleY.ticks.forEach(t => {
      const s = formatTick(t);
      let w = 0;
      for (let i = 0; i < s.length; i++) {
        // 全角文字(日本語)は約12px、半角英数は約6.8px
        w += s.charCodeAt(i) > 255 ? 12 : 6.8;
      }
      if (w > maxYTickTextWidth) maxYTickTextWidth = w;
    });
    const yTickTextWidth = Math.ceil(maxYTickTextWidth);
    this.yTickTextWidth = yTickTextWidth;

    // Y軸タイトル(14px) + 余白(16px) + 目盛り数値幅 + 目盛り線(5px) + 余白(8px)
    const dynamicMarginLeft = Math.max(64, yTickTextWidth + 42);

    // タイトルや回帰式バッジ、クラスター凡例の有無に応じて上部余白を最適化 (プロット枠外に綺麗に配置)
    const hasTitle = Boolean(this.options.title && this.options.title.trim());
    const hasRegEq = Boolean(this.options.showRegression && this.options.showRegressionEquation);
    const showClusterLegend = Boolean(isCluster && this.options.showClusterLabels !== false);

    // 上部マージン: クラスター凡例をプロット枠外に独立表示するため十分な高さを確保
    let topMargin = 22;
    if (hasTitle && showClusterLegend) {
      topMargin = 58; // メインタイトル + 凡例バー
    } else if (hasTitle) {
      topMargin = 44; // メインタイトルのみ
    } else if (showClusterLegend || hasRegEq) {
      topMargin = 40; // 凡例バーまたは回帰式バッジ
    }

    const margin = {
      top: topMargin,
      right: 28,
      bottom: 54, // 横軸目盛り数値と横軸タイトルの重なりを完全防止するクリアランス
      left: dynamicMarginLeft
    };

    const plotW = Math.max(100, width - margin.left - margin.right);
    const plotH = Math.max(100, height - margin.top - margin.bottom);

    // 座標変換関数
    const toPx = (val) => margin.left + ((val - scaleX.min) / (scaleX.max - scaleX.min)) * plotW;
    const toPy = (val) => margin.top + plotH - ((val - scaleY.min) / (scaleY.max - scaleY.min)) * plotH;
    this.lastMarginLeft = margin.left;
    this.lastPlotW = plotW;
    this.lastMarginTop = margin.top;

    // SVG構築
    const theme = this.getTheme();
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("xmlns", svgNS);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.style.maxWidth = "100%";
    svg.style.maxHeight = "100%";
    svg.style.width = "auto";
    svg.style.height = "auto";
    svg.style.display = "block";
    svg.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)";
    svg.style.borderRadius = "4px";
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

    // 0. クラスター領域 (包含・信頼楕円) の描画
    if (isCluster && this.options.showClusterHulls && clusterResult) {
      const ellipseGroup = document.createElementNS(svgNS, "g");
      ellipseGroup.setAttribute("class", "cluster-hulls cluster-ellipses");
      const cColors = this.options.clusterColors || ['#005aff', '#ea580c', '#16a34a', '#9333ea', '#d97706', '#0891b2', '#e11d48', '#4b5563'];

      clusterResult.clusters.forEach(c => {
        if (!c.points || c.points.length === 0) return;
        const color = cColors[c.id % cColors.length];
        const screenPts = c.points.map(p => ({ x: toPx(p.x), y: toPy(p.y) }));
        const ell = Stats.clusterEllipse(screenPts);
        if (!ell) return;
        c.ellipse = ell;

        const ellipseEl = document.createElementNS(svgNS, "ellipse");
        ellipseEl.setAttribute("cx", ell.cx.toFixed(1));
        ellipseEl.setAttribute("cy", ell.cy.toFixed(1));
        ellipseEl.setAttribute("rx", ell.rx.toFixed(1));
        ellipseEl.setAttribute("ry", ell.ry.toFixed(1));
        if (Math.abs(ell.angleDeg) > 0.01) {
          ellipseEl.setAttribute("transform", `rotate(${ell.angleDeg.toFixed(2)}, ${ell.cx.toFixed(1)}, ${ell.cy.toFixed(1)})`);
        }
        ellipseEl.setAttribute("fill", color);
        ellipseEl.setAttribute("fill-opacity", "0.10");
        ellipseEl.setAttribute("stroke", color);
        ellipseEl.setAttribute("stroke-width", "1.5");
        ellipseEl.setAttribute("stroke-dasharray", "4,3");
        ellipseEl.setAttribute("stroke-opacity", "0.65");
        ellipseGroup.appendChild(ellipseEl);
      });
      svg.appendChild(ellipseGroup);
    }

    // 1. 4象限背景ハイライト (通常モード時のみ)
    if (!isCluster && this.options.showQuadrant && this.options.showQuadrantBg) {
      const qSplitPx = toPx(splitX);
      const qSplitPy = toPy(splitY);

      // 有効エリア内に収まるようにクリップ
      const boundedSplitX = Math.max(margin.left, Math.min(margin.left + plotW, qSplitPx));
      const boundedSplitY = Math.max(margin.top, Math.min(margin.top + plotH, qSplitPy));

      const quadrants = [
        // Q1 (右上)
        { id: 'q1', x: boundedSplitX, y: margin.top, w: margin.left + plotW - boundedSplitX, h: boundedSplitY - margin.top, fill: theme.quadrantBg[0] },
        // Q2 (左上)
        { id: 'q2', x: margin.left, y: margin.top, w: boundedSplitX - margin.left, h: boundedSplitY - margin.top, fill: theme.quadrantBg[1] },
        // Q3 (左下)
        { id: 'q3', x: margin.left, y: boundedSplitY, w: boundedSplitX - margin.left, h: margin.top + plotH - boundedSplitY, fill: theme.quadrantBg[2] },
        // Q4 (右下)
        { id: 'q4', x: boundedSplitX, y: boundedSplitY, w: margin.left + plotW - boundedSplitX, h: margin.top + plotH - boundedSplitY, fill: theme.quadrantBg[3] }
      ];

      quadrants.forEach(q => {
        if (q.w > 0 && q.h > 0) {
          const r = document.createElementNS(svgNS, "rect");
          r.setAttribute("class", `quadrant-rect quadrant-${q.id}`);
          r.setAttribute("x", q.x);
          r.setAttribute("y", q.y);
          r.setAttribute("width", q.w);
          r.setAttribute("height", q.h);
          r.setAttribute("fill", q.fill);
          r.setAttribute("opacity", theme.quadrantOpacity !== undefined ? theme.quadrantOpacity : "0.68");
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
          poly.setAttribute("fill", theme.regBand || '#dc2626');
          poly.setAttribute("fill-opacity", theme.regBandOpacity !== undefined ? theme.regBandOpacity : '0.12');
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

      // 回帰統計ボックス (控えめで上品なミニマルデザイン & プロット枠外配置で象限ラベル等との重なりを防止)
      if (this.options.showRegressionEquation) {
        const sign = regression.intercept >= 0 ? '+' : '-';
        const absIntercept = Math.abs(regression.intercept).toFixed(2);
        const eqText = `y = ${regression.slope.toFixed(2)}x ${sign} ${absIntercept}`;
        const r2Text = `R² = ${regression.r2.toFixed(3)}`;

        const statBox = document.createElementNS(svgNS, "g");
        statBox.setAttribute("class", "regression-stat-badge");

        // 控えめな横長インラインバッジ
        const textLen = (eqText + "  " + r2Text).length;
        const boxW = Math.max(140, textLen * 6.4 + 16);
        const boxH = 22;

        // デフォルト位置: プロット枠外の上部ヘッダー右端 (象限ラベルやプロット点と絶対に重ならない)
        const defaultBoxX = margin.left + plotW - boxW;
        const defaultBoxY = Math.max(6, margin.top - boxH - 5);

        // プロット枠からの相対位置があれば復元 (全画面化や画面サイズ変更時も位置関係を完全維持)
        if (this.regBadgeRel) {
          this.regBadgePos = {
            x: Math.max(margin.left, Math.min(width - boxW - 8, margin.left + plotW + this.regBadgeRel.dx)),
            y: Math.max(4, Math.min(height - boxH - 4, margin.top + this.regBadgeRel.dy))
          };
        } else if (!this.regBadgePos) {
          this.regBadgePos = { x: defaultBoxX, y: defaultBoxY };
        }

        statBox.setAttribute("transform", `translate(${this.regBadgePos.x}, ${this.regBadgePos.y})`);
        statBox.style.cursor = "grab";
        statBox.title = "回帰式バッジ（ドラッグで移動、ダブルクリックで右上定位置にリセット）";

        const boxBg = document.createElementNS(svgNS, "rect");
        boxBg.setAttribute("x", 0);
        boxBg.setAttribute("y", 0);
        boxBg.setAttribute("width", boxW);
        boxBg.setAttribute("height", boxH);
        boxBg.setAttribute("rx", "11");
        boxBg.setAttribute("fill", theme.labelBg || "#ffffff");
        boxBg.setAttribute("fill-opacity", theme.labelBgOpacity || "0.95");
        boxBg.setAttribute("stroke", theme.labelBorder || "#cbd5e1");
        boxBg.setAttribute("stroke-width", "0.8");
        boxBg.style.filter = "drop-shadow(0 1px 2px rgba(0,0,0,0.06))";
        statBox.appendChild(boxBg);

        const t = document.createElementNS(svgNS, "text");
        t.setAttribute("x", boxW / 2);
        t.setAttribute("y", 14.5);
        t.setAttribute("text-anchor", "middle");
        t.setAttribute("font-size", "10");
        t.setAttribute("font-family", "monospace, system-ui, sans-serif");
        t.style.userSelect = "none";

        const tSpanEq = document.createElementNS(svgNS, "tspan");
        tSpanEq.setAttribute("fill", theme.regLine);
        tSpanEq.setAttribute("font-weight", "600");
        tSpanEq.textContent = eqText;
        t.appendChild(tSpanEq);

        const tSpanSep = document.createElementNS(svgNS, "tspan");
        tSpanSep.setAttribute("fill", theme.axis || "#94a3b8");
        tSpanSep.textContent = "   ";
        t.appendChild(tSpanSep);

        const tSpanR2 = document.createElementNS(svgNS, "tspan");
        tSpanR2.setAttribute("fill", theme.text || "#334155");
        tSpanR2.setAttribute("font-weight", "bold");
        tSpanR2.textContent = r2Text;
        t.appendChild(tSpanR2);

        statBox.appendChild(t);

        // ドラッグ & リセットイベント
        statBox.addEventListener('mousedown', (e) => {
          this.onMouseDownLabel(e, '__reg_badge__');
          statBox.style.cursor = "grabbing";
        });
        statBox.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          this.regBadgeRel = null;
          this.regBadgePos = { x: defaultBoxX, y: defaultBoxY };
          statBox.setAttribute("transform", `translate(${defaultBoxX}, ${defaultBoxY})`);
        });

        svg.appendChild(statBox);
      }
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
        splitLabelX.textContent = `${splitTypeName}X: ${splitX.toFixed(1)}`;
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
        splitLabelY.textContent = `${splitTypeName}Y: ${splitY.toFixed(1)}`;
        svg.appendChild(splitLabelY);
      }

      // 4象限の名称ラベル
      const qLabels = this.options.quadrantLabels;
      const qTextColors = theme.quadrantFg || ['#005aff', '#b45309', '#44403c', '#c2410c']; // Q1(青), Q2(黄), Q3(灰), Q4(橙)
      const cornerOffsets = [
        { label: qLabels.q1, x: margin.left + plotW - 12, y: margin.top + 20, anchor: 'end', color: qTextColors[0] },
        { label: qLabels.q2, x: margin.left + 12, y: margin.top + 20, anchor: 'start', color: qTextColors[1] },
        { label: qLabels.q3, x: margin.left + 12, y: margin.top + plotH - 12, anchor: 'start', color: qTextColors[2] },
        { label: qLabels.q4, x: margin.left + plotW - 12, y: margin.top + plotH - 12, anchor: 'end', color: qTextColors[3] }
      ];

      cornerOffsets.forEach(co => {
        if (co.label) {
          const t = document.createElementNS(svgNS, "text");
          t.setAttribute("x", co.x);
          t.setAttribute("y", co.y);
          t.setAttribute("text-anchor", co.anchor);
          t.setAttribute("fill", co.color);
          t.setAttribute("font-size", "11");
          t.setAttribute("font-weight", "bold");
          t.setAttribute("opacity", "0.95");
          t.setAttribute("stroke", theme.plotBg || theme.bg || "#ffffff");
          t.setAttribute("stroke-opacity", "0.95");
          t.setAttribute("stroke-width", "3");
          t.setAttribute("paint-order", "stroke fill");
          t.setAttribute("stroke-linejoin", "round");
          t.textContent = co.label;
          svg.appendChild(t);
        }
      });
    }

    // 6. プロット点の描画データ準備
    const points = validRows.map(r => {
      const plotValX = isCluster ? r._zx : r._x;
      const plotValY = isCluster ? r._zy : r._y;
      return {
        id: r._id,
        name: r._name,
        x: r._x,
        y: r._y,
        zx: r._zx,
        zy: r._zy,
        clusterId: r._clusterId ?? 0,
        px: toPx(plotValX),
        py: toPy(plotValY),
        isOutlier: r._isOutlier,
        rankX: r._rankX,
        rankY: r._rankY,
        isLabeled: !!r._labeled,
        isHighlighted: !!r._highlighted
      };
    });

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
      const isHl = !!label.isHighlighted;
      line.setAttribute("stroke", isHl ? (theme.hlLine || "#ea580c") : theme.leaderLine);
      line.setAttribute("stroke-width", isHl ? "1.5" : "1");
      line.setAttribute("stroke-dasharray", isHl ? "none" : "2,2");
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
      const isHl = !!p.isHighlighted;
      const baseR = isHl ? this.options.pointRadius + 2.5 : this.options.pointRadius;
      circle.setAttribute("r", baseR);

      let pColor = theme.pointFill;
      if (isHl) {
        pColor = theme.hlPoint || "#ea580c";
      } else if (isCluster) {
        const cColors = this.options.clusterColors || ['#005aff', '#ea580c', '#16a34a', '#9333ea', '#d97706', '#0891b2', '#e11d48', '#4b5563'];
        pColor = cColors[p.clusterId % cColors.length];
      } else if (this.options.colorPointsByQuadrant && this.options.showQuadrant) {
        const qFg = theme.quadrantPointFg || theme.quadrantFg || ['#005aff', '#b45309', '#44403c', '#c2410c'];
        if (p.x >= splitX && p.y >= splitY) {
          pColor = qFg[0]; // Q1
        } else if (p.x < splitX && p.y >= splitY) {
          pColor = qFg[1]; // Q2
        } else if (p.x < splitX && p.y < splitY) {
          pColor = qFg[2]; // Q3
        } else {
          pColor = qFg[3]; // Q4
        }
      }
      circle.setAttribute("fill", pColor);
      circle.setAttribute("stroke", isHl ? (theme.hlPointStroke || "#ffffff") : theme.pointStroke);
      circle.setAttribute("stroke-width", isHl ? "2" : "1.5");
      circle.setAttribute("fill-opacity", isHl ? "1" : this.options.pointOpacity);
      if (isHl && theme.hlShadow && theme.hlShadow !== 'none') {
        circle.style.filter = theme.hlShadow;
      } else if (isHl) {
        circle.style.filter = "none";
      }
      circle.style.cursor = "pointer";
      circle.style.transition = "transform 0.15s ease, r 0.15s ease";

      // ツールチップ用タイトル要素
      const titleEl = document.createElementNS(svgNS, "title");
      if (isCluster) {
        titleEl.textContent = `${p.name}${isHl ? " [★強調]" : ""}\nクラスター: Cluster ${p.clusterId + 1}\n${xKey}: ${p.x.toLocaleString()} (Z: ${p.zx >= 0 ? '+' : ''}${p.zx.toFixed(2)}σ)\n${yKey}: ${p.y.toLocaleString()} (Z: ${p.zy >= 0 ? '+' : ''}${p.zy.toFixed(2)}σ)\n(クリックでラベル表示切替)`;
      } else {
        titleEl.textContent = `${p.name}${isHl ? " [★強調]" : ""}\n${xKey}: ${p.x.toLocaleString()}\n${yKey}: ${p.y.toLocaleString()}\n(クリックでラベル表示切替)`;
      }
      circle.appendChild(titleEl);

      // プロット点のクリック (個別ラベル表示/非表示のトグル)
      circle.addEventListener('click', (e) => {
        if (this.options.onPointClick) {
          this.options.onPointClick(p, e);
        }
      });

      // ホバーハイライト
      circle.addEventListener('mouseenter', () => {
        circle.setAttribute("r", baseR + 3);
        circle.setAttribute("fill-opacity", "1");
        circle.setAttribute("stroke-width", isHl ? "3" : "2.5");
      });
      circle.addEventListener('mouseleave', () => {
        circle.setAttribute("r", baseR);
        circle.setAttribute("fill-opacity", isHl ? "1" : this.options.pointOpacity);
        circle.setAttribute("stroke-width", isHl ? "2" : "1.5");
      });

      pointsGroup.appendChild(circle);
    });
    svg.appendChild(pointsGroup);

    // 8.5 クラスター重心 (Centroid) の描画 (プロット点を隠さない洗練された細線十字クロスヘア)
    if (isCluster && this.options.showCentroids && clusterResult) {
      const centroidGroup = document.createElementNS(svgNS, "g");
      centroidGroup.setAttribute("class", "cluster-centroids");
      centroidGroup.setAttribute("pointer-events", "none"); // 下のデータ点のホバー・クリックを妨げない
      const cColors = this.options.clusterColors || ['#005aff', '#ea580c', '#16a34a', '#9333ea', '#d97706', '#0891b2', '#e11d48', '#4b5563'];

      clusterResult.clusters.forEach(c => {
        if (!c.centroid) return;
        const cPx = toPx(c.centroid.x);
        const cPy = toPy(c.centroid.y);
        const color = cColors[c.id % cColors.length];

        const g = document.createElementNS(svgNS, "g");
        g.setAttribute("transform", `translate(${cPx.toFixed(1)}, ${cPy.toFixed(1)})`);

        // プロットを覆い隠さない細い十字マーク (Crosshair)
        const arm = 5;
        const cross = document.createElementNS(svgNS, "path");
        cross.setAttribute("d", `M ${-arm} 0 L ${arm} 0 M 0 ${-arm} L 0 ${arm}`);
        cross.setAttribute("stroke", color);
        cross.setAttribute("stroke-width", "1.8");
        cross.setAttribute("stroke-linecap", "round");
        g.appendChild(cross);

        // 中心極小ドット
        const dot = document.createElementNS(svgNS, "circle");
        dot.setAttribute("r", "1.5");
        dot.setAttribute("fill", "#ffffff");
        dot.setAttribute("stroke", color);
        dot.setAttribute("stroke-width", "1");
        g.appendChild(dot);

        centroidGroup.appendChild(g);
      });
      svg.appendChild(centroidGroup);
    }

    // 8.6 クラスター凡例 (Legend Bar) の描画 (プロット枠外の上部に独立配置し、点や楕円との重なりを完全解消)
    if (isCluster && (this.options.showClusterLabels !== false) && clusterResult) {
      const legendGroup = document.createElementNS(svgNS, "g");
      legendGroup.setAttribute("class", "cluster-legend-bar");
      const cColors = this.options.clusterColors || ['#005aff', '#ea580c', '#16a34a', '#9333ea', '#d97706', '#0891b2', '#e11d48', '#4b5563'];

      // 凡例のY座標: プロット枠外の上部余白 (タイトルがある場合はその直下)
      const legendY = hasTitle ? 32 : 14;

      let currentX = margin.left;
      clusterResult.clusters.forEach(c => {
        const color = cColors[c.id % cColors.length];
        const count = c.points ? c.points.length : 0;
        const labelText = `C${c.id + 1} (${count}件)`;
        const badgeW = labelText.length * 6.5 + 24;

        if (currentX + badgeW <= margin.left + plotW) {
          const legItem = document.createElementNS(svgNS, "g");
          legItem.setAttribute("transform", `translate(${currentX.toFixed(1)}, ${legendY})`);

          // 凡例背景ピル
          const pill = document.createElementNS(svgNS, "rect");
          pill.setAttribute("x", "0");
          pill.setAttribute("y", "0");
          pill.setAttribute("width", badgeW.toFixed(1));
          pill.setAttribute("height", "18");
          pill.setAttribute("rx", "4");
          pill.setAttribute("ry", "4");
          pill.setAttribute("fill", "#f8fafc");
          pill.setAttribute("stroke", "#e2e8f0");
          pill.setAttribute("stroke-width", "1");
          legItem.appendChild(pill);

          // カラーチップ
          const dot = document.createElementNS(svgNS, "circle");
          dot.setAttribute("cx", "9");
          dot.setAttribute("cy", "9");
          dot.setAttribute("r", "4");
          dot.setAttribute("fill", color);
          legItem.appendChild(dot);

          // テキスト
          const txt = document.createElementNS(svgNS, "text");
          txt.setAttribute("x", "18");
          txt.setAttribute("y", "12.5");
          txt.setAttribute("font-size", "10");
          txt.setAttribute("font-weight", "600");
          txt.setAttribute("fill", "#334155");
          txt.textContent = labelText;
          legItem.appendChild(txt);

          // ツールチップ
          const tip = document.createElementNS(svgNS, "title");
          tip.textContent = `クラスター${c.id + 1}\n所属データ数: ${count}件\n重心 Zx: ${c.centroid ? (c.centroid.x >= 0 ? '+' : '') + c.centroid.x.toFixed(2) + 'σ' : '-'}\n重心 Zy: ${c.centroid ? (c.centroid.y >= 0 ? '+' : '') + c.centroid.y.toFixed(2) + 'σ' : '-'}`;
          legItem.appendChild(tip);

          legendGroup.appendChild(legItem);
          currentX += badgeW + 8; // 項目間余白
        }
      });

      svg.appendChild(legendGroup);
    }

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
      const isHl = !!label.isHighlighted;
      const rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", -label.width / 2);
      rect.setAttribute("y", -label.height / 2);
      rect.setAttribute("width", label.width);
      rect.setAttribute("height", label.height);
      rect.setAttribute("rx", "4");
      rect.setAttribute("fill", isHl ? (theme.hlLabelBg || "#fff7ed") : (theme.labelBg || "#ffffff"));
      rect.setAttribute("fill-opacity", isHl ? "1" : (theme.labelBgOpacity || "0.95"));
      rect.setAttribute("stroke", isHl ? (theme.hlLabelBorder || "#ea580c") : theme.labelBorder);
      rect.setAttribute("stroke-width", isHl ? "2" : "1");
      if (isHl && theme.hlShadow && theme.hlShadow !== 'none') {
        rect.style.filter = "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.15))";
      } else {
        rect.style.filter = "none";
      }
      g.appendChild(rect);

      // テキスト (SVGラスタライズ・Canvas保存・PNG出力時にも完全な垂直中央配置を保証する dy=0.35em 方式)
      const txt = document.createElementNS(svgNS, "text");
      txt.setAttribute("x", "0");
      txt.setAttribute("y", "0");
      txt.setAttribute("dy", "0.32em");
      txt.setAttribute("text-anchor", "middle");
      txt.setAttribute("fill", isHl ? (theme.hlLabelText || "#c2410c") : theme.labelText);
      txt.setAttribute("font-size", this.options.fontSize);
      txt.setAttribute("font-weight", isHl ? "bold" : "normal");
      txt.setAttribute("font-family", "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans JP', 'Hiragino Sans', 'Meiryo', sans-serif");
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
        tickText.setAttribute("y", margin.top + plotH + 16);
        tickText.setAttribute("text-anchor", "middle");
        tickText.setAttribute("fill", theme.text);
        tickText.setAttribute("font-size", isCluster ? "10" : "11");
        tickText.textContent = formatTick(tick);
        svg.appendChild(tickText);
      }
    });

    // X軸 (横軸) 項目名称 (目盛り数値と重ならないよう24pxのクリアランスを確保)
    const xLabel = document.createElementNS(svgNS, "text");
    xLabel.setAttribute("x", margin.left + plotW / 2);
    xLabel.setAttribute("y", margin.top + plotH + 40);
    xLabel.setAttribute("text-anchor", "middle");
    xLabel.setAttribute("fill", theme.text);
    xLabel.setAttribute("font-size", "12");
    xLabel.setAttribute("font-weight", "600");
    xLabel.textContent = isCluster ? `${this.options.xTitle || xKey} (Zスコア)` : (this.options.xTitle || xKey);
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
        tickText.setAttribute("font-size", isCluster ? "10" : "11");
        tickText.textContent = formatTick(tick);
        svg.appendChild(tickText);
      }
    });

    // Y軸 (縦軸) 項目名称 (目盛り数値と程よいバランスの距離を保ち、横軸と均等の視覚マージンを確保)
    const yLabel = document.createElementNS(svgNS, "text");
    yLabel.setAttribute("transform", `rotate(-90)`);
    yLabel.setAttribute("x", -(margin.top + plotH / 2));
    const yTitlePos = Math.max(16, margin.left - (this.yTickTextWidth || 30) - 13);
    yLabel.setAttribute("y", yTitlePos);
    yLabel.setAttribute("text-anchor", "middle");
    yLabel.setAttribute("fill", theme.text);
    yLabel.setAttribute("font-size", "12");
    yLabel.setAttribute("font-weight", "600");
    yLabel.textContent = isCluster ? `${this.options.yTitle || yKey} (Zスコア)` : (this.options.yTitle || yKey);
    svg.appendChild(yLabel);

    // グラフメインタイトル (クラスター凡例がある場合は凡例の上部にすっきり配置)
    if (this.options.title) {
      const mainTitle = document.createElementNS(svgNS, "text");
      mainTitle.setAttribute("x", margin.left);
      mainTitle.setAttribute("y", showClusterLegend ? 20 : (margin.top - 16));
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
      geomX,
      geomY,
      weightedX,
      weightedY,
      stdX,
      stdY,
      splitX,
      splitY,
      splitTypeName,
      regression,
      quadrants: quadClass,
      clusterResult,
      isCluster
    };
  }

  // RGBA文字列をHEXとAlphaに分解するヘルパー (SVG標準互換用)
  _parseRgba(colorStr) {
    if (!colorStr || typeof colorStr !== 'string') return null;
    const m = colorStr.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/);
    if (!m) return null;
    const r = parseInt(m[1], 10).toString(16).padStart(2, '0');
    const g = parseInt(m[2], 10).toString(16).padStart(2, '0');
    const b = parseInt(m[3], 10).toString(16).padStart(2, '0');
    return {
      hex: `#${r}${g}${b}`,
      alpha: m[4]
    };
  }

  // SVG文字列の取得 (現在の画面サイズ・見たままの形を完全保証)
  getSVGString() {
    if (!this.svg) return null;
    const baseW = this.currentRenderWidth || this.options.width;
    const baseH = this.currentRenderHeight || this.options.height;

    // クローンを作成し、スタンドアロン保存やCanvas描画に最適な寸法属性を明示
    const clone = this.svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", baseW);
    clone.setAttribute("height", baseH);
    clone.setAttribute("viewBox", `0 0 ${baseW} ${baseH}`);

    // SVG 1.1 / 各種グラフィックソフト (Illustrator, Inkscape, PowerPoint, macOS Preview等) 互換性サニタイズ:
    // 外部ソフトでラベル背景や図形が黒く塗りつぶされる原因 (rgba()の不認識、CSS filterの非解釈) を完全解消
    const allElements = clone.querySelectorAll('*');
    allElements.forEach(el => {
      // 1. CSS filter: drop-shadow の除去 (Illustrator等で黒矩形になるのを防止)
      if (el.style && el.style.filter) {
        el.style.filter = '';
      }

      // 2. fill 属性内の rgba() を SVG 1.1 準拠の hex + fill-opacity に正規化
      const fill = el.getAttribute('fill');
      if (fill && fill.startsWith('rgba(')) {
        const parsed = this._parseRgba(fill);
        if (parsed) {
          el.setAttribute('fill', parsed.hex);
          el.setAttribute('fill-opacity', parsed.alpha);
        }
      }

      // 3. stroke 属性内の rgba() を hex + stroke-opacity に正規化
      const stroke = el.getAttribute('stroke');
      if (stroke && stroke.startsWith('rgba(')) {
        const parsed = this._parseRgba(stroke);
        if (parsed) {
          el.setAttribute('stroke', parsed.hex);
          el.setAttribute('stroke-opacity', parsed.alpha);
        }
      }
    });

    const serializer = new XMLSerializer();
    return serializer.serializeToString(clone);
  }

  // SVGダウンロード (見たままの解像度とベクター品質)
  downloadSVG(fileName = 'scatter_plot.svg') {
    const svgStr = this.getSVGString();
    if (!svgStr) return false;
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  }

  // PNG画像 (Canvas経由) のダウンロード (画面上の見たままの形を高解像度出力)
  downloadPNG(fileName = 'scatter_plot.png', scale = 2) {
    const svgStr = this.getSVGString();
    if (!svgStr) return Promise.resolve(null);

    const baseW = this.currentRenderWidth || this.options.width;
    const baseH = this.currentRenderHeight || this.options.height;
    const width = Math.round(baseW * scale);
    const height = Math.round(baseH * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const img = new Image();
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    return new Promise((resolve) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);

        canvas.toBlob((pngBlob) => {
          if (!pngBlob) return resolve(null);
          const pngUrl = URL.createObjectURL(pngBlob);
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(pngUrl);
          resolve({ width, height });
        }, 'image/png');
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }

  // クリップボードへPNG画像をコピー (画面上の見たままの形を出力)
  async copyPNGToClipboard(scale = 2) {
    const svgStr = this.getSVGString();
    if (!svgStr) throw new Error("グラフが作成されていません。");

    const baseW = this.currentRenderWidth || this.options.width;
    const baseH = this.currentRenderHeight || this.options.height;
    const width = Math.round(baseW * scale);
    const height = Math.round(baseH * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

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
            resolve({ width, height });
          } catch (err) {
            reject(err);
          }
        }, 'image/png');
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      img.src = url;
    });
  }

  // 手動移動したラベルや回帰式バッジの位置を初期状態にリセット
  resetPositions() {
    if (this.layoutEngine) {
      this.layoutEngine.resetManualPositions();
    }
    this.regBadgeRel = null;
    this.regBadgePos = null;
  }
}

window.ScatterPlot = ScatterPlot;
