import os
import hashlib
import json
import tempfile
from typing import List, Dict

# Configuration constants
DATA_DIR = "project_data"
SECTIONS_DIR = os.path.join(DATA_DIR, "sections")
EXECUTIONS_FILE = os.path.join(DATA_DIR, "executions.jsonl")

def init_db(db_path: str = None):
    """Initialises the file system structure."""
    os.makedirs(SECTIONS_DIR, exist_ok=True)
    # Ensure executions file exists
    if not os.path.exists(EXECUTIONS_FILE):
        with open(EXECUTIONS_FILE, "w", encoding="utf-8") as f:
            pass

def insert_row(section_name: str, row: int, data: bytes):
    """Appends binary or text data directly to a section file."""
    init_db()
    file_path = os.path.join(SECTIONS_DIR, section_name)
    mode = "ab" if isinstance(data, bytes) else "a"
    encoding = None if isinstance(data, bytes) else "utf-8"
    
    with open(file_path, mode, encoding=encoding) as f:
        f.write(data)

def delete_section(section_name: str):
    """Deletes a section file from the filesystem."""
    file_path = os.path.join(SECTIONS_DIR, section_name)
    if os.path.exists(file_path):
        os.remove(file_path)

def fetch_rows(section_name: str, min_row: int = 0, max_row: int = 0) -> List[Dict]:
    """Reads a section file and returns the simulated aggregation."""
    file_names = os.listdir(SECTIONS_DIR)
    sections = []
    for file_name in file_names:
        if section_name and section_name == file_name:
            continue
        with open(os.path.join(SECTIONS_DIR, file_name), "r", encoding="utf-8") as f:
            data_content = f.read()
        sections.append({"section": file_name, "data": data_content})
    return sections

def insert_execution(previous: str, code: str, output: str, type="run"):
    """Appends a single execution row as a line-delimited JSON entry."""
    init_db()
    record = {"previous": previous, "code": code, "output": output, "type": type}
    with open(EXECUTIONS_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")

def delete_execution(previous: str, code: str):
    """Removes a row from the execution ledger by rewriting records."""
    if not os.path.exists(EXECUTIONS_FILE):
        return

    updated_records = []
    with open(EXECUTIONS_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                record = json.loads(line)
                if record.get("previous") == previous and record.get("code") == code:
                    continue
                updated_records.append(line)

    with open(EXECUTIONS_FILE, "w", encoding="utf-8") as f:
        f.writelines(updated_records)

def fetch_executions() -> List[Dict]:
    """Retrieves all executions parsed into memory from JSONL rows."""
    if not os.path.exists(EXECUTIONS_FILE):
        return []

    results = []
    with open(EXECUTIONS_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                results.append(json.loads(line))
    return results


class StreamWriter:
    def __init__(self):
        init_db()
        # Create a secure, unique temporary file in the target directory
        self.file_fd, self.file_path = tempfile.mkstemp(dir=SECTIONS_DIR, suffix=".tmp")

        # Open the file descriptor in unbuffered text mode
        self.file = open(self.file_fd, "a", buffering=1, encoding="utf-8")
        # Initialize the MD5 hasher
        self._hasher = hashlib.md5()
        # Public property to expose the hash to the caller after closing
        self.hash = None

    def write(self, data: str):
        """Streams string fragments straight to the filesystem and updates the hash."""
        if data:
            self.file.write(data)
            # MD5 requires bytes, so encode the string data
            self._hasher.update(data.encode("utf-8"))

    def close(self):
        """Safely closes file resources and renames the file to its MD5 hash."""
        if self.file and not self.file.closed:
            self.file.flush()
            self.file.close()

            # Finalise the hash calculation
            self.hash = self._hasher.hexdigest()

            # Rename the temporary file to its MD5 hash name
            if os.path.exists(self.file_path):
                new_path = os.path.join(SECTIONS_DIR, self.hash)

                # Check if a file with this hash already exists to avoid overwriting
                if not os.path.exists(new_path):
                    os.rename(self.file_path, new_path)
                    self.file_path = new_path
                else:
                    # Clean up the temp file if the content already exists
                    os.remove(self.file_path)
                    self.file_path = new_path

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
