# GPT-5 CLI Setup Guide

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)
```bash
# Run the setup script
./setup-gpt5.bat
```

### Option 2: Manual Setup
1. Get your OpenAI API key from https://platform.openai.com/api-keys
2. Set the environment variable:
   ```bash
   set OPENAI_API_KEY=your-api-key-here
   ```
3. Test the connection:
   ```bash
   node quick-gpt5.mjs "Hello, how are you?"
   ```

## 📁 Files Included

- `gpt5-cli.mjs` - Interactive CLI chat with GPT-5
- `quick-gpt5.mjs` - One-liner for single questions
- `setup-gpt5.bat` - Automated setup script
- `GPT5_CLI_README.md` - This guide

## 🎯 Usage Examples

### Interactive Chat
```bash
node gpt5-cli.mjs
```
Then type your questions and get responses in real-time.

### Single Question
```bash
node quick-gpt5.mjs "What is the weather like today?"
```

### Commands in Interactive Mode
- `quit` or `exit` - End the conversation
- `clear` - Start a new conversation
- `help` - Show available commands

## 🔧 Troubleshooting

### "OPENAI_API_KEY is not set"
```bash
set OPENAI_API_KEY=sk-your-api-key-here
```

### "GPT-5 is not available"
The script will automatically fall back to GPT-4o if GPT-5 is not available.

### "Module not found"
```bash
npm install -g openai
```

### "Permission denied"
Run PowerShell as Administrator and try again.

## 💡 Tips

1. **Save your API key permanently:**
   ```bash
   setx OPENAI_API_KEY "your-api-key-here"
   ```

2. **Use quotes for multi-word questions:**
   ```bash
   node quick-gpt5.mjs "How do I fix a broken API integration?"
   ```

3. **For coding help:**
   ```bash
   node gpt5-cli.mjs
   # Then ask: "Help me debug this JavaScript code: [paste code]"
   ```

## 🔒 Security Notes

- Never commit your API key to version control
- Use environment variables, not hardcoded keys
- Consider using a `.env` file for local development

## 📊 API Usage

- Each request costs money based on tokens used
- GPT-5 is more expensive than GPT-4
- Monitor your usage at https://platform.openai.com/usage

## 🆘 Need Help?

1. Check your internet connection
2. Verify your API key is correct
3. Ensure you have sufficient API credits
4. Try the fallback to GPT-4o if GPT-5 fails

## 🎉 Success!

Once you see "✅ Connection successful!" you're ready to use GPT-5 CLI! 