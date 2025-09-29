const fs = require('fs');
const path = require('path');
const os = require('os');
const toml = require('toml');

class ConfigManager {
  constructor() {
    this.configPaths = this.getConfigPaths();
    this.defaultConfig = {
      model: 'qwen/qwen-turbo',
      endpoint: 'https://openrouter.ai/api/v1',
      apiKey: null,
      prompt: 'Generate a list of {count} {concept}. Each item should be on a new line, numbered from 1 to {count}.',
      verbose: false
    };
  }

  getConfigPaths() {
    const paths = [];
    
    // System-wide config (Linux: /etc/xdg/fake-list-llm/config.toml, macOS: /Library/Preferences/fake-list-llm/config.toml, Windows: C:\ProgramData\fake-list-llm\config.toml)
    if (process.platform === 'linux') {
      paths.push('/etc/xdg/fake-list-llm/config.toml');
    } else if (process.platform === 'darwin') {
      paths.push('/Library/Preferences/fake-list-llm/config.toml');
    } else if (process.platform === 'win32') {
      paths.push(path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'fake-list-llm', 'config.toml'));
    }

    // User config (XDG_CONFIG_HOME or equivalent)
    let userConfigDir;
    if (process.platform === 'linux') {
      userConfigDir = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    } else if (process.platform === 'darwin') {
      userConfigDir = path.join(os.homedir(), 'Library', 'Preferences');
    } else if (process.platform === 'win32') {
      userConfigDir = path.join(os.homedir(), 'AppData', 'Roaming');
    }
    
    if (userConfigDir) {
      paths.push(path.join(userConfigDir, 'fake-list-llm', 'config.toml'));
    }

    return paths;
  }

  loadConfigFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        return toml.parse(content);
      }
    } catch (error) {
      console.error(`Warning: Failed to load config file ${filePath}: ${error.message}`);
    }
    return {};
  }

  loadAllConfigs(overrideConfigPath = null) {
    const configs = [];
    
    // Load system config
    configs.push(this.loadConfigFile(this.configPaths[0]));
    
    // Load user config
    if (this.configPaths[1]) {
      configs.push(this.loadConfigFile(this.configPaths[1]));
    }
    
    // Load override config if specified
    if (overrideConfigPath) {
      configs.push(this.loadConfigFile(overrideConfigPath));
    }

    return configs;
  }

  mergeConfigs(configs) {
    const merged = { ...this.defaultConfig };
    
    for (const config of configs) {
      Object.assign(merged, config);
    }
    
    return merged;
  }

  getConfig(overrideConfigPath = null) {
    const configs = this.loadAllConfigs(overrideConfigPath);
    return this.mergeConfigs(configs);
  }

  createDefaultUserConfig() {
    const userConfigPath = this.configPaths[1];
    if (!userConfigPath) return;

    const configDir = path.dirname(userConfigPath);
    
    try {
      // Create directory if it doesn't exist
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Create default config file if it doesn't exist
      if (!fs.existsSync(userConfigPath)) {
        const defaultConfigContent = `# Fake List Generator Configuration
# This file contains default settings for the fake-list-llm tool

# AI model to use (default: qwen/qwen-turbo)
model = "qwen/qwen-turbo"

# API endpoint URL (default: OpenRouter)
endpoint = "https://openrouter.ai/api/v1"

# API key (leave empty to use OPENROUTER_API_KEY environment variable)
# apiKey = "your-api-key-here"

# Default prompt template
# Use {count} and {concept} as placeholders
prompt = "Generate a list of {count} {concept}. Each item should be on a new line, numbered from 1 to {count}."

# Enable verbose output by default
verbose = false
`;
        fs.writeFileSync(userConfigPath, defaultConfigContent);
        console.log(`Created default config file: ${userConfigPath}`);
      }
    } catch (error) {
      console.error(`Warning: Failed to create default config file: ${error.message}`);
    }
  }

  getConfigPathsForDisplay() {
    return this.configPaths.filter(path => path);
  }
}

module.exports = { ConfigManager };
