export interface GeminiSecretStatus {
  configured: boolean;
  encryptionAvailable: boolean;
  message: string;
}

export interface GeminiSecretCommandResult {
  ok: boolean;
  status: GeminiSecretStatus;
  error?: string;
}
