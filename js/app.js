/**
 * app.js - アプリケーション メインコントローラー
 * UI連携、ファイル読込、イベントバインド、エクスポート
 */

document.addEventListener('DOMContentLoaded', () => {
  // アプリケーション状態
  const state = {
    tableData: null,
    scatterPlot: null,
    currentStats: null,
    excludedRowIds: new Set(),    // 作図から除外する行ID
    labeledRowIds: new Set(),     // 個別ラベル表示指定する行ID
    highlightedRowIds: new Set()  // 図上で強調する行ID
  };

  // DOM要素の参照取得
  const elements = {
    // ファイル入力
    dropZone: document.getElementById('dropZone'),
    fileInput: document.getElementById('fileInput'),
    btnSample: document.getElementById('btnSample'),
    btnSampleEmpty: document.getElementById('btnSampleEmpty'),
    btnPaste: document.getElementById('btnPaste'),
    fileInfo: document.getElementById('fileInfo'),

    // データ入力切替タブ・ペイン
    tabBtnFile: document.getElementById('tabBtnFile'),
    tabBtnPaste: document.getElementById('tabBtnPaste'),
    paneFile: document.getElementById('paneFile'),
    panePaste: document.getElementById('panePaste'),
    sidebarPasteArea: document.getElementById('sidebarPasteArea'),
    btnSidebarPasteClip: document.getElementById('btnSidebarPasteClip'),
    btnSidebarApplyPaste: document.getElementById('btnSidebarApplyPaste'),
    btnSidebarClearPaste: document.getElementById('btnSidebarClearPaste'),

    // Empty State ガイド内要素
    emptyPasteBox: document.getElementById('emptyPasteBox'),
    emptyFileBox: document.getElementById('emptyFileBox'),
    btnEmptyPasteDirect: document.getElementById('btnEmptyPasteDirect'),
    btnEmptyFileSelect: document.getElementById('btnEmptyFileSelect'),

    // 列選択
    selectLabel: document.getElementById('selectLabel'),
    selectX: document.getElementById('selectX'),
    selectY: document.getElementById('selectY'),
    chartTitle: document.getElementById('chartTitle'),
    xTitle: document.getElementById('xTitle'),
    yTitle: document.getElementById('yTitle'),

    // 補助線設定
    chkQuadrant: document.getElementById('chkQuadrant'),
    quadrantSplitType: document.getElementById('quadrantSplitType'),
    quadrantSplitHint: document.getElementById('quadrantSplitHint'),
    groupQuadrantWeight: document.getElementById('groupQuadrantWeight'),
    selectQuadrantWeight: document.getElementById('selectQuadrantWeight'),
    chkQuadrantBg: document.getElementById('chkQuadrantBg'),
    chkQuadrantColorPoints: document.getElementById('chkQuadrantColorPoints'),
    chkLine45: document.getElementById('chkLine45'),
    chkAspect1to1: document.getElementById('chkAspect1to1'),
    chkRegression: document.getElementById('chkRegression'),
    chkRegressionEq: document.getElementById('chkRegressionEq'),
    chkConfidence: document.getElementById('chkConfidence'),

    // 象限ラベル
    q1Label: document.getElementById('q1Label'),
    q2Label: document.getElementById('q2Label'),
    q3Label: document.getElementById('q3Label'),
    q4Label: document.getElementById('q4Label'),

    // クラスター分析
    chkClusterMode: document.getElementById('chkClusterMode'),
    clusterOptions: document.getElementById('clusterOptions'),
    badgeOptimalK: document.getElementById('badgeOptimalK'),
    inputClusterK: document.getElementById('inputClusterK'),
    btnClusterMinus: document.getElementById('btnClusterMinus'),
    btnClusterPlus: document.getElementById('btnClusterPlus'),
    chkShowCentroids: document.getElementById('chkShowCentroids'),
    chkShowHulls: document.getElementById('chkShowHulls'),

    // ラベル設定
    selectLabelMode: document.getElementById('selectLabelMode'),
    btnResetLabels: document.getElementById('btnResetLabels'),

    // スタイル設定
    selectTheme: document.getElementById('selectTheme'),
    rangePointSize: document.getElementById('rangePointSize'),
    valPointSize: document.getElementById('valPointSize'),
    rangeOpacity: document.getElementById('rangeOpacity'),
    valOpacity: document.getElementById('valOpacity'),
    rangeFontSize: document.getElementById('rangeFontSize'),
    valFontSize: document.getElementById('valFontSize'),

    // 描画エリア
    chartContainer: document.getElementById('chartContainer'),
    chartCard: document.querySelector('.chart-card'),
    sidebar: document.querySelector('.sidebar'),
    btnResetView: document.getElementById('btnResetView'),
    btnToggleSidebar: document.getElementById('btnToggleSidebar'),
    btnMaximizeChart: document.getElementById('btnMaximizeChart'),

    // エクスポート (ツールバーに集約)
    btnSaveSVG: document.getElementById('btnSaveSVG'),
    btnSavePNG: document.getElementById('btnSavePNG'),
    btnCopyPNG: document.getElementById('btnCopyPNG'),
    btnCopySummary: document.getElementById('btnCopySummary'),

    // データ確認・設定モーダル
    btnViewData: document.getElementById('btnViewData'),
    btnViewDataSidebar: document.getElementById('btnViewDataSidebar'),
    dataModal: document.getElementById('dataModal'),
    btnCloseModal: document.getElementById('btnCloseModal'),
    modalDataCount: document.getElementById('modalDataCount'),
    modalSearch: document.getElementById('modalSearch'),
    btnCopyTableCSV: document.getElementById('btnCopyTableCSV'),
    dataTableHead: document.getElementById('dataTableHead'),
    dataTableBody: document.getElementById('dataTableBody'),
    modalSelectLabel: document.getElementById('modalSelectLabel'),
    modalSelectX: document.getElementById('modalSelectX'),
    modalSelectY: document.getElementById('modalSelectY'),
    btnModalSelectAll: document.getElementById('btnModalSelectAll'),
    btnModalDeselectAll: document.getElementById('btnModalDeselectAll'),
    btnModalClearLabels: document.getElementById('btnModalClearLabels'),
    btnModalClearHighlight: document.getElementById('btnModalClearHighlight'),

    // 貼り付けモーダル
    pasteModal: document.getElementById('pasteModal'),
    btnClosePasteModal: document.getElementById('btnClosePasteModal'),
    btnCancelPaste: document.getElementById('btnCancelPaste'),
    btnApplyPaste: document.getElementById('btnApplyPaste'),
    pasteTextarea: document.getElementById('pasteTextarea'),

    // サマリーホバーウィジェット
    summaryHoverWidget: document.getElementById('summaryHoverWidget'),
    summaryHoverTrigger: document.getElementById('summaryHoverTrigger'),
    summaryContent: document.getElementById('summaryContent'),
    toast: document.getElementById('toast')
  };

  // トースト表示関数
  function showToast(message, type = 'info') {
    elements.toast.textContent = message;
    elements.toast.className = `toast show ${type}`;
    setTimeout(() => {
      elements.toast.className = 'toast';
    }, 2800);
  }

  // HTMLエスケープヘルパー (特殊文字によるテーブル崩れ・XSS防止)
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ScatterPlot インスタンス生成
  state.scatterPlot = new ScatterPlot('chartContainer', {
    width: 960,
    height: 640
  });

  // UIの設定値からオプションオブジェクトを構築
  function getPlotOptions() {
    return {
      title: elements.chartTitle.value.trim(),
      xTitle: elements.xTitle.value.trim(),
      yTitle: elements.yTitle.value.trim(),
      theme: elements.selectTheme.value,
      pointRadius: parseFloat(elements.rangePointSize.value) || 6,
      pointOpacity: parseFloat(elements.rangeOpacity.value) || 0.75,
      fontSize: parseFloat(elements.rangeFontSize.value) || 11,
      showQuadrant: elements.chkQuadrant.checked,
      quadrantSplitType: elements.quadrantSplitType.value,
      quadrantWeightKey: elements.selectQuadrantWeight ? elements.selectQuadrantWeight.value : null,
      showQuadrantBg: elements.chkQuadrantBg.checked,
      colorPointsByQuadrant: elements.chkQuadrantColorPoints ? elements.chkQuadrantColorPoints.checked : false,
      quadrantLabels: {
        q1: elements.q1Label.value.trim(),
        q2: elements.q2Label.value.trim(),
        q3: elements.q3Label.value.trim(),
        q4: elements.q4Label.value.trim()
      },
      showLine45: elements.chkLine45.checked,
      lockAspect1to1: elements.chkAspect1to1.checked,
      showRegression: elements.chkRegression.checked,
      showRegressionEquation: elements.chkRegressionEq.checked,
      showConfidenceInterval: elements.chkConfidence.checked,
      clusterMode: elements.chkClusterMode ? elements.chkClusterMode.checked : false,
      clusterK: elements.inputClusterK ? parseInt(elements.inputClusterK.value, 10) || 3 : 3,
      showCentroids: elements.chkShowCentroids ? elements.chkShowCentroids.checked : true,
      showClusterHulls: elements.chkShowHulls ? elements.chkShowHulls.checked : true,
      labelMode: elements.selectLabelMode.value,
      showLeaderLines: true,
      onPointClick: (p, e) => {
        const rowId = p.id;
        if (state.labeledRowIds.has(rowId)) {
          state.labeledRowIds.delete(rowId);
          showToast(`「${p.name}」のラベルを非表示にしました`, 'info');
        } else {
          state.labeledRowIds.add(rowId);
          if (elements.selectLabelMode.value === 'none') {
            elements.selectLabelMode.value = 'custom';
          }
          showToast(`「${p.name}」のラベルを表示しました`, 'success');
        }
        redrawChart();
        if (elements.dataModal && elements.dataModal.style.display !== 'none') {
          renderDataTable(elements.modalSearch ? elements.modalSearch.value : '');
        }
      }
    };
  }

  // グラフ再描画 (作図対象フィルタ・強調フラグ反映)
  function redrawChart() {
    if (!state.tableData) return;

    const labelKey = elements.selectLabel.value;
    const xKey = elements.selectX.value;
    const yKey = elements.selectY.value;

    if (!xKey || !yKey) return;

    const options = getPlotOptions();

    // 作図対象として選択されている行のみを抽出・ラベルフラグ・強調フラグを付与
    const activeRows = state.tableData.rows
      .filter(r => !state.excludedRowIds.has(r._rowId))
      .map(r => ({
        ...r,
        _labeled: state.labeledRowIds.has(r._rowId),
        _highlighted: state.highlightedRowIds.has(r._rowId)
      }));

    state.currentStats = state.scatterPlot.render({
      rows: activeRows,
      labelKey,
      xKey,
      yKey
    }, options);

    updateSummaryDisplay(state.currentStats, xKey, yKey);
  }

  // 最適クラスタ数 (k) の自動判定とUI反映
  function updateOptimalClusterK() {
    if (!state.tableData || !elements.badgeOptimalK) return;
    const xKey = elements.selectX.value;
    const yKey = elements.selectY.value;
    if (!xKey || !yKey) return;

    const validPts = [];
    state.tableData.rows.forEach((r, idx) => {
      const x = r[xKey];
      const y = r[yKey];
      if (typeof x === 'number' && !isNaN(x) && typeof y === 'number' && !isNaN(y)) {
        validPts.push({ id: typeof r._rowId === 'number' ? r._rowId : idx, x, y });
      }
    });

    if (validPts.length < 4) {
      elements.badgeOptimalK.textContent = '推奨: k = 2';
      return;
    }

    const zx = Stats.standardize(validPts.map(p => p.x));
    const zy = Stats.standardize(validPts.map(p => p.y));
    const zPts = validPts.map((p, i) => ({ id: p.id, x: zx[i], y: zy[i] }));

    const opt = Stats.findOptimalK(zPts, 2, 6);
    elements.badgeOptimalK.textContent = `推奨: k = ${opt.optimalK}`;
    if (elements.inputClusterK && !elements.inputClusterK.dataset.userModified) {
      elements.inputClusterK.value = opt.optimalK;
    }
  }

  // 統計サマリーのHTML表示更新 (右下ホバーウィジェット)
  function updateSummaryDisplay(stats, xKey, yKey) {
    if (!stats) {
      if (elements.summaryContent) {
        elements.summaryContent.innerHTML = '<span class="text-muted">データが読み込まれていません。</span>';
      }
      return;
    }

    if (stats.isCluster && stats.clusterResult) {
      const cColors = ['#005aff', '#ea580c', '#16a34a', '#9333ea', '#d97706', '#0891b2', '#e11d48', '#4b5563'];
      let clusterBadges = '<div class="cluster-counts" style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 8px;">';
      stats.clusterResult.clusters.forEach(c => {
        const color = cColors[c.id % cColors.length];
        clusterBadges += `<span class="c-badge" style="background:${color}18; color:${color}; border:1px solid ${color}55; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700;">C${c.id + 1}: ${c.points.length}件</span>`;
      });
      clusterBadges += '</div>';

      if (elements.summaryContent) {
        elements.summaryContent.innerHTML = `
          <div class="summary-grid">
            <div class="summary-item">
              <span class="summary-label">サンプル数:</span>
              <span class="summary-val">${stats.totalCount}件</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">クラスター数:</span>
              <span class="summary-val text-primary font-bold">k = ${stats.clusterResult.clusters.length}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">X平均 (生値):</span>
              <span class="summary-val">${stats.meanX.toFixed(1)}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">X標準偏差 (σ):</span>
              <span class="summary-val">${stats.stdX.toFixed(1)}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Y平均 (生値):</span>
              <span class="summary-val">${stats.meanY.toFixed(1)}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Y標準偏差 (σ):</span>
              <span class="summary-val">${stats.stdY.toFixed(1)}</span>
            </div>
          </div>
          ${clusterBadges}
        `;
      }
      return;
    }

    const reg = stats.regression;
    const sign = reg.intercept >= 0 ? '+' : '-';
    let splitName = '平均値';
    if (elements.quadrantSplitType.value === 'median') {
      splitName = '中央値';
    } else if (elements.quadrantSplitType.value === 'geometric') {
      splitName = (stats.geomX !== null && stats.geomY !== null) ? '幾何平均' : '平均(幾何不可)';
    } else if (elements.quadrantSplitType.value === 'weighted') {
      splitName = '加重平均';
    }

    if (elements.summaryContent) {
      elements.summaryContent.innerHTML = `
        <div class="summary-grid">
          <div class="summary-item">
            <span class="summary-label">サンプル数:</span>
            <span class="summary-val">${stats.totalCount}件</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">相関 (r):</span>
            <span class="summary-val ${Math.abs(reg.r) > 0.6 ? 'text-primary' : ''}">${reg.r.toFixed(3)}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">${splitName}X:</span>
            <span class="summary-val">${stats.splitX.toFixed(1)}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">決定係数 (R²):</span>
            <span class="summary-val font-bold">${reg.r2.toFixed(3)}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">${splitName}Y:</span>
            <span class="summary-val">${stats.splitY.toFixed(1)}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">回帰式:</span>
            <span class="summary-val text-mono">y=${reg.slope.toFixed(2)}x${sign}${Math.abs(reg.intercept).toFixed(2)}</span>
          </div>
        </div>
        <div class="quadrant-counts">
          <span class="q-badge q1">Q1: ${stats.quadrants.q1.length}件</span>
          <span class="q-badge q2">Q2: ${stats.quadrants.q2.length}件</span>
          <span class="q-badge q3">Q3: ${stats.quadrants.q3.length}件</span>
          <span class="q-badge q4">Q4: ${stats.quadrants.q4.length}件</span>
        </div>
      `;
    }
  }

  // テーブルデータ読み込み後の列セレクター初期化
  function applyTableData(parsedTable, fileName = '') {
    state.tableData = parsedTable;
    state.excludedRowIds.clear();
    state.labeledRowIds.clear();
    state.highlightedRowIds.clear();
    if (state.scatterPlot) {
      state.scatterPlot.resetPositions();
    }

    // 各行にユニークID _rowId を付与
    parsedTable.rows.forEach((r, idx) => {
      r._rowId = idx;
    });

    // ファイル情報バッジ表示
    elements.fileInfo.textContent = `${fileName ? fileName + ' : ' : ''}${parsedTable.totalCount} 行 / ${parsedTable.columns.length} 列 (クリックで確認)`;
    elements.fileInfo.style.display = 'inline-block';
    if (elements.btnViewDataSidebar) {
      elements.btnViewDataSidebar.style.display = 'block';
    }

    // セレクターを更新
    elements.selectLabel.innerHTML = '';
    elements.selectX.innerHTML = '';
    elements.selectY.innerHTML = '';

    parsedTable.columns.forEach(col => {
      const optL = new Option(col, col);
      elements.selectLabel.add(optL);
    });

    // 数値列を優先してX/Yの選択肢に設定
    parsedTable.columns.forEach(col => {
      const isNum = parsedTable.numericColumns.includes(col);
      const labelText = isNum ? `${col} (数値)` : col;
      
      const optX = new Option(labelText, col);
      const optY = new Option(labelText, col);
      elements.selectX.add(optX);
      elements.selectY.add(optY);
    });

    // デフォルト選択
    elements.selectLabel.value = parsedTable.labelColumn;
    elements.selectX.value = parsedTable.defaultX;
    elements.selectY.value = parsedTable.defaultY;

    // 加重平均用の属性セレクターを更新
    if (elements.selectQuadrantWeight) {
      const currentWeightVal = elements.selectQuadrantWeight.value;
      elements.selectQuadrantWeight.innerHTML = '';
      parsedTable.columns.forEach(col => {
        const isNum = parsedTable.numericColumns.includes(col);
        const labelText = isNum ? `${col} (数値)` : col;
        elements.selectQuadrantWeight.add(new Option(labelText, col));
      });

      if (currentWeightVal && parsedTable.columns.includes(currentWeightVal)) {
        elements.selectQuadrantWeight.value = currentWeightVal;
      } else {
        const preferredWeight = parsedTable.numericColumns.find(c => /人口|重み|ウェイト|weight|pop/i.test(c))
          || parsedTable.numericColumns.find(c => c !== parsedTable.defaultX && c !== parsedTable.defaultY)
          || parsedTable.numericColumns[0]
          || parsedTable.columns[0];
        if (preferredWeight) {
          elements.selectQuadrantWeight.value = preferredWeight;
        }
      }
    }

    // 軸タイトルの初期設定
    elements.xTitle.value = parsedTable.defaultX;
    elements.yTitle.value = parsedTable.defaultY;
    elements.chartTitle.value = `${parsedTable.defaultY} vs ${parsedTable.defaultX}`;

    // モーダル内の列セレクタも同期
    syncModalColumnSelectors();

    // クラスター適正数の自動判定
    updateOptimalClusterK();

    showToast(`データを読み込みました (${parsedTable.totalCount}件)`, 'success');
    redrawChart();
  }

  // モーダル内の列セレクタの選択肢と値をサイドバーと同期
  function syncModalColumnSelectors() {
    if (!state.tableData || !elements.modalSelectLabel) return;
    const { columns, numericColumns } = state.tableData;

    elements.modalSelectLabel.innerHTML = '';
    elements.modalSelectX.innerHTML = '';
    elements.modalSelectY.innerHTML = '';

    columns.forEach(col => {
      elements.modalSelectLabel.add(new Option(col, col));
    });

    columns.forEach(col => {
      const isNum = numericColumns.includes(col);
      const labelText = isNum ? `${col} (数値)` : col;
      elements.modalSelectX.add(new Option(labelText, col));
      elements.modalSelectY.add(new Option(labelText, col));
    });

    elements.modalSelectLabel.value = elements.selectLabel.value;
    elements.modalSelectX.value = elements.selectX.value;
    elements.modalSelectY.value = elements.selectY.value;
  }

  // サンプルデータの読み込み (総務省 令和7年国勢調査 表Ⅰ-2-1)
  async function loadSampleData() {
    try {
      const res = await fetch('data/sample_census2025.csv');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const table = DataParser.parseCSVText(text);
      applyTableData(table, '令和7年国勢調査 表Ⅰ-2-1 (都道府県別人口増減・密度)');

      // 1. 軸の設定: 2015-2020年増減率(X軸) vs 2020-2025年増減率(Y軸)
      const targetX = table.numericColumns.find(c => c.includes('増減率') && c.includes('2015-2020')) || table.numericColumns[0];
      const targetY = table.numericColumns.find(c => c.includes('増減率') && c.includes('2020-2025')) || table.numericColumns[1];
      if (targetX) elements.selectX.value = targetX;
      if (targetY) elements.selectY.value = targetY;

      elements.chartTitle.value = '都道府県別 人口増減率の推移 (2015-2020年 vs 2020-2025年)';
      elements.xTitle.value = '人口増減率 2015-2020年 (%)';
      elements.yTitle.value = '人口増減率 2020-2025年 (%)';
      elements.chkLine45.checked = false;
      elements.chkAspect1to1.checked = false;
      elements.chkConfidence.checked = false;
      elements.q1Label.value = 'Q1: 前期増・今期増 (維持・拡大)';
      elements.q2Label.value = 'Q2: 前期減・今期改善 (反転傾向)';
      elements.q3Label.value = 'Q3: 前期減・今期減 (減少継続)';
      elements.q4Label.value = 'Q4: 前期増・今期減 (減速傾向)';

      // 2. ラベル指定: 東北6県 + 上位5位 + 下位5位のみに付与
      state.labeledRowIds.clear();
      const tohokuPrefs = ['青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'];

      // 有効な数値行を抽出してY軸（2020-2025年増減率）順にソート
      const validRows = table.rows
        .map(r => ({ rowId: r._rowId, name: r['都道府県'], val: parseFloat(r[targetY]) }))
        .filter(r => !isNaN(r.val));
      validRows.sort((a, b) => b.val - a.val);

      const top5RowIds = validRows.slice(0, 5).map(r => r.rowId);
      const bottom5RowIds = validRows.slice(-5).map(r => r.rowId);

      // 東北6県の行ID
      const tohokuRowIds = table.rows
        .filter(r => tohokuPrefs.includes(r['都道府県']))
        .map(r => r._rowId);

      const targetLabelIds = new Set([...tohokuRowIds, ...top5RowIds, ...bottom5RowIds]);
      targetLabelIds.forEach(id => state.labeledRowIds.add(id));

      // ラベル表示モードを「個別指定のみ表示」に設定
      elements.selectLabelMode.value = 'custom';

      // 3. 強調表示: 青森県のみ強調 (★)
      state.highlightedRowIds.clear();
      const aomoriRow = table.rows.find(r => r['都道府県'] === '青森県');
      if (aomoriRow) {
        state.highlightedRowIds.add(aomoriRow._rowId);
      }

      redrawChart();
      showToast('デモデータを読み込みました（2015-2020 vs 2020-2025増減率 / 東北6県・上下5位ラベル / 青森県強調）', 'success');
    } catch (err) {
      console.error(err);
      showToast(`サンプルデータの読込に失敗しました: ${err.message}`, 'error');
    }
  }

  // 貼り付けモーダルの開閉
  function openPasteModal() {
    if (elements.pasteModal) {
      elements.pasteModal.style.display = 'flex';
      if (elements.pasteTextarea) {
        elements.pasteTextarea.value = '';
        setTimeout(() => elements.pasteTextarea.focus(), 60);
      }
    }
  }

  function closePasteModal() {
    if (elements.pasteModal) {
      elements.pasteModal.style.display = 'none';
    }
  }

  // データ入力タブ切り替え (ファイル読込 / コピペ貼り付け)
  function switchInputTab(tab) {
    const isFile = tab === 'file';
    if (elements.tabBtnFile) elements.tabBtnFile.classList.toggle('active', isFile);
    if (elements.tabBtnPaste) elements.tabBtnPaste.classList.toggle('active', !isFile);
    if (elements.paneFile) elements.paneFile.style.display = isFile ? 'block' : 'none';
    if (elements.panePaste) elements.panePaste.style.display = !isFile ? 'block' : 'none';
    if (!isFile && elements.sidebarPasteArea) {
      setTimeout(() => elements.sidebarPasteArea.focus(), 60);
    }
  }

  if (elements.tabBtnFile) {
    elements.tabBtnFile.addEventListener('click', () => switchInputTab('file'));
  }
  if (elements.tabBtnPaste) {
    elements.tabBtnPaste.addEventListener('click', () => switchInputTab('paste'));
  }

  // テキスト貼り付けデータの一括解析と取り込み
  function importPastedText(text, sourceName = '貼り付けデータ') {
    if (!text || text.trim() === '') {
      showToast('貼り付けるテキストが空です', 'warning');
      return false;
    }
    try {
      const table = DataParser.parseCSVText(text);
      if (!table || table.rows.length === 0) {
        showToast('有効な表データが見つかりませんでした', 'warning');
        return false;
      }
      applyTableData(table, sourceName);
      showToast(`${sourceName}から ${table.totalCount} 件のデータを読み込みました`, 'success');
      return true;
    } catch (err) {
      showToast(`貼り付けデータの解析に失敗しました: ${err.message}`, 'error');
      return false;
    }
  }

  // サイドバーのテキストエリアでのペースト・読み込み処理
  if (elements.sidebarPasteArea) {
    elements.sidebarPasteArea.addEventListener('paste', (e) => {
      const clip = e.clipboardData || window.clipboardData;
      if (!clip) return;
      const text = clip.getData('text');
      if (text && text.trim()) {
        setTimeout(() => {
          importPastedText(text, 'コピペデータ');
        }, 30);
      }
    });
  }

  if (elements.btnSidebarApplyPaste) {
    elements.btnSidebarApplyPaste.addEventListener('click', () => {
      const text = elements.sidebarPasteArea ? elements.sidebarPasteArea.value : '';
      importPastedText(text, '入力データ');
    });
  }

  if (elements.btnSidebarClearPaste) {
    elements.btnSidebarClearPaste.addEventListener('click', () => {
      if (elements.sidebarPasteArea) {
        elements.sidebarPasteArea.value = '';
        elements.sidebarPasteArea.focus();
      }
    });
  }

  if (elements.btnSidebarPasteClip) {
    elements.btnSidebarPasteClip.addEventListener('click', pasteFromClipboard);
  }

  // クリップボードからの貼り付け解析 (権限ブロック・非セキュア環境でも確実に動くモーダルフォールバック)
  async function pasteFromClipboard() {
    if (navigator.clipboard && navigator.clipboard.readText) {
      try {
        const text = await navigator.clipboard.readText();
        if (text && text.trim() !== '') {
          if (elements.sidebarPasteArea) {
            elements.sidebarPasteArea.value = text;
          }
          const success = importPastedText(text, 'クリップボード');
          if (success) return;
        }
      } catch (err) {
        console.warn('Clipboard readText failed or permission denied, falling back to paste modal:', err);
      }
    }
    // 権限がブロックされた場合、ブラウザ非対応、または空の場合はサイドバーのコピペタブを開いてフォーカス
    switchInputTab('paste');
    openPasteModal();
  }

  // ファイル読み込みハンドラ
  async function handleFiles(files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      const table = await DataParser.parseFile(file);
      applyTableData(table, file.name);
    } catch (err) {
      console.error(err);
      showToast(`ファイルの読み込みに失敗しました: ${err.message}`, 'error');
    }
  }

  // ドラッグ＆ドロップ設定 (サイドバー)
  if (elements.dropZone) {
    elements.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      elements.dropZone.classList.add('drag-over');
    });

    elements.dropZone.addEventListener('dragleave', () => {
      elements.dropZone.classList.remove('drag-over');
    });

    elements.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      elements.dropZone.classList.remove('drag-over');
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    });

    elements.dropZone.addEventListener('click', () => {
      elements.fileInput.click();
    });
  }

  // ドラッグ＆ドロップ & クリック設定 (Empty State 内のファイルボックス)
  if (elements.emptyFileBox) {
    elements.emptyFileBox.addEventListener('dragover', (e) => {
      e.preventDefault();
      elements.emptyFileBox.classList.add('drag-over');
    });

    elements.emptyFileBox.addEventListener('dragleave', () => {
      elements.emptyFileBox.classList.remove('drag-over');
    });

    elements.emptyFileBox.addEventListener('drop', (e) => {
      e.preventDefault();
      elements.emptyFileBox.classList.remove('drag-over');
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    });

    elements.emptyFileBox.addEventListener('click', () => {
      elements.fileInput.click();
    });
  }

  if (elements.btnEmptyFileSelect) {
    elements.btnEmptyFileSelect.addEventListener('click', (e) => {
      e.stopPropagation();
      elements.fileInput.click();
    });
  }

  // Empty State 内のコピペボックス設定
  if (elements.emptyPasteBox) {
    elements.emptyPasteBox.addEventListener('click', () => {
      switchInputTab('paste');
      pasteFromClipboard();
    });
  }

  if (elements.btnEmptyPasteDirect) {
    elements.btnEmptyPasteDirect.addEventListener('click', (e) => {
      e.stopPropagation();
      pasteFromClipboard();
    });
  }

  elements.fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  });

  // ショートカット: 画面全体へのペースト (Ctrl+V)
  window.addEventListener('paste', (e) => {
    // 別の入力フィールドにフォーカスがある時はそちらの標準挙動を妨げない
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const clip = e.clipboardData || window.clipboardData;
    if (!clip) return;
    const text = clip.getData('text');
    if (text && text.trim()) {
      if (elements.sidebarPasteArea) {
        elements.sidebarPasteArea.value = text;
      }
      importPastedText(text, '貼り付けデータ');
    }
  });

  elements.btnSample.addEventListener('click', loadSampleData);
  if (elements.btnSampleEmpty) elements.btnSampleEmpty.addEventListener('click', loadSampleData);
  if (elements.btnPaste) elements.btnPaste.addEventListener('click', pasteFromClipboard);

  // 列選択変更イベント
  elements.selectLabel.addEventListener('change', redrawChart);
  elements.selectX.addEventListener('change', () => {
    elements.xTitle.value = elements.selectX.value;
    elements.chartTitle.value = `${elements.selectY.value} vs ${elements.selectX.value}`;
    updateOptimalClusterK();
    redrawChart();
  });
  elements.selectY.addEventListener('change', () => {
    elements.yTitle.value = elements.selectY.value;
    elements.chartTitle.value = `${elements.selectY.value} vs ${elements.selectX.value}`;
    updateOptimalClusterK();
    redrawChart();
  });

  // タイトル入力変更イベント
  [elements.chartTitle, elements.xTitle, elements.yTitle].forEach(input => {
    input.addEventListener('input', redrawChart);
  });

  // 4象限分割基準の用途ガイド・ヒント文
  const QUADRANT_SPLIT_HINTS = {
    mean: '💡 基本・標準：全体バランスを把握したいときに最適',
    median: '💡 外れ値対策：極端な大企業・大都市があるときや、上下半々に分けたいとき',
    geometric: '💡 比率・倍率：前年比や売上成長率など「掛け算で変化する指標」のとき',
    weighted: '💡 規模の重心：売上や人口などの「規模の差」を加味した実勢値で見たいとき'
  };

  // 分割基準のヒント更新
  function updateQuadrantSplitHint() {
    if (!elements.quadrantSplitHint || !elements.quadrantSplitType) return;
    const type = elements.quadrantSplitType.value;
    elements.quadrantSplitHint.textContent = QUADRANT_SPLIT_HINTS[type] || '';
  }

  // 加重平均ウェイト属性選択の表示・非表示制御
  function updateQuadrantWeightVisibility() {
    if (!elements.groupQuadrantWeight) return;
    const isWeighted = elements.quadrantSplitType.value === 'weighted';
    elements.groupQuadrantWeight.style.display = isWeighted ? 'block' : 'none';
  }

  // 補助線チェックボックス・設定変更
  [
    elements.chkQuadrant,
    elements.quadrantSplitType,
    elements.selectQuadrantWeight,
    elements.chkQuadrantBg,
    elements.chkQuadrantColorPoints,
    elements.chkLine45,
    elements.chkAspect1to1,
    elements.chkRegression,
    elements.chkRegressionEq,
    elements.chkConfidence,
    elements.selectLabelMode,
    elements.selectTheme,
    elements.chkShowCentroids,
    elements.chkShowHulls
  ].filter(Boolean).forEach(ctrl => {
    ctrl.addEventListener('change', redrawChart);
  });

  // 分割基準変更時の表示切替および幾何平均選択時の警告通知
  elements.quadrantSplitType.addEventListener('change', () => {
    updateQuadrantWeightVisibility();
    updateQuadrantSplitHint();
    if (elements.quadrantSplitType.value === 'geometric' && state.currentStats) {
      if (state.currentStats.geomX === null || state.currentStats.geomY === null) {
        showToast('データに0以下の値が含まれているため、幾何平均の代わりに平均値を表示しています', 'info');
      }
    }
  });

  [elements.q1Label, elements.q2Label, elements.q3Label, elements.q4Label].forEach(input => {
    input.addEventListener('input', redrawChart);
  });

  // クラスター分析モード切り替え & ステッパー制御
  if (elements.chkClusterMode) {
    elements.chkClusterMode.addEventListener('change', () => {
      const isEnabled = elements.chkClusterMode.checked;
      if (elements.clusterOptions) {
        elements.clusterOptions.style.display = isEnabled ? 'block' : 'none';
      }

      if (isEnabled) {
        // クラスター分析時は全体回帰直線は意味をなさないため自動的にチェックを解除
        if (state._prevRegressionChecked === undefined) {
          state._prevRegressionChecked = elements.chkRegression.checked;
        }
        if (elements.chkRegression.checked) {
          elements.chkRegression.checked = false;
        }
        if (elements.chkRegressionEq) {
          elements.chkRegressionEq.checked = false;
        }
        if (elements.chkConfidence) {
          elements.chkConfidence.checked = false;
        }
        updateOptimalClusterK();
      } else {
        // クラスター分析解除時に元の回帰直線状態を復元
        if (state._prevRegressionChecked) {
          elements.chkRegression.checked = true;
        }
        state._prevRegressionChecked = undefined;
      }
      redrawChart();
    });
  }

  const handleClusterKChange = (delta) => {
    if (!elements.inputClusterK) return;
    let k = parseInt(elements.inputClusterK.value, 10) || 3;
    k = Math.max(2, Math.min(8, k + delta));
    elements.inputClusterK.value = k;
    elements.inputClusterK.dataset.userModified = 'true';
    redrawChart();
  };

  if (elements.btnClusterMinus) {
    elements.btnClusterMinus.addEventListener('click', () => handleClusterKChange(-1));
  }
  if (elements.btnClusterPlus) {
    elements.btnClusterPlus.addEventListener('click', () => handleClusterKChange(1));
  }
  if (elements.inputClusterK) {
    elements.inputClusterK.addEventListener('change', () => {
      let k = parseInt(elements.inputClusterK.value, 10) || 3;
      k = Math.max(2, Math.min(8, k));
      elements.inputClusterK.value = k;
      elements.inputClusterK.dataset.userModified = 'true';
      redrawChart();
    });
  }

  // スライダー変更イベント
  elements.rangePointSize.addEventListener('input', (e) => {
    elements.valPointSize.textContent = `${e.target.value}px`;
    redrawChart();
  });

  elements.rangeOpacity.addEventListener('input', (e) => {
    elements.valOpacity.textContent = `${Math.round(e.target.value * 100)}%`;
    redrawChart();
  });

  elements.rangeFontSize.addEventListener('input', (e) => {
    elements.valFontSize.textContent = `${e.target.value}px`;
    redrawChart();
  });

  // ラベル位置・回帰式バッジ・サイズ・表示状態を初期状態に戻す
  function resetPositionsAndSizes() {
    if (!state.scatterPlot) return;

    // 1. ラベルおよび回帰式バッジの手動移動をリセット
    state.scatterPlot.resetPositions();

    // 2. スタイル・サイズ設定を初期標準値に復元
    elements.rangePointSize.value = 6;
    elements.valPointSize.textContent = '6px';
    elements.rangeOpacity.value = 0.75;
    elements.valOpacity.textContent = '75%';
    elements.rangeFontSize.value = 11;
    elements.valFontSize.textContent = '11px';

    // 3. 全画面表示中なら通常表示に戻す
    if (elements.chartCard && elements.chartCard.classList.contains('maximized')) {
      elements.chartCard.classList.remove('maximized');
      if (elements.btnMaximizeChart) {
        elements.btnMaximizeChart.textContent = '⛶ 全画面表示';
        elements.btnMaximizeChart.title = '散布図を全画面に最大化表示します (Escキーで元に戻す)';
      }
    }

    // 4. 再描画実行
    redrawChart();
    showToast('位置とサイズを初期状態に戻しました', 'success');
  }

  if (elements.btnResetView) {
    elements.btnResetView.addEventListener('click', resetPositionsAndSizes);
  }
  if (elements.btnResetLabels) {
    elements.btnResetLabels.addEventListener('click', resetPositionsAndSizes);
  }

  // エクスポート: SVGダウンロード (見たままの形で保存)
  const handleSaveSVG = () => {
    if (!state.scatterPlot) return;
    const title = elements.chartTitle.value.trim() || 'scatter_plot';
    const ok = state.scatterPlot.downloadSVG(`${title}.svg`);
    if (ok) {
      showToast('見たままの形でSVG保存しました (ベクター画像)', 'success');
    } else {
      showToast('保存できるグラフがありません', 'warning');
    }
  };

  // エクスポート: PNGダウンロード (見たままの形・解像度で保存)
  const handleSavePNG = async () => {
    if (!state.scatterPlot) return;
    const title = elements.chartTitle.value.trim() || 'scatter_plot';
    const res = await state.scatterPlot.downloadPNG(`${title}.png`, 2);
    if (res) {
      showToast(`見たままの形で高解像度PNG保存しました (${res.width}×${res.height})`, 'success');
    } else {
      showToast('保存できるグラフがありません', 'warning');
    }
  };

  // エクスポート: 画像をクリップボードにコピー (見たままの形でコピー)
  const handleCopyPNG = async () => {
    if (!state.scatterPlot) return;
    try {
      const res = await state.scatterPlot.copyPNGToClipboard(2);
      const sizeInfo = res ? ` (${res.width}×${res.height})` : '';
      showToast(`見たままの形の高解像度画像をコピーしました！${sizeInfo} そのまま貼り付けできます`, 'success');
    } catch (err) {
      showToast(`コピーに失敗しました: ${err.message}`, 'error');
    }
  };

  if (elements.btnSaveSVG) elements.btnSaveSVG.addEventListener('click', handleSaveSVG);
  if (elements.btnSavePNG) elements.btnSavePNG.addEventListener('click', handleSavePNG);
  if (elements.btnCopyPNG) elements.btnCopyPNG.addEventListener('click', handleCopyPNG);

  // エクスポート: 集計サマリーのテキストコピー
  elements.btnCopySummary.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!state.currentStats) {
      showToast('データがありません', 'warning');
      return;
    }
    const s = state.currentStats;
    const reg = s.regression;
    const xKey = elements.selectX.value;
    const yKey = elements.selectY.value;
    const sign = reg.intercept >= 0 ? '+' : '-';

    const geomXStr = s.geomX !== null ? s.geomX.toFixed(2) : '計算不可(<=0)';
    const geomYStr = s.geomY !== null ? s.geomY.toFixed(2) : '計算不可(<=0)';
    const weightedXStr = s.weightedX !== null ? `, 加重平均=${s.weightedX.toFixed(2)}` : '';
    const weightedYStr = s.weightedY !== null ? `, 加重平均=${s.weightedY.toFixed(2)}` : '';

    let text = `【散布図集計サマリー】\n`;
    text += `タイトル: ${elements.chartTitle.value}\n`;
    text += `X軸: ${xKey} / Y軸: ${yKey}\n`;
    text += `サンプル数: ${s.totalCount}\n`;

    if (s.isCluster && s.clusterResult) {
      text += `分析モード: クラスター分析 (K-Means, k=${s.clusterResult.clusters.length})\n`;
      text += `X軸: 平均=${s.meanX.toFixed(2)}, 標準偏差=${s.stdX.toFixed(2)}\n`;
      text += `Y軸: 平均=${s.meanY.toFixed(2)}, 標準偏差=${s.stdY.toFixed(2)}\n\n`;

      s.clusterResult.clusters.forEach(c => {
        text += `【クラスター${c.id + 1}】 ${c.points.length}件 (重心: Zx=${c.centroid.x >= 0 ? '+' : ''}${c.centroid.x.toFixed(2)}σ, Zy=${c.centroid.y >= 0 ? '+' : ''}${c.centroid.y.toFixed(2)}σ):\n`;
        text += c.points.map(p => p.name).join(', ') + '\n';
      });
    } else {
      text += `X軸: 平均=${s.meanX.toFixed(2)}, 中央値=${s.medianX.toFixed(2)}, 幾何平均=${geomXStr}${weightedXStr}, 標準偏差=${s.stdX.toFixed(2)}\n`;
      text += `Y軸: 平均=${s.meanY.toFixed(2)}, 中央値=${s.medianY.toFixed(2)}, 幾何平均=${geomYStr}${weightedYStr}, 標準偏差=${s.stdY.toFixed(2)}\n`;
      text += `相関係数 (r): ${reg.r.toFixed(4)}\n`;
      text += `決定係数 (R²): ${reg.r2.toFixed(4)}\n`;
      text += `1次回帰式: y = ${reg.slope.toFixed(4)}x ${sign} ${Math.abs(reg.intercept).toFixed(4)}\n\n`;

      text += `【第1象限 (${elements.q1Label.value})】 ${s.quadrants.q1.length}件: `;
      text += s.quadrants.q1.map(r => r._name).join(', ') + '\n';
      text += `【第2象限 (${elements.q2Label.value})】 ${s.quadrants.q2.length}件: `;
      text += s.quadrants.q2.map(r => r._name).join(', ') + '\n';
      text += `【第3象限 (${elements.q3Label.value})】 ${s.quadrants.q3.length}件: `;
      text += s.quadrants.q3.map(r => r._name).join(', ') + '\n';
      text += `【第4象限 (${elements.q4Label.value})】 ${s.quadrants.q4.length}件: `;
      text += s.quadrants.q4.map(r => r._name).join(', ') + '\n';
    }

    try {
      await navigator.clipboard.writeText(text);
      showToast('集計サマリーテキストをコピーしました', 'success');
    } catch (err) {
      showToast(`コピーに失敗しました: ${err.message}`, 'error');
    }
  });

  // サマリーホバーウィジェットのクリック固定/解除トグル
  if (elements.summaryHoverTrigger && elements.summaryHoverWidget) {
    elements.summaryHoverTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      elements.summaryHoverWidget.classList.toggle('is-open');
    });

    document.addEventListener('click', (e) => {
      if (!elements.summaryHoverWidget.contains(e.target)) {
        elements.summaryHoverWidget.classList.remove('is-open');
      }
    });
  }

  // サイドバーの開閉 (折りたたみによるグラフ拡大)
  if (elements.btnToggleSidebar && elements.sidebar) {
    elements.btnToggleSidebar.addEventListener('click', () => {
      const isCollapsed = elements.sidebar.classList.toggle('collapsed');
      elements.btnToggleSidebar.textContent = isCollapsed ? '▶ パネルを開く' : '◀ パネルを隠す';
      elements.btnToggleSidebar.title = isCollapsed
        ? '設定パネルを表示します'
        : '設定パネルを折りたたんで散布図を横いっぱいに拡大表示します';
      setTimeout(() => {
        redrawChart();
      }, 240);
    });
  }

  // 散布図の全画面最大化表示
  if (elements.btnMaximizeChart && elements.chartCard) {
    elements.btnMaximizeChart.addEventListener('click', () => {
      const isMaximized = elements.chartCard.classList.toggle('maximized');
      elements.btnMaximizeChart.textContent = isMaximized ? '🗗 元に戻す' : '⛶ 全画面表示';
      elements.btnMaximizeChart.title = isMaximized
        ? '元の表示サイズに戻します (Escキーでも解除可能)'
        : '散布図を全画面に最大化表示します (Escキーで元に戻す)';
      setTimeout(() => {
        redrawChart();
      }, 240);
    });

    // Escキーで全画面解除
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && elements.chartCard.classList.contains('maximized')) {
        elements.chartCard.classList.remove('maximized');
        elements.btnMaximizeChart.textContent = '⛶ 全画面表示';
        setTimeout(() => {
          redrawChart();
        }, 240);
      }
    });
  }

  // コンテナのサイズ変化・リサイズ監視 (自動的に大きくフィット)
  let resizeTimer = null;
  const onResize = () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      redrawChart();
    }, 120);
  };

  if (window.ResizeObserver && elements.chartContainer) {
    const ro = new ResizeObserver(() => {
      onResize();
    });
    ro.observe(elements.chartContainer);
  } else {
    window.addEventListener('resize', onResize);
  }

  // ヘッダー全選択チェックボックスの状態を同期
  function syncHeaderCheckbox() {
    if (!state.tableData) return;
    const total = state.tableData.rows.length;
    const chkHeader = document.getElementById('chkHeaderSelectAll');
    if (chkHeader) {
      const excluded = state.excludedRowIds.size;
      chkHeader.checked = total > 0 && excluded === 0;
      chkHeader.indeterminate = excluded > 0 && excluded < total;
    }
    const chkHeaderLabels = document.getElementById('chkHeaderSelectAllLabels');
    if (chkHeaderLabels) {
      const labeled = state.labeledRowIds.size;
      chkHeaderLabels.checked = total > 0 && labeled === total;
      chkHeaderLabels.indeterminate = labeled > 0 && labeled < total;
    }
  }

  // モーダル件数・状態カウント表示の更新
  function updateModalCount(filteredCount = null) {
    if (!state.tableData) return;
    const total = state.tableData.rows.length;
    const active = total - state.excludedRowIds.size;
    const labeled = state.labeledRowIds.size;
    const hl = state.highlightedRowIds.size;
    let countToShow = filteredCount;
    if (countToShow === null && elements.modalSearch && elements.modalSearch.value.trim() !== '') {
      countToShow = elements.dataTableBody.querySelectorAll('tr[data-row-id]').length;
    }
    const filterInfo = (countToShow !== null && countToShow !== total) ? ` (一致: ${countToShow}件)` : '';
    elements.modalDataCount.textContent = `作図対象: ${active}/${total}件 | 🏷️ラベル: ${labeled}件 | ★強調: ${hl}件${filterInfo}`;
    syncHeaderCheckbox();
  }

  // データ確認モーダルの開閉と表示制御
  function openDataModal() {
    if (!state.tableData) {
      showToast('データが読み込まれていません', 'warning');
      return;
    }
    syncModalColumnSelectors();
    renderDataTable(elements.modalSearch ? elements.modalSearch.value : '');
    elements.dataModal.style.display = 'flex';
    if (elements.modalSearch) {
      elements.modalSearch.focus();
    }
  }

  function closeDataModal() {
    if (elements.dataModal) {
      elements.dataModal.style.display = 'none';
    }
  }

  // データテーブルのレンダリング (検索フィルタ・作図対象・強調対応)
  function renderDataTable(filterText = '') {
    if (!state.tableData) return;
    const { columns, rows, numericColumns } = state.tableData;
    const q = filterText.trim().toLowerCase();

    // フィルタリング
    const filteredRows = q
      ? rows.filter(r => columns.some(col => String(r[col] || '').toLowerCase().includes(q)))
      : rows;

    updateModalCount(filteredRows.length);

    const currentLabel = elements.selectLabel.value;
    const currentX = elements.selectX.value;
    const currentY = elements.selectY.value;

    const allActive = rows.length > 0 && state.excludedRowIds.size === 0;
    const allLabeled = rows.length > 0 && rows.every(r => state.labeledRowIds.has(r._rowId));

    // ヘッダー作成 (作図チェック、ラベルチェック、強調チェック、行番号、各列)
    let headHtml = '<tr>';
    headHtml += `<th class="chk-col-header" title="すべて作図対象にする / 除外する"><input type="checkbox" id="chkHeaderSelectAll" ${allActive ? 'checked' : ''} style="cursor: pointer; width: 15px; height: 15px;"></th>`;
    headHtml += `<th class="chk-col-header" title="個別ラベルを一括選択 / 全解除"><input type="checkbox" id="chkHeaderSelectAllLabels" ${allLabeled ? 'checked' : ''} style="cursor: pointer; width: 15px; height: 15px; accent-color: #0284c7;"></th>`;
    headHtml += `<th class="chk-col-header" title="図上で強調表示 (ハイライト)">★</th>`;
    headHtml += '<th class="row-num-cell">#</th>';

    columns.forEach(col => {
      const isNum = numericColumns.includes(col);
      let roleTag = '';
      if (col === currentX) roleTag = '<span class="col-role-tag role-x">X軸</span>';
      else if (col === currentY) roleTag = '<span class="col-role-tag role-y">Y軸</span>';
      else if (col === currentLabel) roleTag = '<span class="col-role-tag role-label">名称</span>';

      headHtml += `<th class="${isNum ? 'num-col' : ''}">${escapeHtml(col)}${roleTag}</th>`;
    });
    headHtml += '</tr>';
    elements.dataTableHead.innerHTML = headHtml;

    // ヘッダー全選択チェックボックスのイベント登録
    const chkHeader = document.getElementById('chkHeaderSelectAll');
    if (chkHeader) {
      chkHeader.addEventListener('change', (e) => {
        if (e.target.checked) {
          state.excludedRowIds.clear();
        } else {
          rows.forEach(r => state.excludedRowIds.add(r._rowId));
        }
        renderDataTable(elements.modalSearch ? elements.modalSearch.value : '');
        redrawChart();
      });
    }

    // ヘッダーラベル全選択チェックボックスのイベント登録
    const chkHeaderLabels = document.getElementById('chkHeaderSelectAllLabels');
    if (chkHeaderLabels) {
      chkHeaderLabels.addEventListener('change', (e) => {
        if (e.target.checked) {
          rows.forEach(r => state.labeledRowIds.add(r._rowId));
        } else {
          state.labeledRowIds.clear();
        }
        renderDataTable(elements.modalSearch ? elements.modalSearch.value : '');
        redrawChart();
      });
    }

    // ボディ作成
    if (filteredRows.length === 0) {
      elements.dataTableBody.innerHTML = `<tr><td colspan="${columns.length + 4}" style="text-align: center; padding: 24px; color: #94a3b8;">一致するデータが見つかりませんでした</td></tr>`;
      return;
    }

    let bodyHtml = '';
    filteredRows.forEach(r => {
      const isPlot = !state.excludedRowIds.has(r._rowId);
      const isLabeled = state.labeledRowIds.has(r._rowId);
      const isHl = state.highlightedRowIds.has(r._rowId);
      const rowClasses = [];
      if (!isPlot) rowClasses.push('row-excluded');
      if (isHl) rowClasses.push('row-highlighted');

      bodyHtml += `<tr class="${rowClasses.join(' ')}" data-row-id="${r._rowId}">`;
      bodyHtml += `<td class="chk-cell"><input type="checkbox" class="chk-row-plot" data-row-id="${r._rowId}" ${isPlot ? 'checked' : ''} title="作図対象に含める"></td>`;
      bodyHtml += `<td class="chk-cell"><input type="checkbox" class="chk-row-label" data-row-id="${r._rowId}" ${isLabeled ? 'checked' : ''} title="個別ラベルを表示"></td>`;
      bodyHtml += `<td class="chk-cell"><input type="checkbox" class="chk-row-highlight" data-row-id="${r._rowId}" ${isHl ? 'checked' : ''} title="図上で強調表示"></td>`;
      bodyHtml += `<td class="row-num-cell">${r._rowId + 1}</td>`;

      columns.forEach(col => {
        const val = r[col];
        const isNum = numericColumns.includes(col);
        let displayVal = '';
        if (typeof val === 'number') {
          displayVal = Number.isFinite(val) ? val.toLocaleString() : '-';
        } else if (val !== undefined && val !== null) {
          displayVal = escapeHtml(val);
        }
        bodyHtml += `<td class="${isNum ? 'num-cell' : ''}">${displayVal}</td>`;
      });
      bodyHtml += '</tr>';
    });
    elements.dataTableBody.innerHTML = bodyHtml;
    syncHeaderCheckbox();
  }

  // テーブル内チェックボックスイベント (委譲ハンドラ)
  if (elements.dataTableBody) {
    elements.dataTableBody.addEventListener('change', (e) => {
      const target = e.target;
      if (!target) return;

      const rowId = parseInt(target.dataset.rowId, 10);
      if (isNaN(rowId)) return;

      const tr = target.closest('tr');

      if (target.classList.contains('chk-row-plot')) {
        if (target.checked) {
          state.excludedRowIds.delete(rowId);
          if (tr) tr.classList.remove('row-excluded');
        } else {
          state.excludedRowIds.add(rowId);
          if (tr) tr.classList.add('row-excluded');
        }
        updateModalCount();
        redrawChart();
      } else if (target.classList.contains('chk-row-label')) {
        if (target.checked) {
          state.labeledRowIds.add(rowId);
        } else {
          state.labeledRowIds.delete(rowId);
        }
        updateModalCount();
        redrawChart();
      } else if (target.classList.contains('chk-row-highlight')) {
        if (target.checked) {
          state.highlightedRowIds.add(rowId);
          if (tr) tr.classList.add('row-highlighted');
        } else {
          state.highlightedRowIds.delete(rowId);
          if (tr) tr.classList.remove('row-highlighted');
        }
        updateModalCount();
        redrawChart();
      }
    });
  }

  // モーダル内作図列セレクタのイベント
  if (elements.modalSelectLabel) {
    elements.modalSelectLabel.addEventListener('change', () => {
      elements.selectLabel.value = elements.modalSelectLabel.value;
      redrawChart();
      renderDataTable(elements.modalSearch ? elements.modalSearch.value : '');
    });
  }

  if (elements.modalSelectX) {
    elements.modalSelectX.addEventListener('change', () => {
      elements.selectX.value = elements.modalSelectX.value;
      elements.xTitle.value = elements.modalSelectX.value;
      elements.chartTitle.value = `${elements.selectY.value} vs ${elements.selectX.value}`;
      redrawChart();
      renderDataTable(elements.modalSearch ? elements.modalSearch.value : '');
    });
  }

  if (elements.modalSelectY) {
    elements.modalSelectY.addEventListener('change', () => {
      elements.selectY.value = elements.modalSelectY.value;
      elements.yTitle.value = elements.modalSelectY.value;
      elements.chartTitle.value = `${elements.selectY.value} vs ${elements.selectX.value}`;
      redrawChart();
      renderDataTable(elements.modalSearch ? elements.modalSearch.value : '');
    });
  }

  // サイドバーの列セレクタが変更されたらモーダル側も同期
  [elements.selectLabel, elements.selectX, elements.selectY].forEach(el => {
    if (el) {
      el.addEventListener('change', () => {
        syncModalColumnSelectors();
      });
    }
  });

  // モーダル内一括操作ボタン
  if (elements.btnModalSelectAll) {
    elements.btnModalSelectAll.addEventListener('click', () => {
      if (!state.tableData) return;
      state.excludedRowIds.clear();
      renderDataTable(elements.modalSearch ? elements.modalSearch.value : '');
      redrawChart();
      showToast('すべての行を作図対象に設定しました', 'info');
    });
  }

  if (elements.btnModalDeselectAll) {
    elements.btnModalDeselectAll.addEventListener('click', () => {
      if (!state.tableData) return;
      state.tableData.rows.forEach(r => state.excludedRowIds.add(r._rowId));
      renderDataTable(elements.modalSearch ? elements.modalSearch.value : '');
      redrawChart();
      showToast('すべての行を作図対象から除外しました', 'info');
    });
  }

  if (elements.btnModalClearLabels) {
    elements.btnModalClearLabels.addEventListener('click', () => {
      if (!state.tableData) return;
      state.labeledRowIds.clear();
      renderDataTable(elements.modalSearch ? elements.modalSearch.value : '');
      redrawChart();
      showToast('個別ラベルの指定をすべてクリアしました', 'info');
    });
  }

  if (elements.btnModalClearHighlight) {
    elements.btnModalClearHighlight.addEventListener('click', () => {
      if (!state.tableData) return;
      state.highlightedRowIds.clear();
      renderDataTable(elements.modalSearch ? elements.modalSearch.value : '');
      redrawChart();
      showToast('すべての強調表示を解除しました', 'info');
    });
  }

  // データ確認メニューボタンのイベント
  if (elements.btnViewData) elements.btnViewData.addEventListener('click', openDataModal);
  if (elements.btnViewDataSidebar) elements.btnViewDataSidebar.addEventListener('click', openDataModal);
  if (elements.fileInfo) {
    elements.fileInfo.style.cursor = 'pointer';
    elements.fileInfo.addEventListener('click', openDataModal);
  }
  if (elements.btnCloseModal) elements.btnCloseModal.addEventListener('click', closeDataModal);

  // モーダル背景クリックで閉じる
  if (elements.dataModal) {
    elements.dataModal.addEventListener('click', (e) => {
      if (e.target === elements.dataModal) closeDataModal();
    });
  }

  // 貼り付けモーダル操作イベント
  if (elements.btnApplyPaste) {
    elements.btnApplyPaste.addEventListener('click', () => {
      const text = elements.pasteTextarea ? elements.pasteTextarea.value : '';
      if (!text || text.trim() === '') {
        showToast('貼り付けるデータが入力されていません', 'warning');
        return;
      }
      try {
        const table = DataParser.parseCSVText(text);
        applyTableData(table, '貼り付けデータ');
        closePasteModal();
        showToast(`データを読み込みました (${table.totalCount}件)`, 'success');
      } catch (err) {
        showToast(`データの解析に失敗しました: ${err.message}`, 'error');
      }
    });
  }

  if (elements.btnClosePasteModal) elements.btnClosePasteModal.addEventListener('click', closePasteModal);
  if (elements.btnCancelPaste) elements.btnCancelPaste.addEventListener('click', closePasteModal);
  if (elements.pasteModal) {
    elements.pasteModal.addEventListener('click', (e) => {
      if (e.target === elements.pasteModal) closePasteModal();
    });
  }

  // テーブル内リアルタイム検索
  if (elements.modalSearch) {
    elements.modalSearch.addEventListener('input', (e) => {
      renderDataTable(e.target.value);
    });
  }

  // 表データをCSV形式でクリップボードにコピー
  if (elements.btnCopyTableCSV) {
    elements.btnCopyTableCSV.addEventListener('click', async () => {
      if (!state.tableData) return;
      const { columns, rows } = state.tableData;
      const escapeCsvCell = (v) => {
        if (v === undefined || v === null || (typeof v === 'number' && !Number.isFinite(v))) return '';
        const s = String(v);
        return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      let csv = columns.map(escapeCsvCell).join(',') + '\n';
      rows.forEach(r => {
        const line = columns.map(c => escapeCsvCell(r[c])).join(',');
        csv += line + '\n';
      });
      try {
        await navigator.clipboard.writeText(csv);
        showToast('テーブルデータをCSV形式でコピーしました', 'success');
      } catch (err) {
        showToast('コピーに失敗しました', 'error');
      }
    });
  }

  // Escキーでモーダルも閉じる
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (elements.dataModal && elements.dataModal.style.display !== 'none') {
        closeDataModal();
      }
      if (elements.pasteModal && elements.pasteModal.style.display !== 'none') {
        closePasteModal();
      }
    }
  });

  // 初回起動時のUI状態初期化
  updateQuadrantWeightVisibility();
  updateQuadrantSplitHint();

  // 初回起動: 自動作図は行わず、ユーザーのデータ入力・選択を待機
});
