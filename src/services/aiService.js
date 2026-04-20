async function requestProcessing(action, text, targetLanguage) {
    const response = await fetch('/api/process', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
            action,
            text,
            targetLanguage,
        }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(payload?.error || `API error: ${response.status}`);
        error.status = response.status;
        if (payload?.retryAfterMs) {
            error.retryAfterMs = payload.retryAfterMs;
        }
        throw error;
    }

    return payload?.result || '';
}

/**
 * Format and clean up text: fix punctuation, grammar, capitalize sentences.
 */
export async function formatText(rawText) {
    return requestProcessing('format', rawText);
}

/**
 * Translate text to a target language.
 */
export async function translateText(text, targetLanguage) {
    return requestProcessing('translate', text, targetLanguage);
}

/**
 * Format and then translate in one call.
 */
export async function formatAndTranslate(rawText, targetLanguage) {
    return requestProcessing('format_translate', rawText, targetLanguage);
}

/**
 * Summarize text.
 */
export async function summarizeText(text) {
    return requestProcessing('format', text);
}
