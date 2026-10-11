import React from 'react';
import {Composition} from 'remotion';
import {Lab} from './Lab';

export const RemotionRoot: React.FC = () => (
	<>
		<Composition id="Lab" component={Lab} durationInFrames={60} fps={30} width={1920} height={1080} />
	</>
);
