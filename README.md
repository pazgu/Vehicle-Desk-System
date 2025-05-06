# Vehicle-Desk-System-
# 🚗 Car Rental & Management System

A smart internal car rental platform designed for enterprises and government-level use.  
This system helps manage trip requests, vehicle allocation, supervisor approvals, and real-time tracking using SAP, RFID key dispensers, and LPR camera integrations.

---

## 🧰 Tech Stack

### Frontend
- [Angular](https://angular.io/) – TypeScript SPA framework
- [Tailwind CSS](https://tailwindcss.com/) – Utility-first styling
- [Shadcn/UI](https://ui.shadcn.com/) – UI components

### Backend
- [Python 3.x](https://www.python.org/)
- [FastAPI](https://fastapi.tiangolo.com/) – Modern, async Python web framework
- [SQLAlchemy](https://www.sqlalchemy.org/) – ORM for DB models
- [PostgreSQL](https://www.postgresql.org/) – Relational database

### Integrations
- **SAP** – Sync for trip usage and approvals
- **RFID Key Dispenser** – Key authorization based on approved trips
- **LPR (License Plate Reader)** – Real-time vehicle entry/exit logging

---

## 🎯 Project Goals (MVP)

- Allow users to submit trip requests with purpose and time.
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


