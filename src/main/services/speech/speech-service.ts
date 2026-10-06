import { ChildProcessWithoutNullStreams, execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import type {
  SpeechCommandResult,
  SpeechInputSource,
  SpeechServiceInfo,
  SpeechStartRequest,
  SpeechTranscriptEvent
} from '../../../shared/speech';

const execFileAsync = promisify(execFile);
const PYTHON_INFO_TIMEOUT_MS = 5000;
const SPEECH_DEPENDENCY_TIMEOUT_MS = 20000;
const processWithElectronResources = process as NodeJS.Process & { resourcesPath?: string };

const setupHint = [
  'Speech-to-text is not configured yet.',
  '',
  'Stage 7 uses a local Python sidecar with faster-whisper on CPU and int8 compute.',
  'Use the dedicated .venv-speech Python 3.12 environment.',
  '',
  'Install dependencies and download the tiny model explicitly before starting transcription.'
].join('\n');

function getPythonCommand(): string {
  const configuredPython = process.env.INTERVIEW_COACH_SPEECH_PYTHON?.trim();

  if (configuredPython) {
    return configuredPython;
  }

  const localVenvPythonPath = resolveFirstExistingPath(
    getResourceRootCandidates().map((rootPath) => join(rootPath, '.venv-speech', 'Scripts', 'python.exe'))
  );

  return localVenvPythonPath ?? 'python';
}

function getResourceRootCandidates(): string[] {
  return Array.from(new Set([process.cwd(), processWithElectronResources.resourcesPath].filter(Boolean) as string[]));
}

function resolveResourcePath(...pathSegments: string[]): string {
  const resolvedPath = resolveFirstExistingPath(
    getResourceRootCandidates().map((rootPath) => join(rootPath, ...pathSegments))
  );

  return resolvedPath ?? join(process.cwd(), ...pathSegments);
}

function resolveFirstExistingPath(paths: string[]): string | null {
  return paths.find((candidatePath) => existsSync(candidatePath)) ?? null;
}

export class SpeechService {
  private activeProcess: ChildProcessWithoutNullStreams | null = null;

  async getInfo(): Promise<SpeechServiceInfo> {
    const pythonInfo = await this.getPythonInfo();

    if (!pythonInfo) {
      return {
        engine: 'faster-whisper',
        status: 'python-missing',
        message: 'Python was not found.',
        setupHint
      };
    }

    if (!isSupportedPythonVersion(pythonInfo.version)) {
      return {
        engine: 'faster-whisper',
        status: 'python-incompatible',
        message: `Python ${pythonInfo.version} is installed, but the speech sidecar should use Python 3.11 or 3.12.`,
        pythonPath: pythonInfo.path,
        pythonVersion: pythonInfo.version,
        setupHint
      };
    }

    const dependencyError = await this.getSpeechDependencyError();

    if (dependencyError) {
      return {
        engine: 'faster-whisper',
        status: 'missing-dependencies',
        message: `Python is compatible, but speech sidecar dependencies are not ready. ${dependencyError}`,
        pythonPath: pythonInfo.path,
        pythonVersion: pythonInfo.version,
        setupHint
      };
    }

    return {
      engine: 'faster-whisper',
      status: 'ready',
      message: 'Speech sidecar dependencies are available.',
      pythonPath: pythonInfo.path,
      pythonVersion: pythonInfo.version
    };
  }

  async startMicrophoneTranscription(
    request: SpeechStartRequest,
    onEvent: (event: SpeechTranscriptEvent) => void
  ): Promise<SpeechCommandResult> {
    return this.startAudioTranscription(
      {
        ...request,
        source: 'microphone'
      },
      onEvent
    );
  }

  async startSystemAudioTranscription(
    request: SpeechStartRequest,
    onEvent: (event: SpeechTranscriptEvent) => void
  ): Promise<SpeechCommandResult> {
    return this.startAudioTranscription(
      {
        ...request,
        source: 'system-audio'
      },
      onEvent
    );
  }

  private async startAudioTranscription(
    request: SpeechStartRequest & { source: SpeechInputSource },
    onEvent: (event: SpeechTranscriptEvent) => void
  ): Promise<SpeechCommandResult> {
    if (this.activeProcess) {
      return {
        ok: false,
        message: 'Audio transcription is already running.'
      };
    }

    const info = await this.getInfo();

    if (info.status !== 'ready') {
      return {
        ok: false,
        message: info.message,
        info
      };
    }

    const args = [
      resolveResourcePath('services', 'speech', 'microphone_transcriber.py'),
      '--model',
      request.model || 'Systran/faster-whisper-tiny.en',
      '--language',
      request.language || 'en',
      '--source',
      request.source
    ];

    if (request.deviceName) {
      args.push('--device', request.deviceName);
    }

    const child = spawn(getPythonCommand(), args, {
      cwd: dirname(args[0]),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.activeProcess = child;

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (data: string) => {
      for (const line of data.split(/\r?\n/)) {
        const event = parseSpeechEvent(line);

        if (event) {
          onEvent(event);
        }
      }
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (data: string) => {
      const message = data.trim();

      if (message) {
        onEvent({
          type: 'status',
          message
        });
      }
    });

    child.on('exit', () => {
      if (this.activeProcess === child) {
        this.activeProcess = null;
      }
    });

    child.on('error', (error) => {
      if (this.activeProcess === child) {
        this.activeProcess = null;
      }

      onEvent({
        type: 'error',
        message: error.message
      });
    });

    return {
      ok: true,
      message:
        request.source === 'system-audio'
          ? 'System audio transcription started.'
          : 'Microphone transcription started.',
      info
    };
  }

  stopMicrophoneTranscription(): SpeechCommandResult {
    if (!this.activeProcess) {
      return {
        ok: false,
        message: 'Audio transcription is not running.'
      };
    }

    this.activeProcess.stdin.write('stop\n');

    return {
      ok: true,
      message: 'Audio transcription stop requested.'
    };
  }

  private async getPythonInfo(): Promise<{ path: string; version: string } | null> {
    try {
      const { stdout } = await execFileAsync(
        getPythonCommand(),
        [
          '-c',
          'import sys; print(sys.executable); print(f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")'
        ],
        {
          timeout: PYTHON_INFO_TIMEOUT_MS
        }
      );
      const [path, version] = stdout.trim().split(/\r?\n/);

      if (!path || !version) {
        return null;
      }

      return {
        path,
        version
      };
    } catch {
      return null;
    }
  }

  private async getSpeechDependencyError(): Promise<string | null> {
    try {
      await execFileAsync(getPythonCommand(), ['-c', 'import faster_whisper; import soundcard; import sounddevice; import numpy'], {
        timeout: SPEECH_DEPENDENCY_TIMEOUT_MS
      });

      return null;
    } catch (error) {
      if (error instanceof Error && error.message) {
        return error.message;
      }

      return 'Install faster-whisper, soundcard, sounddevice, and numpy in .venv-speech.';
    }
  }
}

function parseSpeechEvent(line: string): SpeechTranscriptEvent | null {
  const trimmedLine = line.trim();

  if (!trimmedLine) {
    return null;
  }

  try {
    return JSON.parse(trimmedLine) as SpeechTranscriptEvent;
  } catch {
    return {
      type: 'status',
      message: trimmedLine
    };
  }
}

function isSupportedPythonVersion(version: string): boolean {
  const [major, minor] = version.split('.').map((part) => Number(part));

  return major === 3 && (minor === 11 || minor === 12);
}
