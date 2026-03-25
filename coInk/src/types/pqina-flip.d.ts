declare module '@pqina/flip' {
  const Tick: {
    DOM: {
      create: (
        element: HTMLElement,
        options?: { value?: string },
      ) => {
        value: string;
        destroy: () => void;
      };
    };
  };

  export default Tick;
}

