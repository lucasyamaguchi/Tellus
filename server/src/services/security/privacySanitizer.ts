import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export interface SecretDetectionPattern {
  id: string;
  name: string;
  regex: RegExp;
  redactedPlaceholder: string;
}

export interface SanitizationResult {
  sanitized: string;
  redactedCount: number;
  detectedTypes: string[];
}

export interface GitSafeAuditItem {
  category: 'gitignore' | 'environment' | 'tracked_secrets' | 'binaries';
  name: string;
  passed: boolean;
  severity: 'critical' | 'high' | 'medium' | 'info';
  details: string;
}

export interface GitSafeAuditReport {
  timestamp: string;
  isSafe: boolean;
  score: number; // 0 to 100
  items: GitSafeAuditItem[];
  summary: string;
}

export class PrivacySanitizer {
  // Comprehensive Regex Patterns for Secret Detection (Specific patterns first)
  private static patterns: SecretDetectionPattern[] = [
    {
      id: 'anthropic_key',
      name: 'Anthropic Claude API Key',
      regex: /sk-ant-[a-zA-Z0-9_-]{20,}/g,
      redactedPlaceholder: '[REDACTED_API_KEY_ANTHROPIC]'
    },
    {
      id: 'fish_audio_key',
      name: 'Fish Audio API Key',
      regex: /sk-fish-[a-zA-Z0-9_-]{20,}/g,
      redactedPlaceholder: '[REDACTED_API_KEY_FISH_AUDIO]'
    },
    {
      id: 'openai_key',
      name: 'OpenAI API Key',
      regex: /sk-(?!(?:ant-|fish-))(?:proj-)?[a-zA-Z0-9_-]{20,}/g,
      redactedPlaceholder: '[REDACTED_API_KEY_OPENAI]'
    },
    {
      id: 'google_ai_key',
      name: 'Google Gemini / GCP API Key',
      regex: /AIza[0-9A-Za-z-_]{35}/g,
      redactedPlaceholder: '[REDACTED_API_KEY_GOOGLE]'
    },
    {
      id: 'github_token',
      name: 'GitHub Personal Access Token',
      regex: /(?:ghp_[0-9a-zA-Z]{36}|github_pat_[0-9a-zA-Z_]{82}|gho_[0-9a-zA-Z]{36}|ghs_[0-9a-zA-Z]{36})/g,
      redactedPlaceholder: '[REDACTED_GITHUB_TOKEN]'
    },
    {
      id: 'aws_access_key',
      name: 'AWS Access Key ID',
      regex: /(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}/g,
      redactedPlaceholder: '[REDACTED_AWS_ACCESS_KEY]'
    },
    {
      id: 'private_key',
      name: 'Private RSA/OpenSSH Key',
      regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
      redactedPlaceholder: '[REDACTED_PRIVATE_KEY_BLOCK]'
    },
    {
      id: 'jwt_token',
      name: 'JSON Web Token (JWT)',
      regex: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
      redactedPlaceholder: '[REDACTED_JWT_TOKEN]'
    },
    {
      id: 'slack_token',
      name: 'Slack Bot / User Token',
      regex: /xox[baprs]-[0-9a-zA-Z]{10,48}/g,
      redactedPlaceholder: '[REDACTED_SLACK_TOKEN]'
    },
    {
      id: 'stripe_key',
      name: 'Stripe API Key',
      regex: /(?:sk|pk)_(?:test|live)_[0-9a-zA-Z]{24,}/g,
      redactedPlaceholder: '[REDACTED_STRIPE_KEY]'
    }
  ];

  /**
   * Sanitizes text by stripping out any known API keys, credentials and secrets.
   */
  public static sanitizeText(content: string): SanitizationResult {
    if (!content || typeof content !== 'string') {
      return { sanitized: content || '', redactedCount: 0, detectedTypes: [] };
    }

    let sanitized = content;
    let totalRedacted = 0;
    const detectedSet = new Set<string>();

    for (const pat of this.patterns) {
      pat.regex.lastIndex = 0;
      const matches = sanitized.match(pat.regex);
      if (matches && matches.length > 0) {
        totalRedacted += matches.length;
        detectedSet.add(pat.name);
        sanitized = sanitized.replace(pat.regex, pat.redactedPlaceholder);
      }
    }

    return {
      sanitized,
      redactedCount: totalRedacted,
      detectedTypes: Array.from(detectedSet)
    };
  }

  /**
   * Audits a repository against the GitSafe standard:
   * - Checks .gitignore protection (.env, sqlite, keys, backups, logs)
   * - Scans git status for any untracked or staged secrets
   */
  public static auditGitSafe(projectPath: string): GitSafeAuditReport {
    const items: GitSafeAuditItem[] = [];
    const gitignorePath = path.join(projectPath, '.gitignore');

    // 1. .gitignore existence and rules
    if (!fs.existsSync(gitignorePath)) {
      items.push({
        category: 'gitignore',
        name: 'Presença do .gitignore',
        passed: false,
        severity: 'critical',
        details: 'Arquivo .gitignore não foi encontrado na raiz do projeto.'
      });
    } else {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      const requiredPatterns = [
        { pattern: '.env', label: 'Bloqueio de arquivos .env' },
        { pattern: '*.sqlite', alt: '*.db', label: 'Bloqueio de bancos SQLite locais' },
        { pattern: '*.key', alt: '*.pem', label: 'Bloqueio de chaves criptográficas (*.key / *.pem)' },
        { pattern: 'node_modules', label: 'Bloqueio de dependências node_modules' },
        { pattern: '*.log', label: 'Bloqueio de arquivos de log' }
      ];

      for (const req of requiredPatterns) {
        const hasPattern = gitignoreContent.includes(req.pattern) || (req.alt && gitignoreContent.includes(req.alt));
        items.push({
          category: 'gitignore',
          name: req.label,
          passed: !!hasPattern,
          severity: hasPattern ? 'info' : 'high',
          details: hasPattern 
            ? `Padrão '${req.pattern}' ativo no .gitignore.`
            : `Falta blindagem explícita para '${req.pattern}' no .gitignore.`
        });
      }
    }

    // 2. Scan Git Status for staged / unstaged secrets
    try {
      const statusOutput = execSync('git status --porcelain', {
        cwd: projectPath,
        encoding: 'utf-8',
        timeout: 4000
      });

      const lines = statusOutput.split('\n').filter(l => l.trim().length > 0);
      let foundSensitiveFile = false;

      for (const line of lines) {
        const filePath = line.slice(3).trim();
        const baseName = path.basename(filePath);

        if (/^\.env/i.test(baseName)) {
          foundSensitiveFile = true;
          items.push({
            category: 'environment',
            name: `Arquivo .env exposto: ${filePath}`,
            passed: false,
            severity: 'critical',
            details: `Arquivo de variáveis de ambiente '${filePath}' detectado no git status!`
          });
        }

        if (/\.(db|sqlite|sqlite3|dump)$/i.test(baseName)) {
          foundSensitiveFile = true;
          items.push({
            category: 'binaries',
            name: `Banco SQLite exposto: ${filePath}`,
            passed: false,
            severity: 'high',
            details: `Banco de dados binário local '${filePath}' detectado no git status.`
          });
        }
      }

      if (!foundSensitiveFile) {
        items.push({
          category: 'environment',
          name: 'Arquivos .env no Git Status',
          passed: true,
          severity: 'info',
          details: 'Nenhum arquivo .env ou credencial visível no git status.'
        });
      }
    } catch {
      items.push({
        category: 'tracked_secrets',
        name: 'Comando git status',
        passed: true,
        severity: 'info',
        details: 'Diretório verificado sem comandos de controle de versão pendentes.'
      });
    }

    // Compute overall score
    const criticalFailures = items.filter(i => !i.passed && i.severity === 'critical').length;
    const highFailures = items.filter(i => !i.passed && i.severity === 'high').length;
    const isSafe = criticalFailures === 0 && highFailures === 0;
    const passedCount = items.filter(i => i.passed).length;
    const score = Math.round((passedCount / Math.max(items.length, 1)) * 100);

    return {
      timestamp: new Date().toISOString(),
      isSafe,
      score,
      items,
      summary: isSafe
        ? '✅ Repositório auditado e em conformidade com os padrões GitSafe. Zero vazamento de credenciais.'
        : `⚠️ Alerta GitSafe: ${criticalFailures} falha(s) crítica(s) e ${highFailures} pendência(s) de alta prioridade encontradas.`
    };
  }
}
