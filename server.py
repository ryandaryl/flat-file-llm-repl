import code
import sys
import io

class CapturingConsole(code.InteractiveConsole):
    def __init__(self, locals=None):
        super().__init__(locals)
        self.stdout_capture = io.StringIO()
        self.stderr_capture = io.StringIO()

    def runcode(self, code_obj):
        # Temporarily redirect output
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        sys.stdout = self.stdout_capture
        sys.stderr = self.stderr_capture

        try:
            super().runcode(code_obj)
        finally:
            # Restore standard output
            sys.stdout = old_stdout
            sys.stderr = old_stderr

    def get_printed_output(self):
        # Retrieve everything printed to stdout
        output = self.stdout_capture.getvalue()
        return output

# --- How to use it ---
# 1. Initialize your custom console
my_console = CapturingConsole()

# 2. Simulate interactive inputs
# You would typically pass these strings into self.push(line)
my_console.push("print('Hello from the interactive console!')")
my_console.push("x = 5")
my_console.push("print('The value of x is:', x)")

# 3. Fetch everything that was printed
captured_text = my_console.get_printed_output()
print("Captured Output:\n", captured_text)

