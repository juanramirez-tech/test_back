import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addDaysYmd, isDateYmd, normalizeTime, wallTimeToUtc } from './timezone';

describe('isDateYmd', () => {
    it('acepta días de calendario reales', () => {
        assert.equal(isDateYmd('2026-09-25'), true);
        assert.equal(isDateYmd('2024-02-29'), true);
    });

    it('rechaza días que no existen', () => {
        assert.equal(isDateYmd('2026-02-31'), false);
        assert.equal(isDateYmd('2025-02-29'), false);
        assert.equal(isDateYmd('2026-09-25T13:00:00Z'), false);
        assert.equal(isDateYmd(''), false);
    });
});

describe('normalizeTime', () => {
    it('normaliza HH:mm a HH:mm:ss', () => {
        assert.equal(normalizeTime('8:00'), '08:00:00');
        assert.equal(normalizeTime('22:00:00'), '22:00:00');
    });

    it('rechaza horas fuera de rango', () => {
        assert.throws(() => normalizeTime('25:00'));
        assert.throws(() => normalizeTime('08:60'));
    });
});

describe('wallTimeToUtc', () => {
    it('convierte 08:00 America/Bogota a 13:00Z', () => {
        const utc = wallTimeToUtc('2026-09-25', '08:00:00', 'America/Bogota');
        assert.equal(utc.toISOString(), '2026-09-25T13:00:00.000Z');
    });
});

describe('addDaysYmd', () => {
    it('cruza fin de mes', () => {
        assert.equal(addDaysYmd('2026-09-30', 1), '2026-10-01');
    });
});
