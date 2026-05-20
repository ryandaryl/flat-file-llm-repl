import code

# Create an interactive console
console = code.InteractiveConsole()

while True:
    code_input = input(">>> ")
    if code_input.lower() == "exit":
        break
    console.push(code_input)
