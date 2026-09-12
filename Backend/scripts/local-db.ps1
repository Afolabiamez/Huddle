[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('setup', 'start', 'stop', 'status')]
    [string]$Action = 'status',
    [string]$PostgresBin = $env:HUDDLE_POSTGRES_BIN
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$backendDirectory = Split-Path -Parent $PSScriptRoot
$localDirectory = Join-Path $backendDirectory '.local/postgres'
$dataDirectory = Join-Path $localDirectory 'data'
$settingsPath = Join-Path $localDirectory 'settings.json'
$utf8 = New-Object System.Text.UTF8Encoding($false)

function New-Secret {
    $bytes = New-Object byte[] 32
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
}

function Write-NewFile([string]$Path, [string]$Content) {
    # CreateNew preserves any configuration that the developer already owns.
    $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::CreateNew)
    try {
        $bytes = $utf8.GetBytes($Content)
        $stream.Write($bytes, 0, $bytes.Length)
    } finally { $stream.Dispose() }
}

function Protect-LocalDirectory {
    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    # icacls changes the DACL without the administrative audit privilege that
    # Set-Acl can require in a standard Windows PowerShell session.
    $userRule = '*' + $identity.User.Value + ':(OI)(CI)F'
    $result = & icacls.exe $localDirectory /inheritance:r /grant:r $userRule '*S-1-5-18:(OI)(CI)F' 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not restrict access to local database credentials.'
    }
}

function Quote-NativeArgument([string]$Value) {
    # Script-controlled arguments contain no literal quotes or trailing slashes.
    if ($Value.Contains('"')) { throw 'Unexpected quote in PostgreSQL argument.' }
    return '"' + $Value + '"'
}

function Invoke-Postgres([string]$Program, [string[]]$Arguments, [switch]$AllowFailure) {
    $stdoutPath = Join-Path $localDirectory ($Program + '-stdout.log')
    $stderrPath = Join-Path $localDirectory ($Program + '-stderr.log')
    $argumentLine = ($Arguments | ForEach-Object { Quote-NativeArgument $_ }) -join ' '
    $process = Start-Process -FilePath (Join-Path $PostgresBin ($Program + '.exe')) `
        -ArgumentList $argumentLine -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
    # Start-Process -Wait also waits for postgres descendants, so it never returns
    # while a successfully started server is running. Wait only for pg_ctl itself.
    # Cache the native handle before waiting so Windows PowerShell preserves ExitCode.
    $processHandle = $process.Handle
    $process.WaitForExit()
    $exitCode = $process.ExitCode
    $process.Dispose()
    if ($exitCode -ne 0 -and -not $AllowFailure) {
        throw "$Program failed (exit $exitCode). Check its logs in Backend/.local/postgres."
    }
    return $exitCode
}

function Invoke-AdminSql([string]$Sql) {
    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = Join-Path $PostgresBin 'psql.exe'
    $info.Arguments = (@('-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1',
        '-p', [string]$settings.port, '-U', 'huddle_admin', '-d', 'postgres') |
        ForEach-Object { Quote-NativeArgument $_ }) -join ' '
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardInput = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.EnvironmentVariables['PGPASSWORD'] = $settings.adminPassword
    $info.EnvironmentVariables['PGCONNECT_TIMEOUT'] = '5'
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $info
    try {
        [void]$process.Start()
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        # Passwords are sent through stdin; they never appear in command arguments.
        $process.StandardInput.WriteLine($Sql)
        $process.StandardInput.Close()
        $process.WaitForExit()
        $result = $stdout.GetAwaiter().GetResult()
        [void]$stderr.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0) {
            # Avoid echoing SQL errors, which can contain a CREATE ROLE password.
            throw 'Local database configuration failed. Existing data and settings were preserved.'
        }
        return $result.Trim()
    } finally { $process.Dispose() }
}

function Test-Running {
    return (Invoke-Postgres 'pg_ctl' @('-D', $dataDirectory, 'status') -AllowFailure) -eq 0
}

function Start-LocalDatabase {
    if (Test-Running) { return }
    [void](Invoke-Postgres 'pg_ctl' @('-D', $dataDirectory, '-l',
        (Join-Path $localDirectory 'server.log'), '-w', '-t', '30', 'start'))
}

try {
    if (-not $PostgresBin) {
        $installedBin = Join-Path $env:ProgramFiles 'PostgreSQL/18/bin'
        if (Test-Path -LiteralPath (Join-Path $installedBin 'pg_ctl.exe')) {
            $PostgresBin = $installedBin
        } else {
            $command = Get-Command pg_ctl.exe -ErrorAction SilentlyContinue
            if ($command) { $PostgresBin = Split-Path -Parent $command.Source }
        }
    }
    if (-not $PostgresBin) {
        throw 'Install PostgreSQL, or set HUDDLE_POSTGRES_BIN to its bin directory.'
    }
    foreach ($program in @('initdb.exe', 'pg_ctl.exe', 'psql.exe')) {
        if (-not (Test-Path -LiteralPath (Join-Path $PostgresBin $program))) {
            throw "PostgreSQL tool $program is missing from the configured bin directory."
        }
    }

    if (-not (Test-Path -LiteralPath $settingsPath)) {
        if ($Action -ne 'setup') {
            if ($Action -eq 'status') { Write-Output 'Local PostgreSQL has not been configured.'; exit 0 }
            throw 'Run npm run db:local:setup first.'
        }
        if (Test-Path -LiteralPath $dataDirectory) {
            throw 'An unrecognized local data directory exists. It was left unchanged.'
        }
        [void](New-Item -ItemType Directory -Path $localDirectory -Force)
        Protect-LocalDirectory
        $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, 0)
        try {
            $listener.Start()
            $port = $listener.LocalEndpoint.Port
        } finally { $listener.Stop() }
        $newSettings = @{
            format = 'huddle-local-postgres-v1'
            port = $port
            adminPassword = New-Secret
            devPassword = New-Secret
            testPassword = New-Secret
            jwtSecret = New-Secret
            testJwtSecret = New-Secret
        }
        Write-NewFile $settingsPath ($newSettings | ConvertTo-Json)
    }

    $settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
    if ($settings.format -ne 'huddle-local-postgres-v1' -or
        $settings.port -lt 1024 -or $settings.port -gt 65535) {
        throw 'Unrecognized local PostgreSQL settings. Existing files were left unchanged.'
    }
    foreach ($key in @('adminPassword', 'devPassword', 'testPassword', 'jwtSecret', 'testJwtSecret')) {
        if ($settings.$key -notmatch '^[a-f0-9]{64}$') {
            throw 'Invalid local PostgreSQL settings. Existing files were left unchanged.'
        }
    }

    if ($Action -eq 'setup') {
        Protect-LocalDirectory
        if (-not (Test-Path -LiteralPath (Join-Path $dataDirectory 'PG_VERSION'))) {
            if (Test-Path -LiteralPath $dataDirectory) {
                throw 'An incomplete data directory exists. It was preserved for inspection.'
            }
            $passwordPath = Join-Path $localDirectory 'init-password'
            if (Test-Path -LiteralPath $passwordPath) {
                throw 'An interrupted initialization password file exists. Inspect the local setup before retrying.'
            }
            try {
                Write-NewFile $passwordPath ($settings.adminPassword + "`n")
                [void](Invoke-Postgres 'initdb' @('-D', $dataDirectory, '-U', 'huddle_admin',
                    '--encoding=UTF8', '--locale=C', '--auth-local=scram-sha-256',
                    '--auth-host=scram-sha-256', "--pwfile=$passwordPath"))
            } finally {
                if (Test-Path -LiteralPath $passwordPath) {
                    Remove-Item -LiteralPath $passwordPath
                }
            }
        }
        $configuredPath = Join-Path $localDirectory 'configured'
        if (-not (Test-Path -LiteralPath $configuredPath)) {
            if (Test-Running) {
                throw 'The local cluster started before setup completed. Stop it before rerunning setup.'
            }
            $configuration = @"

# Huddle local development: this cluster only listens on the loopback interface.
listen_addresses = '127.0.0.1'
port = $($settings.port)
password_encryption = 'scram-sha-256'
"@
            [System.IO.File]::AppendAllText((Join-Path $dataDirectory 'postgresql.conf'), $configuration, $utf8)
            $authentication = @"
# Dedicated local cluster. Application roles can access only their own database.
host all huddle_admin 127.0.0.1/32 scram-sha-256
host huddle_dev huddle_dev 127.0.0.1/32 scram-sha-256
host huddle_test huddle_test 127.0.0.1/32 scram-sha-256
"@
            [System.IO.File]::WriteAllText((Join-Path $dataDirectory 'pg_hba.conf'), $authentication, $utf8)
            Write-NewFile $configuredPath 'huddle-local-postgres-v1'
        }
        Start-LocalDatabase
        foreach ($kind in @('dev', 'test')) {
            $name = 'huddle_' + $kind
            $password = $settings.($kind + 'Password')
            if ((Invoke-AdminSql "SELECT 1 FROM pg_roles WHERE rolname = '$name';") -ne '1') {
                [void](Invoke-AdminSql "CREATE ROLE $name LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '$password';")
            }
            if ((Invoke-AdminSql "SELECT 1 FROM pg_database WHERE datname = '$name';") -ne '1') {
                [void](Invoke-AdminSql "CREATE DATABASE $name OWNER $name;")
            }
        }
        $devEnv = Join-Path $backendDirectory '.env.local'
        $testEnv = Join-Path $backendDirectory '.env.test.local'
        if (-not (Test-Path -LiteralPath $devEnv)) {
            Write-NewFile $devEnv (@(
                '# Generated by db:local:setup; keep this file private and untracked.'
                "DATABASE_URL=postgresql://huddle_dev:$($settings.devPassword)@127.0.0.1:$($settings.port)/huddle_dev"
                "JWT_SECRET=$($settings.jwtSecret)"
                'PORT=3000'
                'NODE_ENV=development'
            ) -join "`n")
        } else { Write-Output 'Preserved existing .env.local.' }
        if (-not (Test-Path -LiteralPath $testEnv)) {
            Write-NewFile $testEnv (@(
                '# Dedicated test database; never use your development or production database.'
                "TEST_DATABASE_URL=postgresql://huddle_test:$($settings.testPassword)@127.0.0.1:$($settings.port)/huddle_test"
                "JWT_SECRET=$($settings.testJwtSecret)"
                'NODE_ENV=test'
            ) -join "`n")
        } else { Write-Output 'Preserved existing .env.test.local.' }
        Write-Output "Local PostgreSQL is ready on 127.0.0.1:$($settings.port) (huddle_dev, huddle_test)."
        Write-Output 'Configuration is stored in ignored local files. Application migrations are a separate step.'
    } elseif ($Action -eq 'start') {
        if (-not (Test-Path -LiteralPath (Join-Path $localDirectory 'configured'))) {
            throw 'Local configuration is incomplete. Run npm run db:local:setup first.'
        }
        Start-LocalDatabase
        Write-Output "Local PostgreSQL is running on 127.0.0.1:$($settings.port)."
    } elseif ($Action -eq 'stop') {
        if (Test-Running) {
            [void](Invoke-Postgres 'pg_ctl' @('-D', $dataDirectory, '-m', 'fast', '-w', '-t', '30', 'stop'))
        }
        Write-Output 'Local PostgreSQL is stopped. Data and configuration were preserved.'
    } else {
        if (Test-Running) { Write-Output "Local PostgreSQL is running on 127.0.0.1:$($settings.port)." }
        else { Write-Output 'Local PostgreSQL is stopped.' }
    }
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
