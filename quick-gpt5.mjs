#!/usr/bin/env node

import OpenAI from 'openai';

// Get the question from command line arguments
const question = process.argv.slice(2).join(' ');

if (!question) {
  console.log('❌ Please provide a question!');
  console.log('Usage: node quick-gpt5.mjs "Your question here"');
  console.log('Example: node quick-gpt5.mjs "What is the capital of France?"');
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.log('❌ OPENAI_API_KEY environment variable is not set!');
  console.log('💡 Set it with: set OPENAI_API_KEY=your-api-key-here');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log('🤖 GPT-5: Thinking...');

try {
  const response = await openai.chat.completions.create({
    model: 'gpt-5', // or 'gpt-4o' if GPT-5 is not available
    messages: [
      { role: 'user', content: question }
    ],
    max_tokens: 1000,
    temperature: 0.7,
  });

  console.log(`\n🤖 GPT-5: ${response.choices[0].message.content}`);
} catch (error) {
  if (error.code === 'model_not_found') {
    console.log('❌ GPT-5 is not available. Trying GPT-4o...');
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'user', content: question }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });
      console.log(`\n🤖 GPT-4o: ${response.choices[0].message.content}`);
    } catch (e) {
      console.log(`❌ Error: ${e.message}`);
    }
  } else {
    console.log(`❌ Error: ${error.message}`);
  }
} 