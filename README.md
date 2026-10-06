# Trubond 🎓

<div align="center">

![Trubond](https://img.shields.io/badge/Trubond-College_Networking_Platform-blue?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)
![Firebase](https://img.shields.io/badge/Firebase-Backend-orange?style=for-the-badge&logo=firebase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=for-the-badge&logo=tailwindcss)

**A modern college networking platform for students to connect, collaborate, communicate, and discover campus opportunities.**

[🌐 Live Demo](https://trubond.netlify.app) • [💻 GitHub](https://github.com/SibgatOfficial/Trubond)

</div>

---

## 📖 Overview

**Trubond** is a full-stack college networking platform designed to bring students, projects, events, and communication into a single digital ecosystem.

The platform allows students to:

- 👤 Create and manage personal profiles
- 📝 Create and interact with posts
- 👥 Discover and collaborate on projects
- 🎪 Create and participate in events
- 💬 Communicate through real-time messaging
- 📷 Use QR-based functionality for event workflows
- 🏫 Connect with students across departments
- 📚 Discover opportunities and campus activities

Trubond is built using a modern **Next.js + React + TypeScript** architecture with **Firebase** providing authentication, database, real-time functionality, and storage services.

---

## ✨ Features

### 🔐 Authentication & User Profiles

Trubond provides an authentication and profile system powered by Firebase.

**Features include:**

- User authentication
- Account management
- Profile creation and editing
- Department information
- Academic information
- User-specific data
- Persistent profile information

---

### 📝 Social Feed

The social feed allows students to share information and interact with other members of the campus community.

**Features include:**

- Create posts
- Share text-based content
- Media-supported content
- View community posts
- User interactions
- Dynamic feed updates

---

### 👥 Project Collaboration

Students can create and discover projects and build teams around shared interests and skills.

**Project functionality includes:**

- Create projects
- Project descriptions
- Team formation
- Member management
- Project discovery
- Collaboration workflows
- Project communication

This helps students find teammates for academic projects, hackathons, competitions, and personal initiatives.

---

### 🎪 Event Management

Trubond provides functionality for discovering and managing college-related events.

**Features include:**

- Create events
- Event details
- Event discovery
- Participation workflows
- QR-based functionality
- Attendance-related workflows
- Event information management

---

### 💬 Real-Time Communication

Trubond includes real-time communication functionality powered by Firebase.

The application supports communication in different contexts, including:

- 🌎 Global communication
- 🏫 Department communication
- 👥 Project communication

Messages can be synchronized in real time, allowing users to communicate without manually refreshing the application.

---

### 📷 QR Code Functionality

QR-based functionality is integrated into the platform for event-related workflows.

The project uses QR libraries to support:

- QR code generation
- QR code scanning
- Event-related verification workflows

---

### 📱 Responsive Interface

The application is designed to provide a responsive experience across different screen sizes.

Supported layouts include:

- 💻 Desktop
- 📱 Mobile
- 📟 Tablet

The interface uses responsive Tailwind CSS utilities to adapt components and layouts to different viewport sizes.

---

# 🛠️ Technology Stack

## Frontend

| Technology | Purpose |
|---|---|
| **Next.js 15** | React framework and application architecture |
| **React 19** | UI development |
| **TypeScript** | Type-safe development |
| **Tailwind CSS** | Styling and responsive layouts |
| **shadcn/ui** | Reusable UI components |
| **Radix UI** | Accessible component primitives |
| **Lucide React** | Interface icons |

---

## Backend & Cloud Services

| Technology | Purpose |
|---|---|
| **Firebase Authentication** | User authentication |
| **Cloud Firestore** | Application data |
| **Firebase Realtime Database** | Real-time communication and synchronization |
| **Firebase Storage** | User-generated files and media |
| **Cloudinary** | Media upload functionality |

---

## Utilities & Libraries

The project also uses libraries for functionality such as:

- QR code generation
- QR code scanning
- Toast notifications
- Form handling
- Utility functions
- Component variants
- Responsive UI behavior

---

# 🏗️ Architecture

Trubond follows a modern component-based architecture.

```text
                         ┌──────────────────────┐
                         │       Trubond        │
                         │    Next.js App       │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
              ┌──────────┐    ┌──────────┐    ┌───────────┐
              │  React   │    │ Next.js  │    │ TypeScript│
              │    UI    │    │ Routing  │    │   Types   │
              └──────────┘    └──────────┘    └───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │       Firebase       │
                         ├──────────────────────┤
                         │ Authentication       │
                         │ Firestore            │
                         │ Realtime Database    │
                         │ Storage              │
                         └──────────────────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │      Cloudinary      │
                         │    Media Uploads     │
                         └──────────────────────┘
