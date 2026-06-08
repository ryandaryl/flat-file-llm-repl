import os
from flask import Flask, jsonify, request

import database
from execute import execute_code_and_write_files

app = Flask(__name__)

# A simple in-memory database to store job progress
JOBS = {}
context = {}

@app.route("/api/task/start/<job_id>", methods=["POST"])
def start_task(job_id):
    """
    Starts the task in a strict, single-threaded manner. 
    The HTTP response waits until the task finishes processing.
    """
    data = request.json
    JOBS[job_id] = "waiting"
    
    # Strictly synchronous execution on the main thread without background tasks
    JOBS[job_id] = "running"
    try:
        execute_code_and_write_files(code=data["content"], con=context)
    except Exception as e:
        JOBS[job_id] = "run_error"
        return jsonify({"status": "run_error", "job_id": job_id, "error": str(e)}), 500
    
    JOBS[job_id] = "success"
    return jsonify({"status": "success", "job_id": job_id})

@app.route("/api/task/status/<job_id>", methods=["GET"])
def get_status(job_id):
    """Endpoint for the frontend to check the task status."""
    status = JOBS.get(job_id, "Not Found")
    return jsonify({"job_id": job_id, "status": status})

@app.route("/api/execution/hide/", methods=["POST"])
def hide_execution():
    query = request.json
    database.init_db("project")
    database.insert_execution(previous=None, code=query["code_hash"], output=query["output_hash"], type="hide")
    return jsonify({"status": "success"})

@app.route("/api/execution/list/", methods=["POST"])
def list_executions():
    """
    {
        "content": {"default": True}, Whether to read cell content
        "output": {"default": {"start": null, "end": null}}, Which output lines to read for cells
    }
    """
    query = request.json
    database.init_db("project.db")
    
    executions = database.fetch_executions()
    executions_with_type = {(execution["code"], execution["output"], execution["type"]) for execution in executions}
    
    filtered_executions = [
        execution for execution in executions 
        if (execution["code"], execution["output"], "hide") not in executions_with_type
    ]
    
    sections = {section["section"]: section["data"] for section in database.fetch_rows(*[None]*3)}
    
    results = [{
        "id": (execution["previous"] or "0"*32) + execution["code"],
        "content_hash": execution["code"],
        "output_hash": execution["output"],
        "content": sections[execution["code"]],
        "output": sections.get(execution["output"]),
        "type": sections.get(execution["type"]),
    } for execution in filtered_executions]
    
    return jsonify(results)

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, threaded=False, processes=1, debug=False)
