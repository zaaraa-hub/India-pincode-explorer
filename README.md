# 🇮🇳 India Pincode Explorer

### Real Indian postal data with an optional AI-assisted search and local insights layer.

**Built by Zaara Mulani**  
Diploma in Computer Engineering | MPSTME, NMIMS

🔗 **Live Demo:** https://india-pincode-explorer-0fki.onrender.com/  
💻 **GitHub:** https://github.com/zaaraa-hub/India-pincode-explorer  
🔗 **LinkedIn:** https://www.linkedin.com/in/zaara-mulani/

---

## 📌 About the Project

**India Pincode Explorer** is a full-stack web application that allows users to search Indian PIN codes or place/post office names and retrieve postal information such as post office, district, state, region, and division.

The application uses a **Node.js + Express backend** to communicate with an external postal data source instead of storing the postal information directly in the frontend.

An optional **Anthropic Claude AI integration** adds query correction and short local-profile generation when an API key is configured.

---

## ✨ Features

- 🔎 Search by **6-digit Indian PIN code**
- 📍 Search using **place or post office names**
- 🏤 Retrieve real postal information
- 🗺️ Display:
  - Post Office
  - District
  - State
  - Region
  - Division
- ✅ Clearly identifies verified India Post data
- 🤖 Optional AI-assisted typo/query correction
- 💡 Optional AI-generated local profiles
- 📌 Optional nearby PIN code suggestions
- 🕘 Stores recent searches in the browser
- 📱 Responsive interface
- ⚡ Express backend with REST-style API routes
- 🌐 Deployed using Render

---

## 🖥️ Tech Stack

### Frontend

- HTML5
- CSS3
- JavaScript

### Backend

- Node.js
- Express.js
- CORS
- dotenv

### APIs & AI

- India Post postal data API
- Anthropic Claude API *(optional)*

### Development & Deployment

- Git
- GitHub
- Render

---

## 🏗️ How It Works

The application follows this architecture:

```text
                 ┌─────────────────┐
                 │      User       │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │    Frontend     │
                 │  HTML/CSS/JS    │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │  Express.js     │
                 │     Backend     │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │  Postal Data    │
                 │      API        │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │ Verified Postal │
                 │      Data       │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │    Frontend     │
                 │  Search Result  │
                 └─────────────────┘
