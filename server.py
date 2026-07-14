import json
import os
import traceback
from flask import Flask, jsonify, request

import database
from execute import execute_code_and_write_files

app = Flask(__name__)

context = {}

@app.route("/api/task/run/", methods=["POST"])
def start_task():
    """
    Starts the task in a strict, single-threaded manner. 
    The HTTP response waits until the task finishes processing.
    """
    data = request.json
    # Strictly synchronous execution on the main thread without background tasks
    try:
        execute_code_and_write_files(code=data["content"], con=context, max_bytes=data["memoryLimit"] * 1024**3)
    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"status": "run_error", "error": str(e)}), 500
    return jsonify({"status": "success"})

@app.route("/api/execution/hide/", methods=["POST"])
def hide_execution():
    query = request.json
    database.init_db("project")
    database.insert_execution(previous=None, code=query["code_hash"], output=query["output_hash"], type="hide")
    return jsonify({"status": "success"})

@app.route("/api/execution/list/", methods=["POST"])
def list_executions(as_response=True):
    """
    {
        "content": {"default": True}, Whether to read cell content
        "output": {"default": {"start": null, "end": null}}, Which output lines to read for cells
    }
    """
    query = request.json
    database.init_db("project.db")
    
    executions = database.fetch_executions()
    executions_with_type = {(execution["code"], execution["output"], execution["type"]): i for i, execution in enumerate(executions)}
    
    filtered_executions = [
        execution for i, execution in enumerate(executions)
        if executions_with_type.get((execution["code"], execution["output"], "hide"), -1) < i
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
    
    return jsonify(results) if as_response else results

@app.route("/api/uistate/new/", methods=["POST"])
def save_ui_state():
    with open("uistate.json", "w") as f:
        json.dump({
            "base": [execution["content"] for execution in list_executions(as_response=False)],
            "incoming": request.json,
        }, f)
    return jsonify({"status": "success"})

@app.route("/api/uistate/<ui_state_index>", methods=["GET"])
def load_ui_state(ui_state_index):
    with open("uistate.json", "r") as f:
        return f.read(), 200, {"Content-Type": "application/json"}


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, threaded=False, processes=1, debug=False)
