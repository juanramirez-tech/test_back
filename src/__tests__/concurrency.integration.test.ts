import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const BASE = process.env.TEST_API_URL || 'http://127.0.0.1:3000';

function postJson(path: string, body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
    return fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }).then(async (res) => ({
        status: res.status,
        json: await res.json() as Record<string, unknown>,
    }));
}

describe('concurrencia de reservas', { skip: process.env.RUN_INTEGRATION !== '1' }, () => {
    it('un POST gana y el otro recibe 409 SLOT_TAKEN', async () => {
        const starts = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
        starts.setUTCHours(13, 0, 0, 0);
        const ends = new Date(starts.getTime() + 60 * 60 * 1000);
        const payload = {
            guest_name: 'Race Test',
            guest_email: `race-${Date.now()}@test.com`,
            guest_phone: '3000000000',
            items: [{
                court_id: 1,
                starts_at: starts.toISOString(),
                ends_at: ends.toISOString(),
            }],
        };

        const [a, b] = await Promise.all([
            postJson('/api/v1/bookings', payload),
            postJson('/api/v1/bookings', { ...payload, guest_email: `race-b-${Date.now()}@test.com` }),
        ]);

        const statuses = [a.status, b.status].sort();
        assert.deepEqual(statuses, [201, 409]);
        const conflict = a.status === 409 ? a : b;
        assert.equal(conflict.json.code, 'SLOT_TAKEN');
    });
});
