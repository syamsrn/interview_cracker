import type { AppSettings } from './settings';

export type PrivacyStoreStatus = 'ready' | 'error';

export interface PrivacyStoreItem {
  id: 'history' | 'knowledge' | 'resume' | 'settings';
  label: string;
  status: PrivacyStoreStatus;
  summary: string;
  path?: string;
}

export interface PrivacyInfo {
  status: PrivacyStoreStatus;
  message: string;
  localDataPath: string;
  items: PrivacyStoreItem[];
  networkSummary: string[];
}

export interface PrivacyInfoResult {
  ok: boolean;
  info: PrivacyInfo;
  error?: string;
}

export interface ClearPrivateDataResult {
  ok: boolean;
  info: PrivacyInfo;
  settings: AppSettings;
  error?: string;
}
