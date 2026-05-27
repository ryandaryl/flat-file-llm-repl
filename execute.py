from ast import iter_child_nodes, parse, Expr, Module, Expression
from contextlib import redirect_stdout
import hashlib
import io
import os
import tempfile
import traceback

extra = """
try:
    from plotly.graph_objs import Figure;
    Figure.show = Figure.to_html
except ImportError:
    pass
"""

def create_cell(content: str):
    file_hash = hashlib.md5(content.encode()).hexdigest()
    with open("project/" + file_hash, "w") as f:
        f.write(content)
    return file_hash

def execute_and_collect(file_name: str, con: dict):
    with open("project/" + file_name) as f:
        code_to_run = f.read()
    f = tempfile.NamedTemporaryFile(mode='w+t', delete=False)
    error_string = ""
    args = {"filename": file_name, "mode": "eval"}
    try:
        with redirect_stdout(f):
            nodes, last = list(iter_child_nodes(parse(extra + code_to_run))), ""
            if isinstance(nodes[-1], Expr):
                nodes, last = nodes[:-1], nodes[-1]
            exec(compile(Module(body=nodes), **{**args, "mode": "exec"}), con)
            if last:
                result = eval(compile(Expression(body=last.value), **args), con)
                if result is not None:
                    print(output)
    except Exception as e:
        f.write(traceback.format_exc())
    finally:
        f.flush()
        f.buffer.seek(0)
        file_hash = hashlib.file_digest(f.buffer, "md5").hexdigest()
        f.close()
        os.rename(f.name, "project/" + file_hash)
        return file_hash

def execute_code_and_write_files(code: str, con: dict):
    file_hash = create_cell(content=code)
    execute_and_collect(file_name=file_hash, con=con)

if __name__ == "__main__":
    code_to_run1 = """
    a = 1
    print("This is standard output")
    # raise Exception("This is an error message")
    1 / 0
    """
    code_to_run2 = """
    import numpy as np
    from plotly import express as px
    px.line(np.arange(10)).show()
    """

    context_global = {}
    for code_to_run in [code_to_run1, code_to_run2]:
        code_hash = create_cell(code_to_run)
        output_hash = execute_and_collect(code_hash, context_global)

