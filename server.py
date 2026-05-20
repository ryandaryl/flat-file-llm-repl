import code
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
my_console.push("print('Hello from the interactive console!')")
my_console.push("x = 5")
my_console.push("print('The value of x is:', x)")
my_console.push("1 / 0")

print("Captured Output:", my_console.stdout.getvalue().strip(), sep="\n")
print("Captured Errors:", my_console.stderr.getvalue().strip(), sep="\n")

