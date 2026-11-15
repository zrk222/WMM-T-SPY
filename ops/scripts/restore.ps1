param([Parameter(Mandatory = $true)][string]$File)
if (-not (Test-Path $File)) { throw "missing $File" }
docker cp $File "ops-mongo-1:/tmp/restore.archive.gz"
docker exec ops-mongo-1 mongorestore --drop --archive=/tmp/restore.archive.gz --gzip
docker exec ops-mongo-1 rm /tmp/restore.archive.gz
Write-Output "restored $File"
