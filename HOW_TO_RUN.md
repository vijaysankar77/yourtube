# YourTube — How to Run & Deploy

## Run Locally

### 1. Start the Backend

```bash
cd server
npm install
npm run dev        # starts on http://localhost:5000
```

> If you get "permission denied", run: `chmod +x node_modules/.bin/nodemon`

### 2. Start the Frontend

Open a **new terminal tab**:

```bash
cd yourtube
npm install
npm run dev        # starts on http://localhost:3000
```

Open **http://localhost:3000** in Chrome.

---

## Environment Files (already created)

**`server/.env`**
```
PORT=5000
DB_URL=mongodb+srv://vjbot63_db_user:Vijay777@cluster0.qenerfq.mongodb.net/yourtube?retryWrites=true&w=majority&appName=Cluster0
```

**`yourtube/.env.local`**
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
```

---

## Deploy to Production

### Step A — Deploy Backend to Render.com (Free)

1. Go to https://render.com and sign in with GitHub
2. Click **New → Web Service**
3. Connect your GitHub repo
4. Set these settings:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
5. Add environment variables:
   - `PORT` = `5000`
   - `DB_URL` = (your MongoDB Atlas URL)
6. Click **Create Web Service**
7. Copy the URL it gives you — e.g. `https://yourtube-api.onrender.com`

### Step B — Deploy Frontend to Vercel (Free)

1. Go to https://vercel.com and sign in with GitHub
2. Click **Add New → Project**
3. Import your GitHub repo
4. Set **Root Directory** to `yourtube`
5. Add environment variable:
   - `NEXT_PUBLIC_BACKEND_URL` = `https://yourtube-api.onrender.com` ← your Render URL
6. Click **Deploy**
7. Your site will be live at `https://yourtube-yourname.vercel.app`

### Step C — Update Firebase Authorized Domains

1. Go to https://console.firebase.google.com
2. Select **yourtube-8cda9** project
3. Go to **Authentication → Settings → Authorized domains**
4. Add your Vercel domain: `yourtube-yourname.vercel.app`

---

## All 18 Internship Tasks — Completed

| # | Task | Status |
|---|------|--------|
| 1 | Setting up Navbar | ✅ Done |
| 2 | Homepage with video grid | ✅ Done |
| 3 | Video watch page | ✅ Done |
| 4 | History page | ✅ Done |
| 5 | Liked videos & Watch later | ✅ Done |
| 6 | Channel page | ✅ Done |
| 7 | Channel create/edit dialogue | ✅ Done |
| 8 | Search page | ✅ Done |
| 9 | Backend setup (Express + MongoDB) | ✅ Done |
| 10 | User model & API | ✅ Done |
| 11 | Firebase Google Sign-In | ✅ Done |
| 12 | Video model & channel model | ✅ Done |
| 13 | Video upload to DB | ✅ Done |
| 14 | Integrating video API | ✅ Done |
| 15 | Like & dislike | ✅ Done |
| 16 | Watch later & get request | ✅ Done |
| 17 | Comment section (enhanced) | ✅ Done — multi-language, translate, like/dislike/report, moderation |
| 18 | Deployment | ✅ See steps above |
