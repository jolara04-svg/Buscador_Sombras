{
  "targets": [
    {
      "target_name": "shaders",
      "sources": ["src/%s"%s for s in[
        "main.cpp",
        "init.c",
        "checkArgs.cpp",
        "cmodule.c",
        "debug.c",
        "shadowCalc.c"
      ]],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "<!(node ../scripts/python-config.cjs include)",
        "<!(node ../scripts/python-config.cjs numpy)",
        "./src/include"
      ],
      "dependencies": ["<!(node -p \"require('node-addon-api').gyp\")"],
      "libraries":["<!(node ../scripts/python-config.cjs library)"]
    }
  ]
}
