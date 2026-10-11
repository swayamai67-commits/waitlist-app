import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {loadFonts} from './engine/fonts';
import {Layer, Stage, Grain} from './engine/stage';
import {Sky, Clouds, Lawn, TreeLine, Tree, Hedge, Topiary} from './world/nature';
import {Manor} from './world/manor';
import {Person, walkPose} from './people/Person';
import {HEIR_TWEED, HEIR_PLAID, BUTLER, LORD, LADY, ELDER, AUNTY, UNCLE, POLO, FRIEND_CAP} from './people/cast';

loadFonts();

export const Lab: React.FC = () => {
	const f = useCurrentFrame();
	const t = f / 30;
	return (
		<AbsoluteFill style={{background: '#000'}}>
			<Stage cam={{x: 960, y: 960}}>
				<Layer>
					<Sky />
					<Clouds t={t} y={520} />
					<TreeLine y={1020} s={0.45} t={t} />
					<Manor x={960} y={1030} s={0.62} />
					<Lawn horizon={1030} />
					<Hedge x={200} y={1080} w={300} h={60} />
					<Topiary x={1620} y={1090} s={0.6} />
					<Tree x={120} y={1200} s={1.6} seed={4} t={t} />
				</Layer>
				<Layer>
					<Person x={560} y={1440} s={1} look={HEIR_TWEED} pose={{ra: 30, re: -120, rhand: 'point', mouth: 0.6, twist: 0.3}} />
					<Person x={760} y={1440} s={1} look={BUTLER} pose={{la: 10, le: -60, ra: 10, re: -60}} />
					<Person x={960} y={1440} s={1} look={HEIR_PLAID} pose={walkPose(0.25)} />
					<Person x={1160} y={1440} s={1} look={LADY} pose={{ra: 140, re: 20, la: 20, le: -40}} />
					<Person x={1360} y={1440} s={1} look={LORD} pose={{seated: true, la: 20, le: -50, ra: 20, re: -50}} />
					<Person x={460} y={1500} s={0.6} look={ELDER('e1', '#b8262d')} />
					<Person x={1500} y={1440} s={0.9} look={AUNTY('a1', '#2f6b5a', '#e8a33a')} pose={{la: 150, ra: 150, le: 10, re: 10}} />
					<Person x={1640} y={1440} s={0.9} look={UNCLE('u1', '#1f3b6a', '#2b2b30')} />
					<Person x={1760} y={1440} s={0.9} look={POLO('p1', '#1f4f8a')} />
					<Person x={300} y={1440} s={0.9} look={FRIEND_CAP} />
				</Layer>
			</Stage>
			<Grain t={t} />
		</AbsoluteFill>
	);
};
