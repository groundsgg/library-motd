param([uint32]$TestRunnerPid, [switch]$IncludeRanges)
$ErrorActionPreference = 'Stop'
$snapshot = @{ tcp = $null; memory = $null; processes = $null; dynamicPorts = @{}; errors = @() }

function Get-StateCounts($Connections) {
    $counts = [ordered]@{}
    foreach ($name in @('Bound', 'Closed', 'CloseWait', 'Closing', 'DeleteTCB', 'Established',
        'FinWait1', 'FinWait2', 'LastAck', 'Listen', 'SynReceived', 'SynSent', 'TimeWait')) {
        $counts[$name] = 0
    }
    foreach ($connection in $Connections) {
        $state = $connection.State.ToString()
        if ($counts.Contains($state)) { $counts[$state]++ }
    }
    return $counts
}

$fixtureOwners = @()
try {
    $connections = @(Get-NetTCPConnection -ErrorAction Stop)
    $fixture = @($connections | Where-Object { $_.LocalPort -eq 4173 -or $_.RemotePort -eq 4173 })
    $snapshot.tcp = @{ states = (Get-StateCounts $connections); fixture = (Get-StateCounts $fixture) }
    $fixtureOwners = @($fixture | Where-Object { $_.OwningProcess -gt 0 } | Select-Object -ExpandProperty OwningProcess)
} catch { $snapshot.errors += 'tcp-query' }

try {
    $memory = Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory -ErrorAction Stop
    $snapshot.memory = @{
        availableBytes = $memory.AvailableBytes
        committedBytes = $memory.CommittedBytes
        commitLimitBytes = $memory.CommitLimit
        nonpagedPoolBytes = $memory.PoolNonpagedBytes
        pagedPoolBytes = $memory.PoolPagedBytes
    }
} catch { $snapshot.errors += 'memory-query' }

try {
    $ids = @(@($TestRunnerPid) + $fixtureOwners | Select-Object -Unique)
    $processes = @(Get-Process -Id $ids -ErrorAction SilentlyContinue)
    if ($processes.Count -eq 0) { throw 'missing processes' }
    $snapshot.processes = @{
        count = $processes.Count
        workingSetBytes = ($processes | Measure-Object WorkingSet64 -Sum).Sum
        privateBytes = ($processes | Measure-Object PrivateMemorySize64 -Sum).Sum
        handles = ($processes | Measure-Object HandleCount -Sum).Sum
        maxHandles = ($processes | Measure-Object HandleCount -Maximum).Maximum
    }
} catch { $snapshot.errors += 'process-query' }

if ($IncludeRanges) {
    foreach ($family in @('ipv4', 'ipv6')) {
        try {
            $output = & netsh int $family show dynamicport tcp
            if ($LASTEXITCODE -ne 0) { throw 'range query failed' }
            $numbers = @($output | ForEach-Object {
                if ($_ -match ':\s*(\d+)\s*$') { [int]$Matches[1] }
            })
            if ($numbers.Count -ne 2 -or $numbers[0] -lt 1 -or $numbers[1] -lt 1 -or
                ($numbers[0] + $numbers[1]) -gt 65536) { throw 'unknown range format' }
            $snapshot.dynamicPorts[$family] = @{ start = $numbers[0]; count = $numbers[1] }
        } catch { $snapshot.errors += "$family-range" }
    }
}
$snapshot | ConvertTo-Json -Depth 5 -Compress
