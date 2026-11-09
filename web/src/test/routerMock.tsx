import { omit } from 'lodash-es';
import type { ElementType, ReactNode } from 'react';
import { forwardRef } from 'react';
import { vi } from 'vitest';

// Stands in for '@tanstack/react-router' in component tests:
//
//   vi.mock('@tanstack/react-router', () => import('@/test/routerMock.tsx'));
//
// Links render as plain anchors whose href is the `to` path with its `$params`
// filled in, and every navigate call lands in `navigateMock`.

export const navigateMock = vi.fn(() => Promise.resolve());

type LinkProps = {
  to?: string;
  params?: Record<string, string>;
  children?: ReactNode;
  [prop: string]: unknown;
};

const routerOnlyProps = ['search', 'preload', 'activeProps'];

const fillParams = (to?: string, params?: Record<string, string>) =>
  to?.replace(/\$(\w+)/g, (match, name: string) => params?.[name] ?? match);

export const createLink = (Component: ElementType) =>
  forwardRef<HTMLAnchorElement, LinkProps>(({ to, params, ...props }, ref) => (
    <Component
      ref={ref}
      href={fillParams(to, params)}
      {...omit(props, routerOnlyProps)}
    />
  ));

export const Link = createLink('a');

export const useNavigate = () => navigateMock;

export const useLocation = () => ({ pathname: '/', search: {}, hash: '' });
