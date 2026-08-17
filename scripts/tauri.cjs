const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
    ...options,
    env: {
      ...process.env,
      ...options.env,
    },
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const error = new Error(`${command} exited with status ${result.status ?? 'unknown'}`);
    error.exitCode = typeof result.status === 'number' ? result.status : 1;
    throw error;
  }
}

function capture(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    ...options,
    env: options.env || process.env,
  });
}

function uniquePaths(values) {
  const seen = new Set();
  return values.filter((value) => {
    if (!value) {
      return false;
    }
    const key = path.resolve(value).toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function executablesOnPath(executableName) {
  const result = capture('where.exe', [executableName]);
  if (result.error || result.status !== 0) {
    return [];
  }
  return result.stdout
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .filter(Boolean);
}

function resolveExecutable(executable) {
  if (path.isAbsolute(executable)) {
    return path.resolve(executable);
  }
  const [resolved] = executablesOnPath(executable);
  return resolved ? path.resolve(resolved) : executable;
}

function inspectGo(executable) {
  if (path.isAbsolute(executable) && !fs.existsSync(executable)) {
    return null;
  }

  const cleanEnv = { ...process.env };
  delete cleanEnv.GOROOT;
  const envResult = capture(executable, ['env', 'GOROOT', 'GOTOOLDIR'], { env: cleanEnv });
  if (envResult.error || envResult.status !== 0) {
    return null;
  }

  const [gorootValue, toolDirValue] = envResult.stdout
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .filter(Boolean);
  if (!gorootValue || !toolDirValue) {
    return null;
  }

  const compilerName = process.platform === 'win32' ? 'compile.exe' : 'compile';
  if (
    !fs.existsSync(path.join(gorootValue, 'src', 'runtime')) ||
    !fs.existsSync(path.join(toolDirValue, compilerName))
  ) {
    return null;
  }

  const versionResult = capture(executable, ['version'], {
    env: { ...cleanEnv, GOROOT: gorootValue },
  });
  if (versionResult.error || versionResult.status !== 0) {
    return null;
  }

  return {
    executable: resolveExecutable(executable),
    goroot: path.resolve(gorootValue),
    version: versionResult.stdout.trim(),
  };
}

function findGo() {
  if (process.env.COCKPIT_GO) {
    const explicit = inspectGo(process.env.COCKPIT_GO);
    if (!explicit) {
      throw new Error(
        `COCKPIT_GO does not point to a complete Go SDK: ${process.env.COCKPIT_GO}`,
      );
    }
    return explicit;
  }

  const candidates = uniquePaths([
    process.env.LOCALAPPDATA &&
      path.join(process.env.LOCALAPPDATA, 'Programs', 'GoSDK', 'go', 'bin', 'go.exe'),
    process.env.USERPROFILE &&
      path.join(
        process.env.USERPROFILE,
        'AppData',
        'Local',
        'Programs',
        'GoSDK',
        'go',
        'bin',
        'go.exe',
      ),
    process.env.GOROOT && path.join(process.env.GOROOT, 'bin', 'go.exe'),
    process.env.ProgramW6432 && path.join(process.env.ProgramW6432, 'Go', 'bin', 'go.exe'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Go', 'bin', 'go.exe'),
    ...executablesOnPath('go.exe'),
    process.env.LOCALAPPDATA &&
      path.join(process.env.LOCALAPPDATA, 'Programs', 'Go', 'bin', 'go.exe'),
  ]);

  for (const candidate of candidates) {
    const go = inspectGo(candidate);
    if (go) {
      return go;
    }
  }

  throw new Error(
    'A complete Go SDK was not found. Install Go or set COCKPIT_GO to its go.exe; a bin-only Go directory is not sufficient.',
  );
}

function inspectRust(cargoExecutable) {
  if (path.isAbsolute(cargoExecutable) && !fs.existsSync(cargoExecutable)) {
    return null;
  }

  const cargoDir = path.dirname(path.resolve(cargoExecutable));
  const env = {
    ...process.env,
    PATH: `${cargoDir}${path.delimiter}${process.env.PATH || ''}`,
  };
  const cargoResult = capture(cargoExecutable, ['--version'], { env });
  if (cargoResult.error || cargoResult.status !== 0) {
    return null;
  }

  const rustcCandidates = uniquePaths([
    path.join(cargoDir, 'rustc.exe'),
    ...executablesOnPath('rustc.exe'),
  ]);
  for (const rustcExecutable of rustcCandidates) {
    const rustcResult = capture(rustcExecutable, ['-vV'], { env });
    if (rustcResult.error || rustcResult.status !== 0) {
      continue;
    }
    const host = rustcResult.stdout.match(/^host:\s*(.+)$/mu)?.[1]?.trim();
    if (!host || !host.endsWith('-pc-windows-msvc')) {
      continue;
    }
    return {
      cargoExecutable: resolveExecutable(cargoExecutable),
      rustcExecutable: resolveExecutable(rustcExecutable),
      cargoVersion: cargoResult.stdout.trim(),
      rustcHost: host,
    };
  }

  return null;
}

function findRust() {
  if (process.env.COCKPIT_CARGO) {
    const explicit = inspectRust(process.env.COCKPIT_CARGO);
    if (!explicit) {
      throw new Error(
        `COCKPIT_CARGO is not a usable Rust MSVC toolchain: ${process.env.COCKPIT_CARGO}`,
      );
    }
    return explicit;
  }

  const candidates = uniquePaths([
    process.env.CARGO_HOME && path.join(process.env.CARGO_HOME, 'bin', 'cargo.exe'),
    process.env.USERPROFILE && path.join(process.env.USERPROFILE, '.cargo', 'bin', 'cargo.exe'),
    ...executablesOnPath('cargo.exe'),
  ]);

  for (const candidate of candidates) {
    const rust = inspectRust(candidate);
    if (rust) {
      return rust;
    }
  }

  throw new Error(
    'A Rust MSVC toolchain was not found. Install rustup with the stable-x86_64-pc-windows-msvc toolchain or set COCKPIT_CARGO.',
  );
}

function inspectVcvars64(vcvars64Path) {
  if (!vcvars64Path || !fs.existsSync(vcvars64Path)) {
    return false;
  }
  const command = [
    `call "${vcvars64Path}" >nul 2>&1`,
    'where cl.exe >nul 2>&1',
    'where link.exe >nul 2>&1',
    'where rc.exe >nul 2>&1',
  ].join(' && ');
  const result = capture('cmd.exe', ['/d', '/s', '/c', command], {
    windowsVerbatimArguments: true,
  });
  return !result.error && result.status === 0;
}

function visualStudioInstallations() {
  const vswhereCandidates = uniquePaths([
    process.env['ProgramFiles(x86)'] &&
      path.join(
        process.env['ProgramFiles(x86)'],
        'Microsoft Visual Studio',
        'Installer',
        'vswhere.exe',
      ),
    process.env.ProgramFiles &&
      path.join(
        process.env.ProgramFiles,
        'Microsoft Visual Studio',
        'Installer',
        'vswhere.exe',
      ),
    ...executablesOnPath('vswhere.exe'),
  ]);

  for (const vswhere of vswhereCandidates) {
    if (!fs.existsSync(vswhere)) {
      continue;
    }
    const result = capture(vswhere, [
      '-products',
      '*',
      '-version',
      '[17.0,18.0)',
      '-requires',
      'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
      '-property',
      'installationPath',
    ]);
    if (!result.error && result.status === 0) {
      return result.stdout
        .split(/\r?\n/u)
        .map((value) => value.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function findVcvars64() {
  const commonRoots = [];
  for (const programFiles of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']]) {
    if (!programFiles) {
      continue;
    }
    for (const edition of ['BuildTools', 'Community', 'Professional', 'Enterprise']) {
      commonRoots.push(path.join(programFiles, 'Microsoft Visual Studio', '2022', edition));
    }
  }

  const candidates = uniquePaths([
    process.env.COCKPIT_VCVARS64,
    process.env.VSINSTALLDIR &&
      path.join(process.env.VSINSTALLDIR, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat'),
    process.env.VCINSTALLDIR &&
      path.join(process.env.VCINSTALLDIR, 'Auxiliary', 'Build', 'vcvars64.bat'),
    ...visualStudioInstallations().map((root) =>
      path.join(root, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat'),
    ),
    ...commonRoots.map((root) =>
      path.join(root, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat'),
    ),
  ]);

  if (process.env.COCKPIT_VCVARS64) {
    if (!inspectVcvars64(process.env.COCKPIT_VCVARS64)) {
      throw new Error(
        `COCKPIT_VCVARS64 is not a usable VS2022 x64 environment: ${process.env.COCKPIT_VCVARS64}`,
      );
    }
    return path.resolve(process.env.COCKPIT_VCVARS64);
  }

  for (const candidate of candidates) {
    if (inspectVcvars64(candidate)) {
      return path.resolve(candidate);
    }
  }

  throw new Error(
    'Visual Studio 2022 C++ Build Tools and a Windows SDK were not found. Install the Desktop development with C++ workload or set COCKPIT_VCVARS64.',
  );
}

function quoteBatchArg(value) {
  if (/[\s"]/u.test(value)) {
    return `"${value.replace(/"/gu, '""')}"`;
  }
  return value;
}

function runWindowsTauri() {
  const go = findGo();
  const rust = findRust();
  const vcvars64Path = findVcvars64();
  const tauriCliPath = path.join(repoRoot, 'node_modules', '.bin', 'tauri.cmd');
  const tauriArgs = process.argv.slice(2).map(quoteBatchArg).join(' ');
  const cargoBinPath = path.dirname(rust.cargoExecutable);
  const goBinPath = path.dirname(go.executable);
  const tauriCommand = fs.existsSync(tauriCliPath)
    ? `call "${tauriCliPath}" ${tauriArgs}`.trim()
    : `call npx.cmd tauri ${tauriArgs}`.trim();

  console.log(`[build-env] Go: ${go.executable} (${go.version})`);
  console.log(`[build-env] Rust: ${rust.cargoExecutable} (${rust.rustcHost})`);
  console.log(`[build-env] MSVC: ${vcvars64Path}`);

  const tempScriptPath = path.join(os.tmpdir(), `cockpit-tools-tauri-${process.pid}.cmd`);
  const scriptBody = [
    '@echo off',
    'setlocal DisableDelayedExpansion',
    `call "${vcvars64Path}" >nul`,
    'if errorlevel 1 exit /b %errorlevel%',
    `set "PATH=${goBinPath};${cargoBinPath};%PATH%"`,
    `set "GOROOT=${go.goroot}"`,
    `set "COCKPIT_GO=${go.executable}"`,
    `set "COCKPIT_CARGO=${rust.cargoExecutable}"`,
    'call npm.cmd run sync-version',
    'if errorlevel 1 exit /b %errorlevel%',
    tauriCommand,
  ].join('\r\n');

  fs.writeFileSync(tempScriptPath, scriptBody);
  try {
    run('cmd.exe', ['/d', '/s', '/c', `call "${tempScriptPath}"`], {
      windowsVerbatimArguments: true,
    });
  } finally {
    fs.rmSync(tempScriptPath, { force: true });
  }
}

function main() {
  if (process.platform === 'win32') {
    runWindowsTauri();
    return;
  }
  run('npm', ['run', 'sync-version']);
  run('npx', ['tauri', ...process.argv.slice(2)]);
}

try {
  main();
} catch (error) {
  console.error(`[tauri] ${error.message || error}`);
  process.exitCode = error.exitCode || 1;
}
