{
  "targets": [
    {
      "target_name": "shaders",
      "sources": ["src/%s"%s for s in[
        "main.cpp",
        "init.c",
        "checkArgs.cpp",
        "cmodule.c",
        "debug.c"
      ]],
      "include_dirs": ["<!@(node -p \"require('node-addon-api').include\")","./src/include"],
      "dependencies": ["<!(node -p \"require('node-addon-api').gyp\")"],
      "libraries":["../python313.lib"]
    }
  ]
}