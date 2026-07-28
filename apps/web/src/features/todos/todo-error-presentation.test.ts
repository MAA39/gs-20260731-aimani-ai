import assert from 'node:assert/strict';
import test from 'node:test';
import { todoFailureMessage } from './todo-error-presentation';

test('Todo failures use stable Japanese guidance for each operation', () => {
  assert.equal(todoFailureMessage('assigned_workspace', 403), 'この組織ではTodoを閲覧できません。');
  assert.match(todoFailureMessage('shared_workspace', 404), /対象のPeopleが見つかりません/);
  assert.equal(todoFailureMessage('create', 400), '入力内容を確認してください。');
  assert.match(todoFailureMessage('assigned_workspace', 409), /状態が更新されています/);
});

test('read and create outages give action-specific retry guidance', () => {
  assert.match(todoFailureMessage('assigned_workspace', 503), /担当中のTodoを読み込めませんでした/);
  assert.match(todoFailureMessage('shared_workspace', 503), /PeopleのTodoを読み込めませんでした/);
  assert.match(todoFailureMessage('create', 503), /Todoを作成できませんでした/);
});

test('completion failures use fixed Japanese guidance', () => {
  assert.equal(todoFailureMessage('complete', 403), '現在の担当者だけがこのTodoを完了できます。');
  assert.equal(todoFailureMessage('complete', 409, 'handoff_pending'), '引き継ぎの確認待ちです。依頼を取り消すか、相手の返答後に完了してください。');
  assert.equal(todoFailureMessage('complete', 503), 'Todoを完了できませんでした。時間をおいて、もう一度お試しください。');
});
