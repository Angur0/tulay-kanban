import asyncio
from backend.database import SessionLocal
from backend.routers.misc import export_gantt
from backend.models import User

async def main():
    db = SessionLocal()
    user = db.query(User).first()
    try:
        res = await export_gantt(board_id='ce1b5b38-d536-43f8-bdda-279817e90b9b', format='png', current_user=user, db=db)
        print("Success:", res)
    except Exception as e:
        import traceback
        traceback.print_exc()

asyncio.run(main())
