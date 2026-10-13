param([int]$Iterations = 10)
$ErrorActionPreference = 'Stop'

# Requires the running English Expo Go preview on this emulator. Reload through
# its device menu so another connected client (including an iPhone) is untouched.
function Read-Snapshot {
    $result = agent-device snapshot -i --platform android --serial emulator-5556 | Out-String
    if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect emulator' }
    if ($result -match 'NullPointerException|NativeDatabase.prepareSync|Render Error|Uncaught Error') {
        throw "App error after reload: $result"
    }
    return $result
}

function Wait-Content([string]$Pattern) {
    $deadline = (Get-Date).AddSeconds(60)
    do {
        $snapshot = Read-Snapshot
        if ($snapshot -match 'Clerk: Clerk has been loaded') {
            agent-device react-native dismiss-overlay | Out-Null
            $snapshot = Read-Snapshot
        }
        if ($snapshot -match $Pattern) { return $snapshot }
        Start-Sleep -Seconds 1
    } while ((Get-Date) -lt $deadline)
    throw "Expected app content did not appear: $snapshot"
}

for ($iteration = 1; $iteration -le $Iterations; $iteration++) {
    adb -s emulator-5556 shell input keyevent 82 | Out-Null
    $menu = Wait-Content '(?m)^@e\d+ \[group\] "Reload"'
    $reload = [regex]::Match($menu, '(?m)^(@e\d+) \[group\] "Reload"').Groups[1].Value
    agent-device press $reload --settle | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not press Reload' }
    Wait-Content 'Ready to move|Breakfast' | Out-Null
    agent-device open host.exp.exponent 'exp://127.0.0.1:8083/--/nutrition' --platform android --serial emulator-5556 --foreground --no-test-ime | Out-Null
    Wait-Content 'Breakfast' | Out-Null
    Write-Output "PASS $iteration/$Iterations`: diary visible after device-only reload"
}
