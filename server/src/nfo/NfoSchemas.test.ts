import { XMLParser } from 'fast-xml-parser';
import { NfoAudioStream } from './NfoSchemas.js';

const AudioExample1 = `
<audio>
  <codec>mp2</codec>
  <micodec>mp2</micodec>
  <bitrate>192000</bitrate>
  <scantype>progressive</scantype>
  <channels>2</channels>
  <samplingrate>44100</samplingrate>
  <default>False</default>
  <forced>False</forced>
</audio>
`;

describe('NfoSchemas', () => {
  const parser = new XMLParser({
    ignoreAttributes: false,
    // isArray: (_, jPath) => {
    //   return this.arrayTags.includes(jPath);
    // },
  });

  test('audio', () => {
    const parsed = parser.parse(AudioExample1);
    console.log(parsed);
    console.log(NfoAudioStream.parse(parsed['audio']));
  });
});
