/**
 * app.js - アプリケーション メインコントローラー
 * UI連携、ファイル読込、イベントバインド、エクスポート
 */

document.addEventListener('DOMContentLoaded', () => {
  // アプリケーション状態
  const state = {
    tableData: null,
    scatterPlot: null,
    currentStats: null
  };

  // DOM要素の参照取得
  const elements = {
    // ファイル入力
    dropZone: document.getElementById('dropZone'),
    fileInput: document.getElementById('fileInput'),
    btnSample: document.getElementById('btnSample'),
    btnPaste: document.getElementById('btnPaste'),
    fileInfo: document.getElementById('fileInfo'),

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
    chkQuadrantBg: document.getElementById('chkQuadrantBg'),
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

    // ラベル設定
    selectLabelMode: document.getElementById('selectLabelMode'),
    chkLeaderLines: document.getElementById('chkLeaderLines'),
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

    // データ確認モーダル
    btnViewData: document.getElementById('btnViewData'),
    btnViewDataSidebar: document.getElementById('btnViewDataSidebar'),
    dataModal: document.getElementById('dataModal'),
    btnCloseModal: document.getElementById('btnCloseModal'),
    modalDataCount: document.getElementById('modalDataCount'),
    modalSearch: document.getElementById('modalSearch'),
    btnCopyTableCSV: document.getElementById('btnCopyTableCSV'),
    dataTableHead: document.getElementById('dataTableHead'),
    dataTableBody: document.getElementById('dataTableBody'),

    // サマリーエリア
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
      showQuadrantBg: elements.chkQuadrantBg.checked,
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
      labelMode: elements.selectLabelMode.value,
      showLeaderLines: elements.chkLeaderLines.checked
    };
  }

  // グラフ再描画
  function redrawChart() {
    if (!state.tableData) return;

    const labelKey = elements.selectLabel.value;
    const xKey = elements.selectX.value;
    const yKey = elements.selectY.value;

    if (!xKey || !yKey) return;

    const options = getPlotOptions();
    state.currentStats = state.scatterPlot.render({
      rows: state.tableData.rows,
      labelKey,
      xKey,
      yKey
    }, options);

    updateSummaryDisplay(state.currentStats, xKey, yKey);
  }

  // 統計サマリーのHTML表示更新
  function updateSummaryDisplay(stats, xKey, yKey) {
    if (!stats) {
      elements.summaryContent.innerHTML = '<span class="text-muted">データが読み込まれていません。</span>';
      return;
    }

    const reg = stats.regression;
    const sign = reg.intercept >= 0 ? '+' : '-';
    const splitName = elements.quadrantSplitType.value === 'median' ? '中央値' : '平均値';

    elements.summaryContent.innerHTML = `
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-label">サンプル数:</span>
          <span class="summary-val">${stats.totalCount}件</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">${splitName}X:</span>
          <span class="summary-val">${stats.splitX.toFixed(1)}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">${splitName}Y:</span>
          <span class="summary-val">${stats.splitY.toFixed(1)}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">相関 (r):</span>
          <span class="summary-val ${Math.abs(reg.r) > 0.6 ? 'text-primary' : ''}">${reg.r.toFixed(3)}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">決定係数 (R²):</span>
          <span class="summary-val font-bold">${reg.r2.toFixed(3)}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">回帰式:</span>
          <span class="summary-val text-mono">y = ${reg.slope.toFixed(2)}x ${sign} ${Math.abs(reg.intercept).toFixed(2)}</span>
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

  // テーブルデータ読み込み後の列セレクター初期化
  function applyTableData(parsedTable, fileName = '') {
    state.tableData = parsedTable;

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

    // 軸タイトルの初期設定
    elements.xTitle.value = parsedTable.defaultX;
    elements.yTitle.value = parsedTable.defaultY;
    elements.chartTitle.value = `${parsedTable.defaultY} vs ${parsedTable.defaultX}`;

    showToast(`データを読み込みました (${parsedTable.totalCount}件)`, 'success');
    redrawChart();
  }

  // サンプルデータの読み込み (総務省 令和7年国勢調査 表Ⅰ-2-1)
  async function loadSampleData() {
    try {
      const res = await fetch('data/sample_census2025.csv');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const table = DataParser.parseCSVText(text);
      applyTableData(table, '令和7年国勢調査 表Ⅰ-2-1 (都道府県別人口増減・密度)');

      // サンプル散布図の初期分析軸 (人口増減率 vs 人口密度) を明示設定
      const targetX = table.numericColumns.find(c => c.includes('増減率') && c.includes('2020-2025')) || table.numericColumns[0];
      const targetY = table.numericColumns.find(c => c.includes('密度')) || table.numericColumns[1];
      if (targetX) elements.selectX.value = targetX;
      if (targetY) elements.selectY.value = targetY;

      elements.chartTitle.value = '令和7年国勢調査 都道府県別 人口密度 vs 人口増減率';
      elements.xTitle.value = targetX || '人口増減率 (%) [2020年〜2025年]';
      elements.yTitle.value = targetY || '人口密度 (人/km²)';
      elements.q1Label.value = 'Q1: 高密度・増加/高維持 (大都市圏)';
      elements.q2Label.value = 'Q2: 高密度・人口減少 (都市圏)';
      elements.q3Label.value = 'Q3: 低密度・人口減少 (地方過疎圏)';
      elements.q4Label.value = 'Q4: 低密度・善戦/緩縮 (地方中核・沖縄等)';
      redrawChart();
    } catch (err) {
      console.error(err);
      showToast(`サンプルデータの読込に失敗しました: ${err.message}`, 'error');
    }
  }

  // クリップボードからの貼り付け解析
  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || text.trim() === '') {
        showToast('クリップボードにテキストがありません。', 'warning');
        return;
      }
      const table = DataParser.parseCSVText(text);
      applyTableData(table, 'クリップボード');
    } catch (err) {
      showToast(`貼り付けに失敗しました: ${err.message}`, 'error');
    }
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

  // ドラッグ＆ドロップ設定
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

  elements.fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  });

  // ショートカット: 画面全体へのペースト (Ctrl+V)
  window.addEventListener('paste', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (text && text.trim()) {
      try {
        const table = DataParser.parseCSVText(text);
        applyTableData(table, '貼り付けデータ');
      } catch (err) {
        // パース失敗は静かに無視
      }
    }
  });

  elements.btnSample.addEventListener('click', loadSampleData);
  elements.btnPaste.addEventListener('click', pasteFromClipboard);

  // 列選択変更イベント
  elements.selectLabel.addEventListener('change', redrawChart);
  elements.selectX.addEventListener('change', () => {
    elements.xTitle.value = elements.selectX.value;
    elements.chartTitle.value = `${elements.selectY.value} vs ${elements.selectX.value}`;
    redrawChart();
  });
  elements.selectY.addEventListener('change', () => {
    elements.yTitle.value = elements.selectY.value;
    elements.chartTitle.value = `${elements.selectY.value} vs ${elements.selectX.value}`;
    redrawChart();
  });

  // タイトル入力変更イベント
  [elements.chartTitle, elements.xTitle, elements.yTitle].forEach(input => {
    input.addEventListener('input', redrawChart);
  });

  // 補助線チェックボックス・設定変更
  [
    elements.chkQuadrant,
    elements.quadrantSplitType,
    elements.chkQuadrantBg,
    elements.chkLine45,
    elements.chkAspect1to1,
    elements.chkRegression,
    elements.chkRegressionEq,
    elements.chkConfidence,
    elements.selectLabelMode,
    elements.chkLeaderLines,
    elements.selectTheme
  ].forEach(ctrl => {
    ctrl.addEventListener('change', redrawChart);
  });

  [elements.q1Label, elements.q2Label, elements.q3Label, elements.q4Label].forEach(input => {
    input.addEventListener('input', redrawChart);
  });

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
    state.scatterPlot.downloadSVG(`${title}.svg`);
    showToast('見たままの形でSVG保存しました (ベクター画像)', 'success');
  };

  // エクスポート: PNGダウンロード (見たままの形・解像度で保存)
  const handleSavePNG = async () => {
    if (!state.scatterPlot) return;
    const title = elements.chartTitle.value.trim() || 'scatter_plot';
    const res = await state.scatterPlot.downloadPNG(`${title}.png`, 2);
    if (res) {
      showToast(`見たままの形で高解像度PNG保存しました (${res.width}×${res.height})`, 'success');
    } else {
      showToast('PNG保存が完了しました', 'success');
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
  elements.btnCopySummary.addEventListener('click', async () => {
    if (!state.currentStats) {
      showToast('データがありません', 'warning');
      return;
    }
    const s = state.currentStats;
    const reg = s.regression;
    const xKey = elements.selectX.value;
    const yKey = elements.selectY.value;
    const sign = reg.intercept >= 0 ? '+' : '-';

    let text = `【散布図集計サマリー】\n`;
    text += `タイトル: ${elements.chartTitle.value}\n`;
    text += `X軸: ${xKey} / Y軸: ${yKey}\n`;
    text += `サンプル数: ${s.totalCount}\n`;
    text += `X軸: 平均=${s.meanX.toFixed(2)}, 中央値=${s.medianX.toFixed(2)}, 標準偏差=${s.stdX.toFixed(2)}\n`;
    text += `Y軸: 平均=${s.meanY.toFixed(2)}, 中央値=${s.medianY.toFixed(2)}, 標準偏差=${s.stdY.toFixed(2)}\n`;
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

    try {
      await navigator.clipboard.writeText(text);
      showToast('集計サマリーテキストをコピーしました', 'success');
    } catch (err) {
      showToast(`コピーに失敗しました: ${err.message}`, 'error');
    }
  });

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

  // データ確認モーダルの開閉と表示制御
  function openDataModal() {
    if (!state.tableData) {
      showToast('データが読み込まれていません', 'warning');
      return;
    }
    renderDataTable();
    elements.dataModal.style.display = 'flex';
    elements.modalSearch.value = '';
    elements.modalSearch.focus();
  }

  function closeDataModal() {
    if (elements.dataModal) {
      elements.dataModal.style.display = 'none';
    }
  }

  // データテーブルのレンダリング (検索フィルタ対応)
  function renderDataTable(filterText = '') {
    if (!state.tableData) return;
    const { columns, rows, numericColumns } = state.tableData;
    const q = filterText.trim().toLowerCase();

    // フィルタリング
    const filteredRows = q
      ? rows.filter(r => columns.some(col => String(r[col] || '').toLowerCase().includes(q)))
      : rows;

    elements.modalDataCount.textContent = `${filteredRows.length} 件 / 全 ${rows.length} 件`;

    // ヘッダー作成
    let headHtml = '<tr><th class="row-num-cell">#</th>';
    columns.forEach(col => {
      const isNum = numericColumns.includes(col);
      headHtml += `<th class="${isNum ? 'num-col' : ''}">${col}</th>`;
    });
    headHtml += '</tr>';
    elements.dataTableHead.innerHTML = headHtml;

    // ボディ作成
    if (filteredRows.length === 0) {
      elements.dataTableBody.innerHTML = `<tr><td colspan="${columns.length + 1}" style="text-align: center; padding: 24px; color: #94a3b8;">一致するデータが見つかりませんでした</td></tr>`;
      return;
    }

    let bodyHtml = '';
    filteredRows.forEach((r, idx) => {
      bodyHtml += `<tr><td class="row-num-cell">${idx + 1}</td>`;
      columns.forEach(col => {
        const val = r[col];
        const isNum = numericColumns.includes(col);
        const displayVal = (typeof val === 'number') ? val.toLocaleString() : (val !== undefined && val !== null ? val : '');
        bodyHtml += `<td class="${isNum ? 'num-cell' : ''}">${displayVal}</td>`;
      });
      bodyHtml += '</tr>';
    });
    elements.dataTableBody.innerHTML = bodyHtml;
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
      let csv = columns.join(',') + '\n';
      rows.forEach(r => {
        const line = columns.map(c => {
          const val = r[c] !== undefined && r[c] !== null ? String(r[c]) : '';
          return val.includes(',') ? `"${val}"` : val;
        }).join(',');
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
    }
  });

  // 初回起動: サンプルデータを自動読み込み
  loadSampleData();
});
