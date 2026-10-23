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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

// The dotted path of the first field error under `fields`, such as
// `watermark.width`. A field error is the node that carries a `type`.
export function firstErrorPath(
  errors: unknown,
  fields: string[],
): string | undefined {
  const search = (node: unknown, path: string): string | undefined => {
    if (!isRecord(node)) {
      return undefined;
    }
    if (typeof node.type === 'string') {
      return path;
    }
    for (const [key, child] of Object.entries(node)) {
      if (key === 'ref' || key === 'root') {
        continue;
      }
      const found = search(child, `${path}.${key}`);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  };

  if (!isRecord(errors)) {
    return undefined;
  }
  for (const field of fields) {
    const found = search(errors[field], field);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

// react-hook-form cannot focus Controllers that spread `field` into a MUI
// TextField, because their ref is the wrapper div. The input still carries
// the field's name, so look it up inside the panel.
export function focusField(container: ParentNode, path: string) {
  container.querySelector<HTMLElement>(`[name="${CSS.escape(path)}"]`)?.focus();
}
