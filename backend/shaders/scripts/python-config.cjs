'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

function fail(message) {
  console.error(`[python-config] ${message}`)
  process.exit(1)
}

function existingFile(filePath, description) {
  const resolved = path.resolve(filePath)
  if (!fs.existsSync(resolved)) {
    fail(`${description} no existe: ${resolved}`)
  }
  return resolved
}

function runPython(code) {
  const configured = process.env.npm_config_python || process.env.PYTHON
  const candidates = configured
    ? [{ command: configured, args: [] }]
    : process.platform === 'win32'
      ? [
          { command: 'python', args: [] },
          { command: 'py', args: ['-3'] },
        ]
      : [
          { command: 'python3', args: [] },
          { command: 'python', args: [] },
        ]

  const errors = []
  for (const candidate of candidates) {
    const result = spawnSync(
      candidate.command,
      [...candidate.args, '-c', code],
      { encoding: 'utf8' },
    )

    if (result.status === 0 && result.stdout.trim()) {
      return result.stdout.trim()
    }

    const detail = result.error?.message || result.stderr?.trim() || `exit code ${result.status}`
    errors.push(`${candidate.command}: ${detail}`)
  }

  fail([
    'No se pudo ejecutar Python para descubrir las rutas del addon.',
    'Instala Python y asegúrate de que coincide con npm_config_python/PYTHON.',
    ...errors,
  ].join('\n'))
}

function localIncludeDirectory(relativeFile) {
  const directory = path.resolve(process.cwd(), 'src', 'include')
  return fs.existsSync(path.join(directory, relativeFile)) ? directory : null
}

function getPythonIncludeDirectory() {
  if (process.env.PYTHON_INCLUDE_DIR) {
    return existingFile(
      path.join(process.env.PYTHON_INCLUDE_DIR, 'Python.h'),
      'Python.h indicado por PYTHON_INCLUDE_DIR',
    ).replace(/[\\/]Python\.h$/, '')
  }

  const localDirectory = localIncludeDirectory('Python.h')
  if (localDirectory) {
    return localDirectory
  }

  return existingFile(
    runPython("import sysconfig; print(sysconfig.get_path('include'))") + path.sep + 'Python.h',
    'Python.h detectado por sysconfig',
  ).replace(/[\\/]Python\.h$/, '')
}

function getNumpyIncludeDirectory() {
  if (process.env.NUMPY_INCLUDE_DIR) {
    return existingFile(
      path.join(process.env.NUMPY_INCLUDE_DIR, 'numpy', 'arrayobject.h'),
      'arrayobject.h indicado por NUMPY_INCLUDE_DIR',
    ).replace(/[\\/]numpy[\\/]arrayobject\.h$/, '')
  }

  const localDirectory = localIncludeDirectory(path.join('numpy', 'arrayobject.h'))
  if (localDirectory) {
    return localDirectory
  }

  return existingFile(
    runPython("import numpy; print(numpy.get_include())") + path.sep + 'numpy' + path.sep + 'arrayobject.h',
    'arrayobject.h detectado mediante NumPy',
  ).replace(/[\\/]numpy[\\/]arrayobject\.h$/, '')
}

function getPythonLibrary() {
  if (process.env.PYTHON_LIBRARY) {
    return existingFile(process.env.PYTHON_LIBRARY, 'La librería indicada por PYTHON_LIBRARY')
  }

  const output = runPython(`
import os
import pathlib
import sys
import sysconfig

roots = []
for value in (sys.prefix, sys.base_prefix):
    if value and value not in roots:
        roots.append(value)

if os.name == 'nt':
    names = [f'python{sys.version_info[0]}{sys.version_info[1]}.lib', 'python3.lib']
    for root in roots:
        for name in names:
            candidate = pathlib.Path(root) / 'libs' / name
            if candidate.is_file():
                print(candidate)
                raise SystemExit(0)
        for candidate in sorted((pathlib.Path(root) / 'libs').glob('python*.lib')):
            if candidate.is_file():
                print(candidate)
                raise SystemExit(0)
else:
    libdir = sysconfig.get_config_var('LIBDIR')
    ld_library = sysconfig.get_config_var('LDLIBRARY')
    if libdir and ld_library:
        candidate = pathlib.Path(libdir) / ld_library
        if candidate.is_file():
            print(candidate)
            raise SystemExit(0)
    version = f'{sys.version_info[0]}.{sys.version_info[1]}'
    print(f'-lpython{version}')
    raise SystemExit(0)

raise SystemExit('No se encontró la librería de Python')
`)

  if (output.startsWith('-l')) {
    return output
  }
  return existingFile(output, 'La librería de Python detectada')
}

const command = process.argv[2]
switch (command) {
  case 'include':
    process.stdout.write(getPythonIncludeDirectory())
    break
  case 'numpy':
    process.stdout.write(getNumpyIncludeDirectory())
    break
  case 'library':
    process.stdout.write(getPythonLibrary())
    break
  default:
    fail('Uso: node scripts/python-config.cjs include|numpy|library')
}
