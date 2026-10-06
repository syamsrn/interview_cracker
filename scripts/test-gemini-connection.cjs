const { app, safeStorage } = require('electron');
const { readFile } = require('node:fs/promises');
const { join } = require('node:path');
const { GoogleGenAI } = require('@google/genai');

const MODEL = 'gemini-3.5-flash-lite';
app.setName('interview_app');

async function main() {
  await app.whenReady();

  if (!safeStorage.isEncryptionAvailable()) {
    console.error('Gemini smoke test failed: Electron safeStorage encryption is unavailable.');
    app.exit(1);
    return;
  }

  const userDataPath = app.getPath('userData');
  const secretPath = join(userDataPath, 'interview-coach-gemini-key.json');
  const content = await readFile(secretPath, 'utf8');
  const parsed = JSON.parse(content);

  if (parsed.schemaVersion !== 1 || typeof parsed.encryptedApiKey !== 'string') {
    console.error('Gemini smoke test failed: saved Gemini key file is invalid.');
    app.exit(1);
    return;
  }

  const apiKey = safeStorage.decryptString(Buffer.from(parsed.encryptedApiKey, 'base64')).trim();

  if (!apiKey) {
    console.error('Gemini smoke test failed: saved Gemini key could not be decrypted.');
    app.exit(1);
    return;
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: 'Reply only with OK.',
    config: {
      maxOutputTokens: 8,
      temperature: 0
    }
  });
  const text = response.text?.trim() ?? '';

  if (!text) {
    console.error('Gemini smoke test failed: Gemini returned no text.');
    app.exit(1);
    return;
  }

  console.log('Gemini smoke test passed.');
  console.log(`Model: ${MODEL}`);
  console.log(`Response length: ${text.length}`);
  console.log(`Usage tokens: ${response.usageMetadata?.totalTokenCount ?? 'not reported'}`);
  console.log(`Secret file: ${secretPath}`);
  app.exit(0);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown Gemini smoke test error.';
  console.error(`Gemini smoke test failed: ${message}`);
  app.exit(1);
});
