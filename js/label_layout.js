/**
 * label_layout.js - ラベル衝突回避 & 自動引き出し線エンジン
 * 力学モデルによるラベル配置最適化 & ドラッグ操作対応
 */

class LabelLayoutEngine {
  constructor() {
    this.labels = []; // { id, name, px, py, lx, ly, width, height, userMoved, visible }
    this.allPoints = []; // [{ id, px, py }] 全プロット点の座標 (非表示ラベルの点も含む)
    this.bounds = { minX: 0, maxX: 800, minY: 0, maxY: 600 };
  }

  // 初期化
  initLabels(points, options = {}) {
    // points: [{ id, name, px, py, isOutlier, rankX, rankY, totalCount }]
    const {
      mode = 'all', // 'all', 'outliers', 'top5', 'top10', 'none'
      fontSize = 11,
      bounds = { minX: 40, maxX: 760, minY: 40, maxY: 560 }
    } = options;

    this.bounds = bounds;
    this.allPoints = points.map(p => ({ id: p.id, px: p.px, py: p.py }));

    // 既存のユーザー移動位置を保持するためのマップ
    const prevMovedMap = new Map();
    this.labels.forEach(l => {
      if (l.userMoved) {
        prevMovedMap.set(l.id, { lx: l.lx, ly: l.ly });
      }
    });

    this.labels = points.map((p, idx) => {
      const name = String(p.name || `点${idx + 1}`);
      // おおよその文字幅と高さを計算 (日本語全角約12px, 半角約7px)
      let w = 0;
      for (let i = 0; i < name.length; i++) {
        w += name.charCodeAt(i) > 255 ? fontSize * 1.05 : fontSize * 0.65;
      }
      w += 8; // パディング
      const h = fontSize + 6;

      // 表示判定
      let visible = true;
      if (mode === 'none') {
        visible = false;
      } else if (mode === 'outliers') {
        visible = !!p.isOutlier;
      } else if (mode === 'top5') {
        visible = p.rankX <= 5 || p.rankY <= 5;
      } else if (mode === 'top10') {
        visible = p.rankX <= 10 || p.rankY <= 10;
      }

      // 前回のユーザー手動位置があれば復元
      const prevPos = prevMovedMap.get(p.id);
      const userMoved = !!prevPos;

      // スマート初期配置: 周囲8方向のうち、他のプロット点から最も離れた方向を選択
      let initLx, initLy;
      if (userMoved) {
        initLx = prevPos.lx;
        initLy = prevPos.ly;
      } else {
        const bestOffset = this.findBestInitialOffset(p, w, h, points);
        initLx = p.px + bestOffset.dx;
        initLy = p.py + bestOffset.dy;
      }

      return {
        id: p.id,
        name,
        px: p.px, // プロット点のX
        py: p.py, // プロット点のY
        lx: initLx, // ラベルの中心X
        ly: initLy, // ラベルの中心Y
        width: w,
        height: h,
        userMoved,
        visible
      };
    });

    // 衝突回避シミュレーションの実行 (ユーザーが動かしていないラベルのみ)
    if (mode !== 'none') {
      this.optimizePositions(180);
      this.resolvePointCollisions();
    }

    return this.labels;
  }

  // 初期オフセットのスマート選定 (他のプロット点と最も被らない方向を選択)
  findBestInitialOffset(point, width, height, allPoints) {
    const dist = 22;
    // 候補8方向 (右上、右下、左上、左下、右、左、上、下)
    const candidates = [
      { dx: dist + width / 4, dy: -dist }, // 右上 (標準)
      { dx: dist + width / 4, dy: dist },  // 右下
      { dx: -dist - width / 4, dy: -dist }, // 左上
      { dx: -dist - width / 4, dy: dist },  // 左下
      { dx: dist + width / 2, dy: 0 },     // 右
      { dx: -dist - width / 2, dy: 0 },    // 左
      { dx: 0, dy: -dist - height / 2 },   // 上
      { dx: 0, dy: dist + height / 2 }     // 下
    ];

    let bestCand = candidates[0];
    let maxMinDist = -1;

    for (const cand of candidates) {
      const cx = point.px + cand.dx;
      const cy = point.py + cand.dy;

      // 境界内かチェック
      if (cx - width / 2 < this.bounds.minX || cx + width / 2 > this.bounds.maxX ||
          cy - height / 2 < this.bounds.minY || cy + height / 2 > this.bounds.maxY) {
        continue;
      }

      // 他のプロット点との最近接距離を計算
      let minDist = Infinity;
      for (const other of allPoints) {
        if (other.id === point.id) continue;
        const d = Math.hypot(cx - other.px, cy - other.py);
        if (d < minDist) minDist = d;
      }

      if (minDist > maxMinDist) {
        maxMinDist = minDist;
        bestCand = cand;
      }
    }

    return bestCand;
  }

  // 力学モデルによる反復位置最適化 (Simulated Annealing / Force-directed)
  optimizePositions(maxIterations = 180) {
    const visibleLabels = this.labels.filter(l => l.visible);
    if (visibleLabels.length <= 0) return;

    const kRepulse = 90;     // ラベル同士の反発力
    const kPointAvoid = 150; // 自分以外のプロット点を隠さないための最優先反発力
    const kAnchor = 0.06;    // 自身のプロット点への引力
    const idealDist = 22;    // 自身のプロット点との理想距離

    for (let iter = 0; iter < maxIterations; iter++) {
      const temp = 1.0 - (iter / maxIterations); // 焼きなまし減衰

      for (let i = 0; i < visibleLabels.length; i++) {
        const a = visibleLabels[i];
        if (a.userMoved) continue; // 手動移動されたものは固定

        let fx = 0;
        let fy = 0;

        // 1. 自身のプロット点との理想距離維持（引力）
        const dpx = a.lx - a.px;
        const dpy = a.ly - a.py;
        const currentDist = Math.hypot(dpx, dpy) || 1;
        const anchorForce = (currentDist - idealDist) * kAnchor;
        fx -= (dpx / currentDist) * anchorForce;
        fy -= (dpy / currentDist) * anchorForce;

        // 2. 他のラベルとの重なり反発力 (AABB矩形衝突)
        for (let j = 0; j < visibleLabels.length; j++) {
          if (i === j) continue;
          const b = visibleLabels[j];
          const dx = a.lx - b.lx;
          const dy = a.ly - b.ly;
          const minXDist = (a.width + b.width) / 2 + 6;
          const minYDist = (a.height + b.height) / 2 + 5;

          if (Math.abs(dx) < minXDist && Math.abs(dy) < minYDist) {
            const overlapX = minXDist - Math.abs(dx);
            const overlapY = minYDist - Math.abs(dy);
            const signX = dx >= 0 ? 1 : -1;
            const signY = dy >= 0 ? 1 : -1;

            if (overlapX < overlapY) {
              fx += signX * (overlapX * 0.5 + kRepulse * 0.15);
            } else {
              fy += signY * (overlapY * 0.5 + kRepulse * 0.15);
            }
          }
        }

        // 3. 自分自身以外のプロット点を【絶対に隠さない】ための矩形衝突判定 & 強力斥力
        for (let j = 0; j < this.allPoints.length; j++) {
          const p = this.allPoints[j];
          const dx = a.lx - p.px;
          const dy = a.ly - p.py;

          if (p.id === a.id) {
            // 自身の点: ラベル矩形が自身の点に直接乗っかるのを防ぐ
            const selfSafeW = a.width / 2 + 7;
            const selfSafeH = a.height / 2 + 6;
            if (Math.abs(dx) < selfSafeW && Math.abs(dy) < selfSafeH) {
              const ox = selfSafeW - Math.abs(dx);
              const oy = selfSafeH - Math.abs(dy);
              const sx = dx >= 0 ? 1 : -1;
              const sy = dy >= 0 ? 1 : -1;
              if (ox < oy) fx += sx * (ox * 0.8 + 20);
              else fy += sy * (oy * 0.8 + 20);
            }
            continue;
          }

          // 自分自身以外のプロット点: ラベル矩形(幅・高さ) + プロット点半径 + 安全マージン
          const dangerW = a.width / 2 + 12; // プロット点半径(約6px) + 余白マージン(6px)
          const dangerH = a.height / 2 + 10;

          if (Math.abs(dx) < dangerW && Math.abs(dy) < dangerH) {
            // プロット点がラベル矩形内または至近危険ゾーンに侵入している
            const overlapX = dangerW - Math.abs(dx);
            const overlapY = dangerH - Math.abs(dy);
            const sx = dx >= 0 ? 1 : -1;
            const sy = dy >= 0 ? 1 : -1;

            // 最優先でラベルを他人の点から強力に外へ弾き飛ばす
            if (overlapX < overlapY) {
              fx += sx * (overlapX * 2.2 + kPointAvoid);
            } else {
              fy += sy * (overlapY * 2.2 + kPointAvoid);
            }
          }
        }

        // 位置の更新 (焼きなまし温度で移動量を制限)
        const step = Math.min(Math.hypot(fx, fy), 24) * temp;
        const angle = Math.atan2(fy, fx);
        if (!isNaN(angle) && step > 0.1) {
          a.lx += Math.cos(angle) * step;
          a.ly += Math.sin(angle) * step;
        }

        // 境界チェック
        a.lx = Math.max(this.bounds.minX + a.width / 2, Math.min(this.bounds.maxX - a.width / 2, a.lx));
        a.ly = Math.max(this.bounds.minY + a.height / 2, Math.min(this.bounds.maxY - a.height / 2, a.ly));
      }
    }
  }

  // ポストプロセス: 他人のプロット点を隠しているラベルを強制的に解消する安全パス
  resolvePointCollisions() {
    const visibleLabels = this.labels.filter(l => l.visible);
    const dangerMarginX = 9;
    const dangerMarginY = 8;

    visibleLabels.forEach(a => {
      if (a.userMoved) return;

      // 他人のプロット点と重なっているか検証
      let hasCollision = false;
      for (const p of this.allPoints) {
        if (p.id === a.id) continue;
        const limitW = a.width / 2 + dangerMarginX;
        const limitH = a.height / 2 + dangerMarginY;
        if (Math.abs(a.lx - p.px) < limitW && Math.abs(a.ly - p.py) < limitH) {
          hasCollision = true;
          break;
        }
      }

      if (!hasCollision) return;

      // 衝突している場合、安全オフセットを探索して即時解消 (16方向 × 段階的距離)
      const stepDists = [16, 26, 38, 52, 68, 85, 105];
      const directions = [
        { dx: 0, dy: -1 }, // 上
        { dx: 1, dy: 0 },  // 右
        { dx: 0, dy: 1 },  // 下
        { dx: -1, dy: 0 }, // 左
        { dx: 1, dy: -1 }, // 右上
        { dx: 1, dy: 1 },  // 右下
        { dx: -1, dy: -1 },// 左上
        { dx: -1, dy: 1 }, // 左下
        { dx: 0.5, dy: -1 },
        { dx: 1, dy: -0.5 },
        { dx: 1, dy: 0.5 },
        { dx: 0.5, dy: 1 },
        { dx: -0.5, dy: 1 },
        { dx: -1, dy: 0.5 },
        { dx: -1, dy: -0.5 },
        { dx: -0.5, dy: -1 }
      ];

      let bestLx = a.lx;
      let bestLy = a.ly;
      let solved = false;

      for (const d of stepDists) {
        for (const dir of directions) {
          const testLx = a.lx + dir.dx * d;
          const testLy = a.ly + dir.dy * d;

          // 境界内チェック
          if (testLx - a.width / 2 < this.bounds.minX || testLx + a.width / 2 > this.bounds.maxX ||
              testLy - a.height / 2 < this.bounds.minY || testLy + a.height / 2 > this.bounds.maxY) {
            continue;
          }

          // 他人のプロット点との衝突がないかチェック
          let colPoint = false;
          for (const p of this.allPoints) {
            if (p.id === a.id) continue;
            if (Math.abs(testLx - p.px) < a.width / 2 + dangerMarginX &&
                Math.abs(testLy - p.py) < a.height / 2 + dangerMarginY) {
              colPoint = true;
              break;
            }
          }

          if (!colPoint) {
            bestLx = testLx;
            bestLy = testLy;
            solved = true;
            break;
          }
        }
        if (solved) break;
      }

      a.lx = bestLx;
      a.ly = bestLy;
    });
  }

  // 手動移動の反映
  updateLabelPosition(id, newLx, newLy) {
    const label = this.labels.find(l => l.id === id);
    if (label) {
      label.lx = Math.max(this.bounds.minX + label.width / 2, Math.min(this.bounds.maxX - label.width / 2, newLx));
      label.ly = Math.max(this.bounds.minY + label.height / 2, Math.min(this.bounds.maxY - label.height / 2, newLy));
      label.userMoved = true;
    }
  }

  // 手動位置のリセット
  resetManualPositions() {
    this.labels.forEach(l => {
      l.userMoved = false;
    });
    this.optimizePositions(180);
    this.resolvePointCollisions();
  }

  // 引き出し線の必要性と端点計算
  getLeaderLine(label) {
    if (!label.visible) return null;
    const dist = Math.hypot(label.lx - label.px, label.ly - label.py);
    // 距離が一定以上離れている場合に引き出し線を描画
    const threshold = 18;
    if (dist < threshold && !label.userMoved) {
      return null;
    }

    // ラベル矩形の外周とプロット点からの交点を求める
    const halfW = label.width / 2;
    const halfH = label.height / 2;
    const dx = label.px - label.lx;
    const dy = label.py - label.ly;

    let targetX = label.lx;
    let targetY = label.ly;

    if (Math.abs(dx) * halfH > Math.abs(dy) * halfW) {
      // 左右の辺に交差
      targetX = label.lx + (dx > 0 ? halfW : -halfW);
      targetY = label.ly + (dx !== 0 ? dy * (targetX - label.lx) / dx : 0);
    } else {
      // 上下の辺に交差
      targetY = label.ly + (dy > 0 ? halfH : -halfH);
      targetX = label.lx + (dy !== 0 ? dx * (targetY - label.ly) / dy : 0);
    }

    return {
      x1: label.px,
      y1: label.py,
      x2: targetX,
      y2: targetY,
      dist
    };
  }
}

window.LabelLayoutEngine = LabelLayoutEngine;
