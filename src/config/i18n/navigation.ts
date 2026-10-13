import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/** Locale-aware Link, redirect, usePathname and useRouter. Use these instead of next/link on customer pages. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
