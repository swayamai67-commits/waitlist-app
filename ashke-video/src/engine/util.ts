import {Easing} from 'remotion';

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const inv = (a: number, b: number, x: number) => clamp((x - a) / (b - a));

// Easing families. Different materials get different curves (see creative-direction.md).
export const E = {
	inOut: Easing.bezier(0.65, 0, 0.35, 1),
	out: Easing.bezier(0.16, 1, 0.3, 1),
	in: Easing.bezier(0.5, 0, 0.75, 0),
	soft: Easing.bezier(0.45, 0.05, 0.25, 1),
	// heavy objects: slow start, committed finish
	heavy: Easing.bezier(0.7, 0, 0.2, 1),
	back: Easing.bezier(0.34, 1.56, 0.64, 1),
	linear: (x: number) => x,
};

// progress of t across [a,b] with easing
export const P = (t: number, a: number, b: number, e: (x: number) => number = E.inOut) => e(inv(a, b, t));

// keyframe interpolation: [[time, value], ...]
export const kf = (t: number, keys: [number, number][], e: (x: number) => number = E.inOut) => {
	if (t <= keys[0][0]) return keys[0][1];
	for (let i = 0; i < keys.length - 1; i++) {
		const [t0, v0] = keys[i];
		const [t1, v1] = keys[i + 1];
		if (t <= t1) return lerp(v0, v1, e(inv(t0, t1, t)));
	}
	return keys[keys.length - 1][1];
};

// damped spring response to an impulse at time t0 (returns displacement, starts at 0, peaks ~1)
export const springHit = (t: number, t0: number, freq = 9, damp = 6) => {
	const x = t - t0;
	if (x < 0) return 0;
	return Math.exp(-damp * x) * Math.sin(freq * x);
};

// critically-damped settle from 1 to 0 after t0
export const settle = (t: number, t0: number, k = 8) => {
	const x = t - t0;
	if (x < 0) return 1;
	return Math.exp(-k * x) * (1 + k * x);
};

export const mulberry = (seed: number) => {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

// smooth deterministic noise 1D
export const noise1 = (x: number, seed = 0) => {
	const h = (n: number) => {
		const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
		return s - Math.floor(s);
	};
	const i = Math.floor(x);
	const f = x - i;
	const u = f * f * (3 - 2 * f);
	return lerp(h(i), h(i + 1), u) * 2 - 1;
};

export const deg = (r: number) => (r * 180) / Math.PI;
export const rad = (d: number) => (d * Math.PI) / 180;
