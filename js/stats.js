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
  },

  // Zスコア標準化
  standardize(arr) {
    if (!arr || arr.length === 0) return [];
    const m = this.mean(arr);
    const sd = this.stdDev(arr, m);
    if (sd === 0) return arr.map(() => 0);
    return arr.map(v => (v - m) / sd);
  },

  // K-Means++ クラスタリング
  // points: [{ id, x, y }] (標準化済みの2D座標)
  // k: クラスター数
  kMeans(points, k, maxIter = 100) {
    const n = points.length;
    if (n === 0 || k <= 0) return { clusters: [], assignments: new Map() };
    if (k >= n) {
      // 点数よりクラスタ数が多い場合は各点を1クラスタに
      const clusters = points.map((p, i) => ({
        id: i,
        centroid: { x: p.x, y: p.y },
        points: [p]
      }));
      const assignments = new Map(points.map((p, i) => [p.id, i]));
      return { clusters, assignments };
    }

    // 1. K-Means++ 初期重心選定
    const centroids = [];
    // 最初の重心は決定論的に最初の点 (または中央に近い点)
    centroids.push({ x: points[0].x, y: points[0].y });

    while (centroids.length < k) {
      // 各点から最も近い既存重心までの距離の2乗を計算
      const distSqArr = points.map(p => {
        let minDistSq = Infinity;
        for (const c of centroids) {
          const d2 = Math.pow(p.x - c.x, 2) + Math.pow(p.y - c.y, 2);
          if (d2 < minDistSq) minDistSq = d2;
        }
        return minDistSq;
      });

      const totalDistSq = distSqArr.reduce((a, b) => a + b, 0);
      if (totalDistSq === 0) {
        // 全点が同一座標の場合
        centroids.push({ x: points[centroids.length].x, y: points[centroids.length].y });
        continue;
      }

      // 最も遠い点を選択 (決定論的・再現性重視)
      let maxDistIdx = 0;
      let maxDistVal = -1;
      distSqArr.forEach((d2, idx) => {
        if (d2 > maxDistVal) {
          maxDistVal = d2;
          maxDistIdx = idx;
        }
      });
      centroids.push({ x: points[maxDistIdx].x, y: points[maxDistIdx].y });
    }

    // 2. 反復最適化
    let assignments = new Map();
    for (let iter = 0; iter < maxIter; iter++) {
      let changed = false;
      const clusterPoints = Array.from({ length: k }, () => []);

      // 割り当てステップ
      points.forEach(p => {
        let bestCluster = 0;
        let bestDistSq = Infinity;
        for (let ci = 0; ci < k; ci++) {
          const c = centroids[ci];
          const d2 = Math.pow(p.x - c.x, 2) + Math.pow(p.y - c.y, 2);
          if (d2 < bestDistSq) {
            bestDistSq = d2;
            bestCluster = ci;
          }
        }
        if (assignments.get(p.id) !== bestCluster) {
          assignments.set(p.id, bestCluster);
          changed = true;
        }
        clusterPoints[bestCluster].push(p);
      });

      if (!changed && iter > 0) break;

      // 重心更新ステップ
      let maxShift = 0;
      for (let ci = 0; ci < k; ci++) {
        const pts = clusterPoints[ci];
        if (pts.length > 0) {
          const newX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
          const newY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
          const shift = Math.hypot(newX - centroids[ci].x, newY - centroids[ci].y);
          if (shift > maxShift) maxShift = shift;
          centroids[ci] = { x: newX, y: newY };
        }
      }

      if (maxShift < 1e-4) break;
    }

    // 戻り値のクラスタ配列構築 (重心のX座標でソートして安定した色順を付与)
    const clusterMap = Array.from({ length: k }, (_, i) => ({
      id: i,
      centroid: centroids[i],
      points: []
    }));

    points.forEach(p => {
      const cId = assignments.get(p.id);
      if (clusterMap[cId]) {
        clusterMap[cId].points.push(p);
      }
    });

    return { clusters: clusterMap, assignments };
  },

  // シルエット係数による最適クラスター数 k の推定
  findOptimalK(points, minK = 2, maxK = 6) {
    const n = points.length;
    if (n < 4) return { optimalK: 2, score: 0 };

    const effectiveMaxK = Math.min(maxK, Math.floor(n / 2), 8);
    if (effectiveMaxK < minK) return { optimalK: minK, score: 0 };

    let bestK = minK;
    let bestScore = -Infinity;
    const scores = [];

    for (let k = minK; k <= effectiveMaxK; k++) {
      const { clusters, assignments } = this.kMeans(points, k);
      
      // クラスター数が足りない場合はスキップ
      const validClusters = clusters.filter(c => c.points.length > 0);
      if (validClusters.length < 2) continue;

      // シルエット係数の計算
      let totalSilhouette = 0;
      let evaluatedPoints = 0;

      points.forEach(p => {
        const myClusterId = assignments.get(p.id);
        const myCluster = clusters[myClusterId];

        // a(i): 同一クラスタ内の平均距離
        let a = 0;
        if (myCluster.points.length > 1) {
          const sumDist = myCluster.points.reduce((acc, other) => {
            if (other.id === p.id) return acc;
            return acc + Math.hypot(p.x - other.x, p.y - other.y);
          }, 0);
          a = sumDist / (myCluster.points.length - 1);
        }

        // b(i): 最も近い他クラスタとの平均距離
        let b = Infinity;
        clusters.forEach((otherCluster, otherId) => {
          if (otherId === myClusterId || otherCluster.points.length === 0) return;
          const sumDist = otherCluster.points.reduce((acc, other) => {
            return acc + Math.hypot(p.x - other.x, p.y - other.y);
          }, 0);
          const avgDist = sumDist / otherCluster.points.length;
          if (avgDist < b) b = avgDist;
        });

        if (b === Infinity) b = 0;

        const maxAB = Math.max(a, b);
        const s = maxAB > 0 ? (b - a) / maxAB : 0;
        totalSilhouette += s;
        evaluatedPoints++;
      });

      const avgScore = evaluatedPoints > 0 ? totalSilhouette / evaluatedPoints : 0;
      scores.push({ k, score: avgScore });

      if (avgScore > bestScore) {
        bestScore = avgScore;
        bestK = k;
      }
    }

    return { optimalK: bestK, score: bestScore, scores };
  },

  // 凸包 (Convex Hull) 計算 (Andrew's Monotone Chain Algorithm)
  // points: [{ x, y }] -> 凸包の多角形頂点配列 [{ x, y }, ...]
  convexHull(points) {
    if (!points || points.length <= 2) return [...points];

    // X昇順 (同値ならY昇順) でソート
    const sorted = [...points].sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);

    const crossProduct = (o, a, b) => {
      return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    };

    // 下側凸包
    const lower = [];
    for (const p of sorted) {
      while (lower.length >= 2 && crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
        lower.pop();
      }
      lower.push(p);
    }

    // 上側凸包
    const upper = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      while (upper.length >= 2 && crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
        upper.pop();
      }
      upper.push(p);
    }

    // 最後の点を取り除いて結合
    lower.pop();
    upper.pop();
    return lower.concat(upper);
  },

  // クラスターの包含・信頼楕円パラメータ計算
  // points: [{ x, y }] (画面ピクセル座標または2D座標)
  // 戻り値: { cx, cy, rx, ry, angleDeg }
  clusterEllipse(points) {
    const n = points.length;
    if (n === 0) return null;
    if (n === 1) {
      return { cx: points[0].x, cy: points[0].y, rx: 22, ry: 22, angleDeg: 0 };
    }
    if (n === 2) {
      const p1 = points[0];
      const p2 = points[1];
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const rx = Math.max(24, dist / 2 + 16);
      const ry = Math.max(18, dist * 0.35 + 12);
      const angleDeg = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
      return { cx, cy, rx, ry, angleDeg };
    }

    // n >= 3: 標本共分散行列に基づく信頼楕円
    const cx = points.reduce((s, p) => s + p.x, 0) / n;
    const cy = points.reduce((s, p) => s + p.y, 0) / n;

    let varX = 0, varY = 0, covXY = 0;
    for (const p of points) {
      const dx = p.x - cx;
      const dy = p.y - cy;
      varX += dx * dx;
      varY += dy * dy;
      covXY += dx * dy;
    }
    varX /= (n - 1);
    varY /= (n - 1);
    covXY /= (n - 1);

    // 固有値計算 (主軸方向の分散)
    const trace = varX + varY;
    const diff = varX - varY;
    const disc = Math.sqrt(Math.max(0, diff * diff + 4 * covXY * covXY));
    const lambda1 = Math.max(0, (trace + disc) / 2);
    const lambda2 = Math.max(0, (trace - disc) / 2);

    // 回転角 (度)
    const angleRad = 0.5 * Math.atan2(2 * covXY, diff);
    const angleDeg = angleRad * (180 / Math.PI);

    // 信頼区間スケール (95%水準: 約2.45σ) ＋ 点群の外周クリアランス
    let rx = Math.sqrt(lambda1) * 2.3 + 12;
    let ry = Math.sqrt(lambda2) * 2.3 + 12;

    // 実際の点群との最大距離を加味して確実に覆うように補正
    let maxDist = 0;
    points.forEach(p => {
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d > maxDist) maxDist = d;
    });
    if (rx < maxDist + 8) rx = maxDist + 8;
    if (ry < 18) ry = 18;

    return { cx, cy, rx, ry, angleDeg };
  }
};

window.Stats = Stats;
