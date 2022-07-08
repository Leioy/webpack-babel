import * as babel from "@babel/core"
import * as fs from "fs"
const sourceCode = fs.readFileSync("./source.js").toString()
const result = babel.transformSync(sourceCode, {
  presets: ["@babel/preset-env"],
})
fs.writeFileSync("./dist.js", result?.code ?? "")
