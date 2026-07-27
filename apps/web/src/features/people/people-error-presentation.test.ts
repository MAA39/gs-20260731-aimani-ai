import assert from 'node:assert/strict';
import test from 'node:test';
import { peopleFailureMessage } from './people-error-presentation';

test('People failures use stable Japanese guidance by status', () => {
  assert.equal(peopleFailureMessage(400), '組織の指定を確認してください。');
  assert.equal(peopleFailureMessage(403), 'この組織のPeopleは閲覧できません。');
  assert.match(peopleFailureMessage(503), /Peopleを読み込めませんでした/);
  assert.match(peopleFailureMessage(500), /時間をおいてもう一度/);
});
