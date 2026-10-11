import React from 'react';
import {C} from '../engine/palette';
import {rad} from '../engine/util';

/*
 Front-view puppet rig. Origin = between the feet on the ground; height ~360 at s=1.
 Limb angles are degrees from "hanging straight down"; positive swings OUTWARD
 (away from the body), the elbow/knee value is added to the upper segment.
*/
export type Pose = {
	la?: number; le?: number; ra?: number; re?: number; // arms (screen-left / screen-right)
	lh?: number; lk?: number; rh?: number; rk?: number; // legs
	llift?: number; rlift?: number; // foreshortening of a stepping leg 0..1
	lean?: number; // torso lean deg
	head?: number; // head tilt deg
	nod?: number; // head nod px
	bob?: number; // whole-body vertical px (negative = up)
	twist?: number; // -1..1 fake 3/4 turn of face/lapels
	mouth?: number; // 0..1
	seated?: boolean;
	lhand?: 'open' | 'fist' | 'point' | 'glove';
	rhand?: 'open' | 'fist' | 'point' | 'glove';
};

export type Look = {
	id: string;
	skin?: string;
	hair?: 'quiff' | 'short' | 'bald' | 'long' | 'bun' | 'none';
	hairColor?: string;
	beard?: 'full' | 'short' | 'stubble' | 'moustache' | 'none';
	beardColor?: string;
	glasses?: 'gold' | 'sun' | 'none';
	head?: {type: 'turban' | 'flatcap' | 'sunhat' | 'helmet' | 'none'; color?: string; color2?: string};
	coat?: 'suit' | 'tail' | 'overcoat' | 'shacket' | 'kurta' | 'dress' | 'salwar' | 'polo' | 'waistcoat';
	jacket?: string;
	jacketHi?: string;
	pattern?: 'plaid' | 'tweed' | 'none';
	patternColor?: string;
	patternColor2?: string;
	shirt?: string;
	tie?: string;
	vest?: string;
	trousers?: string;
	shoes?: string;
	gloves?: boolean;
	dupatta?: string;
	female?: boolean;
	chain?: boolean;
	pocketSquare?: string;
};

const J = {headY: -330, neck: -300, sh: -284, shW: 42, waist: -196, hip: -176, hipW: 17, thigh: 88, shin: 82, upper: 70, fore: 62};

const seg = (x: number, y: number, ang: number, len: number, side: number) => {
	const a = rad(ang);
	return [x + Math.sin(a) * len * side, y + Math.cos(a) * len];
};

export const Person: React.FC<{x: number; y: number; s?: number; look: Look; pose?: Pose; flip?: boolean; shadow?: boolean; opacity?: number}> = ({x, y, s = 1, look, pose = {}, flip = false, shadow = true, opacity = 1}) => {
	const L = {
		skin: C.skin1,
		hair: 'short' as const,
		hairColor: C.hair,
		beard: 'none' as const,
		beardColor: C.hair,
		glasses: 'none' as const,
		coat: 'suit' as const,
		jacket: C.navy,
		shirt: C.white,
		trousers: C.navy,
		shoes: '#2a1b14',
		pattern: 'none' as const,
		...look,
	};
	const p = {la: 6, le: 0, ra: 6, re: 0, lh: 3, lk: 0, rh: 3, rk: 0, llift: 0, rlift: 0, lean: 0, head: 0, nod: 0, bob: 0, twist: 0, mouth: 0, ...pose};
	const female = !!L.female;
	const seated = !!p.seated;
	const drop = seated ? 92 : 0; // seated lowers the hips
	const hipY = J.hip + drop;
	const tw = p.twist * 7;
	const pid = `pat-${L.id}`;
	const jacketFill = L.pattern !== 'none' ? `url(#${pid})` : L.jacket;
	const longCoat = L.coat === 'overcoat' || L.coat === 'kurta' || L.coat === 'dress' || L.coat === 'salwar' || L.coat === 'shacket';
	const thighW = female ? 22 : 30;
	const shinW = female ? 18 : 25;

	// legs
	const leg = (side: -1 | 1) => {
		const hx = side * J.hipW;
		const ha = side === -1 ? p.lh : p.rh;
		const ka = side === -1 ? p.lk : p.rk;
		const lift = side === -1 ? p.llift : p.rlift;
		if (seated) {
			const kx = hx + side * 8;
			const ky = hipY + 18;
			const [fx, fy] = seg(kx, ky, ha * 0.5, J.shin + 10, side);
			return (
				<g key={side}>
					<ellipse cx={hx + side * 4} cy={hipY + 8} rx={thighW * 0.75} ry={thighW * 0.7} fill={L.trousers} />
					<line x1={kx} y1={ky} x2={fx} y2={fy - 6} stroke={L.trousers} strokeWidth={shinW} strokeLinecap="round" />
					<ellipse cx={fx + side * 3} cy={fy - 3} rx={16} ry={8} fill={L.shoes} />
				</g>
			);
		}
		const tl = J.thigh * (1 - lift * 0.35);
		const [kx, ky] = seg(hx, hipY, ha, tl, side);
		const [fx, fy] = seg(kx, ky, ha + ka, J.shin * (1 - lift * 0.15), side);
		return (
			<g key={side}>
				<line x1={hx} y1={hipY} x2={kx} y2={ky} stroke={L.trousers} strokeWidth={thighW} strokeLinecap="round" />
				<line x1={kx} y1={ky} x2={fx} y2={fy - 6} stroke={L.trousers} strokeWidth={shinW} strokeLinecap="round" />
				<path d={`M${fx - 10},${fy - 10} Q${fx + side * 2},${fy - 16} ${fx + 10 + side * 6},${fy - 6} L${fx + 12 + side * 6},${fy} L${fx - 12},${fy} Z`} fill={L.shoes} />
			</g>
		);
	};

	const hand = (hx: number, hy: number, kind: string | undefined, side: number) => {
		const col = L.gloves || kind === 'glove' ? C.white : L.skin;
		if (kind === 'point')
			return (
				<g>
					<circle cx={hx} cy={hy} r={10} fill={col} />
					<line x1={hx} y1={hy} x2={hx + side * 4} y2={hy - 20} stroke={col} strokeWidth={6} strokeLinecap="round" />
				</g>
			);
		if (kind === 'open')
			return (
				<g>
					<ellipse cx={hx} cy={hy} rx={10} ry={13} fill={col} />
					<line x1={hx - side * 8} y1={hy - 2} x2={hx - side * 14} y2={hy - 12} stroke={col} strokeWidth={5} strokeLinecap="round" />
				</g>
			);
		return <circle cx={hx} cy={hy} r={kind === 'fist' ? 11 : 10} fill={col} />;
	};

	const arm = (side: -1 | 1) => {
		const sx = side * J.shW;
		const sy = J.sh + 4;
		const a = side === -1 ? p.la : p.ra;
		const e = side === -1 ? p.le : p.re;
		const [ex, ey] = seg(sx, sy, a, J.upper, side);
		const [wx, wy] = seg(ex, ey, a + e, J.fore, side);
		const sleeve = L.coat === 'polo' ? L.jacket : L.coat === 'salwar' || L.coat === 'kurta' || L.coat === 'dress' ? L.jacket : L.pattern !== 'none' ? `url(#${pid})` : L.jacket;
		const [hx, hy] = seg(ex, ey, a + e, J.fore + 9, side);
		return (
			<g key={side}>
				<line x1={sx} y1={sy} x2={ex} y2={ey} stroke={sleeve} strokeWidth={female ? 19 : 25} strokeLinecap="round" />
				<line x1={ex} y1={ey} x2={wx} y2={wy} stroke={sleeve} strokeWidth={female ? 16 : 21} strokeLinecap="round" />
				{L.coat !== 'polo' && !female && <line x1={wx} y1={wy} x2={(wx * 3 + hx) / 4} y2={(wy * 3 + hy) / 4} stroke={L.shirt} strokeWidth={14} strokeLinecap="butt" />}
				{hand(hx, hy, side === -1 ? p.lhand : p.rhand, side)}
			</g>
		);
	};

	// torso
	const hem = longCoat ? (female ? -70 : -110) + drop * (seated ? 0.35 : 0) : hipY + 16;
	const torso = (() => {
		const sw = female ? 34 : J.shW;
		const ww = female ? 22 : 30;
		const hw = female ? (L.coat === 'dress' || L.coat === 'salwar' ? 52 : 34) : longCoat ? 40 : 33;
		const d = `M${-sw},${J.sh} C${-sw - 2},${J.sh + 30} ${-ww - 2},${J.waist - 20} ${-ww},${J.waist} L${-hw},${hem} L${hw},${hem} L${ww},${J.waist} C${ww + 2},${J.waist - 20} ${sw + 2},${J.sh + 30} ${sw},${J.sh} Q0,${J.sh - 12} ${-sw},${J.sh} Z`;
		return (
			<g>
				{L.coat === 'tail' && <path d={`M-28,${J.waist} L-34,${hipY + 120} L-6,${hipY + 30} Z M28,${J.waist} L34,${hipY + 120} L6,${hipY + 30} Z`} fill={L.jacket} />}
				<path d={d} fill={jacketFill} />
				{L.jacketHi && <path d={`M${-sw},${J.sh} C${-sw - 2},${J.sh + 30} ${-ww - 2},${J.waist - 20} ${-ww},${J.waist} L${-hw},${hem} L${-hw + 14},${hem} L${-ww + 12},${J.waist} C${-ww + 10},${J.waist - 30} ${-sw + 14},${J.sh + 20} ${-sw + 12},${J.sh} Z`} fill={L.jacketHi} opacity={0.35} />}
				{/* shirt V + tie + lapels */}
				{(L.coat === 'suit' || L.coat === 'tail' || L.coat === 'overcoat' || L.coat === 'waistcoat') && (
					<g transform={`translate(${tw * 0.6},0)`}>
						<path d={`M-15,${J.sh - 6} L0,${J.sh + 58} L15,${J.sh - 6} Z`} fill={L.shirt} />
						{L.vest && <path d={`M-20,${J.sh + 14} L0,${J.sh + 66} L20,${J.sh + 14} L18,${J.waist + 8} L0,${J.waist + 16} L-18,${J.waist + 8} Z`} fill={L.vest} />}
						{L.tie && <path d={`M-5,${J.sh - 2} L5,${J.sh - 2} L7,${J.sh + 46} L0,${J.sh + 56} L-7,${J.sh + 46} Z`} fill={L.tie} />}
						<path d={`M-16,${J.sh - 8} L-28,${J.sh + 26} L-12,${J.sh + 30} L0,${J.sh + 62} L-4,${J.sh + 66} L-26,${J.sh + 14} Z`} fill={L.jacket} stroke="rgba(0,0,0,0.25)" strokeWidth={2} />
						<path d={`M16,${J.sh - 8} L28,${J.sh + 26} L12,${J.sh + 30} L0,${J.sh + 62} L4,${J.sh + 66} L26,${J.sh + 14} Z`} fill={L.jacket} stroke="rgba(0,0,0,0.25)" strokeWidth={2} />
						{[0, 1].map((i) => (
							<g key={i}>
								<circle cx={-9} cy={J.sh + 74 + i * 24} r={3} fill="rgba(0,0,0,0.45)" />
								<circle cx={9} cy={J.sh + 74 + i * 24} r={3} fill="rgba(0,0,0,0.45)" />
							</g>
						))}
						{L.pocketSquare && <path d={`M18,${J.sh + 40} l14,-2 l-3,-9 l-4,6 l-3,-7 l-4,6 Z`} fill={L.pocketSquare} />}
					</g>
				)}
				{L.coat === 'shacket' && (
					<g transform={`translate(${tw * 0.6},0)`}>
						<path d={`M-14,${J.sh - 6} L0,${J.sh + 22} L14,${J.sh - 6} Z`} fill={L.shirt} />
						<path d={`M-20,${J.sh - 10} L-30,${J.sh + 14} L-2,${J.sh + 24} Z M20,${J.sh - 10} L30,${J.sh + 14} L2,${J.sh + 24} Z`} fill={L.patternColor2 ?? L.jacket} opacity={0.9} />
						<line x1={0} y1={J.sh + 24} x2={0} y2={hem} stroke="rgba(0,0,0,0.25)" strokeWidth={3} />
						<rect x={-28} y={J.sh + 44} width={20} height={16} fill="rgba(0,0,0,0.12)" />
						<rect x={8} y={J.sh + 44} width={20} height={16} fill="rgba(0,0,0,0.12)" />
					</g>
				)}
				{L.coat === 'polo' && (
					<g>
						<path d={`M-12,${J.sh - 6} L0,${J.sh + 14} L12,${J.sh - 6} Z`} fill={L.shirt} />
						<rect x={-28} y={J.sh + 40} width={56} height={10} fill={L.shirt} opacity={0.9} />
					</g>
				)}
				{(L.coat === 'kurta' || L.coat === 'salwar' || L.coat === 'dress') && (
					<g>
						<path d={`M-10,${J.sh - 6} Q0,${J.sh + 16} 10,${J.sh - 6}`} fill={L.skin} />
						<path d={`M-8,${J.sh + 10} L8,${J.sh + 10}`} stroke={L.jacketHi ?? C.gold} strokeWidth={3} />
						<path d={`M${-hw + 4},${hem - 10} L${hw - 4},${hem - 10}`} stroke={L.jacketHi ?? C.gold} strokeWidth={5} />
					</g>
				)}
				{L.dupatta && <path d={`M${-sw + 4},${J.sh + 4} C-10,${J.sh + 60} 20,${J.sh + 70} ${sw},${J.sh + 4} L${sw + 6},${J.sh + 120} L${sw - 6},${J.sh + 124} L${sw - 8},${J.sh + 28} C10,${J.sh + 86} -16,${J.sh + 80} ${-sw - 2},${J.sh + 18} Z`} fill={L.dupatta} opacity={0.92} />}
				{L.chain && <path d={`M-14,${J.sh - 2} Q0,${J.sh + 34} 14,${J.sh - 2}`} stroke={C.goldHi} strokeWidth={3.5} fill="none" />}
			</g>
		);
	})();

	// head
	const H = J.headY;
	const head = (() => {
		const fx = tw;
		const hasHat = L.head && L.head.type !== 'none';
		const ht = L.head?.type;
		return (
			<g>
				<rect x={-9} y={J.neck - 6} width={18} height={24} fill={L.skin} />
				<path d={`M-9,${J.neck + 8} Q0,${J.neck + 16} 9,${J.neck + 8} L9,${J.neck + 2} L-9,${J.neck + 2} Z`} fill="rgba(0,0,0,0.18)" />
				{/* long hair behind */}
				{(L.hair === 'long' || L.hair === 'bun') && <path d={`M-24,${H - 8} C-30,${H + 30} -26,${H + 60} -30,${H + 74} L30,${H + 74} C26,${H + 60} 30,${H + 30} 24,${H - 8} Z`} fill={L.hairColor} opacity={L.hair === 'bun' ? 0 : 1} />}
				<ellipse cx={-21 + fx * 0.2} cy={H + 2} rx={4.5} ry={7} fill={L.skin} />
				<ellipse cx={21 + fx * 0.2} cy={H + 2} rx={4.5} ry={7} fill={L.skin} />
				<ellipse cx={fx * 0.3} cy={H} rx={20.5} ry={26} fill={L.skin} />
				{/* hair */}
				{!hasHat && L.hair === 'quiff' && <path d={`M-21,${H - 4} C-24,${H - 30} -6,${H - 44} 10,${H - 40} C22,${H - 38} 28,${H - 26} 22,${H - 6} C20,${H - 18} 12,${H - 22} 0,${H - 22} C-10,${H - 22} -18,${H - 16} -21,${H - 4} Z`} fill={L.hairColor} />}
				{!hasHat && L.hair === 'short' && <path d={`M-21,${H - 2} C-22,${H - 28} 22,${H - 30} 21,${H - 2} C18,${H - 16} -18,${H - 16} -21,${H - 2} Z`} fill={L.hairColor} />}
				{!hasHat && L.hair === 'bald' && <path d={`M-21,${H + 2} C-22,${H - 8} -18,${H - 12} -16,${H - 12} L-16,${H + 4} Z M21,${H + 2} C22,${H - 8} 18,${H - 12} 16,${H - 12} L16,${H + 4} Z`} fill={L.hairColor} />}
				{(L.hair === 'long' || L.hair === 'bun') && !(ht === 'sunhat') && <path d={`M-21,${H} C-24,${H - 30} 24,${H - 30} 21,${H} C14,${H - 14} ${fx},${H - 22} -21,${H} Z`} fill={L.hairColor} />}
				{L.hair === 'bun' && !hasHat && <circle cx={0} cy={H - 30} r={11} fill={L.hairColor} />}
				{/* face */}
				<g transform={`translate(${fx},0)`}>
					{L.glasses === 'none' || !L.glasses ? (
						<g>
							<ellipse cx={-8} cy={H - 1} rx={2.6} ry={3} fill={C.ink} />
							<ellipse cx={8} cy={H - 1} rx={2.6} ry={3} fill={C.ink} />
							<path d={`M-13,${H - 9} L-4,${H - 10} M4,${H - 10} L13,${H - 9}`} stroke={L.hairColor === C.grey || L.hairColor === '#e8e4dc' ? '#9a948a' : C.hair} strokeWidth={2.6} strokeLinecap="round" />
						</g>
					) : (
						<g>
							<path d={`M-13,${H - 9} L-4,${H - 10} M4,${H - 10} L13,${H - 9}`} stroke={C.hair} strokeWidth={3} strokeLinecap="round" />
							<rect x={-17} y={H - 7} width={14} height={10} rx={3} fill={L.glasses === 'sun' ? '#141414' : '#a77b3b'} opacity={L.glasses === 'sun' ? 1 : 0.55} stroke={C.goldHi} strokeWidth={1.6} />
							<rect x={3} y={H - 7} width={14} height={10} rx={3} fill={L.glasses === 'sun' ? '#141414' : '#a77b3b'} opacity={L.glasses === 'sun' ? 1 : 0.55} stroke={C.goldHi} strokeWidth={1.6} />
							<line x1={-3} y1={H - 4} x2={3} y2={H - 4} stroke={C.goldHi} strokeWidth={1.6} />
							<line x1={-17} y1={H - 4} x2={-21} y2={H - 2} stroke={C.goldHi} strokeWidth={1.6} />
							<line x1={17} y1={H - 4} x2={21} y2={H - 2} stroke={C.goldHi} strokeWidth={1.6} />
						</g>
					)}
					<path d={`M0,${H - 2} L-3,${H + 8} L2,${H + 9}`} stroke="rgba(0,0,0,0.3)" strokeWidth={2} fill="none" strokeLinecap="round" />
					{L.beard === 'full' && <path d={`M-21,${H - 2} C-22,${H + 22} -12,${H + 36} 0,${H + 37} C12,${H + 36} 22,${H + 22} 21,${H - 2} C18,${H + 8} 14,${H + 10} 10,${H + 11} C6,${H + 13} -6,${H + 13} -10,${H + 11} C-14,${H + 10} -18,${H + 8} -21,${H - 2} Z`} fill={L.beardColor} />}
					{L.beard === 'short' && <path d={`M-20,${H + 2} C-20,${H + 20} -10,${H + 30} 0,${H + 30} C10,${H + 30} 20,${H + 20} 20,${H + 2} C16,${H + 10} 10,${H + 12} 0,${H + 12} C-10,${H + 12} -16,${H + 10} -20,${H + 2} Z`} fill={L.beardColor} />}
					{L.beard === 'stubble' && <path d={`M-19,${H + 4} C-18,${H + 22} -8,${H + 28} 0,${H + 28} C8,${H + 28} 18,${H + 22} 19,${H + 4}`} fill={L.beardColor} opacity={0.35} />}
					{(L.beard === 'full' || L.beard === 'short' || L.beard === 'moustache') && <path d={`M-11,${H + 13} Q0,${H + 8} 11,${H + 13} Q0,${H + 11} -11,${H + 13} Z`} fill={L.beardColor} stroke={L.beardColor} strokeWidth={3} />}
					<ellipse cx={0} cy={H + 17} rx={5 + p.mouth * 1.5} ry={1.4 + p.mouth * 4} fill={L.beard === 'full' || L.beard === 'short' ? '#3b1f18' : '#7a3b30'} />
				</g>
				{/* headwear */}
				{ht === 'turban' && (
					<g>
						<path d={`M-23,${H - 6} C-28,${H - 40} -14,${H - 56} 0,${H - 58} C14,${H - 56} 28,${H - 40} 23,${H - 6} C14,${H - 14} -14,${H - 14} -23,${H - 6} Z`} fill={L.head!.color} />
						<path d={`M-22,${H - 10} C-10,${H - 40} 4,${H - 50} 14,${H - 52} M-20,${H - 20} C-6,${H - 46} 10,${H - 54} 20,${H - 46} M-16,${H - 12} L2,${H - 56}`} stroke="rgba(0,0,0,0.18)" strokeWidth={3} fill="none" />
						<path d={`M-23,${H - 6} C-14,${H - 14} 14,${H - 14} 23,${H - 6}`} stroke={L.head!.color2 ?? 'rgba(0,0,0,0.2)'} strokeWidth={3} fill="none" />
					</g>
				)}
				{ht === 'flatcap' && (
					<g>
						<path d={`M-23,${H - 8} C-24,${H - 34} 22,${H - 38} 24,${H - 12} L32,${H - 6} C20,${H - 2} -10,${H - 4} -23,${H - 8} Z`} fill={L.head!.color} />
						<path d={`M-20,${H - 14} C-10,${H - 22} 10,${H - 24} 22,${H - 14}`} stroke="rgba(0,0,0,0.25)" strokeWidth={2} fill="none" />
					</g>
				)}
				{ht === 'helmet' && (
					<g>
						<path d={`M-24,${H - 2} C-26,${H - 40} 26,${H - 40} 24,${H - 2} Z`} fill={L.head!.color ?? C.white} />
						<path d={`M-26,${H - 4} L30,${H - 4} L30,${H} L-26,${H} Z`} fill={L.head!.color2 ?? C.navy} />
					</g>
				)}
				{ht === 'sunhat' && (
					<g>
						<path d={`M-20,${H - 12} C-22,${H - 46} 22,${H - 46} 20,${H - 12} Z`} fill={L.head!.color} />
						<ellipse cx={0} cy={H - 12} rx={58} ry={11} fill={L.head!.color} />
						<rect x={-20} y={H - 22} width={40} height={8} fill={L.head!.color2 ?? C.burgundy} />
					</g>
				)}
			</g>
		);
	})();

	const bodyBob = p.bob;
	return (
		<g transform={`translate(${x},${y}) scale(${flip ? -s : s},${s})`} opacity={opacity}>
			{L.pattern !== 'none' && (
				<defs>
					<pattern id={pid} width={L.pattern === 'plaid' ? 26 : 8} height={L.pattern === 'plaid' ? 26 : 8} patternUnits="userSpaceOnUse">
						<rect width={30} height={30} fill={L.jacket} />
						{L.pattern === 'plaid' ? (
							<>
								<rect x={0} y={10} width={26} height={5} fill={L.patternColor} opacity={0.55} />
								<rect x={10} y={0} width={5} height={26} fill={L.patternColor} opacity={0.55} />
								<rect x={0} y={22} width={26} height={1.5} fill={L.patternColor2 ?? C.burgundy} opacity={0.7} />
								<rect x={22} y={0} width={1.5} height={26} fill={L.patternColor2 ?? C.burgundy} opacity={0.7} />
							</>
						) : (
							<>
								<path d="M0,8 L8,0" stroke={L.patternColor} strokeWidth={1.4} opacity={0.5} />
								<path d="M0,4 L4,0 M4,8 L8,4" stroke={L.patternColor2 ?? L.patternColor} strokeWidth={0.9} opacity={0.35} />
							</>
						)}
					</pattern>
				</defs>
			)}
			{shadow && <ellipse cx={0} cy={0} rx={70} ry={10} fill="#000" opacity={0.18} />}
			<g transform={`translate(0,${bodyBob})`}>
				{leg(-1)}
				{leg(1)}
				<g transform={`rotate(${p.lean} 0 ${hipY})`}>
					{torso}
					<g transform={`translate(0,${p.nod}) rotate(${p.head} 0 ${J.neck})`}>{head}</g>
					{arm(-1)}
					{arm(1)}
				</g>
			</g>
		</g>
	);
};

// handy walk cycle (front-ish view). phase in cycles.
export const walkPose = (phase: number, amp = 1): Pose => {
	const s = Math.sin(phase * Math.PI * 2);
	const c = Math.cos(phase * Math.PI * 2);
	return {
		lh: 4 + s * 6 * amp,
		rh: 4 - s * 6 * amp,
		lk: Math.max(0, -s) * -6,
		rk: Math.max(0, s) * -6,
		llift: Math.max(0, s) * 0.55 * amp,
		rlift: Math.max(0, -s) * 0.55 * amp,
		la: 8 - s * 10 * amp,
		ra: 8 + s * 10 * amp,
		le: -10,
		re: -10,
		bob: -Math.abs(c) * 6 * amp,
		head: s * 1.5,
	};
};
