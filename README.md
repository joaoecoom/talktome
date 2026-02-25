# Talk To Me 🎙️

> AI-powered speech-to-text with automatic formatting and translation.

## Features

- 🎤 **Voice Recording** — Real-time dictation using the Web Speech API
- ✨ **Auto-Format** — AI cleans up grammar, punctuation and filler words
- 🌍 **Translate** — 10 output languages (format + translate in one call)
- 🔤 **10 speech input languages** — EN, ES, PT, FR, DE, IT, JA, ZH, AR, KO
- 📋 **Copy** — Copy input or output text with one click

## Tech Stack

- [React + Vite](https://vitejs.dev/)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [OpenRouter](https://openrouter.ai) (default model: `google/gemini-2.0-flash-001`)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Add your OpenRouter API key
echo "VITE_OPENROUTER_API_KEY=sk-or-..." > .env

# 3. Run locally
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_OPENROUTER_API_KEY` | Your OpenRouter API key — get one free at [openrouter.ai](https://openrouter.ai) |

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

Add `VITE_OPENROUTER_API_KEY` as an environment variable in your Vercel project settings.

## Browser Support

Speech recognition requires **Chrome** or **Edge**. You can still type manually in any browser.
