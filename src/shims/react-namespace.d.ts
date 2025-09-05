// Minimal React namespace to satisfy type references like React.MouseEvent
declare namespace React {
  interface MouseEvent<T = any> extends globalThis.MouseEvent {
    currentTarget: EventTarget & T;
  }
  interface FormEvent<T = any> extends globalThis.Event {
    currentTarget: EventTarget & T;
    target: EventTarget | null;
  }
}

declare namespace JSX {
  type Element = any;
  interface IntrinsicAttributes { key?: any }
  interface IntrinsicElements { [elemName: string]: any }
}
