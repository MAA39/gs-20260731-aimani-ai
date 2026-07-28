export type DemoActor = {
  id: 'tanaka' | 'mori'
  name: string
  email: string
}

export const DEMO_ACTORS = [
  { id: 'tanaka', name: '田中 彩', email: 'owner@amidala.local' },
  { id: 'mori', name: '森 ハル', email: 'mori@amidala.local' },
] as const satisfies readonly DemoActor[]

export function isDemoActorSwitchEnabled(dev: boolean, password: string | undefined): password is string {
  return dev && Boolean(password?.trim())
}

export function demoActorSwitchFailureMessage(): string {
  return '操作ユーザーを切り替えられませんでした。もう一度お試しください。'
}
