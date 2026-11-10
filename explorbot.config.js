const provider = process.env.EXPLORBOT_AI_PROVIDER || 'openrouter';

const aiModels = provider === 'ollama'
  ? (() => {
      const { createOpenAI } = require('@ai-sdk/openai');
      const ollama = createOpenAI({
        baseURL: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1',
        apiKey: 'ollama',
      });

      return {
        model: ollama.chat(process.env.EXPLORBOT_OLLAMA_MODEL || 'qwen2.5-coder:14b'),
        visionModel: ollama.chat(process.env.EXPLORBOT_OLLAMA_VISION_MODEL || 'qwen2.5vl:3b'),
        agenticModel: ollama.chat(process.env.EXPLORBOT_OLLAMA_AGENT_MODEL || 'qwen2.5-coder:14b'),
      };
    })()
  : { recommendedModels: provider };

module.exports = {
  web: {
    url: process.env.EXPLORBOT_URL || 'http://127.0.0.1:5174',
  },
  ai: {
    ...aiModels,
    ...(provider === 'ollama' ? { config: { reasoning: 'none' } } : {}),
    agents: {
      ...(provider === 'ollama' ? { researcher: { reasoning: 'none' } } : {}),
      planner: {
        ...(provider === 'ollama' ? { reasoning: 'none' } : {}),
        styles: ['normal', 'curious'],
      },
    },
  },
  playwright: {
    browser: 'chromium',
    windowSize: process.env.CTULIB_QA_VIEWPORT || '1366x768',
  },
  dirs: {
    knowledge: 'qa/explorbot/knowledge',
    experience: 'qa/explorbot/experience',
    output: 'qa/explorbot/output',
  },
};
