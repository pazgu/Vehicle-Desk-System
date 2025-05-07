# Vehicle-Desk-System-
# 🚗 Car Rental & Management System

A smart internal car rental platform designed for enterprises and government-level use.  
This system helps manage ride requests, vehicle allocation, supervisor approvals, and real-time tracking using SAP, RFID key dispensers, and LPR camera integrations.

---

## 🧰 Tech Stack

### Frontend
- [Angular] – TypeScript SPA framework
- [Primeng]– UI components

### Backend
- [Python 3.x]
- [FastAPI] – Modern, async Python web framework
- [SQLAlchemy]– ORM for DB models
- [PostgreSQL]– Relational database

### Integrations
- **SAP** – Sync for trip usage and approvals
- **RFID Key Dispenser** – Key authorization based on approved trips
- **LPR (License Plate Reader)** – Real-time vehicle entry/exit logging

---

## 🎯 Project Goals (MVP)

- Allow users to submit rides requests with purpose and time.
- Allow supervisors to approve or reject requests.
- Match requests to available vehicles intelligently.
- Enforce rules (time limits, licensing, exceptions).
- Log vehicle movements with LPR cameras.
- Authenticate users for key release via RFID cards.
- Admin dashboard to manage:
  - Vehicle statuses
  - Frozen/unavailable cars
  - Daily inspections & alerts

---

## 🚧 Folder Structure (Planned)
car-rental-system/
├── frontend/ # Angular App
│ ├── src/
│ └── ...
├── backend/ # FastAPI App
│ ├── app/
│ ├── routers/
│ ├── models/
│ └── main.py
├── docs/ # ERD, flowcharts, specs
├── .github/ # PR templates, workflows
├── README.md
└── requirements.txt

## 🚀 Getting Started

### 1. Clone the repo

### 2. Run backend

### 3. Run frontend

## 📌 Team Roles & Workflow
- Code must be submitted via Pull Requests.

- Only the team lead (admin) can approve merges into main.

- Developers push feature branches (feature/xyz) → PR → review → dev → main.

## 👤 Maintainer
Built and managed by the internal R&D team. 

