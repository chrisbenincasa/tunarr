import React from 'react';

export const TanStackRouterDevtools = import.meta.env.PROD
  ? () => null // Render nothing in production
  : React.lazy(async () => {
      const TanStackRouterDevtoolsComponent = (
        await import('@tanstack/router-devtools')
      ).TanStackRouterDevtools;
      const TanStackQueryDevtoolsComponent = (
        await import('@tanstack/react-query-devtools')
      ).ReactQueryDevtools;
      // Lazy load in development
      return {
        default: () => (
          <>
            <TanStackRouterDevtoolsComponent
              position="bottom-left"
              toggleButtonProps={{}}
            />
            <TanStackQueryDevtoolsComponent
              initialIsOpen={false}
              buttonPosition="bottom-left"
            />
          </>
        ),
      };
    });
