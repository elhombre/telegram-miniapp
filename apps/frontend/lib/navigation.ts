export type AppNavSection = 'welcome' | 'notes' | 'dashboard'

export function getActiveNavSection(pathname: string): AppNavSection | null {
  if (pathname === '/') {
    return 'welcome'
  }

  if (pathname === '/dashboard/notes' || pathname.startsWith('/dashboard/notes/')) {
    return 'notes'
  }

  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    return 'dashboard'
  }

  return null
}

export function isNavHrefActive(pathname: string, href: '/' | '/dashboard/notes' | '/dashboard'): boolean {
  const section = getActiveNavSection(pathname)

  if (href === '/') {
    return section === 'welcome'
  }

  if (href === '/dashboard/notes') {
    return section === 'notes'
  }

  return section === 'dashboard'
}
