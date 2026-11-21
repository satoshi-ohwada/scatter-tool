/**
 * stats.js - 散布図用 統計計算モジュール
 * 完全オフライン・純粋なJavaScript計算
 */

const Stats = {
  // 平均値
  mean(arr) {
    if (!arr || arr.length === 0) return 0;
    const sum = arr.reduce((acc, val) => acc + val, 0);
    return sum / arr.length;
  },

  // 加重平均値 (arr: 数値配列, weights: 重み配列)
  weightedMean(arr, weights) {
    if (!arr || arr.length === 0) return 0;
    if (!weights || weights.length === 0) return this.mean(arr);
    let sumWeight = 0;
    let sumWeightedVal = 0;
    const n = Math.min(arr.length, weights.length);
    for (let i = 0; i < n; i++) {
      const val = Number(arr[i]);
      const w = Number(weights[i]);
      if (!isNaN(val) && isFinite(val) && !isNaN(w) && isFinite(w) && w >= 0) {
        sumWeight += w;
        sumWeightedVal += val * w;
      }
    }
    if (sumWeight === 0) {
      return this.mean(arr);
    }
    return sumWeightedVal / sumWeight;
  },

  // 幾何平均値 (相乗平均: 全ての値が > 0 の場合のみ計算可能)
  geometricMean(arr) {
    if (!arr || arr.length === 0) return null;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] <= 0) return null;
    }
    // オーバーフロー・アンダーフローを防ぐため対数和で計算: exp( (1/n) * Σ ln(x_i) )
    const logSum = arr.reduce((acc, val) => acc + Math.log(val), 0);
    return Math.exp(logSum / arr.length);
  },

  // 中央値
  median(arr) {
    if (!arr || arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  },

  // 標準偏差
  stdDev(arr, meanVal = null) {
    if (!arr || arr.length < 2) return 0;
    const m = meanVal !== null ? meanVal : this.mean(arr);
    const variance = arr.reduce((acc, val) => acc + Math.pow(val - m, 2), 0) / (arr.length - 1);
    return Math.sqrt(variance);
  },

  // 1次回帰直線 (最小二乗法) y = ax + b
  linearRegression(xArr, yArr) {
    const n = Math.min(xArr.length, yArr.length);
    if (n < 2) {
      return { slope: 0, intercept: 0, r: 0, r2: 0, valid: false };
    }

    const meanX = this.mean(xArr);
    const meanY = this.mean(yArr);

    let num = 0;
    let denX = 0;
    let denY = 0;

    for (let i = 0; i < n; i++) {
      const dx = xArr[i] - meanX;
      const dy = yArr[i] - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }

    if (denX === 0) {
      return { slope: 0, intercept: meanY, r: 0, r2: 0, valid: false };
    }

    const slope = num / denX;
    const intercept = meanY - slope * meanX;

    const denom = Math.sqrt(denX * denY);
    const r = denom === 0 ? 0 : num / denom;
    const r2 = r * r;

    // 残差平方和と標準誤差 (信頼区間用)
    let ssRes = 0;
    for (let i = 0; i < n; i++) {
      const pred = slope * xArr[i] + intercept;
      ssRes += Math.pow(yArr[i] - pred, 2);
    }
    const se = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;

    return {
      slope,
      intercept,
      r,
      r2,
      se,
      meanX,
      denX,
      n,
      valid: true
    };
  },

  // 回帰線の95%信頼区間計算
  // 自由度 n-2 の t値 (n>30では約1.96〜2.0)
  getConfidenceInterval(x, reg) {
    if (!reg.valid || reg.n <= 2 || reg.denX === 0) return null;
    const tVal = reg.n > 30 ? 1.96 : 2.05; // 簡易近似
    const dx = x - reg.meanX;
    const seFit = reg.se * Math.sqrt(1 / reg.n + (dx * dx) / reg.denX);
    const yHat = reg.slope * x + reg.intercept;
    return {
      lower: yHat - tVal * seFit,
      upper: yHat + tVal * seFit
    };
  },

  // 4象限への分類
  classifyQuadrants(items, xKey, yKey, splitX, splitY) {
    const q1 = []; // 右上 (X>=splitX, Y>=splitY)
    const q2 = []; // 左上 (X<splitX,  Y>=splitY)
    const q3 = []; // 左下 (X<splitX,  Y<splitY)
    const q4 = []; // 右下 (X>=splitX, Y<splitY)

    items.forEach(item => {
      const x = item[xKey];
      const y = item[yKey];
      if (x >= splitX && y >= splitY) {
        q1.push(item);
      } else if (x < splitX && y >= splitY) {
        q2.push(item);
      } else if (x < splitX && y < splitY) {
        q3.push(item);
      } else {
        q4.push(item);
      }
    });

    return { q1, q2, q3, q4 };
  }
};

window.Stats = Stats;
