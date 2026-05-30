import os
import asyncio
from fastapi import APIRouter, FastAPI, BackgroundTasks
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from execute import execute_code_and_write_files

app = FastAPI()
api_router = APIRouter(prefix="/api")

# A simple in-memory database to store job progress
JOBS = {}
context = {}

async def background_task(job_id: str, data: dict):
    """The background task. Updates status as it processes."""
    JOBS[job_id] = "running"
    try:
        execute_code_and_write_files(code=data["content"], con=context)
    except Exception as e:
        JOBS[job_id] = "run_error"
        raise e
    JOBS[job_id] = "success"

@api_router.post("/task/start/{job_id}")
def start_task(job_id: str, data: dict, background_tasks: BackgroundTasks):
    """Starts the background task instantly without blocking the server."""
    JOBS[job_id] = "waiting"
    background_tasks.add_task(background_task, job_id, data)
    return {"status": "waiting", "job_id": job_id}

@api_router.get("/task/status/{job_id}")
def get_status(job_id: str):
    """Endpoint for the frontend to check if the task is running or done."""
    status = JOBS.get(job_id, "Not Found")
    return {"job_id": job_id, "status": status}

@api_router.post("/execution/list/")
def list_executions(query: dict):
    """
    {
        "content": {"default": True}, Whether to read cell content
        "output": {"default": {"start": null, "end": null}}, Which output lines to read for cells
    }
    """
    output_list = sorted([file for file in os.listdir("project/output")])
    cells = sorted([file for file in os.listdir("project") if file != "output"])
    output_list = output_list + [None]*(len(cells) - len(output_list))
    return [{
            "id": cell,
            "content_hash": cell,
            "output_hash": output,
            "content": open("project/" + cell).read(),
            "output": open("project/output/" + output).read(),
        }
        for cell, output in zip(cells, output_list, strict=True)]

app.include_router(api_router)
