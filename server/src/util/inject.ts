import type { interfaces } from 'inversify';

export function bindFactoryFunc<
  Func extends (...args: Params) => Ret,
  Ret = ReturnType<Func>,
  Params extends unknown[] = Parameters<Func>,
  // Ret = Func extends (...args: unknown[]) => infer R ? R : never,
>(
  bind: interfaces.Bind,
  key: interfaces.ServiceIdentifier,
  func: (ctx: interfaces.Context) => (...args: Params) => Ret,
) {
  return bind<Func>(key).toFactory<Ret, Params>(func);
}
