🚗 Vehicle-Desk-System

Enterprise Car Rental & Management Platform

A smart internal vehicle management system designed for enterprises and government-level use.
The system provides ride requests, supervisor approvals, automated vehicle allocation, inspections, real-time tracking and more.

🧰 Tech Stack
Frontend

[Angular] – TypeScript SPA framework

[PrimeNG] – UI components library

[Socket.IO Client] – Real-time updates

Backend

[Python 3.x]

[FastAPI] – Modern, async Python web framework

[SQLAlchemy] – ORM for DB models

[PostgreSQL] – Relational database

[Socket.IO] – Real-time communication

[APScheduler] – Scheduled background jobs

Integrations
Email System – Ride completion forms & notifications

✨ Key Features

User Ride Requests → request rides with purpose, vehicle type, and time

Supervisor Approvals → approve/reject rides with audit logging

Smart Vehicle Allocation → prioritize based on fuel type, distance, availability

Rules Enforcement → licensing checks, time limits, 4x4 reasons, frozen cars

Real-Time Tracking → WebSocket updates for ride changes & notifications

Admin Dashboard →

Vehicle statuses & inspections

Alerts (expired licenses, overdue rides, etc.)

Department-wide ride monitoring

Ride Completion Forms → scheduled email reminders, submission workflows

📂 Project Structure
Vehicle-Desk-System/
  ├── frontend/        # Angular App
  │   ├── src/
  │   └── ...
  ├── backend/         # FastAPI App
  │   ├── app/
  │   ├── routers/     # API routes
  │   ├── models/      # SQLAlchemy models
  │   ├── services/    # Business logic
  │   ├── utils/       # contains APScheduler 
  │   ├──requirements.txt
  │   └── main.py
  

🚀 Getting Started
1️⃣ Clone the Repository
git clone https://github.com/pazgu/Vehicle-Desk-System.git
cd Vehicle-Desk-System

2️⃣ Backend Setup
cd Backend
pip install -r requirements.txt
uvicorn app.main:sio_app --reload

3️⃣ Frontend Setup
cd Frontend
npm install
npm start

4️⃣ (Optional) Run with Docker
docker-compose up --build

📌 Team Workflow

All changes go through Pull Requests (PRs)

Branch naming: feature/<name>, fix/<name>, hotfix/<name>

PR → Code Review → Merge into dev → Merge into main

Only admins can approve merges into main
