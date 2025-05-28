import socketio

sio = socketio.Client()

@sio.event
def connect():
    print("✅ Connected to server")

@sio.event
def disconnect():
    print("❌ Disconnected from server")

@sio.on("ride_created")
def on_ride_created(data):
    print("🎉 New ride created event received:", data)

sio.connect(
    "http://localhost:8000",
    auth={"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiMmViZjNhNi0xYmIwLTQ4YTQtYTRmYy1mNzYwYzAwYjZkNmUiLCJ1c2VybmFtZSI6ImRhbmEiLCJmaXJzdF9uYW1lIjoiZGFuYSIsImxhc3RfbmFtZSI6ImNvaGVuIiwicm9sZSI6ImVtcGxveWVlIiwiZGVwYXJ0bWVudF9pZCI6IjNmNjdmN2Q1LWQxYTQtNDVjMi05YWU0LThiN2EzYzUwZDNmYSIsImV4cCI6MTc0ODQzMDc1Nn0.N5Uv63VrDAelfyt8JLn7bzD6Tt5hzT0a8ykbc_CS0Kw"}
)

sio.wait()
