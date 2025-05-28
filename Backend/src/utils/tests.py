import asyncio


async def test_emit():
    await asyncio.sleep(3)  # wait for connection
    await socket_manager.emit("server_test", {"msg": "Hello from backend"})