import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notifySavedEnquiry, enquiryNotification } from '../src/lib/enquiry-mail.mjs';

const enquiry = {
  name: 'Test Customer', email: 'customer@example.com', phone: '+911234567890',
  company: 'Studio', city: 'Delhi', type: 'Project enquiry',
  message: '<b>Please call me</b>',
  items: [{ name: 'Panel', sku: 'SKU-1', quantity: 2 }],
};
const env = { ENQUIRY_SMTP_USER: 'sender@example.com', ENQUIRY_SMTP_APP_PASSWORD: 'abcd efgh ijkl mnop' };
const logger = { info() {}, warn() {}, error() {} };

test('notification uses fixed recipient and authenticated sender, with customer reply-to', () => {
  const mail = enquiryNotification('ref-1', enquiry, 'sender@example.com', 'info@inoxdecor.com');
  assert.equal(mail.to, 'info@inoxdecor.com');
  assert.equal(mail.from.address, 'sender@example.com');
  assert.equal(mail.replyTo.address, enquiry.email);
  assert.match(mail.text, /Reference: ref-1/);
  assert.match(mail.text, /SKU: SKU-1 \| Quantity: 2/);
  assert.equal(mail.html, undefined);
  assert.equal(mail.disableFileAccess, true);
});

test('missing credentials skip transport without failing the saved enquiry', async () => {
  const result = await notifySavedEnquiry('ref-2', enquiry, {
    env: {}, logger, createTransport() { throw new Error('Must not connect'); },
  });
  assert.equal(result, 'not-configured');
});

test('Google SMTP uses TLS and sends notification to configured recipient', async () => {
  const result = await notifySavedEnquiry('ref-3', enquiry, {
    env, logger, createTransport(options) {
      assert.equal(options.host, 'smtp.gmail.com');
      assert.equal(options.secure, true);
      assert.equal(options.auth.pass, 'abcdefghijklmnop');
      return { async sendMail(mail) {
        assert.equal(mail.to, 'info@inoxdecor.com');
        return { accepted: ['info@inoxdecor.com'], rejected: [] };
      } };
    },
  });
  assert.equal(result, 'accepted');
});

test('SMTP errors preserve submission success and never log credentials or customer content', async () => {
  const logs = [];
  const result = await notifySavedEnquiry('ref-4', enquiry, {
    env, logger: { ...logger, error(text) { logs.push(text); } },
    createTransport() { return { async sendMail() { throw new Error('sensitive SMTP response'); } }; },
  });
  assert.equal(result, 'failed');
  assert.deepEqual(logs, ['[enquiry-mail] delivery failed for enquiry ref-4; enquiry remains saved']);
});

test('rejected recipient is a delivery failure', async () => {
  const result = await notifySavedEnquiry('ref-5', enquiry, {
    env, logger, createTransport() {
      return { async sendMail() { return { accepted: [], rejected: ['info@inoxdecor.com'] }; } };
    },
  });
  assert.equal(result, 'failed');
});
