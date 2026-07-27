export function peopleFailureMessage(status: number): string {
  if (status === 400) return '組織の指定を確認してください。';
  if (status === 403) return 'この組織のPeopleは閲覧できません。';
  return 'Peopleを読み込めませんでした。時間をおいてもう一度お試しください。';
}
