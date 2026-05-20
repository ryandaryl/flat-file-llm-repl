import io
from contextlib import redirect_stdout
import traceback

def execute_and_print(code_to_run, context_global):
    out_buffer = io.StringIO()
    error_string = ""
    try:
        with redirect_stdout(out_buffer):
            exec(compile(code_to_run, "myfile.py", "exec"), context_global)
    except Exception as e:
        error_string = traceback.format_exc()
    print(f"Captured STDOUT: {out_buffer.getvalue()}")
    print(f"Captured STDERR: {error_string}")

code_to_run1 = """
a = 1
print("This is standard output")
raise Exception("This is an error message")
"""
code_to_run2 = "print(a)"

context_global = {}
for code_to_run in [code_to_run1, code_to_run2]:
    execute_and_print(code_to_run, context_global)
