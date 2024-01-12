import useStore from '../../store/index.ts';

export function useBlockShuffle() {
  const programs = useStore((s) => s.channelEditor.programList);
  return function () {
    console.log(programs);
  };
}
