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

@app.get("/", response_class=HTMLResponse)
def frontend():
    """A tiny, single-button frontend to demo the workflow in real-time."""
    return """
    <script>
        async function runJob() {
            const jobId = "job_" + Math.random().toString(36).substring(7);
            document.getElementById('status').innerText = "Starting...";
            
            // 1. Trigger the background process
            await fetch(`/start-task/${jobId}`, { method: 'POST' });
            
            // 2. Poll the status endpoint every 1 second until it finishes
            const interval = setInterval(async () => {
                const res = await fetch(`/task-status/${jobId}`);
                const data = await res.json();
                document.getElementById('status').innerText = `Status: ${data.status}`;
                
                if (data.status.includes("Successfully")) {
                    clearInterval(interval);
                }
            }, 1000);
        }
    </script>
    <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
        <button onclick="runJob()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">Run Background Process</button>
        <h3 id="status" style="margin-top: 20px; color: #333;">Click the button to start</h3>
    </div>
    """

