# 🧠 SYNAPSE SPPU - Full Project Documentation

## 📝 Overview
**SYNAPSE SPPU** is a premium educational resource portal designed for Savitribai Phule Pune University (SPPU) students. It simplifies access to Previous Year Question Papers (PYQs) and high-quality study notes through a sleek, modern, and highly responsive interface.

---

## 🛠 Technical Stack
### Core Technologies
- **Frontend**: HTML5, CSS3 (Custom Design System), JavaScript (ES6+).
- **Backend**: Node.js, Express.js.
- **Database**: MongoDB Atlas (NoSQL).
- **Auth**: Firebase Authentication (Student) & Express Session (Admin).

### Third-Party Integrations
- **Cloudinary/Local Storage**: For PDF and Image management.
- **Nodemailer**: Automated Email notifications via SMTP.
- **Vercel**: Deployment and Hosting.

---

## 📂 Project Architecture
```text
/
├── models/             # Database Schemas (Student, Feedback, Admin)
├── routes/             # API & Page Routing (Admin, Auth, API, Student)
├── public/             # Frontend Assets
│   ├── css/            # Style sheets (Glassmorphism design)
│   ├── js/             # Client-side logic (main.js, dashboard.js)
│   └── dashboard.html  # Admin interface
├── server.js           # Main Entry Point
├── .env                # Secret Environment Variables
└── vercel.json         # Deployment Configuration
```

---

## ✨ Key Features

### 1. Student Portal
- **Fast Search**: Instant subject/year-based filtering.
- **Premium Membership**: Pay-to-access exclusive content.
- **Feedback Form**: Auto-fills name for logged-in users.
- **PWA Ready**: Installable on mobile devices.
- **Theme Support**: Professional Dark and Light mode.

### 2. Admin Dashboard
- **Content Management**: Upload, Update, and Delete papers/notes.
- **Premium Management**: View pending requests, view screenshots, and approve/reject students.
- **Notification Center**: Red badges for unread feedback and new requests.
- **Performance Optimized**: Uses Parallel API loading for near-instant dashboard access.

---

## 📧 Automated Communication
- **SMTP Integration**: Sends premium approval/rejection emails.
- **Templates**: Modern dark-themed HTML emails with Indigo/Red accents.
- **Production URL**: `https://sppupyq-synapse.vercel.app`

---

## 🔑 Environment Variables (.env)
To run this project, you need the following keys:
- `MONGO_URI`: MongoDB connection string.
- `ADMIN_USER` & `ADMIN_PASS`: Admin panel credentials.
- `SESSION_SECRET`: Key for secure sessions.
- `EMAIL_USER` & `EMAIL_PASS`: Gmail SMTP credentials for notifications.

---

## 🚀 Deployment Instructions
1. **Local**: Run `npm run dev` to start the nodemon server.
2. **Vercel**: Push to GitHub. Ensure Environment Variables are added to the Vercel Dashboard settings.
3. **Database**: Whitelist IP `0.0.0.0/0` in MongoDB Atlas for Vercel connectivity.

---

## 📈 Future Scope
- **Search Analytics**: Track what students are searching for the most.
- **PDF Viewer**: In-built viewer to prevent direct downloads for premium content.
- **AI Integration**: Chatbot for quick student queries.

---
**Created by**: Shivam Navnath Shelke
**Project Name**: SYNAPSE SPPU
