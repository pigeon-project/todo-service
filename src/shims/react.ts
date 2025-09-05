export type FC<P = any> = (props: P) => any;
export type ReactNode = any;

export const useState = <T = any>(initial: T): [T, (v: T | ((prev: T) => T)) => void] => {
  let state = initial;
  const setState = (_: T | ((prev: T) => T)) => {
    if (typeof _ === 'function') {
      // @ts-ignore
      state = _(state);
    } else {
      state = _;
    }
  };
  return [state, setState];
};
export const useEffect = (_fn: any, _deps?: any) => {};
export const useMemo = <T = any>(fn: () => T, _deps?: any): T => fn();
export const useCallback = <T extends (...args: any[]) => any>(fn: T, _deps?: any): T => fn;
export const useRef = <T = any>(initial: T | null = null) => ({ current: initial }) as any;

export const StrictMode: any = {};

const React = { useState, useEffect, useMemo, useCallback, useRef, StrictMode } as any;
export default React;
