import { parse } from "@babel/parser"
import traverse from "@babel/traverse"
import { writeFileSync, readFileSync } from "fs"
import { resolve, relative, dirname } from "path"
import * as babel from "@babel/core"

// 设置根目录
const projectRoot = resolve(__dirname, "project")
// 类型声明
type DepRelationItem = { key: string; deps: string[]; code: string }
type DepRelation = DepRelationItem[]
// 初始化一个空的 depRelation，用于收集依赖
const depRelation: DepRelation = [] // 数组！

// 将入口文件的绝对路径传入函数，如 D:project/index.js
collectCodeAndDeps(resolve(projectRoot, "index.js"))

writeFileSync("dist.js", generateCode())
console.log("done")

function generateCode() {
  let code = ""
  code +=
    "var depRelation = [" +
    depRelation
      .map((item) => {
        const { key, deps, code } = item
        return `{
      key: ${JSON.stringify(key)}, 
      deps: ${JSON.stringify(deps)},
      code: function(require, module, exports){
        ${code}
      }
    }`
      })
      .join(",") +
    "];\n"
  code += "var modules = {};\n"
  code += `execute(depRelation[0].key)\n`
  code += `
  function execute(key) {
    if (modules[key]) { return modules[key] }
    var item = depRelation.find(i => i.key === key)
    if (!item) { throw new Error(\`\${item} is not found\`) }
    var pathToKey = (path) => {
      var dirname = key.substring(0, key.lastIndexOf('/') + 1)
      var projectPath = (dirname + path).replace(\/\\.\\\/\/g, '').replace(\/\\\/\\\/\/, '/')
      return projectPath
    }
    var require = (path) => {
      return execute(pathToKey(path))
    }
    modules[key] = { __esModule: true }
    var module = { exports: modules[key] }
    item.code(require, module, module.exports)
    return modules[key]
  }
  `
  return code
}

function collectCodeAndDeps(filepath: string) {
  const key = getProjectPath(filepath) // 文件的项目路径，如 index.js
  if (depRelation.find((i) => i.key === key)) {
    // 注意，重复依赖不一定是循环依赖
    return
  }
  // 获取文件内容，将内容放至 depRelation
  let code = readFileSync(filepath).toString()
  if (/\.css$/.test(filepath)) {
    code = require("./css-loader.js")(code)
  }
  const result = babel.transform(code, {
    presets: ["@babel/preset-env"],
  })
  // 初始化 depRelation[key]
  const item: DepRelationItem = { key, deps: [], code: result?.code ?? "" }
  depRelation.push(item)
  // 将代码转为 AST
  const ast = parse(code, { sourceType: "module" })
  // 分析文件依赖，将内容放至 depRelation
  traverse(ast, {
    enter: (path) => {
      if (path.node.type === "ImportDeclaration") {
        // path.node.source.value 往往是一个相对路径，如 ./a.js，需要先把它转为一个绝对路径
        const depAbsolutePath = resolve(
          dirname(filepath),
          path.node.source.value
        )
        // 然后转为项目路径
        const depProjectPath = getProjectPath(depAbsolutePath)
        // 把依赖写进 depRelation
        item.deps.push(depProjectPath)
        collectCodeAndDeps(depAbsolutePath)
      }
    },
  })
}
// 获取文件相对于根目录的相对路径
function getProjectPath(path: string) {
  return relative(projectRoot, path).replace(/\\/g, "/")
}
