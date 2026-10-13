$ErrorActionPreference = 'Stop'
$before = (agent-device snapshot -i --json | ConvertFrom-Json).data.nodes
$handles = @($before | Where-Object { $_.label -like 'Move *' })
if ($handles.Count -lt 2) { throw 'Open Reorder goals before running this check.' }
$first = $handles[0]
$x = [int]($first.rect.x + $first.rect.width / 2)
$y = [int]($first.rect.y + $first.rect.height / 2)
adb -s emulator-5556 shell input swipe $x $y $x ($y + 200) 800
$after = (agent-device snapshot -i --json | ConvertFrom-Json).data.nodes
$newOrder = @($after | Where-Object { $_.label -like 'Move *' } | ForEach-Object { $_.label })
if ($newOrder[0] -eq $first.label) { throw "FAIL: dragging $($first.label) down did not change order." }
Write-Output ('PASS: ' + ($newOrder -join ', '))
