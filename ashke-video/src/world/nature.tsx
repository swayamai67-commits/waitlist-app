import React, {useMemo} from 'react';
import {C} from '../engine/palette';
import {mulberry, noise1} from '../engine/util';

export const Sky: React.FC<{top?: string; low?: string; mid?: string; y0?: number; y1?: number; id?: string}> = ({top = C.skyTop, low = C.skyLow, mid, y0 = -400, y1 = 1300, id = 'sky'}) => (
	<>
		<defs>
			<linearGradient id={id} x1="0" y1={y0} x2="0" y2={y1} gradientUnits="userSpaceOnUse">
				<stop offset="0" stopColor={top} />
				{mid && <stop offset="0.6" stopColor={mid} />}
				<stop offset="1" stopColor={low} />
			</linearGradient>
		</defs>
		<rect x={-1600} y={y0 - 1200} width={5120} height={y1 - y0 + 2400} fill={`url(#${id})`} />
	</>
);

// soft cloud made of radial-gradient puffs (no blur filters: cheap to render)
export const Cloud: React.FC<{x: number; y: number; s?: number; seed?: number; color?: string; opacity?: number; shade?: string}> = ({x, y, s = 1, seed = 1, color = C.cloud, opacity = 0.9, shade = '#c9cdc8'}) => {
	const puffs = useMemo(() => {
		const r = mulberry(seed);
		const n = 7 + Math.floor(r() * 5);
		return Array.from({length: n}, (_, i) => ({
			cx: (i / (n - 1) - 0.5) * 520 + (r() - 0.5) * 60,
			cy: -Math.sin((i / (n - 1)) * Math.PI) * (40 + r() * 50) + (r() - 0.5) * 20,
			rx: 90 + r() * 90,
			ry: 55 + r() * 45,
		}));
	}, [seed]);
	const gid = `cl${seed}`;
	return (
		<g transform={`translate(${x},${y}) scale(${s})`} opacity={opacity}>
			<defs>
				<radialGradient id={gid}>
					<stop offset="0" stopColor={color} stopOpacity="1" />
					<stop offset="0.55" stopColor={color} stopOpacity="0.85" />
					<stop offset="1" stopColor={color} stopOpacity="0" />
				</radialGradient>
				<radialGradient id={gid + 's'}>
					<stop offset="0" stopColor={shade} stopOpacity="0.8" />
					<stop offset="1" stopColor={shade} stopOpacity="0" />
				</radialGradient>
			</defs>
			{puffs.map((p, i) => (
				<ellipse key={'s' + i} cx={p.cx + 10} cy={p.cy + 38} rx={p.rx * 1.05} ry={p.ry * 0.8} fill={`url(#${gid}s)`} />
			))}
			{puffs.map((p, i) => (
				<ellipse key={i} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} fill={`url(#${gid})`} />
			))}
		</g>
	);
};

export const Clouds: React.FC<{t: number; y?: number; speed?: number; color?: string; shade?: string; opacity?: number; seed?: number; count?: number}> = ({t, y = 250, speed = 6, color, shade, opacity = 0.85, seed = 3, count = 6}) => {
	const r = mulberry(seed);
	const items = Array.from({length: count}, (_, i) => ({x: -600 + i * (3100 / count) + r() * 200, y: y + (r() - 0.5) * 260, s: 0.7 + r() * 0.8, seed: seed * 10 + i}));
	return (
		<g>
			{items.map((c, i) => {
				const span = 3600;
				const xx = ((((c.x + t * speed * (0.6 + c.s * 0.4)) % span) + span) % span) - 900;
				return <Cloud key={i} x={xx} y={c.y} s={c.s} seed={c.seed} color={color} shade={shade} opacity={opacity} />;
			})}
		</g>
	);
};

// English oak: clustered canopy with three tones, darker underside
export const Tree: React.FC<{x: number; y: number; s?: number; seed?: number; t?: number; dark?: string; mid?: string; hi?: string; trunk?: string; shape?: 'oak' | 'poplar' | 'willow'}> = ({
	x,
	y,
	s = 1,
	seed = 1,
	t = 0,
	dark = C.tree3,
	mid = C.tree1,
	hi = C.tree2,
	trunk = '#3a2c22',
	shape = 'oak',
}) => {
	const data = useMemo(() => {
		const r = mulberry(seed * 7 + 3);
		const w = shape === 'poplar' ? 90 : shape === 'willow' ? 260 : 220;
		const h = shape === 'poplar' ? 420 : shape === 'willow' ? 240 : 230;
		const n = shape === 'poplar' ? 16 : 26;
		const blobs = Array.from({length: n}, () => {
			const a = r() * Math.PI * 2;
			const d = Math.sqrt(r());
			return {cx: Math.cos(a) * d * w * 0.5, cy: Math.sin(a) * d * h * 0.5, r: (shape === 'poplar' ? 30 : 46) + r() * 34};
		});
		return {blobs, w, h};
	}, [seed, shape]);
	const sway = noise1(t * 0.35, seed) * 3;
	const cy = shape === 'poplar' ? -330 : shape === 'willow' ? -230 : -250;
	return (
		<g transform={`translate(${x},${y}) scale(${s})`}>
			<path d={`M-14,0 C-10,-60 -12,-110 -6,${cy + 40} L6,${cy + 40} C12,-110 10,-60 16,0 Z`} fill={trunk} />
			<path d={`M-4,${cy + 70} L-60,${cy + 10} M2,${cy + 90} L58,${cy + 20}`} stroke={trunk} strokeWidth={9} strokeLinecap="round" />
			<g transform={`translate(0,${cy}) rotate(${sway})`}>
				{data.blobs.map((b, i) => (
					<circle key={'d' + i} cx={b.cx} cy={b.cy + 14} r={b.r} fill={dark} />
				))}
				{data.blobs.map((b, i) => (
					<circle key={'m' + i} cx={b.cx - 4} cy={b.cy + 2} r={b.r * 0.9} fill={mid} />
				))}
				{data.blobs
					.filter((b) => b.cy < 10 && b.cx < data.w * 0.2)
					.map((b, i) => (
						<circle key={'h' + i} cx={b.cx - 12} cy={b.cy - 10} r={b.r * 0.55} fill={hi} />
					))}
				{shape === 'willow' &&
					Array.from({length: 22}, (_, i) => {
						const xx = -150 + i * 14;
						const len = 120 + ((i * 37) % 70);
						const sw = noise1(t * 0.6 + i * 0.3, seed) * 10;
						return <path key={'w' + i} d={`M${xx},0 Q${xx + sw * 0.5},${len * 0.5} ${xx + sw},${len}`} stroke={mid} strokeWidth={10} fill="none" strokeLinecap="round" />;
					})}
			</g>
		</g>
	);
};

// A tree line on the horizon: overlapping canopies at small scale
export const TreeLine: React.FC<{y: number; x0?: number; x1?: number; s?: number; seed?: number; t?: number; dark?: string; mid?: string; hi?: string; density?: number}> = ({
	y,
	x0 = -500,
	x1 = 2420,
	s = 0.5,
	seed = 11,
	t = 0,
	dark,
	mid,
	hi,
	density = 120,
}) => {
	const r = mulberry(seed);
	const items: {x: number; s: number; shape: 'oak' | 'poplar'; seed: number}[] = [];
	for (let x = x0; x < x1; x += density * (0.6 + r() * 0.7)) items.push({x, s: s * (0.7 + r() * 0.6), shape: r() < 0.2 ? 'poplar' : 'oak', seed: Math.floor(r() * 1000)});
	return (
		<g>
			{items.map((it, i) => (
				<Tree key={i} x={it.x} y={y} s={it.s} seed={it.seed} shape={it.shape} t={t} dark={dark} mid={mid} hi={hi} />
			))}
		</g>
	);
};

// Striped, freshly mown lawn in perspective
export const Lawn: React.FC<{horizon: number; vpx?: number; a?: string; b?: string; bottom?: number; stripes?: number; shift?: number}> = ({horizon, vpx = 960, a = C.lawnA, b = C.lawnB, bottom = 2400, stripes = 26, shift = 0}) => {
	const polys = [];
	const spread = 520;
	for (let i = -stripes; i < stripes; i++) {
		if (i % 2 !== 0) continue;
		const xa = vpx + (i + shift) * 22;
		const xb = vpx + (i + 1 + shift) * 22;
		const k = (bottom - horizon) / 100;
		const xa2 = vpx + (i + shift) * spread * k * 0.1;
		const xb2 = vpx + (i + 1 + shift) * spread * k * 0.1;
		polys.push(<polygon key={i} points={`${xa},${horizon} ${xb},${horizon} ${xb2},${bottom} ${xa2},${bottom}`} fill={b} />);
	}
	return (
		<g>
			<defs>
				<linearGradient id="lawnfade" x1="0" y1={horizon} x2="0" y2={horizon + 260} gradientUnits="userSpaceOnUse">
					<stop offset="0" stopColor="#c9d2b5" stopOpacity="0.45" />
					<stop offset="1" stopColor="#c9d2b5" stopOpacity="0" />
				</linearGradient>
			</defs>
			<rect x={-1600} y={horizon} width={5120} height={bottom - horizon + 400} fill={a} />
			{polys}
			<rect x={-1600} y={horizon} width={5120} height={300} fill="url(#lawnfade)" />
		</g>
	);
};

export const Hedge: React.FC<{x: number; y: number; w: number; h: number; color?: string; dark?: string; seed?: number}> = ({x, y, w, h, color = C.tree1, dark = C.tree3, seed = 2}) => {
	const r = mulberry(seed);
	const bumps = Math.max(3, Math.floor(w / 46));
	let top = `M${x},${y} L${x},${y - h + 14}`;
	for (let i = 0; i < bumps; i++) {
		const x1 = x + ((i + 0.5) / bumps) * w;
		const x2 = x + ((i + 1) / bumps) * w;
		top += ` Q${x1},${y - h - 6 - r() * 10} ${x2},${y - h + 10 + r() * 6}`;
	}
	top += ` L${x + w},${y} Z`;
	return (
		<g>
			<path d={top} fill={color} />
			<rect x={x} y={y - h * 0.35} width={w} height={h * 0.35} fill={dark} opacity={0.45} />
		</g>
	);
};

export const Topiary: React.FC<{x: number; y: number; s?: number; kind?: 'cone' | 'ball'}> = ({x, y, s = 1, kind = 'cone'}) => (
	<g transform={`translate(${x},${y}) scale(${s})`}>
		<rect x={-26} y={-30} width={52} height={30} fill="#8a5a3c" />
		<rect x={-30} y={-36} width={60} height={8} fill="#a06d4a" />
		{kind === 'cone' ? (
			<>
				<path d="M0,-210 C26,-150 46,-90 44,-46 L-44,-46 C-46,-90 -26,-150 0,-210 Z" fill={C.tree1} />
				<path d="M0,-210 C-26,-150 -46,-90 -44,-46 L-10,-46 C-16,-100 -8,-160 0,-210 Z" fill={C.tree2} />
			</>
		) : (
			<>
				<circle cx={0} cy={-90} r={52} fill={C.tree1} />
				<circle cx={-14} cy={-104} r={30} fill={C.tree2} />
			</>
		)}
	</g>
);

export const Gravel: React.FC<{y: number; h: number; color?: string; seed?: number; x0?: number; x1?: number}> = ({y, h, color = '#cdbd9c', seed = 5, x0 = -1600, x1 = 3520}) => {
	const dots = useMemo(() => {
		const r = mulberry(seed);
		return Array.from({length: 260}, () => ({x: x0 + r() * (x1 - x0), y: y + r() * h, r: 1.5 + r() * 3, c: r() < 0.5 ? '#b3a281' : '#e2d6bc'}));
	}, [seed, y, h, x0, x1]);
	return (
		<g>
			<rect x={x0} y={y} width={x1 - x0} height={h} fill={color} />
			{dots.map((d, i) => (
				<circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.c} />
			))}
		</g>
	);
};
