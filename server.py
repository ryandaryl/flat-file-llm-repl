from ast import iter_child_nodes, parse, Expr, Module, Expression
from contextlib import redirect_stdout
import hashlib
import io
import os
import tempfile
import traceback

def execute_and_collect(code_to_run, con):
    f = tempfile.NamedTemporaryFile(mode='w+t', delete=False)
    error_string = ""
    args = {"filename": "myfile.py", "mode": "eval"}
    try:
        with redirect_stdout(f):
            nodes, last = list(iter_child_nodes(parse(code_to_run))), ""
            if isinstance(nodes[-1], Expr):
                nodes, last = nodes[:-1], nodes[-1]
            exec(compile(Module(body=nodes), **{**args, "mode": "exec"}), con)
            print(eval(compile(Expression(body=last.value), **args), con))
    except Exception as e:
        f.write(traceback.format_exc())
    finally:
        f.seek(0)
        print(f.read())
        with open(f.name, "rb") as f2:
            os.rename(f.name, hashlib.file_digest(f2, "md5").hexdigest())
        f.close()


code_to_run1 = """
a = 1
print("This is standard output")
# raise Exception("This is an error message")
1 / 0
"""
code_to_run2 = "a"

context_global = {}
for code_to_run in [code_to_run1, code_to_run2]:
    execute_and_collect(code_to_run, context_global)

