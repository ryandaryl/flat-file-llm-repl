import code
import codecs
import sys
import io

class CapturingConsole(code.InteractiveConsole):
    def __init__(self, locals=None):
        super().__init__(locals)
        self.stdout = io.StringIO()
        self.stderr = io.StringIO()

    def runcode(self, code_obj):
        old_stdout, old_stderr = sys.stdout, sys.stderr
        sys.stdout, sys.stderr = self.stdout, self.stderr
        try:
            super().runcode(code_obj)
        finally:
            # Restore standard output
            sys.stdout = old_stdout
            sys.stderr = old_stderr

my_console = CapturingConsole()
my_console.push("""
try:
    from plotly.graph_objs import Figure;
    Figure.show = Figure.to_html
except ImportError:
    pass
""")

my_console.push("from plotly import express as px; import numpy as np; px.line(np.arange(10)).show();")

# print("Captured Output:", my_console.stdout.getvalue().strip(), sep="\n")
open("plot.html", "w").write(codecs.getdecoder("unicode_escape")(my_console.stdout.getvalue())[0])
print("Captured Errors:", my_console.stderr.getvalue().strip(), sep="\n")

