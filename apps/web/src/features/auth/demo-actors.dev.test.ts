import test from 'node:test'
import assert from 'node:assert/strict'
import { DEMO_ACTORS, demoActorSwitchFailureMessage, isDemoActorSwitchEnabled } from './demo-actors.dev'

test('demo actors use the domain names and seeded emails', () => {
  assert.deepEqual(DEMO_ACTORS, [
    { id: 'tanaka', name: '田中 彩', email: 'owner@amidala.local' },
    { id: 'mori', name: '森 ハル', email: 'mori@amidala.local' },
  ])
})

test('actor switch requires both development mode and a password', () => {
  assert.equal(isDemoActorSwitchEnabled(true, 'local-password'), true)
  assert.equal(isDemoActorSwitchEnabled(false, 'local-password'), false)
  assert.equal(isDemoActorSwitchEnabled(true, ''), false)
  assert.equal(isDemoActorSwitchEnabled(true, undefined), false)
})

test('actor switch failure never exposes an upstream message', () => {
  assert.equal(demoActorSwitchFailureMessage(), '操作ユーザーを切り替えられませんでした。もう一度お試しください。')
})
