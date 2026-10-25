export interface AudioActionByLanguage {
  type: 'by_language';
  languages: string[];
  preferChannels?: 'most' | 'least' | '';
}

export interface AudioActionByTitle {
  type: 'by_title';
  titleContains: string;
}

export interface AudioActionDefault {
  type: 'default';
}

export type AudioAction =
  | AudioActionByLanguage
  | AudioActionByTitle
  | AudioActionDefault;

export interface SubtitleActionDisable {
  type: 'disable';
}

export interface SubtitleActionByLanguage {
  type: 'by_language';
  languages: string[];
  filterType?: 'none' | 'forced' | 'default' | 'any';
  allowImageBased?: boolean;
  allowExternal?: boolean;
}

export interface SubtitleActionDefault {
  type: 'default';
}

export type SubtitleAction =
  | SubtitleActionDisable
  | SubtitleActionByLanguage
  | SubtitleActionDefault;

export interface StreamSelectionRuleFormValues {
  label?: string;
  condition: string;
  audioAction: AudioAction;
  subtitleAction: SubtitleAction;
}

export interface StreamSelectionProfileFormValues {
  name: string;
  rules: StreamSelectionRuleFormValues[];
}

export const defaultRule: StreamSelectionRuleFormValues = {
  label: '',
  condition: 'true',
  audioAction: { type: 'default' },
  subtitleAction: { type: 'default' },
};
