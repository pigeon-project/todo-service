const styled = new Proxy(() => null as any, {
  get: () => styled,
  apply: () => () => null as any,
}) as any;

export default styled;

