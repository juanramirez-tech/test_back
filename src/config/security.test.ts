import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { timingSafeStringEqual, validatePassword } from './security';

describe('timingSafeStringEqual', () => {
    it('acepta strings iguales', () => {
        assert.equal(timingSafeStringEqual('secret-value', 'secret-value'), true);
    });

    it('rechaza distintos sin exigir la misma longitud', () => {
        assert.equal(timingSafeStringEqual('ab', 'abcd'), false);
        assert.equal(timingSafeStringEqual('abcd', 'ab'), false);
        assert.equal(timingSafeStringEqual('aaaa', 'aaab'), false);
    });
});

describe('validatePassword', () => {
    it('exige longitud y mezcla letra+número', () => {
        assert.equal(validatePassword('short'), 'La contraseña debe tener entre 8 y 128 caracteres');
        assert.equal(validatePassword('onlyletters'), 'La contraseña debe incluir letras y números');
        assert.equal(validatePassword('12345678'), 'La contraseña debe incluir letras y números');
        assert.equal(validatePassword('Abcdefg1'), null);
    });
});
