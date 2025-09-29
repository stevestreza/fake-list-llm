#!/usr/bin/env node

const { Command } = require('commander');
const axios = require('axios');
const { ConfigManager } = require('./config');

class FakeListGenerator {
  constructor(options) {
    this.model = options.model;
    this.endpoint = options.endpoint;
    this.apiKey = options.apiKey || process.env.OPENROUTER_API_KEY;
    this.prompt = options.prompt;
    this.verbose = options.verbose;
  }

  async generateList(count, concept) {
    if (!this.apiKey) {
      throw new Error('API key is required. Set OPENROUTER_API_KEY environment variable or use --api-key option.');
    }

    const formattedPrompt = this.prompt
      .replace(/{count}/g, count)
      .replace(/{concept}/g, concept);

    const requestBody = {
      model: this.model,
      messages: [
        {
          role: 'user',
          content: formattedPrompt
        }
      ],
      stream: true,
      max_tokens: 2000,
      temperature: 0.7
    };

    try {
      const response = await axios.post(
        `${this.endpoint}/chat/completions`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/stevestreza/fake-list-llm',
            'X-Title': 'Fake List Generator'
          },
          responseType: 'stream'
        }
      );

      return new Promise((resolve, reject) => {
        let fullResponse = '';
        
        response.data.on('data', (chunk) => {
          const lines = chunk.toString().split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                resolve(fullResponse);
                return;
              }
              
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                
                if (content) {
                  process.stdout.write(content);
                  fullResponse += content;
                }
              } catch (e) {
                // Ignore parsing errors for malformed JSON
              }
            }
          }
        });

        response.data.on('error', (error) => {
          reject(error);
        });

        response.data.on('end', () => {
          if (fullResponse) {
            resolve(fullResponse);
          }
        });
      });
    } catch (error) {
      if (error.response) {
        throw new Error(`API Error: ${error.response.status} - ${error.response.data?.error?.message || error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Network Error: Unable to connect to the API endpoint');
      } else {
        throw new Error(`Error: ${error.message}`);
      }
    }
  }
}

function main() {
  const program = new Command();
  const configManager = new ConfigManager();

  // Handle special commands first
  const args = process.argv.slice(2);
  
  if (args.includes('--show-config-paths')) {
    const paths = configManager.getConfigPathsForDisplay();
    console.log('Configuration file search paths:');
    paths.forEach((path, index) => {
      console.log(`${index + 1}. ${path}`);
    });
    return;
  }

  if (args.includes('--init-config')) {
    configManager.createDefaultUserConfig();
    return;
  }

  program
    .name('fake-list-llm')
    .description('Generate lists using OpenAI-compatible APIs')
    .version('1.0.0')
    .option('-m, --model <model>', 'Model to use')
    .option('-e, --endpoint <url>', 'API endpoint URL')
    .option('-k, --api-key <key>', 'API key (defaults to OPENROUTER_API_KEY env var)')
    .option('-p, --prompt <prompt>', 'Custom prompt template (use {count} and {concept} as placeholders)')
    .option('--verbose', 'Enable verbose output')
    .option('-c, --config <path>', 'Path to custom config file')
    .argument('<count>', 'Number of items to generate')
    .argument('<concept>', 'Concept to generate (e.g., "band names", "colors", "animals")')
    .action(async (count, concept, options) => {
      try {

        // Load configuration with proper layering
        const config = configManager.getConfig(options.config);
        
        // Override config with command line options
        const finalOptions = {
          model: options.model || config.model,
          endpoint: options.endpoint || config.endpoint,
          apiKey: options.apiKey || config.apiKey,
          prompt: options.prompt || config.prompt,
          verbose: options.verbose || config.verbose
        };

        // Validate count
        const numCount = parseInt(count);
        if (isNaN(numCount) || numCount <= 0) {
          console.error('Error: Count must be a positive number');
          process.exit(1);
        }

        if (finalOptions.verbose) {
          console.error(`Using model: ${finalOptions.model}`);
          console.error(`Using endpoint: ${finalOptions.endpoint}`);
          console.error(`Generating ${numCount} ${concept}...`);
          console.error('---');
        }

        const generator = new FakeListGenerator(finalOptions);
        await generator.generateList(numCount, concept);
        
        if (finalOptions.verbose) {
          console.error('\n---');
          console.error('Generation complete!');
        }
      } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
    });

  program.parse();
}

if (require.main === module) {
  main();
}

module.exports = { FakeListGenerator };
