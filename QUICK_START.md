# ⚡ Quick Start - Clean City App

## 🎯 3-Minute Setup

### 1️⃣ Install Dependencies (2 minutes)

```bash
npm install
```

### 2️⃣ Configure Firebase (30 seconds)

Open `src/services/firebase/firebaseConfig.ts` and replace:

```typescript
apiKey: "YOUR_FIREBASE_API_KEY_HERE",
authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
projectId: "YOUR_PROJECT_ID",
storageBucket: "YOUR_PROJECT_ID.appspot.com",
messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
appId: "YOUR_APP_ID",
```

Get these from: [Firebase Console](https://console.firebase.google.com/) → Your Project → Project Settings → Your apps

### 3️⃣ Start the App (30 seconds)

```bash
npx expo start
```

Scan QR code with **Expo Go** app on your phone!

---

## 📱 First-Time Test

1. **Create a test user** in Firebase Console:

   - Go to Authentication → Users → Add user
   - Email: `test@example.com`
   - Password: `test123456`

2. **Login** in the app with those credentials

3. **Select role**: Customer or Driver

4. **Explore** the screens!

---

## 🎨 What You'll See

### Customer Flow

- 🏠 **Home**: Dashboard with quick actions
- 📦 **New Booking**: Select bins, see live price calculation
- 📋 **My Bookings**: View bookings (mock data for now)

### Driver Flow

- 🚛 **Home**: Dashboard with stats
- 📋 **Jobs List**: See assigned jobs
- 📄 **Job Detail**: Job details and actions

---

## 🐛 Quick Troubleshooting

**Problem**: TypeScript errors in IDE?
**Solution**: Run `npm install` first - errors will disappear

**Problem**: Firebase auth errors?
**Solution**: Make sure you:

1. Replaced config values in `firebaseConfig.ts`
2. Enabled Email/Password auth in Firebase Console
3. Created a test user

**Problem**: Metro bundler issues?
**Solution**: `npx expo start -c` (clear cache)

---

## 📚 Full Documentation

- `README.md` - Complete project overview
- `SETUP_GUIDE.md` - Detailed setup instructions
- `FILE_LIST.md` - All files explained

---

## ✅ MVP Complete!

You now have:

- ✅ Firebase Auth integration
- ✅ Customer & Driver flows
- ✅ Navigation setup
- ✅ TypeScript throughout
- ✅ Clean, modern UI
- ✅ Ready to extend!

**Next**: Add Firestore integration to save/fetch real data!

🚀 Happy coding!
