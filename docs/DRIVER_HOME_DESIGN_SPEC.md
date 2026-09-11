# Driver Home Screen — Build Spec

Implemented in this Expo app under `src/components/driver/home/` and
`src/screens/driver/driver-home-screen/`. Tokens live in `src/theme/driver-home.ts`.

Extracted from the approved mockup (online/offline states). Use this as ground truth
when building in Cursor — feed this file to Cursor's AI alongside the code as context.

## 1. Design tokens

### Color
| Token | Hex | Used for |
|---|---|---|
| `brand.green` | `#1C5A3B` | Online pill background, primary online accents |
| `brand.greenSoft` | `#DFF3E6` | Earnings pill bg, "looking for jobs" icon bg |
| `brand.greenDot` | `#2ECC71` | Online status dot (pill + bell badge) |
| `ink.charcoal` | `#333B46` | Offline pill background, "Go Online" button |
| `ink.primary` | `#1A1A1A` | Headline text ("Good morning, Montel", "London" label) |
| `ink.secondary` | `#6B7280` | Subtext ("You're online and ready for jobs") |
| `signal.red` | `#E14B3D` | "Go Offline" button |
| `map.bg` | `#E8E8E8` | Base map fill |
| `map.park` | `#C9E4C0` | Parks (Hyde Park) |
| `map.water` | `#AFD4EA` | River / water bodies |
| `map.road` | `#FFFFFF` | Roads |
| `location.dot` | `#2F6FED` | Current-location marker |
| `location.halo` | `rgba(47,111,237,0.18)` | Accuracy pulse ring |
| `surface.white` | `#FFFFFF` | Bottom sheet, floating buttons, top bar buttons |
| `surface.mutedIcon` | `#ECECEC` | "You're offline" icon circle bg |

### Typography
System font (SF Pro / Roboto). No custom face — matches native map-app conventions.
- Headline (`Good morning, Montel`): 18px / 700
- Body (`You're online and ready for jobs`): 14px / 500, `ink.secondary`
- Earnings value (`£0.00`): 20px / 800, tabular numerals
- Earnings label (`Today's earnings`): 12px / 600, `ink.secondary`
- Status line (`Looking for jobs...`): 15px / 700
- Status subtext: 13px / 500, `ink.secondary`
- Button label: 16px / 700

### Spacing / radius
- Sheet corner radius: 24px (top corners only)
- Floating button size: 48px circle
- Top bar button size: 44px circle
- Button/pill radius: full pill (999px) for CTAs and status toggle
- Sheet horizontal padding: 20px
- Vertical rhythm inside sheet: 16px between rows

## 2. Layout (z-order, bottom to top)
1. **Map** — full bleed, fills entire screen behind everything
2. **Top bar** — floating row: menu button (left) · online/offline pill (center) · notification bell w/ green dot badge (right)
3. **Map controls** — vertical stack, right edge, ~40% down the screen: compass/heading button, layers (map style) button, recenter/crosshair button
4. **Mapbox attribution** — bottom-left, required, do not remove or obscure
5. **Bottom sheet** — anchored bottom, rounded top corners, drag handle, slides up only for job offers/trip states (this base screen is its resting state)

## 3. Component states

### Online
- Pill: `brand.green` bg, white text "Online", filled green dot, chevron-down
- Sheet greeting subtext: "You're online and ready for jobs"
- Status row icon: `brand.greenSoft` circle bg, animated radiating-signal icon, `brand.green` icon color
- Status row text: "Looking for jobs..." / "We'll notify you when a job is nearby."
- CTA: `signal.red` full-width button, white text "Go Offline", square/stop icon

### Offline
- Pill: `ink.charcoal` bg, white text "Offline", gray/dim dot, chevron-down
- Sheet greeting subtext: "You're currently offline"
- Status row icon: `surface.mutedIcon` circle bg, muted/crossed-signal icon, gray icon color
- Status row text: "You're offline" / "Go online to start receiving jobs in your area."
- CTA: `ink.charcoal` full-width button, white text "Go Online", play icon

### Shared across both states
- Earnings pill (top-right of greeting row) always visible: `brand.greenSoft` bg, `£0.00`-style value, "Today's earnings" label, trailing chevron (tappable → earnings detail screen)
- Current-location marker always rendered on map with pulsing accuracy halo
- Notification bell always has a badge dot when there's an unread item

## 4. Interaction notes
- Tapping the top-bar pill toggles online/offline (should also trigger the actual go-online/go-offline API call + location permission check in production, not just a visual toggle)
- Tapping the bottom-sheet CTA does the same action as the top pill — keep them in sync, don't let them drift into separate state
- Recenter button snaps camera back to current location if the driver has panned the map away
- This screen is the *resting state*; job offers, active-trip navigation, and trip-complete summaries are separate overlays/sheets that replace the bottom sheet content when triggered (see prior prototype for that state machine — same states apply, just needs this visual system applied to it)
