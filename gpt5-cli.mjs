#!/usr/bin/env node

import OpenAI from 'openai';
import readline from 'readline';
import { createInterface } from 'readline';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Create readline interface
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

// Check if API key is set
if (!process.env.OPENAI_API_KEY) {
  console.log('❌ OPENAI_API_KEY environment variable is not set!');
  console.log('💡 Please set your OpenAI API key:');
  console.log('   Windows: set OPENAI_API_KEY=your-api-key-here');
  console.log('   Or add it to your .env file: OPENAI_API_KEY=your-api-key-here');
  console.log('\n📋 To get your API key:');
  console.log('   1. Go to https://platform.openai.com/api-keys');
  console.log('   2. Create a new API key');
  console.log('   3. Copy and set it as an environment variable');
  process.exit(1);
}

console.log('🤖 GPT-5 CLI - Interactive Chat');
console.log('Type "quit" or "exit" to end the conversation');
console.log('Type "clear" to start a new conversation');
console.log('Type "help" for commands');
console.log('─'.repeat(50));

let conversationHistory = [];

async function chatWithGPT5(userInput) {
  try {
    const messages = [
      { role: 'system', content: 'You are a helpful AI assistant. Be concise and practical in your responses.' },
      ...conversationHistory,
      { role: 'user', content: userInput }
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-5', // or 'gpt-4o' if GPT-5 is not available
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7,
    });

    const assistantResponse = response.choices[0].message.content;
    
    // Add to conversation history
    conversationHistory.push({ role: 'user', content: userInput });
    conversationHistory.push({ role: 'assistant', content: assistantResponse });
    
    return assistantResponse;
  } catch (error) {
    if (error.code === 'model_not_found') {
      return '❌ GPT-5 is not available. Trying GPT-4o instead...';
    }
    return `❌ Error: ${error.message}`;
  }
}

function askQuestion() {
  rl.question('\n💬 You: ', async (input) => {
    const trimmedInput = input.trim();
    
    if (trimmedInput.toLowerCase() === 'quit' || trimmedInput.toLowerCase() === 'exit') {
      console.log('\n👋 Goodbye!');
      rl.close();
      return;
    }
    
    if (trimmedInput.toLowerCase() === 'clear') {
      conversationHistory = [];
      console.log('🧹 Conversation cleared!');
      askQuestion();
      return;
    }
    
    if (trimmedInput.toLowerCase() === 'help') {
      console.log('\n📋 Available commands:');
      console.log('  quit/exit - End the conversation');
      console.log('  clear - Start a new conversation');
      console.log('  help - Show this help message');
      askQuestion();
      return;
    }
    
    if (trimmedInput === '') {
      askQuestion();
      return;
    }
    
    console.log('\n🤖 GPT-5: Thinking...');
    
    try {
      const response = await chatWithGPT5(trimmedInput);
      console.log(`\n🤖 GPT-5: ${response}`);
    } catch (error) {
      console.log(`\n❌ Error: ${error.message}`);
    }
    
    askQuestion();
  });
}

// Start the conversation
askQuestion(); 