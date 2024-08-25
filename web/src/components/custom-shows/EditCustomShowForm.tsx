import { isNonEmptyString } from '@/helpers/util.ts';
import { useTunarrApi } from '@/hooks/useTunarrApi';
import { queryClient } from '@/queryClient';
import {
  clearCurrentCustomShow,
  updateCurrentCustomShow,
} from '@/store/customShowEditor/actions.ts';
import { removeCustomShowProgram } from '@/store/entityEditor/util';
import { UICustomShowProgram } from '@/types';
import { Tv } from '@mui/icons-material';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Box,
  Button,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { createExternalId } from '@tunarr/shared';
import { CustomShow } from '@tunarr/types';
import { isEmpty } from 'lodash-es';
import { useCallback, useEffect } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';

type CustomShowForm = {
  id?: string;
  name: string;
};

type Props = {
  customShow: CustomShow;
  customShowPrograms: UICustomShowProgram[];
  isNew: boolean;
};

export function EditCustomShowsForm({
  customShow,
  customShowPrograms,
  isNew,
}: Props) {
  const apiClient = useTunarrApi();
  const navigate = useNavigate();

  const {
    control,
    reset,
    handleSubmit,
    getValues,
    formState: { isValid },
  } = useForm<CustomShowForm>({
    defaultValues: {
      name: customShow.name ?? '',
    },
  });

  useEffect(() => {
    reset({
      name: customShow.name,
    });
  }, [customShow, reset]);

  const saveShowMutation = useMutation({
    mutationKey: ['custom-shows', isNew ? 'new' : customShow.id],
    mutationFn: async (
      data: CustomShowForm & { programs: UICustomShowProgram[] },
    ) => {
      if (isNew) {
        return apiClient.createCustomShow({
          name: data.name,
          programs: data.programs,
        });
      } else {
        return apiClient.updateCustomShow(
          { name: data.name, programs: data.programs },
          { params: { id: customShow.id } },
        );
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['custom-shows'],
        exact: false,
      });
      clearCurrentCustomShow();
      navigate({ to: '/library/custom-shows' }).catch(console.warn);
    },
  });

  const onCancel = useCallback(() => {
    navigate({ to: '/library/custom-shows' }).catch(console.warn);
  }, [navigate]);

  const saveCustomShow: SubmitHandler<CustomShowForm> = (
    data: CustomShowForm,
  ) => {
    saveShowMutation.mutate({ ...data, programs: customShowPrograms });
  };

  const deleteProgramAtIndex = useCallback((idx: number) => {
    removeCustomShowProgram(idx);
  }, []);

  const navToProgramming = () => {
    if (isNew) {
      updateCurrentCustomShow(getValues());
    }
    navigate({
      to: isNew
        ? '/library/custom-shows/new/programming'
        : `/library/custom-shows/$customShowId/programming`,
      params: { customShowId: customShow?.id },
    }).catch(console.warn);
  };

  const renderPrograms = () => {
    return !isEmpty(customShowPrograms) ? (
      customShowPrograms.map((p, idx) => {
        let id: string;
        let title: string;

        switch (p.type) {
          case 'custom':
            id = p.id;

            // Display the program title when available
            if (p.program && p.program.title) {
              title = p.program.title;
            } else {
              title = 'Custom';
            }
            break;
          case 'content':
            if (p.episodeTitle) {
              title = `${p.title} - ${p.episodeTitle}`;
            } else {
              title = p.title;
            }
            if (p.persisted) {
              id = p.id!;
            } else if (
              isNonEmptyString(p.externalSourceType) &&
              isNonEmptyString(p.externalSourceName) &&
              isNonEmptyString(p.externalKey)
            ) {
              id = createExternalId(
                p.externalSourceType,
                p.externalSourceName,
                p.externalKey,
              );
            } else {
              id = 'unknown';
            }
            break;
        }

        const key = `${p.type}|${id}`;

        return (
          <ListItem
            key={key}
            secondaryAction={
              <IconButton
                onClick={() => deleteProgramAtIndex(idx)}
                edge="end"
                aria-label="delete"
              >
                <DeleteIcon />
              </IconButton>
            }
          >
            <ListItemText
              primary={title}
              sx={{ fontStyle: p.persisted ? 'normal' : 'italic' }}
            />
          </ListItem>
        );
      })
    ) : (
      <Typography align="center">No media added yet.</Typography>
    );
  };

  return (
    <Box component="form" onSubmit={handleSubmit(saveCustomShow)}>
      <Stack gap={2}>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextField margin="normal" fullWidth label="Name" {...field} />
          )}
        />
        <Divider />
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ flex: 1 }}>
              Programming
            </Typography>
            <Tooltip
              title="Add TV Shows or Movies to custom show"
              placement="right"
            >
              <Button
                disableRipple
                component="button"
                onClick={() => navToProgramming()}
                startIcon={<Tv />}
                variant="contained"
              >
                Add Media
              </Button>
            </Tooltip>
          </Box>
          <Box display="flex">
            <Box sx={{ flex: 1, maxHeight: 400, overflowY: 'auto' }}>
              <List dense>{renderPrograms()}</List>
            </Box>
          </Box>
        </Box>
        <Stack
          spacing={2}
          direction="row"
          justifyContent="right"
          sx={{ mt: 2 }}
        >
          <Button onClick={() => onCancel()}>Cancel</Button>
          <Button
            disabled={
              saveShowMutation.isPending ||
              !isValid ||
              customShowPrograms.length === 0
            }
            variant="contained"
            type="submit"
          >
            Save
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
