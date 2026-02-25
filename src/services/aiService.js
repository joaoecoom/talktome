const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Calls the OpenAI Chat Completions API.
 */
async function callOpenAI(systemPrompt, userContent, model = 'google/gemini-2.0-flash-001') {
    if (!OPENROUTER_API_KEY) {
        throw new Error('No API key configured. Add VITE_OPENROUTER_API_KEY to your .env file.');
    }

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent },
            ],
            temperature: 0.3,
            max_tokens: 2000,
        }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
}

/**
 * Format and clean up text: fix punctuation, grammar, capitalize sentences.
 */
export async function formatText(rawText) {
    const systemPrompt = `You are a professional text editor. Your job is to take raw, unformatted text (often from speech-to-text) and:
1. Fix all punctuation and capitalization
2. Fix grammar mistakes
3. Add proper paragraph breaks where appropriate
4. Remove filler words (um, uh, like, you know) if they add no value
5. Keep the original meaning and voice — do not rewrite or paraphrase
6. Return ONLY the formatted text, with no commentary or explanation.`;

    return callOpenAI(systemPrompt, rawText);
}

/**
 * Translate text to a target language.
 */
export async function translateText(text, targetLanguage) {
    const systemPrompt = `You are a professional translator. Translate the following text into ${targetLanguage}. 
Maintain the original formatting, punctuation, and paragraph structure. 
Return ONLY the translated text, with no commentary, notes, or explanation.`;

    return callOpenAI(systemPrompt, text);
}

/**
 * Format and then translate in one call.
 */
export async function formatAndTranslate(rawText, targetLanguage) {
    const systemPrompt = `You are a professional text editor and translator. Your job is to:
1. Take raw, unformatted text (often from speech-to-text)
2. Fix all punctuation, grammar, and capitalization
3. Add proper paragraph breaks where appropriate
4. Remove filler words that add no value
5. Then translate the clean text into ${targetLanguage}
6. Return ONLY the final translated text, with no commentary or explanation.`;

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
