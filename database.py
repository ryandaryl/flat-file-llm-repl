import sqlite3

def init_db(db_path: str):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("PRAGMA page_size = 65536;")
    cursor.execute("PRAGMA cache_size = -200000;") 
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sections (
            section TEXT,
            row INTEGER,
            data BLOB,
            PRIMARY KEY (section, row)
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS executions (
            previous TEXT,
            code TEXT,
            output TEXT,
            PRIMARY KEY (previous, code)
        )
    ''')
    conn.commit()
    return conn

def insert_row(conn, section_name, row, data: bytes):
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR REPLACE INTO sections (section, row, data) VALUES (?, ?, ?)",
        (section_name, row, data)
    )
    conn.commit()

def delete_section(conn, section_name):
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sections WHERE section = ?", (section_name,))
    conn.commit()
    cursor.execute("VACUUM;")

def fetch_rows(conn, section_name, min_row, max_row):
    cursor = conn.cursor()
    cursor.execute(
        """SELECT section, GROUP_CONCAT(data, char(10)) AS data
        FROM sections GROUP BY section
        -- WHERE section = ? AND row >= ? AND row < ?"""
        # , (section_name, min_row, max_row)
    )
    result = [dict(row) for row in cursor.fetchall()]
    return result

def insert_execution(conn, previous, code, output):
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR REPLACE INTO executions (previous, code, output) VALUES (?, ?, ?)",
        (previous, code, output)
    )
    conn.commit()

def delete_execution(conn, previous, code):
    cursor = conn.cursor()
    cursor.execute("DELETE FROM executions WHERE state = ? AND code = ?", (previous, code))
    conn.commit()
    cursor.execute("VACUUM;")

def fetch_executions(conn):
    cursor = conn.cursor()
    cursor.execute(
        """SELECT previous, code, output
        FROM executions"""
    )
    result = [dict(row) for row in cursor.fetchall()]
    return result

class SQLiteStreamWriter:
    def __init__(self, conn, section: str):
        self.conn = conn
        self.cursor = conn.cursor()
        self.buffer = []
        self.section = section
        self.row = 0  # Track the current row index starting at 0

    def write(self, data):
        # Accumulate string fragments
        self.buffer.append(data)
        
        # If a newline occurs, process all completed lines
        if '\n' in data:
            full_text = "".join(self.buffer)
            lines = full_text.split('\n')
            
            # Process all fully completed lines (everything except the last split element)
            for line in lines[:-1]:
                cleaned_text = line.strip()
                if cleaned_text:
                    # Insert both the row index and the text line
                    self.cursor.execute("INSERT OR REPLACE INTO sections VALUES (?, ?, ?)", (self.section, self.row, cleaned_text))
                    self.conn.commit()
                    self.row += 1  # Automatically increment on each newline
            
            # Retain any trailing, incomplete text fragment in the buffer
            self.buffer = [lines[-1]]

    def flush(self):
        # Optional: Flash remaining text if the stream closes without a final newline
        if self.buffer:
            remaining_text = "".join(self.buffer).strip()
            if remaining_text:
                self.cursor.execute("INSERT OR REPLACE INTO sections VALUES (?, ?, ?)", (self.section, self.row, remaining_text))
                self.conn.commit()
                self.row += 1
            self.buffer.clear()

    def close(self):
        """Safely flushes remaining data and closes database resources."""
        self.flush()
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

if __name__ == "__main__":
    # Usage
    db_conn = sqlite3.connect('streamed_stdout.db')
    stream_target = SQLiteStreamWriter(db_conn)

    with redirect_stdout(stream_target):
        print("This line goes straight to SQLite.")
        print("This line does too, bypassing system memory buffers.")

    db_conn.close()
