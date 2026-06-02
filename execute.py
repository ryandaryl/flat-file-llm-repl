from ast import iter_child_nodes, parse, Expr, Module, Expression
import datetime
from contextlib import redirect_stdout
import hashlib
import io
import os
import tempfile
import traceback
import database

extra = """
try:
    from plotly.graph_objs import Figure;
    Figure.show = Figure.to_html
except ImportError:
    pass
"""

def create_cell(content: str):
    section_hash = hashlib.md5(content.encode()).hexdigest()
    conn = database.init_db("project.db")
    with database.SQLiteStreamWriter(conn=conn, section=section_hash) as f:
        f.write(content)
    return section_hash

def execute_and_collect(code: str, con: dict):
    conn = database.init_db("project.db")
    section_hash = hashlib.md5(str(datetime.datetime.now()).encode("utf-8")).hexdigest()
    f = database.SQLiteStreamWriter(conn=conn, section=section_hash)
    error_string = ""
    ftemp = tempfile.NamedTemporaryFile(mode='w+t', delete=False)
    ftemp.write(code)
    args = {"filename": ftemp.name, "mode": "eval"}
    try:
        with redirect_stdout(f):
            nodes, last = list(iter_child_nodes(parse(extra + code))), ""
            if isinstance(nodes[-1], Expr):
                nodes, last = nodes[:-1], nodes[-1]
            exec(compile(Module(body=nodes), **{**args, "mode": "exec"}), con)
            if last:
                result = eval(compile(Expression(body=last.value), **args), con)
                if result is not None:
                    print(result)
    except Exception as e:
        f.write(traceback.format_exc())
    finally:
        f.flush()
        f.close()
        ftemp.close()
        return section_hash

def execute_code_and_write_files(code: str, con: dict):
    previous_code_hash = con.get("_previous_code_hash")
    code_hash = create_cell(content=code)
    output_hash = execute_and_collect(code, con=con)
    con["_previous_code_hash"] = code_hash
    conn = database.init_db("project.db")
    database.insert_execution(conn, previous=previous_code_hash, code=code_hash, output=output_hash)

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

