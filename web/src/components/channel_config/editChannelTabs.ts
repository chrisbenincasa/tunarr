import type {
  EditChannelTabProps,
  EditChannelTabs,
} from './EditChannelTabPanel.tsx';

export const tabId = (tab: EditChannelTabs) => `channel-edit-tab-${tab}`;
export const tabPanelId = (tab: EditChannelTabs) =>
  `channel-edit-tabpanel-${tab}`;

// The first tab, in display order, that owns a field with an error.
export function firstTabWithError(
  tabs: EditChannelTabProps[],
  errorKeys: string[],
): EditChannelTabs | undefined {
  return tabs.find((tab) =>
    tab.fields.some((field) => errorKeys.includes(field)),
  )?.value;
}
