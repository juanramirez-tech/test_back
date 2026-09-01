const DATE_YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** YYYY-MM-DD de calendario real (rechaza 2026-02-31, 2025-02-29, etc.). */
export function isDateYmd(value: string): boolean {
    const match = DATE_YMD.exec(value);
    if (!match) {
        return false;
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const utc = new Date(Date.UTC(year, month - 1, day));
    return utc.getUTCFullYear() === year
        && utc.getUTCMonth() === month - 1
        && utc.getUTCDate() === day;
}

export function normalizeTime(value: string | Date): string {
    if (value instanceof Date) {
        const hours = String(value.getUTCHours()).padStart(2, '0');
        const minutes = String(value.getUTCMinutes()).padStart(2, '0');
        const seconds = String(value.getUTCSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    const match = String(value).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!match) {
        throw new Error('Hora inválida');
    }

    const hoursNum = Number(match[1]);
    const minutesNum = Number(match[2]);
    const secondsNum = Number(match[3] ?? 0);
    if (hoursNum > 23 || minutesNum > 59 || secondsNum > 59) {
        throw new Error('Hora inválida');
    }
    const hours = String(hoursNum).padStart(2, '0');
    const minutes = String(minutesNum).padStart(2, '0');
    const seconds = String(secondsNum).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

function offsetMsAt(instant: Date, timeZone: string): number {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'longOffset',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(instant);

    const tzName = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT+00:00';
    const match = tzName.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!match) {
        return 0;
    }

    const sign = match[1] === '-' ? -1 : 1;
    const hours = Number(match[2]);
    const minutes = Number(match[3] ?? 0);
    return sign * ((hours * 60) + minutes) * 60 * 1000;
}

/** Interpreta fecha+hora de pared en `timeZone` y devuelve el instante UTC. */
export function wallTimeToUtc(dateYmd: string, timeHms: string | Date, timeZone: string): Date {
    const time = normalizeTime(timeHms);
    const asUtc = new Date(`${dateYmd}T${time}Z`);
    if (Number.isNaN(asUtc.getTime())) {
        throw new Error('Fecha u hora inválida');
    }

    let instant = asUtc;
    for (let i = 0; i < 2; i += 1) {
        const offset = offsetMsAt(instant, timeZone);
        instant = new Date(asUtc.getTime() - offset);
    }
    return instant;
}

export function addDaysYmd(dateYmd: string, days: number): string {
    const asUtc = new Date(`${dateYmd}T00:00:00Z`);
    asUtc.setUTCDate(asUtc.getUTCDate() + days);
    return asUtc.toISOString().slice(0, 10);
}

export function toUtcIso(date: Date): string {
    return new Date(Math.floor(date.getTime() / 1000) * 1000).toISOString();
}

export function floorToSeconds(date: Date): Date {
    return new Date(Math.floor(date.getTime() / 1000) * 1000);
}

export function utcToYmd(instant: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(instant);

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    if (!year || !month || !day) {
        throw new Error('No se pudo resolver la fecha local');
    }
    return `${year}-${month}-${day}`;
}

export function parseUtcInstant(value: unknown): Date | null {
    if (typeof value !== 'string' || !value.trim()) {
        return null;
    }
    const trimmed = value.trim();
    if (!/Z$|[+-]\d{2}:\d{2}$/.test(trimmed)) {
        return null;
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return floorToSeconds(parsed);
}
