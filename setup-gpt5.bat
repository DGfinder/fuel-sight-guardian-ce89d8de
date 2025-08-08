@echo off
echo 🤖 GPT-5 CLI Setup
echo.

echo 📋 To use GPT-5 CLI, you need an OpenAI API key.
echo.
echo 🔑 Getting your API key:
echo    1. Go to https://platform.openai.com/api-keys
echo    2. Sign in or create an account
echo    3. Click "Create new secret key"
echo    4. Copy the key (it starts with "sk-")
echo.

set /p api_key="Enter your OpenAI API key: "

if "%api_key%"=="" (
    echo ❌ No API key provided. Setup cancelled.
    pause
    exit /b 1
)

echo.
echo ✅ API key set successfully!
echo.

echo 🚀 To start GPT-5 CLI:
echo    node gpt5-cli.mjs
echo.
echo 💡 Or set the environment variable permanently:
echo    setx OPENAI_API_KEY "%api_key%"
echo.

echo 🧪 Testing connection...
set OPENAI_API_KEY=%api_key%
node -e "import('openai').then(async (OpenAI) => { const openai = new OpenAI.default({apiKey: process.env.OPENAI_API_KEY}); try { const response = await openai.chat.completions.create({model: 'gpt-4o', messages: [{role: 'user', content: 'Hello'}], max_tokens: 10}); console.log('✅ Connection successful!'); } catch(e) { console.log('❌ Error:', e.message); } });"

echo.
echo 🎉 Setup complete! You can now use GPT-5 CLI.
pause 