import React from 'react';

export const TanStackRouterDevtools = import.meta.env.PROD
  ? () => null // Render nothing in production
  : React.lazy(async () => {
      // const TanStackDevtools = (await import('@tanstack/react-devtools'))
      // .TanStackDevtools;
      const TanStackRouterDevtoolsComponent = (
        await import('@tanstack/react-router-devtools')
      ).TanStackRouterDevtools;
      const TanStackQueryDevtoolsComponent = (
        await import('@tanstack/react-query-devtools')
      ).ReactQueryDevtools;
      // const formDevtoolsPlugin = (await import('@tanstack/react-form-devtools'))
      // .formDevtoolsPlugin;
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
            {/* <TanStackDevtools
              plugins={[formDevtoolsPlugin()]}
              eventBusConfig={{ debug: true }}
            /> */}
          </>
        ),
      };
    });
