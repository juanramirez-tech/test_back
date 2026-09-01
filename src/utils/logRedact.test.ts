import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { redactRequestUrl } from './logRedact';

describe('redactRequestUrl', () => {
    it('oculta access_code en path legado y query', () => {
        assert.equal(
            redactRequestUrl('/api/v1/bookings/49dbb779deadbeef'),
            '/api/v1/bookings/:accessCode'
        );
        assert.match(
            redactRequestUrl('/api/v1/admin/bookings?guest_email=ana@test.com'),
            /guest_email=REDACTED/
        );
    });
});
