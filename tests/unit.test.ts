// Pruebas de lógica pura (sin red ni base de datos). Ejecutar: npm test (Node 22.18+).
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
process.env.META_APP_SECRET = 'secreto123';
process.env.META_VERIFY_TOKEN = 'tok';
const { verifyMetaSignature, handleVerification, mapMetaLead } = await import('../lib/meta.ts');
const { normalizePhone, formatPhone } = await import('../lib/phone.ts');
const { formatCLP, santiagoLocalToDate, toSantiagoLocalInput } = await import('../lib/format.ts');

test('firma HMAC', () => {
  const body = Buffer.from('{"entry":[{"changes":[{"field":"leadgen"}]}],"ñ":"á"}');
  const sig = 'sha256=' + crypto.createHmac('sha256', 'secreto123').update(body).digest('hex');
  assert.equal(verifyMetaSignature(body, sig), true);
  assert.equal(verifyMetaSignature(Buffer.from(body.toString() + ' '), sig), false);
  assert.equal(verifyMetaSignature(body, 'sha256=' + '0'.repeat(64)), false);
  assert.equal(verifyMetaSignature(body, null), false);
  assert.equal(verifyMetaSignature(body, 'sha256=zz'), false);
  assert.equal(verifyMetaSignature(body, sig.replace('sha256=', 'sha1=')), false);
});

test('handshake', async () => {
  const ok = handleVerification(new Request('http://x/?hub.mode=subscribe&hub.verify_token=tok&hub.challenge=123'));
  assert.equal(ok.status, 200); assert.equal(await ok.text(), '123');
  assert.equal(handleVerification(new Request('http://x/?hub.mode=subscribe&hub.verify_token=mal&hub.challenge=1')).status, 403);
  assert.equal(handleVerification(new Request('http://x/?hub.mode=subscribe&hub.challenge=1')).status, 403);
});

test('mapeo Lead Ads', () => {
  const m = mapMetaLead({ id: '1', campaign_name: 'Porsche Oct', ad_name: 'Video 911', field_data: [
    { name: 'full_name', values: ['Ana Pérez'] }, { name: 'phone_number', values: ['+56912345678'] },
    { name: 'email', values: ['ana@x.cl'] }, { name: '¿qué_auto_buscas?', values: ['SUV'] } ] });
  assert.equal(m.name, 'Ana Pérez'); assert.equal(m.phone, '+56912345678'); assert.equal(m.email, 'ana@x.cl');
  assert.equal(m.campaign, 'Porsche Oct');
  assert.match(m.notes, /Campaña: Porsche Oct/); assert.match(m.notes, /¿qué auto buscas\?: SUV/);
  const m2 = mapMetaLead({ id: '2', field_data: [{ name: 'first_name', values: ['Juan'] }, { name: 'last_name', values: ['Soto'] }, { name: 'teléfono', values: ['9 8765 4321'] }] });
  assert.equal(m2.name, 'Juan Soto'); assert.equal(m2.phone, '9 8765 4321');
});

test('teléfonos', () => {
  assert.equal(normalizePhone('+56 9 1234 5678'), '56912345678');
  assert.equal(normalizePhone('9 1234 5678'), '56912345678');
  assert.equal(normalizePhone('912345678'), '56912345678');
  assert.equal(normalizePhone('1234 5678'), '56912345678');
  assert.equal(normalizePhone('22 123 4567'), '56221234567');
  assert.equal(normalizePhone('0056912345678'), '56912345678');
  assert.equal(normalizePhone('+54 9 11 2345 6789'), '5491123456789');
  assert.equal(normalizePhone('123'), null);
  assert.equal(normalizePhone(''), null);
  assert.equal(formatPhone('56912345678'), '+56 9 1234 5678');
});

test('CLP', () => {
  assert.equal(formatCLP(12990000), '$12.990.000');
  assert.equal(formatCLP(0), '$0');
  assert.equal(formatCLP(999), '$999');
});

test('zona America/Santiago', () => {
  // Invierno (UTC-4) y verano (UTC-3)
  assert.equal(santiagoLocalToDate('2026-07-15T15:00')!.toISOString(), '2026-07-15T19:00:00.000Z');
  assert.equal(santiagoLocalToDate('2026-12-15T15:00')!.toISOString(), '2026-12-15T18:00:00.000Z');
  assert.equal(toSantiagoLocalInput(new Date('2026-12-15T18:00:00Z')), '2026-12-15T15:00');
  assert.equal(santiagoLocalToDate('mal'), null);
});

const { messageBody } = await import('../lib/whatsapp.ts');
test('mensajes WhatsApp', () => {
  assert.equal(messageBody({ from: '1', id: 'a', type: 'text', text: { body: 'Hola' } }), 'Hola');
  assert.equal(messageBody({ from: '1', id: 'a', type: 'image', image: { caption: 'foto del auto' } }), '[image] foto del auto');
  assert.equal(messageBody({ from: '1', id: 'a', type: 'image' }), '[image]');
  assert.equal(messageBody({ from: '1', id: 'a', type: 'audio' }), '[audio]');
  assert.equal(messageBody({ from: '1', id: 'a', type: 'interactive', interactive: { button_reply: { title: 'Sí' } } }), 'Sí');
  assert.equal(messageBody({ from: '1', id: 'a', type: 'location', location: { latitude: -33.4, longitude: -70.6 } }), '[location] -33.4,-70.6');
});
