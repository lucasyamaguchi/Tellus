import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

/**
 * Resolves the root application directory where Tellus is installed / executed.
 */
export function getTellusAppDir(): string {
  // 1. Explicit environment variable set by Electron launcher or custom environment
  if (process.env.TELLUS_APP_DIR && fs.existsSync(process.env.TELLUS_APP_DIR)) {
    return path.resolve(process.env.TELLUS_APP_DIR);
  }

  // 2. Working Directory checks (root containing package.json and electron or client)
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, 'package.json')) && (fs.existsSync(path.join(cwd, 'electron')) || fs.existsSync(path.join(cwd, 'client')) || fs.existsSync(path.join(cwd, 'skills')))) {
    return path.resolve(cwd);
  }

  // 3. Parent directory check (e.g. if server is launched from <rootDir>/server or <rootDir>/server/dist)
  const parent = path.resolve(cwd, '..');
  if (fs.existsSync(path.join(parent, 'package.json')) && (fs.existsSync(path.join(parent, 'electron')) || fs.existsSync(path.join(parent, 'client')) || fs.existsSync(path.join(parent, 'skills')))) {
    return parent;
  }

  // 4. ESM import.meta.url hierarchy resolution
  try {
    const metaDir = path.dirname(fileURLToPath(import.meta.url));
    // server/src/utils -> ../../../
    const candidateRoot = path.resolve(metaDir, '..', '..', '..');
    if (fs.existsSync(path.join(candidateRoot, 'package.json'))) {
      return candidateRoot;
    }
    const candidateServer = path.resolve(metaDir, '..', '..');
    if (fs.existsSync(path.join(candidateServer, 'package.json'))) {
      return candidateServer;
    }
  } catch {}

  return cwd;
}

/**
 * Resolves the default Vault directory inside the Tellus installation folder
 */
export function getDefaultVaultDir(): string {
  if (process.env.TELLUS_VAULT_DIR) {
    return path.resolve(process.env.TELLUS_VAULT_DIR);
  }
  return path.join(getTellusAppDir(), 'vault');
}

/**
 * Resolves the default Skills directory inside the Tellus installation folder
 */
export function getDefaultSkillsDir(): string {
  if (process.env.TELLUS_SKILLS_DIR) {
    return path.resolve(process.env.TELLUS_SKILLS_DIR);
  }
  return path.join(getTellusAppDir(), 'skills');
}

/**
 * Resolves the default Artifacts directory inside the Tellus installation folder
 */
export function getDefaultArtifactsDir(): string {
  if (process.env.TELLUS_ARTIFACTS_DIR) {
    return path.resolve(process.env.TELLUS_ARTIFACTS_DIR);
  }
  return path.join(getTellusAppDir(), 'artifacts');
}

/**
 * Resolves the default Standalone Conversations directory inside the Tellus installation folder
 */
export function getDefaultConversationsDir(): string {
  if (process.env.TELLUS_CONVERSATIONS_DIR) {
    return path.resolve(process.env.TELLUS_CONVERSATIONS_DIR);
  }
  const dir = path.join(getTellusAppDir(), 'conversations');
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      const homeFallback = path.join(os.homedir(), '.tellus', 'conversations');
      if (!fs.existsSync(homeFallback)) {
        try { fs.mkdirSync(homeFallback, { recursive: true }); } catch {}
      }
      return homeFallback;
    }
  }
  return dir;
}
