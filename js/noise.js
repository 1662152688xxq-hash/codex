/**
 * Perlin 噪声实现（经典 Perlin Noise + Simplex Noise）
 * 用于程序化地形生成
 */

// 简易 Permutation 表生成器
class Permutation {
    constructor(seed = 42) {
        this.p = new Uint8Array(512);
        const perm = new Uint8Array(256);
        for (let i = 0; i < 256; i++) perm[i] = i;

        // 种子化洗牌 (Fisher-Yates)
        let s = seed;
        for (let i = 255; i > 0; i--) {
            s = (s * 16807 + 0) % 2147483647; // LCG
            const j = s % (i + 1);
            [perm[i], perm[j]] = [perm[j], perm[i]];
        }

        for (let i = 0; i < 512; i++) {
            this.p[i] = perm[i & 255];
        }
    }
}

// 经典 Perlin 噪声
export class PerlinNoise {
    constructor(seed = 42) {
        this.perm = new Permutation(seed);
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(a, b, t) {
        return a + t * (b - a);
    }

    grad(hash, x, y) {
        const h = hash & 3;
        const u = h < 2 ? x : y;
        const v = h < 2 ? y : x;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    noise2D(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const xf = x - Math.floor(x);
        const yf = y - Math.floor(y);
        const u = this.fade(xf);
        const v = this.fade(yf);

        const aa = this.perm.p[this.perm.p[X] + Y];
        const ab = this.perm.p[this.perm.p[X] + Y + 1];
        const ba = this.perm.p[this.perm.p[X + 1] + Y];
        const bb = this.perm.p[this.perm.p[X + 1] + Y + 1];

        const x1 = this.lerp(this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf), u);
        const x2 = this.lerp(this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1), u);

        return this.lerp(x1, x2, v);
    }

    noise2D_normalized(x, y) {
        return (this.noise2D(x, y) + 1) / 2; // 归一化到 [0, 1]
    }
}

// Simplex 噪声实现（2D 优化版本）
export class SimplexNoise {
    constructor(seed = 42) {
        this.perm = new Permutation(seed);
        this.grad3 = [
            [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
            [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
            [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
        ];
        this.F2 = 0.5 * (Math.sqrt(3) - 1);
        this.G2 = (3 - Math.sqrt(3)) / 6;
    }

    dot(g, x, y) {
        return g[0] * x + g[1] * y;
    }

    noise2D(xin, yin) {
        const { F2, G2, perm, grad3 } = this;
        let s = (xin + yin) * F2;
        let i = Math.floor(xin + s);
        let j = Math.floor(yin + s);
        let t = (i + j) * G2;
        let X0 = i - t;
        let Y0 = j - t;
        let x0 = xin - X0;
        let y0 = yin - Y0;

        let i1, j1;
        if (x0 > y0) { i1 = 1; j1 = 0; }
        else { i1 = 0; j1 = 1; }

        let x1 = x0 - i1 + G2;
        let y1 = y0 - j1 + G2;
        let x2 = x0 - 1 + 2 * G2;
        let y2 = y0 - 1 + 2 * G2;

        let ii = i & 255, jj = j & 255;
        let gi0 = perm.p[ii + perm.p[jj]] % 12;
        let gi1 = perm.p[ii + i1 + perm.p[jj + j1]] % 12;
        let gi2 = perm.p[ii + 1 + perm.p[jj + 1]] % 12;

        let n0 = 0, n1 = 0, n2 = 0;

        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 >= 0) { t0 *= t0; n0 = t0 * t0 * this.dot(grad3[gi0], x0, y0); }

        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 >= 0) { t1 *= t1; n1 = t1 * t1 * this.dot(grad3[gi1], x1, y1); }

        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 >= 0) { t2 *= t2; n2 = t2 * t2 * this.dot(grad3[gi2], x2, y2); }

        return 70 * (n0 + n1 + n2);
    }

    noise2D_normalized(x, y) {
        return (this.noise2D(x, y) + 1) / 2;
    }
}
