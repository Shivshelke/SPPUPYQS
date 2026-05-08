# 🧠 Project SYNAPSE — Comprehensive Overview

Developed by **Shivam Shelke**, SYNAPSE is a premium Previous Year Questions (PYQ) portal specifically designed for Engineering students at Savitribai Phule Pune University (SPPU).

---

## 🚀 Project Mission
To provide a seamless, organized, and AI-enhanced platform where engineering students can access high-quality study materials, including PYQs, solved papers, and handwritten notes, all in one place.

---

## 🛠️ Technology Stack

### **Frontend (UI/UX)**
- **Modern Web Design**: Uses Glassmorphism, animated mesh gradients, and a sleek dark/light mode toggle.
- **Core**: Semantic HTML5, Vanilla CSS3, and Vanilla JavaScript.
- **Responsiveness**: Fully optimized for mobile, tablet, and desktop views.

### **Backend (Logic)**
- **Runtime**: Node.js
- **Framework**: Express.js
- **Authentication**: 
  - **Firebase Admin SDK**: For secure Google Login integration.
  - **Local Auth**: Session-based authentication with `bcryptjs` for password hashing.
- **AI Integration**: **Google Gemini 1.5 Flash** powers the "Synapse Bot," providing helpful assistance to students.

### **Database & Storage**
- **Primary Database**: **MongoDB** (using Mongoose ODM) for storing student records, file metadata, and feedback.
- **File Storage**: **Cloudinary** for secure PDF hosting and automatic generation of blurred file previews.
- **Session Management**: `connect-mongo` for persistent user sessions.

### **Utilities**
- **Email**: `nodemailer` for instant feedback notifications.
- **File Uploads**: `multer` with Cloudinary storage engine.

---

## ✨ Key Features

### **1. Student Portal**
- **PYQ Library**: Browse papers by Year (FE to BE), Branch, and Subject.
- **Pattern Support**: Specifically focused on the **2024 Pattern**.
- **Secure Viewing**: In-browser PDF viewer with proxy protection to prevent unauthorized direct downloads.
- **Premium PRO**: Subscription-based access to solved papers, notes, and practice banks.

### **2. AI Assistant (Synapse Bot)**
- A friendly, professional chatbot that answers student queries about SPPU engineering and portal features.
- Uses Gemini AI for intelligent responses with a robust rule-based fallback system.

### **3. Admin Dashboard**
- **Centralized Management**: Protected portal to upload new PDFs, manage categories (Years, Branches, Subjects), and view portal stats.
- **Category Control**: Dynamically add or remove subjects and branches.
- **Direct Stats**: Real-time tracking of total files and registered students.

### **4. Feedback System**
- Integrated feedback form with automated email alerts to the developer.

---

## 📂 Project Structure

```text
synapse-sppu/
├── server.js           # Main Entry point (Express + MongoDB)
├── models/             # Database Schemas (Student, File, Feedback)
├── routes/             # API Endpoints
│   ├── auth.js         # Admin Auth logic
│   ├── student.js      # Student Auth & Google Login
│   ├── api.js          # Public browsing & AI Chatbot
│   └── admin.js        # Protected Admin operations
├── middleware/         # Auth guards & Security
├── public/             # Frontend Assets (HTML, CSS, JS, Images)
├── data/               # Configuration & Local Metadata
├── uploads/            # Temporary local storage for uploads
└── vercel.json         # Deployment config for Vercel
```

---

## 🔑 Environment Variables (.env)
To run this project, the following keys are required:
- `MONGODB_URI`: Connection string for MongoDB Atlas.
- `SESSION_SECRET`: Secret key for session encryption.
- `GEMINI_API_KEY`: API key from Google AI Studio.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: Cloudinary credentials.
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`: For Google Login.
- `EMAIL_USER`, `EMAIL_PASS`: For feedback email notifications.

---

## 🛡️ Security & Maintenance
- **Route Protection**: Admin and Premium routes are protected via middleware.
- **PDF Proxying**: Files are served through a secure proxy to hide actual Cloudinary URLs.
- **Password Security**: All local passwords are salted and hashed using bcrypt.
- **Deployment Ready**: Optimized for hosting on Vercel, Render, or Railway.

---
*Created with ❤️ for SPPU Students by Shivam Shelke.*
