// Provide a typed declaration for the debug store attached to window
declare global {
  interface Window {
    __APP_STORE__?: import('../store/store').default;
  }
}

export {};

