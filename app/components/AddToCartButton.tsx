import React from 'react';
import {useFetcher, type FetcherWithComponents} from '@remix-run/react';
import {CartForm, type OptimisticCartLineInput} from '@shopify/hydrogen';

export function AddToCartButton({
  analytics,
  children,
  disabled,
  lines,
  onClick,
}: {
  analytics?: unknown;
  children: React.ReactNode;
  disabled?: boolean;
  lines: Array<OptimisticCartLineInput>;
  onClick?: () => void;
}) {
  const [inViewport, ref] = useDisplayInViewport<HTMLDivElement>();

  return (
    <div ref={ref}>
      {!inViewport && (
        <form action="/cart" method="post">
          <input
            type="hidden"
            name={'cartFormInput'}
            value={JSON.stringify({
              action: CartForm.ACTIONS.LinesAdd,
              inputs: {lines},
            })}
          />
          <button type="submit" onClick={onClick}>
            {children}
          </button>
        </form>
      )}
      {inViewport && (
        <CartForm
          route="/cart"
          inputs={{lines}}
          action={CartForm.ACTIONS.LinesAdd}
        >
          {(fetcher: FetcherWithComponents<any>) => (
            <>
              <input
                name="analytics"
                type="hidden"
                value={JSON.stringify(analytics)}
              />
              <button
                type="submit"
                onClick={onClick}
                disabled={disabled ?? fetcher.state !== 'idle'}
              >
                {children}
              </button>
            </>
          )}
        </CartForm>
      )}
    </div>
  );
}

function useDisplayInViewport<T extends HTMLElement>(): [
  boolean,
  React.RefObject<T>,
] {
  const [inViewport, setInViewport] = React.useState(false);

  const ref = React.useRef<T>(null);

  // return [true, ref];

  React.useEffect(() => {
    const callback: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        setInViewport((current) => current || entry.isIntersecting);
      });
    };
    const observer = new IntersectionObserver(callback, {threshold: 0.5});

    if (ref.current) {
      observer.observe(ref.current);
    }

    return function cleanup() {
      observer.disconnect();
    };
  }, []);

  return [inViewport, ref];
}
