import process from 'node:process';
import { getUserFromRequest } from './_lib/auth.js';
import { ensureSchema, sql } from './_lib/db.js';
import { readJsonBody, sendJson } from './_lib/http.js';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_APP_NAME = process.env.OPENROUTER_APP_NAME || 'Talk To Me';
const OPENROUTER_APP_URL = process.env.OPENROUTER_APP_URL || 'https://talktome-ruby.vercel.app';
const MODEL_CANDIDATES = (
  process.env.OPENROUTER_MODELS ||
  'meta-llama/llama-3.1-8b-instruct,openai/gpt-4o-mini'
)
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);
const REQUEST_TIMEOUT_MS = 9000;
const MAX_INPUT_CHARS = 2200;

function getPrompt(action, targetLanguage) {
  if (action === 'format') {
    return 'Fix punctuation, capitalization, and obvious grammar. Keep meaning. Return only final text.';
  }

  if (action === 'translate') {
    return `Translate to ${targetLanguage}. Keep formatting. Return only translated text.`;
  }

  return `Lightly fix punctuation/grammar, then translate to ${targetLanguage}. Return only final translated text.`;
}

async function callSingleModel(model, systemPrompt, trimmedContent) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': OPENROUTER_APP_URL,
        'X-Title': OPENROUTER_APP_NAME,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        provider: {
          allow_fallbacks: false,
        },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: trimmedContent },
        ],
        temperature: 0.1,
        max_tokens: 220,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const error = new Error(payload?.error?.message || `API error: ${response.status}`);
      error.status = response.status;
      error.model = model;

      const retryAfterSeconds = Number(response.headers.get('retry-after'));
      if (response.status === 429 && !Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
        error.retryAfterMs = retryAfterSeconds * 1000;
      }

      throw error;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('Request timed out quickly to keep app responsive. Please try again.');
      timeoutError.status = 504;
      timeoutError.model = model;
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callOpenRouter(systemPrompt, userContent) {
  if (!OPENROUTER_API_KEY) {
    const error = new Error('OpenRouter API key is missing on the server.');
    error.status = 500;
    throw error;
  }

  const trimmedContent = String(userContent || '').trim().slice(0, MAX_INPUT_CHARS);
  if (!trimmedContent) {
    return '';
  }

  let lastError;

  for (const model of MODEL_CANDIDATES) {
    try {
      return await callSingleModel(model, systemPrompt, trimmedContent);
    } catch (error) {
      lastError = error;

      // Move to the next cheap model only for provider capacity issues.
      if (error?.status === 429 || error?.status >= 500) {
        continue;
      }

      throw error;
    }
  }

  throw lastError || new Error('Could not process text.');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return sendJson(res, 401, { error: 'Please log in first.' });
    }

    await ensureSchema();
    const body = await readJsonBody(req);
    const text = String(body.text || '').trim();
    const action = body.action || 'format_translate';
    const targetLanguage = String(body.targetLanguage || 'English').trim();

    if (!text) {
      return sendJson(res, 400, { error: 'Text is required.' });
    }

    if (!['format', 'translate', 'format_translate'].includes(action)) {
      return sendJson(res, 400, { error: 'Invalid processing action.' });
    }

    const result = await callOpenRouter(getPrompt(action, targetLanguage), text);

    await sql`
      insert into usage_logs (user_id, action, input_chars)
      values (${user.id}, ${action}, ${text.length})
    `;

    return sendJson(res, 200, { result });
  } catch (error) {
    console.error('Processing error:', error);

    const status = error?.status || 500;
    const payload = { error: error?.message || 'Could not process text.' };

    if (error?.retryAfterMs) {
      payload.retryAfterMs = error.retryAfterMs;
    }

    return sendJson(res, status, payload);
  }
}
