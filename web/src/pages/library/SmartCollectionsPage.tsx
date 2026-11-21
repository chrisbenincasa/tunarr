import { Dialog } from '@mui/material';
import { useNavigate } from '@tanstack/react-router';
import type { SmartCollection } from '@tunarr/types';
import { useCallback, useState } from 'react';
import { EditSmartCollectionDialog } from '../../components/smart_collections/EditSmartCollectionDialog.tsx';
import { SmartCollectionsView } from '../../components/smart_collections/SmartCollectionsView.tsx';
import {
  useDeleteSmartCollection,
  useSmartCollections,
} from '../../hooks/smartCollectionHooks.ts';

export default function SmartCollectionsPage() {
  const { data: collections } = useSmartCollections();
  const deleteCollection = useDeleteSmartCollection();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<SmartCollection | null>(null);

  const openCollection = useCallback(
    (collection: SmartCollection) => {
      navigate({
        to: '/library/smart_collections/$id',
        params: { id: collection.uuid },
      }).catch(console.error);
    },
    [navigate],
  );

  return (
    <>
      <SmartCollectionsView
        collections={collections}
        onOpenCollection={openCollection}
        onEditCollection={setEditing}
        onDeleteCollection={(collection) => {
          deleteCollection.mutate({ path: { id: collection.uuid } });
        }}
      />
      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth>
        {editing && (
          <EditSmartCollectionDialog
            id={editing.uuid}
            onClose={() => setEditing(null)}
          />
        )}
      </Dialog>
    </>
  );
}
