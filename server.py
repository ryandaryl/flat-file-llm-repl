import asyncio
from fastapi import APIRouter, FastAPI, BackgroundTasks
from fastapi.responses import HTMLResponse

app = FastAPI()
api_router = APIRouter(prefix="/api")

# A simple in-memory database to store job progress
JOBS = {}

async def heavy_computation(job_id: str, data: dict):
    """The background task. Updates status as it processes."""
    JOBS[job_id] = "running"
    await asyncio.sleep(5)  # Simulate a 5-second heavy background job
    JOBS[job_id] = "success"
    print(data)

@api_router.post("/task/start/{job_id}")
def start_task(job_id: str, data: dict, background_tasks: BackgroundTasks):
    """Starts the background task instantly without blocking the server."""
    JOBS[job_id] = "waiting"
    background_tasks.add_task(heavy_computation, job_id, data)
    return {"status": "waiting", "job_id": job_id}

@api_router.get("/task/status/{job_id}")
def get_status(job_id: str):
    """Endpoint for the frontend to check if the task is running or done."""
    status = JOBS.get(job_id, "Not Found")
    return {"job_id": job_id, "status": status}

app.include_router(api_router)