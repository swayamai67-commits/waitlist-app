import {continueRender, delayRender, staticFile} from 'remotion';

// All fonts are SIL OFL, bundled locally from @fontsource so renders are deterministic and offline.
const faces: [string, string, string, string][] = [
	// family, file, weight, style
	['Rozha', 'fonts/rozha-deva.woff2', '400', 'normal'],
	['Rozha', 'fonts/rozha-latin.woff2', '400', 'normal'],
	['Tiro', 'fonts/tiro-deva.woff2', '400', 'normal'],
	['Tiro', 'fonts/tiro-latin.woff2', '400', 'normal'],
	['Pinyon', 'fonts/pinyon.woff2', '400', 'normal'],
	['Corm', 'fonts/corm-500.woff2', '500', 'normal'],
	['Corm', 'fonts/corm-700.woff2', '700', 'normal'],
	['Corm', 'fonts/corm-600i.woff2', '600', 'italic'],
	['Anek', 'fonts/anek-deva-800.woff2', '800', 'normal'],
	['Anek', 'fonts/anek-latin-800.woff2', '800', 'normal'],
];

let loaded = false;
export const loadFonts = () => {
	if (loaded || typeof document === 'undefined') return;
	loaded = true;
	const h = delayRender('fonts');
	Promise.all(
		faces.map(([fam, file, weight, style]) => {
			const f = new FontFace(fam, `url(${staticFile(file)})`, {weight, style});
			return f.load().then((ff) => (document as any).fonts.add(ff));
		}),
	)
		.then(() => continueRender(h))
		.catch((e) => {
			console.error(e);
			continueRender(h);
		});
};

export const FONT = {
	deva: "'Tiro', serif",
	display: "'Rozha', serif",
	script: "'Pinyon', cursive",
	latin: "'Corm', serif",
	kinetic: "'Anek', sans-serif",
};
