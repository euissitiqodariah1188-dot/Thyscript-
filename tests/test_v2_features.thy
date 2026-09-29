// ThyScript v2.0 Feature Verification Test
import "chalk"

print(chalk.green("✔ Successfully loaded npm library via import 'chalk'!"))

// External HTML class
classHtml(Home) from "public/home.html"

// Start server on port 4321 without any create()
server(4321):
    print("🚀 ThyScript v2 Server initialized on port 4321")
end()

route get "/":
    res.renderHtml("public/home.html", { title: "ThyScript v2 External HTML", user: "Dede Engineer" })
end()

route get "/api/v2/status":
    res.json({ version: "2.0.0", status: "active", engine: "ThyScript JIT v2" })
end()

print("Server is listening on port 4321!")
