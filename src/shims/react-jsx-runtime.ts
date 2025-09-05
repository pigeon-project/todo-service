export const Fragment: any = Symbol.for('react.fragment');

export function jsx(type: any, props: any, key?: any) {
  return { type, props: { ...props, key } };
}

export function jsxs(type: any, props: any, key?: any) {
  return { type, props: { ...props, key } };
}

export function jsxDEV(type: any, props: any, key?: any) {
  return { type, props: { ...props, key, __DEV__: true } };
}

