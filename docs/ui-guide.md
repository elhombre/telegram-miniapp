# UI Guide

- UI is shared between standalone web and Telegram Mini App.
- Header brand label is `Demo`; click it to navigate to `/`.
- UI stack: `shadcn/ui` + Tailwind CSS.
- Locales: `en`, `ru`.

Common routes:

- `/` -> Welcome
- `/dashboard/notes` -> Notes
- `/dashboard` -> Profile
- `/dashboard/linking` -> Account linking

Active navigation highlighting:

- `/dashboard/notes` highlights `Notes`
- `/dashboard` and non-notes dashboard pages highlight `Profile`

## Standalone Web Mode

- Header contains:
  - desktop top navigation (`Welcome`, `Notes`, `Profile`)
  - language switcher (`EN`/`RU`)
  - theme toggle (`light -> dark -> system`)
  - auth controls
- Welcome page shows auth CTA for unauthenticated users.
- Profile page (`/dashboard`) includes provider cards.
- Linking page (`/dashboard/linking`) contains account linking panel.
- Telegram provider card supports unlink action with confirmation dialog.

## Telegram Mini App Mode

- Header keeps only language + theme controls.
- Bottom navigation is used (`Welcome`, `Notes`, `Profile`).
- Safe-area paddings are applied for Telegram insets.
- Welcome page starts Telegram bootstrap auth automatically.
- Linking and unlink actions are disabled in Mini App UI.
