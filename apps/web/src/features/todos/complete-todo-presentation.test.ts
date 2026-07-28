import assert from 'node:assert/strict';
import test from 'node:test';
import { completeTodoSuccessMessage } from './complete-todo-presentation';

test('completion success uses a stable announcement', () => {
  assert.equal(completeTodoSuccessMessage(), 'Todoを完了しました。');
});
