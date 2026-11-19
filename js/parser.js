/**
 * parser.js - 表データ (CSV, Excel, クリップボード) 解析モジュール
 * Shift_JIS / UTF-8 自動判別 & 数値クリーニング
 */

const DataParser = {
  // 数値文字列の正規化 (全角数字・記号、カンマ、%記号の除去と厳密判定)
  cleanNumber(val) {
    if (val === null || val === undefined) return NaN;
    if (typeof val === 'number') return Number.isFinite(val) ? val : NaN;
    let str = String(val).trim();
    if (str === '' || str === '-' || str === '－' || str === '−' || str === '―' || str === 'NA' || str === 'N/A' || str === 'null') return NaN;

    // 全角英数字・記号を半角に変換
    str = str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    str = str.replace(/[－−]/g, '-').replace(/．/g, '.').replace(/％/g, '%').replace(/＋/g, '+');
    // カンマ、通貨記号、空白を除去
    str = str.replace(/[,\s¥￥$]/g, '');

    // パーセント記号の処理
    if (str.endsWith('%')) {
      str = str.slice(0, -1);
    }

    if (str === '' || str === '+' || str === '-') return NaN;

    // parseFloat のような先頭部分一致 ("2025年" -> 2025) を防ぐため Number() で厳密判定
    const num = Number(str);
    return Number.isFinite(num) ? num : NaN;
  },

  // 文字コード判定とテキストデコード (ArrayBuffer -> string)
  decodeBuffer(buffer) {
    const uint8Array = new Uint8Array(buffer);
    if (window.Encoding) {
      const detected = window.Encoding.detect(uint8Array);
      const unicodeArray = window.Encoding.convert(uint8Array, {
        to: 'UNICODE',
        from: detected || 'AUTO'
      });
      return window.Encoding.codeToString(unicodeArray);
    }
    // フォールバック: UTF-8
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(uint8Array);
  },

  // 2次元配列 (rows) からテーブル構造を生成
  buildTableFromRawRows(rawRows) {
    if (!rawRows || rawRows.length < 2) {
      throw new Error("データが不足しています。ヘッダー行と少なくとも1件以上のデータが必要です。");
    }

    // 空行の除外
    const filteredRows = rawRows.filter(row => row && row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== ''));
    if (filteredRows.length < 2) {
      throw new Error("有効なデータ行が見つかりません。");
    }

    // ヘッダー (列名・重複列名の自動ユニーク化)
    const headerRow = filteredRows[0];
    const usedColNames = new Map();
    const columns = headerRow.map((col, idx) => {
      const baseName = (col !== null && col !== undefined ? String(col).trim() : '') || `列_${idx + 1}`;
      const count = usedColNames.get(baseName) || 0;
      usedColNames.set(baseName, count + 1);
      return count === 0 ? baseName : `${baseName} (${count + 1})`;
    });

    const dataRows = filteredRows.slice(1);

    // 各列のデータ型（数値列かどうか）を判定
    const colTypes = columns.map((colName, colIdx) => {
      let numericCount = 0;
      let textCount = 0;

      for (let r = 0; r < dataRows.length; r++) {
        const cell = dataRows[r][colIdx];
        if (cell === null || cell === undefined || String(cell).trim() === '') continue;
        const num = this.cleanNumber(cell);
        if (!isNaN(num)) {
          numericCount++;
        } else {
          textCount++;
        }
      }

      // 数値セルが1件以上あり、かつテキストセルより多い場合「数値列」と判定
      // ただし第1列 (A列) は名称列として優先
      const isNumeric = colIdx > 0 && numericCount > 0 && (numericCount >= textCount);
      return {
        name: colName,
        index: colIdx,
        isNumeric,
        numericCount,
        totalRows: dataRows.length
      };
    });

    // オブジェクト配列に変換
    const rows = [];
    dataRows.forEach((row, rowIdx) => {
      const item = { _rowId: rowIdx + 1 };
      columns.forEach((colName, colIdx) => {
        const rawVal = row[colIdx];
        if (colTypes[colIdx].isNumeric) {
          item[colName] = this.cleanNumber(rawVal);
        } else {
          item[colName] = rawVal !== null && rawVal !== undefined ? String(rawVal).trim() : '';
        }
      });
      rows.push(item);
    });

    // デフォルトの名称列 (第1列)、デフォルトのX軸 (最初の数値列)、デフォルトのY軸 (2番目の数値列)
    const labelColumn = columns[0];
    const numericColumns = colTypes.filter(c => c.isNumeric).map(c => c.name);

    const defaultX = numericColumns.length > 0 ? numericColumns[0] : (columns[1] || columns[0]);
    const defaultY = numericColumns.length > 1 ? numericColumns[1] : (numericColumns[0] || columns[0]);

    return {
      columns,
      numericColumns,
      rows,
      colTypes,
      labelColumn,
      defaultX,
      defaultY,
      totalCount: rows.length
    };
  },

  // CSV/TSV 文字列の解析 (PapaParse利用)
  parseCSVText(text) {
    if (!window.Papa) {
      throw new Error("PapaParse ライブラリが読み込まれていません。");
    }
    const result = window.Papa.parse(text, {
      skipEmptyLines: 'greedy',
      header: false
    });
    if (result.errors && result.errors.length > 0 && (!result.data || result.data.length === 0)) {
      throw new Error(`CSVの解析に失敗しました: ${result.errors[0].message}`);
    }
    return this.buildTableFromRawRows(result.data);
  },

  // Excelファイル (ArrayBuffer) の解析 (SheetJS / xlsx.full.min.js利用)
  parseExcelBuffer(buffer) {
    if (!window.XLSX) {
      throw new Error("XLSX ライブラリが読み込まれていません。");
    }
    const workbook = window.XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error("Excel内にシートが見つかりませんでした。");
    }
    const sheet = workbook.Sheets[sheetName];
    const rawRows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    return this.buildTableFromRawRows(rawRows);
  },

  // Fileオブジェクトの解析
  async parseFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const arrayBuffer = await file.arrayBuffer();

    if (ext === 'xlsx' || ext === 'xls') {
      return this.parseExcelBuffer(arrayBuffer);
    } else {
      // CSVまたはTSV、テキストファイル
      const text = this.decodeBuffer(arrayBuffer);
      return this.parseCSVText(text);
    }
  }
};

window.DataParser = DataParser;
