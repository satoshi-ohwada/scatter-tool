/**
 * label_layout.js - ラベル衝突回避 & 自動引き出し線エンジン
 * 力学モデルによるラベル配置最適化 & ドラッグ操作対応
 */

class LabelLayoutEngine {
  constructor() {
    this.labels = []; // { id, name, px, py, lx, ly, width, height, userMoved, visible }
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

      // 初期位置: プロット点の右上 (dx: +12, dy: -8)
      const lx = userMoved ? prevPos.lx : p.px + 10;
      const ly = userMoved ? prevPos.ly : p.py - 10;

      return {
        id: p.id,
        name,
        px: p.px, // プロット点のX
        py: p.py, // プロット点のY
        lx,       // ラベルの中心X
        ly,       // ラベルの中心Y
        width: w,
        height: h,
        userMoved,
        visible
      };
    });

    // 衝突回避シミュレーションの実行 (ユーザーが動かしていないラベルのみ)
    if (mode !== 'none') {
      this.optimizePositions(120);
    }

    return this.labels;
  }

  // 力学モデルによる反復位置最適化 (Simulated Annealing / Force-directed)
  optimizePositions(maxIterations = 100) {
    const visibleLabels = this.labels.filter(l => l.visible);
    if (visibleLabels.length <= 1) return;

    const kRepulse = 80;   // ラベル同士の反発力
    const kPointAvoid = 60; // 他のプロット点からの反発力
    const kAnchor = 0.08;   // 自身のプロット点への引力
    const idealDist = 20;  // 理想距離

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

        // 2. 他のラベルとの重なり反発力 (AABB衝突)
        for (let j = 0; j < visibleLabels.length; j++) {
          if (i === j) continue;
          const b = visibleLabels[j];
          const dx = a.lx - b.lx;
          const dy = a.ly - b.ly;
          const minXDist = (a.width + b.width) / 2 + 6;
          const minYDist = (a.height + b.height) / 2 + 4;

          if (Math.abs(dx) < minXDist && Math.abs(dy) < minYDist) {
            // 重なり検出
            const overlapX = minXDist - Math.abs(dx);
            const overlapY = minYDist - Math.abs(dy);
            const signX = dx >= 0 ? 1 : -1;
            const signY = dy >= 0 ? 1 : -1;

            if (overlapX < overlapY) {
              fx += signX * (overlapX * 0.4 + kRepulse * 0.1);
            } else {
              fy += signY * (overlapY * 0.4 + kRepulse * 0.1);
            }
          }
        }

        // 3. すべてのデータ点 (プロット丸) と重ならないようにする
        for (let j = 0; j < visibleLabels.length; j++) {
          const p = visibleLabels[j];
          const distToP = Math.hypot(a.lx - p.px, a.ly - p.py);
          const safeRadius = 16;
          if (distToP < safeRadius) {
            const pushDist = (safeRadius - distToP);
            const angle = Math.atan2(a.ly - p.py, a.lx - p.px) || 0;
            fx += Math.cos(angle) * pushDist * 0.6;
            fy += Math.sin(angle) * pushDist * 0.6;
          }
        }

        // 位置の更新 (焼きなまし温度で移動量を制限)
        const step = Math.min(Math.hypot(fx, fy), 18) * temp;
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
    this.optimizePositions(120);
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
