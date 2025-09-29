#!/usr/bin/env node

const { Command } = require('commander');
const axios = require('axios');

class FakeListGenerator {
  constructor(options) {
    this.model = options.model || 'qwen/qwen-turbo';
    this.endpoint = options.endpoint || 'https://openrouter.ai/api/v1';
    this.apiKey = options.apiKey || process.env.OPENROUTER_API_KEY;
    this.prompt = options.prompt || 'Generate a list of {count} {concept}. Each item should be on a new line, numbered from 1 to {count}.';
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
            'HTTP-Referer': 'https://github.com/yourusername/fake-list',
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

  program
    .name('fake-list')
    .description('Generate lists using OpenAI-compatible APIs')
    .version('1.0.0')
    .argument('<count>', 'Number of items to generate')
    .argument('<concept>', 'Concept to generate (e.g., "band names", "colors", "animals")')
    .option('-m, --model <model>', 'Model to use', 'qwen/qwen-turbo')
    .option('-e, --endpoint <url>', 'API endpoint URL', 'https://openrouter.ai/api/v1')
    .option('-k, --api-key <key>', 'API key (defaults to OPENROUTER_API_KEY env var)')
    .option('-p, --prompt <prompt>', 'Custom prompt template (use {count} and {concept} as placeholders)')
    .option('--verbose', 'Enable verbose output')
    .action(async (count, concept, options) => {
      try {
        // Validate count
        const numCount = parseInt(count);
        if (isNaN(numCount) || numCount <= 0) {
          console.error('Error: Count must be a positive number');
          process.exit(1);
        }

        if (options.verbose) {
          console.error(`Using model: ${options.model}`);
          console.error(`Using endpoint: ${options.endpoint}`);
          console.error(`Generating ${numCount} ${concept}...`);
          console.error('---');
        }

        const generator = new FakeListGenerator(options);
        await generator.generateList(numCount, concept);
        
        if (options.verbose) {
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