import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIConfigManager, createAIConfigManager } from '../config-manager.js';
import {
  AIConfigKeyMap,
  getDefaultValue,
  validateConfigValue,
  parseBooleanFlag,
  parseNumberValue,
  parseModelList,
} from '../config-schema.js';

// Mock SettingsRepository
const createMockSettingsRepo = () => ({
  get: vi.fn(),
  upsert: vi.fn(),
  batchUpsert: vi.fn(),
});

describe('AIConfigManager', () => {
  let manager;
  let mockSettingsRepo;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsRepo = createMockSettingsRepo();
    manager = new AIConfigManager(
      {}, // db (not used when settingsRepo is injected)
      { AI_MAX_TOOL_ROUNDS: '5' }, // 环境变量覆盖
      { settingsRepo: mockSettingsRepo } // 依赖注入
    );
  });

  describe('get', () => {
    it('should return cached value if not expired', async () => {
      manager.cache.set('AI_MAX_TOOL_ROUNDS', { value: 10, ts: Date.now() });

      const value = await manager.get('AI_MAX_TOOL_ROUNDS');

      expect(value).toBe(10);
      expect(mockSettingsRepo.get).not.toHaveBeenCalled();
    });

    it('should fetch from DB if cache miss', async () => {
      mockSettingsRepo.get.mockResolvedValue({ value: '7' });

      const value = await manager.get('AI_MAX_TOOL_ROUNDS');

      expect(value).toBe(7);
      expect(mockSettingsRepo.get).toHaveBeenCalledWith('AI_MAX_TOOL_ROUNDS', 'ai');
    });

    it('should fallback to env variable if DB value is missing', async () => {
      mockSettingsRepo.get.mockResolvedValue(null);

      const value = await manager.get('AI_MAX_TOOL_ROUNDS');

      expect(value).toBe(5); // 从env获取
    });

    it('should fallback to default if no DB or env value', async () => {
      mockSettingsRepo.get.mockResolvedValue(null);
      manager = new AIConfigManager(
        {},
        {}, // 无env覆盖
        { settingsRepo: mockSettingsRepo }
      );

      const value = await manager.get('AI_MAX_TOOL_ROUNDS');

      expect(value).toBe(3); // 默认值
    });

    it('should return undefined for unknown key', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const value = await manager.get('UNKNOWN_KEY');

      expect(value).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith('[AIConfigManager] Unknown config key: UNKNOWN_KEY');

      consoleSpy.mockRestore();
    });
  });

  describe('getFullConfig', () => {
    it('should return complete config object', async () => {
      mockSettingsRepo.get.mockImplementation((key) => {
        const values = {
          AI_MODEL: 'gpt-4',
          AI_MODELS: 'gpt-4,gpt-3.5-turbo',
          AI_MODEL_HEALTH_WINDOW: '25',
          AI_MODEL_SWITCH_THRESHOLD: '3',
          AI_RATE_LIMIT_ENABLED: 'true',
          AI_RATE_LIMIT_RPM: '100',
          AI_RATE_LIMIT_TPD: '500000',
          AI_STREAM_GATE_ENABLED: 'true',
          AI_STREAM_GATE_STRICT_MODE: 'false',
          AI_MAX_TOOL_ROUNDS: '5',
          AI_MAX_TOOLS_PER_ROUND: '10',
          AI_STREAM_LOOKAHEAD: '100',
          AI_STREAM_SUSPECT_WINDOW: '250',
          AI_MAX_INPUT_LENGTH: '15000',
          AI_MAX_IMAGE_SIZE: '10000000',
          AI_ENABLE_PROMPT_INJECTION_CHECK: 'true',
          AI_ENABLE_DATA_MASKING: 'true',
          AI_RETRY_MAX_RETRIES: '4',
          AI_RETRY_BACKOFF_MULTIPLIER: '2.5',
          AI_RETRY_BASE_DELAY_MS: '1500',
          AI_RETRY_MAX_DELAY_MS: '45000',
          AI_RETRY_ENABLE_JITTER: 'true',
          AI_TELEMETRY_ENABLED: 'true',
          AI_TELEMETRY_SAMPLE_RATE: '0.8',
          AI_TELEMETRY_INCLUDE_TOKEN_USAGE: 'true',
        };
        return Promise.resolve(values[key] ? { value: values[key] } : null);
      });

      const config = await manager.getFullConfig();

      expect(config.models.primary).toBe('gpt-4');
      expect(config.models.fallback).toEqual(['gpt-4', 'gpt-3.5-turbo']);
      expect(config.models.healthWindow).toBe(25);
      expect(config.streaming.maxToolRounds).toBe(5);
      expect(config.rateLimit.enabled).toBe(true);
      expect(config.security.maxInputLength).toBe(15000);
      expect(config.retry.maxRetries).toBe(4);
      expect(config.telemetry.sampleRate).toBe(0.8);
    });
  });

  describe('set', () => {
    it('should save value to DB and invalidate cache', async () => {
      manager.cache.set('AI_MAX_TOOL_ROUNDS', { value: 3, ts: Date.now() });

      await manager.set('AI_MAX_TOOL_ROUNDS', 10, { description: '最大工具轮数' });

      expect(mockSettingsRepo.upsert).toHaveBeenCalledWith('AI_MAX_TOOL_ROUNDS', {
        value: '10',
        category: 'ai',
        description: '最大工具轮数',
      });
      expect(manager.cache.has('AI_MAX_TOOL_ROUNDS')).toBe(false);
    });

    it('should throw error for invalid value', async () => {
      await expect(
        manager.set('AI_MAX_TOOL_ROUNDS', -1)
      ).rejects.toThrow('Invalid value');
    });

    it('should throw error for unknown key', async () => {
      await expect(
        manager.set('UNKNOWN_KEY', 'value')
      ).rejects.toThrow('Unknown config key');
    });
  });

  describe('setMany', () => {
    it('should batch save settings', async () => {
      const settings = [
        { key: 'AI_MAX_TOOL_ROUNDS', value: 5, description: '最大工具轮数' },
        { key: 'AI_MAX_TOOLS_PER_ROUND', value: 12 },
      ];

      await manager.setMany(settings);

      expect(mockSettingsRepo.batchUpsert).toHaveBeenCalledWith([
        { key: 'AI_MAX_TOOL_ROUNDS', value: '5', category: 'ai', description: '最大工具轮数' },
        { key: 'AI_MAX_TOOLS_PER_ROUND', value: '12', category: 'ai', description: '' },
      ]);
    });
  });

  describe('invalidateCache', () => {
    it('should invalidate specific keys', () => {
      manager.cache.set('key1', { value: 1, ts: Date.now() });
      manager.cache.set('key2', { value: 2, ts: Date.now() });

      manager.invalidateCache(['key1']);

      expect(manager.cache.has('key1')).toBe(false);
      expect(manager.cache.has('key2')).toBe(true);
    });

    it('should invalidate all keys when no argument', () => {
      manager.cache.set('key1', { value: 1, ts: Date.now() });
      manager.cache.set('key2', { value: 2, ts: Date.now() });

      manager.invalidateCache();

      expect(manager.cache.size).toBe(0);
    });
  });
});

describe('config-schema', () => {
  describe('getDefaultValue', () => {
    it('should return default value for valid path', () => {
      expect(getDefaultValue('models.healthWindow')).toBe(20);
      expect(getDefaultValue('streaming.maxToolRounds')).toBe(3);
      expect(getDefaultValue('retry.enableJitter')).toBe(true);
    });

    it('should return undefined for invalid path', () => {
      expect(getDefaultValue('invalid.path')).toBeUndefined();
    });
  });

  describe('validateConfigValue', () => {
    it('should validate number within range', () => {
      const result = validateConfigValue('models.healthWindow', 50);
      expect(result.valid).toBe(true);
    });

    it('should reject number below minimum', () => {
      const result = validateConfigValue('models.healthWindow', 2);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('less than minimum');
    });

    it('should reject number above maximum', () => {
      const result = validateConfigValue('models.healthWindow', 500);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('greater than maximum');
    });

    it('should validate boolean type', () => {
      expect(validateConfigValue('rateLimit.enabled', true).valid).toBe(true);
      expect(validateConfigValue('rateLimit.enabled', 'true').valid).toBe(false);
    });

    it('should reject unknown path', () => {
      const result = validateConfigValue('unknown.path', 'value');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown config path');
    });
  });

  describe('parseBooleanFlag', () => {
    it('should parse various truthy values', () => {
      expect(parseBooleanFlag(true)).toBe(true);
      expect(parseBooleanFlag('true')).toBe(true);
      expect(parseBooleanFlag('1')).toBe(true);
      expect(parseBooleanFlag('yes')).toBe(true);
      expect(parseBooleanFlag('on')).toBe(true);
      expect(parseBooleanFlag('enabled')).toBe(true);
    });

    it('should parse various falsy values', () => {
      expect(parseBooleanFlag(false)).toBe(false);
      expect(parseBooleanFlag('false')).toBe(false);
      expect(parseBooleanFlag('0')).toBe(false);
      expect(parseBooleanFlag('no')).toBe(false);
      expect(parseBooleanFlag('')).toBe(false);
      expect(parseBooleanFlag(null)).toBe(false);
      expect(parseBooleanFlag(undefined)).toBe(false);
    });

    it('should use fallback when value is empty', () => {
      expect(parseBooleanFlag('', true)).toBe(true);
      expect(parseBooleanFlag(null, true)).toBe(true);
    });
  });

  describe('parseNumberValue', () => {
    it('should parse valid numbers', () => {
      expect(parseNumberValue(42)).toBe(42);
      expect(parseNumberValue('42')).toBe(42);
      expect(parseNumberValue('3.14')).toBe(3.14);
    });

    it('should use fallback for invalid values', () => {
      expect(parseNumberValue('invalid', 100)).toBe(100);
      expect(parseNumberValue(NaN, 100)).toBe(100);
      expect(parseNumberValue(null, 100)).toBe(100);
      expect(parseNumberValue(undefined, 100)).toBe(100);
    });
  });

  describe('parseModelList', () => {
    it('should parse comma-separated string', () => {
      expect(parseModelList('gpt-4,gpt-3.5-turbo,claude-3')).toEqual([
        'gpt-4',
        'gpt-3.5-turbo',
        'claude-3',
      ]);
    });

    it('should trim whitespace', () => {
      expect(parseModelList(' gpt-4 , gpt-3.5-turbo ')).toEqual([
        'gpt-4',
        'gpt-3.5-turbo',
      ]);
    });

    it('should return array as-is', () => {
      expect(parseModelList(['gpt-4', 'gpt-3.5-turbo'])).toEqual([
        'gpt-4',
        'gpt-3.5-turbo',
      ]);
    });

    it('should filter empty strings', () => {
      expect(parseModelList('gpt-4,,,gpt-3.5-turbo')).toEqual([
        'gpt-4',
        'gpt-3.5-turbo',
      ]);
    });

    it('should return empty array for empty input', () => {
      expect(parseModelList('')).toEqual([]);
      expect(parseModelList(null)).toEqual([]);
      expect(parseModelList(undefined)).toEqual([]);
    });
  });
});

describe('createAIConfigManager', () => {
  it('should create instance with env', () => {
    const mockRepo = createMockSettingsRepo();
    const env = {
      DB: {},
      AI_MODEL: 'gpt-4',
    };

    // 由于createAIConfigManager使用真实的SettingsRepository，
    // 我们只需要测试它能正确传递参数
    const manager = createAIConfigManager(env);

    expect(manager).toBeInstanceOf(AIConfigManager);
    expect(manager.env.AI_MODEL).toBe('gpt-4');
  });
});
