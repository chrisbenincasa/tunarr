import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getApiMediaSourcesOptions } from '../../../generated/@tanstack/react-query.gen.ts';
import { EditMediaSourceLibrariesDialog } from './EditMediaSourceLibrariesDialog.tsx';

// Opens the library picker when a remote media source appears with no enabled
// libraries. New sources sync nothing until the user enables a library, and
// first-time users often miss that step. This lives at the app root because
// the add buttons on the welcome and programming pages unmount as soon as the
// first source exists.
export const NewMediaSourceLibrariesPrompt = () => {
  const { data: mediaSources } = useQuery(getApiMediaSourcesOptions());
  const [knownIds, setKnownIds] = useState<Set<string> | null>(null);
  const [queue, setQueue] = useState<string[]>([]);

  // Diff against the previous list during render so the first load
  // establishes a baseline and never prompts.
  if (mediaSources) {
    if (knownIds === null) {
      setKnownIds(new Set(mediaSources.map((source) => source.id)));
    } else {
      const added = mediaSources.filter((source) => !knownIds.has(source.id));
      if (added.length > 0) {
        setKnownIds(new Set(mediaSources.map((source) => source.id)));
        const needsLibraries = added
          .filter(
            (source) =>
              source.type !== 'local' &&
              !source.libraries.some((lib) => lib.enabled),
          )
          .map((source) => source.id);
        if (needsLibraries.length > 0) {
          setQueue((prev) => [...prev, ...needsLibraries]);
        }
      }
    }
  }

  // A queued source may be deleted before its turn, so skip missing ones.
  const current = queue
    .map((id) => mediaSources?.find((source) => source.id === id))
    .find((source) => source !== undefined);

  return (
    <EditMediaSourceLibrariesDialog
      open={current !== undefined}
      mediaSource={current ?? null}
      onClose={() =>
        setQueue((prev) => prev.filter((id) => id !== current?.id))
      }
    />
  );
};
