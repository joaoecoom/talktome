const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 9000;
const OPENROUTER_APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;
const OPENROUTER_APP_NAME = import.meta.env.VITE_APP_NAME || 'Talk To Me';
const FAST_MODEL = import.meta.env.VITE_OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';
const MAX_INPUT_CHARS = 2200;
const DEFAULT_RATE_LIMIT_MS = 30000;
let rateLimitedUntil = 0;

/**
 * Calls the OpenAI Chat Completions API.
 */
async function callOpenAI(systemPrompt, userContent, model = FAST_MODEL) {
    if (!OPENROUTER_API_KEY) {
        throw new Error('No API key configured. Add VITE_OPENROUTER_API_KEY to your .env file.');
    }

    if (Date.now() < rateLimitedUntil) {
        const waitMs = rateLimitedUntil - Date.now();
        const error = new Error(`Rate limit active. Wait ${Math.ceil(waitMs / 1000)}s.`);
        error.status = 429;
        error.retryAfterMs = waitMs;
        throw error;
    }

    const compactUserContent = String(userContent || '').trim().slice(0, MAX_INPUT_CHARS);
    if (!compactUserContent) return '';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(API_URL, {
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
                    { role: 'user', content: compactUserContent },
                ],
                temperature: 0.1,
                max_tokens: 260,
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            const error = new Error(err?.error?.message || `API error: ${response.status}`);
            error.status = response.status;
            const retryAfterSeconds = Number(response.headers.get('retry-after'));
            if (response.status === 429 && !Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
                error.retryAfterMs = retryAfterSeconds * 1000;
            }
            if (response.status === 429) {
                rateLimitedUntil = Date.now() + (error.retryAfterMs || DEFAULT_RATE_LIMIT_MS);
            }
            throw error;
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() || '';
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new Error('Request timed out quickly to keep app responsive. Please try again.');
        }
        if (error instanceof Error) {
            throw error;
        }
        throw new Error(error?.message || 'Could not reach OpenRouter. Please try again.');
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Format and clean up text: fix punctuation, grammar, capitalize sentences.
 */
export async function formatText(rawText) {
    const systemPrompt = 'Fix punctuation, capitalization, and obvious grammar. Keep meaning. Return only final text.';

    return callOpenAI(systemPrompt, rawText);
}

/**
 * Translate text to a target language.
 */
export async function translateText(text, targetLanguage) {
    const systemPrompt = `Translate to ${targetLanguage}. Keep formatting. Return only translated text.`;

    return callOpenAI(systemPrompt, text);
}

/**
 * Format and then translate in one call.
 */
export async function formatAndTranslate(rawText, targetLanguage) {
    const systemPrompt = `Lightly fix punctuation/grammar, then translate to ${targetLanguage}. Return only final translated text.`;

    return callOpenAI(systemPrompt, rawText);
}

/**
 * Summarize text.
 */
export async function summarizeText(text) {
    const systemPrompt = `You are a concise summarizer. Summarize the following text into a short, clear paragraph (3-5 sentences). 
Capture only the most important points. Return ONLY the summary.`;
    return callOpenAI(systemPrompt, text);
}
