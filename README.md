# 📚 Kutub Cloud

Aapki apni private digital library — Tafseer, Hadith, Fiqh, Nahw — sab folders me organized, musannif ke naam se, mobile-friendly, login-protected.

## Kaise kaam karta hai

- **Backend**: Node.js + Express + SQLite (folders/files ka data)
- **PDF storage**: Cloudinary (raw file storage, free tier)
- **Frontend**: Plain HTML/CSS/JS — koi build step nahi chahiye
- Backend hi frontend ko serve karta hai, isliye Render par sirf **ek** service deploy karni hai.

---

## Step 1: Cloudinary account (PDF storage)

1. https://cloudinary.com par free account banao
2. Dashboard khulte hi upar "Account Details" me teen cheezein milengi:
   - Cloud Name
   - API Key
   - API Secret
3. In teeno ko safe jagah copy kar lo — Step 4 me chahiye honge

## Step 2: GitHub par code daalna

1. https://github.com par naya repository banao (e.g. `kutub-cloud`) — **Private** rakho
2. Apne computer par (ya GitHub web upload se) is poore folder ko push karo:
   ```bash
   cd kutub-cloud
   git init
   git add .
   git commit -m "Kutub Cloud - initial version"
   git branch -M main
   git remote add origin https://github.com/<aapka-username>/kutub-cloud.git
   git push -u origin main
   ```
   (`.env` file kabhi commit mat karna — `.gitignore` me already excluded hai)

## Step 3: Render.com par deploy

1. https://render.com par free account banao (GitHub se sign up kar sakte ho)
2. Dashboard me **New +** → **Web Service**
3. Apna `kutub-cloud` GitHub repo connect karo
4. Ye settings bharo:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. **Environment Variables** section me ye sab add karo:
   | Key | Value |
   |---|---|
   | `ADMIN_USERNAME` | jo bhi username chaho |
   | `ADMIN_PASSWORD` | ek strong password |
   | `JWT_SECRET` | koi bhi lamba random string (e.g. 40 random characters) |
   | `CLOUDINARY_CLOUD_NAME` | Step 1 se |
   | `CLOUDINARY_API_KEY` | Step 1 se |
   | `CLOUDINARY_API_SECRET` | Step 1 se |
6. **Create Web Service** dabao — 2-3 minute me live ho jayegi
7. Render aapko ek URL dega jaise `https://kutub-cloud.onrender.com` — yahi aapki website hai

## Step 4: Use karna

1. URL kholo → login screen aayegi
2. Wahi username/password daalo jo Environment Variables me set kiya tha
3. Folders already ready hain (Tafseer, Hadith, Fiqh, Nahw) — inke andar jaake naye sub-folders (musannif ke naam se) bana sakte ho
4. "PDF Upload" se kitabein daalo, tap karke browser me hi padho, ya download karo

---

## Zaroori baatein (important notes)

- **Free tier ka behaviour**: Render ka free web service kuch der inactive rehne par "sleep" ho jaata hai — dobara khulne par 20-30 second lag sakte hain. Ye normal hai.
- **Database persistence**: SQLite file backend ke saath hi rehti hai. Render free tier par har naye deploy (code update) ke baad ye reset ho sakti hai. Agar ye masla ho to Render ka paid "Persistent Disk" add kar sakte ho, ya SQLite ki jagah Render's free PostgreSQL use kar sakte ho — bata dena, wo bhi bana dunga.
- **PDFs safe hain**: PDFs Cloudinary me store hoti hain, isliye wo database reset se affect nahi hoti.
- **Security**: Sirf ek hi login hai (aap) — password strong rakhna aur kisi ke saath share mat karna.

## Local par test karna (optional, deploy karne se pehle)

```bash
cd backend
npm install
cp .env.example .env
# .env file khol ke apni values bhar do
npm start
```

Phir browser me `http://localhost:5000` kholo.
