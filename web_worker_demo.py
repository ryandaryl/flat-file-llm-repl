import asyncio
from fastapi import FastAPI, BackgroundTasks
from fastapi.responses import HTMLResponse

app = FastAPI()

# A simple in-memory database to store job progress
JOBS = {}

async def heavy_computation(job_id: str):
    """The background task. Updates status as it processes."""
    JOBS[job_id] = "Running"
    await asyncio.sleep(5)  # Simulate a 5-second heavy background job
    JOBS[job_id] = "Task Completed Successfully!"

@app.post("/start-task/{job_id}")
def start_task(job_id: str, background_tasks: BackgroundTasks):
    """Starts the background task instantly without blocking the server."""
    JOBS[job_id] = "Pending"
    background_tasks.add_task(heavy_computation, job_id)
    return {"status": "Started", "job_id": job_id}

@app.get("/task-status/{job_id}")
def get_status(job_id: str):
    """Endpoint for the frontend to check if the task is running or done."""
    status = JOBS.get(job_id, "Not Found")
    return {"job_id": job_id, "status": status}
