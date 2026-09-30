const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
const path = require('node:path')
const html = fs.readFileSync(path.join(__dirname, '../../apps/landing/index.html'), 'utf8')
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1]
function redirect(hash, search = '') {
  const destinations = []
  vm.runInNewContext(script, { location: { hash, search, replace: url => destinations.push(url) }, URLSearchParams })
  return destinations
}
test('legacy dashboard and invitation URLs reach the admin router', () => {
  assert.deepEqual(redirect('#/dashboard'), ['app/#/dashboard'])
  assert.deepEqual(redirect('#/undangan/FAKE_TEST_TOKEN'), ['app/#/undangan/FAKE_TEST_TOKEN'])
})
test('email/OAuth fragments and authorization codes reach the auth client', () => {
  assert.deepEqual(redirect('#access_token=FAKE_TEST_TOKEN&refresh_token=FAKE'), ['app/#access_token=FAKE_TEST_TOKEN&refresh_token=FAKE'])
  assert.deepEqual(redirect('#error=access_denied'), ['app/#error=access_denied'])
  assert.deepEqual(redirect('', '?code=FAKE_TEST_CODE'), ['app/?code=FAKE_TEST_CODE'])
})
test('normal landing anchors and external redirect parameters stay on the landing', () => {
  for (const hash of ['', '#harga', '#demo', '#faq']) assert.deepEqual(redirect(hash), [])
  assert.deepEqual(redirect('', '?redirect=https://example.invalid'), [])
})
