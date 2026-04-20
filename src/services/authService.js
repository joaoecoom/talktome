async function parseResponse(response) {
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(payload?.error || `Request failed: ${response.status}`);
        error.status = response.status;
        throw error;
    }

    return payload;
}

export async function getCurrentUser() {
    const response = await fetch('/api/auth/me', {
        credentials: 'include',
    });

    return parseResponse(response);
}

export async function login(email, password) {
    const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
    });

    return parseResponse(response);
}

export async function logout() {
    const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
    });

    return parseResponse(response);
}
