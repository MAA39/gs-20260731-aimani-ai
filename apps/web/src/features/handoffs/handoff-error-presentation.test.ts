import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyTodoHandoffFailure } from './handoff-error-presentation';

test('conflict reasons become typed, truthful Japanese messages', () => {
  const cases = [
    ['handoff_already_requested', 'すでに引き継ぎ依頼があります'],
    ['requester_is_not_current_assignee', '担当者が変更されています'],
    ['todo_not_open', '完了したTodoは引き継げません'],
    ['invalid_recipient', '引き継ぎ先を指定できません'],
    ['inactive_recipient', '引き継ぎ先は現在利用できません'],
    ['handoff_already_resolved', 'すでに対応済みです'],
  ] as const;

  for (const [reason, expectedMessage] of cases) {
    const result = classifyTodoHandoffFailure(409, { error: { code: 'conflict', message: reason } });
    assert.equal(result?.status, 'conflict');
    if (result?.status !== 'conflict') throw new Error('expected conflict');
    assert.equal(result.error.reason, reason);
    assert.match(result.error.message, new RegExp(expectedMessage));
  }
});

test('internal upstream messages are never exposed', () => {
  for (const [status, raw] of [[400, 'invalid_payload_field'], [403, 'Not allowed.'], [404, 'Todo Handoff not found.'], [409, 'database_constraint_xyz']] as const) {
    const result = classifyTodoHandoffFailure(status, { error: { code: 'internal', message: raw } });
    assert.ok(result);
    assert.doesNotMatch(result.error.message, new RegExp(raw));
  }
});

test('an unknown conflict remains typed without exposing its internal reason', () => {
  const result = classifyTodoHandoffFailure(409, { error: { message: 'database_constraint_xyz' } });
  assert.equal(result?.status, 'conflict');
  if (result?.status !== 'conflict') throw new Error('expected conflict');
  assert.equal(result.error.reason, 'unknown');
  assert.match(result.error.message, /状態が更新されています/);
});

test('a generic transport code is not mistaken for a domain reason', () => {
  const result = classifyTodoHandoffFailure(409, { error: { code: 'todo_not_open', message: 'unexpected upstream text' } });
  assert.equal(result?.status, 'conflict');
  if (result?.status !== 'conflict') throw new Error('expected conflict');
  assert.equal(result.error.reason, 'unknown');
});
