import type { ClearPrivateDataResult, PrivacyInfo, PrivacyInfoResult, PrivacyStoreItem } from '../../../shared/privacy';
import { HistoryDatabase } from '../history/history-database';
import { KnowledgeDatabase } from '../knowledge/knowledge-database';
import { ResumeProfileDatabase } from '../resume/resume-profile-database';
import { getDefaultSettings, SettingsStore } from '../settings/settings-store';

export class PrivacyService {
  constructor(
    private readonly userDataPath: string,
    private readonly historyDatabase: HistoryDatabase,
    private readonly knowledgeDatabase: KnowledgeDatabase,
    private readonly resumeProfileDatabase: ResumeProfileDatabase,
    private readonly settingsStore: SettingsStore
  ) {}

  async getInfo(): Promise<PrivacyInfoResult> {
    const info = await this.buildPrivacyInfo();

    return {
      ok: info.status === 'ready',
      info,
      error: info.status === 'error' ? 'One or more local privacy stores are unavailable.' : undefined
    };
  }

  async clearPrivateData(): Promise<ClearPrivateDataResult> {
    const [historyResult, knowledgeResult, resumeResult, settingsResult] = await Promise.all([
      this.historyDatabase.clearAnswers(),
      this.knowledgeDatabase.clearSnippets(),
      this.resumeProfileDatabase.clearProfile(),
      this.settingsStore.resetSettings()
    ]);
    const info = await this.buildPrivacyInfo();
    const ok = historyResult.ok && knowledgeResult.ok && resumeResult.ok && settingsResult.ok && info.status === 'ready';

    return {
      ok,
      info,
      settings: settingsResult.settings ?? getDefaultSettings(),
      error: ok ? undefined : 'Some private local data could not be cleared.'
    };
  }

  private async buildPrivacyInfo(): Promise<PrivacyInfo> {
    const [historyInfo, knowledgeInfo, resumeInfo, settingsResult] = await Promise.all([
      this.historyDatabase.getInfo(),
      this.knowledgeDatabase.getInfo(),
      this.resumeProfileDatabase.getInfo(),
      this.settingsStore.getSettings()
    ]);
    const items: PrivacyStoreItem[] = [
      {
        id: 'history',
        label: 'Answer History',
        status: historyInfo.status,
        summary: `${historyInfo.recordCount} saved answer(s)`,
        path: historyInfo.path
      },
      {
        id: 'knowledge',
        label: 'Personal Knowledge',
        status: knowledgeInfo.status,
        summary: `${knowledgeInfo.snippetCount} snippet(s)`,
        path: knowledgeInfo.path
      },
      {
        id: 'resume',
        label: 'Resume Profile',
        status: resumeInfo.status,
        summary: resumeInfo.hasProfile ? 'Profile saved' : 'No profile saved',
        path: resumeInfo.path
      },
      {
        id: 'settings',
        label: 'Preferences',
        status: settingsResult.info.status,
        summary: settingsResult.ok ? 'Preferences saved locally' : 'Preferences unavailable',
        path: settingsResult.info.path
      }
    ];
    const status = items.every((item) => item.status === 'ready') ? 'ready' : 'error';

    return {
      status,
      message: status === 'ready' ? 'Privacy stores are local and ready.' : 'One or more privacy stores need attention.',
      localDataPath: this.userDataPath,
      items,
      networkSummary: [
        'No backend account, cloud database, telemetry, or crash upload is configured.',
        'AI requests go to the selected local/provider endpoint through the main process.',
        'Speech transcription runs through the local sidecar process.'
      ]
    };
  }
}
