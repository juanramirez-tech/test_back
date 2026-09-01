/** Evita secretos de capacidad (access_code, firmas) en access logs. */
export function redactRequestUrl(url: string): string {
    return url
        .replace(/(\/api\/v1\/bookings\/)[^/?#]+/gi, '$1:accessCode')
        .replace(/([?&](?:sig|token|access_code|guest_email|email)=)[^&]*/gi, '$1REDACTED');
}
