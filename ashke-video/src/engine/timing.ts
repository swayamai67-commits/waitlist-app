import words from '../data/word-timestamps.json';
import phrases from '../data/phrases.json';
import beatmap from '../data/beat-map.json';

export type Word = {word: string; start: number; end: number};
export type Phrase = {line: number; start: number; end: number; text: string; halves: number[][]; words: number[]};

export const WORDS = words as Word[];
export const LINES = phrases as Phrase[];
export const BEATS: number[] = (beatmap as any).beats;
export const ONSETS: number[] = (beatmap as any).onsets;
const RMS: [number, number][] = (beatmap as any).rms;

export const FPS = 30;
export const SONG_DURATION = 217.8;

// Reel window in song time (matched to the official reel by onset cross-correlation, score 0.97)
export const REEL_START = 47.15;
export const REEL_END = 91.75;

export const lineAt = (t: number) => LINES.find((l) => t >= l.start && t < l.end);

// time since most recent beat (seconds) and its index
export const lastBeat = (t: number) => {
	let lo = 0;
	let hi = BEATS.length - 1;
	if (t < BEATS[0]) return {i: -1, dt: 99};
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (BEATS[mid] <= t) lo = mid;
		else hi = mid - 1;
	}
	return {i: lo, dt: t - BEATS[lo]};
};

// beat pulse 1 -> 0 decaying after each beat. Use at low amplitude only.
export const pulse = (t: number, decay = 7) => {
	const {dt} = lastBeat(t);
	return dt > 2 ? 0 : Math.exp(-decay * dt);
};

// loudness 0..1 normalised
export const energy = (t: number) => {
	const i = Math.max(0, Math.min(RMS.length - 1, Math.round(t / (RMS[1][0] - RMS[0][0]))));
	return Math.min(1, RMS[i][1] / 0.5);
};

export const wordIndexByText = (text: string, after = 0) =>
	WORDS.findIndex((w, i) => i >= 0 && w.start >= after && w.word.replace(/[,।.'’]/g, '') === text);

export const findWord = (text: string, after = 0) => {
	const i = WORDS.findIndex((w) => w.start >= after && w.word.replace(/[,।.'’]/g, '').includes(text));
	return i >= 0 ? WORDS[i] : {word: text, start: after, end: after + 0.4};
};
