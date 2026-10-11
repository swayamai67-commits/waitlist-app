import React from 'react';
import {C} from '../engine/palette';

type Lit = {lit?: number}; // 0 day .. 1 night (windows glow)

const Win: React.FC<{x: number; y: number; w: number; h: number; lit?: number; cols?: number; rows?: number}> = ({x, y, w, h, lit = 0, cols = 2, rows = 2}) => {
	const glass = lit > 0.5 ? '#f2c46a' : '#3a4542';
	return (
		<g>
			<rect x={x - 5} y={y - 5} width={w + 10} height={h + 10} fill={C.stone} />
			<rect x={x} y={y} width={w} height={h} fill={glass} />
			{lit < 0.5 && <path d={`M${x},${y + h} L${x + w * 0.65},${y} L${x + w},${y} L${x + w},${y + h * 0.15} L${x + w * 0.3},${y + h} Z`} fill="#6c7b77" opacity={0.45} />}
			{lit > 0 && <rect x={x} y={y} width={w} height={h} fill="#ffd27a" opacity={lit * 0.85} />}
			{Array.from({length: cols - 1}, (_, i) => (
				<rect key={'c' + i} x={x + ((i + 1) * w) / cols - 2.5} y={y} width={5} height={h} fill={C.stone} />
			))}
			{Array.from({length: rows - 1}, (_, i) => (
				<rect key={'r' + i} x={x} y={y + ((i + 1) * h) / rows - 2.5} width={w} height={5} fill={C.stone} />
			))}
			<rect x={x - 9} y={y - 12} width={w + 18} height={8} fill={C.stoneDark} />
		</g>
	);
};

const Chimney: React.FC<{x: number; y: number; h: number; n?: number}> = ({x, y, h, n = 3}) => (
	<g>
		{Array.from({length: n}, (_, i) => (
			<g key={i}>
				<rect x={x + i * 22} y={y - h} width={18} height={h} fill={C.brick} />
				<rect x={x + i * 22} y={y - h} width={6} height={h} fill={C.brickDark} opacity={0.5} />
				<rect x={x + i * 22 - 3} y={y - h - 8} width={24} height={9} fill={C.brickDark} />
				<rect x={x + i * 22 - 1} y={y - h * 0.55} width={20} height={4} fill={C.brickDark} opacity={0.6} />
			</g>
		))}
		<rect x={x - 6} y={y - 14} width={n * 22 + 10} height={14} fill={C.brickDark} />
	</g>
);

const Gable: React.FC<{x: number; y: number; w: number; h: number; lit?: number}> = ({x, y, w, h, lit = 0}) => {
	// stepped/straight Tudor gable rising from wall top y
	const cx = x + w / 2;
	return (
		<g>
			<path d={`M${x},${y} L${cx},${y - h} L${x + w},${y} Z`} fill={C.brick} />
			<path d={`M${x - 10},${y + 4} L${cx},${y - h - 8} L${x + w + 10},${y + 4}`} stroke={C.stone} strokeWidth={12} fill="none" strokeLinejoin="miter" />
			<rect x={cx - 5} y={y - h - 28} width={10} height={22} fill={C.stone} />
			<circle cx={cx} cy={y - h - 32} r={7} fill={C.stone} />
			<Win x={cx - w * 0.16} y={y - h * 0.62} w={w * 0.32} h={h * 0.4} lit={lit} cols={2} rows={1} />
		</g>
	);
};

const Turret: React.FC<{x: number; y: number; w: number; h: number; lit?: number}> = ({x, y, w, h, lit = 0}) => {
	const cx = x + w / 2;
	const top = y - h;
	return (
		<g>
			<rect x={x} y={top} width={w} height={h} fill={C.brick} />
			<rect x={x} y={top} width={w * 0.22} height={h} fill={C.brickDark} opacity={0.35} />
			{[0.2, 0.48].map((k, i) => (
				<Win key={i} x={cx - w * 0.18} y={top + h * k} w={w * 0.36} h={h * 0.16} lit={lit} cols={1} rows={2} />
			))}
			<rect x={x - 8} y={top - 14} width={w + 16} height={16} fill={C.stone} />
			{/* ogee lead cupola */}
			<path
				d={`M${x - 4},${top - 14} C${x - 4},${top - 60} ${cx - w * 0.35},${top - 70} ${cx - w * 0.1},${top - 110} C${cx - 4},${top - 128} ${cx},${top - 140} ${cx},${top - 150} C${cx},${top - 140} ${cx + 4},${top - 128} ${cx + w * 0.1},${top - 110} C${cx + w * 0.35},${top - 70} ${x + w + 4},${top - 60} ${x + w + 4},${top - 14} Z`}
				fill={C.lead}
			/>
			<path d={`M${x - 4},${top - 14} C${x - 4},${top - 60} ${cx - w * 0.35},${top - 70} ${cx - w * 0.1},${top - 110} L${cx - w * 0.02},${top - 112} C${cx - w * 0.2},${top - 72} ${x + w * 0.2},${top - 50} ${x + w * 0.24},${top - 14} Z`} fill={C.leadHi} opacity={0.7} />
			<rect x={cx - 2} y={top - 190} width={4} height={44} fill={C.lead} />
			<circle cx={cx} cy={top - 166} r={6} fill={C.gold} />
		</g>
	);
};

// Red-brick Tudor-revival manor, base centre at (x,y). ~1500 wide at s=1.
export const Manor: React.FC<{x: number; y: number; s?: number} & Lit> = ({x, y, s = 1, lit = 0}) => {
	const wallH = 300;
	const wing = (ox: number, n: number, key: string) => (
		<g key={key}>
			<rect x={ox} y={-wallH} width={n * 150} height={wallH} fill={C.brick} />
			{/* diaper pattern */}
			{Array.from({length: n * 3}, (_, i) => (
				<path key={i} d={`M${ox + i * 50 + 25},${-wallH + 40} l18,30 l-18,30 l-18,-30 Z`} fill="none" stroke={C.brickDark} strokeWidth={3} opacity={0.35} />
			))}
			<rect x={ox} y={-wallH + 150} width={n * 150} height={10} fill={C.stone} />
			{Array.from({length: n}, (_, i) => (
				<g key={'g' + i}>
					<Gable x={ox + i * 150 + 6} y={-wallH} w={138} h={110} lit={lit} />
					<Win x={ox + i * 150 + 38} y={-wallH + 40} w={74} h={90} lit={lit} cols={3} rows={2} />
					<Win x={ox + i * 150 + 38} y={-wallH + 186} w={74} h={90} lit={lit} cols={3} rows={2} />
				</g>
			))}
		</g>
	);
	return (
		<g transform={`translate(${x},${y}) scale(${s})`}>
			{/* roof mass behind */}
			<rect x={-760} y={-wallH - 70} width={1520} height={80} fill="#5b4a44" />
			<Chimney x={-620} y={-wallH - 60} h={150} n={3} />
			<Chimney x={-250} y={-wallH - 60} h={175} n={2} />
			<Chimney x={210} y={-wallH - 60} h={175} n={2} />
			<Chimney x={560} y={-wallH - 60} h={150} n={3} />
			{wing(-760, 3, 'L')}
			{wing(310, 3, 'R')}
			{/* central block */}
			<rect x={-310} y={-wallH - 40} width={620} height={wallH + 40} fill={C.brickHi} />
			<rect x={-310} y={-wallH + 150} width={620} height={10} fill={C.stone} />
			<Turret x={-330} y={0} w={92} h={wallH + 110} lit={lit} />
			<Turret x={238} y={0} w={92} h={wallH + 110} lit={lit} />
			<Gable x={-200} y={-wallH - 40} w={400} h={170} lit={lit} />
			{[-200, -80, 40, 160].map((wx, i) => (
				<Win key={i} x={wx - 14} y={-wallH + 10} w={68} h={110} lit={lit} cols={2} rows={3} />
			))}
			{/* porch */}
			<rect x={-90} y={-170} width={180} height={170} fill={C.stone} />
			<path d="M-62,0 L-62,-100 Q0,-160 62,-100 L62,0 Z" fill={lit > 0.5 ? '#f2b85e' : '#2c2420'} />
			<path d="M-100,-170 L0,-230 L100,-170 Z" fill={C.stoneDark} />
			<rect x={-30} y={-212} width={60} height={30} fill={C.brick} />
			{[-250, -170, 110, 190].map((wx, i) => (
				<Win key={'d' + i} x={wx} y={-125} w={60} h={95} lit={lit} cols={2} rows={2} />
			))}
			{/* steps */}
			<rect x={-130} y={-12} width={260} height={12} fill={C.stoneDark} />
			<rect x={-110} y={-22} width={220} height={10} fill={C.stone} />
			{/* foundation shadow */}
			<rect x={-780} y={-8} width={1560} height={8} fill="#000" opacity={0.18} />
			{/* night glow halo */}
			{lit > 0 && <rect x={-780} y={-wallH - 260} width={1560} height={wallH + 260} fill="#ffb24a" opacity={lit * 0.06} />}
		</g>
	);
};

export const Gates: React.FC<{x: number; y: number; s?: number; open?: number}> = ({x, y, s = 1, open = 0}) => {
	// wrought-iron double gate between stone piers; open 0..1 swings leaves (foreshortened)
	const leaf = (side: -1 | 1) => {
		const w = 300 * (1 - open * 0.85);
		const bars = 13;
		const x0 = side === -1 ? -300 : 0;
		return (
			<g transform={`translate(${side === -1 ? -300 : 300},0) scale(${side === -1 ? 1 : -1},1)`}>
				<g transform={`scale(${w / 300},1)`}>
					{Array.from({length: bars}, (_, i) => {
						const bx = (i / (bars - 1)) * 290 + 5;
						const top = -560 + Math.sin((i / (bars - 1)) * Math.PI * 0.5) * -60 + 40;
						return (
							<g key={i}>
								<rect x={bx - 3} y={top} width={6} height={-top} fill={C.ink} />
								<path d={`M${bx},${top - 22} l7,16 l-7,-4 l-7,4 Z`} fill={C.gold} />
							</g>
						);
					})}
					<rect x={0} y={-420} width={300} height={8} fill={C.ink} />
					<rect x={0} y={-120} width={300} height={8} fill={C.ink} />
					{Array.from({length: 6}, (_, i) => (
						<circle key={i} cx={25 + i * 50} cy={-270} r={20} fill="none" stroke={C.ink} strokeWidth={5} />
					))}
					<path d="M60,-420 Q150,-520 290,-500" stroke={C.ink} strokeWidth={6} fill="none" />
					<circle cx={290} cy={-270} r={34} fill="none" stroke={C.gold} strokeWidth={6} />
				</g>
				{void x0}
			</g>
		);
	};
	const pier = (px: number) => (
		<g>
			<rect x={px - 50} y={-640} width={100} height={640} fill={C.stone} />
			<rect x={px - 50} y={-640} width={28} height={640} fill={C.stoneDark} opacity={0.6} />
			{Array.from({length: 9}, (_, i) => (
				<rect key={i} x={px - 50} y={-600 + i * 68} width={100} height={4} fill={C.stoneDark} opacity={0.6} />
			))}
			<rect x={px - 64} y={-668} width={128} height={30} fill={C.stoneDark} />
			<path d={`M${px - 40},-668 Q${px},-760 ${px + 40},-668 Z`} fill={C.stone} />
			<circle cx={px} cy={-760} r={26} fill={C.stone} />
		</g>
	);
	return (
		<g transform={`translate(${x},${y}) scale(${s})`}>
			{leaf(-1)}
			{leaf(1)}
			{pier(-350)}
			{pier(350)}
		</g>
	);
};
