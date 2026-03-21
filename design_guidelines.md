# Soccorso Digitale Transport Management - Design Guidelines

## Authentication Architecture

**Auth Required**: YES - Multi-role enterprise system with sensitive medical transport data

**Implementation**:
- Email/password authentication (enterprise context, not consumer SSO)
- Role-based access control:
  - **Crew/Equipaggio**: Trip entry, view own trips
  - **Administrator**: Full data access, editing, anomaly management
  - **Director/Direzione**: Dashboard and analytics read-only
- Login screen must include:
  - Soccorso Digitale logo at top
  - Email and password fields
  - "Remember me" toggle
  - Forgot password link
  - Corporate blue CTA button
- Account screen includes:
  - User role display (non-editable)
  - Assigned location/sede
  - Change password
  - Log out with confirmation

## Navigation Architecture

**Root Navigation**: Tab Bar (iOS) / Bottom Navigation (Android)

**Tab Structure** (3 tabs for crew role):
1. **Inserisci** (Create/Insert) - Center tab with larger icon
   - Core action: Trip entry form
2. **Viaggi** (Trips) - Left tab
   - Trip history and search
3. **Profilo** (Profile) - Right tab
   - Account settings

**Admin Web Panel**: Drawer Navigation
- Dashboard
- Fleet Management / Digital Twin
- Statistics by Location
- Statistics by Vehicle
- Timeline View
- UTIF Reports
- Data Management
- Settings

## Screen Specifications

### 1. Trip Entry Screen (Inserisci)
**Purpose**: Quick trip logging for ambulance crews

**Layout**:
- Header: Transparent, title "Nuovo Viaggio", right button "Duplica Ultimo" (icon)
- Root view: ScrollView with Form
- Safe area insets: top (headerHeight + Spacing.xl), bottom (tabBarHeight + Spacing.xl)

**Form Sections** (in order):
1. **Vehicle Selection** (if not pre-selected):
   - Sede dropdown: 5 locations
   - Mezzo dropdown: Vehicle codes (J 30, J 63, etc.)
2. **Route Information**:
   - Origin selector: "Ospedale" / "Altro" toggle
   - Origin input: If Ospedale → dropdown with searchable hospitals; if Altro → text input
   - Destination selector: Same pattern as origin
   - Reparto (Department): Searchable dropdown (Dialisi, Pronto Soccorso, etc.)
3. **Kilometers**:
   - Km Iniziali (initial): Numeric input
   - Km Finali (final): Numeric input
   - Km Percorsi (traveled): Auto-calculated, read-only, gray background
4. **Time**:
   - Data Servizio: Date picker (Italian format dd/mm/yyyy)
   - Ora Inizio: Time picker
   - Ora Fine: Time picker
   - Durata: Auto-calculated, read-only
5. **Service Type**:
   - Radio buttons or segmented control:
     - Emergenza
     - Trasporto Programmato
     - Dimissione
     - Dialisi
     - Accompagnamento Disabili
6. **Notes** (optional):
   - Multi-line text input
   - Placeholder: "Note aggiuntive..."

**Submit/Cancel**:
- Fixed footer above tab bar
- Two buttons: "Annulla" (outline) | "Salva Viaggio" (filled, blue)

### 2. Trip List Screen (Viaggi)
**Purpose**: View and search trip history

**Layout**:
- Header: Default navigation, title "I Miei Viaggi", search bar embedded
- Root view: FlatList
- Safe area insets: bottom (tabBarHeight + Spacing.xl)

**List Items**:
- Card design with subtle border
- Layout per card:
  - Top row: Progressive number badge (blue) | Date + Time (gray)
  - Middle: Origin → Destination (arrow icon between)
  - Bottom: Km percorsi badge | Durata badge
- Swipe actions: Edit (blue) | Delete (red)
- Empty state: "Nessun viaggio registrato" with icon

**Search**:
- Filter by date range
- Filter by vehicle
- Filter by destination

### 3. Profile Screen (Profilo)
**Purpose**: User settings and vehicle management

**Layout**:
- Header: Default, title "Profilo"
- Root view: ScrollView
- Safe area insets: top (Spacing.xl), bottom (tabBarHeight + Spacing.xl)

**Sections**:
1. User info card: Name, Role, Assigned Location (non-editable)
2. Vehicle selection: "Cambia Mezzo" → Modal with Sede + Mezzo pickers
3. Settings:
   - Language (Italian default)
   - Notifications toggle
4. Account actions:
   - Change Password
   - Log Out (with confirmation alert)

## Visual Design System

### Color Palette
**Primary Colors** (from Soccorso Digitale brand):
- Primary Blue: `#0066CC` (buttons, active states, badges)
- Primary Green: `#00A651` (success states, completion indicators)
- White: `#FFFFFF` (backgrounds, cards)
- Gray Scale:
  - Gray 50: `#F8F9FA` (disabled backgrounds)
  - Gray 200: `#E9ECEF` (borders)
  - Gray 500: `#6C757D` (secondary text)
  - Gray 900: `#212529` (primary text)

**Semantic Colors**:
- Error: `#DC3545`
- Warning: `#FFC107`
- Success: Primary Green
- Info: Primary Blue

### Typography
**Font Family**: System font (SF Pro for iOS, Roboto for Android)

**Scale**:
- H1 (Screen Titles): 28pt, Bold
- H2 (Section Headers): 20pt, Semibold
- H3 (Card Titles): 17pt, Semibold
- Body: 15pt, Regular
- Caption: 13pt, Regular
- Label: 12pt, Medium (all caps for badges)

### Spacing Scale
- xs: 4pt
- sm: 8pt
- md: 12pt
- lg: 16pt
- xl: 24pt
- xxl: 32pt

### Component Specifications

**Primary Button**:
- Height: 48pt
- Background: Primary Blue
- Text: White, 17pt Semibold
- Border radius: 8pt
- Press state: Opacity 0.8
- Padding: lg (vertical and horizontal)

**Input Fields**:
- Height: 48pt
- Border: 1pt solid Gray 200
- Border radius: 8pt
- Focus state: Border Primary Blue, 2pt
- Padding: md (horizontal)
- Label above: Gray 900, 13pt Medium

**Cards**:
- Background: White
- Border: 1pt solid Gray 200
- Border radius: 12pt
- Padding: lg
- Shadow: None (use border only for cleaner look)

**Badges**:
- Height: 24pt
- Padding: sm (horizontal)
- Border radius: 12pt (pill shape)
- Text: 12pt Medium, all caps
- Colors: Background Primary Blue 10% opacity, Text Primary Blue

**Dropdown/Picker**:
- Same as input fields
- Right icon: Chevron down (Gray 500)
- Modal presentation with search bar for long lists

### Icons
- Use Feather icons from @expo/vector-icons
- Size: 24pt for navigation, 20pt for inline actions
- Color: Match text or Primary Blue for interactive elements

### Critical Assets
**Required**:
1. **Soccorso Digitale Logo**: Full color version for app header and reports (SVG format)
2. **Vehicle Icons**: Ambulance icon for vehicle selection (single reusable icon)

**DO NOT generate**: Custom icons for common actions - use Feather system icons

### Interaction Design

**Loading States**:
- Use Primary Blue spinner
- Skeleton screens for trip list (gray placeholders matching card structure)

**Error Handling**:
- Inline validation for form fields (red border + red text below)
- Toast notifications for network errors (bottom sheet, 3s auto-dismiss)
- Alert dialogs for critical actions (delete trip)

**Success Feedback**:
- Green checkmark toast after trip save
- Haptic feedback on iOS for form submission

**Empty States**:
- Icon (Feather icon, gray)
- Message: Gray 500, 15pt
- Optional CTA button

### Accessibility

**Requirements**:
- Minimum touch target: 44x44pt (iOS HIG)
- Color contrast ratio: 4.5:1 for text
- All interactive elements labeled for screen readers
- Support dynamic type (text scaling)
- Form fields must have explicit labels (not just placeholders)
- Error messages announced to screen readers

### Localization
- All text in Italian
- Date format: gg/mm/aaaa (e.g., 15/12/2024)
- Time format: 24-hour (e.g., 14:30)
- Number format: European (comma as decimal separator)

### Report/PDF Design (for future admin web implementation)
- A4 portrait orientation
- Margins: 20mm all sides
- Header: Soccorso Digitale logo (left), Report title (center), Date (right)
- Footer: Page numbers (center)
- Colors: Primary Blue for headers, Primary Green for accents
- Tables: Gray 200 borders, alternating row backgrounds (White / Gray 50)