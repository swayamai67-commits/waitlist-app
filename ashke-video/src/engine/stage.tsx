import React, {createContext, useContext} from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';

export type Format = {W: number; H: number; vertical: boolean};
export const FormatCtx = createContext<Format>({W: 1920, H: 1080, vertical: false});
export const useFormat = () => useContext(FormatCtx);

// Song time (seconds) for the current frame, shared by every component.
export const TimeCtx = createContext<number>(0);
export const useT = () => useContext(TimeCtx);

/*
 Every scene is drawn on a 1920x1920 STAGE. The central 1080x1080 square is the
 "core": it is visible in both formats. Landscape (1920x1080) sees the full width
 and the band y 420..1500; vertical (1080x1920) sees the full height and the band
 x 420..1500 (shifted by `vx` so the subject stays centred).
*/
export type Cam = {x?: number; y?: number; z?: number; r?: number; vx?: number; vy?: number; vz?: number};

export const Stage: React.FC<{cam?: Cam; children: React.ReactNode; style?: React.CSSProperties}> = ({cam = {}, children, style}) => {
	const {W, H, vertical} = useFormat();
	const x = vertical && cam.vx !== undefined ? cam.vx : cam.x ?? 960;
	const y = vertical && cam.vy !== undefined ? cam.vy : cam.y ?? 960;
	const z = vertical && cam.vz !== undefined ? cam.vz : cam.z ?? 1;
	const r = cam.r ?? 0;
	return (
		<AbsoluteFill style={{overflow: 'hidden', ...style}}>
			<div
				style={{
					position: 'absolute',
					left: 0,
					top: 0,
					width: 1920,
					height: 1920,
					transformOrigin: '0 0',
					transform: `translate(${W / 2}px, ${H / 2}px) scale(${z}) rotate(${r}deg) translate(${-x}px, ${-y}px)`,
				}}
			>
				{children}
			</div>
		</AbsoluteFill>
	);
};

// An SVG layer in stage coordinates. Overflow visible so backgrounds can bleed.
export const Layer: React.FC<{children: React.ReactNode; dx?: number; dy?: number; s?: number; style?: React.CSSProperties}> = ({children, dx = 0, dy = 0, s = 1, style}) => (
	<svg
		width={1920}
		height={1920}
		viewBox="0 0 1920 1920"
		style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', transform: `translate(${dx}px, ${dy}px) scale(${s})`, transformOrigin: '960px 960px', ...style}}
	>
		{children}
	</svg>
);

// Film grain + vignette, shared by all scenes
export const Grain: React.FC<{t: number; amount?: number; vignette?: number}> = ({t, amount = 0.1, vignette = 0.45}) => {
	const f = Math.floor(t * 24);
	const ox = (f * 137) % 512;
	const oy = (f * 291) % 512;
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			<AbsoluteFill
				style={{
					backgroundImage: `url(${staticFile('grain.png')})`,
					backgroundPosition: `${ox}px ${oy}px`,
					mixBlendMode: 'overlay',
					opacity: amount,
				}}
			/>
			<AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 48%, rgba(0,0,0,0) 52%, rgba(10,6,4,${vignette}) 100%)`}} />
		</AbsoluteFill>
	);
};

export const Grade: React.FC<{color: string; mode?: React.CSSProperties['mixBlendMode']; opacity?: number; bg?: string}> = ({color, mode = 'soft-light', opacity = 1, bg}) => (
	<AbsoluteFill style={{background: bg ?? color, mixBlendMode: mode, opacity, pointerEvents: 'none'}} />
);

export const useImg = () => Img;
