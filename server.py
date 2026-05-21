from ast import iter_child_nodes, parse, Expr, Module, Expression
import io
from contextlib import redirect_stdout
import traceback

def execute_and_collect(code_to_run, con):
    out_buffer = io.StringIO()
    error_string = ""
    args = {"filename": "myfile.py", "mode": "eval"}
    try:
        with redirect_stdout(out_buffer):
            nodes, last = list(iter_child_nodes(parse(code_to_run))), ""
            if isinstance(nodes[-1], Expr):
                nodes, last = nodes[:-1], nodes[-1]
            exec(compile(Module(body=nodes), **{**args, "mode": "exec"}), con)
            print(eval(compile(Expression(body=last.value), **args), con))
    except Exception as e:
        error_string = traceback.format_exc()
    return out_buffer.getvalue(), error_string


code_to_run1 = """
a = 1
print("This is standard output")
# raise Exception("This is an error message")
1 / 0
"""
code_to_run2 = "a"

context_global = {}
for code_to_run in [code_to_run1, code_to_run2]:
    out_string, error_string = execute_and_collect(code_to_run, context_global)
    print(f"Captured STDOUT: {out_string}")
    print(f"Captured STDERR: {error_string}")
