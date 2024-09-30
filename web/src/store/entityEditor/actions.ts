import { match, P } from 'ts-pattern';
import useStore from '..';

export const startProgramAddOperation = () =>
  useStore.setState((s) => {
    const editor = match(s.currentEditor)
      .with({ type: 'channel', id: P.select() }, (id) =>
        id ? s.channels[id] : null,
      )
      .with({ type: 'custom_show' }, () => s.customShowEditor)
      .with({ type: 'filler_list' }, () => s.fillerListEditor)
      .otherwise(() => null);

    if (editor) {
      editor.addProgramsInProgress = true;
    }
  });
