import { Trans, useLingui } from '@lingui/react/macro';
import { MoreVert, PlayArrowOutlined } from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import type { Task } from '@tunarr/types';
import { maxBy, minBy } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { useCallback, useMemo, useState } from 'react';
import { DataTable } from '../../components/ui/table/DataTable.tsx';
import { actionsColumn } from '../../components/ui/table/columns.tsx';
import {
  createAppColumnHelper,
  useTunarrTable,
} from '../../components/ui/table/tunarrTable.ts';
import {
  getApiTasksOptions,
  postApiTasksByIdRunMutation,
} from '../../generated/@tanstack/react-query.gen.ts';
import { isNonEmptyString } from '../../helpers/util.ts';
import { useDayjs } from '../../hooks/useDayjs.ts';
import type { Nullable } from '../../types/util.ts';

const columnHelper = createAppColumnHelper<Task>();

export default function TaskSettingsPage() {
  const { t } = useLingui();
  const snackbar = useSnackbar();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { data: tasks } = useSuspenseQuery({
    ...getApiTasksOptions(),
    refetchInterval: 60 * 1000, // Check tasks every minute
  });
  const dayjs = useDayjs();
  const [selectedTaskMenu, setSelectedTaskMenu] =
    useState<Nullable<string>>(null);
  const [menuRef, setMenuRef] = useState<Nullable<HTMLElement>>(null);

  const runTaskNowMutation = useMutation({
    ...postApiTasksByIdRunMutation(),
  });

  const runTaskNow = useCallback(
    (taskId: string) => {
      runTaskNowMutation.mutate(
        {
          path: {
            id: taskId,
          },
          query: {
            background: true,
          },
        },
        {
          onSuccess: () => {
            snackbar.enqueueSnackbar({
              variant: 'success',
              message: t`Successfully scheduled ${taskId} (running in background).`,
            });
          },
          onError: (e) => {
            console.error(e);
            snackbar.enqueueSnackbar({
              variant: 'error',
              message: t`Error while scheduling ${taskId}. Check server logs for details`,
            });
          },
        },
      );
      setSelectedTaskMenu(null);
      setMenuRef(null);
    },
    [runTaskNowMutation, snackbar, t],
  );

  const openTaskActionMenu = useCallback(
    (target: HTMLElement, taskId: string) => {
      setMenuRef(target);
      setSelectedTaskMenu(taskId);
    },
    [],
  );

  const columns = useMemo(
    () => [
      ...columnHelper.columns([
        columnHelper.accessor('name', { header: t`Name` }),
        columnHelper.accessor((task) => task.description ?? '-', {
          id: 'description',
          header: t`Description`,
          enableSorting: false,
        }),
        columnHelper.accessor(
          (task) => {
            const max = maxBy(
              task.scheduledTasks,
              (scheduled) => scheduled.lastExecutionEpoch,
            );
            const epoch = max?.lastExecutionEpoch;
            if (!epoch) {
              return '-';
            }
            return dayjs(epoch * 1000).format('llll');
          },
          {
            id: 'lastScheduledExecution',
            header: t`Last Scheduled Execution`,
          },
        ),
        columnHelper.accessor(
          (task) => {
            const min = minBy(
              task.scheduledTasks,
              (scheduled) => scheduled.nextExecutionEpoch,
            );
            const epoch = min?.nextExecutionEpoch;
            if (!epoch) {
              return '-';
            }
            return dayjs(epoch * 1000).format('llll');
          },
          {
            id: 'nextScheduledExecution',
            header: t`Next Scheduled Execution`,
          },
        ),
      ]),
      actionsColumn<Task>({
        render: ({ original: task }) => (
          <IconButton
            aria-label={t`Actions`}
            aria-haspopup="menu"
            onClick={(e) => openTaskActionMenu(e.currentTarget, task.id)}
          >
            <MoreVert />
          </IconButton>
        ),
      }),
    ],
    [dayjs, openTaskActionMenu, t],
  );

  const table = useTunarrTable({
    columns,
    data: tasks,
  });

  const renderMobileList = () => (
    <List disablePadding>
      {(tasks ?? []).map((task, idx) => {
        const lastEpoch = maxBy(
          task.scheduledTasks,
          (t) => t.lastExecutionEpoch,
        )?.lastExecutionEpoch;
        const nextEpoch = minBy(
          task.scheduledTasks,
          (t) => t.nextExecutionEpoch,
        )?.nextExecutionEpoch;

        return (
          <Box key={task.id}>
            {idx > 0 && <Divider />}
            <ListItem
              disableGutters
              secondaryAction={
                <Tooltip title={t`Run now`}>
                  <IconButton
                    edge="end"
                    onClick={() => runTaskNow(task.id)}
                    sx={{ mr: 1 }}
                  >
                    <PlayArrowOutlined />
                  </IconButton>
                </Tooltip>
              }
            >
              <Card
                elevation={0}
                sx={{ flex: 1, mr: 6, bgcolor: 'transparent' }}
              >
                <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {task.name}
                  </Typography>
                  {task.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      {task.description}
                    </Typography>
                  )}
                  <Stack direction="row" gap={2} mt={0.5} flexWrap="wrap">
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        <Trans>Last run</Trans>
                      </Typography>
                      <Typography variant="body2">
                        {lastEpoch
                          ? dayjs(lastEpoch * 1000).format('lll')
                          : '-'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        <Trans>Next run</Trans>
                      </Typography>
                      <Typography variant="body2">
                        {nextEpoch
                          ? dayjs(nextEpoch * 1000).format('lll')
                          : '-'}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </ListItem>
          </Box>
        );
      })}
    </List>
  );

  return (
    <Stack gap={2}>
      <Box>
        <Typography variant="h4">
          <Trans>Tasks</Trans>
        </Typography>
        <Typography>
          <Trans>
            Tunarr runs various tasks, sometimes on a schedule, for background
            operations.
          </Trans>
        </Typography>
      </Box>
      {isMobile ? (
        renderMobileList()
      ) : (
        <DataTable table={table} aria-label={t`Tasks`} />
      )}
      <Menu
        open={!!menuRef && isNonEmptyString(selectedTaskMenu)}
        anchorEl={menuRef}
        onClose={() => setMenuRef(null)}
      >
        <MenuItem
          onClick={() => {
            if (isNonEmptyString(selectedTaskMenu)) {
              runTaskNow(selectedTaskMenu);
            }
          }}
        >
          <ListItemIcon>
            <PlayArrowOutlined />
          </ListItemIcon>
          <ListItemText primary={t`Run`} />
        </MenuItem>
      </Menu>
    </Stack>
  );
}
