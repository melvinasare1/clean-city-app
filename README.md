# Clean City App - Waste Management MVP

A React Native + Expo mobile application for waste management with two user roles: **Customer** and **Driver**.

## 🚀 Tech Stack

- **Expo SDK 51** (managed workflow)
- **React Native 0.74**
- **TypeScript**
- **React Navigation** (Native Stack + Bottom Tabs)
- **Firebase** (Authentication + Firestore)

## 📁 Project Structure

```
clean-city-app-1/
├── App.tsx                          # Main entry point
├── app.json                         # Expo configuration
├── babel.config.js                  # Babel configuration
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript configuration
└── src/
    ├── components/                  # Reusable UI components
    ├── hooks/
    │   └── useAuth.ts              # Authentication hook
    ├── lib/
    │   └── constants.ts            # App constants (prices, colors, etc.)
    ├── navigation/
    │   ├── AuthNavigator.tsx       # Auth flow navigation
    │   ├── CustomerNavigator.tsx   # Customer bottom tabs
    │   ├── DriverNavigator.tsx     # Driver stack navigation
    │   └── RootNavigator.tsx       # Main navigation orchestrator
    ├── screens/
    │   ├── auth/
    │   │   ├── LoginScreen.tsx
    │   │   └── SignupScreen.tsx
    │   ├── customer/
    │   │   ├── CustomerHomeScreen.tsx
    │   │   ├── NewBookingScreen.tsx
    │   │   └── BookingListScreen.tsx
    │   ├── driver/
    │   │   ├── DriverHomeScreen.tsx
    │   │   ├── DriverJobListScreen.tsx
    │   │   └── DriverJobDetailScreen.tsx
    │   └── common/
    │       └── RoleSelectorScreen.tsx
    ├── services/
    │   └── firebase/
    │       └── firebaseConfig.ts   # Firebase initialization
    └── types/
        ├── user.ts                 # User type definitions
        └── booking.ts              # Booking type definitions
```

## 📚 Documentation

All documentation is organized in the [`docs/`](./docs/) folder. See [docs/README.md](./docs/README.md) for a complete index.

**Quick Links:**
- [Quick Start Guide](./docs/QUICK_START.md)
- [Setup Guide](./docs/SETUP_GUIDE.md)
- [Build and Submit Guide](./docs/BUILD_AND_SUBMIT_GUIDE.md)
- [Push Notifications Setup](./docs/PUSH_NOTIFICATIONS_SETUP.md)

## 🛠️ Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use an existing one)
3. Enable **Authentication** > Email/Password provider
4. Create a **Firestore Database**
5. Go to Project Settings > General > Your apps
6. Add a web app and copy the configuration
7. Open `src/services/firebase/firebaseConfig.ts`
8. Replace the placeholder values with your actual Firebase config:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef",
};
```

### 3. Run the App

```bash
npx expo start
```

Then:

- Scan the QR code with **Expo Go** app on your phone
- Or press `i` for iOS simulator
- Or press `a` for Android emulator

## 📱 Features (Day 1 MVP)

### Customer Flow

- ✅ Login / Signup screens
- ✅ Customer Home dashboard
- ✅ New Booking screen (bin selection with pricing)
- ✅ My Bookings list
- ✅ Bottom tab navigation

### Driver Flow

- ✅ Login / Signup screens
- ✅ Driver Home dashboard with stats
- ✅ Job List screen
- ✅ Job Detail screen
- ✅ Stack navigation

### Authentication

- ✅ Firebase Auth integration
- ✅ Email/Password login
- ✅ Auth state management with `useAuth` hook
- ✅ Temporary role selector (will be replaced with Firestore role lookup)

## 🚧 TODO for Next Phase

### Authentication & User Management

- [ ] Complete signup flow with role selection
- [ ] Fetch user role from Firestore on login
- [ ] Remove temporary RoleSelector screen
- [ ] Add password reset functionality
- [ ] Add profile management

### Customer Features

- [ ] Complete booking form (address input, date/time picker)
- [ ] Save bookings to Firestore
- [ ] Fetch and display user's bookings from Firestore
- [ ] Add booking detail view
- [ ] Add booking cancellation

### Driver Features

- [ ] Fetch assigned jobs from Firestore
- [ ] Implement job status updates (start, complete)
- [ ] Add location tracking
- [ ] Implement "Call Customer" functionality
- [ ] Add navigation/directions integration

### Backend/Firestore

- [ ] Design and implement Firestore collections:
  - `users` - User profiles with roles
  - `bookings` - Waste pickup bookings
  - `drivers` - Driver-specific data
- [ ] Add Firestore security rules
- [ ] Implement real-time listeners for job updates

### UI/UX Improvements

- [ ] Add loading states and error handling
- [ ] Create reusable components (Button, Card, etc.)
- [ ] Add form validation
- [ ] Improve styling and animations
- [ ] Add proper icons (replace emoji placeholders)

## 💰 Pricing Structure

Defined in `src/lib/constants.ts`:

- Small Bag: $25
- Large Bag: $40
- Standard Bin: $60
- Wheelie Bin: $100

## 🔧 Development Notes

### Running on Physical Device (Expo Go)

- Make sure your phone and computer are on the same network
- The app should run directly in Expo Go without needing Android Studio or Xcode

### Firebase Authentication

- The `useAuth` hook is ready to use with Firebase
- Login functionality is implemented and will work once you add your Firebase config
- Auth state changes are automatically detected

### Role Selection (Temporary)

- Currently using a `RoleSelectorScreen` to manually choose between customer and driver
- In production, this should be replaced with automatic role detection from Firestore user profile

### TypeScript

- All files use TypeScript
- Types are defined in `src/types/`
- Navigation types are properly typed for each navigator

## 📝 Scripts

```bash
# Start development server
npm start

# Start with cleared cache
npx expo start -c

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on web (if needed)
npm run web
```

## 🐛 Troubleshooting

### "Metro bundler not connecting"

```bash
npx expo start -c
```

### "Firebase errors"

- Make sure you've replaced all placeholder values in `firebaseConfig.ts`
- Check that Authentication and Firestore are enabled in Firebase Console

### "Module not found"

```bash
rm -rf node_modules
npm install
npx expo start -c
```

## 📞 Support

For issues or questions, please refer to:

- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation Docs](https://reactnavigation.org/)
- [Firebase Documentation](https://firebase.google.com/docs)

---

**Built with ❤️ for Clean City**
